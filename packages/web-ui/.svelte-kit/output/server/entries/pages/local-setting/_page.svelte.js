import { a2 as sanitize_props, a3 as rest_props, a4 as attributes, a5 as clsx, a6 as ensure_array_like, a7 as element, a8 as slot, a1 as bind_props, a9 as spread_props, _ as attr, aa as attr_class, ab as stringify } from "../../../chunks/index2.js";
import { f as fallback } from "../../../chunks/utils2.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/state.svelte.js";
import { e as escape_html } from "../../../chunks/context.js";
const defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
};
function Icon($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  const $$restProps = rest_props($$sanitized_props, [
    "name",
    "color",
    "size",
    "strokeWidth",
    "absoluteStrokeWidth",
    "iconNode"
  ]);
  $$renderer.component(($$renderer2) => {
    let name = fallback($$props["name"], void 0);
    let color = fallback($$props["color"], "currentColor");
    let size = fallback($$props["size"], 24);
    let strokeWidth = fallback($$props["strokeWidth"], 2);
    let absoluteStrokeWidth = fallback($$props["absoluteStrokeWidth"], false);
    let iconNode = fallback($$props["iconNode"], () => [], true);
    const mergeClasses = (...classes) => classes.filter((className, index, array) => {
      return Boolean(className) && array.indexOf(className) === index;
    }).join(" ");
    $$renderer2.push(`<svg${attributes(
      {
        ...defaultAttributes,
        ...$$restProps,
        width: size,
        height: size,
        stroke: color,
        "stroke-width": absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth,
        class: clsx(mergeClasses("lucide-icon", "lucide", name ? `lucide-${name}` : "", $$sanitized_props.class))
      },
      void 0,
      void 0,
      void 0,
      3
    )}><!--[-->`);
    const each_array = ensure_array_like(iconNode);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let [tag, attrs] = each_array[$$index];
      element($$renderer2, tag, () => {
        $$renderer2.push(`${attributes({ ...attrs }, void 0, void 0, void 0, 3)}`);
      });
    }
    $$renderer2.push(`<!--]--><!--[-->`);
    slot($$renderer2, $$props, "default", {});
    $$renderer2.push(`<!--]--></svg>`);
    bind_props($$props, {
      name,
      color,
      size,
      strokeWidth,
      absoluteStrokeWidth,
      iconNode
    });
  });
}
function Chevron_down($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  const iconNode = [["path", { "d": "m6 9 6 6 6-6" }]];
  Icon($$renderer, spread_props([
    { name: "chevron-down" },
    $$sanitized_props,
    {
      /**
       * @component @name ChevronDown
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJtNiA5IDYgNiA2LTYiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/chevron-down
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$renderer2) => {
        $$renderer2.push(`<!--[-->`);
        slot($$renderer2, $$props, "default", {});
        $$renderer2.push(`<!--]-->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Moon($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  const iconNode = [
    [
      "path",
      {
        "d": "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"
      }
    ]
  ];
  Icon($$renderer, spread_props([
    { name: "moon" },
    $$sanitized_props,
    {
      /**
       * @component @name Moon
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMjAuOTg1IDEyLjQ4NmE5IDkgMCAxIDEtOS40NzMtOS40NzJjLjQwNS0uMDIyLjYxNy40Ni40MDIuODAzYTYgNiAwIDAgMCA4LjI2OCA4LjI2OGMuMzQ0LS4yMTUuODI1LS4wMDQuODAzLjQwMSIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/moon
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$renderer2) => {
        $$renderer2.push(`<!--[-->`);
        slot($$renderer2, $$props, "default", {});
        $$renderer2.push(`<!--]-->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Plus($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  const iconNode = [["path", { "d": "M5 12h14" }], ["path", { "d": "M12 5v14" }]];
  Icon($$renderer, spread_props([
    { name: "plus" },
    $$sanitized_props,
    {
      /**
       * @component @name Plus
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNNSAxMmgxNCIgLz4KICA8cGF0aCBkPSJNMTIgNXYxNCIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/plus
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$renderer2) => {
        $$renderer2.push(`<!--[-->`);
        slot($$renderer2, $$props, "default", {});
        $$renderer2.push(`<!--]-->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Refresh_cw($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  const iconNode = [
    [
      "path",
      { "d": "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }
    ],
    ["path", { "d": "M21 3v5h-5" }],
    [
      "path",
      { "d": "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }
    ],
    ["path", { "d": "M8 16H3v5" }]
  ];
  Icon($$renderer, spread_props([
    { name: "refresh-cw" },
    $$sanitized_props,
    {
      /**
       * @component @name RefreshCw
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMyAxMmE5IDkgMCAwIDEgOS05IDkuNzUgOS43NSAwIDAgMSA2Ljc0IDIuNzRMMjEgOCIgLz4KICA8cGF0aCBkPSJNMjEgM3Y1aC01IiAvPgogIDxwYXRoIGQ9Ik0yMSAxMmE5IDkgMCAwIDEtOSA5IDkuNzUgOS43NSAwIDAgMS02Ljc0LTIuNzRMMyAxNiIgLz4KICA8cGF0aCBkPSJNOCAxNkgzdjUiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/refresh-cw
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$renderer2) => {
        $$renderer2.push(`<!--[-->`);
        slot($$renderer2, $$props, "default", {});
        $$renderer2.push(`<!--]-->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Settings($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  const iconNode = [
    [
      "path",
      {
        "d": "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"
      }
    ],
    ["circle", { "cx": "12", "cy": "12", "r": "3" }]
  ];
  Icon($$renderer, spread_props([
    { name: "settings" },
    $$sanitized_props,
    {
      /**
       * @component @name Settings
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNOS42NzEgNC4xMzZhMi4zNCAyLjM0IDAgMCAxIDQuNjU5IDAgMi4zNCAyLjM0IDAgMCAwIDMuMzE5IDEuOTE1IDIuMzQgMi4zNCAwIDAgMSAyLjMzIDQuMDMzIDIuMzQgMi4zNCAwIDAgMCAwIDMuODMxIDIuMzQgMi4zNCAwIDAgMS0yLjMzIDQuMDMzIDIuMzQgMi4zNCAwIDAgMC0zLjMxOSAxLjkxNSAyLjM0IDIuMzQgMCAwIDEtNC42NTkgMCAyLjM0IDIuMzQgMCAwIDAtMy4zMi0xLjkxNSAyLjM0IDIuMzQgMCAwIDEtMi4zMy00LjAzMyAyLjM0IDIuMzQgMCAwIDAgMC0zLjgzMUEyLjM0IDIuMzQgMCAwIDEgNi4zNSA2LjA1MWEyLjM0IDIuMzQgMCAwIDAgMy4zMTktMS45MTUiIC8+CiAgPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMyIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/settings
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$renderer2) => {
        $$renderer2.push(`<!--[-->`);
        slot($$renderer2, $$props, "default", {});
        $$renderer2.push(`<!--]-->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Sun($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "4" }],
    ["path", { "d": "M12 2v2" }],
    ["path", { "d": "M12 20v2" }],
    ["path", { "d": "m4.93 4.93 1.41 1.41" }],
    ["path", { "d": "m17.66 17.66 1.41 1.41" }],
    ["path", { "d": "M2 12h2" }],
    ["path", { "d": "M20 12h2" }],
    ["path", { "d": "m6.34 17.66-1.41 1.41" }],
    ["path", { "d": "m19.07 4.93-1.41 1.41" }]
  ];
  Icon($$renderer, spread_props([
    { name: "sun" },
    $$sanitized_props,
    {
      /**
       * @component @name Sun
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI0IiAvPgogIDxwYXRoIGQ9Ik0xMiAydjIiIC8+CiAgPHBhdGggZD0iTTEyIDIwdjIiIC8+CiAgPHBhdGggZD0ibTQuOTMgNC45MyAxLjQxIDEuNDEiIC8+CiAgPHBhdGggZD0ibTE3LjY2IDE3LjY2IDEuNDEgMS40MSIgLz4KICA8cGF0aCBkPSJNMiAxMmgyIiAvPgogIDxwYXRoIGQ9Ik0yMCAxMmgyIiAvPgogIDxwYXRoIGQ9Im02LjM0IDE3LjY2LTEuNDEgMS40MSIgLz4KICA8cGF0aCBkPSJtMTkuMDcgNC45My0xLjQxIDEuNDEiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/sun
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$renderer2) => {
        $$renderer2.push(`<!--[-->`);
        slot($$renderer2, $$props, "default", {});
        $$renderer2.push(`<!--]-->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function ThemeToggle($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let isDarkMode = false;
    $$renderer2.push(`<button class="theme-toggle svelte-1cmi4dh" type="button"${attr("aria-pressed", isDarkMode)} aria-label="Toggle dark mode"><span class="toggle-track svelte-1cmi4dh"><span class="toggle-thumb svelte-1cmi4dh">`);
    Sun($$renderer2, { class: "toggle-icon sun", "stroke-width": 1.8 });
    $$renderer2.push(`<!----> `);
    Moon($$renderer2, { class: "toggle-icon moon", "stroke-width": 1.8 });
    $$renderer2.push(`<!----></span></span></button>`);
  });
}
const defaultDashboardConfig = {
  user: {
    name: "",
    email: "",
    githubToken: "",
    defaultMessageFrequency: "medium"
  },
  devServers: [],
  workspaces: []
};
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let currentDevServer, currentWorkspace;
    let data = $$props["data"];
    let initialSection = fallback($$props["initialSection"], "profile");
    let initialSlug = fallback($$props["initialSlug"], null);
    const normalizeConfig = (config) => {
      const nextUser = { ...config.user };
      const nextDevServers = config.devServers.map((server) => ({ ...server, models: [...server.models] }));
      const nextDefaultDevServerId = nextDevServers[0]?.id ?? null;
      const nextWorkspaces = config.workspaces.map((workspace) => ({
        ...workspace,
        slackAppToken: workspace.slackAppToken ?? "",
        slackBotToken: workspace.slackBotToken ?? "",
        channelDetails: workspace.channelDetails.map((channel) => ({
          ...channel,
          devServerId: channel.devServerId ?? nextDefaultDevServerId
        }))
      }));
      return {
        user: nextUser,
        devServers: nextDevServers,
        workspaces: nextWorkspaces,
        defaultDevServerId: nextDefaultDevServerId
      };
    };
    const initialConfig = normalizeConfig(data?.config ?? defaultDashboardConfig);
    let user = { ...initialConfig.user };
    let devServers = initialConfig.devServers;
    let workspaces = initialConfig.workspaces;
    let modelOptions = [];
    const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    let activeSection = initialSection;
    let selectedDevServerId = null;
    let selectedWorkspaceId = null;
    let preferredDevServerId = null;
    let preferredWorkspaceId = null;
    let messageFrequency = user.defaultMessageFrequency;
    let isSaving = false;
    let isSyncingModels = false;
    let isSyncingSlack = false;
    let toasts = [];
    const ensureModelWithProvider = (model, devServerId) => {
      if (!model || model.includes("/")) return model;
      const serverModels = devServerId ? devServers.find((server) => server.id === devServerId)?.models ?? [] : modelOptions;
      const match = serverModels.find((item) => item.endsWith(`/${model}`) || item === model);
      return match ?? model;
    };
    const getChannelModels = (channel) => {
      const devServer = devServers.find((server) => server.id === channel.devServerId);
      if (devServer && devServer.models.length) {
        return devServer.models;
      }
      return modelOptions;
    };
    if (initialSection === "dev" && initialSlug && devServers.length) {
      preferredDevServerId = devServers.find((server) => slugify(server.name) === initialSlug || server.id === initialSlug)?.id ?? null;
    }
    if (devServers.length === 1) {
      const onlyServerId = devServers[0]?.id ?? null;
      if (onlyServerId) {
        workspaces = workspaces.map((workspace) => ({
          ...workspace,
          channelDetails: workspace.channelDetails.map((channel) => ({ ...channel, devServerId: channel.devServerId ?? onlyServerId }))
        }));
      }
    }
    if (initialSection === "slack" && initialSlug && workspaces.length) {
      preferredWorkspaceId = workspaces.find((workspace) => slugify(workspace.name) === initialSlug || workspace.id === initialSlug)?.id ?? null;
    }
    if (!selectedDevServerId && devServers.length) {
      selectedDevServerId = preferredDevServerId ?? devServers[0].id;
    }
    if (!selectedWorkspaceId && workspaces.length) {
      selectedWorkspaceId = preferredWorkspaceId ?? workspaces[0].id;
    }
    currentDevServer = devServers.find((server) => server.id === selectedDevServerId) ?? null;
    currentWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null;
    modelOptions = Array.from(/* @__PURE__ */ new Set([
      ...devServers.flatMap((server) => server.models),
      ...workspaces.flatMap((workspace) => workspace.channelDetails.map((channel) => channel.model))
    ])).sort();
    devServers[0]?.id ?? null;
    $$renderer2.push(`<main><div class="container svelte-1g3cqtl"><nav class="navbar svelte-1g3cqtl"><div class="navbar-spacer"></div> <div class="navbar-title svelte-1g3cqtl">Ode Setting</div> <div class="navbar-actions svelte-1g3cqtl">`);
    ThemeToggle($$renderer2);
    $$renderer2.push(`<!----></div></nav> <div class="main-layout svelte-1g3cqtl"><aside class="sidebar-card svelte-1g3cqtl"><div class="sidebar-content svelte-1g3cqtl"><button${attr_class(
      `sidebar-item ${stringify(
        // ignore parse errors
        activeSection === "profile" ? "active" : ""
      )}`,
      "svelte-1g3cqtl"
    )} type="button"><div class="sidebar-item-inner svelte-1g3cqtl">`);
    Settings($$renderer2, { size: 18 });
    $$renderer2.push(`<!----> <span>Profile</span></div></button> <div class="sidebar-group svelte-1g3cqtl"><button class="sidebar-group-header svelte-1g3cqtl" type="button"><div class="header-label svelte-1g3cqtl"><img src="/opencode.png" alt="" class="header-icon svelte-1g3cqtl"/> <span>Opencode Servers</span></div> `);
    Chevron_down($$renderer2, { size: 16, class: "" });
    $$renderer2.push(`<!----></button> `);
    {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="sidebar-sublist svelte-1g3cqtl"><!--[-->`);
      const each_array = ensure_array_like(devServers);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let server = each_array[$$index];
        $$renderer2.push(`<button${attr_class(`sidebar-subitem ${stringify(selectedDevServerId === server.id && activeSection === "dev" ? "active" : "")}`, "svelte-1g3cqtl")} type="button"><div class="indicator blue svelte-1g3cqtl"></div> <span>${escape_html(server.name)}</span></button>`);
      }
      $$renderer2.push(`<!--]--> <button class="sidebar-subitem add-btn svelte-1g3cqtl" type="button">`);
      Plus($$renderer2, { size: 14 });
      $$renderer2.push(`<!----> <span>Add Server</span></button></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="sidebar-group svelte-1g3cqtl"><button class="sidebar-group-header svelte-1g3cqtl" type="button"><div class="header-label svelte-1g3cqtl"><img src="/slack-logo.svg" alt="" class="header-icon svelte-1g3cqtl"/> <span>Slack Bot</span></div> `);
    Chevron_down($$renderer2, { size: 16, class: "" });
    $$renderer2.push(`<!----></button> `);
    {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="sidebar-sublist svelte-1g3cqtl"><!--[-->`);
      const each_array_1 = ensure_array_like(workspaces);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let workspace = each_array_1[$$index_1];
        $$renderer2.push(`<button${attr_class(`sidebar-subitem ${stringify(selectedWorkspaceId === workspace.id && activeSection === "slack" ? "active" : "")}`, "svelte-1g3cqtl")} type="button"><div class="indicator purple svelte-1g3cqtl"></div> <span>${escape_html(workspace.name)}</span></button>`);
      }
      $$renderer2.push(`<!--]--> `);
      if (workspaces.length === 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<button class="sidebar-subitem add-btn svelte-1g3cqtl" type="button">`);
        Plus($$renderer2, { size: 14 });
        $$renderer2.push(`<!----> <span>Add Slack Bot</span></button>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div></div></aside> <section class="content-area svelte-1g3cqtl">`);
    if (activeSection === "profile") {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="page-header svelte-1g3cqtl"><h1 class="svelte-1g3cqtl">Profile</h1></div> <div class="content-card svelte-1g3cqtl"><div class="profile-info svelte-1g3cqtl"><div class="info-field svelte-1g3cqtl"><label for="profile-name" class="svelte-1g3cqtl">Name</label> <input id="profile-name" type="text"${attr("value", user.name)} class="svelte-1g3cqtl"/></div> <div class="info-field svelte-1g3cqtl"><label for="profile-email" class="svelte-1g3cqtl">Email Address</label> <input id="profile-email" type="email"${attr("value", user.email)} class="svelte-1g3cqtl"/></div></div> <div class="input-field svelte-1g3cqtl"><label for="github-token" class="svelte-1g3cqtl">GitHub Access Token</label> <input id="github-token" type="password"${attr("value", user.githubToken)} class="svelte-1g3cqtl"/></div> <div class="message-freq-group svelte-1g3cqtl"><span class="message-freq-label svelte-1g3cqtl">Message Update Frequency</span> <div class="message-freq-toggle svelte-1g3cqtl"><!--[-->`);
      const each_array_2 = ensure_array_like(["aggressive", "medium", "minimum"]);
      for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
        let option = each_array_2[$$index_2];
        $$renderer2.push(`<button${attr_class(`message-freq-option ${stringify(messageFrequency === option ? "active" : "")}`, "svelte-1g3cqtl")} type="button">${escape_html(option.charAt(0).toUpperCase() + option.slice(1))}</button>`);
      }
      $$renderer2.push(`<!--]--></div></div></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
      if (activeSection === "dev") {
        $$renderer2.push("<!--[-->");
        if (currentDevServer) {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<div class="page-header svelte-1g3cqtl"><div class="header-main"><h1 class="svelte-1g3cqtl">${escape_html(currentDevServer.name)}</h1> <p class="svelte-1g3cqtl">Manage your dev server configuration</p></div></div> <div class="content-card svelte-1g3cqtl"><div class="input-field svelte-1g3cqtl"><label for="server-name" class="svelte-1g3cqtl">Name</label> <input id="server-name" type="text"${attr("value", currentDevServer.name)} class="svelte-1g3cqtl"/></div> <div class="input-field svelte-1g3cqtl"><label for="server-url" class="svelte-1g3cqtl">Server URL</label> <input id="server-url" type="text"${attr("value", currentDevServer.url)} class="svelte-1g3cqtl"/></div> <div class="models-section svelte-1g3cqtl"><div class="section-header svelte-1g3cqtl"><h2 class="svelte-1g3cqtl">Models</h2> <button class="btn-sync svelte-1g3cqtl" type="button"${attr("disabled", isSyncingModels, true)}>`);
          Refresh_cw($$renderer2, { size: 12, class: "" });
          $$renderer2.push(`<!----> <span>${escape_html("Sync Models")}</span></button></div> <div class="models-grid svelte-1g3cqtl"><!--[-->`);
          const each_array_3 = ensure_array_like(currentDevServer.models);
          for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
            let model = each_array_3[$$index_3];
            $$renderer2.push(`<div class="model-card svelte-1g3cqtl"><span class="model-name svelte-1g3cqtl">${escape_html(model)}</span> <span class="model-desc svelte-1g3cqtl">${escape_html(model.includes("gpt") ? "OpenAI" : model.includes("claude") ? "Anthropic" : model.includes("llama") ? "Meta" : "AI Model")}</span></div>`);
          }
          $$renderer2.push(`<!--]--></div></div></div>`);
        } else {
          $$renderer2.push("<!--[!-->");
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[!-->");
        if (activeSection === "slack") {
          $$renderer2.push("<!--[-->");
          if (currentWorkspace) {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<div class="content-card svelte-1g3cqtl"><div class="section-header svelte-1g3cqtl"><h2 class="svelte-1g3cqtl">Bot info</h2></div> <div class="input-field svelte-1g3cqtl"><label for="workspace-app-token" class="svelte-1g3cqtl">Slack App Token</label> <input id="workspace-app-token" type="password"${attr("value", currentWorkspace.slackAppToken ?? "")} class="svelte-1g3cqtl"/></div> <div class="input-field svelte-1g3cqtl"><label for="workspace-bot-token" class="svelte-1g3cqtl">Slack Bot Token</label> <input id="workspace-bot-token" type="password"${attr("value", currentWorkspace.slackBotToken ?? "")} class="svelte-1g3cqtl"/></div> <div class="card-actions svelte-1g3cqtl"><button class="btn-sync svelte-1g3cqtl" type="button"${attr("disabled", isSyncingSlack, true)}>`);
            Refresh_cw($$renderer2, { size: 12, class: "" });
            $$renderer2.push(`<!----> <span>${escape_html("Sync slack workspace")}</span></button></div></div> <div class="content-card workspace-card svelte-1g3cqtl"><div class="input-field svelte-1g3cqtl"><label for="workspace-name" class="svelte-1g3cqtl">Workspace name</label> <input id="workspace-name" type="text"${attr("value", currentWorkspace.name)} class="svelte-1g3cqtl"/></div> <div class="input-field svelte-1g3cqtl"><label for="workspace-domain" class="svelte-1g3cqtl">Domain</label> <input id="workspace-domain" type="text"${attr("value", currentWorkspace.domain)} class="svelte-1g3cqtl"/></div></div> <div class="channels-section svelte-1g3cqtl"><div class="section-header svelte-1g3cqtl"><h2 class="svelte-1g3cqtl">Channels</h2></div> <div class="channels-grid svelte-1g3cqtl"><!--[-->`);
            const each_array_4 = ensure_array_like(currentWorkspace.channelDetails);
            for (let $$index_6 = 0, $$length = each_array_4.length; $$index_6 < $$length; $$index_6++) {
              let channel = each_array_4[$$index_6];
              $$renderer2.push(`<div class="content-card channel-card svelte-1g3cqtl"><div class="channel-info svelte-1g3cqtl"><div class="channel-title svelte-1g3cqtl">${escape_html(channel.name)}</div> <div class="field-static svelte-1g3cqtl">ID: ${escape_html(channel.id)}</div></div> <div class="channel-controls svelte-1g3cqtl"><div class="input-field svelte-1g3cqtl"><label${attr("for", `channel-server-${stringify(channel.id)}`)} class="svelte-1g3cqtl">Dev Server</label> `);
              $$renderer2.select(
                {
                  id: `channel-server-${stringify(channel.id)}`,
                  value: channel.devServerId ?? "",
                  class: ""
                },
                ($$renderer3) => {
                  if (devServers.length > 1) {
                    $$renderer3.push("<!--[-->");
                    $$renderer3.option({ value: "" }, ($$renderer4) => {
                      $$renderer4.push(`Select a server`);
                    });
                  } else {
                    $$renderer3.push("<!--[!-->");
                  }
                  $$renderer3.push(`<!--]--><!--[-->`);
                  const each_array_5 = ensure_array_like(devServers);
                  for (let $$index_4 = 0, $$length2 = each_array_5.length; $$index_4 < $$length2; $$index_4++) {
                    let server = each_array_5[$$index_4];
                    $$renderer3.option({ value: server.id }, ($$renderer4) => {
                      $$renderer4.push(`${escape_html(server.name)}`);
                    });
                  }
                  $$renderer3.push(`<!--]-->`);
                },
                "svelte-1g3cqtl"
              );
              $$renderer2.push(`</div> <div class="input-field svelte-1g3cqtl"><label${attr("for", `channel-model-${stringify(channel.id)}`)} class="svelte-1g3cqtl">Model</label> `);
              $$renderer2.select(
                {
                  id: `channel-model-${stringify(channel.id)}`,
                  value: ensureModelWithProvider(channel.model, channel.devServerId ?? null),
                  class: ""
                },
                ($$renderer3) => {
                  $$renderer3.push(`<!--[-->`);
                  const each_array_6 = ensure_array_like(getChannelModels(channel));
                  for (let $$index_5 = 0, $$length2 = each_array_6.length; $$index_5 < $$length2; $$index_5++) {
                    let model = each_array_6[$$index_5];
                    $$renderer3.option({ value: model }, ($$renderer4) => {
                      $$renderer4.push(`${escape_html(model)}`);
                    });
                  }
                  $$renderer3.push(`<!--]-->`);
                },
                "svelte-1g3cqtl"
              );
              $$renderer2.push(`</div></div> <div class="input-field svelte-1g3cqtl"><label${attr("for", `channel-dir-${stringify(channel.id)}`)} class="svelte-1g3cqtl">Working directory</label> <input${attr("id", `channel-dir-${stringify(channel.id)}`)} type="text"${attr("value", channel.workingDirectory)} class="svelte-1g3cqtl"/></div></div>`);
            }
            $$renderer2.push(`<!--]--></div></div>`);
          } else {
            $$renderer2.push("<!--[!-->");
          }
          $$renderer2.push(`<!--]-->`);
        } else {
          $$renderer2.push("<!--[!-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--> <div class="content-toolbar svelte-1g3cqtl"><div class="toolbar-main"><h1 class="svelte-1g3cqtl">Local mode</h1> <p class="svelte-1g3cqtl">Config stored at \`~/.config/ode/ode.json\`</p></div> <div class="toolbar-actions svelte-1g3cqtl">`);
    if (activeSection === "dev" && currentDevServer) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<button class="btn-danger svelte-1g3cqtl" type="button">Delete Server</button>`);
    } else {
      $$renderer2.push("<!--[!-->");
      if (activeSection === "slack" && currentWorkspace) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<button class="btn-danger svelte-1g3cqtl" type="button">Delete Workspace</button>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--> `);
    if (activeSection === "profile") {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<button class="btn-primary svelte-1g3cqtl" type="button"${attr("disabled", isSaving, true)}>${escape_html("Save changes")}</button>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div></div></section></div></div> <div class="toast-viewport svelte-1g3cqtl" aria-live="polite"><!--[-->`);
    const each_array_7 = ensure_array_like(toasts);
    for (let $$index_7 = 0, $$length = each_array_7.length; $$index_7 < $$length; $$index_7++) {
      let toast = each_array_7[$$index_7];
      $$renderer2.push(`<div${attr_class(`toast ${stringify(toast.variant === "destructive" ? "toast-destructive" : "")}`, "svelte-1g3cqtl")}><div class="toast-title svelte-1g3cqtl">${escape_html(toast.title)}</div> `);
      if (toast.description) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="toast-description svelte-1g3cqtl">${escape_html(toast.description)}</div>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></main>`);
    bind_props($$props, { data, initialSection, initialSlug });
  });
}
export {
  _page as default
};
