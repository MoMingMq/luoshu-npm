import type { LuoshuError } from './errors.ts'

export interface ConnectionOptions { [key: string]: unknown }

/**
 * 终端会话选项：自由 KV——各 kind 插件
 * 自定义连接后的终端参数（ssh 的 env/shell 选型、docker 的 exec 用户/工作
 * 目录等），主程序不解释、不拼装；无参数场景传空对象。
 */
export interface TerminalSessionOptions { [key: string]: unknown }

/**
 * SQL 方言标识：插件 connect 时自报
 * 主程序内 SQL 生成器（Query Builder / 网格编辑语句组装等）的标识符引号与
 * 分页语法依据。方言永远只存在于插件侧；本枚举仅供主程序消费方判断呈现形态。
 */
export type SqlDialect = 'mysql' | 'pg' | 'oracle-like' | 'sqlite' | 'mssql'

export interface ConnectionInfo {
  /** 服务端版本标识 */
  serverVersion: string
  /**
   * 方言声明：mysql → 反引号 + LIMIT；pg/sqlite → 双引号 + LIMIT；
   * mssql → 方括号 + TOP；oracle-like（达梦等）→ 双引号 + ROWNUM。
   * 未声明时消费方按 pg 风格处理（双引号 + LIMIT，跨方言通用性最好）。
   */
  dialect?: SqlDialect
  /**
   * 拨号逐跳耗时遥测：连接链类插件
   * （跳板/代理）connect 时按拨号序返回 {host, port, ms}（含目标——尾项为
   * 目标认证耗时；首项含代理握手的出网开销）；测试连接 UI 的逐跳耗时展示
   * 数据源。单直连插件缺省不带（无链路语义，主程序零类别假设）。
   */
  hops?: Array<{ host: string; port: number; ms: number }>
}
/**
 * DatabaseRef（listDatabases 返回单元）。meta 为附加字段位（ 转正：
 * mysql/pg/sqlserver/dm 插件既已携带 system/current 标记，删除入口的库级风险
 * 文案 meta.riskWarning 同走此通道——root-wrap 包装为树节点时原样透传）。
 */
export interface DatabaseRef {
  /** 唯一标识 */
  id: string
  /** 显示名 */
  label: string
  /** 库节点在 provider 树中的类型（缺省 database；达梦「库即 schema」声明 schema
   * 库层删除/取数的节点 typeId 依据） */
  typeId?: string
  /** 代码元数据 */
  meta?: Record<string, unknown>
}
export interface TreeNodeRef { databaseId?: string; typeId: string; id: string }
export interface TreeNode {
  /** 类型标识 */
  typeId: string
  /** 唯一标识 */
  id: string
  /** 显示名 */
  label: string
  /** 代码元数据 */
  meta?: Record<string, unknown>
  /**
   * 分页游标：大子集分页时，插件在被截断段的
   * 末节点携带本字段；UI 将其原样回传 listChildren 的 page.cursor 取下一段。
   */
  cursor?: string
}
/**
 * listChildren 的可选分页参数。
 * 契约下界：不支持分页的插件可忽略本参数（调用必须仍成功，返回全量）；
 * 支持分页的插件按 limit 截断子集，并在截断段末节点的 TreeNode.cursor
 * 返回下一页游标（未截断则不带）。
 */
export interface ListPage {
  /** 上一段末节点返回的游标（TreeNode.cursor），缺省从段首开始。 */
  cursor?: string
  /** 请求的段大小（节点数）。 */
  limit?: number
}
export interface IndexInfo {
  /** 名称 */
  name: string
  /**
   * 索引列名清单（按索引内列序）。实现者契约：普通索引应给出真实列名
   * PG 族 indexdef 拆解补齐列入插件任务（sub-req-4）；表达式索引等无法给出
   * 简单列名的场景由插件自决（空串/描述文本），消费方不得假定非空可用。
   */
  columns: string[]
  /** unique 字段 */
  unique: boolean
  /**
   * 索引结构类型：
   * 目录未区分结构或非标准结构（表达式/部分索引等）时省略或返回 'OTHER'。
   */
  type?: 'BTREE' | 'HASH' | 'OTHER'
}
export interface ColumnInfo {
  /** 名称 */
  name: string
  /** 数据载荷类型 */
  dataType: string
  /** 是否可空 */
  nullable: boolean
  /** 默认值值 */
  defaultValue?: string
  /** 注释 */
  comment?: string
  /**
   * 列长度：字符类类型的最大长度
   * （varchar(50) → 50）。目录取数（information_schema 系 CHARACTER_MAXIMUM_LENGTH
   * 等，逐库列名由插件 fixture 验证）；sqlite 无目录长度概念，插件从声明原文解析。
   */
  length?: number
  /**
   * 精度：数值类类型的总有效位（numeric(10,2) → 10）。
   * 目录取数（NUMERIC_PRECISION 等）；sqlite 从声明原文解析。
   */
  precision?: number
  /**
   * 标度：小数位数（numeric(10,2) → 2）。
   * 目录取数（NUMERIC_SCALE 等）；sqlite 从声明原文解析。
   */
  scale?: number
  /**
   * 自增标志：各库目录判定词的归一结果——MySQL EXTRA 含
   * auto_increment、PG column_default 序列表达式 / attidentity、mssql is_identity、
   * sqlite 建表原文 AUTOINCREMENT、dm IDENTITY（判定词逐库由插件 fixture 验证）。
   */
  autoIncrement?: boolean
}
/**
 * 外键参照动作：SQL 标准四值。各库支持面不同，插件按本库目录实际返回；
 * 目录未上报或方言无对应概念时省略对应字段。
 */
