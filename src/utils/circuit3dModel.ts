import type { EspBoard, FrameworkId, WiringItem } from '../types/esp';

export type ComponentKind =
  | 'led'
  | 'rgb_led'
  | 'traffic_light'
  | 'lamp_bulb'
  | 'rgb_neopixel'
  | 'dht22'
  | 'bme280'
  | 'light_sensor'
  | 'soil_moisture'
  | 'gas_sensor'
  | 'imu_mpu6050'
  | 'sound_mic'
  | 'ir_receiver'
  | 'oled_ssd1306'
  | 'lcd_1602'
  | 'seven_seg'
  | 'ultrasonic'
  | 'servo'
  | 'stepper'
  | 'relay'
  | 'button'
  | 'potentiometer'
  | 'buzzer'
  | 'pir'
  | 'generic_module';

export type WireSignalKind = 'power' | 'ground' | 'i2c' | 'spi' | 'pwm' | 'analog' | 'digital';

export interface ComponentTerminalSpec {
  id: string;
  label: string;
  espPinLabel: string;
  gpio: number | null;
  signalKind: WireSignalKind;
  colorHex: string;
}

export interface CircuitComponentNode {
  id: string;
  kind: ComponentKind;
  name: string;
  subtitle: string;
  terminals: ComponentTerminalSpec[];
  codeHint: string;
  ledColorHex?: string;
  /** Local placement on the workbench mat (x, z) in scene units */
  position: { x: number; z: number };
}

export interface CircuitWireSpec {
  id: string;
  componentId: string;
  componentName: string;
  componentTerminalId: string;
  componentTerminalLabel: string;
  espPinLabel: string;
  espGpio: number | null;
  espRail: '3v3' | '5v' | 'gnd' | null;
  signalKind: WireSignalKind;
  colorHex: string;
  note: string;
}

export interface CodeSimProfile {
  blinkPeriodMs: number;
  dutyHighRatio: number;
  activeGpios: number[];
  usesOnboardLed: boolean;
  usesOnboardRgb: boolean;
  hasServo: boolean;
  servoAngleMin: number;
  servoAngleMax: number;
  hasOled: boolean;
  hasLcd: boolean;
  hasSevenSeg: boolean;
  oledLines: string[];
  hasDht: boolean;
  hasBme: boolean;
  hasLightSensor: boolean;
  hasSoilSensor: boolean;
  hasGasSensor: boolean;
  hasImu: boolean;
  hasSoundMic: boolean;
  hasIrReceiver: boolean;
  hasUltrasonic: boolean;
  hasRelay: boolean;
  hasLamp: boolean;
  hasStepper: boolean;
  hasBuzzer: boolean;
  hasWifi: boolean;
  hasButton: boolean;
  hasPotentiometer: boolean;
  hasPir: boolean;
  hasNeoPixel: boolean;
  hasRgbLed: boolean;
  hasTrafficLight: boolean;
  summaryAction: string;
}

export interface Circuit3dAnalysis {
  components: CircuitComponentNode[];
  wires: CircuitWireSpec[];
  simulation: CodeSimProfile;
}

const WIRE_COLORS = {
  power3v3: '#dc2626',
  power5v: '#b91c1c',
  ground: '#1c1917',
  i2cSda: '#2563eb',
  i2cScl: '#eab308',
  spiMosi: '#7c3aed',
  spiMiso: '#0891b2',
  spiSck: '#0d9488',
  spiCs: '#db2777',
  signalDefault: ['#059669', '#ea580c', '#0284c7', '#9333ea', '#16a34a', '#d97706'],
};

const NODE_MCU_D_TO_GPIO: Record<string, number> = {
  D0: 16,
  D1: 5,
  D2: 4,
  D3: 0,
  D4: 2,
  D5: 14,
  D6: 12,
  D7: 13,
  D8: 15,
};

