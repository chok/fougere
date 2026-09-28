<script setup lang="ts">
import { post } from '@fronds/facade';
import Post from '@fronds/__frond__/entities/Post';

const { items } = await useQuery(post, 'list');
const { values, errors, submit } = useFormFor(Post);
const publish = useCommand(post, 'publish');
const publishOne = (id: string) => publish.execute({ params: { id } }).catch(() => {});
</script>

<template>
  <main>
    <h1>Posts</h1>
    <form @submit.prevent="submit">
      <input v-model="values.title" placeholder="Title" />
      <small v-if="errors.title">{{ errors.title }}</small>
      <textarea v-model="values.body" placeholder="Body" />
      <small v-if="errors.body">{{ errors.body }}</small>
      <button>Create draft</button>
    </form>
    <ul>
      <li v-for="row in items" :key="row.id">
        {{ row.title }} — {{ row.status }}
        <button v-if="row.status === 'draft'" @click="publishOne(row.id)">Publish</button>
      </li>
    </ul>
    <p v-if="publish.error.value">{{ publish.error.value.message }}</p>
  </main>
</template>
