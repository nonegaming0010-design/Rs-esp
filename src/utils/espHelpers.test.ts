import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { BEGINNER_PROJECTS, PROJECT_CATEGORIES } from '../data/projects/index';
import { ESP_BOARDS, getBoardById } from '../data/boards';
import {
  buildPlatformIoIni,
  buildSerialPlotterData,
  buildStarterBlinkCode,
  calculateBatteryLifeHours,
  calculateVoltageDivider,
  detectRequiredLibraries,
  filterProjects,
  formatHexDumpRows,
  getSketchFilename,
  isStarterBlinkCode,
  parseHexInput,
  parseSerialPlotterLine,
  validateGpioUsage,
} from './espHelpers';
import { buildProjectZipBundle } from './projectBundle';
import { crc32 } from './zipBuilder';
import {
  CLOUD_LIMITS,
  detectFrameworkFromFilename,
  formatRelativeTime,
  generateSafeDocId,
  sanitizeCloudSketchInput,
  sanitizeCommentBody,
  sanitizeDisplayName,
} from './cloudValidation';
import {
  analyzeCircuitFor3d,
  classifyComponentKind,
  extractCodeBehavior,
  resolveEspPinTarget,
} from './circuit3dModel';
import {
  DEFAULT_SIM_ENV,
  evaluateRealTestSimulation,
  parseLoopTimingSteps,
} from './circuitSimEngine';
import { buildDatasheetPayload } from './datasheetPdf';
import {
  buildComponentWiringForBoard,
  COMPONENTS_CATALOG,
  mergeComponentIntoProject,
} from '../data/componentsCatalog';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  isBootstrapAdminEmail,
  isVerifiedAdminUser,
  sanitizeSiteConfigInput,
} from './adminHelpers';
import {
  extractBearerToken,
  parseCacheMaxAgeMs,
  parseJwtParts,
  validateFirebaseTokenClaims,
  verifyRs256Signature,
} from './authTokenVerifier';
import { normalizeViewMode } from './storage';

test('beginner projects catalog contains 100+ verified unique projects', () => {
  assert.ok(BEGINNER_PROJECTS.length >= 110, `Expected >= 110 projects, got ${BEGINNER_PROJECTS.length}`);
  const ids = new Set(BEGINNER_PROJECTS.map((p) => p.id));
  assert.equal(ids.size, BEGINNER_PROJECTS.length, 'Project IDs must be unique');
  for (const project of BEGINNER_PROJECTS) {
    assert.ok(project.title.length > 3);
    assert.ok(project.code.trim().length > 20, `Empty code in ${project.id}`);
    assert.ok(project.wiring.length >= 1, `Missing wiring in ${project.id}`);
    assert.ok(PROJECT_CATEGORIES.includes(project.category), `Invalid category in ${project.id}`);
  }
});

test('board catalog includes major ESP32 and ESP8266 variants', () => {
  const ids = ESP_BOARDS.map((b) => b.id);
  for (const required of ['esp32-devkit-v1', 'esp32-s3', 'esp32-c3', 'esp32-c6', 'esp32-cam', 'esp8266-nodemcu', 'esp8266-d1-mini']) {
    assert.ok(ids.includes(required), `Missing board ${required}`);
  }
  assert.equal(getBoardById('nonexistent').id, 'esp32-devkit-v1');
});

test('validateGpioUsage detects internal SPI flash, input-only output, and ADC2+WiFi hazards', () => {
  const flashErr = validateGpioUsage('esp32-devkit-v1', 'void setup() { pinMode(6, OUTPUT); }');
  assert.ok(flashErr.some((w) => w.gpio === 6 && w.severity === 'error'));

  const inputOnlyErr = validateGpioUsage('esp32-devkit-v1', 'void setup() { pinMode(34, OUTPUT); }');
  assert.ok(inputOnlyErr.some((w) => w.gpio === 34 && w.severity === 'error'));

  const adc2WifiWarn = validateGpioUsage(
    'esp32-devkit-v1',
    '#include <WiFi.h>\nvoid setup(){ WiFi.begin("a","b"); }\nvoid loop(){ analogRead(4); }'
  );
  assert.ok(adc2WifiWarn.some((w) => w.gpio === 4 && w.severity === 'warning'));
});

