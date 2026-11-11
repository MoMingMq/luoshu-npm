// 宿主侧入口（package.json main）：向宿主注册一个自定义服务缝。
// 宿主会把 provides 声明的缝（demo）与按件独立缝（demo@<插件 id>）暴露给主进程；
// 渲染侧通过 window.luoshuBridge.call('demo@<插件 id>', 'ping', []) 调用。
// 本文件不 import 任何洛书运行时包——第三方插件可零运行时依赖装载。

interface HostContext {
  provide(name: string, impl: unknown): void
}

/** 命令处理器表：UI 经 luoshuBridge.cmdRun(pluginId, commandId, args) 调用 */
const commandHandlers = new Map<string, (args: unknown[]) => unknown>([
  ['demo.ping', () => 'pong from command'],
])

const commandsService = {
  list: () => [...commandHandlers.keys()].map((id) => ({ id, title: id === 'demo.ping' ? '示例：Ping 宿主' : id })),
  run: async (id: string, args: unknown[] = []): Promise<unknown> => {
    const handler = commandHandlers.get(id)
    if (!handler) throw new Error(`命令不存在: ${id}`)
    return await handler(args)
  },
  runStream: async function* (id: string, args: unknown[] = []): AsyncIterable<unknown> {
    const handler = commandHandlers.get(id)
    if (!handler) throw new Error(`命令不存在: ${id}`)
    yield await handler(args)
  },
}

const plugin = {
  name: 'luoshu-plugin-template',
  apply(ctx: HostContext): void {
    ctx.provide('demo', {
      ping: (): string => 'pong from host',
    })
    // 命令缝：宿主暴露 commands@<插件 id>，主进程 cmd-run 直达本表
    ctx.provide('commands', commandsService)
  },
}

export default plugin

export { meta } from './meta.ts'
