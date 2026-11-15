import { describe, expect, it } from 'vitest'
import { withPower, withPowerStream, type PowerSeam } from './power.ts'

/** 记录 acquire/release 的假电源缝 */
function fakePower(): { seam: PowerSeam; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    seam: {
      /** 记录申请并返回固定票据 */
      acquire: async (reason: string) => { calls.push(`acquire:${reason}`); return 1 },
      /** 记录释放 */
      release: async (ticket: number) => { calls.push(`release:${ticket}`); return true },
    },
  }
}

describe('withPower', () => {
  it('成功任务申请后释放票据', async () => {
    const { seam, calls } = fakePower()
    const result = await withPower(seam, '查询执行', async () => 'ok')
    expect(result).toBe('ok')
    expect(calls).toEqual(['acquire:查询执行', 'release:1'])
  })

  it('任务失败仍释放票据', async () => {
    const { seam, calls } = fakePower()
    await expect(withPower(seam, '查询执行', async () => { throw new Error('boom') })).rejects.toThrow('boom')
    expect(calls).toEqual(['acquire:查询执行', 'release:1'])
  })

  it('未注入电源缝时照常执行', async () => {
    await expect(withPower(undefined, '查询执行', async () => 42)).resolves.toBe(42)
  })
})

describe('withPowerStream', () => {
  it('流结束后释放票据', async () => {
    const { seam, calls } = fakePower()
    /** 三块测试流 */
    async function* source(): AsyncGenerator<number> { yield 1; yield 2 }
    const out: number[] = []
    for await (const item of withPowerStream(seam, '备份执行', source())) out.push(item)
    expect(out).toEqual([1, 2])
    expect(calls).toEqual(['acquire:备份执行', 'release:1'])
  })

  it('消费方提前终止时释放票据', async () => {
    const { seam, calls } = fakePower()
    /** 无限测试流 */
    async function* source(): AsyncGenerator<number> { yield 1; yield 2; yield 3 }
    for await (const item of withPowerStream(seam, '备份执行', source())) {
      expect(item).toBe(1)
      break
    }
    expect(calls).toEqual(['acquire:备份执行', 'release:1'])
  })
})