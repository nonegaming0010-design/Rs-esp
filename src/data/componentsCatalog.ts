import type { EspBoard, WiringItem } from '../types/esp';
import { resolveEspPinTarget } from '../utils/circuit3dModel';

export type CatalogCategory = 'Sensors' | 'Displays' | 'Actuators' | 'Inputs';

export interface ComponentCatalogItem {
  id: string;
  name: string;
  shortName: string;
  category: CatalogCategory;
  protocol: string;
  voltage: '3.3V' | '5V' | '3.3V / 5V';
  summary: string;
  libraries: string[];
  /** Declarative pin blueprint resolved dynamically against the active ESP board */
  pins: Array<{
    label: string;
    role: 'vcc3v3' | 'vcc5v' | 'gnd' | 'i2c_sda' | 'i2c_scl' | 'spi_mosi' | 'spi_miso' | 'spi_sck' | 'spi_cs' | 'digital' | 'pwm' | 'adc';
    preferredGpio?: number;
    note: string;
  }>;
  codeHint?: string;
}

export const COMPONENTS_CATALOG: ComponentCatalogItem[] = [
  {
    id: 'dht11',
    name: 'DHT11 Temperature & Humidity Sensor',
    shortName: 'DHT11',
    category: 'Sensors',
    protocol: '1-Wire Digital',
    voltage: '3.3V / 5V',
    summary: 'Entry-level temperature (0–50°C) and humidity (20–80%) module with 10k pull-up resistor.',
    libraries: ['DHT sensor library', 'Adafruit Unified Sensor'],
    pins: [
      { label: 'VCC', role: 'vcc3v3', note: '3.3V power rail' },
      { label: 'DATA', role: 'digital', preferredGpio: 4, note: 'Digital signal (10kΩ pull-up to 3.3V)' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
    ],
    codeHint: '#include <DHT.h>',
  },
  {
    id: 'dht22',
    name: 'DHT22 (AM2302) Precision Temp & Humidity',
    shortName: 'DHT22',
    category: 'Sensors',
    protocol: '1-Wire Digital',
    voltage: '3.3V / 5V',
    summary: 'High-accuracy (-40 to 80°C, 0–100% RH) environmental sensor for weather stations.',
    libraries: ['DHT sensor library', 'Adafruit Unified Sensor'],
    pins: [
      { label: 'VCC', role: 'vcc3v3', note: '3.3V power rail' },
      { label: 'DATA', role: 'digital', preferredGpio: 4, note: 'Digital signal (10kΩ pull-up to 3.3V)' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
    ],
    codeHint: '#include <DHT.h>',
  },
  {
    id: 'hc-sr04',
    name: 'HC-SR04 Ultrasonic Distance Sensor',
    shortName: 'HC-SR04',
    category: 'Sensors',
    protocol: 'Trigger / Echo Pulse',
    voltage: '5V',
    summary: 'Non-contact 2cm–400cm sonar ranging module. Use a 1kΩ/2kΩ voltage divider on ECHO for 3.3V GPIOs.',
    libraries: [],
    pins: [
      { label: 'VCC', role: 'vcc5v', note: '5V / VIN supply required for transducer' },
      { label: 'TRIG', role: 'digital', preferredGpio: 5, note: '10µs trigger output pulse' },
      { label: 'ECHO', role: 'digital', preferredGpio: 18, note: 'Use 1kΩ/2kΩ voltage divider (5V → 3.3V)' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
    ],
  },
  {
    id: 'ssd1306-oled',
    name: 'SSD1306 0.96" I2C OLED Display',
    shortName: 'SSD1306 OLED',
    category: 'Displays',
    protocol: 'I2C (0x3C)',
    voltage: '3.3V',
    summary: 'Crisp 128×64 monochrome OLED screen wired over hardware I2C (SDA/SCL).',
    libraries: ['Adafruit SSD1306', 'Adafruit GFX Library'],
    pins: [
      { label: 'VCC', role: 'vcc3v3', note: '3.3V power rail' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
      { label: 'SDA', role: 'i2c_sda', note: 'Hardware I2C Data' },
      { label: 'SCL', role: 'i2c_scl', note: 'Hardware I2C Clock' },
    ],
    codeHint: '#include <Adafruit_SSD1306.h>',
  },
  {
    id: 'lcd-1602-i2c',
    name: '16x2 Character LCD (PCF8574 I2C)',
    shortName: '16x2 I2C LCD',
    category: 'Displays',
    protocol: 'I2C (0x27)',
    voltage: '5V',
    summary: 'Classic 2-line 16-character backlit LCD module with I2C backpack.',
    libraries: ['LiquidCrystal_I2C'],
    pins: [
      { label: 'VCC', role: 'vcc5v', note: '5V / VIN for crisp backlight' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
      { label: 'SDA', role: 'i2c_sda', note: 'I2C Data line' },
      { label: 'SCL', role: 'i2c_scl', note: 'I2C Clock line' },
    ],
  },
  {
    id: 'bme280',
    name: 'BME280 Pressure, Temp & Humidity',
    shortName: 'BME280',
    category: 'Sensors',
    protocol: 'I2C (0x76)',
    voltage: '3.3V',
    summary: 'Bosch 3-in-1 barometric pressure, altitude, humidity, and temperature breakout.',
    libraries: ['Adafruit BME280 Library', 'Adafruit Unified Sensor'],
    pins: [
      { label: 'VCC', role: 'vcc3v3', note: 'Strictly 3.3V (do not connect 5V)' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
      { label: 'SDA', role: 'i2c_sda', note: 'I2C Data' },
      { label: 'SCL', role: 'i2c_scl', note: 'I2C Clock' },
    ],
  },
  {
    id: 'mpu6050',
    name: 'MPU6050 6-Axis Gyro & Accelerometer',
    shortName: 'MPU6050',
    category: 'Sensors',
    protocol: 'I2C (0x68)',
    voltage: '3.3V',
    summary: '3-axis gyroscope + 3-axis accelerometer motion tracking IMU over I2C.',
    libraries: ['Adafruit MPU6050', 'Adafruit Unified Sensor'],
    pins: [
      { label: 'VCC', role: 'vcc3v3', note: '3.3V power rail' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
      { label: 'SDA', role: 'i2c_sda', note: 'I2C Data' },
      { label: 'SCL', role: 'i2c_scl', note: 'I2C Clock' },
    ],
  },
  {
    id: 'sg90-servo',
    name: 'SG90 Micro Servo Motor (180°)',
    shortName: 'SG90 Servo',
    category: 'Actuators',
    protocol: '50Hz PWM',
    voltage: '5V',
    summary: 'Geared micro servo controlled by 50Hz PWM pulses (500–2400µs).',
    libraries: ['ESP32Servo'],
    pins: [
      { label: '5V', role: 'vcc5v', note: '5V / VIN (use external 5V for high load)' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
      { label: 'SIG', role: 'pwm', preferredGpio: 13, note: 'Orange PWM control wire' },
    ],
  },
  {
    id: 'relay-5v',
    name: '1-Channel Relay Module (Optocoupled)',
    shortName: '5V Relay',
    category: 'Actuators',
    protocol: 'Digital Output',
    voltage: '5V',
    summary: 'Electromechanical relay switch for controlling lamps, fans, or pumps.',
    libraries: [],
    pins: [
      { label: 'VCC', role: 'vcc5v', note: '5V / VIN coil power' },
      { label: 'IN', role: 'digital', preferredGpio: 26, note: 'Digital trigger signal' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
    ],
  },
  {
    id: 'pir-hcsr501',
    name: 'HC-SR501 PIR Motion Sensor',
    shortName: 'PIR Motion',
    category: 'Sensors',
    protocol: 'Digital Input',
    voltage: '5V',
    summary: 'Passive infrared human motion detector outputting a 3.3V HIGH pulse on movement.',
    libraries: [],
    pins: [
      { label: 'VCC', role: 'vcc5v', note: '5V / VIN supply (onboard 3.3V regulator)' },
      { label: 'OUT', role: 'digital', preferredGpio: 27, note: 'HIGH when motion detected' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
    ],
  },
  {
    id: 'ldr-sensor',
    name: 'LDR Ambient Light Sensor Module',
    shortName: 'LDR Light',
    category: 'Sensors',
    protocol: 'Analog (ADC1)',
    voltage: '3.3V',
    summary: 'Photoresistor brightness divider for automatic nightlights and solar tracking.',
    libraries: [],
    pins: [
      { label: 'VCC', role: 'vcc3v3', note: '3.3V reference' },
      { label: 'AOUT', role: 'adc', preferredGpio: 34, note: 'ADC1 analog lux voltage (Wi-Fi safe)' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
    ],
  },
  {
    id: 'mq2-gas',
    name: 'MQ-2 Smoke & Combustible Gas Sensor',
    shortName: 'MQ-2 Gas',
    category: 'Sensors',
    protocol: 'Analog (ADC1)',
    voltage: '5V',
    summary: 'Detects LPG, propane, methane, hydrogen, and smoke. Use voltage divider on AOUT if >3.3V.',
    libraries: [],
    pins: [
      { label: 'VCC', role: 'vcc5v', note: '5V / VIN for internal heater coil' },
      { label: 'AOUT', role: 'adc', preferredGpio: 35, note: 'ADC1 analog gas concentration' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
    ],
  },
  {
    id: 'soil-moisture',
    name: 'Capacitive Soil Moisture Sensor',
    shortName: 'Soil Moisture',
    category: 'Sensors',
    protocol: 'Analog (ADC1)',
    voltage: '3.3V',
    summary: 'Corrosion-resistant capacitive probe for smart plant watering projects.',
    libraries: [],
    pins: [
      { label: 'VCC', role: 'vcc3v3', note: '3.3V power rail' },
      { label: 'AOUT', role: 'adc', preferredGpio: 32, note: 'ADC1 analog moisture signal' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
    ],
  },
  {
    id: 'ws2812b-neopixel',
    name: 'WS2812B NeoPixel RGB Ring / Strip',
    shortName: 'WS2812B Ring',
    category: 'Actuators',
    protocol: 'Single-Wire RGB',
    voltage: '5V',
    summary: 'Individually addressable RGB LEDs daisy-chained on a single data pin.',
    libraries: ['Adafruit NeoPixel'],
    pins: [
      { label: 'VCC', role: 'vcc5v', note: '5V / VIN (limit brightness on USB power)' },
      { label: 'DIN', role: 'digital', preferredGpio: 16, note: 'Data input via 330Ω series resistor' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
    ],
  },
  {
    id: 'tm1637-7seg',
    name: 'TM1637 4-Digit 7-Segment Display',
    shortName: 'TM1637 7-Seg',
    category: 'Displays',
    protocol: '2-Wire CLK/DIO',
    voltage: '3.3V / 5V',
    summary: 'Bright 4-digit red LED numeric display for clocks, counters, and sensor readouts.',
    libraries: ['TM1637Display'],
    pins: [
      { label: 'VCC', role: 'vcc3v3', note: '3.3V power rail' },
      { label: 'CLK', role: 'digital', preferredGpio: 19, note: 'Clock signal' },
      { label: 'DIO', role: 'digital', preferredGpio: 18, note: 'Data I/O signal' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
    ],
  },
  {
    id: 'piezo-buzzer',
    name: 'Active / Passive Piezo Buzzer',
    shortName: 'Piezo Buzzer',
    category: 'Actuators',
    protocol: 'PWM Tone',
    voltage: '3.3V',
    summary: 'Audible alert transducer driven via tone() or ledcWriteTone().',
    libraries: [],
    pins: [
      { label: '+', role: 'pwm', preferredGpio: 15, note: 'PWM tone signal' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
    ],
  },
  {
    id: 'push-button',
    name: 'Tactile Push Button Switch',
    shortName: 'Push Button',
    category: 'Inputs',
    protocol: 'Digital INPUT_PULLUP',
    voltage: '3.3V',
    summary: 'Momentary tactile switch wired between GPIO and GND with internal pull-up enabled.',
    libraries: [],
    pins: [
      { label: '+', role: 'digital', preferredGpio: 14, note: 'Configure INPUT_PULLUP (LOW when pressed)' },
      { label: 'GND', role: 'gnd', note: 'Common ground' },
    ],
  },
  {
    id: 'potentiometer-10k',
    name: '10kΩ Rotary Potentiometer',
    shortName: '10k Potentiometer',
    category: 'Inputs',
    protocol: 'Analog (ADC1)',
    voltage: '3.3V',
    summary: '3-pin analog voltage divider knob for dimming LEDs, steering servos, or menu control.',
    libraries: [],
    pins: [
      { label: 'VCC', role: 'vcc3v3', note: '3.3V outer leg' },
      { label: 'AOUT', role: 'adc', preferredGpio: 33, note: 'Center wiper to ADC1 input' },
      { label: 'GND', role: 'gnd', note: 'Ground outer leg' },
    ],
  },
];

function collectUsedGpios(board: EspBoard, existingWiring: WiringItem[]): Set<number> {
  const used = new Set<number>();
  for (const row of existingWiring) {
    const target = resolveEspPinTarget(row.to, board);
    if (target.gpio !== null) {
      used.add(target.gpio);
    }
  }
  return used;
}

function pickGpioForRole(
  board: EspBoard,
  role: ComponentCatalogItem['pins'][number]['role'],
  preferredGpio: number | undefined,
  usedGpios: Set<number>
): number {
  const isAvailable = (gpio: number): boolean => {
    const spec = board.pins.find((p) => p.gpio === gpio);
    if (!spec || spec.isInternalFlash) return false;
    if (role === 'adc') {
      return spec.capabilities.includes('ADC1') || spec.capabilities.includes('GPIO');
    }
    if (role === 'pwm' || role === 'digital') {
      return !spec.isInputOnly;
    }
    return true;
  };

  if (preferredGpio !== undefined && !usedGpios.has(preferredGpio) && isAvailable(preferredGpio)) {
    usedGpios.add(preferredGpio);
    return preferredGpio;
  }

  // Prefer non-strapping, non-flash, non-default-LED pins matching capability
  const candidates = board.pins.filter((p) => {
    if (p.isInternalFlash || usedGpios.has(p.gpio)) return false;
    if (p.gpio === board.defaultI2c.sda || p.gpio === board.defaultI2c.scl) return false;
    if (role === 'adc') return p.capabilities.includes('ADC1');
    if (role === 'pwm' || role === 'digital') return !p.isInputOnly && !p.isStrapping;
    return !p.isStrapping;
  });

  if (candidates.length > 0) {
    const chosen = candidates[0].gpio;
    usedGpios.add(chosen);
    return chosen;
  }

  // Fallback allowing strapping pins if board is pin-constrained (e.g., ESP8266-01)
  const fallback = board.pins.find(
    (p) => !p.isInternalFlash && !usedGpios.has(p.gpio) && (role !== 'digital' || !p.isInputOnly)
  );
  if (fallback) {
    usedGpios.add(fallback.gpio);
    return fallback.gpio;
  }

  return preferredGpio ?? board.defaultLedPin;
}

export function buildComponentWiringForBoard(
  component: ComponentCatalogItem,
  board: EspBoard,
  existingWiring: WiringItem[]
): WiringItem[] {
  const usedGpios = collectUsedGpios(board, existingWiring);

  return component.pins.map((pin) => {
    let toLabel = 'GND';
    if (pin.role === 'vcc3v3') {
      toLabel = '3.3V';
    } else if (pin.role === 'vcc5v') {
      toLabel = '5V / VIN';
    } else if (pin.role === 'gnd') {
      toLabel = 'GND';
    } else if (pin.role === 'i2c_sda') {
      toLabel = `GPIO ${board.defaultI2c.sda} (SDA)`;
    } else if (pin.role === 'i2c_scl') {
      toLabel = `GPIO ${board.defaultI2c.scl} (SCL)`;
    } else if (pin.role === 'spi_mosi') {
      toLabel = `GPIO ${board.defaultSpi.mosi} (MOSI)`;
    } else if (pin.role === 'spi_miso') {
      toLabel = `GPIO ${board.defaultSpi.miso} (MISO)`;
    } else if (pin.role === 'spi_sck') {
      toLabel = `GPIO ${board.defaultSpi.sck} (SCK)`;
    } else if (pin.role === 'spi_cs') {
      toLabel = `GPIO ${board.defaultSpi.cs} (CS)`;
    } else {
      const gpio = pickGpioForRole(board, pin.role, pin.preferredGpio, usedGpios);
      const spec = board.pins.find((p) => p.gpio === gpio);
      toLabel = spec && /^D\d$/.test(spec.label) ? `${spec.label} (GPIO ${gpio})` : `GPIO ${gpio}`;
    }

    return {
      from: `${component.shortName} ${pin.label}`,
      to: toLabel,
      note: pin.note,
    };
  });
}

export function mergeComponentIntoProject(
  component: ComponentCatalogItem,
  board: EspBoard,
  existingWiring: WiringItem[],
  existingLibraries: string[]
): {
  nextWiring: WiringItem[];
  nextLibraries: string[];
  addedWiringCount: number;
  addedLibCount: number;
  addedRows: WiringItem[];
} {
  const candidateRows = buildComponentWiringForBoard(component, board, existingWiring);
  const existingFroms = new Set(existingWiring.map((w) => w.from.trim().toLowerCase()));

  const addedRows: WiringItem[] = [];
  for (const row of candidateRows) {
    const key = row.from.trim().toLowerCase();
    if (!existingFroms.has(key)) {
      existingFroms.add(key);
      addedRows.push(row);
    }
  }

  const nextWiring = [...existingWiring, ...addedRows];

  const existingLibLower = new Set(existingLibraries.map((l) => l.trim().toLowerCase()));
  const addedLibs: string[] = [];
  for (const lib of component.libraries) {
    if (!existingLibLower.has(lib.trim().toLowerCase())) {
      existingLibLower.add(lib.trim().toLowerCase());
      addedLibs.push(lib);
    }
  }
  const nextLibraries = [...existingLibraries, ...addedLibs];

  return {
    nextWiring,
    nextLibraries,
    addedWiringCount: addedRows.length,
    addedLibCount: addedLibs.length,
    addedRows,
  };
}
