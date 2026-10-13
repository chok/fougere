<script setup lang="ts">
import { useAudit } from '~/home/audit';

const localePath = useLocalePath();
const { prompt, copied, copy } = useAudit();
</script>

<template>
  <section id="try" class="try">
    <h2>{{ $t('home.tryTitle') }} <em>Fougere</em></h2>
    <p>{{ $t('home.tryText') }}</p>
    <pre class="command">npm create fougere</pre>
    <div class="actions">
      <NuxtLink :to="localePath('/docs/existing-app')" class="primary">{{ $t('home.tryExisting') }}</NuxtLink>
      <NuxtLink :to="localePath('/docs/getting-started')" class="secondary">{{ $t('home.tryScratch') }}</NuxtLink>
      <a href="#audit" class="secondary">{{ $t('home.tryAgent') }}</a>
    </div>
  </section>

  <section id="audit" class="audit">
    <div class="words">
      <h2>{{ $t('home.auditTitle') }}</h2>
      <p>{{ $t('home.auditText') }}</p>
      <button type="button" class="secondary" @click="copy">{{ copied ? $t('home.auditCopied') : $t('home.auditCopy') }}</button>
    </div>
    <pre class="prompt">{{ prompt }}</pre>
  </section>
</template>

<style scoped>
.try {
  min-height: calc(100svh - 3.5rem);
  scroll-margin-top: 3.5rem;
  padding: 80px clamp(16px, 6vw, 96px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-top: 1px solid var(--ui-border);
  text-align: center;
  gap: 26px;
}

.try h2 {
  margin: 0;
  font-size: clamp(40px, 5vw, 72px);
  line-height: 1.02;
}

h2 em {
  font-style: italic;
  color: var(--ui-primary);
}

p {
  margin: 0;
  font-size: 19px;
  color: var(--ui-text-muted);
  max-width: 600px;
}

.audit {
  padding: 120px clamp(16px, 6vw, 96px);
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 48px;
  align-items: start;
  border-top: 1px solid var(--ui-border);
  scroll-margin-top: 3.5rem;
}

.audit .words {
  position: sticky;
  top: 6rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 22px;
}

.audit h2 {
  margin: 0;
  font-size: clamp(30px, 3.6vw, 48px);
  line-height: 1.06;
}

.audit p {
  font-size: 18px;
}

.prompt {
  max-height: 34rem;
  overflow: auto;
  padding: 18px 22px;
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
}

@media (max-width: 760px) {
  .audit {
    grid-template-columns: minmax(0, 1fr);
    padding: 80px 16px;
  }

  .audit .words {
    position: static;
  }
}

pre {
  margin: 0;
  background: #10180f;
  color: #e1ebde;
  border-radius: 12px;
  font-family: var(--font-mono);
}

.command {
  padding: 16px 26px;
  font-size: 16px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.primary, .secondary {
  display: inline-block;
  padding: 14px 28px;
  border-radius: 999px;
  font: inherit;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
}

.primary {
  background: var(--ui-text);
  color: var(--ui-bg);
}

.secondary {
  border: 1.5px solid var(--ui-text);
  background: transparent;
  color: var(--ui-text);
}
</style>
