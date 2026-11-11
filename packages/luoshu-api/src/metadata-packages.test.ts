// 公开发布仓跳过：本测试扫描主仓 plugins/ 目录（workspace 专属）；主仓执行。
// B 全量迁移回归：所有插件 package.json 只保留装载/分类字段；展示/声明面在 src/meta.ts；
// 仓库内不再存在 manifest.json。
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validatePluginCodeMeta } from './metadata.ts'

const repoRoot = resolve(__dirname, '../../..')
const pluginsRoot = join(repoRoot, 'plugins')
const PACKAGE_KEYS = new Set(['provides', 'tier', 'ui', 'hostGroup', 'kind', 'kindLabel', 'market'])

function pluginDirs(): string[] {
  const dirs: string[] = []
  for (const name of readdirSync(pluginsRoot)) {
    const dir = join(pluginsRoot, name)
    if (existsSync(join(dir, 'package.json'))) dirs.push(dir)
    if (existsSync(join(dir, 'theme', 'package.json'))) dirs.push(join(dir, 'theme'))
  }
  return dirs
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'web' || name === '.git') continue
    const full = join(dir, name)
    if (name === 'manifest.json') out.push(full)
    else {
      try {
        if (readdirSync(full)) walk(full, out)
      } catch {
        // 文件不是目录
      }
    }
  }
  return out
}

describe.skip('package.json / 代码元数据全量迁移', () => {
  it('package.json luoshu 只含装载/分类字段', () => {
    for (const dir of pluginDirs()) {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { luoshu?: Record<string, unknown> }
      for (const key of Object.keys(pkg.luoshu ?? {})) {
        expect(PACKAGE_KEYS.has(key), `${dir} luoshu.${key} 不应留在 package.json`).toBe(true)
      }
    }
  })

  it('所有 src/meta.ts 通过代码元数据 schema', async () => {
    for (const dir of pluginDirs()) {
      const metaPath = join(dir, 'src', 'meta.ts')
      if (!existsSync(metaPath)) continue
      const mod = (await import(pathToFileURL(metaPath).href)) as { meta?: unknown }
      expect(() => validatePluginCodeMeta(mod.meta ?? {}), dir).not.toThrow()
    }
  })

  it('仓库 plugins/ 下不再存在 manifest.json', () => {
    expect(walk(pluginsRoot)).toEqual([])
  })
})
