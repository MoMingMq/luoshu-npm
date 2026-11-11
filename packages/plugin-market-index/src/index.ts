/**
 * 洛书插件市场索引格式 1 校验器——无运行时依赖的纯函数规则集。
 *
 * 索引是一份 JSON 文件，列出可安装的 npm 插件包及展示元数据；索引与生成器分离：
 * 生成器发布前用本包校验，宿主读取前同样校验。
 *
 * 语义：parseMarketIndex 校验失败抛 MarketIndexError（携带 JSON path 与原因）；
 * 成功返回规范化结果——versions 按 semver 降序（prerelease 低于同版本号正式版）、
 * 相对 icon 补全为绝对 URL、丢弃格式外成员。
 */

/** 单版本条目（规范化后形态） */
export interface MarketVersion {
  /** 版本号 */
  version: string
  /** Unix 秒（发布时刻——列表排序/展示） */
  publishTimestamp: number
  /** 洛书兼容范围（semver 表达式——安装前版本门禁判据） */
  engines?: { luoshu?: string }
  /** 长描述文档 URL（详情页 Markdown——缺省回落包 README） */
  readme?: string
}

/** 单插件条目（规范化后形态） */
export interface MarketPlugin {
  /** 名称 */
  name: string
  /** 标题 */
  title: string
  /** 描述 */
  description: string
  /** http(s) 绝对 / data:（≤32KiB）/ 相对索引 URL */
  icon?: string
  /** 作者 */
  author?: string
  /** 主页 */
  homepage?: string
  /** 仓库地址 */
  repository?: string
  /** 关键字 */
  keywords?: string[]
  /** 分类 */
  category?: string
  /** 发行标签 */
  distTags: Record<string, string>
  /** 版本清单 */
  versions: MarketVersion[]
}

/** 索引文档（规范化后形态） */
export interface MarketIndex {
  /** format 字段 */
  format: 1
  /** 标题 */
  title: string
  /** 描述 */
  description?: string
  /** plugins 字段 */
  plugins: MarketPlugin[]
}

/** 校验失败：携带违规值的 JSON path 与原因 */
export class MarketIndexError extends Error {
  readonly path: string
  readonly reason: string
  constructor(path: string, reason: string) {
    super(`插件市场索引格式错误（${path}）：${reason}`)
    this.name = 'MarketIndexError'
    this.path = path
    this.reason = reason
  }
}

/** data: 图标内联载荷上限 */
export const MAX_INLINE_ICON_BYTES = 32 * 1024

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const TIMESTAMP_MIN = 0
const TIMESTAMP_MAX = 4102444800 // 2100-01-01——防误填毫秒

/** semver 严格比较（prerelease 低于同版本号正式版——SemVer 2.0.0 §11.4；零依赖） */
export function semverCompare(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (pa === null || pb === null) return a.localeCompare(b)
  for (let i = 0; i < 3; i++) {
    if (pa.core[i] !== pb.core[i]) return pa.core[i]! - pb.core[i]!
  }
  // 正式版 > prerelease；两者皆 prerelease 逐段比较（数字段<字母段；短前缀按缺省 0）
  if (pa.pre.length === 0 && pb.pre.length === 0) return 0
  if (pa.pre.length === 0) return 1
  if (pb.pre.length === 0) return -1
  const n = Math.max(pa.pre.length, pb.pre.length)
  for (let i = 0; i < n; i++) {
    const x = pa.pre[i]
    const y = pb.pre[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xn = /^\d+$/.test(x)
    const yn = /^\d+$/.test(y)
    if (xn && yn) { const d = Number(x) - Number(y); if (d !== 0) return d }
    if (xn !== yn) return xn ? -1 : 1
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

interface SemverParts { core: [number, number, number]; pre: string[] }

function parseSemver(v: string): SemverParts | null {
  if (!SEMVER_RE.test(v)) return null
  const [coreStr, preStr] = v.split('-', 2)
  const core = coreStr!.split('.').map(Number) as [number, number, number]
  const pre = preStr === undefined ? [] : preStr.split('+')[0]!.split('.').filter((s) => s !== '')
  return { core, pre }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.trim() === '') throw new MarketIndexError(path, '需为非空字符串')
  return v
}

function asTimestamp(v: unknown, path: string): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < TIMESTAMP_MIN || n > TIMESTAMP_MAX) {
    throw new MarketIndexError(path, `需为 Unix 秒时间戳（${TIMESTAMP_MIN}–${TIMESTAMP_MAX}）——请勿填毫秒`)
  }
  return Math.floor(n)
}

