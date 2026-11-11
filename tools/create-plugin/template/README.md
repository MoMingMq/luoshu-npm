# 洛书插件模板

一个可运行的最小插件：宿主服务缝 + 工作台页签 + 代码元数据设置项 + 可配置快捷键。

## 结构

```
package.json        # name/main/luoshu（provides/tier/ui/kind）；只放装载/分类字段
src/meta.ts         # 代码元数据：name/description/publisher/settings（宿主启动上报 Main）
src/index.ts        # 宿主侧：ctx.provide('demo') + commands；export { meta }
src/index.test.ts   # 服务缝/命令形状单测
ui/index.ts         # 渲染侧：ctx.ui.tab + ctx.shortcuts.register
ui/TemplateView.vue # 页签组件：调用 demo@<插件 id> 服务
vite.ui.config.ts   # UI 构建（vue/naive 重写到 ui/shims）
ui/shims/           # 宿主 Vue/Naive 单例垫片
```

package.json 不是新的 manifest：`luoshu` 只保留装载/分类字段（provides/tier/ui/kind/kindLabel/market）；
表单、树、能力、设置、展示名都在插件代码里（`src/meta.ts` 或 `ctx.ui.*`）。

## 从模板创建

在仓库根运行：

```bash
pnpm create:plugin my-plugin --title "我的插件"
```

脚本会复制本目录到 `plugins/my-plugin` 并替换插件 id、页签 kind、事件名与显示名。
随后：

```bash
pnpm install
pnpm --filter my-plugin build:ui
pnpm --filter my-plugin test
```

## 安装到洛书

- 开发态：把 `plugins/my-plugin` 放在内置根（仓库 `plugins/`）后重启应用；
- 分发：`npm publish`（`keywords: ["luoshu-plugin"]` + `engines.luoshu` 门禁声明），应用「插件市场」按洛书 format 1 索引发现安装
  产出 `.lpkg`，在市场页「安装插件」选择它即可。

## 约定

- 宿主侧不 import 洛书运行时包；服务缝用 `ctx.provide(name, impl)` 注册。
- 渲染侧 `vue`/`naive-ui` 必须走 `ui/shims`，不能自捆（双实例会断响应式）。
- 用户可见文案不放内部任务编号；设置项用 manifest `settings.groups` 声明。
