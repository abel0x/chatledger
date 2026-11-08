<script lang="ts">
  let { message }: { message: string | null } = $props();
</script>

<div class="toast-region" role="status" aria-live="polite">
  {#if message}<div class="toast">{message}</div>{/if}
</div>

<style>
  .toast-region {
    position: fixed;
    left: 50%;
    bottom: 24px;
    z-index: 40;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .toast {
    padding: 8px 16px;
    border-radius: 999px;
    background: var(--text);
    color: var(--bg);
    font-size: 0.88rem;
    box-shadow: 0 2px 8px #0b141a40;
  }
</style>
