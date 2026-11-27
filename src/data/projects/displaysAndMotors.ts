import type { EspProject } from '../../types/esp';

export const DISPLAYS_MOTORS_PROJECTS: EspProject[] = [
  {
    id: 'disp-oled-ssd1306-hello',
    title: '73. SSD1306 0.96" OLED Hello & Text',
    category: 'Displays & OLED',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Render crisp text and uptime counters on an I2C 128x64 OLED display.',
    parts: ['ESP32', '0.96" SSD1306 I2C OLED'],
    wiring: [{ from: 'SDA', to: 'GPIO 21' }, { from: 'SCL', to: 'GPIO 22' }, { from: 'VCC', to: '3.3V' }],
    libraries: ['Adafruit SSD1306', 'Adafruit GFX Library'],
    baudRate: 115200,
    code: `#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 oled(128, 64, &Wire, -1);

void setup() {
  oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  oled.setTextColor(SSD1306_WHITE);
}

void loop() {
  oled.clearDisplay();
  oled.setTextSize(2);
  oled.setCursor(0, 8);
  oled.println("Rs-ESP");
  oled.setTextSize(1);
  oled.setCursor(0, 36);
  oled.printf("Uptime: %lus", millis() / 1000);
  oled.display();
  delay(500);
}`
  },
  {
    id: 'disp-oled-sensor-bar',
    title: '74. OLED Live Analog Bar Graph',
    category: 'Displays & OLED',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Draw a real-time horizontal progress bar on an OLED from an analog input.',
    parts: ['ESP32', 'SSD1306 OLED', '10kΩ Potentiometer'],
    wiring: [{ from: 'OLED SDA/SCL', to: 'GPIO 21 / 22' }, { from: 'Pot', to: 'GPIO 34' }],
    libraries: ['Adafruit SSD1306', 'Adafruit GFX Library'],
    baudRate: 115200,
    code: `#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
Adafruit_SSD1306 oled(128, 64, &Wire, -1);

void setup() { oled.begin(SSD1306_SWITCHCAPVCC, 0x3C); }

void loop() {
  int val = analogRead(34);
  int w = map(val, 0, 4095, 0, 118);
  oled.clearDisplay();
  oled.setTextSize(1); oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(4, 10); oled.printf("ADC Value: %d", val);
  oled.drawRect(4, 28, 120, 18, SSD1306_WHITE);
  oled.fillRect(5, 29, w, 16, SSD1306_WHITE);
  oled.display();
  delay(60);
}`
  },
  {
    id: 'disp-oled-ntp-clock',
    title: '75. OLED Wi-Fi Digital Desk Clock',
    category: 'Displays & OLED',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Show large synced HH:MM:SS network time on a mini OLED screen.',
    parts: ['ESP32', 'SSD1306 128x64 OLED'],
    wiring: [{ from: 'SDA/SCL', to: 'GPIO 21 / 22' }],
    libraries: ['WiFi', 'Adafruit SSD1306', 'Adafruit GFX Library'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <time.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 oled(128, 64, &Wire, -1);

void setup() {
  oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  configTime(0, 0, "pool.ntp.org");
}

void loop() {
  struct tm t;
  if (getLocalTime(&t)) {
    oled.clearDisplay();
    oled.setTextColor(SSD1306_WHITE);
    oled.setTextSize(2);
    oled.setCursor(14, 22);
    oled.printf("%02d:%02d:%02d", t.tm_hour, t.tm_min, t.tm_sec);
    oled.display();
  }
  delay(1000);
}`
  },
  {
    id: 'disp-lcd-1602-i2c',
    title: '76. 16x2 I2C Character LCD Message Board',
    category: 'Displays & OLED',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Print two crisp lines of text on a classic blue/green 16x2 I2C LCD.',
    parts: ['ESP32', '1602 LCD with PCF8574 I2C backpack'],
    wiring: [{ from: 'SDA', to: 'GPIO 21' }, { from: 'SCL', to: 'GPIO 22' }, { from: 'VCC', to: '5V/VIN' }],
    libraries: ['LiquidCrystal_I2C'],
    baudRate: 115200,
    code: `#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Rs-ESP Studio");
}

void loop() {
  lcd.setCursor(0, 1);
  lcd.printf("Seconds: %lu   ", millis() / 1000);
  delay(500);
}`
  },
  {
    id: 'disp-tm1637-4digit',
    title: '77. TM1637 4-Digit 7-Segment Counter',
    category: 'Displays & OLED',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Drive a bright 4-digit red LED stopwatch/scoreboard with only 2 data wires.',
    parts: ['ESP32', 'TM1637 4-digit display'],
    wiring: [{ from: 'CLK', to: 'GPIO 18' }, { from: 'DIO', to: 'GPIO 19' }, { from: 'VCC', to: '3.3V' }],
    libraries: ['TM1637Display'],
    baudRate: 115200,
    code: `#include <TM1637Display.h>
TM1637Display disp(18, 19);
int count = 0;

void setup() { disp.setBrightness(5); }
void loop() {
  disp.showNumberDec(count++, true);
  delay(200);
}`
  },
  {
    id: 'disp-max7219-matrix',
    title: '78. MAX7219 8x8 LED Matrix Smiley & Pattern',
    category: 'Displays & OLED',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Display custom pixel icons on an SPI 8x8 LED matrix module.',
    parts: ['ESP32', 'MAX7219 8x8 LED Matrix'],
    wiring: [{ from: 'DIN', to: 'GPIO 23' }, { from: 'CLK', to: 'GPIO 18' }, { from: 'CS', to: 'GPIO 5' }],
    libraries: ['MD_MAX72XX'],
    baudRate: 115200,
    code: `#include <MD_MAX72xx.h>
MD_MAX72XX mx = MD_MAX72XX(MD_MAX72XX::FC16_HW, 5, 1);

const uint8_t SMILE[8] = {0x3C,0x42,0xA5,0x81,0xA5,0x99,0x42,0x3C};

void setup() {
  mx.begin();
  for (int r = 0; r < 8; r++) mx.setRow(0, r, SMILE[r]);
}
void loop() {}`
  },
  {
    id: 'disp-neopixel-rainbow',
    title: '79. WS2812B NeoPixel Rainbow Strip',
    category: 'Displays & OLED',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Animate vibrant addressable RGB colors along a WS2812B LED strip or ring.',
    parts: ['ESP32', 'WS2812B Strip (16 LEDs)', '330Ω data resistor'],
    wiring: [{ from: 'DIN', to: 'GPIO 13 (or GPIO 48 on S3)' }, { from: '5V/GND', to: '5V Power' }],
    libraries: ['Adafruit NeoPixel'],
    baudRate: 115200,
    code: `#include <Adafruit_NeoPixel.h>
#define PIN 13
#define NUM_LEDS 16

Adafruit_NeoPixel strip(NUM_LEDS, PIN, NEO_GRB + NEO_KHZ800);
uint16_t hue = 0;

void setup() {
  strip.begin();
  strip.setBrightness(60);
}

void loop() {
  for (int i = 0; i < NUM_LEDS; i++) {
    strip.setPixelColor(i, strip.ColorHSV(hue + (i * 65536L / NUM_LEDS)));
  }
  strip.show();
  hue += 512;
  delay(30);
}`
  },
  {
    id: 'disp-neopixel-s3-onboard',
    title: '80. ESP32-S3 Onboard RGB LED Cycler',
    category: 'Displays & OLED',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-s3',
    framework: 'arduino',
    summary: 'Blink and fade the built-in addressable WS2812 RGB LED on GPIO 48 of ESP32-S3.',
    parts: ['ESP32-S3 DevKitC-1'],
    wiring: [{ from: 'Onboard RGB', to: 'GPIO 48' }],
    libraries: [],
    baudRate: 115200,
    code: `#define RGB_PIN 48

void setup() {
  Serial.begin(115200);
}

void loop() {
  neopixelWrite(RGB_PIN, 64, 0, 0); delay(500);
  neopixelWrite(RGB_PIN, 0, 64, 0); delay(500);
  neopixelWrite(RGB_PIN, 0, 0, 64); delay(500);
}`
  },
  {
    id: 'disp-st7789-tft',
    title: '81. ST7789 240x240 Color IPS TFT Demo',
    category: 'Displays & OLED',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Draw colorful gauges and graphics on a high-DPI SPI IPS TFT display.',
    parts: ['ESP32', 'ST7789 1.3" IPS TFT'],
    wiring: [{ from: 'SDA/SCL', to: 'GPIO 23 / 18' }, { from: 'DC/RST', to: 'GPIO 2 / 4' }],
    libraries: ['Adafruit ST7735 and ST7789 Library', 'Adafruit GFX Library'],
    baudRate: 115200,
    code: `#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>

Adafruit_ST7789 tft = Adafruit_ST7789(-1, 2, 4);

void setup() {
  tft.init(240, 240, SPI_MODE3);
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextColor(ST77XX_CYAN);
  tft.setTextSize(3);
  tft.setCursor(25, 100);
  tft.println("Rs-ESP TFT");
}
void loop() {}`
  },
  {
    id: 'disp-i2c-scanner',
    title: '82. I2C Address Finder Utility',
    category: 'Displays & OLED',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Find the hex address (0x3C, 0x27, 0x76) of any connected OLED, LCD, or sensor.',
    parts: ['ESP32/ESP8266', 'Any I2C module'],
    wiring: [{ from: 'SDA', to: 'GPIO 21 (D2 on 8266)' }, { from: 'SCL', to: 'GPIO 22 (D1 on 8266)' }],
    libraries: ['Wire'],
    baudRate: 115200,
    code: `#include <Wire.h>

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Serial.println("Scanning I2C bus...");
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("Found I2C device at 0x%02X\\n", addr);
    }
  }
}
void loop() {}`
  },
  {
    id: 'disp-oled-micropython',
    title: '83. MicroPython SSD1306 OLED Dashboard',
    category: 'Displays & OLED',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'micropython',
    summary: 'Display text and lines on an SSD1306 I2C OLED using MicroPython.',
    parts: ['ESP32 (MicroPython)', 'SSD1306 OLED'],
    wiring: [{ from: 'SDA/SCL', to: 'GPIO 21 / 22' }],
    libraries: ['ssd1306.py'],
    baudRate: 115200,
    code: `from machine import Pin, SoftI2C
