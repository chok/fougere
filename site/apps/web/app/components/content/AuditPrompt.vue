<script setup lang="ts">
const { prompt, copied, copy } = useAudit();
</script>

<template>
  <div class="audit">
    <button type="button" @click="copy">{{ copied ? $t('home.auditCopied') : $t('home.auditCopy') }}</button>
    <pre>{{ prompt }}</pre>
  </div>
</template>

<style scoped>
.audit {
  margin: 1.5rem 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}

button {
  padding: 10px 22px;
  border-radius: 999px;
  border: 1.5px solid var(--ui-text);
  background: transparent;
  color: var(--ui-text);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}

pre {
  width: 100%;
  max-height: 34rem;
  margin: 0;
  overflow: auto;
  padding: 18px 22px;
  background: #10180f;
  color: #e1ebde;
  border-radius: 12px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