test('detectRequiredLibraries and buildPlatformIoIni extract libraries accurately', () => {
  const code = `#include <WiFi.h>\n#include <DHT.h>\n#include <Adafruit_SSD1306.h>`;
  const libs = detectRequiredLibraries(code);
  assert.deepEqual(libs, ['DHT sensor library', 'Adafruit SSD1306']);
  const ini = buildPlatformIoIni('esp32-s3', libs);
  assert.match(ini, /board = esp32-s3-devkitc-1/);
  assert.match(ini, /DHT sensor library/);
  assert.match(ini, /-DARDUINO_USB_CDC_ON_BOOT=1/);
});

test('parseSerialPlotterLine parses key:value and CSV numeric telemetry', () => {
  assert.deepEqual(parseSerialPlotterLine('temp:24.0,humidity:58.0'), { temp: 24, humidity: 58 });
  assert.deepEqual(parseSerialPlotterLine('temp=24.5, hum=-6.2'), { temp: 24.5, hum: -6.2 });
  assert.deepEqual(parseSerialPlotterLine('120, 45.5, -3'), { ch1: 120, ch2: 45.5, ch3: -3 });
  assert.equal(parseSerialPlotterLine('Connecting to Wi-Fi...'), null);
  assert.equal(parseSerialPlotterLine('IP: 192.168.1.10'), null);
});

test('buildSerialPlotterData extracts rx series, computes stats, and respects window limit', () => {
  const dataset = buildSerialPlotterData(
    [
      { id: '1', timestamp: '10:00:01', direction: 'system', text: 'Booting...' },
      { id: '2', timestamp: '10:00:02', direction: 'tx', text: 'temp:99.0,humidity:99.0' },
      { id: '3', timestamp: '10:00:03', direction: 'rx', text: 'temp:24.0,humidity:58.0' },
      { id: '4', timestamp: '10:00:04', direction: 'rx', text: 'Wi-Fi connected' },
      { id: '5', timestamp: '10:00:05', direction: 'rx', text: 'temp:25.5,humidity:55.0' },
      { id: '6', timestamp: '10:00:06', direction: 'rx', text: 'temp:23.2,humidity:60.0' },
    ],
    2
  );
  assert.equal(dataset.totalSamples, 3);
  assert.equal(dataset.data.length, 2);
  assert.deepEqual(dataset.seriesKeys, ['temp', 'humidity']);
  assert.equal(dataset.data[0].temp, 25.5);
  assert.equal(dataset.data[1].humidity, 60);
  assert.deepEqual(dataset.stats.temp, { latest: 23.2, min: 23.2, max: 25.5 });
  assert.deepEqual(dataset.stats.humidity, { latest: 60, min: 55, max: 60 });
});

test('filterProjects filters by board family, category, difficulty, and query', () => {
  const wifi8266 = filterProjects(BEGINNER_PROJECTS, {
    boardFilter: 'esp8266',
    category: 'Wi-Fi & Web Servers',
  });
  assert.ok(wifi8266.length >= 2);
  assert.ok(wifi8266.every((p) => p.boards.includes('esp8266')));

  const oledSearch = filterProjects(BEGINNER_PROJECTS, { query: 'SSD1306' });
  assert.ok(oledSearch.length >= 3);
});

test('hardware calculators compute safe divider voltage and battery runtime', () => {
  const div5v = calculateVoltageDivider(5.0, 10000, 20000);
  assert.equal(div5v.safeForEsp32, true);
  assert.ok(div5v.vout > 3.2 && div5v.vout <= 3.35);

  const unsafeDiv = calculateVoltageDivider(5.0, 1000, 10000);
  assert.equal(unsafeDiv.safeForEsp32, false);

  const bat = calculateBatteryLifeHours(2000, 80, 2, 20, 58);
  assert.ok(bat.hours > 500);
  assert.equal(getSketchFilename('micropython', 'Test'), 'main.py');
});

test('parseHexInput and formatHexDumpRows handle binary frames accurately', () => {
  const valid = parseHexInput('AA 55 0x01, 0D0A');
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.deepEqual(Array.from(valid.bytes), [0xaa, 0x55, 0x01, 0x0d, 0x0a]);
  }

  const invalid = parseHexInput('AA ZZ');
  assert.equal(invalid.ok, false);

  const odd = parseHexInput('ABC');
  assert.equal(odd.ok, false);

  const rows = formatHexDumpRows(new Uint8Array([0x4c, 0x45, 0x44, 0x0a]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].offset, '0000');
  assert.ok(rows[0].hex.startsWith('4C 45 44 0A'));
  assert.equal(rows[0].ascii, 'LED.');
});

