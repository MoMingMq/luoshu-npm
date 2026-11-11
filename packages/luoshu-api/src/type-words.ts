// 原生类型词 → 标准类型（十值）词表：进程共享单一事实源（sub-req-4 Task 11 合并）。
//
// 历史与口径：docs/type-mapping.md §3 主表是规则唯一事实来源。此前主进程
// （main/tools/transfer-core.ts 按 dialect 选列）与渲染层（renderer/utils/
// type-badge.ts 按 pluginId 选列）各持一份同表异构副本——双份词表漂移风险
// 合并至此（沿 sql-quote.ts 先例：src/shared/ 主进程与渲染层双消费）。
// 两端薄层仅保留各自的键映射：渲染侧 pluginId → family（type-badge.ts）、
// 主进程 dialect → family（transfer-core.ts；'oracle-like' → 'dm' 列）。
//
// 匹配语义（合并前两端一致，行为零变化）：全词大小写不敏感精确匹配；SQLite 走
// §3.1 关键词包含匹配（13 级优先短路）；未命中一律 unknown 不报错（文档约定 ②：
// 映射函数零异常，表外新词永不崩 UI）。纯函数模块（无 Vue/Electron import）
// 进 vitest 收集范围（src/shared/**）。
// 迁入契约包（编辑出仓）：类型词表是 R16 标准类型层的配套数据
// 主程序与插件共用的唯一实现源（零依赖纯词表）。

/** 内部标准类型集（docs/type-mapping.md §2，10 个） */
export type StandardType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'datetime'
  | 'date'
  | 'time'
  | 'json'
  | 'binary'
  | 'uuid'
  | 'unknown'

/**
 * 词表族键（文档 §3 的列维度；与 SqlDialect 的差异：'oracle-like'（达梦）在此
 * 记 'dm'，sqlite 无全词表——关键词包含匹配专路）。mariadb 与 mysql 共列、
 * kingbase 与 pg 共列（文档 §1 透传清单）。
 */
export type TypeFamily = 'mysql' | 'pg' | 'mssql' | 'dm'

/** 全词精确匹配列（键为小写词；词表逐词出自 docs/type-mapping.md §3 主表） */
export const TYPE_WORDS_BY_FAMILY: Readonly<Record<TypeFamily, Readonly<Record<string, StandardType>>>> = {
  mysql: {
    char: 'string', varchar: 'string', tinytext: 'string', text: 'string',
    mediumtext: 'string', longtext: 'string', enum: 'string', set: 'string',
    tinyint: 'number', smallint: 'number', mediumint: 'number', int: 'number',
    integer: 'number', bigint: 'number', decimal: 'number', numeric: 'number',
    float: 'number', double: 'number', real: 'number', bit: 'number', year: 'number',
    datetime: 'datetime', timestamp: 'datetime',
    date: 'date',
    time: 'time',
    json: 'json',
    binary: 'binary', varbinary: 'binary', tinyblob: 'binary', blob: 'binary',
    mediumblob: 'binary', longblob: 'binary'
  },
  pg: {
    text: 'string', 'character varying': 'string', character: 'string',
    smallint: 'number', integer: 'number', bigint: 'number', numeric: 'number',
    real: 'number', 'double precision': 'number', money: 'number',
    boolean: 'boolean',
    'timestamp without time zone': 'datetime', 'timestamp with time zone': 'datetime',
    date: 'date',
    'time without time zone': 'time', 'time with time zone': 'time',
    json: 'json', jsonb: 'json',
    bytea: 'binary',
    uuid: 'uuid'
  },
  mssql: {
    char: 'string', varchar: 'string', text: 'string', nchar: 'string',
    nvarchar: 'string', ntext: 'string',
    tinyint: 'number', smallint: 'number', int: 'number', bigint: 'number',
    decimal: 'number', numeric: 'number', money: 'number', smallmoney: 'number',
    float: 'number', real: 'number',
    bit: 'boolean',
    datetime: 'datetime', datetime2: 'datetime', smalldatetime: 'datetime',
    datetimeoffset: 'datetime',
    date: 'date',
    time: 'time',
    binary: 'binary', varbinary: 'binary', image: 'binary',
    uniqueidentifier: 'uuid'
    // timestamp（rowversion 行版本戳）不收录 → unknown（文档约定 ③）
  },
  dm: {
    char: 'string', varchar: 'string', varchar2: 'string', text: 'string',
    long: 'string', clob: 'string',
    tinyint: 'number', smallint: 'number', int: 'number', integer: 'number',
    bigint: 'number', dec: 'number', decimal: 'number', number: 'number',
    numeric: 'number', float: 'number', double: 'number', real: 'number',
    bit: 'boolean',
    timestamp: 'datetime', datetime: 'datetime',
    date: 'date',
    time: 'time',
    binary: 'binary', varbinary: 'binary', blob: 'binary', image: 'binary', raw: 'binary'
    // BFILE/ROWID/INTERVAL 等未收录词 → unknown（文档 §3 达梦列）
  }
}

