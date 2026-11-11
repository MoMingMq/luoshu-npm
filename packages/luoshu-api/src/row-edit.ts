// 行级批编辑契约（编辑出仓）：RowEdit/EditApplyEntry 类型、逐行参数化语句组装
// （方言=connect 自报 dialect，引用规则在 sql-quote）、共享执行器 applyRowEditsViaQuery
// ——插件 applyRowEdits 方法薄实现的标准内核（executor 注入各驱动执行行）。

import { createLuoshuError, isLuoshuError } from './errors.ts'
import type { LuoshuError } from './errors.ts'
import type { SqlDialect } from './types.ts'
import { placeholderOf, quoteIdentifier, quoteTableRef } from './sql-quote.ts'

/** 单行网格变更（渲染层编辑批的行形态；rowKey 为失败行回执对账键） */
export interface RowEdit {
  /** 行键名 */
  rowKey: string
  /** op 字段 */
  op: 'update' | 'insert' | 'delete'
  /** 主键列 → 值（update/delete 的 WHERE 等值条件；insert 为空对象） */
  pk: Record<string, unknown>
  /** 列 → 新值（update/insert 必带；delete 不带） */
  values?: Record<string, unknown>
}

/** 单行应用回执（顺序与入参一致；失败行保留 error 供批内重试） */
export interface EditApplyEntry {
  /** 行键名 */
  rowKey: string
  /** ok 字段 */
  ok: boolean
  /** 错误信息 */
  error?: LuoshuError
}

/** 批编辑选项：transactional=true 时整批原子提交 */
export interface ApplyRowEditsOptions {
  /**
   * 整批事务（缺省 false = 旧逐行语义）：插件在单事务内逐行执行，任一行失败
   * 立即回滚全部，回执全部 ok:false（首错行携带原始错误，其余行标
   * TX_ROLLED_BACK）。未实现 withTransaction 的插件应忽略本选项或显式拒绝。
   */
  transactional?: boolean
}

/** 事务回执：同批其他行因首错回滚而未提交 */
export const TX_ROLLED_BACK_CODE = 'LUOSHU.TX_ROLLED_BACK'

/** 单行变更组装产物（占位符与 parameters 一一对应） */
export interface EditStatementBuilt {
  /** SQL 语句 */
  sql: string
  /** parameters 字段 */
  parameters: unknown[]
}

/** 主键列 → WHERE 等值条件（AND 连接，逐列参数化） */
function whereOf(dialect: SqlDialect | undefined, pk: Record<string, unknown>, startOrdinal: number): {
  clause: string
  params: unknown[]
  ordinal: number
} {
  const cols = Object.keys(pk)
  if (cols.length === 0) {
    throw createLuoshuError('LUOSHU.BAD_REQUEST', '缺少主键条件：update/delete 必须携带主键列值（pk）', {
      hint: '无主键的表不支持网格编辑；请检查表结构或改在查询 Tab 手写 SQL'
    })
  }
  let ordinal = startOrdinal
  const parts: string[] = []
  const params: unknown[] = []
  for (const col of cols) {
    parts.push(`${quoteIdentifier(dialect, col)} = ${placeholderOf(dialect, ++ordinal)}`)
    params.push(pk[col])
  }
  return { clause: parts.join(' AND '), params, ordinal }
}

/**
 * 单行变更 → 参数化语句（导出供单测直接断言语句形态）。
 * 危险标识符（sql-quote 校验）与缺失键值在此抛 LUOSHU.BAD_REQUEST
 * applyRowEditsViaQuery 捕获后落为该行 error（不中断批次）。
 */
