import { $ as store_get, a0 as unsubscribe_stores, a1 as bind_props } from "../../../../../chunks/index2.js";
import { p as page } from "../../../../../chunks/stores.js";
import _page$1 from "../../_page.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let workspaceSlug;
    let data = $$props["data"];
    workspaceSlug = store_get($$store_subs ??= {}, "$page", page).params.workspace ?? null;
    _page$1($$renderer2, { data, initialSection: "slack", initialSlug: workspaceSlug });
    if ($$store_subs) unsubscribe_stores($$store_subs);
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
