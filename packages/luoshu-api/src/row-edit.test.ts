// 行编辑组装与共享执行器测试（编辑出仓迁入）：语句形态逐方言断言 + 逐行成败
// 收集（单行失败不中断批）。

import { describe, expect, it } from 'vitest'
import type { LuoshuError, TreeNodeRef } from './row-edit.ts'
import { createLuoshuError } from './errors.ts'
import {
  applyRowEditsViaQuery,
  applyRowEditsTransactional,
  buildEditStatement,
  TX_ROLLED_BACK_CODE
} from './row-edit'
import type { EditStatementExecutor, EditTransactionRunner, RowEdit } from './row-edit'

const node: TreeNodeRef = { typeId: 'table', id: 'luoshu_test.t1' }

interface ExecCall {
  sql: string
  parameters: unknown[]
}

function makeExec(): EditStatementExecutor & { queries: ExecCall[] } {
  const queries: ExecCall[] = []
  const exec: EditStatementExecutor = async (sql, parameters) => {
    queries.push({ sql, parameters })
    // 行级失败注入：参数值含哨兵 'FAIL'（模拟该行语句执行失败）
    if (parameters.includes('FAIL')) {
      throw createLuoshuError('test.rowFail', '行执行失败演示')
    }
    if (sql.includes('FAIL:raw')) throw new Error('裸驱动异常演示')
  }
  return Object.assign(exec, { queries })
}

describe('buildEditStatement（语句组装形态）', () => {
  it('update：SET 与 WHERE 逐列参数化，值序 = SET 值后接主键值', () => {
    const s = buildEditStatement('mysql', node.id, {
      rowKey: 'k1',
      op: 'update',
      pk: { id: 7 },
      values: { name: '新名', cnt: 3 }
    })
    expect(s.sql).toBe('UPDATE `luoshu_test`.`t1` SET `name` = ?, `cnt` = ? WHERE `id` = ?')
    expect(s.parameters).toEqual(['新名', 3, 7])
  })

  it('pg：占位符 $n 且表引用去首段库（三段 id）', () => {
    const s = buildEditStatement('pg', 'mydb.public.t1', {
      rowKey: 'k1',
      op: 'update',
      pk: { id: 7 },
      values: { name: 'x' }
    })
    expect(s.sql).toBe('UPDATE "public"."t1" SET "name" = $1 WHERE "id" = $2')
    expect(s.parameters).toEqual(['x', 7])
  })

  it('insert：列清单 + VALUES 占位符；未提及列不进语句（走库端默认）', () => {
    const s = buildEditStatement('sqlite', 't1', {
      rowKey: 'new-1',
      op: 'insert',
      pk: {},
      values: { id: 99, name: 'n', flag: true }
    })
    expect(s.sql).toBe('INSERT INTO "t1" ("id", "name", "flag") VALUES (?, ?, ?)')
    expect(s.parameters).toEqual([99, 'n', true])
  })

  it('delete：仅 WHERE 主键条件（多列主键 AND 连接）', () => {
    const s = buildEditStatement('mysql', node.id, {
      rowKey: 'k2',
      op: 'delete',
      pk: { a: 1, b: 'x' }
    })
    expect(s.sql).toBe('DELETE FROM `luoshu_test`.`t1` WHERE `a` = ? AND `b` = ?')
    expect(s.parameters).toEqual([1, 'x'])
  })

  it('危险列名（含反引号）在组装期即抛 LUOSHU.BAD_REQUEST', () => {
    expect(() =>
      buildEditStatement('mysql', node.id, { rowKey: 'k', op: 'update', pk: { id: 1 }, values: { 'ev`il': 1 } })
    ).toThrowError(/反引号/)
  })

  it('update 缺 pk / 缺 values / 未知 op：组装期拒绝', () => {
    expect(() =>
      buildEditStatement('pg', 'public.t1', { rowKey: 'k', op: 'update', pk: {}, values: { a: 1 } })
    ).toThrowError(/缺少主键条件/)
    expect(() =>
      buildEditStatement('pg', 'public.t1', { rowKey: 'k', op: 'update', pk: { id: 1 }, values: {} })
    ).toThrowError(/没有任何列值/)
    expect(() =>
      buildEditStatement('pg', 'public.t1', { rowKey: 'k', op: 'upsert' as RowEdit['op'], pk: { id: 1 } })
    ).toThrowError(/未知的编辑操作类型/)
  })
})

