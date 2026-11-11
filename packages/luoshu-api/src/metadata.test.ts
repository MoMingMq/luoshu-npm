// v2 插件代码元数据契约测试（插件入口 export const meta；manifest 已删除）。
import { describe, expect, it } from 'vitest'
import { validatePluginCodeMeta } from './metadata.ts'

const meta = {
  name: 'MySQL',
  description: 'MySQL 数据源',
  publisher: '洛书官方',
  capabilities: ['needsCredential', 'transaction', 'ddl', 'cursorEdit', 'streaming'],
  form: {
    fields: [
      { key: 'host', type: 'string', label: '主机', required: true, default: '127.0.0.1' },
      { key: 'password', type: 'password', label: '密码' }
    ]
  },
  tree: {
    nodeTypes: [
      { id: 'root', icon: 'database', label: '连接', creatable: ['database'] },
      { id: 'table', icon: 'table', label: '表', category: 'table', deletable: true }
    ]
  },
  settings: {
    groups: [{
      id: 'demo',
      label: '示例',
      entries: [{ key: 'greeting', type: 'string', label: '问候语', default: '你好' }]
    }]
  }
}

describe('validatePluginCodeMeta', () => {
  it('完整代码元数据通过并保留声明面', () => {
    const m = validatePluginCodeMeta(meta)
    expect(m.name).toBe('MySQL')
    expect(m.capabilities).toContain('needsCredential')
    expect(m.form?.fields).toHaveLength(2)
    expect(m.tree?.nodeTypes[1]?.category).toBe('table')
    expect(m.settings?.groups[0]?.entries[0]?.key).toBe('greeting')
  })

  it('纯 UI / 服务插件可只声明名称，省略 form/tree/settings', () => {
    const m = validatePluginCodeMeta({ name: '示例主题' })
    expect(m.name).toBe('示例主题')
    expect(m.form).toBeUndefined()
    expect(m.tree).toBeUndefined()
    expect(m.settings).toBeUndefined()
  })

  it('capabilities 闭枚举拒绝未知值', () => {
    expect(() => validatePluginCodeMeta({ ...meta, capabilities: ['stealData'] })).toThrow()
  })

  it('form 字段类型闭枚举拒绝未知值', () => {
    expect(() => validatePluginCodeMeta({
      ...meta,
      form: { fields: [{ key: 'x', type: 'rich-text', label: 'x' }] }
    })).toThrow()
  })

  it('nodeType creatable 空数组是矛盾信号（拒绝）', () => {
    expect(() => validatePluginCodeMeta({
      ...meta,
      tree: { nodeTypes: [{ id: 't', icon: 'x', creatable: [] }] }
    })).toThrow()
  })

  it('settings 条目 key 格式与八类型校验', () => {
    expect(() => validatePluginCodeMeta({
      ...meta,
      settings: { groups: [{ id: 'g', label: 'G', entries: [{ key: 'bad key', type: 'string', label: 'x' }] }] }
    })).toThrow()
    const m = validatePluginCodeMeta({
      ...meta,
      settings: { groups: [{ id: 'g', label: 'G', entries: [{ key: 'ok', type: 'slider', label: 'x', min: 0, max: 10 }] }] }
    })
    expect(m.settings?.groups[0]?.entries[0]?.type).toBe('slider')
  })
})
