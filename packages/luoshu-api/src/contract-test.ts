import { describe, it, expect } from 'vitest'
import type { DataSourceProvider, TerminalProvider } from './provider.ts'
import type { SqlDialect, TreeNodeRef } from './types.ts'

/** v2 插件形态（只依赖 name/inject/apply，不 import cordis 运行时） */
export interface V2PluginLike {
  /** 名称 */
  name?: string
  /** 依赖缝清单 */
  inject?: readonly string[]
  /** 装载入口 */
  apply?: (ctx: unknown) => unknown
}

/** 契约捕获面：插件 apply 期间对宿主能力的所有可见副作用 */
export interface V2ContractCapture {
  /** 服务缝清单 */
  provides: Map<string, unknown>
  /** tabs 字段 */
  tabs: string[]
  /** sidebarsections */
  sidebarSections: string[]
  /** panels 字段 */
  panels: string[]
  /** statusbar毫秒 */
  statusbarItems: string[]
  /** menus 字段 */
  menus: string[]
  /** 设置分组声明 */
  settings: string[]
  /** commands 字段 */
  commands: string[]
  /** shortcuts 字段 */
  shortcuts: string[]
  /** effects 字段 */
  effects: Array<() => unknown>
}

/** 期望贡献面：声明了就必须在 apply 期间出现；未声明不检查 */
export interface V2ContractExpectations {
  /** 服务缝清单 */
  provides?: readonly string[]
  /** tabs 字段 */
  tabs?: readonly string[]
  /** sidebarsections */
  sidebarSections?: readonly string[]
  /** panels 字段 */
  panels?: readonly string[]
  /** statusbar条目集 */
  statusbarItems?: readonly string[]
  /** menus 字段 */
  menus?: readonly string[]
  /** 设置分组声明 */
  settings?: readonly string[]
  /** commands 字段 */
  commands?: readonly string[]
  /** shortcuts 字段 */
  shortcuts?: readonly string[]
}

/** 纯假 Context：覆盖 v2 插件 apply 的公共面；不依赖 cordis 运行时。 */
export function createV2ContractContext(): { ctx: Record<string, unknown>; capture: V2ContractCapture } {
  const capture: V2ContractCapture = {
    provides: new Map(),
    tabs: [],
    sidebarSections: [],
    panels: [],
    statusbarItems: [],
    menus: [],
    settings: [],
    commands: [],
    shortcuts: [],
    effects: [],
  }
  const add = (list: string[], id: string): (() => void) => {
    list.push(id)
    return () => {
      const i = list.indexOf(id)
      if (i >= 0) list.splice(i, 1)
    }
  }
  const effect = (fn: () => unknown): (() => void) => {
    const d = fn()
    const disposer = typeof d === 'function' ? (d as () => unknown) : () => {}
    capture.effects.push(disposer)
    return disposer
  }
  const ui = {
    tab: (c: { kind: string }) => add(capture.tabs, c.kind),
    sidebarSection: (c: { id: string }) => add(capture.sidebarSections, c.id),
    panel: (c: { id: string }) => add(capture.panels, c.id),
    statusbarItem: (c: { id: string }) => add(capture.statusbarItems, c.id),
    menu: (c: { id: string }) => add(capture.menus, c.id),
    settings: (c: { group: string; entry: { key: string } }) => add(capture.settings, `${c.group}:${c.entry.key}`),
    webview: (c: { id: string }) => add(capture.sidebarSections, `webview:${c.id}`),
  }
  const commands = {
    register: (id: string) => add(capture.commands, id),
    list: () => capture.commands.map((id) => ({ id })),
  }
  const shortcuts = {
    register: (reg: { id: string }) => add(capture.shortcuts, reg.id),
    unregisterBySource: () => {},
  }
  const ctx: Record<string, unknown> = {
    provide: (name: string, impl: unknown) => { capture.provides.set(name, impl) },
    effect,
    plugin: (p: V2PluginLike, config?: unknown) => {
      if (typeof p.apply === 'function') return p.apply({ ...ctx, config })
      return undefined
    },
    log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    storage: { get: async () => undefined, set: async () => {} },
    seams: {
      provide: (id: string, impl: unknown) => capture.provides.set(`seam:${id}`, impl),
      get: () => undefined,
      getRequired: () => { throw new Error('seam missing') },
    },
    ui,
    tab: ui.tab,
    sidebarSection: ui.sidebarSection,
    panel: ui.panel,
    statusbarItem: ui.statusbarItem,
    menu: ui.menu,
    uiSettings: ui.settings,
    webview: ui.webview,
    commands,
    registerCommand: commands.register,
    registerView: (view: { id: string }) => add(capture.sidebarSections, `view:${view.id}`),
    shortcuts,
    reflect: { get: () => undefined },
    on: () => () => {},
    emit: () => {},
  }
  return { ctx, capture }
}

