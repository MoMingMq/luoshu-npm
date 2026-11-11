/** 渲染侧 preload 桥的最小类型面（宿主注入 window.luoshuBridge）。 */
declare global {
  interface Window {
    luoshuBridge?: {
      call<T = unknown>(service: string, method: string, args: unknown[]): Promise<T>
      cmdRun?(pluginId: string, cmdId: string, args?: unknown[]): Promise<unknown>
    }
  }
}

export {}
