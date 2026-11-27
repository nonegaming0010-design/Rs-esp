import { AlertTriangle, BatteryCharging, Calculator, Cpu, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ESP_BOARDS } from '../data/boards';
import type { EspBoard, PinSpec } from '../types/esp';
import { calculateBatteryLifeHours, calculateVoltageDivider } from '../utils/espHelpers';

interface PinoutToolsViewProps {
  selectedBoard: EspBoard;
  onSelectBoard: (boardId: string) => void;
  isPhoneView?: boolean;
}

export function PinoutToolsView({
  selectedBoard,
  onSelectBoard,
  isPhoneView = false,
}: PinoutToolsViewProps) {
  const [selectedPin, setSelectedPin] = useState<PinSpec | null>(selectedBoard.pins[0] ?? null);
  const [pinFilter, setPinFilter] = useState<'all' | 'adc1' | 'i2c_spi' | 'warning'>('all');

  // Voltage divider calculator state
  const [vin, setVin] = useState(5.0);
  const [r1, setR1] = useState(10000);
  const [r2, setR2] = useState(20000);

  // LED resistor calculator state
  const [ledVf, setLedVf] = useState(2.0);
  const [ledMa, setLedMa] = useState(10);

  // Battery life estimator state
  const [batMah, setBatMah] = useState(2000);
  const [activeMa, setActiveMa] = useState(85);
  const [activeSec, setActiveSec] = useState(3);
  const [sleepUa, setSleepUa] = useState(25);
  const [sleepSec, setSleepSec] = useState(297);

  const leftPins = useMemo(() => selectedBoard.pins.filter((p) => p.side === 'left'), [selectedBoard]);
  const rightPins = useMemo(() => selectedBoard.pins.filter((p) => p.side === 'right'), [selectedBoard]);

  const filteredPins = useMemo(() => {
    return selectedBoard.pins.filter((p) => {
      if (pinFilter === 'adc1') return p.capabilities.includes('ADC1');
      if (pinFilter === 'i2c_spi') {
        return p.capabilities.some((c) => c.startsWith('I2C_') || c.startsWith('SPI_'));
      }
      if (pinFilter === 'warning') {
        return Boolean(p.warning || p.isStrapping || p.isInputOnly || p.isInternalFlash);
      }
      return true;
    });
  }, [selectedBoard, pinFilter]);

  const divider = useMemo(() => calculateVoltageDivider(vin, r1, r2), [vin, r1, r2]);
  const ledResistorOhms = useMemo(() => {
    if (ledMa <= 0 || ledVf >= 3.3) return 0;
    return Math.round(((3.3 - ledVf) / (ledMa / 1000)));
  }, [ledVf, ledMa]);
  const battery = useMemo(
    () => calculateBatteryLifeHours(batMah, activeMa, activeSec, sleepUa, sleepSec),
    [batMah, activeMa, activeSec, sleepUa, sleepSec]
  );

  const activePin =
    selectedPin && selectedBoard.pins.some((p) => p.gpio === selectedPin.gpio)
      ? selectedPin
      : selectedBoard.pins[0];

  return (
    <section aria-label="ESP Pinout Explorer and Hardware Calculators" className="space-y-5">
      {/* Board Pinout Explorer */}
      <div className="rounded-lg border border-stone-300 bg-white p-4 sm:p-5 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-200 pb-4 dark:border-stone-800">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
              ESP Pinouts &amp; Hardware Bench
            </h1>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
              Select a pin on the board diagram to inspect ADC, PWM, I2C, SPI, and strapping pin safety notes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="pinout-board-picker" className="text-xs font-medium text-stone-600 dark:text-stone-400">
              Board
            </label>
            <select
              id="pinout-board-picker"
              value={selectedBoard.id}
              onChange={(e) => {
                onSelectBoard(e.target.value);
                setSelectedPin(null);
              }}
              className="rounded-md border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-900 focus:border-teal-700 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
            >
              {ESP_BOARDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          className={`mt-5 grid gap-6 items-start ${
            isPhoneView ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'
          }`}
        >
          {/* Interactive Board Schematic */}
          <div
            className={`flex flex-col items-center rounded-lg border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950/60 ${
              isPhoneView ? '' : 'lg:col-span-5'
            }`}
          >
            <div className="mb-3 text-center">
              <p className="font-display text-sm font-semibold text-stone-900 dark:text-stone-100">
                {selectedBoard.name}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                {selectedBoard.architecture} · {selectedBoard.flashMb} Flash · {selectedBoard.sramKb}KB SRAM
              </p>
            </div>

            <div className="w-full max-w-[380px] rounded-xl border border-stone-700 bg-stone-900 p-4 text-stone-100 shadow-sm">
              {/* Antenna / RF Shield */}
              <div className="mx-auto mb-3 flex w-36 flex-col items-center rounded-md border border-stone-600 bg-stone-800 px-3 py-2 text-center">
                <span className="font-mono text-[11px] font-semibold tracking-wider text-stone-200">
                  {selectedBoard.chip}
                </span>
                <span className="text-[10px] text-stone-400">3.3V RF Module</span>
              </div>

              {/* Left / Right Header Pins */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  {leftPins.map((pin) => {
                    const isSelected = activePin?.gpio === pin.gpio;
                    const hasWarn = Boolean(pin.warning || pin.isInternalFlash);
                    return (
                      <button
                        key={`L-${pin.gpio}`}
                        type="button"
                        onClick={() => setSelectedPin(pin)}
                        className={`flex w-full items-center justify-between rounded border px-2 py-1 text-left font-mono text-[11px] transition-colors ${
                          isSelected
                            ? 'border-teal-400 bg-teal-700 text-white'
                            : hasWarn
                              ? 'border-amber-500/40 bg-stone-800 text-amber-200 hover:border-amber-400'
                              : 'border-stone-700 bg-stone-800/90 text-stone-200 hover:border-stone-500'
                        }`}
                      >
                        <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
                        <span className="truncate pl-1.5">{pin.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  {rightPins.map((pin) => {
                    const isSelected = activePin?.gpio === pin.gpio;
                    const hasWarn = Boolean(pin.warning || pin.isInternalFlash);
                    return (
                      <button
                        key={`R-${pin.gpio}`}
                        type="button"
                        onClick={() => setSelectedPin(pin)}
                        className={`flex w-full items-center justify-between rounded border px-2 py-1 text-right font-mono text-[11px] transition-colors ${
                          isSelected
                            ? 'border-teal-400 bg-teal-700 text-white'
                            : hasWarn
                              ? 'border-amber-500/40 bg-stone-800 text-amber-200 hover:border-amber-400'
                              : 'border-stone-700 bg-stone-800/90 text-stone-200 hover:border-stone-500'
                        }`}
                      >
                        <span className="truncate pr-1.5">{pin.label}</span>
                        <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* USB Connector */}
              <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-stone-400">
                <span className="rounded border border-stone-700 px-2 py-0.5">RST</span>
                <span className="rounded border border-stone-500 bg-stone-800 px-3 py-1 text-stone-200">
                  {selectedBoard.nativeUsb ? 'USB-C Native' : 'USB-UART'}
                </span>
                <span className="rounded border border-stone-700 px-2 py-0.5">BOOT</span>
              </div>
            </div>

            {activePin && (
              <div className="mt-4 w-full rounded-md border border-stone-200 bg-white p-3 text-xs dark:border-stone-800 dark:bg-stone-900">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-stone-900 dark:text-stone-50">
                    {activePin.label} (GPIO {activePin.gpio})
                  </span>
                  <span className="font-mono text-teal-700 dark:text-teal-400">
                    {activePin.capabilities.join(' · ')}
                  </span>
                </div>
                {activePin.notes && (
                  <p className="mt-1.5 text-stone-600 dark:text-stone-300">{activePin.notes}</p>
                )}
                {activePin.warning && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{activePin.warning}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* GPIO Capability Table */}
          <div className={`space-y-3 ${isPhoneView ? '' : 'lg:col-span-7'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-50 flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                <span>GPIO Capability Matrix</span>
              </h2>
              <div className="flex items-center gap-1 rounded-md border border-stone-300 bg-stone-100 p-0.5 dark:border-stone-700 dark:bg-stone-800">
                {(
                  [
                    ['all', 'All Pins'],
                    ['adc1', 'ADC1 (Wi-Fi Safe)'],
                    ['i2c_spi', 'I2C / SPI'],
                    ['warning', 'Cautions'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPinFilter(id)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      pinFilter === id
                        ? 'bg-white text-stone-900 shadow-2xs dark:bg-stone-950 dark:text-stone-100'
                        : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[580px] overflow-auto rounded-lg border border-stone-300 dark:border-stone-800 workbench-scroll">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-600 dark:bg-stone-950/60 dark:text-stone-400">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Pin</th>
                    <th className="px-3 py-2.5 font-medium">GPIO</th>
                    <th className="px-3 py-2.5 font-medium">Functions</th>
                    <th className="px-3 py-2.5 font-medium">Notes &amp; Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                  {filteredPins.map((pin) => (
                    <tr
                      key={pin.gpio}
                      onClick={() => setSelectedPin(pin)}
                      className={`cursor-pointer transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/40 ${
                        activePin?.gpio === pin.gpio ? 'bg-teal-50/70 dark:bg-teal-950/30' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-mono font-medium text-stone-900 dark:text-stone-100 whitespace-nowrap">
                        {pin.label}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-teal-700 dark:text-teal-400">
                        {pin.gpio}
                      </td>
                      <td className="px-3 py-2 font-mono text-stone-600 dark:text-stone-300">
                        {pin.capabilities.join(', ')}
                      </td>
                      <td className="px-3 py-2 text-stone-600 dark:text-stone-300">
                        {pin.warning ? (
                          <span className="text-amber-700 dark:text-amber-400">{pin.warning}</span>
                        ) : (
                          pin.notes || 'Standard 3.3V GPIO'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Hardware Bench Calculators */}
      <div className={`grid gap-4 ${isPhoneView ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
        {/* 1. 3.3V Voltage Divider Calculator */}
        <div className="rounded-lg border border-stone-300 bg-white p-4 dark:border-stone-800 dark:bg-stone-900 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-50">
              5V → 3.3V Voltage Divider
            </h2>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Protect ESP GPIOs when reading 5V sensors (like HC-SR04 ECHO or MQ-2).
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <label htmlFor="calc-vin" className="block text-stone-600 dark:text-stone-400 mb-1">Vin (V)</label>
              <input
                id="calc-vin"
                type="number"
                step="0.1"
                value={vin}
                onChange={(e) => setVin(Number(e.target.value))}
                className="w-full rounded border border-stone-300 bg-stone-50 px-2 py-1.5 font-mono tabular-nums dark:border-stone-700 dark:bg-stone-950"
              />
            </div>
            <div>
              <label htmlFor="calc-r1" className="block text-stone-600 dark:text-stone-400 mb-1">R1 (Ω)</label>
              <input
                id="calc-r1"
                type="number"
                step="100"
                value={r1}
                onChange={(e) => setR1(Number(e.target.value))}
                className="w-full rounded border border-stone-300 bg-stone-50 px-2 py-1.5 font-mono tabular-nums dark:border-stone-700 dark:bg-stone-950"
              />
            </div>
            <div>
              <label htmlFor="calc-r2" className="block text-stone-600 dark:text-stone-400 mb-1">R2 (Ω)</label>
              <input
                id="calc-r2"
                type="number"
                step="100"
                value={r2}
                onChange={(e) => setR2(Number(e.target.value))}
                className="w-full rounded border border-stone-300 bg-stone-50 px-2 py-1.5 font-mono tabular-nums dark:border-stone-700 dark:bg-stone-950"
              />
            </div>
          </div>
          <div className="rounded-md border border-stone-200 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-950">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-stone-600 dark:text-stone-400">Output Vout</span>
              <span className={`font-mono text-lg font-bold tabular-nums ${divider.safeForEsp32 ? 'text-teal-700 dark:text-teal-400' : 'text-red-700 dark:text-red-400'}`}>
                {divider.vout} V
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-stone-600 dark:text-stone-300">
              {divider.safeForEsp32 ? 'SAFE for 3.3V ESP GPIO' : 'WARNING: Exceeds 3.3V limit!'} · {divider.currentMa} mA draw
            </p>
          </div>
        </div>

        {/* 2. LED Current Limiting Resistor */}
        <div className="rounded-lg border border-stone-300 bg-white p-4 dark:border-stone-800 dark:bg-stone-900 space-y-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-50">
              3.3V LED Resistor Finder
            </h2>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Prevent burning out ESP GPIO pins (max 12–20mA recommended per pin).
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label htmlFor="calc-led-vf" className="block text-stone-600 dark:text-stone-400 mb-1">LED Color / Vf</label>
              <select
                id="calc-led-vf"
                value={ledVf}
                onChange={(e) => setLedVf(Number(e.target.value))}
                className="w-full rounded border border-stone-300 bg-stone-50 px-2 py-1.5 font-mono dark:border-stone-700 dark:bg-stone-950"
              >
                <option value={1.8}>Red (1.8V)</option>
                <option value={2.0}>Yellow/Green (2.0V)</option>
                <option value={3.0}>Blue/White (3.0V)</option>
              </select>
            </div>
            <div>
              <label htmlFor="calc-led-ma" className="block text-stone-600 dark:text-stone-400 mb-1">Target Current (mA)</label>
              <input
                id="calc-led-ma"
                type="number"
                min="1"
                max="20"
                value={ledMa}
                onChange={(e) => setLedMa(Number(e.target.value))}
                className="w-full rounded border border-stone-300 bg-stone-50 px-2 py-1.5 font-mono tabular-nums dark:border-stone-700 dark:bg-stone-950"
              />
            </div>
          </div>
          <div className="rounded-md border border-stone-200 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-950">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-stone-600 dark:text-stone-400">Minimum Resistor</span>
              <span className="font-mono text-lg font-bold tabular-nums text-stone-900 dark:text-stone-100">
                {ledResistorOhms} Ω
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">
              Recommended common kit value: <strong>{ledResistorOhms <= 100 ? '100 Ω' : ledResistorOhms <= 220 ? '220 Ω' : '330 Ω'}</strong>
            </p>
          </div>
        </div>

        {/* 3. Deep Sleep Battery Life Estimator */}
        <div className="rounded-lg border border-stone-300 bg-white p-4 dark:border-stone-800 dark:bg-stone-900 space-y-3">
          <div className="flex items-center gap-2">
            <BatteryCharging className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-50">
              Deep Sleep Battery Estimator
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label htmlFor="calc-bat-mah" className="block text-stone-600 dark:text-stone-400 mb-1">Battery (mAh)</label>
              <input
                id="calc-bat-mah"
                type="number"
                value={batMah}
                onChange={(e) => setBatMah(Number(e.target.value))}
                className="w-full rounded border border-stone-300 bg-stone-50 px-2 py-1 font-mono tabular-nums dark:border-stone-700 dark:bg-stone-950"
              />
            </div>
            <div>
              <label htmlFor="calc-active-ma" className="block text-stone-600 dark:text-stone-400 mb-1">Active (mA)</label>
              <input
                id="calc-active-ma"
                type="number"
                value={activeMa}
                onChange={(e) => setActiveMa(Number(e.target.value))}
                className="w-full rounded border border-stone-300 bg-stone-50 px-2 py-1 font-mono tabular-nums dark:border-stone-700 dark:bg-stone-950"
              />
            </div>
            <div>
              <label htmlFor="calc-active-sec" className="block text-stone-600 dark:text-stone-400 mb-1">Awake (sec)</label>
              <input
                id="calc-active-sec"
                type="number"
                value={activeSec}
                onChange={(e) => setActiveSec(Number(e.target.value))}
                className="w-full rounded border border-stone-300 bg-stone-50 px-2 py-1 font-mono tabular-nums dark:border-stone-700 dark:bg-stone-950"
              />
            </div>
            <div>
              <label htmlFor="calc-sleep-sec" className="block text-stone-600 dark:text-stone-400 mb-1">Sleep (sec) · {sleepUa}µA</label>
              <input
                id="calc-sleep-sec"
                type="number"
                value={sleepSec}
                onChange={(e) => setSleepSec(Number(e.target.value))}
                className="w-full rounded border border-stone-300 bg-stone-50 px-2 py-1 font-mono tabular-nums dark:border-stone-700 dark:bg-stone-950"
              />
            </div>
          </div>
          <div className="rounded-md border border-stone-200 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-950">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-stone-600 dark:text-stone-400">Estimated Runtime</span>
              <span className="font-mono text-lg font-bold tabular-nums text-teal-700 dark:text-teal-400">
                {battery.days} days
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-300 font-mono tabular-nums">
              {battery.hours} hrs · Avg {battery.avgMa} mA
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
