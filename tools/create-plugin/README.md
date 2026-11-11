# @luoshu-official/create-plugin

洛书（Luoshu）插件脚手架——一条命令生成可运行的插件项目。

## 用法

```bash
npm create @luoshu-official/plugin@latest my-plugin -- --title "我的插件"
```

生成后按提示：

```bash
cd my-plugin
npm install
npm run build:ui   # 构建渲染侧产物
npm test           # 模板自带契约测试
```

## 装入洛书

- **开发态**：应用内「设置 → 插件 → 从目录安装（开发）」填本目录绝对路径——以 `link:` 软链接入，改码 + `build:ui` 后重开插件页签即生效
- **分发**：`npm publish`（`keywords` 带 `luoshu-plugin`），用户在「插件市场」发现安装

## 文档

https://luoshu.mmingq.com/plugin-dev/

## License

Apache-2.0
