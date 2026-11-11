/**
 * 插件代码元数据（v2）——插件入口 `export const meta` 的契约。
 *
 * 设计边界：
 * - package.json `luoshu` 只保留装载/分类字段：provides/tier/ui/hostGroup/kind/kindLabel/market；
 * - 本文件描述插件代码导出的展示与声明面：name/description/publisher/capabilities/form/tree/settings；
 * - 宿主启动时读取 `meta` 并上报 Main，壳/市场/设置/连接树在插件未激活时也能拿到静态声明；
 * - 设置优先由 UI 代码 `ctx.ui.settings` 贡献；data-source 的连接表单/树形仍需要装载前静态面
 * 因此保留在 `meta` 中（代码内声明，不是 manifest 文件）。
 */
import { z } from 'zod'

const settingsEntryTypeSchema = z.enum([
  'string', 'number', 'password', 'select', 'checkbox', 'filePath', 'dirPath', 'slider'
])

const settingsEntrySchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  type: settingsEntryTypeSchema,
  label: z.string().min(1),
  description: z.string().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  effect: z.enum(['instant', 'reconnect', 'restart']).optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  placeholder: z.string().optional(),
  maxlength: z.number().optional()
})

const settingsGroupSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  label: z.string().min(1),
  order: z.number().optional(),
  entries: z.array(settingsEntrySchema).min(1)
})

const formFieldSchema = z.object({
  key: z.string().min(1),
  type: z.enum(['string', 'number', 'password', 'select', 'checkbox', 'filePath']),
  label: z.string(),
  required: z.boolean().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  pattern: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  section: z.string().optional(),
  visibleWhen: z
    .object({ field: z.string().min(1), equals: z.union([z.string(), z.number(), z.boolean()]) })
    .optional()
})

const nodeTypeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  icon: z.string(),
  expandable: z.boolean().default(false),
  childrenFrom: z.literal('listChildren').optional(),
  category: z.enum(['table', 'view', 'function', 'trigger', 'event', 'sequence']).optional(),
  creatable: z.array(z.string().min(1)).min(1).optional(),
  renamable: z.boolean().optional(),
  deletable: z.boolean().optional(),
  draggable: z.boolean().optional(),
  droppable: z.array(z.string().min(1)).min(1).optional()
})

const CAPABILITY_VALUES = [
  'needsCredential', 'transaction', 'ddl', 'cursorEdit', 'streaming', 'streamLogs'
] as const

export const pluginCodeMetaSchema = z.looseObject({
  /** 展示名（缺省回落 package.json name） */
  name: z.string().min(1).optional(),
  /** 市场卡片描述（缺省回落 package.json description） */
  description: z.string().min(1).optional(),
  /** 发布者（缺省回落官方/未声明） */
  publisher: z.string().min(1).optional(),
  capabilities: z.array(z.enum(CAPABILITY_VALUES)).optional(),
  form: z.object({ fields: z.array(formFieldSchema).min(1) }).optional(),
  tree: z.object({ nodeTypes: z.array(nodeTypeSchema).min(1) }).optional(),
  settings: z.object({ groups: z.array(settingsGroupSchema).min(1) }).optional()
})

export type PluginCodeMeta = z.infer<typeof pluginCodeMetaSchema>
export type PluginFormField = z.infer<typeof formFieldSchema>
export type PluginNodeType = z.infer<typeof nodeTypeSchema>
export type PluginSettingsEntry = z.infer<typeof settingsEntrySchema>
export type PluginSettingsGroup = z.infer<typeof settingsGroupSchema>

export function validatePluginCodeMeta(raw: unknown): PluginCodeMeta {
  return pluginCodeMetaSchema.parse(raw) as PluginCodeMeta
}
