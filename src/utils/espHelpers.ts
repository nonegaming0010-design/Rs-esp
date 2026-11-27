import { ESP_BOARDS, getBoardById } from '../data/boards';
import type { BoardFamily, EspProject, FrameworkId, GpioWarning, SerialLogEntry } from '../types/esp';

const HEADER_LIBRARY_MAP: Record<string, string> = {
  'DHT.h': 'DHT sensor library',
  'Adafruit_BME280.h': 'Adafruit BME280 Library',
  'Adafruit_BMP280.h': 'Adafruit BMP280 Library',
  'Adafruit_SSD1306.h': 'Adafruit SSD1306',
  'Adafruit_GFX.h': 'Adafruit GFX Library',
  'Adafruit_NeoPixel.h': 'Adafruit NeoPixel',
  'Adafruit_MPU6050.h': 'Adafruit MPU6050',
  'Adafruit_INA219.h': 'Adafruit INA219',
  'Adafruit_VL53L0X.h': 'Adafruit_VL53L0X',
  'Adafruit_ST7789.h': 'Adafruit ST7735 and ST7789 Library',
  'PubSubClient.h': 'PubSubClient',
  'ESP32Servo.h': 'ESP32Servo',
  'OneWire.h': 'OneWire',
  'DallasTemperature.h': 'DallasTemperature',
  'LiquidCrystal_I2C.h': 'LiquidCrystal_I2C',
  'TM1637Display.h': 'TM1637Display',
  'MD_MAX72xx.h': 'MD_MAX72XX',
  'Keypad.h': 'Keypad',
  'BH1750.h': 'BH1750',
  'HX711.h': 'HX711',
  'IRremote.hpp': 'IRremote',
  'UniversalTelegramBot.h': 'UniversalTelegramBot',
  'DFRobotDFPlayerMini.h': 'DFRobotDFPlayerMini',
  'ArduinoJson.h': 'ArduinoJson',
};

export function detectRequiredLibraries(code: string): string[] {
  const libs = new Set<string>();
  const regex = /^\s*#include\s*[<"]([^>"]+)[>"]/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(code)) !== null) {
    const header = match[1];
    if (HEADER_LIBRARY_MAP[header]) {
      libs.add(HEADER_LIBRARY_MAP[header]);
    }
  }
  return Array.from(libs);
}

export function buildPlatformIoIni(boardId: string, libraries: string[]): string {
  const board = getBoardById(boardId);
  const libBlock =
    libraries.length > 0
      ? `\nlib_deps =\n${libraries.map((lib) => `    ${lib}`).join('\n')}`
      : '';

  const extraFlags =
    board.nativeUsb && board.family === 'esp32'
      ? `\nbuild_flags =\n    -DARDUINO_USB_CDC_ON_BOOT=1`
      : '';

  return `[env:${board.id}]
platform = ${board.platformioPlatform}
board = ${board.platformioBoard}
framework = arduino
monitor_speed = ${board.defaultSerialBaud}
upload_speed = ${board.defaultUploadBaud}${extraFlags}${libBlock}
`;
}

