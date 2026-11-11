/** 服务端筛选 SQL 构造：把结构化 TableFilter 编译为参数化
 * WHERE，供各数据源插件的 nodeQuery 使用；主程序不拼方言 SQL。
 *
 * - 字段名经调用方提供的 quoteIdent 引用（各库引号规则归插件）；
 * - 值一律走占位符（placeholder 工厂：MySQL/SQLite/DM/MSSQL 用 '?'，PG/Kingbase 用 '$n'）；
 * - junction 按从左到右结合（与 UI 条件面板语义一致），每段加括号防 AND 优先级漂移；
 * - contains/startsWith/endsWith 走 LIKE，参数内转义 %/_/\\，并附 ESCAPE '\'；
 * caseInsensitiveLike=true 时两侧包 LOWER(...)（PG 等大小写敏感库）。
 */
import type { FilterCondition, FilterOperator, TableFilter } from './types.ts'

export interface FilterSqlOptions {
  /** 引号字符ident */
  quoteIdent: (name: string) => string
  /** 第 index 个值占位符（1 起；缺省恒 '?'） */
  placeholder?: (index: number) => string
  /** LIKE 两侧包 LOWER（PG/Kingbase 等大小写敏感库） */
  caseInsensitiveLike?: boolean
}

export interface FilterSql {
  /** where 字段 */
  where: string
  /** 参数 */
  params: unknown[]
}

const COMPARE_OP: Partial<Record<FilterOperator, string>> = {
  eq: '=',
  ne: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

/** 单条件 SQL 片段（返回 null = 条件非法/不参与） */
function conditionSql(
  cond: FilterCondition,
  opts: FilterSqlOptions,
  params: unknown[],
): string | null {
  if (typeof cond.field !== 'string' || cond.field.trim() === '') return null
  const col = opts.quoteIdent(cond.field)
  if (cond.operator === 'isNull') return `(${col} IS NULL)`
  if (cond.operator === 'notNull') return `(${col} IS NOT NULL)`
  const compare = COMPARE_OP[cond.operator]
  if (compare !== undefined) {
    const placeholder = (opts.placeholder ?? (() => '?'))(params.length + 1)
    params.push(cond.value)
    return `(${col} ${compare} ${placeholder})`
  }
  if (cond.operator === 'contains' || cond.operator === 'startsWith' || cond.operator === 'endsWith') {
    const raw = cond.value === null || cond.value === undefined ? '' : String(cond.value)
    const escaped = escapeLike(raw)
    const pattern = cond.operator === 'contains' ? `%${escaped}%` : cond.operator === 'startsWith' ? `${escaped}%` : `%${escaped}`
    const placeholder = (opts.placeholder ?? (() => '?'))(params.length + 1)
    const left = opts.caseInsensitiveLike === true ? `LOWER(${col})` : col
    const right = opts.caseInsensitiveLike === true ? `LOWER(${placeholder})` : placeholder
    params.push(pattern)
    return `(${left} LIKE ${right} ESCAPE '\\')`
  }
  return null
}

/** 过滤条件 → WHERE 片段（无条件/全非法回 undefined） */
export function buildFilterSql(filter: TableFilter | undefined, opts: FilterSqlOptions): FilterSql | undefined {
  const conditions = Array.isArray(filter?.conditions) ? filter.conditions : []
  const params: unknown[] = []
  const parts: string[] = []
  const junctions: Array<'AND' | 'OR'> = []
  for (const cond of conditions) {
    if (cond === null || typeof cond !== 'object') continue
    const sql = conditionSql(cond, opts, params)
    if (sql === null) continue
    parts.push(sql)
    junctions.push(cond.junction === 'OR' ? 'OR' : 'AND')
  }
  if (parts.length === 0) return undefined
  let where = parts[0]!
  for (let i = 1; i < parts.length; i += 1) {
    where = `(${where} ${junctions[i]} ${parts[i]})`
  }
  return { where, params }
}