describe('applyRowEditsViaQuery（批执行与结果收集）', () => {
  const changes: RowEdit[] = [
    { rowKey: 'k1', op: 'update', pk: { id: 1 }, values: { name: 'a' } },
    { rowKey: 'k2', op: 'delete', pk: { id: 2 } },
    { rowKey: 'k3', op: 'insert', pk: {}, values: { id: 3 } }
  ]

  it('逐行执行，行结果顺序与入参一致，参数数组经 executor 入参透传', async () => {
    const exec = makeExec()
    const results = await applyRowEditsViaQuery(exec, 'mysql', node.id, changes)
    expect(results.map((r) => [r.rowKey, r.ok])).toEqual([['k1', true], ['k2', true], ['k3', true]])
    expect(exec.queries).toHaveLength(3)
    expect(exec.queries[0]).toMatchObject({
      sql: 'UPDATE `luoshu_test`.`t1` SET `name` = ? WHERE `id` = ?',
      parameters: ['a', 1]
    })
    expect(exec.queries[1]).toMatchObject({ sql: 'DELETE FROM `luoshu_test`.`t1` WHERE `id` = ?', parameters: [2] })
    expect(exec.queries[2]).toMatchObject({ sql: 'INSERT INTO `luoshu_test`.`t1` (`id`) VALUES (?)', parameters: [3] })
  })

  it('一行失败不中断批次：该行 error 透传 LuoshuError，其余行照常执行', async () => {
    const exec = makeExec()
    // 行级失败注入：值含哨兵 'FAIL' 的行失败，另一行照常（makeExec 按参数命中）
    const results = await applyRowEditsViaQuery(exec, 'pg', node.id, [
      { rowKey: 'ok-row', op: 'update', pk: { id: 1 }, values: { name: '正常' } },
      { rowKey: 'fail-row', op: 'update', pk: { id: 2 }, values: { name: 'FAIL' } }
    ])
    expect(results.map((r) => r.ok)).toEqual([true, false])
    expect((results[1]!.error as LuoshuError).code).toBe('test.rowFail')
    expect(exec.queries).toHaveLength(2)
  })

  it('非 LuoshuError 驱动异常包为 LUOSHU.INTERNAL；组装校验失败落行级 BAD_REQUEST', async () => {
    const exec = makeExec()
    const results = await applyRowEditsViaQuery(exec, 'pg', 'db.FAIL:raw', [
      { rowKey: 'raw', op: 'delete', pk: { id: 1 } },
      { rowKey: 'no-pk', op: 'delete', pk: {} }
    ])
    expect(results[0]!.ok).toBe(false)
    expect((results[0]!.error as LuoshuError).code).toBe('LUOSHU.INTERNAL')
    expect((results[1]!.error as LuoshuError).code).toBe('LUOSHU.BAD_REQUEST')
    // 组装失败的行不产生执行调用
    expect(exec.queries).toHaveLength(1)
  })

  it('成败三态批：全成 / 部分 / 全败（面板消息分级的推导数据，分级本身留在 edit:apply 壳）', async () => {
    const exec1 = makeExec()
    const r1 = await applyRowEditsViaQuery(exec1, 'pg', node.id, [changes[0]!])
    expect(r1.map((r) => r.ok)).toEqual([true])

    const exec2 = makeExec()
    const r2 = await applyRowEditsViaQuery(exec2, 'pg', node.id, [
      changes[0]!,
      { rowKey: 'k9', op: 'update', pk: { id: 9 }, values: { name: 'FAIL' } }
    ])
    expect(r2.map((r) => r.ok)).toEqual([true, false])

    const exec3 = makeExec()
    const r3 = await applyRowEditsViaQuery(exec3, 'pg', node.id, [
      { rowKey: 'k9', op: 'update', pk: { id: 9 }, values: { name: 'FAIL' } }
    ])
    expect(r3.map((r) => r.ok)).toEqual([false])
  })
})

