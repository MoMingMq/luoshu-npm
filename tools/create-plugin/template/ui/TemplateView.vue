<template>
  <section class="template-demo" data-testid="template-demo-view">
    <h2>示例插件</h2>
    <p>
      这个页签由插件贡献；宿主服务返回：
      <strong data-testid="template-demo-ping">{{ hostResult }}</strong>
    </p>
    <div class="actions">
      <button type="button" class="ping-btn" data-testid="template-demo-call" @click="ping">
        调用宿主服务
      </button>
      <button type="button" class="ping-btn" data-testid="template-demo-command" @click="runCommand">
        执行宿主命令
      </button>
    </div>
    <p>
      命令返回：
      <strong data-testid="template-demo-command-result">{{ commandResult }}</strong>
    </p>
    <p class="shortcut-line">
      快捷键触发次数：
      <span data-testid="template-demo-shortcut">{{ shortcutCount }}</span>
    </p>
    <p>
      <button type="button" class="ping-btn" data-testid="template-demo-open-object" @click="openObjectView">
        打开对象视图页签
      </button>
    </p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const hostResult = ref('尚未调用')
const commandResult = ref('尚未调用')
const shortcutCount = ref(0)
const bridge = window.luoshuBridge

async function ping(): Promise<void> {
  if (!bridge) {
    hostResult.value = '宿主桥不可用'
    return
  }
  try {
    hostResult.value = String(await bridge.call('demo@luoshu-plugin-template', 'ping', []))
  } catch (err) {
    hostResult.value = err instanceof Error ? err.message : String(err)
  }
}

async function runCommand(): Promise<void> {
  if (!bridge?.cmdRun) {
    commandResult.value = '命令桥不可用'
    return
  }
  try {
    commandResult.value = String(await bridge.cmdRun('luoshu-plugin-template', 'demo.ping', []))
  } catch (err) {
    commandResult.value = err instanceof Error ? err.message : String(err)
  }
}

function onShortcut(): void {
  shortcutCount.value++
  void ping()
}

/** 打开对象视图页签（第九缝演示）：派发 db:open，workbench 按槽声明 title 开页签 */
function openObjectView(): void {
  ;(globalThis as unknown as { __luoshuBus?: EventTarget }).__luoshuBus
    ?.dispatchEvent(new CustomEvent('db:open', {
      detail: { connId: 'template-local', pluginId: 'luoshu-plugin-template', view: 'template-object' },
    }))
}

onMounted(() => window.addEventListener('luoshu-demo:ping', onShortcut))
onUnmounted(() => window.removeEventListener('luoshu-demo:ping', onShortcut))
</script>

<style scoped>
.template-demo {
  padding: 24px;
  color: var(--luoshu-text-1);
}
h2 { margin: 0 0 12px; font-size: 18px; }
.actions { display: flex; gap: 8px; margin-top: 8px; }
.ping-btn {
  padding: 6px 12px;
  border: 1px solid var(--luoshu-border-split);
  border-radius: var(--luoshu-radius-md, 6px);
  background: var(--luoshu-bg-container);
  color: var(--luoshu-text-1);
  cursor: pointer;
}
.shortcut-line { margin-top: 12px; color: var(--luoshu-text-3); }
</style>