function asIcon(v: unknown, path: string, indexUrl: string): string | undefined {
  if (v === undefined) return undefined
  const s = asString(v, path)
  if (s.startsWith('data:image/')) {
    // data: 图标载荷上限（base64 解码后近似校验——长度/3*4 编码率反推）
    const payload = s.slice(s.indexOf(',') + 1)
    if (payload.length * 3 / 4 > MAX_INLINE_ICON_BYTES) {
      throw new MarketIndexError(path, `data: 图标超上限（${MAX_INLINE_ICON_BYTES} 字节）`)
    }
    return s
  }
  if (/^https?:\/\//.test(s)) return s
  // 相对路径 → 补全为相对索引 URL 的绝对地址（校验器规范化职责之一）
  try { return new URL(s, indexUrl).toString() } catch { throw new MarketIndexError(path, `icon 非法（既非 http(s)/data: 也无法相对索引 URL 解析）: ${s}`) }
}

/** 校验并规范化索引文档：失败抛 MarketIndexError；成功返回规范化结果 */
export function parseMarketIndex(value: unknown, indexUrl: string): MarketIndex {
  if (!isPlainObject(value)) throw new MarketIndexError('', '索引文档需为 JSON 对象')
  if (value['format'] !== 1) throw new MarketIndexError('format', 'format 必须为 1（当前索引格式版本）')
  const title = asString(value['title'], 'title')
  const description = value['description'] === undefined ? undefined : asString(value['description'], 'description')
  // plugins 允许空数组（冷启动合法态——新 registry 尚无包；市场页空态有引导 UI 承接）
  if (!Array.isArray(value['plugins'])) {
    throw new MarketIndexError('plugins', '需为数组')
  }

  let base = indexUrl
  try { base = new URL(indexUrl).toString() } catch { throw new MarketIndexError('', `indexUrl 非法: ${indexUrl}`) }

  const seenNames = new Set<string>()
  const plugins: MarketPlugin[] = value['plugins'].map((p, i) => {
    const pp = `plugins[${i}]`
    if (!isPlainObject(p)) throw new MarketIndexError(pp, '需为对象')
    const name = asString(p['name'], `${pp}.name`)
    if (seenNames.has(name)) throw new MarketIndexError(`${pp}.name`, `插件名重复: ${name}`)
    seenNames.add(name)
    const titleP = asString(p['title'], `${pp}.title`)
    const descriptionP = asString(p['description'], `${pp}.description`)
    const icon = asIcon(p['icon'], `${pp}.icon`, base)
    const author = p['author'] === undefined ? undefined : asString(p['author'], `${pp}.author`)
    const homepage = p['homepage'] === undefined ? undefined : asString(p['homepage'], `${pp}.homepage`)
    const repository = p['repository'] === undefined ? undefined : asString(p['repository'], `${pp}.repository`)
    const keywords = p['keywords'] === undefined ? undefined
      : (Array.isArray(p['keywords']) ? p['keywords'].map((k, ki) => asString(k, `${pp}.keywords[${ki}]`)) : (() => { throw new MarketIndexError(`${pp}.keywords`, '需为字符串数组') })())
    const category = p['category'] === undefined ? undefined : asString(p['category'], `${pp}.category`)

    // dist-tags：对象且至少含 latest；latest 必须指向 versions 内某版本
    if (!isPlainObject(p['dist-tags'])) throw new MarketIndexError(`${pp}.dist-tags`, '需为对象（至少含 latest）')
    const distTags: Record<string, string> = {}
    for (const [k, v] of Object.entries(p['dist-tags'])) {
      distTags[k] = asString(v, `${pp}.dist-tags.${k}`)
    }
    if (distTags['latest'] === undefined) throw new MarketIndexError(`${pp}.dist-tags.latest`, '缺 latest 标签')

    if (!Array.isArray(p['versions']) || p['versions'].length === 0) {
      throw new MarketIndexError(`${pp}.versions`, '需为非空数组')
    }
    const seenVers = new Set<string>()
    const versions: MarketVersion[] = p['versions'].map((v, vi) => {
      const vp = `${pp}.versions[${vi}]`
      if (!isPlainObject(v)) throw new MarketIndexError(vp, '需为对象')
      const version = asString(v['version'], `${vp}.version`)
      if (!SEMVER_RE.test(version)) throw new MarketIndexError(`${vp}.version`, `需为合法 semver: ${version}`)
      if (seenVers.has(version)) throw new MarketIndexError(`${vp}.version`, `版本重复: ${version}`)
      seenVers.add(version)
      const publishTimestamp = asTimestamp(v['publishTimestamp'], `${vp}.publishTimestamp`)
      let engines: { luoshu?: string } | undefined
      if (v['engines'] !== undefined) {
        if (!isPlainObject(v['engines'])) throw new MarketIndexError(`${vp}.engines`, '需为对象')
        const luoshu = v['engines']['luoshu'] === undefined ? undefined : asString(v['engines']['luoshu'], `${vp}.engines.luoshu`)
        engines = luoshu === undefined ? undefined : { luoshu }
      }
      const readme = v['readme'] === undefined ? undefined : asString(v['readme'], `${vp}.readme`)
      return {
        version,
        publishTimestamp,
        ...(engines !== undefined ? { engines } : {}),
        ...(readme !== undefined ? { readme } : {}),
      }
    })
    if (distTags['latest'] !== undefined && !seenVers.has(distTags['latest'])) {
      throw new MarketIndexError(`${pp}.dist-tags.latest`, `latest 指向的版本不在 versions 内: ${distTags['latest']}`)
    }
    // 规范化：versions 按 semver 降序
    versions.sort((a, b) => semverCompare(b.version, a.version))
    return {
      name, title: titleP, description: descriptionP,
      ...(icon !== undefined ? { icon } : {}),
      ...(author !== undefined ? { author } : {}),
      ...(homepage !== undefined ? { homepage } : {}),
      ...(repository !== undefined ? { repository } : {}),
      ...(keywords !== undefined ? { keywords } : {}),
      ...(category !== undefined ? { category } : {}),
      distTags, versions,
    }
  })

  return { format: 1, title, ...(description !== undefined ? { description } : {}), plugins }
}

/** 安装目标：npm 形态精确 spec（洛书分发仅 npm——git/tarball 通道不做） */
export function marketInstallTarget(name: string, version: string): { spec: string } {
  return { spec: `${name}@${version}` }
}

// 索引源配置纯核：多索引源 URL 规则/归一化/有效源选择
// ——host（settings 归一、Main 白名单）与渲染层（市场页来源对话框）共用。
export * from './index-source.ts'
