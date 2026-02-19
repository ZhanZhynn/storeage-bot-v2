<script lang="ts">
  import { cn } from "$lib/utils";

  export let className = "";
</script>

<section
  class={cn(
    "rounded-xl border border-[hsl(var(--border)/0.75)] bg-[hsl(var(--card)/0.74)] text-[hsl(var(--card-foreground))] shadow-sm backdrop-blur-md backdrop-saturate-150",
    className
  )}
  {...$$restProps}
>
  <slot />
</section>
