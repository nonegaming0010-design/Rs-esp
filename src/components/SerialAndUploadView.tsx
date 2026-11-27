import {
  Activity,
  Archive,
  Binary,
  Cpu,
  Download,
  FileCode2,
  Play,
  RotateCcw,
  Send,
  Square,
  Terminal,
  Trash2,
  Upload,
  Usb,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EspBoard, FrameworkId, SerialLogEntry } from '../types/esp';
import {
  buildPlatformIoIni,
  detectRequiredLibraries,
  formatHexDumpRows,
  getSketchFilename,
  parseHexInput,
  parseSerialPlotterLine,
} from '../utils/espHelpers';
import type { LineEnding } from '../utils/webSerial';
import { checkWebSerialSupport } from '../utils/webSerial';
import { SerialPlotter } from './SerialPlotter';

interface SerialAndUploadViewProps {
  board: EspBoard;
  framework: FrameworkId;
  title: string;
  code: string;
  connectionMode: 'disconnected' | 'usb' | 'virtual';
  serialLogs: SerialLogEntry[];
  baudRate: number;
  onChangeBaudRate: (baud: number) => void;
  onConnectUsb: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onToggleVirtualMode: () => void;
  onSendSerial: (text: string, lineEnding: LineEnding) => Promise<void>;
  onSendSerialHex: (bytes: Uint8Array) => Promise<void>;
  onClearLogs: () => void;
  onResetBoard: () => Promise<void>;
  onBootloaderMode: () => Promise<void>;
  onFlashBinary: (options: {
    files: Array<{ data: Uint8Array; address: number; name: string }>;
    baudRate: number;
    eraseAll: boolean;
  }) => Promise<void>;
  flashProgress: number | null;
  isFlashing: boolean;
  autoReconnect: boolean;
  onToggleAutoReconnect: (enabled: boolean) => void;
  reconnecting: boolean;
  onUploadMicroPython: () => Promise<void>;
  virtualTelemetryActive: boolean;
  onToggleVirtualTelemetry: () => void;
  onDownloadSketch: () => void;
  onDownloadPlatformIo: () => void;
  onDownloadProjectZip: () => void;
  isPhoneView?: boolean;
}

const BAUD_RATES = [9600, 74880, 115200, 230400, 460800, 921600];
const QUICK_COMMANDS = ['help', 'status', 'chip', 'sensor', 'wifi scan', 'gpio on', 'gpio off', 'AT'];

