// 模板完整性校验（公开发布仓）：template/ 随本仓分发（真源=本仓 tools/create-plugin/
// template）；主仓开发态的「仓内 _template → template/」同步语义由主仓发布流程在
// 推送前完成，这里只做完整性校验（关键文件在场即可发布）。
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const dest = path.join(__dirname, '..', 'template')

const REQUIRED = [
  'package.json',
  'src/index.ts',
  'src/meta.ts',
  'src/index.test.ts',
  'ui/index.ts',
  'ui/TemplateView.vue',
  'ui/shims/vue.ts',
  'ui/shims/naive.ts',
  'vite.ui.config.ts',
]

const missing = REQUIRED.filter((rel) => !fs.existsSync(path.join(dest, rel)))
if (missing.length > 0) {
  console.error('[sync-template] template/ 缺关键文件：' + missing.join(', '))
  process.exit(1)
}
console.log('[sync-template] template/ 完整性通过（' + REQUIRED.length + ' 个关键文件在场）')