test('buildProjectZipBundle packages ready-to-compile Arduino, MicroPython, and ESP-IDF archives', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);

  const arduinoZip = buildProjectZipBundle({
    title: 'DHT22 WiFi Monitor',
    code: '#include <DHT.h>\nvoid setup() {}\nvoid loop() {}',
    boardId: 'esp32-devkit-v1',
    framework: 'arduino',
    wiring: [{ from: 'DHT22 DATA', to: 'GPIO 4' }],
    libraries: [],
    baudRate: 115200,
  });
  assert.equal(arduinoZip.filename, 'dht22_wifi_monitor_rs_esp.zip');
  assert.ok(arduinoZip.files.some((f) => f.path.endsWith('/platformio.ini')));
  assert.ok(arduinoZip.files.some((f) => f.path.endsWith('/src/main.cpp')));
  assert.ok(arduinoZip.files.some((f) => f.path.endsWith('.ino')));
  // Verify PK\x03\x04 local header and PK\x05\x06 EOCD signature
  assert.equal(arduinoZip.archive[0], 0x50);
  assert.equal(arduinoZip.archive[1], 0x4b);
  assert.equal(arduinoZip.archive[2], 0x03);
  assert.equal(arduinoZip.archive[3], 0x04);
  const len = arduinoZip.archive.length;
  assert.equal(arduinoZip.archive[len - 22], 0x50);
  assert.equal(arduinoZip.archive[len - 21], 0x4b);
  assert.equal(arduinoZip.archive[len - 20], 0x05);
  assert.equal(arduinoZip.archive[len - 19], 0x06);

  const mpZip = buildProjectZipBundle({
    title: 'MP Blink',
    code: 'print("ok")',
    boardId: 'esp8266-d1-mini',
    framework: 'micropython',
    wiring: [],
    libraries: [],
    baudRate: 115200,
  });
  assert.ok(mpZip.files.some((f) => f.path.endsWith('/main.py')));
  assert.ok(mpZip.files.some((f) => f.path.endsWith('/boot.py')));

  const idfZip = buildProjectZipBundle({
    title: 'IDF Blink',
    code: 'void app_main(void) {}',
    boardId: 'esp32-s3',
    framework: 'espidf',
    wiring: [],
    libraries: [],
    baudRate: 115200,
  });
  assert.ok(idfZip.files.some((f) => f.path.endsWith('/CMakeLists.txt')));
  assert.ok(idfZip.files.some((f) => f.path.endsWith('/main/main.c')));
});

test('buildStarterBlinkCode adapts starter code to selected board LED pin and framework', () => {
  const s3Arduino = buildStarterBlinkCode('esp32-s3', 'arduino');
  assert.ok(s3Arduino.includes('#define LED_PIN 48'));
  assert.equal(isStarterBlinkCode(s3Arduino), true);

  const c3Mp = buildStarterBlinkCode('esp32-c3', 'micropython');
  assert.ok(c3Mp.includes('from machine import Pin'));
  assert.ok(c3Mp.includes('Pin(8, Pin.OUT)'));
  assert.equal(isStarterBlinkCode(c3Mp), true);

  const idf = buildStarterBlinkCode('esp32-devkit-v1', 'espidf');
  assert.ok(idf.includes('void app_main(void)'));
  assert.ok(idf.includes('GPIO_NUM_2'));
  assert.equal(isStarterBlinkCode(idf), true);

  assert.equal(isStarterBlinkCode('void customSketch() {}'), false);
});

