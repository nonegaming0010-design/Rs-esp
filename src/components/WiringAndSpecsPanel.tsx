import {
  ArrowRight,
  BookOpen,
  Box,
  Check,
  Cpu,
  Layers,
  PackageCheck,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  buildComponentWiringForBoard,
  COMPONENTS_CATALOG,
  type CatalogCategory,
  type ComponentCatalogItem,
} from '../data/componentsCatalog';
import type { EspBoard, WiringItem } from '../types/esp';
import { detectRequiredLibraries } from '../utils/espHelpers';

interface WiringAndSpecsPanelProps {
  title: string;
  explanation: string;
  board: EspBoard;
  code: string;
  wiring: WiringItem[];
  libraries: string[];
  warnings: string[];
  baudRate: number;
  onGoToSerial: () => void;
  onGoToPinout: () => void;
  onGoTo3dPreview: () => void;
  onAddComponent?: (component: ComponentCatalogItem) => {
    addedWiringCount: number;
    addedLibCount: number;
  };
  onRemoveWiringRow?: (index: number) => void;
}

type PanelTab = 'specs' | 'components';

const CATEGORIES: Array<'All' | CatalogCategory> = ['All', 'Sensors', 'Displays', 'Actuators', 'Inputs'];

export function WiringAndSpecsPanel({
  title,
  explanation,
  board,
  code,
  wiring,
  libraries,
  warnings,
  baudRate,
  onGoToSerial,
  onGoToPinout,
  onGoTo3dPreview,
  onAddComponent,
  onRemoveWiringRow,
}: WiringAndSpecsPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('specs');
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<'All' | CatalogCategory>('All');
  const [addedBanner, setAddedBanner] = useState<string | null>(null);

  const allLibraries = useMemo(() => {
    const merged = new Set([...libraries, ...detectRequiredLibraries(code)]);
    return Array.from(merged);
  }, [libraries, code]);

  const filteredComponents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return COMPONENTS_CATALOG.filter((comp) => {
      if (category !== 'All' && comp.category !== category) return false;
      if (!q) return true;
      const hay = `${comp.name} ${comp.shortName} ${comp.protocol} ${comp.summary} ${comp.libraries.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [searchQuery, category]);

  const isComponentPresent = (comp: ComponentCatalogItem): boolean => {
    const prefix = comp.shortName.toLowerCase();
    return wiring.some((w) => w.from.toLowerCase().includes(prefix));
  };

  const handleSelectComponent = (comp: ComponentCatalogItem) => {
    if (!onAddComponent) return;
    const res = onAddComponent(comp);
    if (res.addedWiringCount === 0 && res.addedLibCount === 0) {
      setAddedBanner(`${comp.shortName} wiring & libraries are already included in this project.`);
    } else {
      setAddedBanner(
        `Added ${comp.shortName}: +${res.addedWiringCount} wiring row${res.addedWiringCount === 1 ? '' : 's'}, +${res.addedLibCount} librar${res.addedLibCount === 1 ? 'y' : 'ies'}.`
      );
    }
  };

  return (
    <aside aria-label="Wiring and Hardware Inspector" className="flex flex-col gap-4">
      <div className="rounded-lg border border-stone-300 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
        {/* Header + Tab Switcher */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
              {board.shortName} · <span className="font-mono tabular-nums">{baudRate}</span> baud
            </p>
            <h2 className="mt-1 truncate font-display text-base font-semibold text-stone-900 dark:text-stone-50">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onGoToSerial}
            className="inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 dark:bg-teal-700 dark:hover:bg-teal-600"
          >
            <span>Upload / Monitor</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Inspector sections"
          className="mt-3 flex items-center gap-1 rounded-md border border-stone-200 bg-stone-100 p-0.5 text-xs dark:border-stone-800 dark:bg-stone-950"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'specs'}
            onClick={() => setActiveTab('specs')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-sm py-1.5 font-medium transition-colors ${
              activeTab === 'specs'
                ? 'bg-white text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Specs &amp; Wiring ({wiring.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'components'}
            onClick={() => setActiveTab('components')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-sm py-1.5 font-medium transition-colors ${
              activeTab === 'components'
                ? 'bg-white text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Components ({COMPONENTS_CATALOG.length})</span>
          </button>
        </div>

        {activeTab === 'specs' ? (
          <>
            <div className="mt-3 rounded-md border border-stone-200 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-950/60">
              <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 mb-1">
                How This Sketch Works
              </p>
              <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                {explanation}
              </p>
            </div>

            {/* Pin-to-Pin Wiring Table */}
            <div className="mt-4 border-t border-stone-200 pt-3 dark:border-stone-800">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-xs font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                  <span>Pin-to-Pin Wiring ({board.logicVoltage})</span>
                </h3>
                <div className="flex items-center gap-2.5">
                  {onAddComponent && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('components')}
                      className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      <span>Add Sensor</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onGoTo3dPreview}
                    className="inline-flex items-center gap-1 rounded border border-teal-700/60 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-900 hover:bg-teal-100 dark:border-teal-600 dark:bg-teal-950/60 dark:text-teal-200 dark:hover:bg-teal-900/60"
                  >
                    <Box className="h-3 w-3" aria-hidden="true" />
                    <span>3D Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={onGoToPinout}
                    className="text-xs font-medium text-teal-800 hover:underline dark:text-teal-400"
                  >
                    Pinout
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border border-stone-200 dark:border-stone-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-600 dark:bg-stone-950/60 dark:text-stone-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Component</th>
                      <th className="px-3 py-2 font-medium">ESP Pin</th>
                      <th className="px-3 py-2 font-medium">Notes</th>
                      {onRemoveWiringRow && <th className="w-8 px-2 py-2" aria-label="Remove row" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {wiring.length === 0 ? (
                      <tr>
                        <td className="px-3 py-2 font-medium text-stone-800 dark:text-stone-200">Onboard LED</td>
                        <td className="px-3 py-2 font-mono text-teal-800 dark:text-teal-400">GPIO {board.defaultLedPin}</td>
                        <td className="px-3 py-2 text-stone-500 dark:text-stone-400">Built-in board indicator</td>
                        {onRemoveWiringRow && <td />}
                      </tr>
                    ) : (
                      wiring.map((row, idx) => (
                        <tr key={`${row.from}-${row.to}-${idx}`} className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                          <td className="px-3 py-2 font-medium text-stone-800 dark:text-stone-200">{row.from}</td>
                          <td className="px-3 py-2 font-mono text-teal-800 dark:text-teal-400">{row.to}</td>
                          <td className="px-3 py-2 text-stone-500 dark:text-stone-400">{row.note || '—'}</td>
                          {onRemoveWiringRow && (
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => onRemoveWiringRow(idx)}
                                aria-label={`Remove ${row.from}`}
                                className="rounded p-1 text-stone-400 hover:bg-stone-200 hover:text-red-600 dark:hover:bg-stone-800"
                              >
                                <Trash2 className="h-3 w-3" aria-hidden="true" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Required Libraries */}
            <div className="mt-4 border-t border-stone-200 pt-3 dark:border-stone-800">
              <h3 className="text-xs font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 mb-1.5">
                <PackageCheck className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                <span>Required Libraries</span>
              </h3>
              {allLibraries.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Built-in core only — no third-party libraries needed.
                </p>
              ) : (
                <div className="text-xs text-stone-700 dark:text-stone-300 font-mono leading-relaxed">
                  {allLibraries.join(' · ')}
                </div>
              )}
            </div>

            {/* Hardware & Bootloader Tips */}
            {(warnings.length > 0 || board.bootloaderTip) && (
              <div className="mt-4 border-t border-stone-200 pt-3 dark:border-stone-800 space-y-1.5">
                <h3 className="text-xs font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  <span>Hardware &amp; Upload Notes</span>
                </h3>
                <ul className="space-y-1 text-xs text-stone-600 dark:text-stone-300">
                  <li>{board.bootloaderTip}</li>
                  {warnings.map((w, idx) => (
                    <li key={idx} className="text-amber-800 dark:text-amber-300">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Default Bus Reference */}
            <div className="mt-4 border-t border-stone-200 pt-3 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                <span>I2C: SDA {board.defaultI2c.sda} / SCL {board.defaultI2c.scl}</span>
              </span>
              <span className="font-mono tabular-nums">
                SPI: {board.defaultSpi.mosi}/{board.defaultSpi.miso}/{board.defaultSpi.sck}
              </span>
            </div>
          </>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-stone-600 dark:text-stone-400">
              Select a sensor, display, or actuator to automatically append {board.shortName}-compatible wiring rows and required libraries to your project.
            </p>

            {addedBanner && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
              >
                <span className="font-medium">{addedBanner}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('specs')}
                    className="font-semibold underline hover:no-underline"
                  >
                    View Wiring
                  </button>
                  <button
                    type="button"
                    onClick={onGoTo3dPreview}
                    className="font-semibold underline hover:no-underline"
                  >
                    Open 3D
                  </button>
                </div>
              </div>
            )}

            {/* Search & Category Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search components catalog"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search DHT11, HC-SR04, OLED, Servo..."
                  className="w-full rounded-md border border-stone-300 bg-stone-50 pl-8 pr-3 py-1.5 text-xs text-stone-900 focus:border-teal-700 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                />
              </div>

              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`rounded px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                      category === cat
                        ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-500 dark:bg-teal-600'
                        : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300 dark:hover:bg-stone-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Components List */}
            <div className="max-h-[470px] space-y-2 overflow-y-auto pr-0.5 workbench-scroll">
              {filteredComponents.length === 0 ? (
                <p className="rounded-md border border-stone-200 bg-stone-50 p-4 text-center text-xs text-stone-500 dark:border-stone-800 dark:bg-stone-950">
                  No components match &ldquo;{searchQuery}&rdquo;.
                </p>
              ) : (
                filteredComponents.map((comp) => {
                  const previewRows = buildComponentWiringForBoard(comp, board, wiring);
                  const alreadyAdded = isComponentPresent(comp);

                  return (
                    <div
                      key={comp.id}
                      className="rounded-md border border-stone-200 bg-stone-50/70 p-3 dark:border-stone-800 dark:bg-stone-950/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                            {comp.name}
                          </h3>
                          <p className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
                            {comp.protocol} · {comp.voltage}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectComponent(comp)}
                          disabled={!onAddComponent}
                          className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                            alreadyAdded
                              ? 'border border-emerald-600/60 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500'
                          }`}
                        >
                          {alreadyAdded ? (
                            <>
                              <Check className="h-3 w-3" aria-hidden="true" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3" aria-hidden="true" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>

                      <p className="mt-1.5 text-[11px] leading-relaxed text-stone-600 dark:text-stone-300">
                        {comp.summary}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {previewRows.map((r) => (
                          <span
                            key={`${comp.id}-${r.from}`}
                            className="rounded border border-stone-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300"
                          >
                            {r.from.replace(`${comp.shortName} `, '')} → {r.to}
                          </span>
                        ))}
                      </div>

                      {comp.libraries.length > 0 && (
                        <p className="mt-1.5 font-mono text-[10px] text-teal-800 dark:text-teal-400">
                          Libs: {comp.libraries.join(', ')}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
