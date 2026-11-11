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
    expect(commands.list().map((c) => c.id)).toEqual(['demo.ping'])
    expect(await commands.run('demo.ping')).toBe('pong from command')
  })
})
