// d.ts 说明符重写后处理（T1 发布链）：rewriteRelativeImportExtensions 只重写
// JS emit——dist/*.d.ts 的相对 .ts 说明符保留原样（TS 5.8.3 实测），发布后
// 消费方 tsc 解析 ./xxx.ts 声明会失败。本脚本把 dist 内 .d.ts 的相对 .ts
// 导入/导出说明符统一改写为 .js（幂等：.js' 形态不再命中）。
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const dir = path.join(__dirname, '..', 'dist')
if (!fs.existsSync(dir)) {
  console.error('[fix-dts] dist 不存在（先 tsc -p tsconfig.build.json）')
  process.exit(1)
}
let touched = 0
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.d.ts')) continue
  const p = path.join(dir, f)
  const before = fs.readFileSync(p, 'utf8')
  // 仅命中相对说明符结尾的 .ts（from '...' / import('...') 两种引号形态）
  const after = before.replace(/(\.\.?\/[A-Za-z0-9._/-]+)\.ts(['"])/g, '$1.js$2')
  if (after !== before) {
    fs.writeFileSync(p, after)
    touched += 1
    console.log(`[fix-dts] ${f}: .ts 说明符 → .js`)
  }
}
console.log(`[fix-dts] 完成（改写 ${touched} 个声明文件）`)
