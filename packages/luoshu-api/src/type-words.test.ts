// type-words 单一事实源契约测试（sub-req-4 Task 11 词表合并）：
// 1. 渲染层薄层（type-badge.mapNativeType，pluginId 键）与主进程薄层
// （transfer-core.mapNativeToStd，dialect 键）对词表全量词必须同值
// 双份词表时代的漂移面就此收口（同族内任意 pluginId/dialect 组合互证）；
// 2. 语义基准：全词大小写不敏感、词表外 unknown、SQLite 关键词短路序
// （TIMESTAMP 先于 TIME 命中 datetime）。
// ：渲染侧 pluginId 随 type-badge FAMILY_BY_PLUGIN 键修正
// 换 v2 插件 id（luoshu-*——运行时插件 id = package.json name，loader.ts 口径）。

import { describe, expect, it } from 'vitest'
import { TYPE_WORDS_BY_FAMILY } from './type-words'
import { mapNativeToStandard, mapSqliteKeyword } from './type-words'
// 公开发布仓跳过：type-badge 交叉互证属主仓 luoshu-query 件（相对路径不可达）
// S2 出仓后 transfer-core 在插件（跨包测试 import——互证口径不变； 删旧后
// 互证对象换 v2 后继件：datastudio→query / datatools→tools，薄层行为零改动平移）
// 互证目标（主仓）：plugins/luoshu-tools/src/transfer-core.mapNativeToStd —— 公开发布仓不引入
import type { SqlDialect } from 'luoshu-api'

/** 族 → 渲染侧 pluginId 清单（v2 插件 id = package.json name；含薄壳共享实现的两两组合） */
const PLUGINS_BY_FAMILY: Record<string, string[]> = {
  mysql: ['luoshu-mysql', 'luoshu-mariadb'],
  pg: ['luoshu-postgresql', 'luoshu-kingbase'],
  mssql: ['luoshu-sqlserver'],
  dm: ['luoshu-dm']
}

/** 族 → 主进程侧 dialect 键（dm 族的契约方言词是 'oracle-like'） */
const DIALECT_BY_FAMILY: Record<string, SqlDialect> = {
  mysql: 'mysql',
  pg: 'pg',
  mssql: 'mssql',
  dm: 'oracle-like'
}

// 公开发布仓跳过：两端薄层互证依赖主仓 plugins/luoshu-query 渲染层（相对路径不可达）——主仓执行
describe.skip('type-words 单一事实源：两端薄层互证', () => {
  it('词表全量词在渲染层（pluginId）与主进程（dialect）两条路径同值', () => {
    for (const [family, words] of Object.entries(TYPE_WORDS_BY_FAMILY)) {
      const plugins = PLUGINS_BY_FAMILY[family]
      const dialect = DIALECT_BY_FAMILY[family]
      expect(plugins, `族 ${family} 需有渲染侧插件映射`).toBeDefined()
      for (const [word, expected] of Object.entries(words)) {
        for (const pluginId of plugins!) {
          expect(mapNativeType(pluginId, word)).toBe(expected)
          expect(mapNativeType(pluginId, word.toUpperCase())).toBe(expected) // 大小写不敏感
        }
        expect(mapNativeToStd(dialect, word)).toBe(expected)
      }
    }
  })

  it('词表外新词两端同报 unknown（零异常约定 ②；SQLite 走包含匹配另测）', () => {
    // 注意词面不能撞 SQLite 关键词子串（如 REAL/TIME/INT）——那条路径是包含匹配
    for (const pluginId of ['luoshu-mysql', 'luoshu-postgresql', 'luoshu-dm']) {
      expect(mapNativeType(pluginId, 'zzz_quux')).toBe('unknown')
    }
    for (const dialect of ['mysql', 'pg', 'oracle-like', 'mssql'] as SqlDialect[]) {
      expect(mapNativeToStd(dialect, 'zzz_quux')).toBe('unknown')
    }
    expect(mapNativeToStd(undefined, 'int')).toBe('unknown')
    expect(mapNativeType('mock-adapter', 'int')).toBe('unknown')
    expect(mapNativeType('luoshu-mock', 'int')).toBe('unknown') // v2 mock 件同样未收录
    // SQLite 词表外（无任何关键词子串）同报 unknown
    expect(mapNativeType('luoshu-sqlite', 'zzz_quux')).toBe('unknown')
    expect(mapNativeToStd('sqlite', 'zzz_quux')).toBe('unknown')
  })

  it('SQLite 关键词短路序：TIMESTAMP 先于 TIME 命中 datetime', () => {
    expect(mapNativeToStandard('sqlite', 'TIMESTAMP')).toBe('datetime')
    expect(mapNativeToStandard('sqlite', 'TIME')).toBe('time')
    expect(mapNativeToStandard('sqlite', '')).toBe('unknown')
    expect(mapNativeToStandard('sqlite', 'VARCHAR(80)')).toBe('string') // 包含匹配带修饰
  })
})