export function resolveEspPinTarget(
  rawPin: string,
  board: EspBoard
): { gpio: number | null; rail: '3v3' | '5v' | 'gnd' | null; label: string } {
  const clean = rawPin.trim();
  const upper = clean.toUpperCase();

  // Match explicit GPIO number first (e.g. "GPIO 18 (use voltage divider if 5V)" must map to GPIO 18, not 5V)
  const startsWithPowerOrGnd = /^(?:GND|GROUND|0V|5V|VIN|VBUS|3\.3V|3V3|VCC)\b/.test(upper);
  if (!startsWithPowerOrGnd) {
    const gpioMatch =
      upper.match(/\b(?:GPIO|IO)\s*[_#:]?\s*(\d{1,2})\b/) ||
      upper.match(/^(\d{1,2})$/);
    if (gpioMatch) {
      const num = Number(gpioMatch[1]);
      return { gpio: num, rail: null, label: `GPIO ${num}` };
    }

    const dMatch = upper.match(/\b(D[0-8])\b/);
    if (dMatch && NODE_MCU_D_TO_GPIO[dMatch[1]] !== undefined) {
      const num = NODE_MCU_D_TO_GPIO[dMatch[1]];
      return { gpio: num, rail: null, label: `${dMatch[1]} (GPIO ${num})` };
    }
  }

  if (/\b(GND|GROUND|0V)\b/.test(upper)) {
    return { gpio: null, rail: 'gnd', label: 'GND' };
  }
  if (/\b(5V|VIN|VBUS|VCC\s*5V)\b/.test(upper)) {
    return { gpio: null, rail: '5v', label: '5V / VIN' };
  }
  if (/\b(3\.3V|3V3|VCC)\b/.test(upper)) {
    return { gpio: null, rail: '3v3', label: '3.3V' };
  }

  if (/\bA0\b/.test(upper) || /\bADC0\b/.test(upper)) {
    return { gpio: 17, rail: null, label: 'A0' };
  }
  if (/\bSDA\b/.test(upper)) {
    return { gpio: board.defaultI2c.sda, rail: null, label: `GPIO ${board.defaultI2c.sda} (SDA)` };
  }
  if (/\bSCL\b/.test(upper)) {
    return { gpio: board.defaultI2c.scl, rail: null, label: `GPIO ${board.defaultI2c.scl} (SCL)` };
  }
  if (/\bMOSI\b/.test(upper)) {
    return { gpio: board.defaultSpi.mosi, rail: null, label: `GPIO ${board.defaultSpi.mosi} (MOSI)` };
  }
  if (/\bMISO\b/.test(upper)) {
    return { gpio: board.defaultSpi.miso, rail: null, label: `GPIO ${board.defaultSpi.miso} (MISO)` };
  }
  if (/\bSCK\b/.test(upper)) {
    return { gpio: board.defaultSpi.sck, rail: null, label: `GPIO ${board.defaultSpi.sck} (SCK)` };
  }

  return { gpio: null, rail: null, label: clean || `GPIO ${board.defaultLedPin}` };
}

export function classifyComponentKind(text: string): ComponentKind {
  const lower = text.toLowerCase();
  if (/neopixel|ws2812|fastled|rgb\s*(ring|strip)/.test(lower)) return 'rgb_neopixel';
  if (/rgb\s*(led|pin|module)|common\s*cathode/.test(lower)) return 'rgb_led';
  if (/traffic\s*light/.test(lower)) return 'traffic_light';
  if (/\b(bulb|lamp|nightlight|floodlight|lantern)\b/.test(lower)) return 'lamp_bulb';
  if (/oled|ssd1306|sh1106/.test(lower)) return 'oled_ssd1306';
  if (/lcd|1602|liquidcrystal/.test(lower)) return 'lcd_1602';
  if (/tm1637|7-?seg|seven\s*seg/.test(lower)) return 'seven_seg';
  if (/dht\s*11|dht\s*22|\bdht\b/.test(lower)) return 'dht22';
  if (/bme280|bmp280|baromet|pressure/.test(lower)) return 'bme280';
  if (/ldr|photoresistor|bh1750|lux|light\s*sensor/.test(lower)) return 'light_sensor';
  if (/soil|moisture/.test(lower)) return 'soil_moisture';
  if (/mq-?\d+|gas|smoke|air\s*quality/.test(lower)) return 'gas_sensor';
  if (/mpu6050|gyro|accel|imu/.test(lower)) return 'imu_mpu6050';
  if (/servo|sg90|mg90/.test(lower)) return 'servo';
  if (/stepper|28byj|uln2003|a4988/.test(lower)) return 'stepper';
  if (/\bmic\b|microphone|sound|clap/.test(lower)) return 'sound_mic';
  if (/ir\s*recv|ir\s*receiver|vs1838|irremote/.test(lower)) return 'ir_receiver';
  if (/hc-?sr04|ultrasonic|distance/.test(lower)) return 'ultrasonic';
  if (/relay/.test(lower)) return 'relay';
  if (/pir|motion|hc-?sr501|radar/.test(lower)) return 'pir';
  if (/buzzer|piezo|speaker|tone|alarm/.test(lower)) return 'buzzer';
  if (/potentiometer|\bpot\b|trimmer|rotary\s*knob|analog\s*dial/.test(lower)) return 'potentiometer';
  if (/button|pushbutton|switch|tactile|float/.test(lower)) return 'button';
  if (/\bleds?\b|flash\s*led|indicator/.test(lower)) return 'led';
  return 'generic_module';
}

function inferLedColorHex(text: string): string {
  const lower = text.toLowerCase();
  if (/yellow|amber/.test(lower)) return '#eab308';
  if (/green/.test(lower)) return '#22c55e';
  if (/blue/.test(lower)) return '#3b82f6';
  if (/white|flash/.test(lower)) return '#f8fafc';
  return '#ef4444';
}

function classifyWireSignal(
  terminalLabel: string,
  espLabel: string
): { signalKind: WireSignalKind; colorHex: string } {
  const combined = `${terminalLabel} ${espLabel}`.toLowerCase();
  if (/\b(gnd|ground|cathode)\b/.test(combined)) {
    return { signalKind: 'ground', colorHex: WIRE_COLORS.ground };
  }
  if (/\b(5v|vin|vbus)\b/.test(combined)) {
    return { signalKind: 'power', colorHex: WIRE_COLORS.power5v };
  }
  if (/\b(3\.3v|3v3|vcc|3v)\b/.test(combined)) {
    return { signalKind: 'power', colorHex: WIRE_COLORS.power3v3 };
  }
  if (/\bsda\b/.test(combined)) {
    return { signalKind: 'i2c', colorHex: WIRE_COLORS.i2cSda };
  }
  if (/\bscl\b/.test(combined)) {
    return { signalKind: 'i2c', colorHex: WIRE_COLORS.i2cScl };
  }
  if (/\bmosi\b/.test(combined)) {
    return { signalKind: 'spi', colorHex: WIRE_COLORS.spiMosi };
  }
  if (/\bmiso\b/.test(combined)) {
    return { signalKind: 'spi', colorHex: WIRE_COLORS.spiMiso };
  }
  if (/\bsck\b|\bclk\b/.test(combined)) {
    return { signalKind: 'spi', colorHex: WIRE_COLORS.spiSck };
  }
  if (/\bcs\b|\bss\b|\bdio\b/.test(combined)) {
    return { signalKind: 'spi', colorHex: WIRE_COLORS.spiCs };
  }
  if (/\bpwm\b|\bsig\b|\bservo\b|\bsignal\b/.test(combined)) {
    return { signalKind: 'pwm', colorHex: '#ea580c' };
  }
  if (/\badc\b|\ba0\b|\baout\b|\banalog\b|\bwiper\b/.test(combined)) {
    return { signalKind: 'analog', colorHex: '#9333ea' };
  }
  if (/red/.test(combined)) return { signalKind: 'digital', colorHex: '#ef4444' };
  if (/yellow/.test(combined)) return { signalKind: 'digital', colorHex: '#eab308' };
  if (/green/.test(combined)) return { signalKind: 'digital', colorHex: '#22c55e' };
  if (/blue/.test(combined)) return { signalKind: 'digital', colorHex: '#3b82f6' };
  return { signalKind: 'digital', colorHex: '#059669' };
}

function extractNumericConstants(code: string): Map<string, number> {
  const constants = new Map<string, number>();
  const cDefine = /^\s*#define\s+([A-Za-z_][A-Za-z0-9_]*)\s+(\d{1,2})\b/gm;
  let m: RegExpExecArray | null;
  while ((m = cDefine.exec(code)) !== null) {
    constants.set(m[1], Number(m[2]));
  }
  const cConst = /\b(?:const\s+)?(?:int|uint8_t|byte)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\d{1,2})\s*;/g;
  while ((m = cConst.exec(code)) !== null) {
    constants.set(m[1], Number(m[2]));
  }
  const pyAssign = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:Pin\s*\(\s*)?(\d{1,2})\b/gm;
  while ((m = pyAssign.exec(code)) !== null) {
    constants.set(m[1], Number(m[2]));
  }
  return constants;
}

export function extractCodeBehavior(
  code: string,
  board: EspBoard,
  _framework: FrameworkId
): CodeSimProfile {
  const constants = extractNumericConstants(code);
  const gpioSet = new Set<number>();

  const pinCalls = [
    /\b(?:pinMode|digitalWrite|digitalRead|analogRead|analogWrite|touchRead|ledcAttach|dacWrite)\s*\(\s*([A-Za-z0-9_]+)/g,
    /\.attach\s*\(\s*([A-Za-z0-9_]+)/g,
    /\bPin\s*\(\s*([A-Za-z0-9_]+)/g,
    /\bGPIO_NUM_(\d{1,2})\b/g,
    /\b(?:DHT|Adafruit_NeoPixel|Servo|TM1637Display)\b[^;\n]*\b(\d{1,2})\b/g,
  ];
  for (const re of pinCalls) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      const token = m[1];
      if (/^\d{1,2}$/.test(token)) {
        gpioSet.add(Number(token));
      } else if (constants.has(token)) {
        gpioSet.add(constants.get(token)!);
      }
    }
  }

  for (const val of constants.values()) {
    if (val >= 0 && val <= 48) {
      gpioSet.add(val);
    }
  }

  // Extract delay / sleep cadence
  const delaysMs: number[] = [];
  let dm: RegExpExecArray | null;
  const delayRe = /\bdelay\s*\(\s*(\d+)\s*\)/g;
  while ((dm = delayRe.exec(code)) !== null) {
    delaysMs.push(Number(dm[1]));
  }
  const sleepRe = /\btime\.sleep\s*\(\s*(\d+(?:\.\d+)?)\s*\)/g;
  while ((dm = sleepRe.exec(code)) !== null) {
    delaysMs.push(Math.round(Number(dm[1]) * 1000));
  }
  const vTaskRe = /\bpdMS_TO_TICKS\s*\(\s*(\d+)\s*\)/g;
  while ((dm = vTaskRe.exec(code)) !== null) {
    delaysMs.push(Number(dm[1]));
  }

  const totalDelay = delaysMs.slice(0, 4).reduce((acc, v) => acc + v, 0);
  const blinkPeriodMs = Math.min(4000, Math.max(300, totalDelay || 1400));

  // Extract OLED/LCD string literals
  const oledLines: string[] = [];
  const printRe = /\b(?:display|oled|lcd)\.(?:println|print|text|drawString)\s*\(\s*["']([^"']{1,24})["']/g;
  let pm: RegExpExecArray | null;
  while ((pm = printRe.exec(code)) !== null) {
    if (oledLines.length < 4) oledLines.push(pm[1]);
  }
  if (oledLines.length === 0 && /SSD1306|SH1106|OLED|LiquidCrystal|LCD/i.test(code)) {
    oledLines.push('Rs-ESP Live', `${board.shortName} OK`);
  }

  const activeGpios = Array.from(gpioSet).filter((g) => g >= 0 && g <= 48);
  const usesOnboardLed =
    activeGpios.includes(board.defaultLedPin) ||
    /\bLED_BUILTIN\b/i.test(code) ||
    (activeGpios.length === 0 && /\b(digitalWrite|gpio_set_level|led\.value)\b/.test(code));

  const hasNeoPixel = /Adafruit_NeoPixel|FastLED|neopixel/i.test(code);
  const usesOnboardRgb =
    hasNeoPixel && (board.id === 'esp32-s3' || board.id === 'esp32-c6' || board.id === 'esp32-h2');

  const hasServo = /Servo|ESP32Servo|\.duty\s*\(/i.test(code);
  const hasOled = /SSD1306|SH1106|\bOLED\b/i.test(code);
  const hasLcd = /LiquidCrystal|LCD_I2C|1602/i.test(code);
  const hasSevenSeg = /TM1637|7-?seg/i.test(code);
  const hasDht = /\bDHT\b|dht\.read|DHT22|DHT11/i.test(code);
  const hasBme = /BME280|BMP280/i.test(code);
  const hasLightSensor = /\bLDR\b|photoresistor|BH1750|lux|nightlight/i.test(code);
  const hasSoilSensor = /soil|moisture/i.test(code);
  const hasGasSensor = /MQ-?2|MQ-?135|gasPin|smoke/i.test(code);
  const hasImu = /MPU6050|getEvent/i.test(code);
  const hasSoundMic = /micPin|soundPin|clap/i.test(code);
  const hasIrReceiver = /IRrecv|IrReceiver|IRremote/i.test(code);
  const hasUltrasonic = /HC-?SR04|pulseIn|trigPin|echoPin/i.test(code);
  const hasRelay = /\brelay\b/i.test(code);
  const hasLamp = /\b(lamp|bulb|nightlight|lightPin)\b/i.test(code);
  const hasStepper = /Stepper|28BYJ|stepPin/i.test(code);
  const hasBuzzer = /\btone\s*\(|buzzer|piezo|ledcWriteTone/i.test(code);
  const hasWifi = /\b(WiFi\.begin|ESP8266WiFi|network\.WLAN)\b/.test(code);
  const hasButton = /\b(INPUT_PULLUP|buttonPin|btnPin|digitalRead)\b/i.test(code);
  const hasPotentiometer = /\b(analogRead|ADC\s*\(|potPin)\b/i.test(code) && !hasLightSensor && !hasSoilSensor && !hasGasSensor;
  const hasPir = /\bPIR\b|motionPin/i.test(code);
  const hasRgbLed = /\bredPin\b.*\bgreenPin\b|\bRED_PIN\b.*\bGREEN_PIN\b/is.test(code);
  const hasTrafficLight = /traffic|RED_LED.*YELLOW_LED/is.test(code);

  const actions: string[] = [];
  if (hasWifi) actions.push('Wi-Fi active');
  if (hasDht) actions.push('Reading DHT22');
  if (hasBme) actions.push('Reading BME280');
  if (hasLightSensor) actions.push('Sensing Ambient Light');
  if (hasSoilSensor) actions.push('Reading Soil Moisture');
  if (hasGasSensor) actions.push('Monitoring Gas PPM');
  if (hasOled) actions.push('Updating I2C OLED');
  if (hasLcd) actions.push('Updating 16x2 LCD');
  if (hasSevenSeg) actions.push('Driving 7-Segment');
  if (hasServo) actions.push('Sweeping Servo PWM');
  if (hasStepper) actions.push('Stepping Motor');
  if (hasUltrasonic) actions.push('Measuring Ultrasonic');
  if (hasRelay) actions.push('Switching Relay');
  if (hasLamp) actions.push('Driving Light Load');
  if (hasNeoPixel || hasRgbLed) actions.push('Animating RGB Light');
  if (hasTrafficLight) actions.push('Traffic Light Sequence');
  if (actions.length === 0) {
    actions.push(
      usesOnboardLed
        ? `Toggling GPIO ${board.defaultLedPin} every ${Math.round(blinkPeriodMs / 2)} ms`
        : `Running ${board.shortName} sketch loop`
    );
  }

  return {
    blinkPeriodMs,
    dutyHighRatio: 0.5,
    activeGpios,
    usesOnboardLed,
    usesOnboardRgb,
    hasServo,
    servoAngleMin: 15,
    servoAngleMax: 165,
    hasOled,
    hasLcd,
    hasSevenSeg,
    oledLines,
    hasDht,
    hasBme,
    hasLightSensor,
    hasSoilSensor,
    hasGasSensor,
    hasImu,
    hasSoundMic,
    hasIrReceiver,
    hasUltrasonic,
    hasRelay,
    hasLamp,
    hasStepper,
    hasBuzzer,
    hasWifi,
    hasButton,
    hasPotentiometer,
    hasPir,
    hasNeoPixel,
    hasRgbLed,
    hasTrafficLight,
    summaryAction: actions.join(' · '),
  };
}

function defaultTerminalsForKind(
  kind: ComponentKind,
  board: EspBoard,
  signalGpio: number,
  secondaryGpio?: number
): Array<{ label: string; espPin: string; gpio: number | null }> {
  const second = secondaryGpio ?? (signalGpio === 18 ? 19 : 18);
  switch (kind) {
    case 'oled_ssd1306':
    case 'bme280':
    case 'lcd_1602':
    case 'imu_mpu6050':
      return [
        { label: 'VCC', espPin: kind === 'lcd_1602' ? '5V / VIN' : '3.3V', gpio: null },
        { label: 'GND', espPin: 'GND', gpio: null },
        { label: 'SDA', espPin: `GPIO ${board.defaultI2c.sda}`, gpio: board.defaultI2c.sda },
        { label: 'SCL', espPin: `GPIO ${board.defaultI2c.scl}`, gpio: board.defaultI2c.scl },
      ];
    case 'seven_seg':
      return [
        { label: 'VCC', espPin: '3.3V', gpio: null },
        { label: 'CLK', espPin: `GPIO ${signalGpio}`, gpio: signalGpio },
        { label: 'DIO', espPin: `GPIO ${second}`, gpio: second },
        { label: 'GND', espPin: 'GND', gpio: null },
      ];
    case 'ultrasonic':
      return [
        { label: 'VCC', espPin: '5V / VIN', gpio: null },
        { label: 'TRIG', espPin: `GPIO ${signalGpio}`, gpio: signalGpio },
        { label: 'ECHO', espPin: `GPIO ${second}`, gpio: second },
        { label: 'GND', espPin: 'GND', gpio: null },
      ];
    case 'servo':
      return [
        { label: '5V', espPin: '5V / VIN', gpio: null },
        { label: 'GND', espPin: 'GND', gpio: null },
        { label: 'SIG', espPin: `GPIO ${signalGpio}`, gpio: signalGpio },
      ];
    case 'stepper':
      return [
        { label: 'IN1', espPin: 'GPIO 19', gpio: 19 },
        { label: 'IN2', espPin: 'GPIO 18', gpio: 18 },
        { label: 'IN3', espPin: 'GPIO 5', gpio: 5 },
        { label: 'IN4', espPin: 'GPIO 17', gpio: 17 },
        { label: 'GND', espPin: 'GND', gpio: null },
      ];
    case 'rgb_led':
      return [
        { label: 'R', espPin: 'GPIO 25', gpio: 25 },
        { label: 'G', espPin: 'GPIO 26', gpio: 26 },
        { label: 'B', espPin: 'GPIO 27', gpio: 27 },
        { label: 'GND', espPin: 'GND', gpio: null },
      ];
    case 'traffic_light':
      return [
        { label: 'RED', espPin: 'GPIO 25', gpio: 25 },
        { label: 'YEL', espPin: 'GPIO 26', gpio: 26 },
        { label: 'GRN', espPin: 'GPIO 27', gpio: 27 },
        { label: 'GND', espPin: 'GND', gpio: null },
      ];
    case 'dht22':
    case 'relay':
    case 'lamp_bulb':
    case 'pir':
    case 'rgb_neopixel':
    case 'gas_sensor':
    case 'sound_mic':
    case 'ir_receiver':
      return [
        { label: 'VCC', espPin: kind === 'relay' || kind === 'pir' || kind === 'lamp_bulb' ? '5V / VIN' : '3.3V', gpio: null },
        { label: 'DATA', espPin: `GPIO ${signalGpio}`, gpio: signalGpio },
        { label: 'GND', espPin: 'GND', gpio: null },
      ];
    case 'potentiometer':
    case 'light_sensor':
    case 'soil_moisture':
      return [
        { label: 'VCC', espPin: '3.3V', gpio: null },
        { label: 'AOUT', espPin: `GPIO ${signalGpio}`, gpio: signalGpio },
        { label: 'GND', espPin: 'GND', gpio: null },
      ];
    case 'button':
    case 'led':
    case 'buzzer':
      return [
        { label: '+', espPin: `GPIO ${signalGpio}`, gpio: signalGpio },
        { label: 'GND', espPin: 'GND', gpio: null },
      ];
    default:
      return [
        { label: 'VCC', espPin: '3.3V', gpio: null },
        { label: 'SIG', espPin: `GPIO ${signalGpio}`, gpio: signalGpio },
        { label: 'GND', espPin: 'GND', gpio: null },
      ];
  }
}

const BARE_TERMINAL_RE =
  /^(?:vcc|gnd|ground|3\.3v|3v3|5v|vin|vbus|sda|scl|data|out|dout|do|aout|ao|sig|signal|pwm|trig|echo|in|in\d|din|mosi|miso|sck|clk|dio|cs|dc|rst|step|dir|ena|tx|rx|a0|anode|cathode|\+|-|wiper|gate|source|pin\s*\d)(?:\s*\([^)]*\))?$/i;

function isBareTerminalName(raw: string): boolean {
  const clean = raw.trim();
  if (BARE_TERMINAL_RE.test(clean)) return true;
  if (/^(?:sda\/scl|vin\/gnd|vcc\/gnd|trig\/echo|5v\/gnd|dc\/rst|in1\/in2|in1\.\.in4)$/i.test(clean)) return true;
  return false;
}

function isNonHardwareRow(from: string, to: string, board: EspBoard, sim: CodeSimProfile): boolean {
  const f = from.trim();
  const t = to.trim();
  if (/^(?:onboard\s*antenna|usb|wi-?fi(?:\s*radio|\s*ota)?|ble\s*radio|mdns|dns\s*server|https\s*client|rtc\s*memory|internal\s*pll|internal\s*hall)/i.test(f)) {
    return true;
  }
  if (/\b(?:pool\.ntp\.org|port\s+\d+|access\s+point|static\s+ip|built-?in\s+wi-?fi|built-?in\s*2\.4ghz|built\s+inside|host\s+computer|api\.|preserved\s+across)\b/i.test(t)) {
    return true;
  }
  const target = resolveEspPinTarget(t, board);
  if (
    /onboard\s*led|built-?in\s*led/i.test(f) &&
    (target.gpio === null || target.gpio === board.defaultLedPin)
  ) {
    return true;
  }
  if (/onboard\s*rgb/i.test(f) && sim.usesOnboardRgb) {
    return true;
  }
  return false;
}

function detectPrimaryComponentFromCode(
  sim: CodeSimProfile
): { name: string; kind: ComponentKind } | null {
  if (sim.hasOled) return { name: 'SSD1306 OLED 0.96"', kind: 'oled_ssd1306' };
  if (sim.hasLcd) return { name: '16x2 I2C LCD', kind: 'lcd_1602' };
  if (sim.hasSevenSeg) return { name: 'TM1637 7-Segment Display', kind: 'seven_seg' };
  if (sim.hasBme) return { name: 'BME280 Sensor', kind: 'bme280' };
  if (sim.hasImu) return { name: 'MPU6050 Gyro/Accel', kind: 'imu_mpu6050' };
  if (sim.hasUltrasonic) return { name: 'HC-SR04 Ultrasonic', kind: 'ultrasonic' };
  if (sim.hasServo) return { name: 'SG90 Micro Servo', kind: 'servo' };
  if (sim.hasStepper) return { name: '28BYJ-48 Stepper Motor', kind: 'stepper' };
  if (sim.hasDht) return { name: 'DHT22 Temp & Humidity', kind: 'dht22' };
  if (sim.hasLightSensor) return { name: 'LDR Light Sensor', kind: 'light_sensor' };
  if (sim.hasSoilSensor) return { name: 'Soil Moisture Sensor', kind: 'soil_moisture' };
  if (sim.hasGasSensor) return { name: 'MQ-2 Gas Sensor', kind: 'gas_sensor' };
  if (sim.hasSoundMic) return { name: 'Sound Mic Sensor', kind: 'sound_mic' };
  if (sim.hasIrReceiver) return { name: 'IR Receiver (38kHz)', kind: 'ir_receiver' };
  if (sim.hasRelay) return { name: '5V Relay Module', kind: 'relay' };
  if (sim.hasLamp) return { name: 'Smart Lamp Bulb', kind: 'lamp_bulb' };
  if (sim.hasNeoPixel && !sim.usesOnboardRgb) return { name: 'WS2812B NeoPixel Ring', kind: 'rgb_neopixel' };
  if (sim.hasRgbLed) return { name: 'RGB LED (Common Cathode)', kind: 'rgb_led' };
  if (sim.hasTrafficLight) return { name: 'Traffic Light Module', kind: 'traffic_light' };
  if (sim.hasBuzzer) return { name: 'Piezo Buzzer', kind: 'buzzer' };
  if (sim.hasPir) return { name: 'PIR Motion Sensor', kind: 'pir' };
  if (sim.hasPotentiometer) return { name: '10k Potentiometer', kind: 'potentiometer' };
  if (sim.hasButton) return { name: 'Tactile Push Button', kind: 'button' };
  return null;
}

function expandWiringRow(row: WiringItem): Array<{ from: string; to: string; note: string }> {
  const from = row.from.trim();
  const to = row.to.trim();
  const note = row.note?.trim() || '';

  // Handle "Button" -> "GPIO 14 & GND"
  if (/&/.test(to) && /\bGND\b/i.test(to)) {
    const firstPin = to.split('&')[0].trim();
    return [
      { from: `${from} +`, to: firstPin, note },
      { from: `${from} GND`, to: 'GND', note },
    ];
  }

  // Handle "VIN/GND" or "MPU6050 VIN/GND" -> "3.3V / GND" or "VCC/GND" -> "5V / GND"
  const powerGndMatch = from.match(/^(.*?)\b(VIN|VCC|3\.3V|3V3|5V)\/GND$/i);
  if (powerGndMatch) {
    const prefix = powerGndMatch[1].trim();
    const powerFrom = prefix ? `${prefix} ${powerGndMatch[2]}` : powerGndMatch[2];
    const gndFrom = prefix ? `${prefix} GND` : 'GND';
    const powerTo = to.includes('5') ? '5V / VIN' : '3.3V';
    return [
      { from: powerFrom, to: powerTo, note },
      { from: gndFrom, to: 'GND', note },
    ];
  }

  // Handle comma-separated GPIOs like "LEDs 1..5" -> "GPIO 13, 14, 27, 26, 25" or "IN1..IN4" -> "GPIO 19, 18, 5, 17"
  const multiGpioMatch = to.match(/^(?:GPIO\s*)?(\d{1,2}(?:\s*,\s*\d{1,2})+)$/i);
  if (multiGpioMatch) {
    const gpios = multiGpioMatch[1].split(',').map((s) => s.trim());
    if (/IN1/i.test(from)) {
      return gpios.map((g, idx) => ({ from: `Stepper IN${idx + 1}`, to: `GPIO ${g}`, note }));
    }
    return gpios.slice(0, 5).map((g, idx) => ({ from: `LED ${idx + 1} +`, to: `GPIO ${g}`, note }));
  }

  // Handle "OLED SDA/SCL" -> "GPIO 21 / 22" or "TRIG/ECHO" -> "GPIO 5 / 18"
  const slashFrom = from.match(/^(.*?)\b([A-Za-z0-9]+)\/([A-Za-z0-9]+)$/);
  const slashTo = to.match(/^(?:GPIO\s*)?(\d{1,2})\s*\/\s*(?:GPIO\s*)?(\d{1,2})/i);
  if (slashFrom && slashTo) {
    const prefix = slashFrom[1].trim();
    const p1 = prefix ? `${prefix} ${slashFrom[2]}` : slashFrom[2];
    const p2 = prefix ? `${prefix} ${slashFrom[3]}` : slashFrom[3];
    return [
      { from: p1, to: `GPIO ${slashTo[1]}`, note },
      { from: p2, to: `GPIO ${slashTo[2]}`, note },
    ];
  }

  return [{ from, to, note }];
}

function normalizeComponentBaseName(rawBase: string, kind: ComponentKind): string {
  const clean = rawBase.trim();
  if (/^led$/i.test(clean)) return 'External LED';
  if (/^pot$/i.test(clean)) return '10k Potentiometer';
  if (/^oled$/i.test(clean)) return 'SSD1306 OLED 0.96"';
  if (/^button$/i.test(clean)) return 'Tactile Push Button';
  if (/^servo$/i.test(clean) || kind === 'servo') return /servo/i.test(clean) ? clean : 'SG90 Micro Servo';
  if (kind === 'rgb_led') return 'RGB LED (Common Cathode)';
  if (kind === 'stepper') return '28BYJ-48 Stepper Motor';
  return clean;
}

function computeWorkbenchSlot(index: number, total: number): { x: number; z: number } {
  const cols = total <= 2 ? 1 : 2;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const rows = Math.ceil(total / cols);
  const x = 2.65 + col * 2.45;
  const zSpread = 2.25;
  const z = rows === 1 ? 0 : (row - (rows - 1) / 2) * zSpread;
  return { x, z };
}

export function analyzeCircuitFor3d(
  board: EspBoard,
  code: string,
  wiring: WiringItem[],
  framework: FrameworkId
): Circuit3dAnalysis {
  const simulation = extractCodeBehavior(code, board, framework);

  interface GroupedComponentDraft {
    name: string;
    kind: ComponentKind;
    rows: Array<{ terminalLabel: string; espPin: string; note: string }>;
  }

  const grouped = new Map<string, GroupedComponentDraft>();
  const deferredBareRows: Array<{ terminalLabel: string; espPin: string; note: string }> = [];

  const ensureGroup = (rawName: string, kind: ComponentKind): GroupedComponentDraft => {
    const clean = normalizeComponentBaseName(rawName, kind);
    const key =
      kind === 'led' || kind === 'generic_module'
        ? `${kind}:${clean.toLowerCase()}`
        : `kind:${kind}`;

    if (kind !== 'generic_module' && kind !== 'led') {
      for (const existing of grouped.values()) {
        if (existing.kind === kind) return existing;
      }
    }
    const existing = grouped.get(key);
    if (existing) return existing;
    const created: GroupedComponentDraft = { name: clean, kind, rows: [] };
    grouped.set(key, created);
    return created;
  };

  const pushUniqueRow = (
    group: GroupedComponentDraft,
    terminalLabel: string,
    espPin: string,
    note: string
  ) => {
    const normTerm = terminalLabel.toUpperCase().replace(/\s*\([^)]*\)/g, '').trim();
    const target = resolveEspPinTarget(espPin, board);
    const duplicate = group.rows.some((r) => {
      const rTerm = r.terminalLabel.toUpperCase().replace(/\s*\([^)]*\)/g, '').trim();
      const rTarget = resolveEspPinTarget(r.espPin, board);
      return rTerm === normTerm || (target.rail !== null && rTarget.rail === target.rail);
    });
    if (!duplicate) {
      group.rows.push({ terminalLabel, espPin, note });
    }
  };

  // Detect if wiring specifies Red Pin / Green Pin / Blue Pin (RGB LED) or Red/Yellow/Green LED (Traffic Light)
  const rawNamesLower = wiring.map((w) => w.from.toLowerCase());
  const hasRgbPinsInWiring =
    rawNamesLower.some((n) => /\bred\s*pin\b/.test(n)) &&
    rawNamesLower.some((n) => /\bgreen\s*pin\b/.test(n)) &&
    rawNamesLower.some((n) => /\bblue\s*pin\b/.test(n));
  const hasTrafficInWiring =
    rawNamesLower.some((n) => /\bred\s*led\b/.test(n)) &&
    rawNamesLower.some((n) => /\byellow\s*led\b/.test(n)) &&
    rawNamesLower.some((n) => /\bgreen\s*led\b/.test(n));

  // 1. Parse explicit wiring rows from project or AI output
  for (const rawRow of wiring) {
    for (const row of expandWiringRow(rawRow)) {
      const from = row.from.trim();
      const to = row.to.trim();
      if (!from || !to) continue;
      if (isNonHardwareRow(from, to, board, simulation)) continue;

      // Collapse RGB LED rows ("Red Pin", "Green Pin", "Blue Pin", "Common Cathode") into 1 RGB LED
      if (hasRgbPinsInWiring && /\b(red|green|blue)\s*pin|common\s*cathode\b/i.test(from)) {
        const group = ensureGroup('RGB LED (Common Cathode)', 'rgb_led');
        const label = /red/i.test(from) ? 'R' : /green/i.test(from) ? 'G' : /blue/i.test(from) ? 'B' : 'GND';
        pushUniqueRow(group, label, to, row.note || `${from} → ${resolveEspPinTarget(to, board).label}`);
        continue;
      }

      // Collapse Traffic Light rows ("Red LED", "Yellow LED", "Green LED") into 1 Traffic Light Module
      if (hasTrafficInWiring && /\b(red|yellow|green)\s*led\b/i.test(from)) {
        const group = ensureGroup('Traffic Light Module', 'traffic_light');
        const label = /red/i.test(from) ? 'RED' : /yellow/i.test(from) ? 'YEL' : 'GRN';
        pushUniqueRow(group, label, to, row.note || `${from} → ${resolveEspPinTarget(to, board).label}`);
        continue;
      }

      if (isBareTerminalName(from)) {
        const cleanTerm = from.replace(/\s*\([^)]*\)/g, '').trim();
        deferredBareRows.push({
          terminalLabel: cleanTerm || from,
          espPin: to,
          note: row.note || `${cleanTerm} → ${resolveEspPinTarget(to, board).label}`,
        });
        continue;
      }

      // Split "DHT22 DATA", "LED Anode (+)", "Button Pin 1", "Servo Signal", "OLED SDA", "LDR+10k Divider"
      const parts = from.split(
        /\s+(?=(?:VCC|GND|3\.3V|3V3|5V|VIN|SDA|SCL|DATA|OUT|AOUT|AO|DOUT|DO|SIG|SIGNAL|TRIG|ECHO|IN|IN\d|DIN|CLK|DIO|MOSI|MISO|CS|DT|SCK|ANODE|CATHODE|WIPER|DIVIDER|PIN\s*\d|\+|-)\b)/i
      );
      const baseRaw = (parts[0] || from).trim();
      const terminalLabel = (parts.slice(1).join(' ') || (to.toUpperCase().includes('GND') ? 'GND' : 'SIG')).trim();
      const target = resolveEspPinTarget(to, board);
      const kind = classifyComponentKind(baseRaw);
      const group = ensureGroup(baseRaw, kind);

      pushUniqueRow(
        group,
        terminalLabel,
        to,
        row.note || `${group.name} ${terminalLabel} → ${target.label}`
      );
    }
  }

  // 2. Attach deferred bare terminal rows ("SDA", "SCL", "VCC", "GND", "CLK", etc.)
  if (deferredBareRows.length > 0) {
    const primaryFromCode = detectPrimaryComponentFromCode(simulation);
    for (const bare of deferredBareRows) {
      const upperTerm = bare.terminalLabel.toUpperCase();
      let targetGroup: GroupedComponentDraft | undefined;

      if (/^(SDA|SCL)$/.test(upperTerm)) {
        targetGroup = Array.from(grouped.values()).find(
          (g) => g.kind === 'oled_ssd1306' || g.kind === 'lcd_1602' || g.kind === 'bme280' || g.kind === 'imu_mpu6050'
        );
      } else if (/^(TRIG|ECHO)$/.test(upperTerm)) {
        targetGroup = Array.from(grouped.values()).find((g) => g.kind === 'ultrasonic');
      } else if (/^(CLK|DIO)$/.test(upperTerm)) {
        targetGroup = Array.from(grouped.values()).find((g) => g.kind === 'seven_seg');
      }

      if (!targetGroup && grouped.size === 1) {
        targetGroup = Array.from(grouped.values())[0];
      }
      if (!targetGroup && primaryFromCode) {
        targetGroup = ensureGroup(primaryFromCode.name, primaryFromCode.kind);
      }
      if (!targetGroup) {
        targetGroup = Array.from(grouped.values())[0] ?? ensureGroup('External Module', 'generic_module');
      }

      pushUniqueRow(
        targetGroup,
        bare.terminalLabel,
        bare.espPin,
        bare.note || `${targetGroup.name} ${bare.terminalLabel} → ${resolveEspPinTarget(bare.espPin, board).label}`
      );
    }
  }

  // 3. Auto-detect peripherals directly from code when not already represented, allocating distinct GPIOs
  const hasKind = (k: ComponentKind) => Array.from(grouped.values()).some((g) => g.kind === k);
  const usedGpios = new Set<number>();
  for (const g of grouped.values()) {
    for (const r of g.rows) {
      const t = resolveEspPinTarget(r.espPin, board);
      if (t.gpio !== null) usedGpios.add(t.gpio);
    }
  }

  const pickFreeGpio = (preferAdc = false): number => {
    for (const g of simulation.activeGpios) {
      if (!usedGpios.has(g) && g !== board.defaultLedPin) {
        usedGpios.add(g);
        return g;
      }
    }
    const candidate = board.pins.find(
      (p) =>
        !p.isInternalFlash &&
        !p.isStrapping &&
        !usedGpios.has(p.gpio) &&
        p.gpio !== board.defaultLedPin &&
        (!preferAdc || p.capabilities.includes('ADC1'))
    );
    const chosen = candidate?.gpio ?? 4;
    usedGpios.add(chosen);
    return chosen;
  };

  const autoAddIfMissing = (
    condition: boolean,
    name: string,
    kind: ComponentKind,
    preferredGpio?: number,
    preferAdc = false
  ) => {
    if (!condition || hasKind(kind)) return;
    const g1 = preferredGpio !== undefined ? (usedGpios.add(preferredGpio), preferredGpio) : pickFreeGpio(preferAdc);
    const g2 = kind === 'ultrasonic' || kind === 'seven_seg' ? pickFreeGpio(false) : undefined;
    const defs = defaultTerminalsForKind(kind, board, g1, g2);
    const group = ensureGroup(name, kind);
    for (const d of defs) {
      pushUniqueRow(group, d.label, d.espPin, `Detected in code: ${name} ${d.label} → ${d.espPin}`);
    }
  };

  autoAddIfMissing(simulation.hasOled, 'SSD1306 OLED 0.96"', 'oled_ssd1306', board.defaultI2c.sda);
  autoAddIfMissing(simulation.hasLcd, '16x2 I2C LCD', 'lcd_1602', board.defaultI2c.sda);
  autoAddIfMissing(simulation.hasSevenSeg, 'TM1637 7-Segment Display', 'seven_seg');
  autoAddIfMissing(simulation.hasBme, 'BME280 Sensor', 'bme280', board.defaultI2c.sda);
  autoAddIfMissing(simulation.hasImu, 'MPU6050 Gyro/Accel', 'imu_mpu6050', board.defaultI2c.sda);
  autoAddIfMissing(simulation.hasDht, 'DHT22 Temp & Humidity', 'dht22');
  autoAddIfMissing(simulation.hasLightSensor, 'LDR Light Sensor', 'light_sensor', undefined, true);
  autoAddIfMissing(simulation.hasSoilSensor, 'Soil Moisture Sensor', 'soil_moisture', undefined, true);
  autoAddIfMissing(simulation.hasGasSensor, 'MQ-2 Gas Sensor', 'gas_sensor', undefined, true);
  autoAddIfMissing(simulation.hasSoundMic, 'Sound Mic Sensor', 'sound_mic');
  autoAddIfMissing(simulation.hasIrReceiver, 'IR Receiver (38kHz)', 'ir_receiver');
  autoAddIfMissing(simulation.hasServo, 'SG90 Micro Servo', 'servo');
  autoAddIfMissing(simulation.hasStepper, '28BYJ-48 Stepper Motor', 'stepper');
  autoAddIfMissing(simulation.hasUltrasonic, 'HC-SR04 Ultrasonic', 'ultrasonic');
  autoAddIfMissing(simulation.hasRelay, '5V Relay Module', 'relay');
  autoAddIfMissing(simulation.hasLamp && !simulation.hasRelay, 'Smart Lamp Bulb', 'lamp_bulb');
  autoAddIfMissing(simulation.hasBuzzer, 'Piezo Buzzer', 'buzzer');
  autoAddIfMissing(simulation.hasPir, 'PIR Motion Sensor', 'pir');
  autoAddIfMissing(simulation.hasNeoPixel && !simulation.usesOnboardRgb, 'WS2812B NeoPixel Ring', 'rgb_neopixel');
  autoAddIfMissing(simulation.hasRgbLed, 'RGB LED (Common Cathode)', 'rgb_led');
  autoAddIfMissing(simulation.hasTrafficLight, 'Traffic Light Module', 'traffic_light');
  autoAddIfMissing(simulation.hasPotentiometer, '10k Potentiometer', 'potentiometer', undefined, true);
  autoAddIfMissing(simulation.hasButton, 'Tactile Push Button', 'button');

  const externalDigitalGpio = simulation.activeGpios.find(
    (g) => g !== board.defaultLedPin && g !== board.defaultI2c.sda && g !== board.defaultI2c.scl
  );
  if (
    externalDigitalGpio !== undefined &&
    grouped.size === 0 &&
    /\b(pinMode|digitalWrite|analogWrite|Pin\s*\(|gpio_set_level)\b/.test(code)
  ) {
    autoAddIfMissing(true, `External LED (GPIO ${externalDigitalGpio})`, 'led', externalDigitalGpio);
  }

  // Build final CircuitComponentNode[] and CircuitWireSpec[]
  const drafts = Array.from(grouped.values()).slice(0, 6);
  const components: CircuitComponentNode[] = [];
  const wires: CircuitWireSpec[] = [];
  let fallbackColorIdx = 0;

  drafts.forEach((draft, compIdx) => {
    const compId = `comp_${compIdx + 1}`;
    const slot = computeWorkbenchSlot(compIdx, drafts.length);

    const hasPowerRow = draft.rows.some((r) => /3\.3v|3v3|5v|vin|vcc/i.test(`${r.terminalLabel} ${r.espPin}`));
    const hasGndRow = draft.rows.some((r) => /gnd|ground|cathode/i.test(`${r.terminalLabel} ${r.espPin}`));

    const rows = [...draft.rows];
    if (
      draft.kind !== 'led' &&
      draft.kind !== 'rgb_led' &&
      draft.kind !== 'traffic_light' &&
      draft.kind !== 'button' &&
      !hasPowerRow
    ) {
      const use5v =
        draft.kind === 'servo' ||
        draft.kind === 'ultrasonic' ||
        draft.kind === 'relay' ||
        draft.kind === 'lcd_1602' ||
        draft.kind === 'gas_sensor' ||
        draft.kind === 'pir' ||
        draft.kind === 'lamp_bulb' ||
        draft.kind === 'stepper';
      rows.unshift({
        terminalLabel: use5v ? '5V' : 'VCC',
        espPin: use5v ? '5V / VIN' : '3.3V',
        note: 'Power supply rail',
      });
    }
    if (!hasGndRow) {
      rows.push({
        terminalLabel: 'GND',
        espPin: 'GND',
        note: 'Common ground reference',
      });
    }

    const terminals: ComponentTerminalSpec[] = rows.map((row, tIdx) => {
      const target = resolveEspPinTarget(row.espPin, board);
      const { signalKind, colorHex: baseColor } = classifyWireSignal(row.terminalLabel, row.espPin);
      let colorHex = baseColor;
      if (signalKind === 'digital' && baseColor === '#059669') {
        colorHex = WIRE_COLORS.signalDefault[fallbackColorIdx % WIRE_COLORS.signalDefault.length];
        fallbackColorIdx += 1;
      }

      const terminalId = `${compId}_t_${tIdx}`;
      wires.push({
        id: `wire_${compId}_${tIdx}`,
        componentId: compId,
        componentName: draft.name,
        componentTerminalId: terminalId,
        componentTerminalLabel: row.terminalLabel,
        espPinLabel: target.label,
        espGpio: target.gpio,
        espRail: target.rail,
        signalKind,
        colorHex,
        note: row.note,
      });

      return {
        id: terminalId,
        label: row.terminalLabel,
        espPinLabel: target.label,
        gpio: target.gpio,
        signalKind,
        colorHex,
      };
    });

    components.push({
      id: compId,
      kind: draft.kind,
      name: draft.name,
      subtitle: `${terminals.length} wire${terminals.length === 1 ? '' : 's'} connected`,
      terminals,
      codeHint: `Driven by ${board.shortName}`,
      ledColorHex: draft.kind === 'led' ? inferLedColorHex(draft.name) : undefined,
      position: slot,
    });
  });

  return {
    components,
    wires,
    simulation,
  };
}
