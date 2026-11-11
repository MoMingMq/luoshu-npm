import type {
  ApplyDdlOptions, ConnectionInfo, ConnectionOptions, DatabaseRef, DdlApplyResult, GeneratedDdl,
  InsertBatchOptions, InsertBatchResult, ListPage, LogChunk, LogStreamOptions, NodeQuery,
  QueryParams, QueryResult, ReadFileOptions, ReadFileResult, ResultChunk, SchemaInfo, TableChangeRequest,
  TableDdl, TablePage, TerminalSessionOptions, TreeNode, TreeNodeRef, TransactionHelper,
  WriteFileOptions
} from './types.ts'
import type { RowEdit, EditApplyEntry, ApplyRowEditsOptions } from './row-edit.ts'

/**
 * 数据源插件供给接口（L2）。
 *
 * 查询文本语义：query/streamQuery 的 `sql` 参数
 * 是「插件方言查询文本」——SQL 库为 SQL 语句，文档库为 JSON 过滤器文本
 * 键值库为 key pattern；`params` 为位置参数，仅 SQL 方言使用
 * （文档/键值方言由插件自行解析查询文本，忽略 params 即可）。
 */
export interface DataSourceProvider {
  connect(connId: string, options: ConnectionOptions): Promise<ConnectionInfo>
  disconnect(connId: string): Promise<void>
  listDatabases(): Promise<DatabaseRef[]>
  /**
   * 列出树节点的子节点。
   * @param node 父节点引用
   * @param page 可选分页参数：不支持分页的插件可忽略（返回全量，调用必须仍成功）；
   * 支持分页的插件按 limit 截断，并在被截断段的末节点携带 TreeNode.cursor 供翻页。
   */
  listChildren(node: TreeNodeRef, page?: ListPage): Promise<TreeNode[]>
  /**
   * 列出库内视图：node = database 层节点。
   * 独立方法而非并入 listChildren——树「视图」分组懒加载专用（避开表层分页语义
   * 纠缠）；未实现时该分组显示空（METHOD_NOT_SUPPORTED 不算违约，SQLite 等无
   * 视图库不声明 view nodeType 即分组不出现）。
   */
  listViews?(node: TreeNodeRef): Promise<TreeNode[]>
  /** 列出库内函数/存储过程（同上；两类合并归「函数」分组，插件自决归并口径） */
  listFunctions?(node: TreeNodeRef): Promise<TreeNode[]>
  getSchema(node: TreeNodeRef): Promise<SchemaInfo>
  /**
   * 对象原生 DDL：右键「查看 DDL」优先消费
   * 返回数据库自带的建对象语句原文（如 MySQL SHOW CREATE TABLE / DM
   * SP_TABLEDEF / SQLite sqlite_master.sql）。未实现时 UI 回退 getSchema
   * 派生摘要；实现方需处理 databaseId/schema 限定与大小写（DM 系对象名大写）。
   */
  getDdl?(node: TreeNodeRef): Promise<string>
  /** `sql` 为插件方言查询文本，`params` 为位置参数（仅 SQL 方言使用）——语义见接口级 R3 说明。 */
  query(sql: string, params?: QueryParams): Promise<QueryResult>
  /** `sql` 为插件方言查询文本，`params` 为位置参数（仅 SQL 方言使用）——语义见接口级 R3 说明。 */
  streamQuery(sql: string, params?: QueryParams, queryId?: string): AsyncIterable<ResultChunk>
  /**
   * 内置 grid 视图打开节点时的查询描述派生。
   * 插件按自身方言生成 sql/countSql（标识符引用与限定名规则插件自决）；
   * 主程序零方言拼装。未实现时主程序调用将收到 LUOSHU.METHOD_NOT_SUPPORTED
   * UI 数据视图显示「该插件未提供」——不视为契约违约（可选能力）。
   *
   * 分页扩展：传 page 时插件按自身方言生成
   * 键集分页 SQL（WHERE 排序键 > 游标 ORDER BY 排序键 LIMIT n；mssql→TOP、
   * oracle-like→ROWNUM 包装、offsetFallback→OFFSET 回退），游标/行数经
   * NodeQuery.params 参数化返回；不传 page 保持既有不分页行为（向后兼容）。
   * 不支持分页的插件可忽略 page（调用必须仍成功）。
   */
  nodeQuery?(node: TreeNodeRef, page?: TablePage): Promise<NodeQuery>
  /**
   * 批量写入。
   * 把 rows 按 columns 的列序写入 node 指向的表——方言分批（多值 INSERT 每批上限、
   * mssql 参数 2100/行数 1000 双上限、dm 保守上限、sqlite 预编译+事务等）全部由
   * 插件侧吸收，主程序只传列名与行值，零方言拼装。冲突语义（onConflict）随方言
   * 由插件实现（见 InsertBatchOptions JSDoc 的各库落法差异）；批内原子性由实现者
   * 尽量保证（建议内部配合 withTransaction）。未实现时主程序调用将收到
   * LUOSHU.METHOD_NOT_SUPPORTED——不视为契约违约（可选能力，沿 nodeQuery 先例）。
   */
  insertBatch?(node: TreeNodeRef, columns: string[], rows: unknown[][], opts?: InsertBatchOptions): Promise<InsertBatchResult>
  /**
   * 事务包裹执行：fn 成功（resolve）→ 提交事务并原样返回其结果；
   * fn 抛错（reject，含 helper.exec 抛错）→ 回滚事务并原样传播异常。实现者职责：
   * 事务期间绑定同一连接（池型驱动需绑定单一连接，串行驱动天然满足）——connId 由
   * 宿主注入的连接上下文持有，方法签名不带 connId（沿 provider 既有约定）。
   * 嵌套调用语义 v0 不定义（实现者可拒绝或扁平化）。未实现时主程序调用收到
   * LUOSHU.METHOD_NOT_SUPPORTED（可选能力）。
   */
  withTransaction?<T>(fn: (helper: TransactionHelper) => Promise<T>): Promise<T>
  /**
   * 取表 DDL 文本：返回可重建该表的建表语句（及二级索引语句）。
   * 方言取数路径全部在插件内实现（SHOW CREATE TABLE / sqlite_master.sql /
   * 目录组装 / OBJECT_DEFINITION 等）。未实现时主程序调用收到
   * LUOSHU.METHOD_NOT_SUPPORTED（可选能力）。
   */
  getTableDdl?(node: TreeNodeRef): Promise<TableDdl>
  /**
   * 应用 DDL 脚本：方言拆句在插件内实现——需感知注释与字符串
   * （-- 行注释、# 行注释、块注释、引号内分号等各库差异由插件按本方言处理）
   * 拆出的语句逐句执行并计数。stopOnError 缺省 false（失败继续、errors 汇总）；
   * true 时首错即停。是否以事务包裹由实现者决定（契约不强制——部分 DDL 语句
   * 在部分库上隐式提交）。未实现时主程序调用收到 LUOSHU.METHOD_NOT_SUPPORTED
   * （可选能力）。
   */
  applyDdl?(script: string, opts?: ApplyDdlOptions): Promise<DdlApplyResult>
  /**
   * 表变更 DDL 生成：把设计器
   * 变更模型渲染为本方言的 DDL 语句序列——纯生成、不执行（执行走 applyDdl
   * 预览确认后由调用方衔接）。实现者契约：
   * - action='create'：生成建表语句组（含索引/外键/注释按本库形态）；
   * - action='alter'：按 original 与 table 的比对生成差异语句（改名列走
   * columnRenames 的显式改名语义，绝不退化为删旧建新；sqlite 改类型/约束走
   * 重建表脚本并在 warning 里显著提示）；
   * - stdType 解析：先查本库标准类型反向词表，未命中按原生词透传（往返不丢
   * 信息，见 ColumnDef JSDoc）；
   * - 无差异时返回空 statements（UI 判定保存禁用）。
   * 未实现时主程序调用收到 LUOSHU.METHOD_NOT_SUPPORTED（可选能力，沿 nodeQuery 先例）。
   */
  generateDdl?(req: TableChangeRequest): Promise<GeneratedDdl>
  // ---- R17TreeMutation 四可选方法 ----
  // 树操作（G5）：nodeType 操作声明（creatable/renamable/deletable/draggable/
  // droppable）是 UI 入口的唯一依据，方法未实现时宿主调用收到
  // LUOSHU.METHOD_NOT_SUPPORTED——与 nodeQuery 先例同属可选能力。
  // 「方言协议」各归插件：文件=SFTP/内存 FS、数据库=DDL、容器=操作；
  // 主程序零类别逻辑（只做声明匹配与转发）。
  /**
   * 新建子节点：parent 为目标容器节点，type 为 creatable 声明的
   * nodeType id（UI 子菜单来源），name 为用户输入名。返回新建的节点（UI 直插
   * 树行）。冲突/非法名由插件抛 LuoshuError（UI toast + hint）。
   */
  createNode?(parent: TreeNodeRef, type: string, name: string): Promise<TreeNode>
  /**
   * 重命名节点（R17，可选； 契约修订：补第三可选参 opts?
   * 自由 KV 前瞻位，沿 writeFile opts 先例，v0 实现者可忽略。落地形态：表节点
   * ALTER TABLE … RENAME / sp_rename（六官方 DB 适配器）；视图改名仅方言有原生
   * DDL 时支持（MySQL 族无——provider 按 typeId 拒绝并提示）；未实现时宿主调用
   * 收到「方法不存在」（METHOD_NOT_SUPPORTED 先例，可选能力）。
   *
   * 返回改名后的节点（UI 原位替换）。
   */
  renameNode?(node: TreeNodeRef, newName: string, opts?: Record<string, unknown>): Promise<TreeNode>
  /**
   * 删除节点：目录/容器类节点由插件在节点 meta.riskWarning
   * 标注递归风险文案（UI 统一确认框展示，声明性数据不进代码）。
   */
  deleteNode?(node: TreeNodeRef): Promise<void>
  /**
   * 移动节点：source 拖至 target（droppable 声明匹配由
   * UI 把关）。返回移动后的节点（源删目标插）。
   */
  moveNode?(source: TreeNodeRef, target: TreeNodeRef): Promise<TreeNode>
  /**
   * 网格行级批编辑（可选）：按行变更清单（update/insert/delete）在本表逐行执行
   * 参数化语句，返回与入参同序的成败回执（单行失败不中断批次——失败行保留
   * error 供批内重试）。组装由 luoshu-api row-edit 共享纯函数承担（方言=本插件
   * connect 自报 dialect），插件负责驱动执行与错误映射（标准实现 =
   * applyRowEditsViaQuery + executor 闭包）。
   *
   * R59增 opts.transactional：true = 整批原子（单事务内执行，任一
   * 行失败回滚全部，回执全 ok:false——首错行带原错误，其余行 TX_ROLLED_BACK）。
   * 支持 withTransaction 的插件以 applyRowEditsTransactional 包裹；不支持者可
   * 忽略本选项（保持逐行语义）。
   * 未实现时宿主调用收到
   * LUOSHU.METHOD_NOT_SUPPORTED（UI 编辑入口按 capabilities.cursorEdit 门控）。
   */
  applyRowEdits?(table: TreeNodeRef, changes: RowEdit[], opts?: ApplyRowEditsOptions): Promise<EditApplyEntry[]>
  /**
   * 日志流：按 Docker logs
   * follow 语义回放 + 跟随目标节点的日志——先回放尾部 `opts.tail` 行历史
   * `opts.follow` 为 true 时回放完毕后保持长流持续产出新行。行拆分（\n / \r\n）
   * 由插件负责（LogChunk.lines 元素不含换行符）；取消 = 消费者 break 触发
   * iterator.return（宿主通道层既有语义，无需驱动级 cancel）。
   *
   * 决断记录（设计 §4 预留二选一，本任务拍板）：不复用 streamQuery
   * ResultChunk 是表格语义（queryId/columns/rows，R3 钦定为「插件方言查询文本」
   * 通道），日志是无 schema 的纯文本长流（follow 打开时永不 done、停止跟随
   * 由取消承载），复用将污染 R3 契约陈述并迫使文档视图嗅探 columns 缺席；
   * 独立可选方法沿 nodeQuery 先例，未实现时主进程调用收到
   * LUOSHU.METHOD_NOT_SUPPORTED（对应 UI 入口不出现）。真实对位：docker
   * 容器日志插件（follow=--follow、tail=--tail）、数据库慢日志/错误日志文件。
   */
  streamLogs?(node: TreeNodeRef, opts: LogStreamOptions): AsyncIterable<LogChunk>
  // ---- R22readFile/writeFile 可选方法对 ----
  // 文件读写字节层原语（文件 Tab 在线编辑/图片预览的数据通道）：编码探测、
  // 行尾保持、文本/图片/压缩包类型判定全在渲染层——契约只承载字节往返
  // 不掺文本概念（类型语义见 types.ts R22 段）。「方言协议」各归插件
  // （文件=SFTP/内存 FS、其余 kind 自决），主程序零类别逻辑；未实现时宿主
  // 调用收到 LUOSHU.METHOD_NOT_SUPPORTED（可选能力，沿 R17 TreeMutation 先例）。
  /**
   * 读文件：返回 node 指向文件的内容字节（超 maxBytes 上限时
   * 返回前缀并置 truncated——size 恒为真实大小，不变式见 ReadFileResult）。
   * 非文件节点（目录等）由插件抛 LuoshuError。
   */
  readFile?(node: TreeNodeRef, opts?: ReadFileOptions): Promise<ReadFileResult>
  /**
   * 写文件：整文件覆盖写（编辑器保存路径）。opts 为自由 KV
   * 前瞻位（v1.x mtime 乐观锁候选——编辑期间外部修改检测），v0 实现者可忽略。
   * 非文件节点（目录等）由插件抛 LuoshuError。
   */
  writeFile?(node: TreeNodeRef, data: Uint8Array, opts?: WriteFileOptions): Promise<void>
  // ---- R45文件传输/权限/压缩可选方法族 ----
  // 字节流原语的批量化延伸（文件系统类 kind 的主机对位）：本方法族**无进度通道**
  // （契约只承载完成/失败——UI 进度由插件命令层承担，经 cmd:stream chunk 约定
  // 下发，Provider 面不掺流概念）；「方言协议」各归插件（SSH=SFTP+exec、
  // 其余文件类 kind 自决），主程序零类别逻辑。未实现时宿主调用收到
  // LUOSHU.METHOD_NOT_SUPPORTED（可选能力，沿 R17/R22 先例）。
  /**
   * 上传单个本地文件到远端目录：remoteDir 必须是已存在目录
   * 远端目标名 = localPath 的本地 basename；目标已存在时覆盖（'w' 截断语义
   * xTerminal 对齐）。localPath 不可读由插件抛 LuoshuError。
   */
  uploadFile?(localPath: string, remoteDir: string): Promise<void>
  /**
   * 递归上传本地目录：远端落在 remoteDir/<本地目录名>（逐级
   * mkdir -p 语义由插件自实现——逐级 stat/mkdir），同名远端目录合并写入。
   */
  uploadDir?(localDir: string, remoteDir: string): Promise<void>
  /** 下载远端文件到本地完整路径：localPath 为目标文件全路径（渲染层保存框解析），已存在覆盖。 */
  downloadFile?(remotePath: string, localPath: string): Promise<void>
  /** 递归下载远端目录：落在 localPath/<远端目录名>（本地逐级建目录），同名本地目录合并。 */
  downloadDir?(remotePath: string, localPath: string): Promise<void>
  /**
   * 修改远端条目权限：mode 为八进制字符串（3-4 位，如 '644'/'0755'）
   * 非法形态由插件抛 LuoshuError（UI 输入框校验同口径）。
   * 修订：增可选第三参 connId
   * 多连接插件（SSH 连接池）按此路由目标连接；缺省由插件自决（最近连接兜底）。
   */
  chmod?(remotePath: string, mode: string, connId?: string): Promise<void>
  /**
   * 远端压缩：产物 <名>.tar.gz 留在同目录，返回产物远端路径。
   * 实现通道插件自决（SSH=exec tar -czf）。
   */
  compress?(remotePath: string): Promise<string>
  cancel(queryId: string): Promise<void>
}

