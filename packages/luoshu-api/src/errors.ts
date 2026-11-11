export interface LuoshuError {
  /** code 字段 */
  code: string
  /** 消息文本 */
  message: string
  /** hint 字段 */
  hint?: string
  /** detail 字段 */
  detail?: unknown
  /** SQL 语句position */
  sqlPosition?: { line: number; column: number }
}

export function createLuoshuError(code: string, message: string, extra?: Partial<LuoshuError>): LuoshuError {
  return { code, message, ...extra }
}
export function isLuoshuError(e: unknown): e is LuoshuError {
  return typeof e === 'object' && e !== null && 'code' in e && 'message' in e
}