test('cloudValidation sanitizes sketches, comments, display names, filenames, and doc IDs', () => {
  const docId = generateSafeDocId('sk');
  assert.ok(docId.length > 5 && docId.length <= CLOUD_LIMITS.ID_MAX);
  assert.match(docId, CLOUD_LIMITS.ID_PATTERN);

  assert.equal(sanitizeDisplayName('  Alex Maker  ', 'a@b.com'), 'Alex Maker');
  assert.equal(sanitizeDisplayName('', 'maker@esp.dev'), 'maker');
  assert.equal(sanitizeDisplayName('', null), 'ESP Builder');

  assert.equal(detectFrameworkFromFilename('main.py'), 'micropython');
  assert.equal(detectFrameworkFromFilename('app_main.c'), 'espidf');
  assert.equal(detectFrameworkFromFilename('blink.ino'), 'arduino');

  const emptyTitle = sanitizeCloudSketchInput({
    title: '   ',
    summary: 'desc',
    code: 'void setup(){}',
    boardId: 'esp32-devkit-v1',
    boardName: 'ESP32',
    framework: 'arduino',
    visibility: 'public',
    tags: [],
    libraries: [],
    wiring: [],
    baudRate: 115200,
  });
  assert.equal(emptyTitle.ok, false);

  const emptyCode = sanitizeCloudSketchInput({
    title: 'Valid',
    summary: 'desc',
    code: '   ',
    boardId: 'esp32-devkit-v1',
    boardName: 'ESP32',
    framework: 'arduino',
    visibility: 'private',
    tags: [],
    libraries: [],
    wiring: [],
    baudRate: 115200,
  });
  assert.equal(emptyCode.ok, false);

  const valid = sanitizeCloudSketchInput({
    title: '  Temp Logger  ',
    summary: '  Reads DHT22  ',
    code: 'void setup(){}\nvoid loop(){}',
    boardId: 'esp32-s3',
    boardName: 'ESP32-S3',
    framework: 'arduino',
    visibility: 'private',
    tags: ['Wi-Fi', 'Wi-Fi', 'DHT22', '1', '2', '3', '4', '5', '6', '7'],
    libraries: ['DHT', 'DHT'],
    wiring: [{ from: 'DHT22', to: 'GPIO 4', note: ' 10k pullup ' }],
    baudRate: 99999999,
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.payload.title, 'Temp Logger');
    assert.equal(valid.payload.visibility, 'private');
    assert.equal(valid.payload.tags.length, CLOUD_LIMITS.TAGS_MAX);
    assert.deepEqual(valid.payload.libraries, ['DHT']);
    assert.equal(valid.payload.baudRate, CLOUD_LIMITS.BAUD_MAX);
    assert.equal(valid.payload.wiring[0].note, '10k pullup');
  }

  assert.equal(sanitizeCommentBody('   ').ok, false);
  const okComment = sanitizeCommentBody('  Great wiring!  ');
  assert.deepEqual(okComment, { ok: true, body: 'Great wiring!' });

  const now = 1_700_000_000_000;
  assert.equal(formatRelativeTime(now - 20_000, now), 'just now');
  assert.equal(formatRelativeTime(now - 180_000, now), '3m ago');
  assert.equal(formatRelativeTime(now - 7_200_000, now), '2h ago');
});