export type ForeignKeyAction = 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'RESTRICT'
/**
 * 外键元数据：ER 图连线、设计器外键页签、
 * 传输依赖分析的数据源。取数路径逐库由插件实现（MySQL KEY_COLUMN_USAGE /
 * pg_constraint / mssql sys.foreign_keys / sqlite pragma_foreign_key_list /
 * dm ALL_CONSTRAINTS type='R'——字段名均由插件 fixture 真库验证）。
 */
export interface ForeignKeyInfo {
  /** 约束名（部分库目录约束名可为空串——插件按本库目录实际返回） */
  name: string
  /** 本表列名（多列外键按目录 ordinal 顺序） */
  columns: string[]
  /** 引用端模式/架构（可选：单层命名空间库如 MySQL/sqlite 省略） */
  refSchema?: string
  /** 引用表名 */
  refTable: string
  /** 引用端列名（与 columns 一一对应、同长度） */
  refColumns: string[]
  /** 删除时参照动作（可选：目录未上报则省略） */
  onDelete?: ForeignKeyAction
  /** 更新时参照动作（可选：目录未上报则省略） */
  onUpdate?: ForeignKeyAction
}
export interface SchemaInfo {
  /** 列定义集 */
  columns: ColumnInfo[]
  /** indexes 字段 */
  indexes?: IndexInfo[]
  /** 是否主键 */
  primaryKey?: string[]
  /** 外键清单：无外键时省略或空数组；插件未查询时省略。 */
  foreignKeys?: ForeignKeyInfo[]
  /** 表注释（可选；方言不支持或插件未查询时省略——设计器回填与 DDL 比对消费） */
  comment?: string
}
/**
 * 查询参数（可选面）。修订记录：
 * 增 `connId` 可选连接上下文——多连接插件（同一插件服务面承载多条连接，如 SSH
 * 连接池）据此把 query/streamQuery 路由到指定连接；缺省时插件按自身语义自决
 * （最近连接兜底/报错）。连接 id 语义 = 插件 connect(connId) 收到的同一标识。
 */
export interface QueryParams {
  /** parameters 字段 */
  parameters?: unknown[]
  /** 超时（毫秒） */
  timeoutMs?: number
  /** 连接上下文（可选）：多连接插件按此路由执行连接；缺省由插件自决兜底 */
  connId?: string
}
export interface QueryResult { columns: string[]; rows: unknown[][]; rowCount: number; elapsedMs: number }
export interface ResultChunk {
  /** 查询唯一标识 */
  queryId: string
  /** 列定义集 */
  columns?: string[]
  /** 行集 */
  rows: unknown[][]
  /**
   * 文档型数据通道：与 rows 互斥，二选一必填
   * 文档库（如 MongoDB）返回树形文档数组时使用本字段，此时 columns/rows 不填；
   * 内置 document 视图消费该通道。
   */
  documents?: unknown[]
  /** done 字段 */
  done: boolean
}
/**
 * 内置 grid 视图打开节点时的查询描述。
 * 查询文本由插件按自身方言生成（标识符引用/限定名/跨库路由规则插件自决）
 * 主程序不拼装任何方言 SQL——sql 喂给 streamQuery 取流，countSql（可选）经
 * query 执行、取首行首列为总行数（进度显示的分母；未提供则只显示已加载行数）。
 */
