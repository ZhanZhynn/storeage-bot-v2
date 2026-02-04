
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/local-setting" | "/local-setting/config" | "/local-setting/opencode" | "/local-setting/opencode/[server]" | "/local-setting/profile" | "/local-setting/slack-bot" | "/local-setting/slack-bot/[workspace]" | "/local-setting/slack-sync" | "/[...rest]";
		RouteParams(): {
			"/local-setting/opencode/[server]": { server: string };
			"/local-setting/slack-bot/[workspace]": { workspace: string };
			"/[...rest]": { rest: string }
		};
		LayoutParams(): {
			"/": { server?: string; workspace?: string; rest?: string };
			"/local-setting": { server?: string; workspace?: string };
			"/local-setting/config": Record<string, never>;
			"/local-setting/opencode": { server?: string };
			"/local-setting/opencode/[server]": { server: string };
			"/local-setting/profile": Record<string, never>;
			"/local-setting/slack-bot": { workspace?: string };
			"/local-setting/slack-bot/[workspace]": { workspace: string };
			"/local-setting/slack-sync": Record<string, never>;
			"/[...rest]": { rest: string }
		};
		Pathname(): "/" | "/local-setting" | "/local-setting/" | "/local-setting/config" | "/local-setting/config/" | "/local-setting/opencode" | "/local-setting/opencode/" | `/local-setting/opencode/${string}` & {} | `/local-setting/opencode/${string}/` & {} | "/local-setting/profile" | "/local-setting/profile/" | "/local-setting/slack-bot" | "/local-setting/slack-bot/" | `/local-setting/slack-bot/${string}` & {} | `/local-setting/slack-bot/${string}/` & {} | "/local-setting/slack-sync" | "/local-setting/slack-sync/" | `/${string}` & {} | `/${string}/` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/opencode.png" | "/slack-logo.svg" | string & {};
	}
}