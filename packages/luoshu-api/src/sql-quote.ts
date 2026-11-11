// SQL 文本组装的方言引用规则（sub-req-3 Task 5 建立，Task 11 起双消费方）：
// 主进程 edit-core（网格编辑参数化语句组装）与 renderer Query Builder SQL 生成器
// （views/query/builder/sql-generator.ts）共用的标识符引用 / 限定表名 / 占位符规则。
// Task 11 起从 main/utils 迁至 src/shared（进程共享纯函数区）：sql-generator 属
// renderer 模块，不得反向 import 主进程目录——两处 SQL 组装保持单一事实来源。
// 与各插件 nodeQuery 内部实现同构（mysql 反引号、其余双引号；pg `$n` 其余 `?`）
// 方言来源是插件 connect 自报的 ConnectionInfo.dialect——主程序零数据库特定判断。
//
// 危险标识符策略（防御性拒绝而非转义）：
// - 空标识符 / 限定名空段：直接拒绝（拼不出合法引用）；
// - 含本方言引号字符：拒绝（官方插件目录产出的未引号存储名不含引号
// 转义路径宁缺毋滥——第三方怪名宁可标红报错也不放行）；
// - 含控制字符（\x00-\x1F、\x7F）：拒绝（换行/制表/NUL 是注入与日志投毒的载体）。
// 其余字符（空格、分号、点号、非本方言引号）在引号内天然安全，原样放行。
//
// 纯函数模块（无 electron/Vue/DOM import），进 vitest 收集范围。
// 迁入契约包（编辑出仓）：方言引用/占位符是 R8 契约的配套纯函数
// 主程序与插件共用的唯一实现源（desktop shared 副本经 shim 过渡后删除）。

import { createLuoshuError } from './errors.ts'
import type { SqlDialect } from './types.ts'

/** 方言入参形态：ConnectionInfo.dialect 可缺省（未声明按 pg 风格，types.ts 契约） */
export type QuoteDialect = SqlDialect | undefined

/** 方言 → 标识符引号字符：mysql 反引号，其余（含缺省）双引号 */
export function quoteCharOf(dialect: QuoteDialect): '`' | '"' {
  return dialect === 'mysql' ? '`' : '"'
}

/** 控制字符（C0 + DEL）：出现在标识符中一律拒绝 */
// eslint-disable-next-line no-control-regex -- 刻意检测控制字符（拒绝路径，非输出路径）
const CONTROL_RE = /[\u0000-\u001f\u007f]/

/** 单标识符校验 + 引用；危险标识符抛 LUOSHU.BAD_REQUEST */
export function quoteIdentifier(dialect: QuoteDialect, name: string): string {
  const q = quoteCharOf(dialect)
  const qName = q === '`' ? '反引号' : '双引号'
  if (name.length === 0) {
    throw createLuoshuError('LUOSHU.BAD_REQUEST', `非法标识符：标识符不能为空（方言 ${dialect ?? 'pg(缺省)'}）`, {
      hint: '标识符来自插件目录或表结构，为空说明上游数据异常，请刷新对象树/结构视图后重试'
    })
  }
  if (CONTROL_RE.test(name)) {
    throw createLuoshuError('LUOSHU.BAD_REQUEST', `非法标识符：含控制字符（换行/制表/NUL 等）: ${JSON.stringify(name)}`, {
      hint: '控制字符不可能出现在合法的数据库存储名中，该请求已被拒绝'
    })
  }
  if (name.includes(q)) {
    throw createLuoshuError('LUOSHU.BAD_REQUEST', `非法标识符：含本方言引号字符（${qName}）: ${JSON.stringify(name)}`, {
      hint: '主程序组装编辑语句只放行不含引号字符的目录存储名；含特殊命名的表/列请在查询 Tab 手写 SQL'
    })
  }
  return q + name + q
}

/**
 * 节点限定 id → 方言表引用（逐段引用，段间 `.` 连接）：
 * - mysql：两段 `schema.table` → `s`.`t`（MySQL 的 schema 即库）
 * - mssql：三段 `database.schema.table` → 逐段双引号（T-SQL QUOTED_IDENTIFIER ON 合法）
 * - oracle-like（达梦）：两段 `owner.table` → 逐段双引号
 * - pg：三段 `db.schema.table` → **去首段库**（PG 不能跨库引用，插件侧靠
 * luoshu:db 前缀路由——主程序不感知该内部约定，引用落在连接库语境）；
 * 两段视作 schema.table（防御路径）
 * - sqlite：文件库节点 id 即**裸表名**，整体单标识符引用（不按点拆段）
 * - 缺省：pg 风格
 */
export function quoteTableRef(dialect: QuoteDialect, nodeId: string): string {
  if (dialect === 'sqlite') return quoteIdentifier(dialect, nodeId)
  let segments = nodeId.split('.')
  if (dialect === 'pg' && segments.length >= 3) segments = segments.slice(1)
  return segments.map((s) => quoteIdentifier(dialect, s)).join('.')
}

/**
 * 位置参数占位符风格（与各插件驱动绑定方式一致）：pg 系 `$1..$n`（1 起）
 * 其余方言（含缺省）一律 `?`。占位符永不拼值——值只经 QueryParams.parameters 绑定。
 */
export function placeholderOf(dialect: QuoteDialect, ordinal: number): string {
  return dialect === 'pg' ? `$${ordinal}` : '?'
}