export interface NodeQuery {
  /** 数据查询文本（插件方言；语义同 streamQuery 的 sql 参数） */
  sql: string
  /** 总行数查询文本（可选；返回单行单列数值） */
  countSql?: string
  /**
   * sql 的位置参数：与 sql 中占位符（`?` / `$n` / `@pN`）按出现
   * 顺序一一对应，交由 query/streamQuery 的 params.parameters 执行。分页游标值
   * （TablePage.cursor）经此通道参数化传递——游标永不拼进 SQL 文本，杜绝注入。
   * countSql 若含筛选占位符，参数经 countParams 传递。
   */
  params?: unknown[]
  /** countSql 的位置参数 */
  countParams?: unknown[]
}

/** 服务端筛选运算符：等值/比较/包含/空值；值一律经参数化通道传递 */
export type FilterOperator =
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'startsWith' | 'endsWith'
  | 'isNull' | 'notNull'

/** 单条筛选条件：junction 连接前一条（首条忽略）；field=数据库列名 */
export interface FilterCondition {
  /** field 字段 */
  field: string
  /** operator 字段 */
  operator: FilterOperator
  /** 值 */
  value?: unknown
  /** junction 字段 */
  junction?: 'AND' | 'OR'
}

/** 服务端筛选：平铺条件按 junction 从左到右结合 */
export interface TableFilter {
  /** conditions 字段 */
  conditions: FilterCondition[]
}

/**
 * nodeQuery 的可选分页参数。
 * 传入时插件按自身方言生成键集分页 SQL（`WHERE 排序键 > 游标 ORDER BY 排序键
 * LIMIT n`；mssql 用 TOP、oracle-like 用 ROWNUM 包装子查询、无主键表走 OFFSET
 * 回退），主程序只传排序键/游标值/每页行数，零方言拼装。
 * R58增 filter：插件按本方言把结构化条件编译为参数化 WHERE
 * 同时作用于数据 SQL 与 countSql；主程序不拼方言 SQL。
 * 契约下界：不支持分页的插件可忽略本参数（调用必须仍成功，返回不分页 SQL）。
 */
export interface TablePage {
  /** 排序键列名（缺省 = 插件自选：主键优先，无主键取首列；经方言引号引用） */
  orderBy?: string
  /**
   * 游标值（上一页末行该排序键列的**原值**，保留驱动原生类型——数字主键传数字、
   * 字符串传字符串，不要字符串化；首页不传）。
   */
  cursor?: unknown
  /** 每页行数（正整数） */
  limit: number
  /** true = 无键集条件时用 OFFSET 回退（无主键表深翻页；offset 缺省按 0） */
  offsetFallback?: boolean
  /** OFFSET 起始行号（0 起；首页大跳/用户输入页码直达场景；cursor 存在时键集优先，忽略 offset） */
  offset?: number
  /** 服务端筛选 */
  filter?: TableFilter
}

/**
 * 批量写选项。
 * onConflict 是导入向导「导入模式⑦」的契约载体，语义随方言由插件实现：
 * - 'error'（缺省）= 追加 INSERT，遇冲突键整批失败（LuoshuError）；
 * - 'skip' = 跳过冲突行（计入 skipped）；
 * - 'replace' = 冲突行整行覆盖——MySQL 族 REPLACE、PG 族 ON CONFLICT（各库落法
 * 差异待插件实现，mssql/dm 等无原生词的库由插件以等效语句或错误降级）；
 * - 'update' = 冲突行按非键列更新——MySQL 族 ON DUPLICATE KEY UPDATE、PG 族
 * ON CONFLICT DO UPDATE（落法差异同上，待插件实现）。
 * 「冲突键」由插件按目标表实际约束（主键/唯一索引）判定；无冲突键的表上
 * skip/replace/update 与追加等价。
 */
export interface InsertBatchOptions {
  /**
   * 每批行数（插件按方言上限自动收敛：mssql 参数 2100/行数 1000 双上限取小、
   * dm ≤1000 保守上限、sqlite 预编译+事务、其余多值 INSERT 分批——全部插件侧吸收
   * 调用方传入值仅作期望值）。
   */
  batchSize?: number
  /** 冲突处理策略 */
  onConflict?: 'error' | 'skip' | 'replace' | 'update'
}

/**
 * 批量写返回。不变式：inserted + skipped = 入参 rows 总行数
 * skipped 为「未作为新行插入」的行数（skip=跳过不写；replace=覆盖原行；
 * update=更新原行的冲突行）。
 */
