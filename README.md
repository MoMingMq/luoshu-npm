# 洛书 Luoshu — 官方 npm 包

洛书（[Luoshu](https://luoshu.mmingq.com)）的官方 npm 包发布源。洛书主程序源码暂未公开；本仓公开维护其 npm 分发物，供第三方插件开发者使用与审计。

| 包 | 说明 | 版本 |
|---|---|---|
| [`@luoshu-official/plugin-market-index`](./packages/plugin-market-index) | 插件市场索引格式 1 校验器——生成器产出后自检、宿主读取前校验、第三方索引作者自检 | ![npm](https://img.shields.io/npm/v/@luoshu-official/plugin-market-index) |
| [`@luoshu-official/create-plugin`](./tools/create-plugin) | 插件脚手架——`npm create @luoshu-official/plugin` 一条命令生成可运行的插件项目 | ![npm](https://img.shields.io/npm/v/@luoshu-official/create-plugin) |

## 快速开始

**起步开发一个洛书插件**（不需要克隆任何洛书仓库）：

```bash
npm create @luoshu-official/plugin@latest my-plugin -- --title "我的插件"
cd my-plugin
npm install
npm run build:ui
```

装入洛书：应用内「设置 → 插件 → 从目录安装（开发）」填本目录绝对路径（`link:` 软链，改码即生效）。完整文档：[插件开发](https://luoshu.mmingq.com/plugin-dev/)。

**校验插件市场索引**（自建索引源 / 索引生成脚本）：

```bash
npm install @luoshu-official/plugin-market-index
```

```ts
import { parseMarketIndex } from '@luoshu-official/plugin-market-index'

const normalized = parseMarketIndex(doc, 'https://your.domain/index.json') // 失败抛 MarketIndexError
```

## 发布

流水线（`.github/workflows/publish.yml`）：`npm-v*` tag 或手动触发 → 各包独立测试/构建 → npm publish（带 provenance）。所有包 Apache-2.0。
