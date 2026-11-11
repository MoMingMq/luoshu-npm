import type { DataSourceProvider, TerminalProvider } from './provider.ts'

/**
 * 命令处理器：可返回任意可结构化克隆的数据
 * （原 v0 为 void——返回值经 cmd:run 通道回渲染层）。**平台对话框协议**：
 * 需要「保存文件路径」的导出类命令，在 ctx.filePath 缺省时返回
 * `{ dialog: { title, defaultPath, filters? } }`（无 result）——宿主渲染层弹
 * 原生保存框后携带 ctx.filePath 重发命令；取消则不再重发。E2E/无头场景经
 * LUOSHU_EXPORT_DIR 由插件自行落路径（不经对话框）。
 */
export type CommandHandler = (ctx: { node?: unknown; [key: string]: unknown }) => Promise<unknown>

export interface KeyValueStorage { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> }
export interface Logger { debug(msg: string, data?: unknown): void; info(msg: string, data?: unknown): void; warn(msg: string, data?: unknown): void; error(msg: string, data?: unknown): void }

/**
 * 接缝访问面：插件间互操作经宿主进程内注册表
 * provide 注册本插件对某接缝的实现（键为 `seamId@pluginId` 命名空间隔离）
 * get/getRequired 消费（可选 providerId 消歧多提供者；getRequired 缺失时抛
 * LUOSHU.SEAM_MISSING 结构化错误）。官方接缝（luoshu:datasource 等）由宿主
 * 垫片从 activate 返回的 registration 自动 provide，无需插件显式声明。
 * 注册可逆：宿主进程重启即整体回退（v1 插件随进程生命周期，无运行时卸载）。
 */
export interface PluginSeams {
  /** 注册本插件对 seamId 的实现（同 id 重复注册后者覆盖——热替换语义） */
  provide(seamId: string, impl: unknown): void
  /** 消费接缝实现：唯一提供者直取；多提供者必须传 providerId 消歧（歧义抛错）；缺失返回 undefined */
  get<T = unknown>(seamId: string, providerId?: string): T | undefined
  /** 同 get，但缺失/歧义时抛 LUOSHU.SEAM_MISSING / LUOSHU.SEAM_AMBIGUOUS 结构化错误 */
  getRequired<T = unknown>(seamId: string, providerId?: string): T
}

/**
 * 交互认证（keyboard-interactive 等）请求载荷：name/instructions 为服务器会话
 * 标识与说明文本，prompts 逐项问答（echo=false 的项按敏感输入呈现——密码框）。
 */
export interface InteractiveAuthPrompts {
  /** 名称 */
  name: string
  /** instructions 字段 */
  instructions: string
  /** prompts 字段 */
  prompts: Array<{ prompt: string; echo?: boolean }>
}

/**
 * 交互认证桥：宿主注入的渲染层弹层请求
 * 面——request 把 prompts 转交渲染层 GUI 收集（NModal 逐项输入），resolve 逐题
 * 答案字符串数组（与 prompts 等长对位）；渲染层取消/超时 reject。宿主未注入时
 * 为 undefined（进程内直调测试可自带回调；独立加载场景静默降级）。
 */
export interface PluginInteractiveAuth {
  request(prompts: InteractiveAuthPrompts): Promise<string[]>
}

export interface PluginContext {
  /** log 字段 */
  log: Logger
  registerCommand(id: string, handler: CommandHandler): void
  registerView(view: { id: string; title: string; entry: string }): void
  /** storage 字段 */
  storage: KeyValueStorage
  onDeactivate(cb: () => void): void
  /** R23 接缝访问面（见 PluginSeams JSDoc） */
  seams: PluginSeams
  /** R54 交互认证桥（见 PluginInteractiveAuth JSDoc）；缺省 = 宿主未注入 */
  interactiveAuth?: PluginInteractiveAuth
}

export interface DDLProvider { placeholder: true } // sub-req-4 定型
export interface TransferProvider { placeholder: true } // sub-req-4 定型
export interface BackupProvider { placeholder: true } // sub-req-4 定型

export interface ProviderRegistration {
  /**
   * 数据源供给：data-source 类插件必填（契约测试覆盖）；接缝型
   * 插件（如官方数据工具集）可缺省——仅经 ctx.seams 提供能力/注册命令，宿主
   * 对缺省 provider 的方法调用回 METHOD_NOT_SUPPORTED（既有兜底）。
   */
  provider?: DataSourceProvider
  /** 服务缝清单 */
  provides?: { ddl?: DDLProvider; transfer?: TransferProvider; backup?: BackupProvider }
  /**
   * 终端供给：openSession/write/resize/
   * close 四方法 + onData/onClosed 宿主注入回调（插件→宿主数据出口）。
   * 未提供时终端 Tab 入口不出现（可选能力，沿 nodeQuery 先例）。
   */
  terminal?: TerminalProvider
}

export type PluginActivate = (ctx: PluginContext) => ProviderRegistration
