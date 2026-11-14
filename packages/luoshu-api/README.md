# @luoshu-official/luoshu-api

洛书（Luoshu）插件 API——开发洛书插件所需的类型定义与代码元数据/provider 契约校验。2.1.0 与宿主 2.x 插件契约对齐，增补对象详情批量统计（可选 `listObjectDetails` + `ObjectDetailRow`）、无主键表行编辑定位（NULL 落 IS NULL）、排序表达式、表注释与行编辑事务选项。

## 安装

```bash
npm install @luoshu-official/luoshu-api
```

## 用法

```ts
// 数据源插件工厂（表单/能力/Provider 包装为 cordis 插件对象）
import { defineDataSource } from '@luoshu-official/luoshu-api'

// 代码元数据校验（zod schema：未知字段透传不拒绝）
import { validatePluginCodeMeta } from '@luoshu-official/luoshu-api'

// SQL 方言工具：引号/占位符 + nodeQuery 排序表达式解析
import { quoteIdentifier, quoteTableRef, placeholderOf, parseOrderBy } from '@luoshu-official/luoshu-api'

// 网格行编辑共享核（逐行/整批事务）
import { buildEditStatement, applyRowEditsViaQuery, applyRowEditsTransactional } from '@luoshu-official/luoshu-api'

// 契约测试（需要项目内安装 vitest）
import { describeV2Plugin } from '@luoshu-official/luoshu-api/testing'
```

`SchemaInfo.comment` 为表级注释可选字段；`TablePage.orderBy` 支持逗号分隔的「列 [ASC|DESC]」排序表达式，配合 `parseOrderBy` 逐段生成方言 ORDER BY。完整 API 见文档站：https://luoshu.mmingq.com/plugin-dev/

## License

Apache-2.0