/** SQLite 声明关键词包含匹配（§3.1 十三级优先短路；声明原文任意大小写、可为空串） */
export function mapSqliteKeyword(decl: string): StandardType {
  const d = decl.toUpperCase()
  if (d === '') return 'unknown'
  if (d.includes('BOOL')) return 'boolean'
  if (d.includes('DATETIME') || d.includes('TIMESTAMP')) return 'datetime'
  if (d.includes('DATE')) return 'date'
  if (d.includes('TIME')) return 'time'
  if (d.includes('JSON')) return 'json'
  if (d.includes('UUID')) return 'uuid'
  if (d.includes('BLOB')) return 'binary'
  if (d.includes('TEXT') || d.includes('CHAR') || d.includes('CLOB')) return 'string'
  if (d.includes('INT')) return 'number'
  if (d.includes('REAL') || d.includes('FLOA') || d.includes('DOUB')) return 'number'
  if (d.includes('NUMERIC') || d.includes('DEC')) return 'number'
  return 'unknown'
}

/**
 * 原生类型名 → 标准类型：族内全词大小写不敏感精确匹配；'sqlite' 走关键词包含；
 * 未命中 unknown 零异常（文档 §5 建议形态）。
 */
export function mapNativeToStandard(family: TypeFamily | 'sqlite', dataType: string): StandardType {
  const word = dataType.trim()
  if (family === 'sqlite') return mapSqliteKeyword(word)
  return TYPE_WORDS_BY_FAMILY[family][word.toLowerCase()] ?? 'unknown'
}

// ===== 标准类型 → 方言原生词反查=====
//
// 修订记录：表设计器类型下拉的原生词来源（v1 为 manifest typeVocabulary 透传；
// v2 渲染件无 manifest 清单面——缺口清零战役 定形为 **本包派生**（L1 免新增
// 面）：按 family 全词表反推，与 mapNativeToStandard 共用同一事实源，词表增删自动
// 同步）。词面与 docs/type-mapping.md §3 主表逐词一致——消费方（luoshu-designer）
// 以 pluginId → family（type-badge FAMILY_BY_PLUGIN）取词表填充下拉，选词原样存
// stdType（透传语义：DDL 原样输出），插件 generateDdl 反向解析不变。

/** 各族的原生词反查缓存（模块级单次构建——纯数据派生，构建后只读） */
const nativeVocabCache = new Map<TypeFamily, Partial<Record<StandardType, readonly string[]>>>()

/** §3 主表 → 标准值槽位反查（词序 = 主表声明序——下拉展示序稳定可预期） */
function invertFamilyWords(family: TypeFamily): Partial<Record<StandardType, readonly string[]>> {
  const cached = nativeVocabCache.get(family)
  if (cached) return cached
  const out: Partial<Record<StandardType, string[]>> = {}
  for (const [word, std] of Object.entries(TYPE_WORDS_BY_FAMILY[family])) {
    if (std === 'unknown') continue // unknown 非设计目标类型——不进词表
    ;(out[std] ??= []).push(word)
  }
  const frozen = Object.freeze(
    Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Object.freeze(v)]))
  ) as Partial<Record<StandardType, readonly string[]>>
  nativeVocabCache.set(family, frozen)
  return frozen
}

/**
 * SQLite 关键词词表（§3.1 包含匹配族的代表词——各词经 mapSqliteKeyword 断言落位
 * 见 type-words.test.ts；sqlite 无全词精确匹配表，词面为本包自持的建表可用关键词）。
 * 词序 = 标准槽位序（string→number→…），同槽多词按常用度排布。
 */
const SQLITE_KEYWORD_VOCABULARY: Readonly<Partial<Record<StandardType, readonly string[]>>> = Object.freeze({
  string: Object.freeze(['TEXT']),
  number: Object.freeze(['INTEGER', 'REAL', 'NUMERIC']),
  boolean: Object.freeze(['BOOLEAN']),
  datetime: Object.freeze(['DATETIME']),
  date: Object.freeze(['DATE']),
  time: Object.freeze(['TIME']),
  json: Object.freeze(['JSON']),
  binary: Object.freeze(['BLOB']),
  uuid: Object.freeze(['UUID']),
})

/**
 * 标准类型 → 方言原生代表词清单（族内反查，只读）。
 *
 * - 四个全词族（mysql/pg/mssql/dm）：词面 = TYPE_WORDS_BY_FAMILY[family] 反推
 * 词序随 §3 主表声明序；
 * - sqlite：§3.1 关键词族代表词（SQLITE_KEYWORD_VOCABULARY——词面与
 * mapSqliteKeyword 的短路序语义一致）；
 * - **unknown 槽位恒缺省**（unknown 非设计目标类型）；族内无原生词的标准槽位同样
 * 缺省（如 mysql/boolean——MySQL 无原生 BOOLEAN 词面，主表未收录即不虚构）
 * 消费方对缺省槽位以标准词本身补位（插件 generateDdl 对标准词本就有解析路径
 * 透传语义不变）——「每标准值至少一词」的完整性口径见 type-words.test.ts：
 * 断言的是**族可表达的槽位全覆盖**，非全族九槽齐备。
 */
export function nativeVocabularyOf(
  family: TypeFamily | 'sqlite'
): Readonly<Partial<Record<StandardType, readonly string[]>>> {
  if (family === 'sqlite') return SQLITE_KEYWORD_VOCABULARY
  return invertFamilyWords(family)
}
