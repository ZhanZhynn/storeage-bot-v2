import { a1 as bind_props } from "../../../../chunks/index2.js";
import _page$1 from "../_page.svelte.js";
function _page($$renderer, $$props) {
  let data = $$props["data"];
  _page$1($$renderer, { data, initialSection: "profile" });
  bind_props($$props, { data });
}
export {
  _page as default
};
