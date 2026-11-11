# @luoshu-official/luoshu-api

洛书（Luoshu）插件 API——开发洛书插件所需的类型定义与 manifest/provider 契约校验。版本与宿主主程序对齐（宿主 2.0.0 ↔ SDK 2.0.0）。

## 安装

```bash
npm install @luoshu-official/luoshu-api
```

## 用法

```ts
// 数据源插件工厂（表单/能力/Provider 包装为 cordis 插件对象）
import { defineDataSource } from '@luoshu-official/luoshu-api'

// meta 校验（zod schema：未知字段透传不拒绝）
import { validatePluginCodeMeta } from '@luoshu-official/luoshu-api'

// 契约测试（需要项目内安装 vitest）
import { describeV2Plugin } from '@luoshu-official/luoshu-api/testing'
```

完整 API 见文档站：https://luoshu.mmingq.com/plugin-dev/

## License

Apache-2.0
