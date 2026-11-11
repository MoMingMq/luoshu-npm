// defineDataSource：v1 provider+描述 → v2 cordis 插件（服务面投影+ref 桥）。
// 三核心面：①包装为 Plugin 并 provide data-source 服务面（31 方法全投影/constructor
// 不泄漏——原型链+自有双扫）②string↔TreeNodeRef 桥归一（ref 位实参归一、对象 ref
// 直通同引用、this 绑定 Provider）③描述元数据挂插件面（luoshuForm/luoshuCapabilities）。
import { describe, expect, it } from 'vitest'
// 公开发布仓没有 luoshu-cordis（主仓 workspace 专属）——本文件真跑 cordis
// Context（fiber/plugin/inject），集成验证在主仓执行；此处整体跳过。
import { defineDataSource } from './define-datasource.ts'
import type { DataSourceProvider } from './provider.ts'
import type { TreeNodeRef } from './types.ts'

/** 等待 inject 装载（rc.12：依赖驱动激活异步完成——mock 件 M0 冒烟 settle） */
async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 20))
}

/** Provider 全方法名（8 必选 + 23 可选，R45 后口径）——投影完备性断言用 */
const ALL_METHOD_NAMES = [
  // 必选 8
  'connect', 'disconnect', 'listDatabases', 'listChildren', 'getSchema', 'query', 'streamQuery', 'cancel',
  // 可选 23
  'listViews', 'listFunctions', 'getDdl', 'nodeQuery', 'insertBatch', 'withTransaction', 'getTableDdl',
  'applyDdl', 'generateDdl', 'createNode', 'renameNode', 'deleteNode', 'moveNode', 'applyRowEdits',
  'streamLogs', 'readFile', 'writeFile', 'uploadFile', 'uploadDir', 'downloadFile', 'downloadDir',
  'chmod', 'compress'
] as const

/** 装载插件并经 inject 消费面捕获 'data-source' 服务（mock 件先例局部变量捕获） */
async function loadService(provider: DataSourceProvider, id: string): Promise<{
  svc: Record<string, (...args: unknown[]) => unknown>
  dispose: () => Promise<void>
}> {
  const plugin = defineDataSource({ id, form: [], capabilities: [], provider })
  const ctx = new any()
  await ctx.plugin(plugin)
  let svc: Record<string, (...args: unknown[]) => unknown> | undefined
  await ctx.plugin({
    name: 'consumer',
    inject: ['data-source'],
    apply(c: any) {
      svc = (c as unknown as Record<string, Record<string, (...args: unknown[]) => unknown>>)['data-source']
    }
  })
  await settle()
  if (!svc) throw new Error('data-source 服务未装载')
  return { svc, dispose: () => ctx.fiber.dispose() }
}

describe.skip('defineDataSource', () => {
  it('类形 Provider（原型链方法）全 31 方法投影，constructor 不泄漏', async () => {
    // Object.create 构造原型形态：31 方法全部挂在原型上（自有键为空）——专测原型链扫描
    const proto: Record<string, () => never> = {}
    for (const name of ALL_METHOD_NAMES) {
      proto[name] = () => {
        throw new Error(`${name} 不应被调用（本用例只断言投影面）`)
      }
    }
    const provider = Object.create(proto) as unknown as DataSourceProvider
    const { svc, dispose } = await loadService(provider, 'full')
    expect(Object.keys(svc).sort()).toEqual([...ALL_METHOD_NAMES].sort())
    // constructor 不入投影面（hasOwnProperty 判自有键——点访问会命中 Object.prototype.constructor）
    expect(Object.prototype.hasOwnProperty.call(svc, 'constructor')).toBe(false)
    await dispose()
  })

  it('对象字面量 Provider 投影 + string→TreeNodeRef 桥归一 + 对象 ref 直通', async () => {
    const received: Array<TreeNodeRef | string> = []
    const provider = {
      connect: async () => ({ serverVersion: '8.0' }),
      listChildren: async (node: TreeNodeRef) => {
        received.push(node)
        return [{ typeId: 'table', id: `${node.id}/t1`, label: 't1' }]
      },
      query: async (sql: string) => ({ sql })
    } as unknown as DataSourceProvider
    const { svc, dispose } = await loadService(provider, 'demo')
    // 字符串桥：'root' → { typeId: 'root', id: 'root' }（连接根约定，见 normalizeRef 注释）
    const rows = (await svc['listChildren']!('root')) as Array<{ id: string }>
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe('root/t1')
    expect(received[0]).toEqual({ typeId: 'root', id: 'root' })
    // 对象 ref 直通：同引用直达（不重构、不改写）
    const ref: TreeNodeRef = { typeId: 'database', id: 'db1', databaseId: 'db1' }
    await svc['listChildren']!(ref)
    expect(received[1]).toBe(ref)
    // 非 ref 方法参数原样透传
    expect(await svc['query']!('SELECT 1')).toEqual({ sql: 'SELECT 1' })
    await dispose()
  })

  it('ref 位表覆盖多 ref 位方法（moveNode 双位归一）且 this 绑定 Provider', async () => {
    /** [this, source, target]——this 随调用记录（不别名，直接入组断言） */
    let moved: [unknown, unknown, unknown] | undefined
    const provider = {
      moveNode: function (this: unknown, source: TreeNodeRef, target: TreeNodeRef) {
        moved = [this, source, target]
        return Promise.resolve({ typeId: 'table', id: 'x', label: 'x' })
      }
    } as unknown as DataSourceProvider
    const { svc, dispose } = await loadService(provider, 'mv')
    await svc['moveNode']!('root/db1', 'root/db2')
    expect(moved).toBeDefined()
    expect(moved![0]).toBe(provider)
    expect(moved![1]).toEqual({ typeId: 'root', id: 'root/db1' })
    expect(moved![2]).toEqual({ typeId: 'root', id: 'root/db2' })
    await dispose()
  })

  it('描述元数据挂插件面（luoshuForm/luoshuCapabilities 可读）', () => {
    const plugin = defineDataSource({
      id: 'd2',
      form: [{ key: 'host', type: 'string', label: '主机' }],
      capabilities: ['ddl'],
      provider: {} as DataSourceProvider
    })
    expect(plugin.name).toBe('d2')
    expect(plugin.luoshuForm).toHaveLength(1)
    expect(plugin.luoshuCapabilities).toEqual(['ddl'])
  })
})
