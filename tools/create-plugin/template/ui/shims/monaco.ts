// monaco 宿主共享垫片（件模板）：件内经相对路径 import 本文件（不经 vite alias——
// Monaco 不是组件库，件只消费 loader 一个入口）。loader 与 worker inline 引导均宿主
// 持有（apps/desktop/src/renderer/host-deps.ts，机制平移自 v1
// apps/desktop/src/renderer/shell/plugin-ui-shared.ts:37-66）：件侧无法复现 vite
// ?worker 语法，Monaco 单例必须宿主侧唯一。用法：
//   const monaco = await monacoLoader()   // 命名空间（懒执行缓存，全应用一次）
//   monaco.editor.create(el, { language: 'sql', theme: 'luoshu-dark' })
// monaco-editor 只作 type-only 依赖：使用件需在自身 devDependencies 加
// monaco-editor（^0.57.0，仅类型；构建期类型导入被擦除，运行时不打包——宿主单例）。
// 类型面不在此 re-export：件内直接 `import type * as MonacoNs from 'monaco-editor'`。
type MonacoModule = typeof import('monaco-editor')

export type { MonacoModule }

export function monacoLoader(): Promise<MonacoModule> {
  return (
    globalThis as unknown as {
      __luoshuHostDeps: { monacoLoader: () => Promise<MonacoModule> }
    }
  ).__luoshuHostDeps.monacoLoader()
}
