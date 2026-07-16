<script lang="ts">
  import '@fontsource-variable/geist';
  import { onMount } from 'svelte';
  import { createRuntimeBridge, type RuntimeBridge } from '$lib/bridge';
  import ParameterControl from '$lib/components/ParameterControl.svelte';
  import PresetBrowser from '$lib/components/PresetBrowser.svelte';
  import VisualizationPanel from '$lib/components/VisualizationPanel.svelte';
  import {
    getParameterMetadata,
    svelteParameterGroups,
    svelteParameterMetadata,
    type SvelteParameterMetadata
  } from '$lib/generated';
  import {
    createParameterController,
    type ParameterController,
    type ParameterValues
  } from '$lib/parameter-store';
  import {
    createStatePresetController,
    type PresetStatus,
    type StatePresetController
  } from '$lib/state-preset-store';
  import type { PresetInfo } from '$lib/generated';
  import {
    createVisualizationController,
    type AnalyzerSnapshot,
    type VisualizationController
  } from '$lib/visualization-store';
  import type { MeterFrameEvent, TransportChangedEvent } from '$lib/bridge/types';

  let bridge: RuntimeBridge | undefined;
  let controller: ParameterController | undefined;
  let stateController: StatePresetController | undefined;
  let visualizationController: VisualizationController | undefined;
  let parameterValues = {} as ParameterValues;
  let pluginState: Readonly<Record<string, unknown>> = {};
  let presets: readonly PresetInfo[] = [];
  let currentPreset: PresetStatus = { dirty: false };
  let status: 'loading' | 'ready' | 'error' = 'loading';
  let errorMessage = '';
  let transport: TransportChangedEvent | undefined;
  let meters: MeterFrameEvent | undefined;
  let analyzer: AnalyzerSnapshot | undefined;

  const controls: readonly SvelteParameterMetadata[] = svelteParameterMetadata;
  const ungroupedControls = controls.filter((control) => control.groupId === null);

  onMount(() => {
    bridge = createRuntimeBridge();
    controller = createParameterController(bridge);
    stateController = createStatePresetController(bridge);
    visualizationController = createVisualizationController(bridge);
    let active = true;
    const unsubscribeValues = controller.values.subscribe((values) => {
      parameterValues = values;
    });
    const unsubscribeError = controller.error.subscribe((error) => {
      if (error !== undefined) errorMessage = `${error.code}: ${error.message}`;
    });
    const unsubscribePluginState = stateController.pluginState.subscribe((value) => {
      pluginState = value;
    });
    const unsubscribePresets = stateController.presets.subscribe((value) => {
      presets = value;
    });
    const unsubscribeCurrentPreset = stateController.currentPreset.subscribe((value) => {
      currentPreset = value;
    });
    const unsubscribeStateError = stateController.error.subscribe((error) => {
      if (error !== undefined) errorMessage = `${error.code}: ${error.message}`;
    });
    const unsubscribeTransport = visualizationController.transport.subscribe((value) => {
      transport = value;
    });
    const unsubscribeMeters = visualizationController.meters.subscribe((value) => {
      meters = value;
    });
    const unsubscribeAnalyzer = visualizationController.analyzer.subscribe((value) => {
      analyzer = value;
    });

    void Promise.all([
      controller.initialize(),
      stateController.initialize(),
      visualizationController.initialize()
    ])
      .then(() => {
        if (!active) return;
        status = 'ready';
      })
      .catch((error: unknown) => {
        if (!active) return;
        errorMessage = error instanceof Error ? error.message : 'The runtime bridge could not initialize.';
        status = 'error';
      });

    return () => {
      active = false;
      unsubscribeValues();
      unsubscribeError();
      unsubscribePluginState();
      unsubscribePresets();
      unsubscribeCurrentPreset();
      unsubscribeStateError();
      unsubscribeTransport();
      unsubscribeMeters();
      unsubscribeAnalyzer();
      controller?.dispose();
      stateController?.dispose();
      visualizationController?.dispose();
      bridge?.dispose();
    };
  });

</script>

<svelte:head>
  <title>Super Filter</title>
  <meta name="description" content="Manifest-generated JUCE parameters in a Svelte editor." />
</svelte:head>

