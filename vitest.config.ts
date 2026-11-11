import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 仓级默认：各包自带 vitest.config（此处兜底根目录直跑场景）
  },
})
