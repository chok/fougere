<script setup lang="ts">
import { ErrorCode } from '@fougere/core/contract';
import Post from '@fronds/blog/entities/Post';
import { post as postFacade } from '@fronds/facade';

const route = useRoute();
const id = route.params.id as string;

const { data: post, loading: pending } = await useQuery(postFacade, 'findById', { params: { id } });
const del = useCommand(postFacade, 'delete');
const publish = useCommand(postFacade, 'publish');

async function destroy() {
  if (!confirm('Delete this post?')) return;
  await del.execute({ params: { id } });
  navigateTo('/blog/posts');
}

/**
 * What `publish` can refuse — read off the handler, not written here.
 *
 * `@fronds/facade` carries `ErrorCode.UNAUTHORIZED | NOT_FOUND | FORBIDDEN | CONFLICT |
 * SERVICE_UNAVAILABLE | BAD_REQUEST`, walked from the four `throw` sites in `PostHandler`
 * plus what the framework adds from `kind`. Add a fifth refusal there and this `switch`
 * stops compiling: `assertNever` receives a code it was never given a case for.
 */
type Refused = NonNullable<typeof publish.error.value>['code'];

function reasonFor(code: Refused): string {
  switch (code) {
    case ErrorCode.UNAUTHORIZED: return 'Sign in to publish this post.';
    case ErrorCode.FORBIDDEN: return 'Only the author can publish it.';
    case ErrorCode.NOT_FOUND: return 'This post no longer exists.';
    case ErrorCode.CONFLICT: return 'It is already published.';
    case ErrorCode.BAD_REQUEST: return 'The server refused what was sent.';
    case ErrorCode.SERVICE_UNAVAILABLE: return 'The blog is restarting — try again in a moment.';
    default: return assertNever(code);
  }
}

/** Only reachable with a code the switch has no case for, which is why it does not compile. */
function assertNever(code: never): never {
  throw new Error(`Unhandled refusal: ${String(code)}`);
}

async function doPublish() {
  // `execute` rejects AND stores; the page reads the ref, so nothing is swallowed.
  await publish.execute({ params: { id } }).catch(() => undefined);
}
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6">
    <div class="flex items-center gap-2 text-sm text-muted">
      <NuxtLink to="/blog/posts" class="hover:text-highlighted">Posts</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="size-4" />
      <span class="text-highlighted">{{ post?.title ?? '...' }}</span>
    </div>

    <div v-if="pending" class="py-8 text-center text-muted">Loading...</div>
    <div v-else-if="!post" class="py-8 text-center text-muted">Post not found</div>
    <template v-else>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold text-highlighted">{{ post.title }}</h1>
          <UBadge
            v-if="post.status"
            :label="post.status"
            :color="post.status === 'published' ? 'success' : 'neutral'"
            variant="subtle"
          />
        </div>
        <div class="flex gap-2">
          <UButton
            v-if="post.status === 'draft'"
            label="Publish"
            icon="i-lucide-send"
            :loading="publish.loading.value"
            @click="doPublish"
          />
          <UButton :to="`/blog/posts/${id}/edit`" variant="soft" icon="i-lucide-pencil" label="Edit" />
          <UButton variant="soft" color="error" icon="i-lucide-trash-2" label="Delete" @click="destroy" />
        </div>
      </div>

      <UAlert
        v-if="publish.error.value"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="reasonFor(publish.error.value.code)"
        :description="`${publish.error.value.code} — read off PostHandler.publish, not written in this page`"
      />

      <div class="flex gap-3 text-sm text-muted">
        <span v-if="post.createdAt" class="flex items-center gap-1">
          <UIcon name="i-lucide-calendar" class="size-4" />
          {{ post.createdAt }}
        </span>
        <span v-if="post.authorId" class="flex items-center gap-1">
          <UIcon name="i-lucide-user" class="size-4" />
          {{ post.authorId }}
        </span>
      </div>

      <UCard>
        <div class="prose prose-sm max-w-none whitespace-pre-wrap text-highlighted">
          {{ post.body }}
        </div>
      </UCard>
    </template>
  </div>
</template>