<main>
  <header>
    <div class="header-meta">
      <p class="eyebrow">Example Audio / Super Filter</p>
      <div class="connection" class:ready={status === 'ready'}>
        <span aria-hidden="true"></span>
        {status === 'ready' ? 'Host synchronized' : status === 'error' ? 'Runtime error' : 'Awaiting snapshot'}
      </div>
    </div>
    <VisualizationPanel {transport} {meters} {analyzer} />
  </header>

  <section class="workspace" aria-label="Plugin parameters">
    <div class="parameter-panel">
      {#if status === 'loading'}
        <p class="empty-state">Connecting to native state…</p>
      {:else if status === 'error'}
        <div class="error-state" role="alert">
          <strong>Bridge initialization failed</strong>
          <p>{errorMessage}</p>
        </div>
      {:else if controller}
        {#each svelteParameterGroups as group}
          <section class="group" aria-labelledby={`group-${group.id}`}>
            <div class="group-heading">
              <h2 id={`group-${group.id}`}>{group.name}</h2>
              <span>{controls.filter((control) => control.groupId === group.id).length} controls</span>
            </div>
            {#each controls.filter((control) => control.groupId === group.id) as control (control.id)}
              <ParameterControl
                parameter={getParameterMetadata(control.id)}
                normalizedValue={parameterValues[control.id] ?? 0}
                {controller}
              />
            {/each}
          </section>
        {/each}

        {#if ungroupedControls.length > 0}
          <section class="group" aria-labelledby="group-other">
            <div class="group-heading"><h2 id="group-other">Other</h2></div>
            {#each ungroupedControls as control (control.id)}
              <ParameterControl
                parameter={getParameterMetadata(control.id)}
                normalizedValue={parameterValues[control.id] ?? 0}
                {controller}
              />
            {/each}
          </section>
        {/if}
      {/if}
    </div>

    <aside aria-label="State and presets">
      {#if errorMessage && status !== 'error'}
        <p class="inline-error" role="alert">{errorMessage}</p>
      {/if}

      {#if stateController && status === 'ready'}
        <PresetBrowser
          controller={stateController}
          {presets}
          current={currentPreset}
          analyzerEnabled={pluginState['analyzerEnabled'] === true}
        />
      {/if}
    </aside>
  </section>
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) {
    width: 100%;
    height: 100%;
    min-width: 320px;
    overflow: hidden;
    background: #10120f;
    color-scheme: dark;
    font-family: 'Geist Variable', system-ui, sans-serif;
  }
  :global(body) {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background:
      linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      #10120f;
    background-size: 44px 44px;
    color: #eef0e9;
  }
  :global(button), :global(input), :global(select) { font: inherit; }

  main {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: 100%;
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
  }
  header {
    display: grid;
    gap: 9px;
    min-width: 0;
    padding: 12px 20px 11px;
    border-bottom: 1px solid #30342b;
  }
  .header-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    min-width: 0;
  }
  .eyebrow, .group-heading span {
    margin: 0;
    color: #899080;
    font-size: 0.68rem;
    font-weight: 650;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .connection {
    display: flex;
    align-items: center;
    gap: 9px;
    color: #9ca294;
    font-size: 0.75rem;
  }
  .connection span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #777d70;
  }
  .connection.ready span { background: #a9c980; box-shadow: 0 0 18px rgba(169, 201, 128, 0.4); }
  .workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(230px, 0.34fr);
    min-height: 0;
    overflow: hidden;
  }
  .parameter-panel {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    min-width: 0;
    min-height: 0;
    overflow: auto;
    gap: 1px;
    background: #30342b;
  }
  .group {
    min-width: 0;
    min-height: 100%;
    padding: 19px 28px 24px;
    background: rgba(20, 23, 18, 0.97);
  }
  .group-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 20px;
    padding-bottom: 12px;
  }
  h2 { margin: 0; font-size: 1.05rem; font-weight: 580; }
  aside {
    min-width: 0;
    min-height: 0;
    overflow: auto;
    padding: 20px;
    border-left: 1px solid #30342b;
    background: rgba(25, 28, 23, 0.96);
  }
  .empty-state, .error-state { grid-column: 1 / -1; min-height: 400px; margin: 0; padding: 40px; background: #151813; }
  .error-state p, .inline-error { color: #e8a998; line-height: 1.5; }
  .inline-error { margin: 0 0 20px; font-size: 0.78rem; }
  @media (max-width: 680px) {
    header { padding: 10px 12px; }
    .workspace {
      grid-template-columns: 1fr;
      overflow: auto;
    }
    .parameter-panel {
      grid-template-columns: 1fr;
      align-content: start;
      overflow: visible;
    }
    .group { min-height: 0; }
    aside { border-top: 1px solid #30342b; border-left: 0; }
  }

  @media (max-height: 420px) {
    header { gap: 6px; padding-top: 8px; padding-bottom: 8px; }
    .group { padding-top: 14px; }
  }
</style>
