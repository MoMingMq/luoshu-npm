// 索引源纯核：多索引源配置的 URL 规则与有效源选择——宿主（settings 归一 / 索引
// 拉取白名单）与渲染层（市场页来源对话框）共用同一套判定，拒绝原因单一真源。
//
// 拒绝清单：仅 http/https、不得内嵌凭据、不得带 fragment、不得与已有来源重复、
// 长度上限。官方源（部署注入）不可由用户删除，但可被选为活动源。

/** 单条索引源（settings.json marketIndexes 元素） */
export interface MarketIndexSource {
  /** 索引地址（http/https 绝对 URL） */
  url: string
  /** 显示名（可选——缺省展示 host） */
  title?: string
}

/** 索引源数量上限（防设置文件膨胀） */
export const MAX_INDEX_SOURCES = 20
/** 索引 URL 长度上限 */
export const MAX_INDEX_URL_LENGTH = 2048
/** 来源显示名长度上限 */
export const MAX_INDEX_TITLE_LENGTH = 64

/** URL 合法性人读原因；合法回 null（空串=必填） */
export function indexSourceUrlError(url: string): string | null {
  const raw = url.trim()
  if (raw === '') return '请填写索引地址'
  if (raw.length > MAX_INDEX_URL_LENGTH) return `索引地址过长（上限 ${MAX_INDEX_URL_LENGTH} 字符）`
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return '索引地址不是合法 URL'
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '仅支持 http/https 地址'
  if (parsed.username !== '' || parsed.password !== '') return '索引地址不允许内嵌用户名/密码'
  if (parsed.hash !== '') return '索引地址不允许带 #fragment'
  return null
}

/** 标题窄化（trim + 截断；空=undefined） */
function normalizeTitle(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const t = raw.trim()
  if (t === '') return undefined
  return t.length > MAX_INDEX_TITLE_LENGTH ? t.slice(0, MAX_INDEX_TITLE_LENGTH) : t
}

/**
 * 任意脏输入 → 合法来源列表：非法 URL/坏条丢弃，重复 URL 去重保序，超上限截断。
 * 标题可选；URL 规范化（URL.toString 归一化尾部/转义）。
 */
export function normalizeIndexSources(raw: unknown): MarketIndexSource[] {
  if (!Array.isArray(raw)) return []
  const out: MarketIndexSource[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (out.length >= MAX_INDEX_SOURCES) break
    const url = typeof item === 'string' ? item : (item !== null && typeof item === 'object' ? (item as { url?: unknown }).url : undefined)
    if (typeof url !== 'string') continue
    if (indexSourceUrlError(url) !== null) continue
    const normalized = new URL(url.trim()).toString()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    const title = item !== null && typeof item === 'object' ? normalizeTitle((item as { title?: unknown }).title) : undefined
    out.push({ url: normalized, ...(title !== undefined ? { title } : {}) })
  }
  return out
}

/** 新增来源校验（并入既有列表）：非法/重复/超额 → 人读原因；合法回 null */
export function indexSourceAddError(
  url: string,
  existing: readonly MarketIndexSource[],
  deploymentUrl?: string,
): string | null {
  const base = indexSourceUrlError(url)
  if (base !== null) return base
  if (existing.length >= MAX_INDEX_SOURCES) return `索引源已达上限（${MAX_INDEX_SOURCES} 个）`
  const normalized = new URL(url.trim()).toString()
  if (deploymentUrl !== undefined && deploymentUrl !== '' && new URL(deploymentUrl).toString() === normalized) {
    return '该地址已是官方索引源'
  }
  if (existing.some((s) => s.url === normalized)) return '该索引地址已添加'
  return null
}

/** 来源显示名（无 title 时展示 host+path） */
export function indexSourceLabel(source: MarketIndexSource): string {
  if (source.title !== undefined) return source.title
  try {
    const u = new URL(source.url)
    return `${u.host}${u.pathname === '/' ? '' : u.pathname}`
  } catch {
    return source.url
  }
}

/** 有效索引源（marketActiveIndexUrl 在允许集内则用之；否则部署源优先，再首个用户源） */
export function effectiveIndexSource(opts: {
  deploymentUrl?: string
  sources: readonly MarketIndexSource[]
  activeUrl?: string
}): { url: string; title?: string; deployment: boolean } | null {
  const deploymentUrl = opts.deploymentUrl !== undefined && opts.deploymentUrl.trim() !== ''
    ? opts.deploymentUrl.trim()
    : undefined
  const active = opts.activeUrl !== undefined && opts.activeUrl !== '' ? opts.activeUrl : undefined
  if (active !== undefined) {
    if (deploymentUrl !== undefined && active === deploymentUrl) {
      return { url: deploymentUrl, title: '部署方索引', deployment: true }
    }
    const hit = opts.sources.find((s) => s.url === active)
    if (hit !== undefined) return { ...hit, deployment: false }
  }
  if (deploymentUrl !== undefined) return { url: deploymentUrl, title: '部署方索引', deployment: true }
  const first = opts.sources[0]
  return first !== undefined ? { ...first, deployment: false } : null
}
