// 发布前把 publishConfig.exports 写回 package.json.exports（npm CLI 无 pnpm 的
// publishConfig 重写特性——发布面与开发面（exports 指 src）在此分离：
// 本脚本跑在 CI 发布步，本地开发不受影响）。幂等：已是 dist 形态则跳过。
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const pkgPath = path.join(__dirname, '..', 'packages', 'plugin-market-index', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const distExports = pkg.publishConfig?.exports
if (distExports === undefined) {
  console.log('[inject-exports] 无 publishConfig.exports——跳过')
  process.exit(0)
}
if (JSON.stringify(pkg.exports) === JSON.stringify(distExports)) {
  console.log('[inject-exports] exports 已是 dist 形态——跳过')
  process.exit(0)
}
pkg.exports = distExports
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log('[inject-exports] exports → dist（发布态）')
