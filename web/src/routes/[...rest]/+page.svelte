<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  onMount(() => {
    void goto("/local-setting", { replaceState: true });
  });
</script>

<main class="redirect">
  <p>Redirecting to settings...</p>
</main>

<style>
  .redirect {
    font-family: "Manrope", sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    color: #2f2f35;
    background: #f5f3ee;
  }
</style>