/**
 * v2 插件契约：name/apply 存在 + 声明的服务缝/槽位/设置/命令/快捷键
 * 在 apply 期间真实登记。用法（插件自己的 vitest）：
 *
 * import { describeV2Plugin } from 'luoshu-api/testing'
 * describeV2Plugin('my-plugin', plugin, { provides: ['demo'], tabs: ['my-demo'] })
 */
export function describeV2Plugin(
  name: string,
  plugin: V2PluginLike,
  expectations: V2ContractExpectations = {},
): void {
  describe(`contract-v2: ${name}`, () => {
    it('导出 name 与 apply', () => {
      expect(typeof plugin.name).toBe('string')
      expect(plugin.name).not.toBe('')
      expect(typeof plugin.apply).toBe('function')
    })

    it('apply 期间登记的贡献与声明一致', () => {
      const { ctx, capture } = createV2ContractContext()
      plugin.apply!(ctx)
      for (const seam of expectations.provides ?? []) expect(capture.provides.has(seam)).toBe(true)
      for (const id of expectations.tabs ?? []) expect(capture.tabs).toContain(id)
      for (const id of expectations.sidebarSections ?? []) expect(capture.sidebarSections).toContain(id)
      for (const id of expectations.panels ?? []) expect(capture.panels).toContain(id)
      for (const id of expectations.statusbarItems ?? []) expect(capture.statusbarItems).toContain(id)
      for (const id of expectations.menus ?? []) expect(capture.menus).toContain(id)
      for (const id of expectations.settings ?? []) expect(capture.settings).toContain(id)
      for (const id of expectations.commands ?? []) expect(capture.commands).toContain(id)
      for (const id of expectations.shortcuts ?? []) expect(capture.shortcuts).toContain(id)
    })
  })
}

/** R8 官方方言枚举（单一事实源：types.ts SqlDialect；契约断言出现值必须 ∈ 枚举） */
const SQL_DIALECTS: readonly SqlDialect[] = ['mysql', 'pg', 'oracle-like', 'sqlite', 'mssql']