test('circuit3dModel resolves ESP pins, classifies hardware components, and builds 3D wires from code & wiring', () => {
  const esp32 = getBoardById('esp32-devkit-v1');
  const esp8266 = getBoardById('esp8266-nodemcu');

  assert.deepEqual(resolveEspPinTarget('GPIO 21', esp32), { gpio: 21, rail: null, label: 'GPIO 21' });
  assert.deepEqual(
    resolveEspPinTarget('GPIO 18 (use voltage divider if 5V)', esp32),
    { gpio: 18, rail: null, label: 'GPIO 18' }
  );
  assert.deepEqual(resolveEspPinTarget('3.3V', esp32), { gpio: null, rail: '3v3', label: '3.3V' });
  assert.deepEqual(resolveEspPinTarget('GND', esp32), { gpio: null, rail: 'gnd', label: 'GND' });
  assert.deepEqual(resolveEspPinTarget('D2', esp8266), { gpio: 4, rail: null, label: 'D2 (GPIO 4)' });

  const sonicFourWire = analyzeCircuitFor3d(
    esp32,
    'const int TRIG = 5, ECHO = 18; void loop(){ pulseIn(ECHO, HIGH); }',
    [
      { from: 'TRIG', to: 'GPIO 5' },
      { from: 'ECHO', to: 'GPIO 18 (use voltage divider if 5V)' },
      { from: 'VCC', to: '5V/VIN' },
    ],
    'arduino'
  );
  assert.equal(sonicFourWire.components[0].kind, 'ultrasonic');
  assert.equal(sonicFourWire.wires.length, 4);

  assert.equal(classifyComponentKind('SSD1306 0.96" OLED'), 'oled_ssd1306');
  assert.equal(classifyComponentKind('SG90 Micro Servo'), 'servo');
  assert.equal(classifyComponentKind('HC-SR04 Ultrasonic'), 'ultrasonic');
  assert.equal(classifyComponentKind('DHT22 Sensor'), 'dht22');

  const oledDhtCode = `
    #include <DHT.h>
    #include <Adafruit_SSD1306.h>
    #define DHTPIN 4
    void setup() {
      display.println("Temp Monitor");
      delay(500);
    }
  `;
  const analysis = analyzeCircuitFor3d(
    esp32,
    oledDhtCode,
    [
      { from: 'DHT22 DATA', to: 'GPIO 4', note: '10k pullup' },
      { from: 'OLED SDA', to: 'GPIO 21' },
      { from: 'OLED SCL', to: 'GPIO 22' },
    ],
    'arduino'
  );

  assert.ok(analysis.components.some((c) => c.kind === 'dht22'));
  assert.ok(analysis.components.some((c) => c.kind === 'oled_ssd1306'));
  assert.ok(analysis.wires.some((w) => w.espGpio === 4 && w.componentTerminalLabel === 'DATA'));
  assert.ok(analysis.wires.some((w) => w.espGpio === 21 && w.signalKind === 'i2c'));
  assert.ok(analysis.wires.some((w) => w.espRail === 'gnd'));
  assert.equal(analysis.simulation.hasDht, true);
  assert.equal(analysis.simulation.hasOled, true);
  assert.ok(analysis.simulation.oledLines.includes('Temp Monitor'));

  const servoBehavior = extractCodeBehavior(
    '#include <ESP32Servo.h>\nServo s;\nvoid setup(){ s.attach(18); }\nvoid loop(){ s.write(90); delay(300); }',
    esp32,
    'arduino'
  );
  assert.equal(servoBehavior.hasServo, true);
  assert.ok(servoBehavior.activeGpios.includes(18));

  // Bare pin rows ("SDA", "SCL", "VCC") paired with SSD1306 code must merge into 1 OLED module with 4 wires
  const bareOledAnalysis = analyzeCircuitFor3d(
    esp32,
    '#include <Adafruit_SSD1306.h>\nvoid setup(){ display.println("Hello"); }',
    [
      { from: 'SDA', to: 'GPIO 21' },
      { from: 'SCL', to: 'GPIO 22' },
      { from: 'VCC', to: '3.3V' },
    ],
    'arduino'
  );
  assert.equal(bareOledAnalysis.components.length, 1);
  assert.equal(bareOledAnalysis.components[0].kind, 'oled_ssd1306');
  assert.equal(bareOledAnalysis.wires.length, 4);

  // Bare servo rows ("Signal (Orange)", "VCC (Red)", "GND (Brown)") must merge into 1 Servo with 3 wires
  const bareServoAnalysis = analyzeCircuitFor3d(
    esp32,
    '#include <ESP32Servo.h>\nServo s;\nvoid setup(){ s.attach(13); }',
    [
      { from: 'Signal (Orange)', to: 'GPIO 13' },
      { from: 'VCC (Red)', to: '5V/VIN' },
      { from: 'GND (Brown)', to: 'GND' },
    ],
    'arduino'
  );
  assert.equal(bareServoAnalysis.components.length, 1);
  assert.equal(bareServoAnalysis.components[0].kind, 'servo');
  assert.equal(bareServoAnalysis.wires.length, 3);
});

test('circuit3dModel groups RGB LED, Traffic Light, comma-separated GPIOs, and VIN/GND power rails', () => {
  const esp32 = getBoardById('esp32-devkit-v1');

  assert.equal(classifyComponentKind('LDR Light Sensor AOUT'), 'light_sensor');
  assert.equal(classifyComponentKind('Smart Lamp DATA'), 'lamp_bulb');
  assert.equal(classifyComponentKind('28BYJ-48 Stepper'), 'stepper');
  assert.equal(classifyComponentKind('TM1637 7-Segment'), 'seven_seg');

  const rgbAnalysis = analyzeCircuitFor3d(
    esp32,
    'void setup(){ ledcAttachPin(25, 0); }',
    [
      { from: 'Red Pin', to: 'GPIO 25' },
      { from: 'Green Pin', to: 'GPIO 26' },
      { from: 'Blue Pin', to: 'GPIO 27' },
      { from: 'Common Cathode', to: 'GND' },
    ],
    'arduino'
  );
  assert.equal(rgbAnalysis.components.length, 1);
  assert.equal(rgbAnalysis.components[0].kind, 'rgb_led');
  assert.equal(rgbAnalysis.wires.length, 4);

  const trafficAnalysis = analyzeCircuitFor3d(
    esp32,
    'void setup(){ pinMode(25, OUTPUT); pinMode(26, OUTPUT); pinMode(27, OUTPUT); }',
    [
      { from: 'Red LED', to: 'GPIO 25' },
      { from: 'Yellow LED', to: 'GPIO 26' },
      { from: 'Green LED', to: 'GPIO 27' },
    ],
    'arduino'
  );
  assert.equal(trafficAnalysis.components.length, 1);
  assert.equal(trafficAnalysis.components[0].kind, 'traffic_light');

  const chaserAnalysis = analyzeCircuitFor3d(
    esp32,
    'void setup(){}',
    [
      { from: 'LEDs 1..5', to: 'GPIO 13, 14, 27, 26, 25' },
      { from: 'MPU6050 VIN/GND', to: '3.3V / GND' },
    ],
    'arduino'
  );
  assert.ok(chaserAnalysis.wires.some((w) => w.espGpio === 13));
  assert.ok(chaserAnalysis.wires.some((w) => w.espGpio === 25));
  assert.ok(chaserAnalysis.wires.some((w) => w.espRail === '3v3'));
  assert.ok(chaserAnalysis.wires.some((w) => w.espRail === 'gnd'));
});

