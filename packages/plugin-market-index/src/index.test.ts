// 洛书插件市场索引格式 1 校验器直测：合法文档规范化 / 各段拒绝 / semver 排序 /
// 穿越与重复防护 / 安装目标。
import { describe, expect, it } from 'vitest'
import { MarketIndexError, marketInstallTarget, parseMarketIndex, semverCompare } from './index.ts'

const INDEX_URL = 'https://market.example.com/index.json'

/** 合法最小文档（多数用例在其上做变异破坏） */
function validDoc(): Record<string, unknown> {
  return {
    format: 1,
    title: '洛书插件市场',
    description: '官方索引',
    plugins: [
      {
        name: 'luoshu-plugin-foo',
        title: 'Foo',
        description: '示例插件',
        icon: 'icons/foo.png',
        author: '洛书官方',
        homepage: 'https://example.com/foo',
        repository: 'https://github.com/example/foo',
        keywords: ['demo'],
        category: 'tool',
        'dist-tags': { latest: '1.1.0' },
        versions: [
          { version: '1.1.0', publishTimestamp: 1790476800, engines: { luoshu: '>=0.3.0' } },
          { version: '1.0.0', publishTimestamp: 1789872000 },
        ],
      },
    ],
  }
}

describe('parseMarketIndex 合法路径', () => {
  it('合法文档 → 规范化结果（versions semver 降序 / icon 相对→绝对 / format=1）', () => {
    const idx = parseMarketIndex(validDoc(), INDEX_URL)
    expect(idx.format).toBe(1)
    expect(idx.title).toBe('洛书插件市场')
    expect(idx.plugins).toHaveLength(1)
    const p = idx.plugins[0]!
    expect(p.name).toBe('luoshu-plugin-foo')
    expect(p.versions.map((v) => v.version)).toEqual(['1.1.0', '1.0.0']) // 降序
    expect(p.icon).toBe('https://market.example.com/icons/foo.png') // 相对→绝对
  })

  it('乱序 versions 输入 → 降序规范化（含 prerelease 低于正式版）', () => {
    const doc = validDoc()
    const p = (doc['plugins'] as Array<Record<string, unknown>>)[0]!
    p['dist-tags'] = { latest: '2.0.0' }
    p['versions'] = [
      { version: '1.0.0', publishTimestamp: 1 },
      { version: '2.0.0-beta.1', publishTimestamp: 2 },
      { version: '2.0.0', publishTimestamp: 3 },
      { version: '1.2.0', publishTimestamp: 4 },
    ]
    const idx = parseMarketIndex(doc, INDEX_URL)
    expect(idx.plugins[0]!.versions.map((v) => v.version)).toEqual(['2.0.0', '2.0.0-beta.1', '1.2.0', '1.0.0'])
  })

  it('semverCompare：prerelease 逐段比较（数字段<字母段）', () => {
    expect(semverCompare('1.0.0-alpha', '1.0.0')).toBeLessThan(0)
    expect(semverCompare('1.0.0-alpha.2', '1.0.0-alpha.10')).toBeLessThan(0)
    expect(semverCompare('1.0.0-alpha.1', '1.0.0-beta.1')).toBeLessThan(0)
    expect(semverCompare('1.0.0', '1.0.0')).toBe(0)
  })

  it('marketInstallTarget：npm 精确 spec', () => {
    expect(marketInstallTarget('luoshu-plugin-foo', '1.1.0')).toEqual({ spec: 'luoshu-plugin-foo@1.1.0' })
  })
})

describe('parseMarketIndex 拒绝面', () => {
  it('plugins 空数组 = 合法冷启动态（2026-11-10 放宽——新 registry 尚无包）', () => {
    const doc = validDoc()
    doc['plugins'] = []
    const idx = parseMarketIndex(doc, INDEX_URL)
    expect(idx.plugins).toEqual([])
  })

  const bad = (doc: unknown, wantPath: string) => {
    try {
      parseMarketIndex(doc, INDEX_URL)
      return null
    } catch (err) {
      expect(err).toBeInstanceOf(MarketIndexError)
      const e = err as MarketIndexError
      expect(e.path).toBe(wantPath)
      return e
    }
  }

  it('顶层：非对象 / format≠1 / title 空 / plugins 空数组', () => {
    expect(() => parseMarketIndex(null, INDEX_URL)).toThrow(MarketIndexError)
    bad({ ...validDoc(), format: 2 }, 'format')
    bad({ ...validDoc(), title: '' }, 'title')
  })

  it('icon：data: 超上限拒绝；相对路径补全为绝对（其余字符串均可相对解析——无真实非法面）', () => {
    const d1 = validDoc()
    ;(d1['plugins'] as Array<Record<string, unknown>>)[0]!['icon'] = 'data:image/png;base64,' + 'A'.repeat(50_000)
    bad(d1, 'plugins[0].icon')
    const d2 = validDoc()
    ;(d2['plugins'] as Array<Record<string, unknown>>)[0]!['icon'] = 'icons/foo.png'
    const idx = parseMarketIndex(d2, INDEX_URL)
    expect(idx.plugins[0]!.icon).toBe('https://market.example.com/icons/foo.png')
  })

  it('版本：非法 semver / 重复 / publishTimestamp 毫秒误填', () => {
    const d1 = validDoc()
    ;((d1['plugins'] as Array<Record<string, unknown>>)[0]!['versions'] as Array<Record<string, unknown>>)[0]!['version'] = '1.0'
    bad(d1, 'plugins[0].versions[0].version')
    const d2 = validDoc()
    const vs2 = (d2['plugins'] as Array<Record<string, unknown>>)[0]!['versions'] as Array<Record<string, unknown>>
    vs2[1]!['version'] = '1.1.0'
    bad(d2, 'plugins[0].versions[1].version')
    const d3 = validDoc()
    ;((d3['plugins'] as Array<Record<string, unknown>>)[0]!['versions'] as Array<Record<string, unknown>>)[0]!['publishTimestamp'] = 1790476800000
    bad(d3, 'plugins[0].versions[0].publishTimestamp')
  })

  it('dist-tags：缺 latest / latest 指向不存在的版本', () => {
    const d1 = validDoc()
    ;(d1['plugins'] as Array<Record<string, unknown>>)[0]!['dist-tags'] = {}
    bad(d1, 'plugins[0].dist-tags.latest')
    const d2 = validDoc()
    ;(d2['plugins'] as Array<Record<string, unknown>>)[0]!['dist-tags'] = { latest: '9.9.9' }
    bad(d2, 'plugins[0].dist-tags.latest')
  })

  it('插件名重复 / 非对象成员', () => {
    const d1 = validDoc()
    ;(d1['plugins'] as Array<Record<string, unknown>>).push(validDoc()['plugins'][0] as Record<string, unknown>)
    bad(d1, 'plugins[1].name')
    const d2 = validDoc()
    ;(d2['plugins'] as Array<Record<string, unknown>>)[0] = 'nope'
    bad(d2, 'plugins[0]')
  })
})
