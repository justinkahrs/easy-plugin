<script lang="ts">
  import type { MeterFrameEvent, TransportChangedEvent } from '$lib/bridge/types';
  import type { AnalyzerSnapshot } from '$lib/visualization-store';

  export let transport: TransportChangedEvent | undefined;
  export let meters: MeterFrameEvent | undefined;
  export let analyzer: AnalyzerSnapshot | undefined;

  $: analyzerPoints = makeAnalyzerPoints(analyzer?.magnitudes ?? []);
  $: leftMeter = Math.min(1, meters?.peaks[0] ?? 0);
  $: rightMeter = Math.min(1, meters?.peaks[1] ?? leftMeter);

  function makeAnalyzerPoints(values: readonly number[]): string {
    if (values.length === 0) return '';
    const maximum = Math.max(0.0001, ...values);
    return values.map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const db = 20 * Math.log10(Math.max(0.00001, value / maximum));
      const y = Math.min(100, Math.max(0, (-db / 60) * 88 + 6));
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
  }
</script>

<section class="visualization" aria-label="Live audio visualization">
  <div class="transport">
    <span class:active={transport?.playing}>{transport?.playing ? 'Playing' : 'Stopped'}</span>
    <strong>{transport?.bpm === undefined ? '—' : transport.bpm.toFixed(1)} BPM</strong>
    <small>{transport?.timeSignature === undefined ? '—' : `${transport.timeSignature.numerator}/${transport.timeSignature.denominator}`}</small>
  </div>
  <div class="scope">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Frequency analyzer">
      <path d="M0 25H100M0 50H100M0 75H100" class="grid" />
      {#if analyzerPoints}
        <polyline points={analyzerPoints} />
      {/if}
    </svg>
    <div class="meters" aria-label="Output peak meters">
      <i style={`--level:${leftMeter}`}></i>
      <i style={`--level:${rightMeter}`}></i>
    </div>
  </div>
</section>

<style>
  .visualization { margin: 22px 0 4px; border: 1px solid #3a3f34; background: #11140f; }
  .transport {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: baseline;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid #30352c;
    color: #7f8777;
    font-size: 0.65rem;
    text-transform: uppercase;
  }
  .transport span::before { content: ''; display: inline-block; width: 5px; height: 5px; margin-right: 6px; border-radius: 50%; background: #656b60; }
  .transport span.active::before { background: #a9c980; }
  .transport strong { color: #dfe2da; font-family: ui-monospace, monospace; font-size: 0.7rem; }
  .transport small { font-family: ui-monospace, monospace; }
  .scope { display: grid; grid-template-columns: 1fr 12px; gap: 8px; height: 94px; padding: 10px; }
  svg { width: 100%; height: 100%; overflow: visible; }
  .grid { fill: none; stroke: #282d25; stroke-width: 0.6; }
  polyline { fill: none; stroke: #a9c980; stroke-width: 1.25; vector-effect: non-scaling-stroke; }
  .meters { display: flex; gap: 3px; align-items: flex-end; }
  .meters i { display: block; width: 4px; height: 100%; background: linear-gradient(to top, #a9c980 calc(var(--level) * 100%), #30362c calc(var(--level) * 100%)); }
</style>
