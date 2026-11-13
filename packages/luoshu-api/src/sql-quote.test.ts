// sql-quote 单测（sub-req-3 Task 5，TDD）：标识符/限定表名引用与占位符的方言规则
// 以及危险标识符的校验拒绝（空串 / 方言引号字符 / 控制字符 / 空段限定名）。
// 引号形态依据（各插件 nodeQuery 的同构实现，非凭记忆）：
// mysql-adapter quoteIdent 反引号、pg/sqlite/dm 双引号、sqlserver 本插件用方括号
// 但主程序侧统一双引号（T-SQL QUOTED_IDENTIFIER ON 下合法，任务书定规）。

import { describe, expect, it } from 'vitest'
import type { LuoshuError } from 'luoshu-api'
import {
  parseOrderBy,
  placeholderOf,
  quoteCharOf,
  quoteIdentifier,
  quoteTableRef
} from './sql-quote'

/** 捕获式断言：必须抛 LuoshuError 且 code=LUOSHU.BAD_REQUEST（toThrowError 正则只匹配 message） */
function expectBadRequest(fn: () => unknown): LuoshuError {
  try {
    fn()
  } catch (e) {
    const err = e as LuoshuError
    expect(err.code).toBe('LUOSHU.BAD_REQUEST')
    expect(typeof err.message).toBe('string')
    return err
  }
  throw new Error('期望抛出 LUOSHU.BAD_REQUEST，但调用正常返回')
}

describe('quoteIdentifier（单标识符引用）', () => {
  it('mysql 方言：反引号；其余方言（含缺省）双引号', () => {
    expect(quoteIdentifier('mysql', 't1')).toBe('`t1`')
    expect(quoteIdentifier('pg', 't1')).toBe('"t1"')
    expect(quoteIdentifier('sqlite', 't1')).toBe('"t1"')
    expect(quoteIdentifier('mssql', 't1')).toBe('"t1"')
    expect(quoteIdentifier('oracle-like', 't1')).toBe('"t1"')
    // ConnectionInfo.dialect 缺省按 pg 风格（types.ts JSDoc 契约）
    expect(quoteIdentifier(undefined, 't1')).toBe('"t1"')
    expect(quoteCharOf('mysql')).toBe('`')
    expect(quoteCharOf(undefined)).toBe('"')
  })

  it('含空格/连字符/点号的合法目录名原样引用（不拆分）', () => {
    expect(quoteIdentifier('pg', 'my table')).toBe('"my table"')
    expect(quoteIdentifier('mysql', 'order-details')).toBe('`order-details`')
    expect(quoteIdentifier('sqlite', 'a.b')).toBe('"a.b"')
  })

  it('非本方言引号字符不是威胁：mysql 下的双引号 / pg 下的反引号放行', () => {
    expect(quoteIdentifier('mysql', 'say"hi')).toBe('`say"hi`')
    expect(quoteIdentifier('pg', 'say`hi`')).toBe('"say`hi`"')
  })

  it('危险标识符拒绝：空串', () => {
    expect(() => quoteIdentifier('pg', '')).toThrowError(/标识符不能为空/)
    expectBadRequest(() => quoteIdentifier('pg', ''))
  })

  it('危险标识符拒绝：包含本方言引号字符（防御性拒绝，不做转义）', () => {
    expect(() => quoteIdentifier('mysql', 'evil`tab')).toThrowError(/反引号/)
    expect(() => quoteIdentifier('pg', 'evil"tab')).toThrowError(/双引号/)
    expect(() => quoteIdentifier(undefined, 'evil"tab')).toThrowError(/双引号/)
  })

  it('危险标识符拒绝：控制字符（换行/制表/NUL）', () => {
    expect(() => quoteIdentifier('pg', 'a\nb')).toThrowError(/控制字符/)
    expect(() => quoteIdentifier('mysql', 'a\tb')).toThrowError(/控制字符/)
    expect(() => quoteIdentifier('sqlite', 'a\0b')).toThrowError(/控制字符/)
    expectBadRequest(() => quoteIdentifier('pg', 'a\nb'))
  })
})

