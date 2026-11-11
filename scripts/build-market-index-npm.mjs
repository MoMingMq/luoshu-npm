#!/usr/bin/env node
// 市场索引生成器：从 npm registry 聚合
// luoshu-plugin-* 包 → 洛书索引 format 1（@luoshu-official/plugin-market-index 校验器同源）。
//
// 与旧静态索引（build-market-index.cjs，lpkg 片段聚合）分离：npm 模式是
// 分发底座（路线 A）的官方索引产线——发布链：插件 CI publish npm → 本脚本（或
// registry 查询服务）聚合 → 静态托管 index.json → 应用市场页/设置页消费。
//
// 用法：
// node scripts/build-market-index-npm.mjs \
// --title "洛书插件市场" [--out build/market-index.json] \
// [--registry https://registry.npmjs.org] [--scope luoshu-plugin] [--since-name <name>]
// 聚合策略（无服务端最小形态）：`registry/-/v1/search?text=keywords:luoshu-plugin`
// 分页拉全量候选 → 逐包 `registry/<name>` 精确 manifest 拿全部 versions/engines →
// 组装 format 1。npm search 索引延迟可接受（新发布包分钟级可见）。
//
// 输出经 @luoshu-official/plugin-market-index parseMarketIndex 校验后才落盘（发布前自检
// 校验失败非零退出，坏索引不出门）。

'use strict'

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const readArg = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const out = path.resolve(readArg('--out') ?? 'build/market-index.json')
const registry = (readArg('--registry') ?? process.env.LUOSHU_NPM_REGISTRY ?? 'https://registry.npmjs.org').replace(/\/?$/, '/')
const searchText = readArg('--text') ?? 'keywords:luoshu-plugin'
const title = readArg('--title') ?? '洛书插件市场'
const description = readArg('--description') ?? '洛书（Luoshu）官方插件索引——npm 分发，engines.luoshu 版本门禁'

/** registry GET（execFileSync curl ——脚本层零 npm 依赖；失败抛人读） */
function registryGet(pathname) {
  const url = registry + pathname.replace(/^\//, '')
  const r = execFileSync('curl', ['-fsSL', '--max-time', '30', url], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return JSON.parse(r)
}

/** search 分页拉全量候选包名（objects[].package.name 去重保序） */
function searchAll() {
  const names = []
  const seen = new Set()
  let from = 0
  for (;;) {
    const page = registryGet(`-/v1/search?text=${encodeURIComponent(searchText)}&size=250&from=${from}`)
    const objects = Array.isArray(page.objects) ? page.objects : []
    for (const o of objects) {
      const name = o?.package?.name
      if (typeof name === 'string' && name !== '' && !seen.has(name)) {
        seen.add(name)
        names.push(name)
      }
    }
    const total = typeof page.total === 'number' ? page.total : 0
    from += objects.length
    if (objects.length === 0 || from >= total) break
  }
  return names
}

/** 单包 manifest → format 1 条目（无 dist-tags.latest 或无 versions 的包跳过） */
function toPluginEntry(name, manifest) {
  const distTags = manifest['dist-tags']
  const versions = manifest.versions
  if (typeof distTags !== 'object' || distTags === null || typeof distTags['latest'] !== 'string') return null
  if (typeof versions !== 'object' || versions === null) return null
  const latest = versions[distTags['latest']]
  const readmeUrl = manifest.readmeUrl ?? null
  const versionEntries = []
  for (const [version, v] of Object.entries(versions)) {
    if (typeof v !== 'object' || v === null) continue
    const time = manifest.time?.[version]
    if (typeof time !== 'string') continue
    const engines = typeof v.engines === 'object' && v.engines !== null && typeof v.engines.luoshu === 'string'
      ? { luoshu: v.engines.luoshu }
      : undefined
    versionEntries.push({
      version,
      publishTimestamp: Math.floor(new Date(time).getTime() / 1000),
      ...(engines !== undefined ? { engines } : {}),
      ...(readmeUrl !== null ? { readme: readmeUrl } : {}),
    })
  }
  if (versionEntries.length === 0) return null
  const latestMeta = typeof latest === 'object' && latest !== null ? latest : {}
  return {
    name,
    title: typeof latestMeta.title === 'string' && latestMeta.title !== '' ? latestMeta.title : name,
    description: typeof manifest.description === 'string' ? manifest.description : '',
    author: typeof manifest.author?.name === 'string' ? manifest.author.name
      : typeof manifest.author === 'string' ? manifest.author : undefined,
    homepage: typeof manifest.homepage === 'string' ? manifest.homepage : undefined,
    repository: typeof manifest.repository?.url === 'string' ? manifest.repository.url.replace(/^git\+/, '').replace(/\.git$/, '') : undefined,
    keywords: Array.isArray(manifest.keywords) ? manifest.keywords.filter((k) => typeof k === 'string') : undefined,
    'dist-tags': distTags,
    versions: versionEntries,
  }
}

// ===== 主流程 =====
// --max-packages 上限（默认 200）：逐包 manifest 拉取串行，大生态冒烟/产线均需封顶
// （超限截断并告警——产线可分批/加并发后放开）
const maxPackages = Number(readArg('--max-packages') ?? 200)
console.log(`[market-index-npm] registry=${registry} text="${searchText}" max=${maxPackages}`)
const names = searchAll().slice(0, maxPackages)
console.log(`[market-index-npm] 候选包 ${names.length} 个`)
const plugins = []
const skipped = []
for (const name of names) {
  try {
    const manifest = registryGet(encodeURIComponent(name).replace('%40', '@'))
    const entry = toPluginEntry(name, manifest)
    if (entry === null) skipped.push(`${name}（无 latest/versions）`)
    else plugins.push(entry)
  } catch (err) {
    skipped.push(`${name}（${err.message?.slice(0, 80)}）`)
  }
}
plugins.sort((a, b) => a.name.localeCompare(b.name))
if (skipped.length > 0) console.log(`[market-index-npm] 跳过 ${skipped.length}：\n  ${skipped.join('\n  ')}`)

// 冷启动场景（--allow-empty）：npm 上尚无 luoshu-plugin-* 包时仍产出合法空索引
// （校验器 min 1 条——空插件列表需显式豁免；正常产线不传此参，坏索引不出门）
const allowEmpty = args.includes('--allow-empty')
if (plugins.length === 0 && !allowEmpty) {
  console.error('[market-index-npm] 聚合结果为空（npm 上暂无匹配包）——如需产出空索引用 --allow-empty')
  process.exit(1)
}

const index = { format: 1, title, ...(description !== '' ? { description } : {}), plugins }

// 发布前自检：与宿主读取同一校验器（T2 包源码直载——node type stripping）
import { pathToFileURL } from 'node:url'
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const validatorPath = path.resolve(scriptDir, '../packages/plugin-market-index/src/index.ts')
import(pathToFileURL(validatorPath).href).then(({ parseMarketIndex }) => {
  try {
    const validated = parseMarketIndex(index, 'https://market.luoshu.invalid/index.json')
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, JSON.stringify(validated, null, 2) + '\n')
    console.log(`[market-index-npm] ${plugins.length} 件 → ${out}（校验通过）`)
  } catch (err) {
    console.error(`[market-index-npm] 索引校验失败（坏索引不出门）: ${err.message}`)
    process.exit(1)
  }
})
