import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Use adapter-static for Cloudflare Pages
		adapter: adapter({
			// default options are shown
			pages: "build",
			assets: "build",
			fallback: undefined,
			precompress: true, // Enable precompression for better performance
			strict: true,
		}),
	},
};

export default config;
