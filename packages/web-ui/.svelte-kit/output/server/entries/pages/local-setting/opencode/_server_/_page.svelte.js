import { $ as store_get, a0 as unsubscribe_stores, a1 as bind_props } from "../../../../../chunks/index2.js";
import { p as page } from "../../../../../chunks/stores.js";
import _page$1 from "../../_page.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let serverSlug;
    let data = $$props["data"];
    serverSlug = store_get($$store_subs ??= {}, "$page", page).params.server ?? null;
    _page$1($$renderer2, { data, initialSection: "dev", initialSlug: serverSlug });
    if ($$store_subs) unsubscribe_stores($$store_subs);
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