export interface InsertBatchResult { inserted: number; skipped: number }

/**
 * 表 DDL 文本。
 * createTable 为可重建该表的建表语句（原文或目录组装文本，含列/主键/约束/表级属性）；
 * indexes 为二级索引的 DDL 文本（可选；主键通常已含于 createTable，是否重复由插件自决）。
 * 取数路径全部在插件内实现：MySQL 族 SHOW CREATE TABLE、sqlite sqlite_master.sql、
 * PG 族目录组装、mssql OBJECT_DEFINITION（候选待验）、dm DBMS_METADATA 或 ALL_* 组装。
 */
export interface TableDdl { createTable: string; indexes?: string[] }

/**
 * DDL 应用选项：
 * stopOnError 缺省 false（逐句执行、失败继续并在 errors 汇总）；true 时首错即停
 * （后续语句不执行——已执行语句不回滚，除非插件内部以事务包裹）。
 */
export interface ApplyDdlOptions { stopOnError?: boolean }

/**
 * DDL 脚本应用结果：executed 为成功执行的语句数；errors 每条失败语句一项
 * （全成功时省略或空数组）。语句拆分（方言注释/字符串感知）在插件内实现。
 */
export interface DdlApplyResult { executed: number; errors?: LuoshuError[] }

/**
 * 事务内语句执行器：withTransaction 回调
 * 收到的 helper。exec 的 sql 为插件方言文本，params 为位置参数
 * （裸数组——事务通道不承载 timeoutMs 等执行选项）。connId 由宿主注入的连接上下文
 * 持有，方法签名不带 connId（沿 provider 既有约定）。helper 仅在事务回调执行期内
 * 有效——事务结束后再调用属未定义行为。
 */
export interface TransactionHelper {
  exec(sql: string, params?: unknown[]): Promise<QueryResult>
}

// ===== R16：表设计器变更模型=====
// 设计链路分工（diff 在渲染层纯函数、语句生成在插件，各自可测）：
// 渲染层 diffTable(original SchemaInfo vs 现模型) → 变更标记（绿行）+ 改名推断
// （UI 行身份保留改名语义）+ 空变更判定；插件 generateDdl 按 original 重新比对
// 生成方言差异语句（CREATE / ALTER / 重建脚本——sqlite）。两侧共用本模型。

/**
 * 设计器列定义。stdType 为**标准类型字符串**（type-mapping.md §2 十值：
 * string/number/boolean/datetime/date/time/json/binary/uuid/unknown）——渲染层对
 * 未修改类型的既有列**应回传 original 的原生类型词（ColumnInfo.dataType 原文）**
 * 对用户改过类型/新建的列传标准词；插件实现者契约：stdType 先查本库反向词表
 * （标准词 → 方言建表词），未命中按本库原生词透传——保证 text/bytea 等原生词
 * 往返不丢信息（mysql ddl.ts 先例）。
 */
export interface ColumnDef {
  /** 名称 */
  name: string
  /** 标准类型（十值）或本库原生类型词（既有列未改类型时——见接口级说明） */
  stdType: string
  /** 长度（varchar(50) → 50） */
  length?: number
  /** 精度（numeric(10,2) → 10） */
  precision?: number
  /** 标度（numeric(10,2) → 2） */
  scale?: number
  /** 是否可空 */
  nullable: boolean
  /** 默认值 SQL 文本原样（'x' / 0 / CURRENT_TIMESTAMP），语义由调用方负责 */
  defaultValue?: string
  /** 注释 */
  comment?: string
  /** 是否自增 */
  autoIncrement?: boolean
}

/** 设计器索引定义 */
export interface IndexDef {
  /** 名称 */
  name: string
  /** 列定义集 */
  columns: string[]
  /** unique 字段 */
  unique: boolean
  /** 类型 */
  type?: 'BTREE' | 'HASH' | 'OTHER'
}

/** 设计器外键定义 */
export interface FkDef {
  /** 约束名（可省——由库自动命名；删除匹配按 original 元数据名对账） */
  name?: string
  /** 列定义集 */
  columns: string[]
  /** ref表名 */
  refTable: string
  /** ref列定义集 */
  refColumns: string[]
  /** ondelete */
  onDelete?: ForeignKeyAction
  /** onupdate */
  onUpdate?: ForeignKeyAction
}

