import { describeProvider, describeFileIo } from './contract-test'
import type { DataSourceProvider } from './provider'
import { expect, it } from 'vitest'
import type { ObjectDetailRow } from './types'

// 契约测试工厂自检：用最小内存实现跑全套契约用例（含 R1 分页两用例）。
// 该 fake 故意忽略 page 参数——固化「插件不支持分页时必须忽略 page 且调用成功」的契约下界
// 使 describeProvider 的验证不依赖任何具体插件。
describeProvider('api-fake-minimum', async () => fakeProvider)

const fakeProvider: DataSourceProvider = {
  async connect() {
    return { serverVersion: 'fake-1.0' }
  },
  async disconnect() {},
  async listDatabases() {
    return [{ id: 'db0', label: 'FakeDB' }]
  },
  async listChildren() {
    return [{ typeId: 'table', id: 't0', label: 't0' }]
  },
  async getSchema() {
    return { columns: [{ name: 'id', dataType: 'int', nullable: false }] }
  },
  async query() {
    return { columns: ['id'], rows: [[1]], rowCount: 1, elapsedMs: 0 }
  },
  async *streamQuery(_sql, _params, queryId = 'q') {
    yield { queryId, columns: ['id'], rows: [[1]], done: true }
  },
  async cancel() {}
}

// R22 readFile/writeFile 契约工厂自检：独立最小内存文件 fake（沿 fakeProvider
// 自检先例；fakeProvider 本身保持最小面——「无可选方法」的契约下界示范不变）。
// 每次 openFile 重播种（闭包变量独立持有——用例间写隔离，沿 mock「每次
// activate 独立种子」纪律）。
const FAKE_FILE_ID = 'seed.bin'

describeFileIo('api-fake-files', async () => {
  let bytes = new TextEncoder().encode('luoshu-file-io-fixture-0123456789')
  return {
    provider: {
      async readFile(node, opts) {
        if (node.id !== FAKE_FILE_ID) throw new Error(`no such file: ${node.id}`)
        const size = bytes.length
        if (opts?.maxBytes === undefined || opts.maxBytes >= size) {
          return { data: new Uint8Array(bytes), size, truncated: false }
        }
        return { data: bytes.slice(0, Math.max(opts.maxBytes, 0)), size, truncated: true }
      },
      async writeFile(node, data) {
        if (node.id !== FAKE_FILE_ID) throw new Error(`no such file: ${node.id}`)
        bytes = new Uint8Array(data)
      }
    },
    node: { typeId: 'file', id: FAKE_FILE_ID }
  }
})

// 对象详情批量契约（2026-11-14 同步自主仓 444bbfb）：listObjectDetails 为可选方法
// ——未实现时调用方 METHOD_NOT_SUPPORTED 降级，实现方可返回目录级统计行。
/** 仅实现详情面的最小数据源，验证可选方法可被插件实现 */
const detailProvider: Pick<DataSourceProvider, 'listObjectDetails'> = {
  /** 返回固定详情行 */
  listObjectDetails: async (): Promise<ObjectDetailRow[]> => [
    { id: 'db.t1', label: 't1', rows: 12, dataLength: 4096, engine: 'InnoDB', comment: '测试表' }
  ]
}

it('listObjectDetails 为可选方法，插件可实现并返回详情行', async () => {
  const rows = await detailProvider.listObjectDetails!({ typeId: 'database', id: 'db', databaseId: 'db' }, 'tables')
  expect(rows[0]).toMatchObject({ id: 'db.t1', rows: 12, engine: 'InnoDB' })
})
