<script setup lang="ts">
const localePath = useLocalePath();
</script>

<template>
  <section id="try" class="try">
    <h2>{{ $t('home.tryTitle') }} <em>Fougere</em></h2>
    <div class="actions">
      <HomeCode class="command" code="npm create fougere" />
      <NuxtLink :to="localePath('/docs/getting-started')" class="primary">{{ $t('home.tryButton') }} →</NuxtLink>
    </div>
    <p class="or">
      {{ $t('home.tryOr') }}
      <NuxtLink :to="localePath('/docs/existing-app')" class="doc">{{ $t('home.tryExisting') }}</NuxtLink>
    </p>
  </section>
</template>

<style scoped>
.try {
  scroll-margin-top: 3.5rem;
  padding: 120px 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-top: 1px solid var(--ui-border);
  text-align: center;
  gap: 26px;
}

.try h2 {
  margin: 0;
  max-width: 900px;
  font-size: clamp(34px, 4.4vw, 60px);
  line-height: 1.06;
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

.command :deep(pre) {
  padding: 16px 56px 16px 26px;
  font-size: 16px;
}

.or {
  color: var(--ui-text-muted);
  font-size: 15px;
}

.doc {
  font-size: 15px;
  color: var(--ui-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.actions {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 16px 28px;
}

.primary {
  display: inline-block;
  padding: 18px 40px;
  border-radius: 999px;
  background: var(--ui-text);
  color: var(--ui-bg);
  font-size: 18px;
  font-weight: 500;
  text-decoration: none;
}

</style>
