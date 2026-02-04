export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["opencode.png","slack-logo.svg"]),
	mimeTypes: {".png":"image/png",".svg":"image/svg+xml"},
	_: {
		client: {start:"_app/immutable/entry/start.DbWs7ujc.js",app:"_app/immutable/entry/app.f3zHSXQz.js",imports:["_app/immutable/entry/start.DbWs7ujc.js","_app/immutable/chunks/6YkFPHVi.js","_app/immutable/chunks/CjGhIqWY.js","_app/immutable/chunks/DIgV381B.js","_app/immutable/entry/app.f3zHSXQz.js","_app/immutable/chunks/CjGhIqWY.js","_app/immutable/chunks/BsY-cmAL.js","_app/immutable/chunks/C75JsWfY.js","_app/immutable/chunks/ChLsQDHE.js","_app/immutable/chunks/DIgV381B.js","_app/immutable/chunks/BIiqL5z4.js","_app/immutable/chunks/B8BZfU01.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js')),
			__memo(() => import('./nodes/8.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/local-setting",
				pattern: /^\/local-setting\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/local-setting/opencode/[server]",
				pattern: /^\/local-setting\/opencode\/([^/]+?)\/?$/,
				params: [{"name":"server","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/local-setting/profile",
				pattern: /^\/local-setting\/profile\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/local-setting/slack-bot/[workspace]",
				pattern: /^\/local-setting\/slack-bot\/([^/]+?)\/?$/,
				params: [{"name":"workspace","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/[...rest]",
				pattern: /^(?:\/([^]*))?\/?$/,
				params: [{"name":"rest","optional":false,"rest":true,"chained":true}],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
