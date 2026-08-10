import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter()
		})
	],
	/**
	 * The scan reads frond sources off disk through jiti at boot, so they must not be
	 * bundled. Same statement as `serverExternalPackages` in the Next demo.
	 */
	ssr: {
		external: [
			'@fougere/app',
			'@fougere/core',
			'@fougere/schema',
			'@fougere/schema-sql',
			'better-sqlite3',
			'jiti',
			'typescript'
		]
	}
});
