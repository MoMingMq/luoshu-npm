// v2 契约测试入口自测：宿主服务缝 / UI 槽位 / 设置 / 快捷键捕获。
import { describe, expect, it } from 'vitest'
import { createV2ContractContext, describeV2Plugin } from './contract-test.ts'

const hostPlugin = {
  name: 'demo-host',
  apply(ctx: unknown) {
    const c = ctx as Record<string, unknown>
    ;(c['provide'] as (name: string, impl: unknown) => void)('demo', { ping: () => 'pong' })
  },
}

const uiPlugin = {
  name: 'demo-ui',
  inject: ['ui', 'shortcuts'],
  apply(ctx: unknown) {
    const c = ctx as Record<string, unknown>
    const ui = c['ui'] as {
      tab(c: { kind: string }): () => void
      settings(c: { group: string; entry: { key: string } }): () => void
    }
    ui.tab({ kind: 'demo-tab' })
    ui.settings({ group: 'demo', entry: { key: 'greeting' } })
    const shortcuts = c['shortcuts'] as { register(r: { id: string }): unknown }
    shortcuts.register({ id: 'demo.shortcut' })
  },
}

describeV2Plugin('demo-host', hostPlugin, { provides: ['demo'] })
describeV2Plugin('demo-ui', uiPlugin, {
  tabs: ['demo-tab'],
  settings: ['demo:greeting'],
  shortcuts: ['demo.shortcut'],
})

describe('createV2ContractContext', () => {
  it('effect 返回的 disposer 被捕获且可撤销', () => {
    const { ctx, capture } = createV2ContractContext()
    let active = true
    ;(ctx['effect'] as (fn: () => () => void) => void)(() => () => { active = false })
    expect(capture.effects).toHaveLength(1)
    ;(capture.effects[0] as () => void)()
    expect(active).toBe(false)
  })
})
