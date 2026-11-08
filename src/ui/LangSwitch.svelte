<script lang="ts">
  import { lang, LANGS, setLang, t, type Lang } from '../i18n/index.svelte';
  import { translate } from '../i18n/translate';
</script>

<label class="lang">
  <span class="visually-hidden">{t('lang.label')}</span>
  <select value={lang()} onchange={e => setLang(e.currentTarget.value as Lang)}>
    {#each LANGS as l (l)}
      <option value={l} lang={l}>{translate(l, 'lang.name')}</option>
    {/each}
  </select>
</label>

<style>
  select {
    min-height: 36px;
    padding: 4px 8px;
    border: 1px solid var(--panel-border);
    border-radius: var(--radius);
    background: var(--panel);
    cursor: pointer;
  }
</style>
