<script lang="ts">
  import { cn } from "$lib/utils";

  export let className = "";
  export let value: string | number = "";
</script>

<select
  bind:value
  class={cn(
    "flex h-10 w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    className
  )}
  on:change
  on:input
  on:focus
  on:blur
  {...$$restProps}
>
  <slot />
</select>
