<script setup lang="ts">
const props = defineProps<{ code: string; html?: string }>();

const copied = ref(false);

async function copy() {
  await navigator.clipboard.writeText(props.code);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}
</script>

<template>
  <div class="block">
    <div v-if="html" v-html="html" />
    <pre v-else>{{ code }}</pre>
    <button type="button" class="copy" :aria-label="copied ? 'Copied' : 'Copy'" @click="copy">
      <UIcon :name="copied ? 'i-lucide-check' : 'i-lucide-copy'" class="size-4" />
    </button>
  </div>
</template>

<style scoped>
.block {
  position: relative;
}

.block :deep(pre) {
  margin: 0;
  overflow-x: auto;
  white-space: pre;
  background: #10180f;
  color: #e1ebde;
  border-radius: 12px;
  padding: 16px 48px 16px 18px;
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.7;
}

.copy {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #7d8c80;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
}

.copy:hover {
  color: #e1ebde;
  background: rgb(255 255 255 / 0.08);
}
</style>
