// 索引源纯核直测：URL 拒绝清单 / 归一化去重 / 新增校验 / 有效源选择。
import { describe, expect, it } from 'vitest'
import {
  MAX_INDEX_SOURCES, effectiveIndexSource, indexSourceAddError, indexSourceLabel,
  indexSourceUrlError, normalizeIndexSources,
} from './index-source.ts'

describe('indexSourceUrlError（拒绝清单）', () => {
  it('合法 http/https 通过（尾斜杠/转义由 URL 归一）', () => {
    expect(indexSourceUrlError('https://market.example/index.json')).toBeNull()
    expect(indexSourceUrlError('http://127.0.0.1:8080/index.json')).toBeNull()
  })

  it('空/非法/非 http(s)/凭据/fragment 逐类拒绝', () => {
    expect(indexSourceUrlError('')).toContain('请填写')
    expect(indexSourceUrlError('   ')).toContain('请填写')
    expect(indexSourceUrlError('not-a-url')).toContain('合法 URL')
    expect(indexSourceUrlError('ftp://market.example/index.json')).toContain('http/https')
    expect(indexSourceUrlError('https://user:pass@market.example/index.json')).toContain('用户名/密码')
    expect(indexSourceUrlError('https://market.example/index.json#x')).toContain('fragment')
    expect(indexSourceUrlError(`https://market.example/${'a'.repeat(2100)}`)).toContain('过长')
  })
})

describe('normalizeIndexSources（持久化归一）', () => {
  it('坏条丢弃 + URL 归一 + 重复去重 + 保序 + 标题截断', () => {
    const out = normalizeIndexSources([
      { url: 'https://A.example/index.json', title: '主源' },
      'not-a-url',
      { url: ' https://a.example/index.json ' }, // 归一后与首条重复
      { url: 'https://b.example/x.json', title: 'x'.repeat(100) },
      { title: 'no-url' },
    ])
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ url: 'https://a.example/index.json', title: '主源' })
    expect(out[1]!.url).toBe('https://b.example/x.json')
    expect(out[1]!.title!.length).toBe(64)
  })

  it('超上限截断；非数组回空', () => {
    const many = Array.from({ length: MAX_INDEX_SOURCES + 3 }, (_, i) => ({ url: `https://s${i}.example/i.json` }))
    expect(normalizeIndexSources(many)).toHaveLength(MAX_INDEX_SOURCES)
    expect(normalizeIndexSources('x')).toEqual([])
  })
})

describe('indexSourceAddError（新增校验）', () => {
  const existing = normalizeIndexSources([{ url: 'https://a.example/index.json' }])

  it('非法/重复/与部署源重复/超上限 → 人读原因', () => {
    expect(indexSourceAddError('ftp://x', existing)).toContain('http/https')
    expect(indexSourceAddError('https://a.example/index.json', existing)).toContain('已添加')
    expect(indexSourceAddError('https://D.example/index.json', existing, 'https://d.example/index.json')).toContain('官方索引源')
    const full = Array.from({ length: MAX_INDEX_SOURCES }, (_, i) => ({ url: `https://s${i}.example/i.json` }))
    expect(indexSourceAddError('https://new.example/i.json', full)).toContain('上限')
  })

  it('合法新地址回 null', () => {
    expect(indexSourceAddError('https://c.example/index.json', existing)).toBeNull()
  })
})

describe('effectiveIndexSource（活动源选择）', () => {
  const sources = normalizeIndexSources([
    { url: 'https://a.example/index.json', title: 'A' },
    { url: 'https://b.example/index.json', title: 'B' },
  ])

  it('active 命中用户源 → 用它；命中部署源 → 用它', () => {
    expect(effectiveIndexSource({ sources, activeUrl: 'https://b.example/index.json' }))
      .toEqual({ url: 'https://b.example/index.json', title: 'B', deployment: false })
    expect(effectiveIndexSource({ deploymentUrl: 'https://d.example/i.json', sources, activeUrl: 'https://d.example/i.json' }))
      .toEqual({ url: 'https://d.example/i.json', title: '部署方索引', deployment: true })
  })

  it('active 失效 → 部署源优先，否则首个用户源；全空回 null', () => {
    expect(effectiveIndexSource({ deploymentUrl: 'https://d.example/i.json', sources, activeUrl: 'https://gone.example' })?.url)
      .toBe('https://d.example/i.json')
    expect(effectiveIndexSource({ sources, activeUrl: 'https://gone.example' })?.url).toBe('https://a.example/index.json')
    expect(effectiveIndexSource({ sources: [] })).toBeNull()
  })

  it('indexSourceLabel：title 优先，否则 host+path', () => {
    expect(indexSourceLabel(sources[0]!)).toBe('A')
    expect(indexSourceLabel({ url: 'https://m.example/market/index.json' })).toBe('m.example/market/index.json')
  })
})
