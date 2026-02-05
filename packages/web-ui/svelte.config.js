import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		alias: {
			'@': resolve(dirname(fileURLToPath(import.meta.url)), '../')
		},
		adapter: adapter({
			fallback: 'index.html',
			strict: false
		}),
		prerender: {
			handleUnseenRoutes: 'ignore'
		}
	}
};

export default config;
