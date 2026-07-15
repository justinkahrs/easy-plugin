<script lang="ts">
  import { presetConfiguration, type PresetInfo } from '$lib/generated';
  import type { PresetStatus, StatePresetController } from '$lib/state-preset-store';

  export let controller: StatePresetController;
  export let presets: readonly PresetInfo[];
  export let current: PresetStatus;
  export let analyzerEnabled: boolean;

  let name = '';
  let category: string = presetConfiguration.categories[0] ?? '';

  function load(event: Event): void {
    const id = (event.currentTarget as HTMLSelectElement).value;
    if (id !== '') controller.loadPreset(id);
  }

  function save(event: SubmitEvent): void {
    event.preventDefault();
    controller.savePreset(name, category === '' ? undefined : category);
    name = '';
  }

  function deleteCurrent(): void {
    if (current.id !== undefined) controller.deletePreset(current.id);
  }

  function setAnalyzer(event: Event): void {
    controller.setField('analyzerEnabled', (event.currentTarget as HTMLInputElement).checked);
  }

  function isCurrentFactory(): boolean {
    return presets.find((preset) => preset.id === current.id)?.factory ?? false;
  }
</script>

<section class="preset-browser" aria-labelledby="preset-heading">
  <div class="heading">
    <div>
      <p class="eyebrow">State & presets</p>
      <h2 id="preset-heading">{current.name ?? 'Unsaved state'}{current.dirty ? ' •' : ''}</h2>
    </div>
    <button
      type="button"
      class="delete"
      disabled={current.id === undefined || isCurrentFactory()}
      onclick={deleteCurrent}
    >Delete</button>
  </div>

  <label class="field">
    <span>Preset</span>
    <select value={current.id ?? ''} onchange={load}>
      <option value="">Choose a preset</option>
      {#each presets as preset (preset.id)}
        <option value={preset.id}>{preset.factory ? 'Factory / ' : 'User / '}{preset.name}</option>
      {/each}
    </select>
  </label>

  <form onsubmit={save}>
    <label class="field">
      <span>Save current state</span>
      <input bind:value={name} maxlength="80" required placeholder="Preset name" />
    </label>
    <div class="save-row">
      <select bind:value={category} aria-label="Preset category">
        {#each presetConfiguration.categories as value}
          <option value={value}>{value}</option>
        {/each}
      </select>
      <button type="submit">Save</button>
    </div>
  </form>

  <label class="toggle-row">
    <span><strong>Analyzer processing</strong><small>Persistent plugin state</small></span>
    <input type="checkbox" checked={analyzerEnabled} onchange={setAnalyzer} />
  </label>
</section>

<style>
  .preset-browser { display: grid; gap: 18px; padding: 30px; border-top: 1px solid #30342b; }
  .heading, .save-row, .toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .eyebrow { margin: 0 0 6px; color: #899080; font-size: 0.68rem; font-weight: 650; letter-spacing: 0.1em; text-transform: uppercase; }
  h2 { margin: 0; font-size: 1rem; font-weight: 580; }
  .field { display: grid; gap: 7px; }
  .field span, small { color: #899080; font-size: 0.72rem; }
  input, select, button { font: inherit; }
  input, select { width: 100%; padding: 9px 10px; border: 1px solid #454b3e; border-radius: 3px; background: #171a15; color: #edf0e7; }
  form { display: grid; gap: 9px; }
  button { padding: 9px 12px; border: 1px solid #59634c; border-radius: 3px; background: #a9c980; color: #11150e; cursor: pointer; }
  button.delete { padding: 6px 9px; background: transparent; color: #b8bdb2; }
  button:disabled { cursor: default; opacity: 0.35; }
  .save-row select { flex: 1; }
  .toggle-row span { display: grid; gap: 3px; }
  .toggle-row strong { font-size: 0.82rem; font-weight: 570; }
  .toggle-row input { width: 18px; height: 18px; accent-color: #a9c980; }
</style>
