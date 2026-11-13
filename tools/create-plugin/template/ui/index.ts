// 渲染侧入口（package.json luoshu.ui）：注册一个工作台页签 + 一个可配置快捷键。
// 槽位贡献随插件卸载自动坍塌（cordis 可逆效应）；vue/naive 经 ui/shims 取宿主单例。
import type { Component } from 'vue'
import { Puzzle } from '@vicons/tabler'
import TemplateView from './TemplateView.vue'

interface UiLike {
  tab(c: { kind: string; title: string; icon?: string; component: Component; connectionBound?: boolean }): () => void
  /** 工作区路由贡献：新 kind 的活动栏/欢迎卡/设置分类/建连入口来源 */
  workspaceRoute(c: {
    /** 唯一标识 */
    id: string
    /** 标题 */
    title: string
    /** 图标 */
    icon?: Component
    /** 成员 kind 集合 */
    kinds: string[]
    /** 主区页签 kind */
    tabKind?: string
    /** 建连 kind */
    connectKind?: string
    /** 排序序号 */
    order?: number
    /** 欢迎卡声明 */
    welcome?: boolean
    /** 打开连接回调 */
    openConnection?: (conn: { connId: string; pluginId: string }) => void
  }): () => void
  /** 对象视图贡献（object-view 槽）：数据工作台对象页签槽——db:open view=<id> 打开 */
  objectView(c: { id: string; title: string; icon?: Component; component: Component; order?: number }): () => void
  /** 插件设置自定义 tab 贡献（settings-plugin-tab 槽）：插件分组内出自定义配置 tab */
  settingsPluginTab(c: { id: string; label: string; component: Component }): () => void
  /** 欢迎页学习卡贡献（learn-card 槽）：url 外链或 action='feedback' 应用内动作 */
  learnCard(c: { id: string; order?: number; label: string; desc: string; url?: string; action?: 'feedback' }): () => void
}

interface ShortcutRegistrar {
  register(reg: {
    /** 唯一标识 */
    id: string
    /** 所属插件 id */
    pluginId: string
    /** 标题 */
    title: string
    /** 默认值键名 */
    defaultKey: string
    /** when 字段 */
    when?: string
    /** scoped 字段 */
    scoped?: boolean
    /** handler 字段 */
    handler: () => void | boolean
  }): unknown
  unregisterBySource(pluginId: string): void
}

interface UiContext {
  /** ui 字段 */
  ui: UiLike
  /** shortcuts 字段 */
  shortcuts?: ShortcutRegistrar
  /** effect 字段 */
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

    // 对象视图贡献（object-view 槽）：数据工作台对象页签槽——db:open view='template-object'
    // 打开（TemplateView 内「打开对象视图页签」按钮演示）；页签标题=声明 title
    ctx.ui.objectView({ id: 'template-object', title: '示例视图', component: TemplateView })

    // 插件设置自定义 tab（settings-plugin-tab 槽）：设置 → 插件 → 本插件分组内出现
    // 「示例面板」tab，与声明式 meta.settings 表单（「配置」tab）并排——复杂配置 UI
    // 走本缝自绘，简单键值走声明式，双轨共存。id 必须以 `<插件 id>:` 开头。
    ctx.ui.settingsPluginTab({ id: 'luoshu-plugin-template:panel', label: '示例面板', component: TemplateView })

    // 欢迎页学习卡（learn-card 槽）：欢迎页「学习与生态」区出现本卡；
    // url 外链与 action:'feedback' 应用内动作二选一。
    ctx.ui.learnCard({
      id: 'template-guide',
      order: 15,
      label: '插件开发指南',
      desc: '从模板到上架：服务缝、UI 缝与打包',
      url: 'https://luoshu.mmingq.com/plugin-dev/',
    })

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