/** 等待谓词为真 */
async function waitUntil(pred: () => boolean, timeoutMs = 1000): Promise<void> {
  const startAt = Date.now()
  while (!pred()) {
    if (Date.now() - startAt > timeoutMs) throw new Error('waitUntil 超时（回调未在窗口内到达）')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

export function describeProvider(name: string, makeProvider: () => Promise<DataSourceProvider>): void {
  describe(`contract: ${name}`, () => {
    it('connects and returns serverVersion', async () => {
      const p = await makeProvider()
      const info = await p.connect('test-conn', {})
      expect(typeof info.serverVersion).toBe('string')
      // R8：dialect 可选（第三方插件可不声明），声明则必须属于官方枚举
      if (info.dialect !== undefined) {
        expect(SQL_DIALECTS).toContain(info.dialect)
      }
      await p.disconnect('test-conn')
    })
    it('lists databases as {id,label}', async () => {
      const p = await makeProvider()
      await p.connect('test-conn', {})
      const dbs = await p.listDatabases()
      expect(Array.isArray(dbs)).toBe(true)
      for (const d of dbs) { expect(typeof d.id).toBe('string'); expect(typeof d.label).toBe('string') }
    })
    it('lists children then schema with columns', async () => {
      const p = await makeProvider()
      await p.connect('test-conn', {})
      const dbs = await p.listDatabases()
      const children = await p.listChildren({ databaseId: dbs[0]?.id, typeId: 'database', id: dbs[0]?.id ?? '' })
      expect(Array.isArray(children)).toBe(true)
      const first = children.find((c) => c.typeId !== undefined)
      if (first) {
        const schema = await p.getSchema({ databaseId: dbs[0]?.id, typeId: first.typeId, id: first.id })
        expect(Array.isArray(schema.columns)).toBe(true)
      }
    })
    it('listChildren without page keeps the existing contract', async () => {
      const p = await makeProvider()
      await p.connect('test-conn', {})
      const dbs = await p.listDatabases()
      const children = await p.listChildren({
        databaseId: dbs[0]?.id,
        typeId: 'database',
        id: dbs[0]?.id ?? ''
      })
      expect(Array.isArray(children)).toBe(true)
      for (const c of children) {
        expect(typeof c.typeId).toBe('string')
        expect(typeof c.id).toBe('string')
      }
    })
    it('listChildren with { limit: 1 } succeeds (paging is optional for plugins)', async () => {
      const p = await makeProvider()
      await p.connect('test-conn', {})
      const dbs = await p.listDatabases()
      // 契约只保证调用成功：不支持分页的插件可忽略 page（返回全量）
      // 支持分页的插件应按 limit 截断并在截断段末节点带 cursor（由各插件专项用例验证）。
      const children = await p.listChildren(
        { databaseId: dbs[0]?.id, typeId: 'database', id: dbs[0]?.id ?? '' },
        { limit: 1 }
      )
      expect(Array.isArray(children)).toBe(true)
    })
    it('streamQuery yields chunks ending with done', async () => {
      const p = await makeProvider()
      await p.connect('test-conn', {})
      const chunks: number[] = []
      for await (const chunk of p.streamQuery('SELECT 1', undefined, 'q1')) {
        chunks.push(chunk.rows.length)
        expect(chunk.done).toBeDefined()
      }
      expect(chunks.length).toBeGreaterThan(0)
    })
    it('nodeQuery (optional) returns dialect query text for grid view', async () => {
      const p = await makeProvider()
      await p.connect('test-conn', {})
      // R6 可选能力：未实现即静默跳过（契约不强制）；实现则校验形态。
      if (typeof p.nodeQuery !== 'function') return
      const dbs = await p.listDatabases()
      const children = await p.listChildren(
        { databaseId: dbs[0]?.id, typeId: 'database', id: dbs[0]?.id ?? '' }
      )
      const table = children.find((c) => c.typeId === 'table')
      if (!table) return
      const q = await p.nodeQuery({ typeId: table.typeId, id: table.id })
      expect(typeof q.sql).toBe('string')
      expect(q.sql.length).toBeGreaterThan(0)
      if (q.countSql !== undefined) expect(typeof q.countSql).toBe('string')
      // 不在契约层执行（首个表可能是任意大小的真表）；sql 可流式执行由各插件集成用例覆盖。
    })
    it('nodeQuery with page  still succeeds — paging is an optional enhancement', async () => {
      const p = await makeProvider()
      await p.connect('test-conn', {})
      if (typeof p.nodeQuery !== 'function') return
      const dbs = await p.listDatabases()
      const children = await p.listChildren(
        { databaseId: dbs[0]?.id, typeId: 'database', id: dbs[0]?.id ?? '' }
      )
      const table = children.find((c) => c.typeId === 'table')
      if (!table) return
      // 契约只保证带 page 调用成功（插件可忽略 page 返回不分页 SQL）；
      // 分页 SQL 形态/第二页游标正确性由各插件专项用例验证。
      const q = await p.nodeQuery({ typeId: table.typeId, id: table.id }, { limit: 1 })
      expect(typeof q.sql).toBe('string')
      expect(q.sql.length).toBeGreaterThan(0)
      if (q.params !== undefined) expect(Array.isArray(q.params)).toBe(true)
    })

    // ---- R12-R15可选方法「实现者契约」----
    // 未实现方法的探测发生在主程序侧，不在本契约层：插件宿主对 provider 上不存在的
    // 可选方法返回结构化错误 LUOSHU.METHOD_NOT_SUPPORTED（boot.cjs 按 typeof 派发
    // UI 入口随之隐藏/占位）——契约层只校验「实现了该方法的插件」的返回行为
    // （typeof 守卫 + return 静默跳过，沿 R6 nodeQuery 先例）。
    // 契约用例一律零副作用设计（空行集 / 空脚本 / 只读探针语句 / 纯回调抛错）：
    // 行级写入语义、onConflict 各库落法、拆句器边界由各插件专项用例验证
    // 首个表可能是任意约束/任意大小的真表，契约层不得真写。
    it('insertBatch (optional, R12) returns {inserted,skipped} counts and accepts onConflict', async () => {
      const p = await makeProvider()
      await p.connect('test-conn', {})
      if (typeof p.insertBatch !== 'function') return
      const dbs = await p.listDatabases()
      const children = await p.listChildren(
        { databaseId: dbs[0]?.id, typeId: 'database', id: dbs[0]?.id ?? '' }
      )
      const table = children.find((c) => c.typeId === 'table')
      if (!table) return
      const schema = await p.getSchema({ typeId: table.typeId, id: table.id })
      const columns = schema.columns.length > 0 ? schema.columns.map((c) => c.name) : []
      // 零行批（零副作用）：校验返回形态 + onConflict/batchSize 透传不报错；
      // 不变式 inserted + skipped = 入参行数（0 行 → 双零）。
      const r = await p.insertBatch(
        { typeId: table.typeId, id: table.id },
        columns,
        [],
        { onConflict: 'skip', batchSize: 100 }
      )
      expect(typeof r.inserted).toBe('number')
      expect(typeof r.skipped).toBe('number')
      expect(r.inserted).toBe(0)
      expect(r.skipped).toBe(0)
    })
    it('withTransaction (optional, R13) rejects with the callback error — rollback path', async () => {
      const p = await makeProvider()
      await p.connect('test-conn', {})
      if (typeof p.withTransaction !== 'function') return
      // 回滚路径：回调抛错 → 整体 reject 且异常原样传播（commit/rollback 由实现者
      // 保证——「失败后数据不变」的断言由各插件专项用例在真实/内存数据上演示）。
      await expect(
        p.withTransaction(async () => {
          throw new Error('tx-rollback-probe')
        })
      ).rejects.toThrow('tx-rollback-probe')
    })
    it('withTransaction (optional, R13) success path returns fn result via helper.exec', async () => {
      const p = await makeProvider()
      await p.connect('test-conn', {})
      if (typeof p.withTransaction !== 'function') return
      // 成功路径（只读探针语句，跨方言最小公约）：helper.exec 返回 QueryResult 形态
      // fn 的返回值经提交后原样透传。
      const out = await p.withTransaction(async (helper) => {
        const r = await helper.exec('SELECT 1')
        return { columns: r.columns, rowCount: r.rowCount, tag: 'ok' as const }
      })
      expect(out.tag).toBe('ok')
      expect(Array.isArray(out.columns)).toBe(true)
      expect(typeof out.rowCount).toBe('number')
    })
    it('getTableDdl (optional, R14) returns non-empty createTable text', async () => {
      const p = await makeProvider()
      await p.connect('test-conn', {})
      if (typeof p.getTableDdl !== 'function') return
      const dbs = await p.listDatabases()
      const children = await p.listChildren(
        { databaseId: dbs[0]?.id, typeId: 'database', id: dbs[0]?.id ?? '' }
      )
      const table = children.find((c) => c.typeId === 'table')
      if (!table) return
      const ddl = await p.getTableDdl({ typeId: table.typeId, id: table.id })
      expect(typeof ddl.createTable).toBe('string')
      expect(ddl.createTable.length).toBeGreaterThan(0)
      if (ddl.indexes !== undefined) {
        expect(Array.isArray(ddl.indexes)).toBe(true)
        for (const s of ddl.indexes) expect(typeof s).toBe('string')
      }
    })
    it('applyDdl (optional, R15) empty script executes zero statements', async () => {
      const p = await makeProvider()
      await p.connect('test-conn', {})
      if (typeof p.applyDdl !== 'function') return
      // 空脚本（零副作用）：拆句数为 0 → executed 0 且无错误；非空脚本的拆句/执行/
      // 失败汇总语义由各插件专项用例验证（契约层不真执行任何 DDL）。
      const r = await p.applyDdl('')
      expect(typeof r.executed).toBe('number')
      expect(r.executed).toBe(0)
      if (r.errors !== undefined) expect(r.errors).toHaveLength(0)
    })

    // ---- R16generateDdl「实现者契约」----
    // generateDdl 是纯生成（零执行零副作用）——契约层可以安全生成文本并断言形态；
    // 各方言语句正确性由插件专项用例 + 设计器真库验收覆盖。
    it('generateDdl (optional, R16) create returns non-empty dialect statements', async () => {
      const p = await makeProvider()
      await p.connect('test-conn', {})
      if (typeof p.generateDdl !== 'function') return
      // 建表请求：node = 首库节点（设计器真实载荷形态——建表落点解析依据）；
      // 唯一表名（不执行，仅生成文本——表是否真实存在无关紧要）
      const dbs = await p.listDatabases()
      const out = await p.generateDdl({
        node: { databaseId: dbs[0]?.id, typeId: 'database', id: dbs[0]?.id ?? '' },
        action: 'create',
        table: {
          name: 'luoshu_ct_noexec',
          columns: [
            { name: 'id', stdType: 'number', nullable: false, autoIncrement: true },
            { name: 'name', stdType: 'string', length: 50, nullable: false, comment: '名称' }
          ],
          primaryKey: ['id']
        }
      })
      expect(Array.isArray(out.statements)).toBe(true)
      expect(out.statements.length).toBeGreaterThan(0)
      for (const s of out.statements) {
        expect(typeof s).toBe('string')
        expect(s.length).toBeGreaterThan(0)
      }
    })
    it('generateDdl (optional, R16) alter without changes returns zero statements', async () => {
      const p = await makeProvider()
      await p.connect('test-conn', {})
      if (typeof p.generateDdl !== 'function') return
      const original = {
        columns: [
          { name: 'id', dataType: 'int', nullable: false, autoIncrement: true },
          { name: 'name', dataType: 'varchar', nullable: true, length: 50 }
        ],
        primaryKey: ['id']
      }
      // 现模型与 original 全量一致（stdType 回传原生词，类型零变化）→ 零语句
      const dbs = await p.listDatabases()
      const out = await p.generateDdl({
        node: { databaseId: dbs[0]?.id, typeId: 'database', id: dbs[0]?.id ?? '' },
        action: 'alter',
        table: {
          name: 't_unchanged',
          columns: [
            { name: 'id', stdType: 'int', nullable: false, autoIncrement: true },
            { name: 'name', stdType: 'varchar', length: 50, nullable: true }
          ],
          primaryKey: ['id']
        },
        original
      })
      expect(out.statements).toHaveLength(0)
    })
  })
}

// ---- R18TerminalProvider「实现者契约」----
// 与 describeProvider 分离：terminal 挂在 registration（非 provider），工厂
// 形态随之不同。沿可选能力先例：契约层只校验「实现了 terminal 的插件」的
// 行为（openSession 唯一 id / write 输出经宿主注入的 onData 出口到达 /
// resize 成功 / close 幂等）——插件→宿主方向的数据出口是 onData/onClosed
// 回调（宿主注入），主进程转发为渲染层 term:data:{sessionId} 事件流由
// T2 实装覆盖，本契约层直测回调协议本身。

export function describeTerminalProvider(name: string, makeTerminal: () => Promise<TerminalProvider>): void {
  describe(`terminal contract: ${name}`, () => {
    it('openSession returns unique non-empty session id strings', async () => {
      const t = await makeTerminal()
      const s1 = await t.openSession('test-conn', {})
      const s2 = await t.openSession('test-conn', { demo: 'option' })
      expect(typeof s1).toBe('string')
      expect(s1.length).toBeGreaterThan(0)
      expect(s1).not.toBe(s2)
    })
    it('write output reaches the host-injected onData callback (echo via plugin→host exit)', async () => {
      const t = await makeTerminal()
      const received: Uint8Array[] = []
      let sid = ''
      t.onData = (sessionId, chunk) => {
        if (sessionId === sid) received.push(chunk)
      }
      sid = await t.openSession('test-conn', {})
      await t.write(sid, new TextEncoder().encode('hello\r'))
      await waitUntil(() => received.length > 0)
      const text = received.map((c) => new TextDecoder().decode(c)).join('')
      expect(text).toContain('hello')
    })
    it('onData injection after openSession also works（会话中途订阅不丢）', async () => {
      const t = await makeTerminal()
      const sid = await t.openSession('test-conn', {})
      const received: Uint8Array[] = []
      t.onData = (sessionId, chunk) => {
        if (sessionId === sid) received.push(chunk)
      }
      await t.write(sid, new TextEncoder().encode('late-subscribe'))
      await waitUntil(() => received.length > 0)
    })
    it('resize succeeds; close resolves and is idempotent', async () => {
      const t = await makeTerminal()
      const sid = await t.openSession('test-conn', {})
      await t.resize(sid, 120, 40)
      await t.close(sid)
      await expect(t.close(sid)).resolves.toBeUndefined()
    })
  })
}

// ---- R21streamLogs「实现者契约」----
// 与 describeProvider 内的可选方法用例分离：日志源节点是插件特定概念
//（docker 容器 / 日志文件节点），契约层无法从通用树推导——沿 describeTerminalProvider
// 先例由实现者自备 fixture（openLogs 返回 provider + 已知日志源节点）。
// 契约校验面：尾部回放 ≤tail 行且非 follow 以 done 收尾 / follow 长流在回放后
// 持续产新行且 return 即停（停止跟随语义）/ 行文本不含换行（拆行是插件职责）。
// fixture 前提：日志源须有 ≥ tail 的历史行，且 follow 打开后能在数秒内产出新行
//（静默日志源不适用本契约用例——实现者选活跃源）。

export function describeLogStream(
  name: string,
  openLogs: () => Promise<{ provider: DataSourceProvider; node: TreeNodeRef }>
): void {
  describe(`log stream contract: ${name}`, () => {
    it('tail replay (follow: false) delivers 1..tail lines, no newlines, ends with done', async () => {
      const { provider, node } = await openLogs()
      if (typeof provider.streamLogs !== 'function') return
      const tail = 50
      let total = 0
      let sawDone = false
      for await (const chunk of provider.streamLogs(node, { tail, follow: false })) {
        for (const line of chunk.lines) expect(line).not.toMatch(/[\r\n]/)
        total += chunk.lines.length
        if (chunk.done) sawDone = true
      }
      expect(sawDone).toBe(true)
      expect(total).toBeGreaterThan(0)
      expect(total).toBeLessThanOrEqual(tail)
    })
    it('follow keeps producing after replay; return() stops the long stream (停止跟随)', async () => {
      const { provider, node } = await openLogs()
      if (typeof provider.streamLogs !== 'function') return
      const iter = provider.streamLogs(node, { tail: 10, follow: true })[Symbol.asyncIterator]()
      let total = 0
      // 跟随长流：回放（≤10 行）之后仍有新行持续到达——窗口内行数必超回放量
      const deadline = Date.now() + 10_000
      while (total <= 10 && Date.now() < deadline) {
        const r = await iter.next()
        if (r.done) break
        total += r.value.lines.length
      }
      expect(total).toBeGreaterThan(10)
      // AsyncIterator.return 为可选方法（lib ES2022 严格态）——缺席时视同已完成
      const stopped = await iter.return?.(undefined)
      expect(stopped?.done ?? true).toBe(true)
      const after = await iter.next()
      expect(after.done).toBe(true)
    })
  })
}

// ---- R22readFile/writeFile「实现者契约」----
// 沿 describeLogStream 先例：可读写文件节点是插件特定概念（文件树 file
// nodeType），契约层无法从通用树推导——由实现者自备 fixture（openFile 返回
// provider + 已知可读写文件节点，建议每次独立种子保证用例间写隔离）。
// provider 形参取 Pick 方法对面（真实插件直接传整只 provider，结构子类型
// 天然满足；最小内存 fake 亦可——见 provider.test.ts 自检）。
// 契约校验面：全量读不变式（truncated=false → data.length===size 且 ≥1 字节）/
// maxBytes 截断（前缀字节逐字节一致 + size 恒为真实大小 + truncated=true）/
// maxBytes ≥ size 不截断 / writeFile 覆盖写读回逐字节一致（含空数组清空）。
// 注意：writeFile 对 fixture 文件有真实写（读写往返是本方法对的语义本体
// 零副作用纪律不适用）——真实插件（SFTP 等）用专属测试文件作 fixture。

export function describeFileIo(
  name: string,
  openFile: () => Promise<{ provider: Pick<DataSourceProvider, 'readFile' | 'writeFile'>; node: TreeNodeRef }>
): void {
  describe(`file io contract: ${name}`, () => {
    it('readFile (optional, R22) full read: truncated=false, data.length === size, non-empty', async () => {
      const { provider, node } = await openFile()
      if (typeof provider.readFile !== 'function') return
      const r = await provider.readFile(node)
      expect(r.data).toBeInstanceOf(Uint8Array)
      expect(r.truncated).toBe(false)
      expect(r.data.length).toBe(r.size)
      expect(r.size).toBeGreaterThan(0)
    })
    it('readFile with maxBytes < size returns the exact prefix and flags truncated (size 保持真实大小)', async () => {
      const { provider, node } = await openFile()
      if (typeof provider.readFile !== 'function') return
      const full = await provider.readFile(node)
      if (full.size <= 4) return // fixture 前提：≥5 字节文件（实现者自备足够样本）
      const r = await provider.readFile(node, { maxBytes: 4 })
      expect(r.truncated).toBe(true)
      expect(r.data.length).toBe(4)
      expect(r.size).toBe(full.size)
      expect(Array.from(r.data)).toEqual(Array.from(full.data.slice(0, 4)))
    })
    it('readFile with maxBytes ≥ size is not truncated (上限即全量)', async () => {
      const { provider, node } = await openFile()
      if (typeof provider.readFile !== 'function') return
      const full = await provider.readFile(node)
      const r = await provider.readFile(node, { maxBytes: full.size })
      expect(r.truncated).toBe(false)
      expect(r.data.length).toBe(full.size)
      expect(Array.from(r.data)).toEqual(Array.from(full.data))
    })
    it('writeFile (optional, R22) overwrites: read-back bytes identical (覆盖写往返)', async () => {
      const { provider, node } = await openFile()
      if (typeof provider.readFile !== 'function' || typeof provider.writeFile !== 'function') return
      const payload = new TextEncoder().encode('luoshu-r22-roundtrip\n')
      await provider.writeFile(node, payload)
      const r = await provider.readFile(node)
      expect(r.truncated).toBe(false)
      expect(Array.from(r.data)).toEqual(Array.from(payload))
      expect(r.size).toBe(payload.length)
    })
    it('writeFile with empty array yields an empty file (size 0, 清空语义)', async () => {
      const { provider, node } = await openFile()
      if (typeof provider.readFile !== 'function' || typeof provider.writeFile !== 'function') return
      await provider.writeFile(node, new Uint8Array(0))
      const r = await provider.readFile(node)
      expect(r.size).toBe(0)
      expect(r.data).toHaveLength(0)
      expect(r.truncated).toBe(false)
    })
  })
}
