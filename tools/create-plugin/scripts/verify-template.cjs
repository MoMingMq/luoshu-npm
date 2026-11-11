// 模板机械门禁（发布前）：生成 → npm install + 构建 + 测试全链真跑（与仓内
// verify-plugin-quickstart 同门槛，但以随包 template/ 为对象——验证的是用户实际
// 拿到的东西）。
'use strict'
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const here = __dirname
const bin = path.join(here, '..', 'bin.mjs')
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'create-luoshu-plugin-'))
const startedAt = Date.now()

function run(label, command, args, opts = {}) {
  console.log(`[verify] ${label}: ${command} ${args.join(' ')}`)
  const r = spawnSync(command, args, {
    cwd: opts.cwd ?? scratch,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    encoding: 'utf8',
  })
  if (r.status !== 0) {
    console.error(`[verify] 失败：${label}（exit=${r.status}）`)
    process.exit(1)
  }
}

run('脚手架生成（含 --title）', process.execPath, [bin, 'my-demo', '--title', '示例插件', '--out', 'my-demo'])
const pkg = JSON.parse(fs.readFileSync(path.join(scratch, 'my-demo', 'package.json'), 'utf8'))
if (pkg.name !== 'my-demo') { console.error('[verify] 包名替换失败'); process.exit(1) }
if (String(pkg.description).includes('示例插件') === false) { console.error('[verify] 描述替换失败'); process.exit(1) }
console.log('[verify] 包名/描述替换通过')

run('npm install', 'npm', ['install', '--no-audit', '--no-fund'], { cwd: path.join(scratch, 'my-demo') })
run('build:ui', 'npm', ['run', 'build:ui'], { cwd: path.join(scratch, 'my-demo') })
run('test', 'npm', ['test'], { cwd: path.join(scratch, 'my-demo') })

const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
console.log(`[verify] 通过（${elapsed}s）——随包模板全链可用`)
