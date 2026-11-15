/** 长任务电源缝：申请/释放阻止系统挂起的票据 */
export interface PowerSeam {
  /** 申请一张阻止系统挂起的票据，返回票据 id */
  acquire(reason: string, ttlMs?: number): Promise<number>
  /** 释放票据；未知或已释放票据返回 false */
  release(ticket: number): Promise<boolean>
}

/** 电源状态快照：状态栏展示当前票据摘要 */
export interface PowerState {
  /** 是否有票据持有 */
  active: boolean
  /** 当前票据摘要 */
  tickets: Array<{ reason: string; expiresAt: string }>
}

/** 宿主/渲染插件访问电源服务的缝名 */
export const POWER_SEAM_ID = 'power'

/** 在长任务 Promise 期间持有电源票据；票据申请失败照常执行 */
export async function withPower<T>(
  power: PowerSeam | undefined,
  reason: string,
  run: () => Promise<T>,
): Promise<T> {
  const ticket = power === undefined ? undefined : await power.acquire(reason).catch(() => undefined)
  try {
    return await run()
  } finally {
    if (ticket !== undefined && power !== undefined) await power.release(ticket).catch(() => undefined)
  }
}

/** 在流式任务迭代期间持有电源票据；结束、异常与取消都会释放 */
export async function* withPowerStream<T>(
  power: PowerSeam | undefined,
  reason: string,
  source: AsyncIterable<T>,
): AsyncGenerator<T> {
  const ticket = power === undefined ? undefined : await power.acquire(reason).catch(() => undefined)
  try {
    yield* source
  } finally {
    if (ticket !== undefined && power !== undefined) await power.release(ticket).catch(() => undefined)
  }
}