// ===== nativeVocabularyOf 反查=====
// 表设计器类型下拉的原生词来源（v1 manifest typeVocabulary 的 v2 替代形态
// 本包派生，与 §3 主表共用同一事实源；消费方 luoshu-designer typeVocabularyOf）。

import { nativeVocabularyOf } from './type-words'
import type { StandardType } from './type-words'

/** 十值标准类型的非 unknown 九值（canonical 序；type-mapping.md §2） */
const ALL_STANDARD: Exclude<StandardType, 'unknown'>[] = [
  'string', 'number', 'boolean', 'datetime', 'date', 'time', 'json', 'binary', 'uuid'
]

describe('nativeVocabularyOf（标准类型 → 方言原生词反查）', () => {
  it('族可表达的槽位全覆盖：主表有词面的槽位 ≥1 词，无词面槽位如实缺省', () => {
    for (const family of ['mysql', 'pg', 'mssql', 'dm', 'sqlite'] as const) {
      const vocab = nativeVocabularyOf(family)
      // 与主表可表达面严格一致：主表含该槽位 ↔ 反查词表含该槽位（≥1 词）。
      // sqlite 无全词表（§3.1 关键词包含匹配族）——expressible 集合为空、九槽由
      // 代表词表自持（本 describe 末尾独立断言）。
      const expressible = new Set(
        Object.values(TYPE_WORDS_BY_FAMILY[family] ?? {}).filter((s): s is StandardType => s !== 'unknown')
      )
      for (const std of ALL_STANDARD) {
        const words = vocab[std]
        if (expressible.has(std)) {
          expect(words, `${family}/${std} 主表可表达，反查必须给词`).toBeDefined()
          expect(words!.length).toBeGreaterThanOrEqual(1)
        } else if (family !== 'sqlite') {
          expect(words, `${family}/${std} 主表无词面，反查不得虚构`).toBeUndefined()
        }
      }
      // pg 全槽位覆盖（唯一九槽齐备的全词族——uuid=uuid、boolean=boolean）
      if (family === 'pg') expect(ALL_STANDARD.every((s) => (vocab[s]?.length ?? 0) > 0)).toBe(true)
    }
    // sqlite（关键词族）：九槽齐备（代表词表自持）
    const sqlite = nativeVocabularyOf('sqlite')
    expect(ALL_STANDARD.every((s) => (sqlite[s]?.length ?? 0) > 0)).toBe(true)
  })

  it('反查与正向映射互证：每个词经 mapNativeToStandard 落回原槽位', () => {
    for (const family of ['mysql', 'pg', 'mssql', 'dm'] as const) {
      const vocab = nativeVocabularyOf(family)
      for (const [std, words] of Object.entries(vocab)) {
        for (const w of words!) {
          expect(mapNativeToStandard(family, w)).toBe(std)
          expect(mapNativeToStandard(family, w.toUpperCase())).toBe(std) // 大小写不敏感口径一致
        }
      }
    }
    for (const [std, words] of Object.entries(nativeVocabularyOf('sqlite'))) {
      for (const w of words!) expect(mapSqliteKeyword(w)).toBe(std)
    }
  })

  it('词序随主表声明序（下拉展示序稳定）且 unknown 槽位恒缺省', () => {
    // mysql/number 主表序：tinyint…year（Object.entries 保插入序——下拉展示序可预期）
    expect(nativeVocabularyOf('mysql').number).toEqual([
      'tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint', 'decimal', 'numeric',
      'float', 'double', 'real', 'bit', 'year',
    ])
    expect(nativeVocabularyOf('mysql').unknown).toBeUndefined()
    expect(nativeVocabularyOf('pg').unknown).toBeUndefined()
  })

  it('方言差异：mssql bit→boolean 与 mysql bit→number 分家（任务书点名案例）', () => {
    expect(nativeVocabularyOf('mssql').boolean).toContain('bit')
    expect(nativeVocabularyOf('mysql').boolean).toBeUndefined() // MySQL 无原生 boolean 词面
    expect(nativeVocabularyOf('mysql').number).toContain('bit')
    expect(nativeVocabularyOf('dm').boolean).toContain('bit') // 达梦同为 boolean
    expect(nativeVocabularyOf('pg').uuid).toEqual(['uuid'])
    expect(nativeVocabularyOf('mssql').uuid).toEqual(['uniqueidentifier'])
  })
})