export function validateGpioUsage(boardId: string, code: string): GpioWarning[] {
  const board = getBoardById(boardId);
  const warnings: GpioWarning[] = [];
  const seen = new Set<number>();

  // Match pinMode(12, ...), digitalWrite(12, ...), analogRead(34), Pin(13, ...), #define PIN 12
  const patterns = [
    /\b(?:pinMode|digitalWrite|digitalRead|analogRead|analogWrite|touchRead|ledcAttach|dacWrite)\s*\(\s*(\d{1,2})\b/g,
    /\bPin\s*\(\s*(\d{1,2})\b/g,
    /#define\s+[A-Z0-9_]*PIN[A-Z0-9_]*\s+(\d{1,2})\b/g,
  ];

  const referencedGpios: number[] = [];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      const gpio = Number(m[1]);
      if (!Number.isNaN(gpio)) {
        referencedGpios.push(gpio);
      }
    }
  }

  const usesWifi = /\b(WiFi\.begin|WiFi\.mode|ESP8266WiFi|network\.WLAN)\b/.test(code);
  const usesOutputOnPin = (gpio: number): boolean => {
    const outRe = new RegExp(
      `(?:pinMode\\s*\\(\\s*${gpio}\\s*,\\s*OUTPUT\\b|digitalWrite\\s*\\(\\s*${gpio}\\b|Pin\\s*\\(\\s*${gpio}\\s*,\\s*Pin\\.OUT\\b)`
    );
    return outRe.test(code);
  };
  const usesAnalogOnPin = (gpio: number): boolean => {
    const adcRe = new RegExp(`(?:analogRead\\s*\\(\\s*${gpio}\\b|ADC\\s*\\(\\s*Pin\\s*\\(\\s*${gpio}\\b)`);
    return adcRe.test(code);
  };

  for (const gpio of referencedGpios) {
    if (seen.has(gpio)) continue;
    seen.add(gpio);

    const spec = board.pins.find((p) => p.gpio === gpio);
    if (!spec) continue;

    if (spec.isInternalFlash) {
      warnings.push({
        gpio,
        severity: 'error',
        message: `GPIO ${gpio} is wired to internal SPI Flash on ${board.shortName} and will crash the chip if toggled.`,
      });
      continue;
    }

    if (spec.isInputOnly && usesOutputOnPin(gpio)) {
      warnings.push({
        gpio,
        severity: 'error',
        message: `GPIO ${gpio} is input-only on ${board.shortName} and cannot be configured as OUTPUT.`,
      });
    }

    if (spec.isAdc2 && usesWifi && usesAnalogOnPin(gpio)) {
      warnings.push({
        gpio,
        severity: 'warning',
        message: `GPIO ${gpio} uses ADC2, which cannot be read while Wi-Fi is active. Move analogRead() to an ADC1 pin.`,
      });
    }

    if (spec.isStrapping && spec.warning) {
      warnings.push({
        gpio,
        severity: 'info',
        message: `GPIO ${gpio} (${spec.label}): ${spec.warning}`,
      });
    }
  }

  return warnings;
}

export function parseSerialPlotterLine(line: string): Record<string, number> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Support "temp:24.0,humidity:58.0" or "temp=24.5 hum=61.2" while ignoring dotted IPs/versions like "192.168.1.10"
  const kvRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*[:=]\s*(-?\d+(?:\.\d+)?)(?=$|[\s,;|])/g;
  const kvResult: Record<string, number> = {};
  let kvMatch: RegExpExecArray | null;
  while ((kvMatch = kvRegex.exec(trimmed)) !== null) {
    kvResult[kvMatch[1]] = Number(kvMatch[2]);
  }
  if (Object.keys(kvResult).length > 0) {
    return kvResult;
  }

  // Support pure comma/space separated numeric CSV like "24.5, 61.2"
  const parts = trimmed.split(/[,\s]+/).filter(Boolean);
  if (parts.length > 0 && parts.every((p) => /^-?\d+(?:\.\d+)?$/.test(p))) {
    const numeric: Record<string, number> = {};
    parts.forEach((p, idx) => {
      numeric[`ch${idx + 1}`] = Number(p);
    });
    return numeric;
  }

  return null;
}

export interface SerialPlotDatum {
  sample: number;
  label: string;
  timestamp: string;
  [seriesKey: string]: number | string;
}

export interface SerialPlotSeriesStats {
  latest: number;
  min: number;
  max: number;
}

export interface SerialPlotterDataset {
  data: SerialPlotDatum[];
  seriesKeys: string[];
  stats: Record<string, SerialPlotSeriesStats>;
  totalSamples: number;
}

export function buildSerialPlotterData(
  logs: SerialLogEntry[],
  maxPoints = 60
): SerialPlotterDataset {
  const allPoints: SerialPlotDatum[] = [];

  for (const entry of logs) {
    if (entry.direction !== 'rx') continue;
    const parsed = parseSerialPlotterLine(entry.text);
    if (!parsed) continue;
    const sample = allPoints.length + 1;
    allPoints.push({
      sample,
      label: entry.timestamp ? entry.timestamp : `#${sample}`,
      timestamp: entry.timestamp,
      ...parsed,
    });
  }

  const windowLimit = Math.max(1, maxPoints);
  const sliced = allPoints.slice(-windowLimit);

  const keySet = new Set<string>();
  const stats: Record<string, SerialPlotSeriesStats> = {};

  for (const datum of sliced) {
    for (const [key, val] of Object.entries(datum)) {
      if (key === 'sample' || key === 'label' || key === 'timestamp') continue;
      if (typeof val !== 'number' || !Number.isFinite(val)) continue;
      keySet.add(key);
      const prev = stats[key];
      if (!prev) {
        stats[key] = { latest: val, min: val, max: val };
      } else {
        stats[key] = {
          latest: val,
          min: Math.min(prev.min, val),
          max: Math.max(prev.max, val),
        };
      }
    }
  }

  return {
    data: sliced,
    seriesKeys: Array.from(keySet).slice(0, 6),
    stats,
    totalSamples: allPoints.length,
  };
}

