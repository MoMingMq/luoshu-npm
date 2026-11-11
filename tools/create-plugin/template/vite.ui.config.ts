// 件 UI 构建模板（件 UI 构建模板）：拷入件根目录为 vite.ui.config.ts，把 PLUGIN_ID
// 改为本件 id 即用。机制平移自壳件 plugins/luoshu-shell/vite.ui.config.ts（构建工具
// 机制非业务逻辑，允许平移；rolldown 实证注释一并带过来）：
// ① SFC 编译 + lib 单入口 ES 产物（web/ui/index.js，经 luoshu-plugin:// 动态加载）；
// ② vue/naive-ui 重写到件内共享垫片（ui/shims——运行时取宿主 window.__luoshuHostDeps
//    单例，双实例防线：宿主 host-deps.ts 注入，件永不自捆 vue/naive）；
// ③ cssInject：分离样式在动态 import 下会静默丢失，产物 CSS 并回 index.js 尾部
//    （自注入 <style> 代码，属性标记幂等）；
// ④ process.env.NODE_ENV 显式替换：lib 模式下 vite 8 不替换依赖内该引用，渲染
//    进程无 process 全局，不替换即 ReferenceError。
import { appendFileSync, readdirSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'

/** 本件 id（cssInject 幂等标记用）——脚手架生成时替换为真实插件 id */
const PLUGIN_ID = 'luoshu-plugin-template'

/**
 * 产物 CSS 并回入口 chunk（rolldown 不回写 generateBundle 的 chunk.code——按
 * 文件系统后处理）：读出 web/ui 下全部 .css → 拼自注入 <style> 代码 → 追加到
 * index.js 尾部 → 删 .css 文件。
 */
function cssInject(pluginId: string): Plugin {
  const outDir = fileURLToPath(new URL('./web/ui', import.meta.url))
  return {
    name: 'luoshu-ui-css-inject',
    writeBundle() {
      const cssFiles = readdirSync(outDir).filter((f) => f.endsWith('.css'))
      if (cssFiles.length === 0) return
      let css = ''
      for (const f of cssFiles) {
        css += readFileSync(join(outDir, f), 'utf8')
        unlinkSync(join(outDir, f))
      }
      const inject = `;(function(){var a=${JSON.stringify('data-luoshu-plugin-css')},v=${JSON.stringify(pluginId)};`
        + `if(document.querySelector('style['+a+'="'+v+'"]'))return;`
        + `var s=document.createElement('style');s.setAttribute(a,v);`
        + `s.textContent=${JSON.stringify(css)};document.head.appendChild(s)})();\n`
      appendFileSync(join(outDir, 'index.js'), inject)
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [vue(), cssInject(PLUGIN_ID)],
  define: {
    // dev 钩子产物（--mode development）供 e2e 用；默认 production
    'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
  },
  resolve: {
    alias: {
      // 件永不自捆共享库：vue/naive-ui/vxe-table 一律重写到件内垫片（运行时取宿主
      // globalThis.__luoshuHostDeps 单例，双实例防线）。Monaco 不走 alias——件内经
      // ./ui/shims/monaco.ts 显式取宿主 loader（monaco-editor 仅 type-only import）。
      // 无网格/编辑器需求的件可删去未用的 alias 与 shims 文件。
      vue: fileURLToPath(new URL('./ui/shims/vue.ts', import.meta.url)),
      'naive-ui': fileURLToPath(new URL('./ui/shims/naive.ts', import.meta.url)),
      'vxe-table': fileURLToPath(new URL('./ui/shims/vxe.ts', import.meta.url)),
    },
  },
  build: {
    lib: { entry: fileURLToPath(new URL('./ui/index.ts', import.meta.url)), formats: ['es'], fileName: () => 'index.js' },
    outDir: 'web/ui',
    emptyOutDir: true,
    target: 'es2022',
  },
}))
