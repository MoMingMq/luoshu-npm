// 渲染侧入口（package.json luoshu.ui）：注册一个工作台页签 + 一个可配置快捷键。
// 槽位贡献随插件卸载自动坍塌（cordis 可逆效应）；vue/naive 经 ui/shims 取宿主单例。
import type { Component } from 'vue'
import { Puzzle } from '@vicons/tabler'
import TemplateView from './TemplateView.vue'

interface UiLike {
  tab(c: { kind: string; title: string; icon?: string; component: Component; connectionBound?: boolean }): () => void
  /** 工作区路由贡献（Phase 2）：新 kind 的活动栏/欢迎卡/设置分类/建连入口来源 */
  workspaceRoute(c: {
    id: string
    title: string
    icon?: Component
    kinds: string[]
    tabKind?: string
    connectKind?: string
    order?: number
    welcome?: boolean
    openConnection?: (conn: { connId: string; pluginId: string }) => void
  }): () => void
  /** 对象视图贡献（第九缝）：数据工作台对象页签槽——db:open view=<id> 打开 */
  objectView(c: { id: string; title: string; component: Component; order?: number }): () => void
}

interface ShortcutRegistrar {
  register(reg: {
    id: string
    pluginId: string
    title: string
    defaultKey: string
    when?: string
    scoped?: boolean
    handler: () => void | boolean
  }): unknown
  unregisterBySource(pluginId: string): void
}

interface UiContext {
  ui: UiLike
  shortcuts?: ShortcutRegistrar
  effect?: (fn: () => () => void) => unknown
}

const plugin = {
  name: 'luoshu-plugin-template',
  inject: ['ui', 'shortcuts'],
  apply(ctx: UiContext): void {
    ctx.ui.tab({ kind: 'template-demo', title: '示例', component: TemplateView })
    // 工作区路由：模板件自带 kind='demo'（package.json luoshu.kind），故自身即成员；
    // 安装后活动栏/欢迎页卡/设置分类自动出现，无需改壳。第三方新类别照此声明。
    ctx.ui.workspaceRoute({
      id: 'template-demo',
      title: '示例',
      icon: Puzzle,
      kinds: ['demo'],
      tabKind: 'template-demo',
      order: 5,
    })

    // 对象视图贡献（第九缝）：数据工作台对象页签槽——db:open view='template-object'
    // 打开（TemplateView 内「打开对象视图页签」按钮演示）；页签标题=声明 title
    // （Phase 2.5 标题派生：deriveTitle 查槽声明表）
    ctx.ui.objectView({ id: 'template-object', title: '示例视图', component: TemplateView })

    const shortcuts = ctx.shortcuts
    if (shortcuts) {
      shortcuts.register({
        id: 'template.demo',
        pluginId: 'luoshu-plugin-template',
        title: '示例：调用宿主服务',
        defaultKey: 'Mod+Shift+D',
        scoped: true,
        handler: () => {
          window.dispatchEvent(new CustomEvent('luoshu-demo:ping'))
          return true
        },
      })
      ctx.effect?.(() => () => shortcuts.unregisterBySource('luoshu-plugin-template'))
    }
  },
}

export default plugin