/** 设计器表定义 */
export interface TableDef {
  /** 名称 */
  name: string
  /** 目标 schema/库（pg=-schema、mysql=库、dm=schema；渲染层从树上下文填充） */
  schema?: string
  /** 列定义集 */
  columns: ColumnDef[]
  /** 主键列（按序） */
  primaryKey?: string[]
  /** indexes 字段 */
  indexes?: IndexDef[]
  /** foreignkeys */
  foreignKeys?: FkDef[]
  /** 注释 */
  comment?: string
}

/**
 * 表变更请求。
 * action='create'：node 为目标库/schema 节点（解析建表落点），original 缺省；
 * action='alter'：node 为表节点，original = 打开设计器时的 getSchema 快照
 * 插件按 table 与 original 的比对结果生成差异语句（非全量重建）。
 * columnRenames：渲染层 UI 行身份保留的改名事实（改列名 ≠ 删旧建新——数据保留
 * 语义依赖显式告知；sqlite 重建路径的必需输入）。未改动时省略。
 */
export interface TableChangeRequest {
  /** 节点 */
  node?: TreeNodeRef
  /** action 字段 */
  action: 'create' | 'alter'
  /** 表名 */
  table: TableDef
  /** original 字段 */
  original?: SchemaInfo
  /** 列改名清单（from=original 列名，to=table 列名） */
  columnRenames?: { from: string; to: string }[]
}

/**
 * DDL 生成结果：statements 为逐条可执行语句（预览确认后经 applyDdl 应用
 * 或降级档插件「复制 DDL」）；warning 非空时 UI 预览弹窗显示红色警告条
 * （sqlite 重建表路径——数据搬运期间外键检查临时关闭等需要用户知悉的风险）。
 */
export interface GeneratedDdl {
  /** statements 字段 */
  statements: string[]
  /** warning 字段 */
  warning?: string
}

/**
 * 日志流选项。Docker logs follow 语义：
 * - `tail`：打开时先回放尾部 N 行历史（缺省 = 插件自定，对齐 `docker logs --tail`
 * 的「all」缺省——插件按自身保留策略返回全部可回放行）；
 * - `follow`：true = 尾部行回放完毕后流保持打开、持续追加新行（长流，直到日志源
 * 结束或宿主取消）；false = 回放完即结束（最后一个 chunk 携带 done: true）。
 */
export interface LogStreamOptions {
  /** follow 字段 */
  follow?: boolean
  /** tail 字段 */
  tail?: number
}

/**
 * 日志流块。与 ResultChunk 的表格语义不同：
 * 日志是纯文本行流——无 columns/rows，行拆分（\n / \r\n）由插件负责
 * lines 内的每个元素即一行（不含换行符）。done=true 标记流结束。
 */
export interface LogChunk {
  /** 本块日志行（行文本不含换行符） */
  lines: string[]
  /** true = 流结束（follow 长流的日志源结束/被取消；非 follow 回放完毕） */
  done: boolean
}

// ===== R22：文件读写原语=====
// readFile/writeFile 是**字节层原语**——编码探测、行尾保持（LF/CRLF）、
// 文本/图片/压缩包类型判定全在渲染层，契约不掺文本概念。「方言协议」各归
// 插件（文件=SFTP/内存 FS、其余 kind 自决），主程序零类别逻辑。

/**
 * readFile 选项。maxBytes：读取上限（字节）——文件超过上限时返回
 * 前 maxBytes 字节并置 truncated: true（size 仍为真实大小，供 UI 截断提示/
 * 拦截判断）；缺省 = 插件自定上限（如 SFTP 插件 10MB，超限抛 LuoshuError
 * 「截断可读」与「超限拒读」两种形态由实现者按场景选择）。
 */
export interface ReadFileOptions {
  /** 上限bytes */
  maxBytes?: number
}

/**
 * readFile 返回。不变式：truncated=false 时 data.length === size；
 * truncated=true 时 data 为 maxBytes 上限下的前缀且 size > data.length
 * （size 恒为文件真实大小，与是否截断无关）。
 */
export interface ReadFileResult {
  /** 文件内容（截断时为前缀字节） */
  data: Uint8Array
  /** 文件真实大小（字节） */
  size: number
  /** true = 文件超过 maxBytes 上限，data 为截断后的前缀 */
  truncated: boolean
}

/**
 * writeFile 选项：自由 KV 前瞻位（沿 TerminalSessionOptions 先例）
 * v0 无必选语义，实现者可忽略；v1.x 候选：mtime 冲突检测（乐观锁——编辑期间
 * 文件被外部修改时拒绝覆盖，见 walkthrough R22）。
 */
export interface WriteFileOptions { [key: string]: unknown }
