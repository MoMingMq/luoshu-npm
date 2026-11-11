#!/usr/bin/env node
// 洛书插件脚手架：npm create @luoshu-official/plugin my-plugin
// 从随包分发的模板目录生成可运行插件项目（生成逻辑与洛书仓 scripts/create-plugin.mjs 同语义）。

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const templateDir = join(here, 'template')

function fail(message) {
  console.error(`[create-luoshu-plugin] ${message}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const positional = []
let title = ''
let outDir = ''
let force = false
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--title') { title = args[++i] ?? ''; continue }
  if (arg === '--out') { outDir = args[++i] ?? ''; continue }
  if (arg === '--force') { force = true; continue }
  if (arg.startsWith('--')) fail(`未知参数 ${arg}`)
  positional.push(arg)
}

const name = positional[0]
if (!name) fail('缺少插件名。用法：npm create @luoshu-official/plugin my-plugin -- --title "我的插件"')
if (!/^[a-z][a-z0-9-]*$/.test(name)) fail('插件名只能是小写字母开头的 a-z、0-9、-（与插件 id 规则一致）')
if (!existsSync(templateDir)) fail('模板目录缺失（安装不完整——重装本包）')

const target = resolve(process.cwd(), outDir || name)
if (existsSync(target) && readdirSync(target).length > 0 && !force) {
  fail(`目标目录非空：${target}（确认覆盖请加 --force）`)
}
if (existsSync(target) && force) rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
cpSync(templateDir, target, {
  recursive: true,
  filter: (src) => {
    const rel = src.slice(templateDir.length + 1).split('\\').join('/')
    return !rel.startsWith('node_modules') && !rel.startsWith('web')
  },
})

const displayTitle = title.trim() || name

// 包名/展示名替换：package.json name（去 private——发布形态）、宿主入口 name、README
const pkgPath = join(target, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
pkg.name = name
pkg.description = `${displayTitle}——洛书插件`
delete pkg.private
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

const hostPath = join(target, 'src', 'index.ts')
writeFileSync(hostPath, readFileSync(hostPath, 'utf8').replaceAll('luoshu-plugin-template', name))
const readmePath = join(target, 'README.md')
writeFileSync(readmePath, readFileSync(readmePath, 'utf8').replaceAll('luoshu-plugin-template', name).replaceAll('示例插件', displayTitle))

console.log(`[create-luoshu-plugin] 已生成 ${displayTitle}（${name}）`)
console.log('')
console.log('下一步：')
console.log(`  cd ${outDir || name}`)
console.log('  npm install')
console.log('  npm run build:ui   # 构建渲染侧产物（web/ui/index.js）')
console.log('  npm test           # 模板自带契约测试')
console.log('')
console.log('装入洛书：应用内「设置 → 插件 → 从目录安装（开发）」填本目录绝对路径（link: 软链），')
console.log('或发布到 npm（keywords 带 luoshu-plugin）由插件市场收录。')
console.log('开发文档：https://luoshu.mmingq.com/plugin-dev/')
