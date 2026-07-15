<script lang="ts">
  import '@fontsource-variable/geist';
  import { onMount } from 'svelte';
  import { createRuntimeBridge, type RuntimeBridge, type RuntimeSession } from '$lib/bridge';
  import ParameterControl from '$lib/components/ParameterControl.svelte';
  import PresetBrowser from '$lib/components/PresetBrowser.svelte';
  import VisualizationPanel from '$lib/components/VisualizationPanel.svelte';
  import {
    getParameterMetadata,
    parameterMetadata,
    svelteParameterGroups,
    svelteParameterMetadata,
    type ParameterId,
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
  let runtimeSession: RuntimeSession | undefined;
  let parameterValues = {} as ParameterValues;
  let pluginState: Readonly<Record<string, unknown>> = {};
  let presets: readonly PresetInfo[] = [];
  let currentPreset: PresetStatus = { dirty: false };
  let status: 'loading' | 'ready' | 'error' = 'loading';
  let errorMessage = '';
  let latencyMs: number | undefined;
  let pinging = false;
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
      .then(([session]) => {
        if (!active) return;
        runtimeSession = session;
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

  async function measureBridge(): Promise<void> {
    if (bridge === undefined || pinging) return;
    pinging = true;
    try {
      latencyMs = await bridge.ping();
    } catch (error: unknown) {
      errorMessage = error instanceof Error ? error.message : 'The bridge ping failed.';
    } finally {
      pinging = false;
    }
  }

  function valueFor(id: ParameterId): number {
    return parameterValues[id] ?? 0;
  }
</script>

<svelte:head>
  <title>Super Filter</title>
  <meta name="description" content="Manifest-generated JUCE parameters in a Svelte editor." />
</svelte:head>

<main>
  <header>
    <div>
      <p class="eyebrow">Example Audio / Super Filter</p>
      <h1>Native parameters,<br />web precision.</h1>
    </div>
    <div class="connection" class:ready={status === 'ready'}>
      <span aria-hidden="true"></span>
      {status === 'ready' ? 'Host synchronized' : status === 'error' ? 'Runtime error' : 'Awaiting snapshot'}
    </div>
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
                normalizedValue={valueFor(control.id)}
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
                normalizedValue={valueFor(control.id)}
                {controller}
              />
            {/each}
          </section>
        {/if}
      {/if}
    </div>

    <aside aria-label="Runtime diagnostics">
      <div class="diagnostic-heading">
        <p class="eyebrow">Runtime</p>
        <button type="button" disabled={pinging || status !== 'ready'} onclick={measureBridge}>
          {pinging ? 'Measuring' : 'Ping'}
        </button>
      </div>

      <VisualizationPanel {transport} {meters} {analyzer} />

      {#if runtimeSession}
        <dl>
          <div><dt>Bridge</dt><dd>{runtimeSession.mode}</dd></div>
          <div><dt>Assets</dt><dd>{runtimeSession.assetSource.replace('-', ' ')}</dd></div>
          <div><dt>Protocol</dt><dd>v{runtimeSession.protocolVersion}</dd></div>
          <div><dt>Instance</dt><dd title={runtimeSession.instanceId}>{runtimeSession.instanceId.slice(0, 12)}</dd></div>
          <div><dt>Parameters</dt><dd>{parameterMetadata.length}</dd></div>
          <div><dt>Snapshot</dt><dd>schema {runtimeSession.snapshot.schemaVersion}</dd></div>
          <div><dt>Round trip</dt><dd>{latencyMs === undefined ? 'not measured' : `${Math.round(latencyMs)} ms`}</dd></div>
        </dl>
      {/if}

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
    min-width: 320px;
    background: #10120f;
    color-scheme: dark;
    font-family: 'Geist Variable', system-ui, sans-serif;
  }
  :global(body) {
    margin: 0;
    min-height: 100dvh;
    background:
      linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      #10120f;
    background-size: 44px 44px;
    color: #eef0e9;
  }
  :global(button), :global(input), :global(select) { font: inherit; }

  main { min-height: 100dvh; }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 32px;
    padding: 42px 48px 36px;
    border-bottom: 1px solid #30342b;
  }
  .eyebrow, dt, button, .group-heading span {
    margin: 0;
    color: #899080;
    font-size: 0.68rem;
    font-weight: 650;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  h1 {
    margin: 16px 0 0;
    font-size: clamp(2.25rem, 5vw, 4.6rem);
    font-weight: 520;
    letter-spacing: -0.055em;
    line-height: 0.94;
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
    min-height: 460px;
  }
  .parameter-panel {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1px;
    background: #30342b;
  }
  .group { padding: 30px 36px; background: rgba(20, 23, 18, 0.97); }
  .group-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 20px;
    padding-bottom: 20px;
  }
  h2 { margin: 0; font-size: 1.05rem; font-weight: 580; }
  aside { padding: 30px; border-left: 1px solid #30342b; background: rgba(25, 28, 23, 0.96); }
  .diagnostic-heading { display: flex; align-items: center; justify-content: space-between; }
  button {
    padding: 8px 12px;
    border: 1px solid #505648;
    border-radius: 3px;
    background: transparent;
    color: #dfe2d9;
    cursor: pointer;
  }
  button:disabled { cursor: default; opacity: 0.45; }
  dl { margin: 25px 0 0; }
  dl div {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    padding: 13px 0;
    border-top: 1px solid #3a3f34;
  }
  dd {
    overflow: hidden;
    margin: 0;
    color: #dfe2da;
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 0.76rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .empty-state, .error-state { grid-column: 1 / -1; min-height: 400px; margin: 0; padding: 40px; background: #151813; }
  .error-state p, .inline-error { color: #e8a998; line-height: 1.5; }
  .inline-error { margin-top: 28px; font-size: 0.78rem; }
  @media (max-width: 680px) {
    header { padding: 28px; }
    .workspace, .parameter-panel { grid-template-columns: 1fr; }
    aside { border-top: 1px solid #30342b; border-left: 0; }
  }
</style>
