// luoshu-api 发布产物构建
//
// 背景：tsconfig.json 切 noEmit+allowImportingTsExtensions 后（ P3
// ，宿主直载 TS 源链需要显式 .ts 后缀），`tsc -p tsconfig.json` 退化为
// 纯类型检查，dist/ 不再产出——而 publishConfig.exports 指向 ./dist/*，npm
// 发布路径断链。本脚本恢复真实产物：
//
// 1) esbuild bundle：src/index.ts → dist/index.js、src/contract-test.ts →
// dist/contract-test.js（ESM，单文件）。源内相对导入全部带显式 .ts 后缀
// （直载铁律），由 bundler 在打包期消化，bundle 内不存在任何相对导入。
// zod/vitest 保持 external：zod 是声明的运行时依赖（manifest 校验）
// vitest 必须与消费方测试运行器同实例（./testing 契约测试入口）。
// 2) d.ts 产物：tsc -p tsconfig.build.json（emitDeclarationOnly）后统一把
// 相对说明符 `.ts` 改写 `.js`——rewriteRelativeImportExtensions 在声明
// emit 中不生效（TS 5.8.3 与 7.0.2 实测一致），不改写则消费方类型解析
// 断链（dist 内没有 .ts 源文件）。源内相对导入全部显式 .ts 后缀，改写
// 是确定性文本变换。
//
// 末尾自检（零运行时依赖面核对 + 说明符核对，失败即非零退出）：
// - dist/*.js 的外部 import 必须 ⊆ {zod, vitest}（luoshu-cordis 仅类型
// 导入，bundle 期擦除；出现任何相对导入或未知外部依赖即失败）；
// - dist/*.d.ts 不得残留相对 `.ts` 说明符。
//
// 用法：pnpm --filter luoshu-api build（或 node scripts/build.mjs）

import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(pkgRoot, 'dist')

/** 允许出现在发布产物里的外部依赖（与 package.json dependencies 声明面对齐核对） */
const ALLOWED_EXTERNAL = new Set(['zod', 'vitest'])

function cleanDist() {
  rmSync(distDir, { recursive: true, force: true })
  mkdirSync(distDir, { recursive: true })
}

async function bundleJs() {
  const common = {
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    sourcemap: false,
    logLevel: 'silent',
    absWorkingDir: pkgRoot
  }
  await build({
    ...common,
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.js',
    external: ['zod']
  })
  await build({
    ...common,
    entryPoints: ['src/contract-test.ts'],
    outfile: 'dist/contract-test.js',
    // vitest 必须外置：契约测试在消费方自己的 vitest 运行器下执行
    // 内联会生成第二套 describe/it/expect 实例，用例不会被收集
    external: ['vitest']
  })
}

function emitDts() {
  const tsPackageJson = require.resolve('typescript/package.json')
  const tscBin = join(dirname(tsPackageJson), 'bin', 'tsc')
  const result = spawnSync(process.execPath, [tscBin, '-p', 'tsconfig.build.json'], {
    cwd: pkgRoot,
    stdio: 'inherit'
  })
  if (result.status !== 0) {
    throw new Error(`tsc emitDeclarationOnly 失败（exit=${result.status}）`)
  }
}

/**
 * d.ts 相对说明符 .ts → .js 确定性改写。
 * 仅匹配带引号的相对说明符（'./x.ts' / '../x.ts'），不动 luoshu-cordis 等裸名导入。
 * 返回 { changed, files }：被改写文件数 / d.ts 文件总数。
 */
function rewriteDtsSpecifiers() {
  let changed = 0
  let files = 0
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) {
        walk(path)
      } else if (name.endsWith('.d.ts')) {
        files++
        const before = readFileSync(path, 'utf8')
        const after = before.replace(/(')(\.\.?\/[^']+)\.ts(')/g, '$1$2.js$3')
        if (after !== before) {
          writeFileSync(path, after, 'utf8')
          changed++
        }
      }
    }
  }
  walk(distDir)
  return { changed, files }
}

/** 发布产物自检：外部依赖面 + 说明符形态 */
function verifyArtifacts() {
  const problems = []
  const externalsByFile = {}
  for (const name of readdirSync(distDir)) {
    const path = join(distDir, name)
    if (!statSync(path).isFile()) continue
    if (name.endsWith('.js')) {
      const text = readFileSync(path, 'utf8')
      const matches = [
        ...text.matchAll(
          /import\s[\s\S]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|export\s[\s\S]*?from\s*['"]([^'"]+)['"]/g
        )
      ].map((m) => m[1] ?? m[2] ?? m[3])
      externalsByFile[name] = matches.filter((spec) => !spec.startsWith('.'))
      for (const spec of matches) {
        if (spec.startsWith('.')) {
          problems.push(`${name}: bundle 内残留相对导入 ${spec}（esbuild 应已内联）`)
        } else if (!ALLOWED_EXTERNAL.has(spec)) {
          problems.push(`${name}: 未声明的外部依赖 ${spec}（允许集：${[...ALLOWED_EXTERNAL].join(', ')}）`)
        }
      }
    }
    if (name.endsWith('.d.ts')) {
      const text = readFileSync(path, 'utf8')
      const stale = [...text.matchAll(/['"](\.\.?\/[^'"]+)\.ts['"]/g)].map((m) => m[1])
      for (const s of stale) problems.push(`${name}: 残留 .ts 说明符 ${s}（dts-rewrite 未覆盖）`)
    }
  }
  return { problems, externalsByFile }
}

// ---- 主流程 ----
cleanDist()
await bundleJs()
emitDts()

if (!readdirSync(distDir).includes('index.d.ts')) {
  console.error('[api-build] tsc 未产出 dist/index.d.ts——tsconfig.build.json 配置核查')
  process.exit(1)
}
const rewriteStat = rewriteDtsSpecifiers()
const { problems, externalsByFile } = verifyArtifacts()

console.log(`[api-build] dist 产物：${readdirSync(distDir).join(', ')}`)
console.log(`[api-build] d.ts 说明符改写：${rewriteStat.changed}/${rewriteStat.files} 个文件`)
for (const [file, externals] of Object.entries(externalsByFile)) {
  console.log(`[api-build] ${file} 外部依赖：${externals.length ? externals.join(', ') : '（无）'}`)
}

if (problems.length > 0) {
  console.error('[api-build] 产物自检失败：')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log('[api-build] 自检通过：bundle 零相对导入、外部依赖 ⊆ {zod, vitest}、d.ts 无 .ts 说明符')