test('circuitSimEngine simulates loop digitalWrite/delay steps and real sensor thresholds', () => {
  const esp32 = getBoardById('esp32-devkit-v1');
  const blinkCode = `
    #define LED 2
    void setup() { pinMode(LED, OUTPUT); }
    void loop() {
      digitalWrite(LED, HIGH);
      delay(200);
      digitalWrite(LED, LOW);
      delay(600);
    }
  `;
  const steps = parseLoopTimingSteps(blinkCode, esp32.defaultLedPin);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].durationMs, 200);
  assert.equal(steps[0].pinStates[2], 1);
  assert.equal(steps[1].durationMs, 600);
  assert.equal(steps[1].pinStates[2], 0);

  const blinkAnalysis = analyzeCircuitFor3d(esp32, blinkCode, [], 'arduino');
  const highFrame = evaluateRealTestSimulation(esp32, blinkCode, blinkAnalysis, DEFAULT_SIM_ENV, 0.1);
  assert.equal(highFrame.onboardLedBrightness, 1);
  const lowFrame = evaluateRealTestSimulation(esp32, blinkCode, blinkAnalysis, DEFAULT_SIM_ENV, 0.5);
  assert.equal(lowFrame.onboardLedBrightness, 0);

  const unpoweredFrame = evaluateRealTestSimulation(
    esp32,
    blinkCode,
    blinkAnalysis,
    { ...DEFAULT_SIM_ENV, powered: false },
    0.1
  );
  assert.equal(unpoweredFrame.onboardLedBrightness, 0);
  assert.match(unpoweredFrame.serialOutput, /\[OFF\]/);

  // LDR Light sensor nightlight turns lamp ON below 300 lux and OFF at >= 300 lux
  const ldrAnalysis = analyzeCircuitFor3d(
    esp32,
    'void loop(){ analogRead(34); }',
    [
      { from: 'LDR Light Sensor AOUT', to: 'GPIO 34' },
      { from: 'Smart Lamp DATA', to: 'GPIO 26' },
    ],
    'arduino'
  );
  const darkFrame = evaluateRealTestSimulation(
    esp32,
    'void loop(){ analogRead(34); }',
    ldrAnalysis,
    { ...DEFAULT_SIM_ENV, lightLux: 120 },
    1.0
  );
  assert.equal(darkFrame.lampBrightness, 1);
  assert.match(darkFrame.serialOutput, /nightlight:ON/);

  const brightFrame = evaluateRealTestSimulation(
    esp32,
    'void loop(){ analogRead(34); }',
    ldrAnalysis,
    { ...DEFAULT_SIM_ENV, lightLux: 650 },
    1.0
  );
  assert.equal(brightFrame.lampBrightness, 0);
  assert.match(brightFrame.serialOutput, /nightlight:OFF/);

  // Ultrasonic < 25 cm triggers buzzer alarm
  const sonicAnalysis = analyzeCircuitFor3d(
    esp32,
    'void loop(){}',
    [
      { from: 'HC-SR04 TRIG/ECHO', to: 'GPIO 5 / 18' },
      { from: 'Active Buzzer +', to: 'GPIO 15' },
    ],
    'arduino'
  );
  const closeFrame = evaluateRealTestSimulation(
    esp32,
    'void loop(){}',
    sonicAnalysis,
    { ...DEFAULT_SIM_ENV, distanceCm: 12 },
    1.0
  );
  assert.equal(closeFrame.buzzerActive, true);
  assert.match(closeFrame.serialOutput, /\[ALARM\]/);

  // DHT22 updates OLED displayLines with live temperature and fan relay state
  const dhtOledAnalysis = analyzeCircuitFor3d(
    esp32,
    '#include <DHT.h>\n#include <Adafruit_SSD1306.h>\nvoid setup(){ display.println("Climate"); }',
    [
      { from: 'DHT22 DATA', to: 'GPIO 4' },
      { from: 'SSD1306 OLED SDA', to: 'GPIO 21' },
    ],
    'arduino'
  );
  const hotFrame = evaluateRealTestSimulation(
    esp32,
    '#include <DHT.h>\n#include <Adafruit_SSD1306.h>',
    dhtOledAnalysis,
    { ...DEFAULT_SIM_ENV, temperatureC: 31.5 },
    2.0
  );
  assert.equal(hotFrame.relayOn, true);
  assert.ok(hotFrame.displayLines.some((l) => l.includes('31.5')));
  assert.match(hotFrame.serialOutput, /temp:31\.5/);
});

