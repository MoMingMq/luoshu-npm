// 宿主侧入口（package.json main）：向宿主注册一个自定义服务缝。
// 宿主会把 provides 声明的缝（demo）与按件独立缝（demo@<插件 id>）暴露给主进程；
// 渲染侧通过 window.luoshuBridge.call('demo@<插件 id>', 'ping', []) 调用。
// 本文件不 import 任何洛书运行时包——第三方插件可零运行时依赖装载。

interface PowerSeamLike {
  /** 申请一张阻止系统挂起的票据 */
  acquire(reason: string, ttlMs?: number): Promise<number>
  /** 释放票据 */
  release(ticket: number): Promise<boolean>
}

interface HostContext {
  provide(name: string, impl: unknown): void
  /** 宿主注入服务读取面（可选消费） */
  reflect?: { get(name: string, strict?: boolean): unknown }
}

/** 当前电源缝（宿主未注入时为 undefined） */
let powerSeam: PowerSeamLike | undefined

/** 命令处理器表：UI 经 luoshuBridge.cmdRun(pluginId, commandId, args) 调用 */
const commandHandlers = new Map<string, (args: unknown[]) => unknown>([
  ['demo.ping', () => 'pong from command'],
  ['demo.longTask', async () => {
    const ticket = await powerSeam?.acquire('模板长任务')
    try {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return 'long task done'
    } finally {
      if (ticket !== undefined) await powerSeam?.release(ticket)
    }
  }],
])

const commandsService = {
  list: () => [...commandHandlers.keys()].map((id) => ({
    id,
    title: id === 'demo.ping' ? '示例：Ping 宿主' : id === 'demo.longTask' ? '示例：长任务（防睡眠）' : id,
  })),
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
    powerSeam = ctx.reflect?.get('power') as PowerSeamLike | undefined
    ctx.provide('demo', {
      ping: (): string => 'pong from host',
    })
    // 命令缝：宿主暴露 commands@<插件 id>，主进程 cmd-run 直达本表
    ctx.provide('commands', commandsService)
  },
}

export default plugin

export { meta } from './meta.ts'
