# @luoshu-official/plugin-market-index

洛书（Luoshu）插件市场索引的格式定义与校验器——无运行时依赖的纯函数规则集。

索引是一份 JSON 文件（format 1），列出可安装的 npm 插件包及其展示元数据；索引与包体分离，包体始终从 npm 安装。生成器产出索引后用本包校验，宿主展示前同样校验，第三方索引作者也可引入自检。

## 索引格式（format 1）

```json
{
  "format": 1,
  "title": "洛书插件市场",
  "description": "可选的索引描述",
  "plugins": [
    {
      "name": "luoshu-plugin-example",
      "title": "示例插件",
      "description": "一句话描述",
      "icon": "https://…/icon.png",
      "author": "作者",
      "homepage": "https://…",
      "repository": "https://…",
      "keywords": ["luoshu-plugin"],
      "category": "工具",
      "dist-tags": { "latest": "1.0.0" },
      "versions": [
        { "version": "1.0.0", "publishTimestamp": 1700000000, "engines": { "luoshu": ">=0.3.0" } }
      ]
    }
  ]
}
```

校验语义：失败抛 `MarketIndexError`（携带 JSON path 与原因）；成功返回规范化结果——versions 按 semver 降序、相对 icon 补全为绝对 URL、丢弃格式外成员。

## API

```ts
import {
  MarketIndexError, parseMarketIndex, semverCompare, marketInstallTarget,
  indexSourceUrlError, normalizeIndexSources, indexSourceAddError, effectiveIndexSource,
} from '@luoshu-official/plugin-market-index'

// 索引文档校验与规范化
parseMarketIndex(value, indexUrl)

// 索引源（多源配置）规则：URL 合法性 / 归一化去重 / 新增校验 / 有效源选择
indexSourceUrlError(url)
normalizeIndexSources(raw)
indexSourceAddError(url, existing, deploymentUrl?)
effectiveIndexSource({ deploymentUrl, sources, activeUrl })
```

## 安装

```bash
npm install @luoshu-official/plugin-market-index
```

## License

Apache-2.0
