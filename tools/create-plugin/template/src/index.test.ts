import { describe, expect, it } from 'vitest'
import plugin from './index.ts'

describe('template host plugin', () => {
  it('向宿主提供 demo 服务缝与 commands 命令缝', async () => {
    const provided = new Map<string, unknown>()
    plugin.apply({ provide: (name, impl) => provided.set(name, impl) })
    const service = provided.get('demo') as { ping(): string }
    expect(service.ping()).toBe('pong from host')
    const commands = provided.get('commands') as {
      list(): Array<{ id: string }>
      run(id: string, args?: unknown[]): Promise<unknown>
    }
    expect(commands.list().map((c) => c.id)).toEqual(['demo.ping', 'demo.longTask'])
    expect(await commands.run('demo.ping')).toBe('pong from command')
  })

  it('长任务命令持有并释放电源票据', async () => {
    const provided = new Map<string, unknown>()
    const calls: string[] = []
    plugin.apply({
      provide: (name, impl) => provided.set(name, impl),
      reflect: {
        get: (name: string) => name === 'power'
          ? {
              /** 记录申请 */
              acquire: async (reason: string) => { calls.push(`acquire:${reason}`); return 1 },
              /** 记录释放 */
              release: async () => { calls.push('release'); return true },
            }
          : undefined,
      },
    })
    const commands = provided.get('commands') as { run(id: string, args?: unknown[]): Promise<unknown> }
    expect(await commands.run('demo.longTask')).toBe('long task done')
    expect(calls).toEqual(['acquire:模板长任务', 'release'])
  })
})
