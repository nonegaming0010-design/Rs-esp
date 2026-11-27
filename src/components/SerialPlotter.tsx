import { Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SerialLogEntry } from '../types/esp';
import { buildSerialPlotterData, type SerialPlotterDataset } from '../utils/espHelpers';

interface SerialPlotterProps {
  logs: SerialLogEntry[];
  connectionMode: 'disconnected' | 'usb' | 'virtual';
  virtualTelemetryActive: boolean;
  onToggleVirtualTelemetry: () => void;
}

const PLOT_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb7185'];
const WINDOW_OPTIONS = [30, 60, 120] as const;

export function SerialPlotter({
  logs,
  connectionMode,
  virtualTelemetryActive,
  onToggleVirtualTelemetry,
}: SerialPlotterProps) {
  const [sampleWindow, setSampleWindow] = useState<number>(60);
  const [paused, setPaused] = useState<boolean>(false);
  const [pausedDataset, setPausedDataset] = useState<SerialPlotterDataset | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});

  const liveDataset = useMemo(
    () => buildSerialPlotterData(logs, sampleWindow),
    [logs, sampleWindow]
  );

  // When clearing logs while paused, clear the frozen snapshot too
  useEffect(() => {
    if (logs.length === 0 && paused) {
      setPaused(false);
      setPausedDataset(null);
    }
  }, [logs.length, paused]);

  const activeDataset = paused && pausedDataset ? pausedDataset : liveDataset;
  const { data, seriesKeys, stats, totalSamples } = activeDataset;

  const visibleSeries = useMemo(
    () => seriesKeys.filter((k) => !hiddenSeries[k]),
    [seriesKeys, hiddenSeries]
  );

  const togglePause = () => {
    if (!paused) {
      setPausedDataset(liveDataset);
      setPaused(true);
    } else {
      setPausedDataset(null);
      setPaused(false);
    }
  };

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      data-testid="serial-plotter-panel"
      className="h-[340px] bg-stone-950 p-3 flex flex-col justify-between text-stone-200"
    >
      {data.length === 0 || seriesKeys.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-center text-stone-400 text-xs px-4">
          <p>
            Waiting for numeric telemetry (e.g.{' '}
            <span className="font-mono text-teal-300">temp:24.0,humidity:58.0</span> or{' '}
            <span className="font-mono text-teal-300">120, 45</span>).
          </p>
          {connectionMode === 'virtual' && (
            <button
              type="button"
              onClick={onToggleVirtualTelemetry}
              className="mt-3 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
            >
              Start Simulated Sensor Stream
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Plotter Header: Interactive Series Toggles + Window / Pause Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-800/80">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Sensor channels">
              {seriesKeys.map((key, idx) => {
                const color = PLOT_COLORS[idx % PLOT_COLORS.length];
                const isHidden = !!hiddenSeries[key];
                const stat = stats[key];
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={!isHidden}
                    onClick={() => toggleSeries(key)}
                    title={
                      stat
                        ? `${key} — Min: ${stat.min.toFixed(1)}, Max: ${stat.max.toFixed(1)}`
                        : key
                    }
                    className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] tabular-nums transition-colors ${
                      isHidden
                        ? 'border-stone-800 bg-stone-900/50 text-stone-500 line-through'
                        : 'border-stone-700 bg-stone-900 text-stone-100 hover:border-stone-600'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-xs shrink-0"
                      style={{ backgroundColor: isHidden ? '#57534e' : color }}
                    />
                    <span>
                      {key}: {stat ? stat.latest.toFixed(1) : '--'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 text-[11px]">
              <label htmlFor="plotter-window-select" className="sr-only">
                Sample window size
              </label>
              <select
                id="plotter-window-select"
                value={sampleWindow}
                onChange={(e) => setSampleWindow(Number(e.target.value))}
                disabled={paused}
                className="rounded border border-stone-700 bg-stone-900 px-1.5 py-0.5 font-mono text-[11px] text-stone-200 disabled:opacity-50"
              >
                {WINDOW_OPTIONS.map((win) => (
                  <option key={win} value={win}>
                    Last {win}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={togglePause}
                aria-pressed={paused}
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-medium transition-colors ${
                  paused
                    ? 'border-amber-600 bg-amber-950/60 text-amber-300'
                    : 'border-stone-700 bg-stone-900 text-stone-300 hover:bg-stone-800'
                }`}
              >
                {paused ? (
                  <>
                    <Play className="h-3 w-3" aria-hidden="true" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="h-3 w-3" aria-hidden="true" />
                    <span>Pause</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Recharts Real-Time Line Chart */}
          <div className="w-full h-[236px] min-w-0 pt-2">
            {visibleSeries.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-stone-500">
                All channels hidden — click a channel above to display its waveform.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={228}>
                <LineChart data={data} margin={{ top: 8, right: 24, left: -6, bottom: 2 }}>
                  <CartesianGrid stroke="#292524" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#78716c"
                    tick={{ fill: '#78716c', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false}
                    axisLine={{ stroke: '#44403c' }}
                    padding={{ left: 12, right: 12 }}
                    minTickGap={28}
                  />
                  <YAxis
                    stroke="#78716c"
                    tick={{ fill: '#78716c', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false}
                    axisLine={{ stroke: '#44403c' }}
                    domain={['auto', 'auto']}
                    width={46}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1c1917',
                      border: '1px solid #44403c',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#e7e5e4',
                    }}
                    labelStyle={{ color: '#a8a29e', marginBottom: '4px' }}
                    formatter={(value) =>
                      typeof value === 'number' ? value.toFixed(2) : String(value ?? '')
                    }
                  />
                  {visibleSeries.map((key) => {
                    const colorIdx = seriesKeys.indexOf(key);
                    const color = PLOT_COLORS[colorIdx % PLOT_COLORS.length];
                    return (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={key}
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        isAnimationActive={false}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Footer Stats Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono text-stone-400 tabular-nums">
            <span>
              Showing {data.length} of {totalSamples} samples
              {paused ? ' (Paused)' : virtualTelemetryActive ? ' · Live Stream' : ''}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {visibleSeries.slice(0, 3).map((key) => {
                const s = stats[key];
                if (!s) return null;
                return (
                  <span key={key}>
                    {key} [{s.min.toFixed(1)}..{s.max.toFixed(1)}]
                  </span>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
