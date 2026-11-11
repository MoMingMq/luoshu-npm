// vxe-table 宿主共享垫片（件模板）：件 vite.ui.config.ts 的 alias 把 'vxe-table'
// 重写到本文件——网格组件的 { VxeTable, VxeColumn } 从宿主单实例读出（
// globalThis.__luoshuHostDeps.vxe，apps/desktop/src/renderer/host-deps.ts 注入；
// 机制平移自 v1 plugins/luoshu-datastudio/ui/shims/vxe.ts 的 window.__luoshu.libs.vxe）。
// vxe 基础样式与主题由宿主共享面装载（件侧不副作用 import）。vxe 编辑器不用于单元格
// 编辑（编辑自绘 input/select），shim 面仅两组件；件内用到其余 vxe 组件时往本清单补。
import type { Component } from 'vue'

const VXE = (
  globalThis as unknown as {
    __luoshuHostDeps: { vxe: { VxeTable: Component; VxeColumn: Component } }
  }
).__luoshuHostDeps.vxe

export const { VxeTable, VxeColumn } = VXE
