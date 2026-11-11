/**
 * defineDataSource：把数据源描述（表单字段/能力开关/v1 Provider）装配为标准
 * cordis 插件。
 *
 * 服务面投影（projectServiceOf，T6 docker 双缝复用的通用导出）：Provider 方法
 * 原样透传到 'data-source' 缝——方法枚举=原型（类形 Provider）+自有键（对象字面量
 * Provider——mysql v1 实现即此形态，互证）双扫，constructor 剔除；收 TreeNodeRef
 * 的方法位实参经 string→ref 归一桥。
 */
import type { PluginFormField } from './metadata.ts'
import type { DataSourceProvider } from './provider.ts'
import type { TreeNodeRef } from './types.ts'

/** cordis 插件结构化最小面（宿主按 cordis 形态装载——第三方侧零运行时依赖） */
interface HostContext {
  /** 注册服务缝：seam id → 实现（宿主代理为 seam@<插件 id> 供渲染层调用） */
  provide(name: string, impl: unknown): void
}

/** cordis 插件对象结构化最小面（name + 可选依赖声明 + 装配函数） */
interface HostPlugin {
  name: string
  inject?: readonly string[]
  apply(ctx: HostContext): unknown
}

/** 数据源描述：form/capabilities/typeVocabulary 来自 v1 manifest 资产；provider 为 v1 Provider 实现 */
export interface DataSourceDescriptor {
  /** 唯一标识 */
  id: string
  /** 连接表单字段清单（package.json luoshu.form.fields——ConnectDialog 动态下拉消费面） */
  form: PluginFormField[]
  /** 能力开关（v1 capabilities；工厂不做枚举校验，宽容未来增量） */
  capabilities: string[]
  /** 补全关键字表（v1 typeVocabulary，可空——透传件壳按需消费） */
  typeVocabulary?: unknown
  /** v1 Provider 实现（方法拷贝迁移原样） */
  provider: DataSourceProvider
}

/** 工厂产物：cordis 插件对象 + 洛书描述元数据（件壳/装配层可读） */
export type DataSourcePlugin = HostPlugin & {
  /** 连接表单字段清单（= descriptor.form 原样） */
  luoshuForm: DataSourceDescriptor['form']
  /** 能力开关清单（= descriptor.capabilities 原样——UI 能力门控消费面） */
  luoshuCapabilities: string[]
}

/**
 * TreeNodeRef 参数位表（0 基）——与 provider.ts 各方法签名一一对应
 * 。
 * 不收 ref 的方法（connect/query/applyDdl/uploadFile 族等）不入表——实参直透传。
 */
export const DATA_SOURCE_REF_ARGS: Readonly<Record<string, readonly number[]>> = {
  listChildren: [0],
  listViews: [0],
  listFunctions: [0],
  getSchema: [0],
  getDdl: [0],
  nodeQuery: [0],
  insertBatch: [0],
  getTableDdl: [0],
  createNode: [0],
  renameNode: [0],
  deleteNode: [0],
  moveNode: [0, 1],
  applyRowEdits: [0],
  streamLogs: [0],
  readFile: [0],
  writeFile: [0]
}

/**
 * 字符串 parentKey ↔ TreeNodeRef 归一桥。
 *
 * 互证结论：
 * TreeNodeRef = `{ databaseId?: string; typeId: string; id: string }`——typeId 必填
 * 实现按 typeId 分派层（mysql：'database' 列表层/'root' 建库父级/'table' 无子）
 * 库名取 `node.databaseId ?? node.id`。
 *
 * 字符串约定（写死）：v2 消费端（desktop bench/host/DemoTab）传连接根键字符串
 * （'root'/'from-tab'），mock 件键族为 'root/0' 形——'/' 首段即连接根标记，键不含
 * 类型信息。故归一为整串作 id、typeId 固定 'root'（跨 v1 插件的连接根惯例 typeId
 * mysql createNode 的建库父级判据）。库层以下导航消费端应传完整 TreeNodeRef
 * （v1 树行载荷形态）——字符串桥是 poc/bench 级消费兜底，不承担层语义推断。
 */
export function normalizeRef(node: TreeNodeRef | string): TreeNodeRef {
  if (typeof node !== 'string') return node
  return { typeId: 'root', id: node }
}

/**
 * 服务面投影（通用）：任意 Provider 对象的方法面透传为服务缝对象。
 *
 * - 方法枚举=原型（Object.getPrototypeOf 的自有名）+自有键双扫——类形与对象
 * 字面量两种 Provider 形态皆覆盖（互证：mysql v1 实现是闭包对象字面量）；
 * constructor 与非函数属性剔除；只扫一层原型，不触 Object.prototype
 * （toString/valueOf 等不泄漏）。
 * - refArgs 命中方法的指定位实参为 string 时经 normalizeRef 归一；对象 ref
 * 直通同引用，其余实参不动。
 * - 未命中方法 bind(provider) 直透传——this 语义与 AsyncIterable 返回形态
 * （streamQuery/streamLogs）均原样保留（宿主 exposeService 已支持流）。
 *
 * @param provider 任意 Provider 对象（数据源/docker/终端等）
 * @param refArgs ref 参数位表，缺省为 DataSourceProvider 位表；非数据源 Provider
 * 投影时传自身位表（无 ref 方法传 {}）
 */
export function projectServiceOf(
  provider: object,
  refArgs: Readonly<Record<string, readonly number[]>> = DATA_SOURCE_REF_ARGS
): Record<string, (...args: unknown[]) => unknown> {
  const projected: Record<string, (...args: unknown[]) => unknown> = {}
  const record = provider as Record<string, unknown>
  const seen = new Set<string>()
  for (const target of [Object.getPrototypeOf(provider), provider]) {
    if (!target || target === Object.prototype) continue
    for (const key of Object.getOwnPropertyNames(target)) {
      if (key === 'constructor' || seen.has(key)) continue
      const fn = record[key]
      if (typeof fn !== 'function') continue
      seen.add(key)
      const positions = refArgs[key]
      if (positions) {
        projected[key] = (...args: unknown[]) => {
          for (const pos of positions) {
            if (typeof args[pos] === 'string') args[pos] = normalizeRef(args[pos] as string)
          }
          return (fn as (...a: unknown[]) => unknown).apply(provider, args)
        }
      } else {
        projected[key] = (fn as (...a: unknown[]) => unknown).bind(provider)
      }
    }
  }
  return projected
}

/** 工厂：数据源描述 → cordis 插件（default 语义由件再导出；服务缝固定 'data-source'） */
export function defineDataSource(desc: DataSourceDescriptor): DataSourcePlugin {
  return {
    name: desc.id,
    luoshuForm: desc.form,
    luoshuCapabilities: desc.capabilities,
    apply(ctx: HostContext) {
      ctx.provide('data-source', projectServiceOf(desc.provider))
    }
  }
}
