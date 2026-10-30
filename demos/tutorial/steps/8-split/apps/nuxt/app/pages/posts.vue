<script setup lang="ts">
import { post } from '@fronds/facade';
import Post from '@fronds/blog/entities/Post.js';

const { items } = await useQuery(post, 'list');
const { fields, values, errors, submit } = useFormFor(Post);
const publish = useCommand(post, 'publish');
</script>

<template>
  <form novalidate @submit.prevent="submit">
    <template v-for="field in fields" :key="field.name">
      <input v-model="values[field.name]" v-bind="field.attrs" :placeholder="field.label" />
      <small v-if="errors[field.name]">{{ errors[field.name] }}</small>
    </template>
    <button>Write a draft</button>
  </form>

  <ul>
    <li v-for="row in items" :key="row.id">
      {{ row.title }} — {{ row.status }}
      <button v-if="row.status === 'draft'" @click="publish.execute({ params: { id: row.id } })">Publish</button>
    </li>
  </ul>
  <p v-if="publish.error.value">{{ publish.error.value.message }}</p>
</template>