import ssd1306

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)
oled.fill(0)
oled.text("Rs-ESP MicroPy", 4, 12)
oled.text("OLED Ready!", 16, 32)
oled.show()`
  },
  {
    id: 'disp-neopixel-vu-meter',
    title: '84. NeoPixel Sound Reactive VU Bar',
    category: 'Displays & OLED',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Light up LEDs proportionally to room music loudness using an analog mic.',
    parts: ['ESP32', 'MAX4466 Analog Mic', '16-LED NeoPixel Strip'],
    wiring: [{ from: 'Mic OUT', to: 'GPIO 34' }, { from: 'NeoPixel DIN', to: 'GPIO 13' }],
    libraries: ['Adafruit NeoPixel'],
    baudRate: 115200,
    code: `#include <Adafruit_NeoPixel.h>
Adafruit_NeoPixel strip(16, 13, NEO_GRB + NEO_KHZ800);

void setup() { strip.begin(); }

void loop() {
  int peak = abs(analogRead(34) - 2048);
  int lit = constrain(map(peak, 40, 1200, 0, 16), 0, 16);
  strip.clear();
  for (int i = 0; i < lit; i++) {
    strip.setPixelColor(i, i > 11 ? strip.Color(255,0,0) : strip.Color(0,180,90));
  }
  strip.show();
  delay(25);
}`
  },
  {
    id: 'motor-sg90-sweep',
    title: '85. SG90 Micro Servo Smooth Sweep',
    category: 'Motors, Servos & Relays',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Sweep an SG90 servo arm smoothly from 0° to 180° and back.',
    parts: ['ESP32', 'SG90 Servo Motor'],
    wiring: [{ from: 'Signal (Orange)', to: 'GPIO 13' }, { from: 'VCC (Red)', to: '5V/VIN' }, { from: 'GND (Brown)', to: 'GND' }],
    libraries: ['ESP32Servo'],
    baudRate: 115200,
    code: `#include <ESP32Servo.h>