export function filterProjects(
  projects: EspProject[],
  options: {
    query?: string;
    boardFilter?: 'all' | BoardFamily;
    category?: string;
    difficulty?: 'all' | 'Beginner' | 'Intermediate';
    framework?: 'all' | FrameworkId;
  }
): EspProject[] {
  const q = (options.query ?? '').trim().toLowerCase();
  return projects.filter((p) => {
    if (options.boardFilter && options.boardFilter !== 'all') {
      if (!p.boards.includes(options.boardFilter)) return false;
    }
    if (options.category && options.category !== 'All') {
      if (p.category !== options.category) return false;
    }
    if (options.difficulty && options.difficulty !== 'all') {
      if (p.difficulty !== options.difficulty) return false;
    }
    if (options.framework && options.framework !== 'all') {
      if (p.framework !== options.framework) return false;
    }
    if (q) {
      const haystack = `${p.title} ${p.summary} ${p.category} ${p.parts.join(' ')} ${p.libraries.join(' ')}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function calculateVoltageDivider(vin: number, r1Ohms: number, r2Ohms: number): {
  vout: number;
  safeForEsp32: boolean;
  currentMa: number;
} {
  if (r1Ohms + r2Ohms <= 0) {
    return { vout: 0, safeForEsp32: true, currentMa: 0 };
  }
  const vout = vin * (r2Ohms / (r1Ohms + r2Ohms));
  const currentMa = (vin / (r1Ohms + r2Ohms)) * 1000;
  return {
    vout: Number(vout.toFixed(3)),
    safeForEsp32: vout <= 3.35,
    currentMa: Number(currentMa.toFixed(3)),
  };
}

export function calculateBatteryLifeHours(
  batteryMah: number,
  activeMa: number,
  activeSeconds: number,
  sleepUa: number,
  sleepSeconds: number
): { avgMa: number; hours: number; days: number } {
  const totalSec = activeSeconds + sleepSeconds;
  if (totalSec <= 0 || batteryMah <= 0) {
    return { avgMa: 0, hours: 0, days: 0 };
  }
  const sleepMa = sleepUa / 1000;
  const avgMa = (activeMa * activeSeconds + sleepMa * sleepSeconds) / totalSec;
  if (avgMa <= 0) return { avgMa: 0, hours: 0, days: 0 };
  const hours = batteryMah / avgMa;
  return {
    avgMa: Number(avgMa.toFixed(3)),
    hours: Number(hours.toFixed(1)),
    days: Number((hours / 24).toFixed(1)),
  };
}

export function getSketchFilename(framework: FrameworkId, title?: string): string {
  const slug = (title ?? 'rs_esp_sketch')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'rs_esp_sketch';
  if (framework === 'micropython') return 'main.py';
  if (framework === 'espidf') return 'main.c';
  return `${slug}.ino`;
}

export function getAllSupportedBoardIds(): string[] {
  return ESP_BOARDS.map((b) => b.id);
}

export function parseHexInput(
  input: string
): { ok: true; bytes: Uint8Array } | { ok: false; error: string } {
  const cleaned = input
    .trim()
    .replace(/0x/gi, ' ')
    .replace(/[,:\s]+/g, ' ')
    .trim();

  if (!cleaned) {
    return { ok: false, error: 'Enter space-separated hex bytes (e.g. AA 55 01 0D).' };
  }

  const tokens = cleaned.split(' ');
  const bytes: number[] = [];

  for (const token of tokens) {
    if (!/^[0-9a-fA-F]+$/.test(token)) {
      return { ok: false, error: `Invalid hex token "${token}". Use pairs 00–FF.` };
    }
    if (token.length <= 2) {
      bytes.push(Number.parseInt(token, 16));
    } else if (token.length % 2 === 0) {
      for (let i = 0; i < token.length; i += 2) {
        bytes.push(Number.parseInt(token.slice(i, i + 2), 16));
      }
    } else {
      return { ok: false, error: `Token "${token}" has an odd number of hex digits.` };
    }
  }

  return { ok: true, bytes: new Uint8Array(bytes) };
}

export interface HexDumpRow {
  offset: string;
  hex: string;
  ascii: string;
}

export function formatHexDumpRows(bytes: number[] | Uint8Array, bytesPerRow = 16): HexDumpRow[] {
  const rows: HexDumpRow[] = [];
  for (let i = 0; i < bytes.length; i += bytesPerRow) {
    const slice = Array.from(bytes.slice(i, i + bytesPerRow));
    const offset = i.toString(16).toUpperCase().padStart(4, '0');
    const hexTokens = slice.map((b) => b.toString(16).toUpperCase().padStart(2, '0'));
    while (hexTokens.length < bytesPerRow) {
      hexTokens.push('  ');
    }
    const left = hexTokens.slice(0, 8).join(' ');
    const right = hexTokens.slice(8).join(' ');
    const hex = bytesPerRow === 16 ? `${left}  ${right}` : hexTokens.join(' ');
    const ascii = slice
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');
    rows.push({ offset, hex, ascii });
  }
  return rows;
}

export function buildStarterBlinkCode(boardId: string, framework: FrameworkId): string {
  const board = getBoardById(boardId);
  const ledPin = board.defaultLedPin;

  if (framework === 'micropython') {
    return [
      'from machine import Pin',
      'import time',
      '',
      `led = Pin(${ledPin}, Pin.OUT)`,
      `print("Rs-ESP: ${board.shortName} MicroPython Blink Ready (GPIO ${ledPin})")`,
      '',
      'while True:',
      '    led.value(1)',
      '    print("LED: ON")',
      '    time.sleep(1)',
      '    led.value(0)',
      '    print("LED: OFF")',
      '    time.sleep(1)',
    ].join('\n');
  }

  if (framework === 'espidf') {
    return [
      '#include <stdio.h>',
      '#include "freertos/FreeRTOS.h"',
      '#include "freertos/task.h"',
      '#include "driver/gpio.h"',
      '',
      `#define LED_GPIO GPIO_NUM_${ledPin}`,
      '',
      'void app_main(void) {',
      '    gpio_reset_pin(LED_GPIO);',
      '    gpio_set_direction(LED_GPIO, GPIO_MODE_OUTPUT);',
      `    printf("Rs-ESP: ${board.shortName} ESP-IDF Blink Ready\\n");`,
      '',
      '    while (1) {',
      '        gpio_set_level(LED_GPIO, 1);',
      '        printf("LED: ON\\n");',
      '        vTaskDelay(pdMS_TO_TICKS(1000));',
      '        gpio_set_level(LED_GPIO, 0);',
      '        printf("LED: OFF\\n");',
      '        vTaskDelay(pdMS_TO_TICKS(1000));',
      '    }',
      '}',
    ].join('\n');
  }

  return [
    `#define LED_PIN ${ledPin}`,
    '',
    'void setup() {',
    '  Serial.begin(115200);',
    '  pinMode(LED_PIN, OUTPUT);',
    `  Serial.println("Rs-ESP: ${board.shortName} Onboard LED Blink Ready");`,
    '}',
    '',
    'void loop() {',
    '  digitalWrite(LED_PIN, HIGH);',
    '  Serial.println("LED: ON");',
    '  delay(1000);',
    '',
    '  digitalWrite(LED_PIN, LOW);',
    '  Serial.println("LED: OFF");',
    '  delay(1000);',
    '}',
  ].join('\n');
}

export function isStarterBlinkCode(code: string): boolean {
  const normalized = code.trim();
  return (
    normalized.includes('Onboard LED Blink Ready') ||
    normalized.includes('MicroPython Blink Ready') ||
    normalized.includes('ESP-IDF Blink Ready')
  );
}

