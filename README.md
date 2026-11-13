# 洛书 Luoshu — 官方 npm 包

洛书（[Luoshu](https://luoshu.mmingq.com)）的官方 npm 包发布源。洛书主程序源码暂未公开；本仓公开维护其 npm 分发物，供第三方插件开发者使用与审计。

| 包 | 说明 | 版本 |
|---|---|---|
| [`@luoshu-official/luoshu-api`](./packages/luoshu-api) | 插件 API SDK——类型定义、代码元数据校验、数据源工厂、方言/行编辑共享核与契约测试 | ![npm](https://img.shields.io/npm/v/@luoshu-official/luoshu-api) |
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

**安装插件 API SDK**（数据源类型、契约测试与方言工具）：

```bash
npm install @luoshu-official/luoshu-api
```

**校验插件市场索引**（自建索引源 / 索引生成脚本）：

```bash
npm install @luoshu-official/plugin-market-index
```

```ts
import { parseMarketIndex } from '@luoshu-official/plugin-market-index'

const normalized = parseMarketIndex(doc, 'https://your.domain/index.json') // 失败抛 MarketIndexError
```

## 官方索引生成

官方插件索引（`https://luoshucosgz.mmingq.com/market/npm/index.json`）由本仓的生成器维护：

```bash
node scripts/build-market-index-npm.mjs --out index.json
# 产出经 @luoshu-official/plugin-market-index 校验器自检（坏索引不出门）
```

按 `keywords:luoshu-plugin` 从 npm 聚合全部插件包；插件作者发布后重跑本脚本并更新静态托管即可被市场收录。

## 发布

流水线（`.github/workflows/publish.yml`）：`npm-v*` tag 或手动触发 → 各包独立测试/构建 → npm publish（带 provenance）。所有包 Apache-2.0。
