<script lang="ts">
  import type { ParameterId, ParameterMetadata } from '$lib/generated';
  import type { ParameterController } from '$lib/parameter-store';
  import { formatParameterValue } from '$lib/parameter-values';

  export let parameter: ParameterMetadata;
  export let normalizedValue: number;
  export let controller: ParameterController;

  let gestureActive = false;

  function beginGesture(): void {
    if (gestureActive) return;
    gestureActive = true;
    controller.beginGesture(parameter.id);
  }

  function endGesture(): void {
    if (!gestureActive) return;
    gestureActive = false;
    controller.endGesture(parameter.id);
  }

  function updateContinuous(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const needsGesture = !gestureActive;
    if (needsGesture) beginGesture();
    controller.updateNormalized(parameter.id, Number(input.value));
    if (needsGesture) endGesture();
  }

  function updateBoolean(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    controller.setDiscrete(parameter.id, input.checked ? 1 : 0);
  }

  function updateChoice(event: Event): void {
    const select = event.currentTarget as HTMLSelectElement;
    controller.setDiscrete(parameter.id, Number(select.value));
  }

  function choiceValue(index: number, count: number): number {
    return count <= 1 ? 0 : index / (count - 1);
  }

  function parameterId(id: ParameterId): string {
    return `parameter-${id.replaceAll(/[^A-Za-z0-9_-]/g, '-')}`;
  }
</script>

<div class="control" class:toggle={parameter.type === 'boolean'}>
  <div class="control-heading">
    <label for={parameterId(parameter.id)}>{parameter.name}</label>
    <output>{formatParameterValue(parameter, normalizedValue)}</output>
  </div>

  {#if parameter.type === 'boolean'}
    <input
      id={parameterId(parameter.id)}
      class="switch"
      type="checkbox"
      checked={normalizedValue >= 0.5}
      onchange={updateBoolean}
    />
  {:else if parameter.type === 'choice'}
    <select id={parameterId(parameter.id)} value={normalizedValue} onchange={updateChoice}>
      {#each parameter.choices ?? [] as choice, index}
        <option value={choiceValue(index, parameter.choices?.length ?? 0)}>{choice}</option>
      {/each}
    </select>
  {:else}
    <input
      id={parameterId(parameter.id)}
      type="range"
      min="0"
      max="1"
      step={parameter.type === 'integer' && parameter.min !== null && parameter.max !== null
        ? 1 / (parameter.max - parameter.min)
        : 0.001}
      value={normalizedValue}
      onpointerdown={beginGesture}
      onpointerup={endGesture}
      onpointercancel={endGesture}
      onkeydown={beginGesture}
      onkeyup={endGesture}
      onblur={endGesture}
      oninput={updateContinuous}
    />
  {/if}
</div>

<style>
  .control {
    display: grid;
    gap: 12px;
    padding: 18px 0;
    border-top: 1px solid #34382f;
  }

  .control-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 20px;
  }

  label {
    color: #dfe3d8;
    font-size: 0.9rem;
    font-weight: 580;
  }

  output {
    color: #a9c980;
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 0.78rem;
  }

  input[type='range'] {
    width: 100%;
    accent-color: #a9c980;
  }

  select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #454b3e;
    border-radius: 4px;
    background: #171a15;
    color: #edf0e7;
    font: inherit;
  }

  .toggle {
    grid-template-columns: 1fr auto;
    align-items: center;
  }

  .toggle .control-heading {
    display: grid;
    gap: 4px;
  }

  .switch {
    width: 20px;
    height: 20px;
    accent-color: #a9c980;
  }
</style>
