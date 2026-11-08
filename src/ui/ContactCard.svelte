<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import type { Session } from '../loader/client';
  import Icon from './Icon.svelte';
  import { parseVCards, type Contact } from './vcard';
  import { visible } from './visible';

  let { file, session }: { file: string; session: Session } = $props();
  let cards = $state.raw<Contact[] | null>(null);

  async function load() {
    const doc = await session.doc(file);
    cards = doc?.kind === 'text' ? parseVCards(doc.text) : [];
  }
</script>

<div class="contacts" use:visible={load} aria-label={t('media.contact')}>
  {#each cards ?? [] as c, i (i)}
    <div class="card">
      <span class="avatar" aria-hidden="true"><Icon name="users" size={18} /></span>
      <div class="lines">
        <strong>{c.name}</strong>
        {#if c.org}<span>{c.org}</span>{/if}
        {#each c.phones as phone, k (k)}<span class="value">{phone}</span>{/each}
        {#each c.emails as email, k (k)}<span class="value">{email}</span>{/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .contacts {
    display: grid;
    gap: 4px;
    max-width: 330px;
    margin: 2px 0 4px;
  }

  .card {
    display: flex;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--text) 6%, transparent);
  }

  .avatar {
    display: grid;
    place-items: center;
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--accent);
  }

  .lines {
    display: grid;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .lines span {
    color: var(--muted);
    font-size: 0.85rem;
  }

  .value {
    font-variant-numeric: tabular-nums;
  }
</style>
