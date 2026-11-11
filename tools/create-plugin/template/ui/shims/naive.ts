// naive-ui 宿主共享垫片（件模板）：vite alias 把 'naive-ui' 重写到本文件——
// 组件对象/具名 locale/hook 均取宿主单实例（window.__luoshuHostDeps.naive，渲染入口
// host-deps.ts 最先注入；useDialog/useMessage 的 inject 键属于宿主 naive——跨实例
// inject 会静默失败，故件永不自捆 naive-ui）。名单基线平移自旧壳
// plugins/luoshu-shell/ui/shims/naive.ts，增补 NTabs/NTabPane/NEmpty（设置页
// 分段用面）。件内组件用到未列举 API 时往本清单补。
const N = (globalThis as unknown as { __luoshuHostDeps: { naive: typeof import('naive-ui') } }).__luoshuHostDeps.naive
export const NAlert = N.NAlert
export const NAutoComplete = N.NAutoComplete
export const NButton = N.NButton
export const NCheckbox = N.NCheckbox
export const NColorPicker = N.NColorPicker
export const NConfigProvider = N.NConfigProvider
export const NDataTable = N.NDataTable
export const NDialogProvider = N.NDialogProvider
export const NDropdown = N.NDropdown
export const NEmpty = N.NEmpty
export const NForm = N.NForm
export const NFormItem = N.NFormItem
export const NGlobalStyle = N.NGlobalStyle
export const NInput = N.NInput
export const NInputNumber = N.NInputNumber
export const NMessageProvider = N.NMessageProvider
export const NModal = N.NModal
export const NProgress = N.NProgress
export const NRadioButton = N.NRadioButton
export const NRadio = N.NRadio
export const NRadioGroup = N.NRadioGroup
export const NSelect = N.NSelect
export const NSlider = N.NSlider
export const NSpin = N.NSpin
export const NSwitch = N.NSwitch
export const NTabPane = N.NTabPane
export const NTabs = N.NTabs
export const NTag = N.NTag
export const NTooltip = N.NTooltip
export const useDialog = N.useDialog
export const useMessage = N.useMessage
export const dateZhCN = N.dateZhCN
export const zhCN = N.zhCN
