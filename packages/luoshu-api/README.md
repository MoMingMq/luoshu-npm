# @luoshu-official/luoshu-api

洛书（Luoshu）插件 API——开发洛书插件所需的类型定义与代码元数据/provider 契约校验。2.2.0 与宿主 2.x 插件契约对齐，新增长任务电源缝（`PowerSeam` / `withPower` / `withPowerStream`），并保留对象详情批量统计（可选 `listObjectDetails` + `ObjectDetailRow`）、无主键表行编辑定位（NULL 落 IS NULL）、排序表达式、表注释与行编辑事务选项。

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

## 长任务电源缝

宿主插件可用 `ctx.reflect.get('power')` 取得 `PowerSeam`，在长任务期间申请阻止系统挂起的票据；UI 插件使用 `window.luoshuBridge.powerAcquire/powerRelease`。优先使用 `withPower` / `withPowerStream` 包装，确保结束、异常与取消都释放票据。

```ts
import { withPower, type PowerSeam } from '@luoshu-official/luoshu-api'

const power = ctx.reflect.get('power') as PowerSeam | undefined
await withPower(power, '执行长任务', () => runLongTask())
```

票据默认 4 小时租约；`withPower` 在申请失败时按不阻止睡眠降级，任务照常执行。宿主组退出、渲染进程崩溃与应用退出时，洛书主程序按票据归属兜底清理。

## License

Apache-2.0