export function SerialAndUploadView({
  board,
  framework,
  title,
  code,
  connectionMode,
  serialLogs,
  baudRate,
  onChangeBaudRate,
  onConnectUsb,
  onDisconnect,
  onToggleVirtualMode,
  onSendSerial,
  onSendSerialHex,
  onClearLogs,
  onResetBoard,
  onBootloaderMode,
  onFlashBinary,
  flashProgress,
  isFlashing,
  autoReconnect,
  onToggleAutoReconnect,
  reconnecting,
  onUploadMicroPython,
  virtualTelemetryActive,
  onToggleVirtualTelemetry,
  onDownloadSketch,
  onDownloadPlatformIo,
  onDownloadProjectZip,
  isPhoneView = false,
}: SerialAndUploadViewProps) {
  const [uploadTab, setUploadTab] = useState<'bin' | 'micropython' | 'cli'>(
    framework === 'micropython' ? 'micropython' : 'bin'
  );
  const [monitorTab, setMonitorTab] = useState<'console' | 'hex' | 'plotter'>('console');
  const [txMode, setTxMode] = useState<'text' | 'hex'>('text');
  const [hexError, setHexError] = useState<string | null>(null);
  const [binFile, setBinFile] = useState<{ name: string; data: Uint8Array } | null>(null);
  const [flashOffset, setFlashOffset] = useState(board.flashAppOffset);
  const [flashBaud, setFlashBaud] = useState(board.defaultUploadBaud);
  const [eraseAll, setEraseAll] = useState(false);

  const [txInput, setTxInput] = useState('');
  const [lineEnding, setLineEnding] = useState<LineEnding>('\n');
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logFilter, setLogFilter] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const logEndRef = useRef<HTMLDivElement | null>(null);
  const webSerial = useMemo(() => checkWebSerialSupport(), []);
  const textEncoder = useMemo(() => new TextEncoder(), []);

  useEffect(() => {
    setFlashOffset(board.flashAppOffset);
    setFlashBaud(board.defaultUploadBaud);
  }, [board]);

  useEffect(() => {
    if (autoScroll && (monitorTab === 'console' || monitorTab === 'hex')) {
      logEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [serialLogs, autoScroll, monitorTab]);

  const filteredLogs = useMemo(() => {
    const q = logFilter.trim().toLowerCase();
    if (!q) return serialLogs;
    return serialLogs.filter((l) => l.text.toLowerCase().includes(q));
  }, [serialLogs, logFilter]);

  const hexEntries = useMemo(() => {
    return filteredLogs.map((entry) => {
      const bytes =
        entry.rawBytes && entry.rawBytes.length > 0
          ? entry.rawBytes
          : Array.from(textEncoder.encode(entry.text + '\n'));
      return {
        entry,
        byteLength: bytes.length,
        rows: formatHexDumpRows(bytes, 16),
      };
    });
  }, [filteredLogs, textEncoder]);

  const plotSampleCount = useMemo(() => {
    let count = 0;
    for (const entry of serialLogs) {
      if (entry.direction === 'rx' && parseSerialPlotterLine(entry.text)) {
        count += 1;
      }
    }
    return count;
  }, [serialLogs]);

  const handleBinPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = new Uint8Array(await file.arrayBuffer());
    setBinFile({ name: file.name, data: buf });
  };

  const handleFlashSubmit = async () => {
    if (!binFile) return;
    const parsedAddress = Number.parseInt(flashOffset, 16);
    const address = Number.isNaN(parsedAddress) ? 0x10000 : parsedAddress;
    await onFlashBinary({
      files: [{ data: binFile.data, address, name: binFile.name }],
      baudRate: flashBaud,
      eraseAll,
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txInput.trim()) return;
    setHexError(null);

    if (txMode === 'hex') {
      const parsed = parseHexInput(txInput);
      if (!parsed.ok) {
        setHexError(parsed.error);
        return;
      }
      const cmd = txInput.trim();
      setCmdHistory((prev) => [cmd, ...prev.slice(0, 29)]);
      setHistoryIdx(-1);
      setTxInput('');
      await onSendSerialHex(parsed.bytes);
      return;
    }

    const cmd = txInput;
    setCmdHistory((prev) => [cmd, ...prev.slice(0, 29)]);
    setHistoryIdx(-1);
    setTxInput('');
    await onSendSerial(cmd, lineEnding);
  };

  const handleExportLog = () => {
    const text = serialLogs
      .map((l) => `${l.timestamp} [${l.direction.toUpperCase()}] ${l.text}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rs-esp-serial-${board.id}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const detectedLibs = useMemo(() => detectRequiredLibraries(code), [code]);
  const platformioPreview = useMemo(() => buildPlatformIoIni(board.id, detectedLibs), [board.id, detectedLibs]);
  const sketchFile = getSketchFilename(framework, title);

  return (
    <section aria-label="Direct ESP Uploader and Serial Monitor" className="space-y-4">
      {/* Connection Control Strip */}
      <div className="rounded-lg border border-stone-300 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
              Direct USB Flasher &amp; Built-in Serial Monitor
            </h1>
            <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400">
              Flash firmware binaries or MicroPython scripts straight from Rs-ESP over Web Serial, and debug live logs or waveforms.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {connectionMode === 'usb' ? (
              <button
                type="button"
                onClick={onDisconnect}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 whitespace-nowrap shrink-0"
              >
                <Square className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Disconnect USB</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onConnectUsb}
                disabled={!webSerial.supported}
                className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0 dark:bg-teal-600 dark:hover:bg-teal-500"
              >
                <Usb className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Connect USB ESP Board</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleVirtualMode}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                connectionMode === 'virtual'
                  ? 'border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-300'
                  : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{connectionMode === 'virtual' ? 'Stop Virtual ESP' : 'Try Virtual ESP Simulation'}</span>
            </button>
          </div>
        </div>

        {!webSerial.supported && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <strong>Web Serial Notice:</strong> {webSerial.reason} You can still test the Serial Monitor &amp; Plotter using{' '}
            <strong>Try Virtual ESP Simulation</strong> or export your sketch for Arduino CLI / PlatformIO.
          </div>
        )}
      </div>

      {/* Main Split: Uploader (5 cols) + Serial Monitor & Plotter (7 cols) */}
      <div
        className={`grid gap-4 items-start ${
          isPhoneView ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'
        }`}
      >
        {/* Left: Direct Uploader Panel */}
        <div
          className={`rounded-lg border border-stone-300 bg-white overflow-hidden dark:border-stone-800 dark:bg-stone-900 ${
            isPhoneView ? '' : 'lg:col-span-5'
          }`}
        >
          <div className="flex items-center gap-1 border-b border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-800 dark:bg-stone-950/60">
            {(
              [
                ['bin', 'Flash .bin (USB)'],
                ['micropython', 'MicroPython Direct'],
                ['cli', 'Arduino / PlatformIO'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setUploadTab(id)}
                className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  uploadTab === id
                    ? 'bg-stone-900 text-white dark:bg-teal-700'
                    : 'text-stone-600 hover:bg-stone-200/70 dark:text-stone-400 dark:hover:bg-stone-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-4">
            {uploadTab === 'bin' && (
              <>
                <div>
                  <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-50">
                    Direct Browser ROM Flasher ({board.shortName})
                  </h2>
                  <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                    Uses Espressif <span className="font-mono">esptool-js</span> over Web Serial to write compiled <span className="font-mono">.bin</span> firmware directly into your ESP flash memory.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="bin-file-input"
                    className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5"
                  >
                    Select Firmware Binary (.bin)
                  </label>
                  <input
                    id="bin-file-input"
                    type="file"
                    accept=".bin"
                    onChange={handleBinPick}
                    className="block w-full text-xs text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-stone-800 hover:file:bg-stone-200 dark:text-stone-300 dark:file:bg-stone-800 dark:file:text-stone-100"
                  />
                  {binFile && (
                    <p className="mt-1.5 font-mono text-xs text-teal-700 dark:text-teal-400 tabular-nums">
                      Loaded: {binFile.name} ({(binFile.data.length / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label htmlFor="flash-offset" className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Flash Offset (Hex)
                    </label>
                    <input
                      id="flash-offset"
                      type="text"
                      value={flashOffset}
                      onChange={(e) => setFlashOffset(e.target.value)}
                      className="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-1.5 font-mono dark:border-stone-700 dark:bg-stone-950"
                    />
                  </div>
                  <div>
                    <label htmlFor="flash-baud" className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Upload Baud Rate
                    </label>
                    <select
                      id="flash-baud"
                      value={flashBaud}
                      onChange={(e) => setFlashBaud(Number(e.target.value))}
                      className="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-1.5 font-mono dark:border-stone-700 dark:bg-stone-950"
                    >
                      <option value={115200}>115200</option>
                      <option value={460800}>460800</option>
                      <option value={921600}>921600</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eraseAll}
                    onChange={(e) => setEraseAll(e.target.checked)}
                    className="rounded border-stone-300 accent-teal-700"
                  />
                  <span>Erase entire flash before writing (recommended for clean installs)</span>
                </label>

                {flashProgress !== null && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono tabular-nums">
                      <span>Flashing firmware...</span>
                      <span>{flashProgress}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                      <div
                        className="h-full bg-teal-700 transition-all"
                        style={{ width: `${flashProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!binFile || isFlashing || !webSerial.supported}
                  onClick={handleFlashSubmit}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition-colors"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  <span>{isFlashing ? 'Flashing to ESP...' : `Flash .bin to ${board.shortName}`}</span>
                </button>

                <p className="text-xs text-stone-500 dark:text-stone-400">
                  <strong>Bootloader Tip:</strong> {board.bootloaderTip}
                </p>
              </>
            )}

            {uploadTab === 'micropython' && (
              <>
                <div>
                  <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-50">
                    Direct MicroPython Script Upload
                  </h2>
                  <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                    Uploads your active Studio code straight into <span className="font-mono">main.py</span> on any MicroPython-flashed ESP32 or ESP8266 over USB Serial Raw REPL, then soft-reboots the board.
                  </p>
                </div>

                <div className="rounded-md border border-stone-200 bg-stone-50 p-3 text-xs dark:border-stone-800 dark:bg-stone-950">
                  <div className="flex justify-between">
                    <span className="text-stone-500 dark:text-stone-400">Active Script</span>
                    <span className="font-mono font-medium text-stone-900 dark:text-stone-100">{sketchFile}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-stone-500 dark:text-stone-400">Payload Size</span>
                    <span className="font-mono tabular-nums text-stone-700 dark:text-stone-300">{code.length} bytes</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={connectionMode !== 'usb'}
                  onClick={onUploadMicroPython}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition-colors"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {connectionMode === 'usb'
                      ? 'Upload Code to main.py & Run'
                      : 'Connect USB ESP Board First'}
                  </span>
                </button>

                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Note: Your ESP board must already have MicroPython firmware installed (flash a MicroPython <span className="font-mono">.bin</span> once using the Flash .bin tab).
                </p>
              </>
            )}

            {uploadTab === 'cli' && (
              <>
                <div>
                  <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-50">
                    Ready-to-Compile Project Bundle
                  </h2>
                  <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                    Download a complete multi-file ZIP archive configured for {board.shortName} (PlatformIO, Arduino CLI/IDE, MicroPython, or ESP-IDF) including <span className="font-mono">wiring.md</span> and <span className="font-mono">README.md</span>.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onDownloadProjectZip}
                    className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
                  >
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Download Project .zip</span>
                  </button>
                  <button
                    type="button"
                    onClick={onDownloadSketch}
                    className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800 whitespace-nowrap shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{sketchFile}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onDownloadPlatformIo}
                    className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800 whitespace-nowrap shrink-0"
                  >
                    <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>platformio.ini</span>
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="font-medium text-stone-700 dark:text-stone-300">Arduino CLI Compile &amp; Upload:</p>
                  <pre className="overflow-x-auto rounded-md bg-stone-950 p-3 font-mono text-[11px] text-stone-200">
                    {`arduino-cli compile --fqbn ${board.arduinoFqbn} .\narduino-cli upload -p /dev/ttyUSB0 --fqbn ${board.arduinoFqbn} .`}
                  </pre>

                  <p className="font-medium text-stone-700 dark:text-stone-300 pt-1">Generated platformio.ini:</p>
                  <pre className="overflow-x-auto rounded-md bg-stone-950 p-3 font-mono text-[11px] text-stone-200">
                    {platformioPreview}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Built-in Serial Monitor, Hex View & Live Serial Plotter */}
        <div
          className={`rounded-lg border border-stone-300 bg-white overflow-hidden dark:border-stone-800 dark:bg-stone-900 ${
            isPhoneView ? '' : 'lg:col-span-7'
          }`}
        >
          {/* Serial Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-800 dark:bg-stone-950/60">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMonitorTab('console')}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  monitorTab === 'console'
                    ? 'bg-stone-900 text-white dark:bg-teal-700'
                    : 'text-stone-600 hover:bg-stone-200/70 dark:text-stone-400 dark:hover:bg-stone-800'
                }`}
              >
                <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Serial Monitor</span>
              </button>
              <button
                type="button"
                onClick={() => setMonitorTab('hex')}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  monitorTab === 'hex'
                    ? 'bg-stone-900 text-white dark:bg-teal-700'
                    : 'text-stone-600 hover:bg-stone-200/70 dark:text-stone-400 dark:hover:bg-stone-800'
                }`}
              >
                <Binary className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Hex View</span>
              </button>
              <button
                type="button"
                onClick={() => setMonitorTab('plotter')}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  monitorTab === 'plotter'
                    ? 'bg-stone-900 text-white dark:bg-teal-700'
                    : 'text-stone-600 hover:bg-stone-200/70 dark:text-stone-400 dark:hover:bg-stone-800'
                }`}
              >
                <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Serial Plotter ({plotSampleCount})</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <label htmlFor="serial-baud" className="sr-only">
                Serial Baud Rate
              </label>
              <select
                id="serial-baud"
                value={baudRate}
                onChange={(e) => onChangeBaudRate(Number(e.target.value))}
                className="rounded border border-stone-300 bg-white px-2 py-1 font-mono text-xs tabular-nums dark:border-stone-700 dark:bg-stone-900"
              >
                {BAUD_RATES.map((b) => (
                  <option key={b} value={b}>
                    {b} baud
                  </option>
                ))}
              </select>

              {connectionMode === 'usb' && (
                <>
                  <button
                    type="button"
                    onClick={onResetBoard}
                    className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    <span>Reset</span>
                  </button>
                  <button
                    type="button"
                    onClick={onBootloaderMode}
                    className="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
                  >
                    Boot Mode
                  </button>
                </>
              )}

              {connectionMode === 'virtual' && (
                <button
                  type="button"
                  onClick={onToggleVirtualTelemetry}
                  className={`rounded border px-2 py-1 text-xs font-medium transition-colors ${
                    virtualTelemetryActive
                      ? 'border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-300'
                      : 'border-stone-300 bg-white text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200'
                  }`}
                >
                  {virtualTelemetryActive ? 'Stop Live Sensor Stream' : 'Stream Sensor Data'}
                </button>
              )}

              <button
                type="button"
                onClick={handleExportLog}
                aria-label="Download serial log"
                className="rounded border border-stone-300 bg-white p-1.5 text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onClearLogs}
                aria-label="Clear serial logs"
                className="rounded border border-stone-300 bg-white p-1.5 text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Sub-controls: Status, Timestamps, Autoscroll, Auto-reconnect, Filter */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2 text-xs dark:border-stone-800 dark:bg-stone-900">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-stone-600 dark:text-stone-300">
                Status:{' '}
                <strong
                  className={
                    reconnecting
                      ? 'text-amber-700 dark:text-amber-400'
                      : connectionMode === 'usb' || connectionMode === 'virtual'
                        ? 'text-teal-700 dark:text-teal-400'
                        : 'text-stone-500'
                  }
                >
                  {reconnecting
                    ? 'Reconnecting USB...'
                    : connectionMode === 'usb'
                      ? 'USB Connected'
                      : connectionMode === 'virtual'
                        ? 'Virtual Simulation Active'
                        : 'Disconnected'}
                </strong>
              </span>
              <label className="inline-flex items-center gap-1 text-stone-600 dark:text-stone-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTimestamps}
                  onChange={(e) => setShowTimestamps(e.target.checked)}
                  className="accent-teal-700"
                />
                <span>Timestamps</span>
              </label>
              <label className="inline-flex items-center gap-1 text-stone-600 dark:text-stone-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="accent-teal-700"
                />
                <span>Autoscroll</span>
              </label>
              <label
                className="inline-flex items-center gap-1 text-stone-600 dark:text-stone-400 cursor-pointer"
                title="Automatically reopen paired USB serial port after ESP resets or brief disconnects"
              >
                <input
                  type="checkbox"
                  checked={autoReconnect}
                  onChange={(e) => onToggleAutoReconnect(e.target.checked)}
                  className="accent-teal-700"
                />
                <span>Auto-reconnect</span>
              </label>
            </div>

            <input
              type="search"
              aria-label="Filter serial output"
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              placeholder="Filter log lines..."
              className="w-40 rounded border border-stone-300 bg-stone-50 px-2.5 py-1 text-xs focus:border-teal-700 focus:outline-none dark:border-stone-700 dark:bg-stone-950"
            />
          </div>

          {monitorTab === 'console' ? (
            <div className="h-[340px] overflow-y-auto bg-stone-950 p-3 font-mono text-xs leading-5 text-stone-200 workbench-scroll">
              {filteredLogs.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-stone-500">
                  <p>No serial output yet.</p>
                  <p className="mt-1 text-[11px]">
                    Connect your ESP board over USB or click <strong>Try Virtual ESP Simulation</strong> above to debug commands.
                  </p>
                </div>
              ) : (
                filteredLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className={`py-0.5 break-all ${
                      entry.direction === 'tx'
                        ? 'text-teal-300'
                        : entry.direction === 'error'
                          ? 'text-red-400'
                          : entry.direction === 'system'
                            ? 'text-amber-300'
                            : 'text-emerald-300'
                    }`}
                  >
                    {showTimestamps && (
                      <span className="mr-2 text-stone-500 tabular-nums">{entry.timestamp}</span>
                    )}
                    <span className="mr-2 text-stone-400">
                      [{entry.direction.toUpperCase()}]
                    </span>
                    <span>{entry.text}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          ) : monitorTab === 'hex' ? (
            <div className="h-[340px] overflow-y-auto bg-stone-950 p-3 font-mono text-xs leading-5 text-stone-200 workbench-scroll">
              {hexEntries.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-stone-500">
                  <p>No serial byte frames captured yet.</p>
                  <p className="mt-1 text-[11px]">
                    Connect over USB or run Virtual ESP Simulation to inspect raw hexadecimal offsets and ASCII payloads.
                  </p>
                </div>
              ) : (
                hexEntries.map(({ entry, byteLength, rows }) => (
                  <div key={entry.id} className="mb-2 border-b border-stone-900 pb-1.5 last:border-b-0">
                    <div className="flex items-center gap-2 text-[11px] text-stone-400 tabular-nums">
                      {showTimestamps && <span className="text-stone-500">{entry.timestamp}</span>}
                      <span
                        className={
                          entry.direction === 'tx'
                            ? 'text-teal-300'
                            : entry.direction === 'error'
                              ? 'text-red-400'
                              : entry.direction === 'system'
                                ? 'text-amber-300'
                                : 'text-emerald-300'
                        }
                      >
                        [{entry.direction.toUpperCase()}]
                      </span>
                      <span>{byteLength} bytes</span>
                    </div>
                    {rows.map((row) => (
                      <div
                        key={row.offset}
                        className="flex items-baseline gap-3 text-[11px] tabular-nums whitespace-pre"
                      >
                        <span className="w-[4.5ch] shrink-0 text-stone-500">{row.offset}</span>
                        <span className="w-[49ch] shrink-0 text-stone-200">{row.hex}</span>
                        <span className="shrink-0 text-teal-300/90 border-l border-stone-800 pl-2">
                          {row.ascii}
                        </span>
                      </div>
                    ))}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          ) : (
            <SerialPlotter
              logs={serialLogs}
              connectionMode={connectionMode}
              virtualTelemetryActive={virtualTelemetryActive}
              onToggleVirtualTelemetry={onToggleVirtualTelemetry}
            />
          )}

          {/* Quick Macros + TX Input (Text or Hex) */}
          <div className="border-t border-stone-200 bg-stone-50 p-3 space-y-2 dark:border-stone-800 dark:bg-stone-950/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400">Macros:</span>
                {QUICK_COMMANDS.map((cmd) => (
                  <button
                    key={cmd}
                    type="button"
                    disabled={connectionMode === 'disconnected'}
                    onClick={() => onSendSerial(cmd, lineEnding)}
                    className="rounded border border-stone-300 bg-white px-2 py-0.5 font-mono text-[11px] text-stone-700 hover:bg-stone-100 disabled:opacity-40 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                  >
                    {cmd}
                  </button>
                ))}
                {txMode === 'hex' && (
                  <button
                    type="button"
                    disabled={connectionMode === 'disconnected'}
                    onClick={() => onSendSerialHex(new Uint8Array([0xaa, 0x55, 0x01, 0x0d]))}
                    className="rounded border border-stone-300 bg-white px-2 py-0.5 font-mono text-[11px] text-teal-800 hover:bg-stone-100 disabled:opacity-40 dark:border-stone-700 dark:bg-stone-900 dark:text-teal-300"
                  >
                    AA 55 01 0D
                  </button>
                )}
              </div>

              <div
                role="group"
                aria-label="Send payload format"
                className="flex items-center gap-0.5 rounded border border-stone-300 bg-stone-200/70 p-0.5 dark:border-stone-700 dark:bg-stone-800"
              >
                <button
                  type="button"
                  onClick={() => {
                    setTxMode('text');
                    setHexError(null);
                  }}
                  className={`rounded-xs px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    txMode === 'text'
                      ? 'bg-white text-stone-900 dark:bg-stone-950 dark:text-stone-100'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTxMode('hex');
                    setHexError(null);
                  }}
                  className={`rounded-xs px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    txMode === 'hex'
                      ? 'bg-white text-stone-900 dark:bg-stone-950 dark:text-stone-100'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  Hex
                </button>
              </div>
            </div>

            {hexError && (
              <p role="alert" className="text-xs text-red-700 dark:text-red-400">
                {hexError}
              </p>
            )}

            <form onSubmit={handleSend} className="flex items-center gap-2">
              <label htmlFor="serial-tx-input" className="sr-only">
                Send command to ESP serial port
              </label>
              <input
                id="serial-tx-input"
                type="text"
                value={txInput}
                onChange={(e) => {
                  setTxInput(e.target.value);
                  if (hexError) setHexError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' && cmdHistory.length > 0) {
                    e.preventDefault();
                    const nextIdx = Math.min(cmdHistory.length - 1, historyIdx + 1);
                    setHistoryIdx(nextIdx);
                    setTxInput(cmdHistory[nextIdx]);
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (historyIdx <= 0) {
                      setHistoryIdx(-1);
                      setTxInput('');
                    } else {
                      const nextIdx = historyIdx - 1;
                      setHistoryIdx(nextIdx);
                      setTxInput(cmdHistory[nextIdx]);
                    }
                  }
                }}
                placeholder={
                  connectionMode === 'disconnected'
                    ? 'Connect USB or start Virtual ESP to send serial commands...'
                    : txMode === 'hex'
                      ? 'Send hex bytes (e.g. AA 55 01 0D)...'
                      : 'Send serial command (Up/Down for history)...'
                }
                disabled={connectionMode === 'disconnected'}
                className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-xs text-stone-900 focus:border-teal-700 focus:outline-none disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
              />

              {txMode === 'text' && (
                <>
                  <label htmlFor="serial-line-ending" className="sr-only">
                    Line ending
                  </label>
                  <select
                    id="serial-line-ending"
                    value={lineEnding}
                    onChange={(e) => setLineEnding(e.target.value as LineEnding)}
                    className="rounded-md border border-stone-300 bg-white px-2.5 py-2 font-mono text-xs dark:border-stone-700 dark:bg-stone-900"
                  >
                    <option value={'\n'}>NL (\n)</option>
                    <option value={'\r'}>CR (\r)</option>
                    <option value={'\r\n'}>Both NL &amp; CR</option>
                    <option value={''}>No line ending</option>
                  </select>
                </>
              )}

              <button
                type="submit"
                disabled={connectionMode === 'disconnected' || !txInput.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{txMode === 'hex' ? 'Send Hex' : 'Send'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