describe('quoteTableRef（节点限定 id → 表引用）', () => {
  it('mysql 两段 id `schema.table`：逐段反引号', () => {
    expect(quoteTableRef('mysql', 'luoshu_test.t1')).toBe('`luoshu_test`.`t1`')
  })

  it('pg 三段 id `db.schema.table`：去首段库（PG 不能跨库引用），双引号两段', () => {
    expect(quoteTableRef('pg', 'mydb.public.t1')).toBe('"public"."t1"')
    // 两段防御路径：视作 schema.table
    expect(quoteTableRef('pg', 'public.t1')).toBe('"public"."t1"')
    expect(quoteTableRef(undefined, 'public.t1')).toBe('"public"."t1"')
  })

  it('mssql 三段 id / oracle-like 两段 id：逐段双引号', () => {
    expect(quoteTableRef('mssql', 'master.dbo.t1')).toBe('"master"."dbo"."t1"')
    expect(quoteTableRef('oracle-like', 'SYSDBA.T1')).toBe('"SYSDBA"."T1"')
  })

  it('sqlite 裸表名：整体单标识符引用（不按点拆段——文件库节点 id 即裸表名）', () => {
    expect(quoteTableRef('sqlite', 't1')).toBe('"t1"')
    expect(quoteTableRef('sqlite', 'weird.name')).toBe('"weird.name"')
  })

  it('危险限定名拒绝：空段（`a..b` / `.x` / `x.`）逐段校验兜住', () => {
    expect(() => quoteTableRef('mysql', 'a..b')).toThrowError(/标识符不能为空/)
    expectBadRequest(() => quoteTableRef('mysql', 'a..b'))
    expect(() => quoteTableRef('pg', '.t1')).toThrowError(/标识符不能为空/)
    expect(() => quoteTableRef('mssql', 'db.dbo.')).toThrowError(/标识符不能为空/)
  })

  it('段内含分号安全（引号内原样放行）；含换行（控制字符）拒绝', () => {
    expect(quoteTableRef('mysql', 'db.t1; DROP TABLE x')).toBe('`db`.`t1; DROP TABLE x`')
    expect(() => quoteTableRef('mysql', 'db.t\n1')).toThrowError(/控制字符/)
  })
})

describe('placeholderOf（位置参数占位符风格）', () => {
  it('pg 用 $n（1 起），其余方言（含缺省）一律 ?', () => {
    expect(placeholderOf('pg', 1)).toBe('$1')
    expect(placeholderOf('pg', 3)).toBe('$3')
    expect(placeholderOf('mysql', 1)).toBe('?')
    expect(placeholderOf('sqlite', 2)).toBe('?')
    expect(placeholderOf('mssql', 1)).toBe('?')
    expect(placeholderOf('oracle-like', 1)).toBe('?')
    expect(placeholderOf(undefined, 1)).toBe('?')
  })
})

describe('parseOrderBy（用户排序表达式解析）', () => {
  it('单列/多列、方向大小写、缺省 ASC', () => {
    expect(parseOrderBy('name')).toEqual([{ column: 'name', desc: false }])
    expect(parseOrderBy('name DESC')).toEqual([{ column: 'name', desc: true }])
    expect(parseOrderBy('a desc, b ASC, c')).toEqual([
      { column: 'a', desc: true },
      { column: 'b', desc: false },
      { column: 'c', desc: false }
    ])
  })

  it('空串/空段/空白列名丢弃', () => {
    expect(parseOrderBy('')).toEqual([])
    expect(parseOrderBy(' , a , ')).toEqual([{ column: 'a', desc: false }])
  })

  it('非法方向词按列名取 ASC；多余空白归一', () => {
    expect(parseOrderBy('  name   sideways ')).toEqual([{ column: 'name', desc: false }])
  })
})