Servo servo;

void setup() {
  servo.attach(13);
}

void loop() {
  for (int pos = 0; pos <= 180; pos += 2) { servo.write(pos); delay(15); }
  for (int pos = 180; pos >= 0; pos -= 2) { servo.write(pos); delay(15); }
}`
  },
  {
    id: 'motor-servo-pot',
    title: '86. Potentiometer Controlled Servo Arm',
    category: 'Motors, Servos & Relays',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Mirror a rotary potentiometer angle directly onto a robotic servo.',
    parts: ['ESP32', 'SG90 Servo', '10kΩ Potentiometer'],
    wiring: [{ from: 'Pot Wiper', to: 'GPIO 34' }, { from: 'Servo Signal', to: 'GPIO 13' }],
    libraries: ['ESP32Servo'],
    baudRate: 115200,
    code: `#include <ESP32Servo.h>
Servo servo;

void setup() {
  Serial.begin(115200);
  servo.attach(13);
}

void loop() {
  int angle = map(analogRead(34), 0, 4095, 0, 180);
  servo.write(angle);
  Serial.printf("angle:%d\\n", angle);
  delay(20);
}`
  },
  {
    id: 'motor-web-servo',
    title: '87. Wi-Fi Slider Servo Turret',
    category: 'Motors, Servos & Relays',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Aim a pan/tilt servo from 0–180° using an interactive HTML range slider.',
    parts: ['ESP32', 'SG90 Servo'],
    wiring: [{ from: 'Servo Signal', to: 'GPIO 13' }],
    libraries: ['WiFi', 'WebServer', 'ESP32Servo'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>

WebServer server(80);
Servo servo;

void setup() {
  servo.attach(13);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  server.on("/", []() {
    server.send(200, "text/html",
      "<input type='range' min='0' max='180' oninput='fetch(\"/set?a=\"+this.value)'>");
  });
  server.on("/set", []() {
    servo.write(server.arg("a").toInt());
    server.send(200, "text/plain", "OK");
  });
  server.begin();
}
void loop() { server.handleClient(); }`
  },
  {
    id: 'motor-28byj48-stepper',
    title: '88. 28BYJ-48 Stepper Motor (ULN2003)',
    category: 'Motors, Servos & Relays',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Rotate a geared 28BYJ-48 stepper motor exactly one full revolution clockwise and back.',
    parts: ['ESP32', '28BYJ-48 Stepper + ULN2003 Driver'],
    wiring: [{ from: 'IN1..IN4', to: 'GPIO 19, 18, 5, 17' }, { from: 'Driver 5V', to: 'External 5V' }],
    libraries: ['Stepper'],
    baudRate: 115200,
    code: `#include <Stepper.h>
Stepper stepper(2048, 19, 5, 18, 17);

void setup() {
  stepper.setSpeed(12);
}

void loop() {
  stepper.step(2048);
  delay(1000);
  stepper.step(-2048);
  delay(1000);
}`
  },
  {
    id: 'motor-a4988-nema17',
    title: '89. NEMA-17 Stepper with A4988 Driver',
    category: 'Motors, Servos & Relays',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Drive a CNC/3D-printer NEMA-17 stepper using STEP and DIR pulses.',
    parts: ['ESP32', 'A4988 / TMC2208 Driver', 'NEMA-17 Stepper + 12V PSU'],
    wiring: [{ from: 'STEP', to: 'GPIO 18' }, { from: 'DIR', to: 'GPIO 19' }],
    libraries: [],
    baudRate: 115200,
    code: `const int STEP = 18, DIR = 19;

void setup() {
  pinMode(STEP, OUTPUT);
  pinMode(DIR, OUTPUT);
}

void loop() {
  digitalWrite(DIR, HIGH);
  for (int i = 0; i < 200; i++) {
    digitalWrite(STEP, HIGH); delayMicroseconds(900);
    digitalWrite(STEP, LOW); delayMicroseconds(900);
  }
  delay(1000);
}`
  },
  {
    id: 'motor-l298n-dc',
    title: '90. L298N Dual DC Motor Rover Driver',
    category: 'Motors, Servos & Relays',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Drive a DC robot motor forward, reverse, and variable speed with L298N H-bridge.',
    parts: ['ESP32', 'L298N Motor Driver', 'DC Gear Motor + Battery'],
    wiring: [{ from: 'IN1/IN2', to: 'GPIO 26 / 27' }, { from: 'ENA', to: 'GPIO 14' }],
    libraries: [],
    baudRate: 115200,
    code: `const int IN1 = 26, IN2 = 27, ENA = 14;

void setup() {
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(ENA, OUTPUT);
}

void loop() {
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  analogWrite(ENA, 200); delay(2000);
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW); delay(800);
  digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
  analogWrite(ENA, 200); delay(2000);
}`
  },
  {
    id: 'motor-relay-safe',
    title: '91. Relay Switch with Safe Boot State',
    category: 'Motors, Servos & Relays',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Prevent accidental relay chatter on boot by pre-writing HIGH before OUTPUT mode.',
    parts: ['ESP32/ESP8266', 'Optocoupled Relay Module'],
    wiring: [{ from: 'Relay IN', to: 'GPIO 26 (or D1/GPIO5 on 8266)' }],
    libraries: [],
    baudRate: 115200,
    code: `const int RELAY = 26;

void setup() {
  Serial.begin(115200);
  digitalWrite(RELAY, HIGH); // Active-LOW relay stays OFF at boot
  pinMode(RELAY, OUTPUT);
}

void loop() {
  digitalWrite(RELAY, LOW);  Serial.println("Relay: ENERGIZED"); delay(3000);
  digitalWrite(RELAY, HIGH); Serial.println("Relay: RELEASED");  delay(3000);
}`
  },
  {
    id: 'motor-mosfet-12v-led',
    title: '92. Logic-Level MOSFET 12V LED Strip Dimmer',
    category: 'Motors, Servos & Relays',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Dim high-power 12V monochrome LED strips safely using an IRLZ44N MOSFET.',
    parts: ['ESP32', 'IRLZ44N MOSFET', '10kΩ pull-down + 220Ω gate resistor', '12V LED Strip'],
    wiring: [{ from: 'Gate', to: 'GPIO 25 (via 220Ω)' }, { from: 'Source', to: 'Common GND' }],
    libraries: [],
    baudRate: 115200,
    code: `const int GATE = 25;
void setup() { pinMode(GATE, OUTPUT); }
void loop() {
  for (int i = 0; i <= 255; i += 5) { analogWrite(GATE, i); delay(25); }
  for (int i = 255; i >= 0; i -= 5) { analogWrite(GATE, i); delay(25); }
}`
  },
  {
    id: 'motor-pwm-fan-temp',
    title: '93. Temperature-Controlled 4-Pin PWM Fan',
    category: 'Motors, Servos & Relays',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Scale 25 kHz PC cooling fan speed smoothly based on thermistor/analog reading.',
    parts: ['ESP32', '12V 4-pin PWM Fan', 'Analog temp sensor'],
    wiring: [{ from: 'Fan PWM (Blue)', to: 'GPIO 25' }, { from: 'Temp Sensor', to: 'GPIO 34' }],
    libraries: [],
    baudRate: 115200,
    code: `void setup() {
  Serial.begin(115200);
  ledcAttach(25, 25000, 8);
}

void loop() {
  int raw = analogRead(34);
  int duty = constrain(map(raw, 1000, 3000, 50, 255), 50, 255);
  ledcWrite(25, duty);
  Serial.printf("sensor:%d,fanDuty:%d\\n", raw, duty);
  delay(500);
}`
  },
  {
    id: 'motor-solenoid-lock',
    title: '94. 12V Solenoid Door Latch Pulse',
    category: 'Motors, Servos & Relays',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Unlock a cabinet solenoid for 3 seconds when a button is pressed, preventing coil overheating.',
    parts: ['ESP32', 'Relay/MOSFET', '12V Solenoid Lock', 'Pushbutton'],
    wiring: [{ from: 'Unlock Button', to: 'GPIO 14 & GND' }, { from: 'Driver', to: 'GPIO 26' }],
    libraries: [],
    baudRate: 115200,
    code: `const int BTN = 14, LOCK = 26;
void setup() {
  pinMode(BTN, INPUT_PULLUP);
  pinMode(LOCK, OUTPUT);
}
void loop() {
  if (digitalRead(BTN) == LOW) {
    digitalWrite(LOCK, HIGH);
    delay(3000);
    digitalWrite(LOCK, LOW);
  }
}`
  },
  {
    id: 'motor-micropython-servo',
    title: '95. MicroPython PWM Servo Positioner',
    category: 'Motors, Servos & Relays',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'micropython',
    summary: 'Move a servo to 0°, 90°, and 180° using MicroPython 50Hz PWM duty cycle.',
    parts: ['ESP32/ESP8266 (MicroPython)', 'SG90 Servo'],
    wiring: [{ from: 'Signal', to: 'GPIO 13' }],
    libraries: [],
    baudRate: 115200,
    code: `from machine import Pin, PWM
import time

servo = PWM(Pin(13), freq=50)

def set_angle(deg):
    duty = int(26 + (deg / 180) * 102)
    servo.duty(duty)

while True:
    for a in (0, 90, 180, 90):
        set_angle(a)
        print("Servo angle:", a)
        time.sleep(1)`
  },
  {
    id: 'motor-obstacle-avoid-logic',
    title: '96. Ultrasonic Obstacle Avoidance Rover Logic',
    category: 'Motors, Servos & Relays',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Read HC-SR04 distance and steer a 2-motor robot around obstacles automatically.',
    parts: ['ESP32', 'HC-SR04', 'L298N + 2 DC Motors'],
    wiring: [{ from: 'TRIG/ECHO', to: 'GPIO 5 / 18' }, { from: 'Motors', to: 'GPIO 26,27,14,12' }],
    libraries: [],
    baudRate: 115200,
    code: `const int TRIG = 5, ECHO = 18;
const int L1 = 26, L2 = 27, R1 = 14, R2 = 12;

float getDist() {
  digitalWrite(TRIG, LOW); delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  return pulseIn(ECHO, HIGH, 25000) * 0.0343 / 2.0;
}

void setup() {
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);
  pinMode(L1, OUTPUT); pinMode(L2, OUTPUT); pinMode(R1, OUTPUT); pinMode(R2, OUTPUT);
}

void loop() {
  if (getDist() < 20.0) {
    digitalWrite(L1, HIGH); digitalWrite(L2, LOW);
    digitalWrite(R1, LOW);  digitalWrite(R2, HIGH); // Turn
    delay(400);
  } else {
    digitalWrite(L1, HIGH); digitalWrite(L2, LOW);
    digitalWrite(R1, HIGH); digitalWrite(R2, LOW);  // Forward
  }
  delay(80);
}`
  }
];