describe('applyRowEditsTransactional', () => {
  const changes: RowEdit[] = [
    { rowKey: 'k1', op: 'update', pk: { id: 1 }, values: { name: 'a' } },
    { rowKey: 'k2', op: 'update', pk: { id: 2 }, values: { name: 'b' } }
  ]

  interface RunnerHarness {
    run: EditTransactionRunner
    calls: ExecCall[]
    committed: boolean
    rolledBack: boolean
  }

  /** 事务模拟器：fn 成功置 committed，抛错置 rolledBack 并原样传播（契约同 withTransaction） */
  function makeRunner(opts?: { channelFail?: boolean }): RunnerHarness {
    const h: RunnerHarness = {
      calls: [],
      committed: false,
      rolledBack: false,
      run: async (fn) => {
        if (opts?.channelFail === true) throw createLuoshuError('test.channel', '事务开启失败')
        try {
          await fn(async (sql, parameters) => {
            h.calls.push({ sql, parameters })
            if (parameters.includes('FAIL')) throw createLuoshuError('test.rowFail', '行执行失败演示')
          })
          h.committed = true
        } catch (e) {
          h.rolledBack = true
          throw e
        }
      }
    }
    return h
  }

  it('全部成功：逐行执行后提交，回执全 ok', async () => {
    const h = makeRunner()
    const entries = await applyRowEditsTransactional(h.run, 'mysql', node.id, changes)
    expect(entries.map((e) => [e.rowKey, e.ok])).toEqual([['k1', true], ['k2', true]])
    expect(h.committed).toBe(true)
    expect(h.rolledBack).toBe(false)
    expect(h.calls).toHaveLength(2)
  })

  it('中途失败：回滚，首错行带原始错误，其余行标 TX_ROLLED_BACK', async () => {
    const h = makeRunner()
    const entries = await applyRowEditsTransactional(h.run, 'pg', node.id, [
      changes[0]!,
      { rowKey: 'k9', op: 'update', pk: { id: 9 }, values: { name: 'FAIL' } }
    ])
    expect(h.committed).toBe(false)
    expect(h.rolledBack).toBe(true)
    expect(entries.map((e) => e.ok)).toEqual([false, false])
    expect(entries[0]!.error?.code).toBe(TX_ROLLED_BACK_CODE)
    expect(entries[1]!.error?.code).toBe('test.rowFail')
    // 首错即停：成功行已执行 1 次 + 失败行尝试 1 次
    expect(h.calls).toHaveLength(2)
  })

  it('组装期校验失败同样触发回滚（首行缺主键时不执行任何语句）', async () => {
    const h = makeRunner()
    const entries = await applyRowEditsTransactional(h.run, 'pg', 'public.t1', [
      { rowKey: 'bad', op: 'delete', pk: {} },
      { rowKey: 'k2', op: 'delete', pk: { id: 2 } }
    ])
    expect(h.rolledBack).toBe(true)
    expect(h.calls).toHaveLength(0)
    expect(entries[0]!.error?.code).toBe('LUOSHU.BAD_REQUEST')
    expect(entries[1]!.error?.code).toBe(TX_ROLLED_BACK_CODE)
  })

  it('事务通道异常（开启失败）：全部行携带该异常（无从归因单行）', async () => {
    const h = makeRunner({ channelFail: true })
    const entries = await applyRowEditsTransactional(h.run, 'pg', node.id, changes)
    expect(entries.map((e) => e.ok)).toEqual([false, false])
    expect(entries.map((e) => e.error?.code)).toEqual(['test.channel', 'test.channel'])
  })
})