test('buildDatasheetPayload prepares slugged filename, merged libraries, platformio.ini, and source lines', () => {
  const esp32 = getBoardById('esp32-devkit-v1');
  const payload = buildDatasheetPayload({
    title: 'Smart Weather Station!',
    board: esp32,
    framework: 'arduino',
    code: '#include <DHT.h>\nvoid setup() { Serial.begin(115200); }\nvoid loop() {}',
    explanation: 'Reads temperature and prints telemetry.',
    wiring: [{ from: 'DHT22 DATA', to: 'GPIO 4', note: '10k pull-up' }],
    libraries: ['WiFiManager'],
    baudRate: 115200,
  });

  assert.equal(payload.filename, 'smart_weather_station_datasheet.pdf');
  assert.ok(payload.libraries.includes('WiFiManager'));
  assert.ok(payload.libraries.includes('DHT sensor library'));
  assert.match(payload.platformIoIni, /esp32doit-devkit-v1/);
  assert.equal(payload.wiringRows.length, 1);
  assert.equal(payload.wiringRows[0].espPin, 'GPIO 4');
  assert.equal(payload.codeLines.length, 3);
});

test('componentsCatalog builds board-aware wiring and deduplicates repeated merges', () => {
  assert.ok(COMPONENTS_CATALOG.length >= 16);
  const esp32 = getBoardById('esp32-devkit-v1');
  const esp8266 = getBoardById('esp8266-nodemcu');

  const dht11 = COMPONENTS_CATALOG.find((c) => c.id === 'dht11')!;
  const hcsr04 = COMPONENTS_CATALOG.find((c) => c.id === 'hc-sr04')!;
  const oled = COMPONENTS_CATALOG.find((c) => c.id === 'ssd1306-oled')!;
  assert.ok(dht11 && hcsr04 && oled);

  const merged1 = mergeComponentIntoProject(dht11, esp32, [], []);
  assert.equal(merged1.addedWiringCount, 3);
  assert.equal(merged1.addedLibCount, 2);
  assert.ok(merged1.nextWiring.some((w) => w.from === 'DHT11 DATA' && w.to.includes('GPIO 4')));
  assert.ok(merged1.nextLibraries.includes('DHT sensor library'));

  // Re-adding the same component should deduplicate
  const mergedRepeat = mergeComponentIntoProject(
    dht11,
    esp32,
    merged1.nextWiring,
    merged1.nextLibraries
  );
  assert.equal(mergedRepeat.addedWiringCount, 0);
  assert.equal(mergedRepeat.addedLibCount, 0);

  // HC-SR04 includes ECHO voltage divider note and avoids occupied GPIO 4
  const sonicRows = buildComponentWiringForBoard(hcsr04, esp32, merged1.nextWiring);
  assert.ok(sonicRows.some((r) => r.from === 'HC-SR04 ECHO' && r.note?.includes('divider')));

  // OLED adapts I2C SDA/SCL to board defaults (ESP32: 21/22, ESP8266: 4/5)
  const oled32 = buildComponentWiringForBoard(oled, esp32, []);
  assert.ok(oled32.some((r) => r.from === 'SSD1306 OLED SDA' && r.to.includes('GPIO 21')));
  assert.ok(oled32.some((r) => r.from === 'SSD1306 OLED SCL' && r.to.includes('GPIO 22')));

  const oled8266 = buildComponentWiringForBoard(oled, esp8266, []);
  assert.ok(oled8266.some((r) => r.from === 'SSD1306 OLED SDA' && r.to.includes('GPIO 4')));
  assert.ok(oled8266.some((r) => r.from === 'SSD1306 OLED SCL' && r.to.includes('GPIO 5')));
});