export function buildEditStatement(
  dialect: SqlDialect | undefined,
  nodeId: string,
  change: RowEdit
): EditStatementBuilt {
  const table = quoteTableRef(dialect, nodeId)
  if (change.op === 'delete') {
    const where = whereOf(dialect, change.pk, 0)
    return { sql: `DELETE FROM ${table} WHERE ${where.clause}`, parameters: where.params }
  }
  if (change.op === 'update' || change.op === 'insert') {
    const values = change.values
    if (values === undefined || typeof values !== 'object') {
      throw createLuoshuError('LUOSHU.BAD_REQUEST', `${change.op} 变更缺少列值（values）`, {
        hint: '空 values 的行不应进入应用批（渲染层已过滤）'
      })
    }
    const cols = Object.keys(values)
    if (cols.length === 0) {
      throw createLuoshuError('LUOSHU.BAD_REQUEST', `${change.op} 变更没有任何列值（values 为空对象）`, {
        hint: '空行编辑不产生语句；请检查渲染层批组装'
      })
    }
    let ordinal = 0
    const colSqls: string[] = []
    const params: unknown[] = []
    for (const col of cols) {
      if (change.op === 'update') {
        colSqls.push(`${quoteIdentifier(dialect, col)} = ${placeholderOf(dialect, ++ordinal)}`)
      } else {
        colSqls.push(quoteIdentifier(dialect, col))
      }
      params.push(values[col])
    }
    if (change.op === 'update') {
      const where = whereOf(dialect, change.pk, ordinal)
      return {
        sql: `UPDATE ${table} SET ${colSqls.join(', ')} WHERE ${where.clause}`,
        parameters: [...params, ...where.params]
      }
    }
    const placeholders = colSqls.map((_c, i) => placeholderOf(dialect, i + 1))
    return {
      sql: `INSERT INTO ${table} (${colSqls.join(', ')}) VALUES (${placeholders.join(', ')})`,
      parameters: params
    }
  }
  throw createLuoshuError('LUOSHU.BAD_REQUEST', `未知的编辑操作类型: ${String(change.op)}`, {
    hint: '合法取值：update | insert | delete'
  })
}

/** 行级错误归一：非 LuoshuError 的异常包成 INTERNAL（面板消息可见） */
function toRowError(e: unknown): LuoshuError {
  if (isLuoshuError(e)) return e
  return createLuoshuError('LUOSHU.INTERNAL', e instanceof Error ? e.message : String(e))
}

/** 语句执行器（插件侧注入——各驱动 query 执行行 + 错误映射） */
export type EditStatementExecutor = (sql: string, parameters: unknown[]) => Promise<void>

/**
 * 共享执行器：逐行组装 + 执行，收集每行结果（顺序与入参一致）；一行失败不中断
 * 批次（渲染层失败行标红保留批内可重试）；组装校验失败同样落为该行 error。
 */
export async function applyRowEditsViaQuery(
  exec: EditStatementExecutor,
  dialect: SqlDialect | undefined,
  nodeId: string,
  changes: RowEdit[]
): Promise<EditApplyEntry[]> {
  const results: EditApplyEntry[] = []
  for (const change of changes) {
    try {
      const statement = buildEditStatement(dialect, nodeId, change)
      await exec(statement.sql, statement.parameters)
      results.push({ rowKey: change.rowKey, ok: true })
    } catch (e) {
      results.push({ rowKey: change.rowKey, ok: false, error: toRowError(e) })
    }
  }
  return results
}

/**
 * 事务执行器（插件侧注入）：在单事务内运行 work；work 拿到逐行语句执行器
 * work 抛错即回滚。标准实现 =
 * withTransaction(helper => work((sql, params) => helper.exec(sql, params)))。
 */
export type EditTransactionRunner = (work: (exec: EditStatementExecutor) => Promise<void>) => Promise<void>

/**
 * 事务批编辑：整批原子——任一行组装/执行失败立即抛错触发回滚，回执全为
 * ok:false（首错行携带原始错误，其余行标 TX_ROLLED_BACK 供 UI 提示整批未写入）。
 * 事务通道自身异常（开启/提交失败）无从归因单行，全部行携带该异常。
 */
export async function applyRowEditsTransactional(
  run: EditTransactionRunner,
  dialect: SqlDialect | undefined,
  nodeId: string,
  changes: RowEdit[]
): Promise<EditApplyEntry[]> {
  const state: { index: number; error?: LuoshuError } = { index: -1 }
  try {
    await run(async (exec: EditStatementExecutor) => {
      for (let i = 0; i < changes.length; i += 1) {
        try {
          const statement = buildEditStatement(dialect, nodeId, changes[i]!)
          await exec(statement.sql, statement.parameters)
        } catch (e) {
          state.index = i
          state.error = toRowError(e)
          throw state.error
        }
      }
    })
    return changes.map((change) => ({ rowKey: change.rowKey, ok: true }))
  } catch (e) {
    if (state.index < 0) {
      const channelError = toRowError(e)
      return changes.map((change) => ({ rowKey: change.rowKey, ok: false, error: channelError }))
    }
    const firstError = state.error ?? toRowError(e)
    return changes.map((change, i) =>
      i === state.index
        ? { rowKey: change.rowKey, ok: false, error: firstError }
        : {
            rowKey: change.rowKey,
            ok: false,
            error: createLuoshuError(TX_ROLLED_BACK_CODE, '事务已回滚：本批其他行未提交', {
              hint: '修正标红行后重新应用；整批变更均未写入'
            })
          }
    )
  }
}
