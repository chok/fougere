<script setup lang="ts">
import { post } from '@fronds/facade';
import Post from '@fronds/__frond__/entities/Post';

const { items } = await useQuery(post, 'list');
const { fields, values, errors, choices, searchable, search, submit } = useFormFor(Post);
const publish = useCommand(post, 'publish');
const remove = useCommand(post, 'delete');
</script>

<template>
  <main class="posts">
    <h1>Posts</h1>
    <form novalidate @submit.prevent="submit">
      <template v-for="field in fields" :key="field.name">
        <template v-if="field.control === 'reference'">
          <input v-if="searchable[field.name]" type="search" :placeholder="`Search ${field.label}`" @input="search(field.name, ($event.target as HTMLInputElement).value)" />
          <select v-model="(values as Record<string, string>)[field.name]" v-bind="field.attrs">
            <option value="" disabled>{{ field.label }}</option>
            <option v-for="choice in choices[field.name]" :key="choice.value" :value="choice.value">{{ choice.label }}</option>
          </select>
        </template>
        <select v-else-if="field.control === 'select'" v-model="values[field.name]" v-bind="field.attrs">
          <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
        </select>
        <label v-else-if="field.control === 'boolean'"><input v-model="values[field.name]" type="checkbox" /> {{ field.label }}</label>
        <textarea v-else-if="field.control === 'text' && !field.attrs?.maxLength" v-model="(values as Record<string, string>)[field.name]" v-bind="field.attrs" :placeholder="field.label" />
        <input v-else v-model="values[field.name]" v-bind="field.attrs" :placeholder="field.label" />
        <small v-if="errors[field.name]">{{ errors[field.name] }}</small>
      </template>
      <button>Create draft</button>
    </form>
    <ul>
      <li v-for="row in items" :key="row.id">
        <strong>{{ row.title }}</strong>
        <span>{{ row.status }}</span>
        <button v-if="row.status === 'draft'" @click="publish.execute({ params: { id: row.id } })">Publish</button>
        <button class="delete" @click="remove.execute({ params: { id: row.id } })">Delete</button>
      </li>
    </ul>
    <template v-for="(command, index) in [publish, remove]" :key="index">
      <p v-if="command.error.value" class="refused">{{ command.error.value.message }}</p>
    </template>
  </main>
</template>

<style>
:root {
  color-scheme: light dark;
  --ink: #25372d; --muted: #65736a; --line: #dce3d9; --green: #38714c; --wash: #eaf0e6; --bg: #f7f8f4; --paper: #fcfdf9; --refused: #b3261e;
}
@media (prefers-color-scheme: dark) {
  :root { --ink: #e0e8df; --muted: #9ca99e; --line: #303c32; --green: #9bc99d; --wash: #29392c; --bg: #151c18; --paper: #1b241e; --refused: #f2b8b5; }
}
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 system-ui, sans-serif; }
.posts { max-width: 560px; margin: 0 auto; padding: 64px 24px 40px; }
.posts h1 { margin: 0 0 24px; font-size: 20px; font-weight: 600; }
.posts form { display: grid; gap: 8px; padding: 20px; background: var(--paper); border: 1px solid var(--line); border-radius: 12px; }
.posts input, .posts textarea, .posts select { font: inherit; color: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); }
.posts textarea { min-height: 90px; resize: vertical; }
.posts small { margin-top: -4px; color: var(--refused); font-size: 12px; }
.posts button { font: inherit; font-weight: 600; cursor: pointer; border: 0; border-radius: 8px; padding: 8px 14px; background: var(--green); color: var(--bg); }
.posts form button { justify-self: start; margin-top: 4px; }
.posts ul { list-style: none; margin: 24px 0 0; padding: 0; }
.posts li { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px 4px; border-bottom: 1px solid var(--line); }
.posts li span { color: var(--muted); font-size: 13px; }
.posts li span:last-of-type { margin-right: auto; }
.posts li button { padding: 4px 10px; font-size: 13px; background: var(--wash); color: var(--green); }
.posts li button.delete { background: transparent; color: var(--muted); }
.posts .refused { margin-top: 16px; color: var(--refused); }
</style>