/**
 * 终端会话供给接口——provider 之外
 * 的独立供给面（registration.terminal），任意 kind 插件可选实现：ssh/docker
 * 连接类插件的主形态，数据源插件亦可（数据库 CLI）。
 *
 * 生命周期：宿主 openSession 建会话 → write/resize 往返 → close 收尾（幂等）；
 * 插件→宿主方向的数据出口为 onData/onClosed 回调（**宿主注入**的可选属性
 * 赋值时点在 openSession 前后均须生效——会话中途注入不丢既有订阅）。
 * 宿主把回调转发为渲染层事件流 term:data:{sessionId}（分块 + 背压——渲染
 * 消费慢时宿主缓冲）与 term:closed:{sessionId}（断线重连提示）。
 */
export interface TerminalProvider {
  /** 建立会话，返回 sessionId（插件侧唯一；宿主以其路由通道事件） */
  openSession(connId: string, options: TerminalSessionOptions): Promise<string>
  /** 写入终端输入（键盘字节流） */
  write(sessionId: string, data: Uint8Array): Promise<void>
  /** 终端尺寸变化（pty resize） */
  resize(sessionId: string, cols: number, rows: number): Promise<void>
  /** 关闭会话（宿主主动关 Tab；幂等——已关会话再调不抛） */
  close(sessionId: string): Promise<void>
  /**
   * 数据出口（宿主注入的回调）：插件产出输出（pty stdout / 回显）时按 chunk
   * 分块回调，sessionId 路由。**R18 契约缺口补齐**：设计 §4 只定义了宿主→渲染
   * 的 term:data 事件流，插件→宿主方向无出口——本回调即该缺口的契约载体。
   */
  onData?(sessionId: string, chunk: Uint8Array): void
  /**
   * 断线出口（宿主注入的回调）：会话非宿主主动关闭而结束时回调（pty exit /
   * 连接断开），reason 为插件侧人读原因；宿主转发 term:closed 驱动 UI 重连。
   */
  onClosed?(sessionId: string, reason?: string): void
}