test('adminHelpers verifies bootstrap admin, email verification, and siteConfig sanitization', () => {
  assert.equal(BOOTSTRAP_ADMIN_EMAIL, 'nonegaming0010@gmail.com');
  assert.equal(isBootstrapAdminEmail('NoneGaming0010@gmail.com '), true);
  assert.equal(isBootstrapAdminEmail('other@example.com'), false);

  assert.equal(
    isVerifiedAdminUser({ email: 'nonegaming0010@gmail.com', emailVerified: false } as never, false),
    false
  );
  assert.equal(
    isVerifiedAdminUser({ email: 'nonegaming0010@gmail.com', emailVerified: true } as never, false),
    true
  );
  assert.equal(
    isVerifiedAdminUser({ email: 'helper@example.com', emailVerified: true } as never, true),
    true
  );
  assert.equal(
    isVerifiedAdminUser({ email: 'helper@example.com', emailVerified: true } as never, false),
    false
  );

  const sanitized = sanitizeSiteConfigInput({
    announcementEnabled: true,
    announcementText: `  ${'A'.repeat(300)}  `,
    allowNewPublicSketches: false,
  });
  assert.equal(sanitized.announcementEnabled, true);
  assert.equal(sanitized.announcementText.length, 280);
  assert.equal(sanitized.allowNewPublicSketches, false);
});

test('normalizeViewMode defaults unknown values to desktop and preserves phone', () => {
  assert.equal(normalizeViewMode('phone'), 'phone');
  assert.equal(normalizeViewMode('desktop'), 'desktop');
  assert.equal(normalizeViewMode(null), 'desktop');
  assert.equal(normalizeViewMode('tablet'), 'desktop');
});

test('authTokenVerifier extracts bearer tokens, validates RS256 signatures, and enforces Firebase claims', () => {
  assert.equal(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(extractBearerToken('bearer   my-token  '), 'my-token');
  assert.equal(extractBearerToken('Basic xyz'), null);
  assert.equal(extractBearerToken(undefined), null);
  assert.equal(parseCacheMaxAgeMs('public, max-age=1800'), 1_800_000);
  assert.equal(parseCacheMaxAgeMs(null), 3_600_000);

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const now = 1_700_000_000;
  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  const headerB64 = encode({ alg: 'RS256', kid: 'kid-1', typ: 'JWT' });
  const payloadB64 = encode({
    aud: 'flash-casing-fdrm3',
    iss: 'https://securetoken.google.com/flash-casing-fdrm3',
    sub: 'user-uid-123',
    email: 'maker@example.com',
    email_verified: true,
    iat: now - 60,
    auth_time: now - 60,
    exp: now + 3600,
  });
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(signingInput, 'utf8'), privateKey);
  const jwt = `${signingInput}.${sig.toString('base64url')}`;

  const parsed = parseJwtParts(jwt);
  assert.equal(parsed.header.kid, 'kid-1');
  assert.equal(verifyRs256Signature(parsed.signingInput, parsed.signature, publicKey), true);
  assert.equal(verifyRs256Signature(`${headerB64}.tampered`, parsed.signature, publicKey), false);

  const verified = validateFirebaseTokenClaims(parsed.payload, 'flash-casing-fdrm3', now);
  assert.deepEqual(verified, {
    uid: 'user-uid-123',
    email: 'maker@example.com',
    emailVerified: true,
  });

  assert.throws(
    () => validateFirebaseTokenClaims({ ...parsed.payload, exp: now - 120 }, 'flash-casing-fdrm3', now),
    /expired/i
  );
  assert.throws(
    () => validateFirebaseTokenClaims({ ...parsed.payload, aud: 'other-project' }, 'flash-casing-fdrm3', now),
    /audience/i
  );
  assert.throws(
    () => validateFirebaseTokenClaims({ ...parsed.payload, iss: 'https://evil.example' }, 'flash-casing-fdrm3', now),
    /issuer/i
  );
  assert.throws(
    () => validateFirebaseTokenClaims({ ...parsed.payload, sub: '' }, 'flash-casing-fdrm3', now),
    /subject/i
  );
});



