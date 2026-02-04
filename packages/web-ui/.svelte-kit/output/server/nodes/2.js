

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/fallbacks/layout.svelte.js')).default;
export const universal = {
  "ssr": false,
  "prerender": true
};
export const universal_id = "src/routes/local-setting/+layout.ts";
export const imports = ["_app/immutable/nodes/2.5hTcahJM.js","_app/immutable/chunks/ChLsQDHE.js","_app/immutable/chunks/CjGhIqWY.js","_app/immutable/chunks/CHzu8ezU.js","_app/immutable/chunks/B8BZfU01.js"];
export const stylesheets = [];
export const fonts = [];
