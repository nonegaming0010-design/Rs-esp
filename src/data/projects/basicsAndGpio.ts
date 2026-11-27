import type { EspProject } from '../../types/esp';

export const BASICS_GPIO_PROJECTS: EspProject[] = [
  {
    id: 'basic-blink-onboard',
    title: '01. Classic Onboard LED Blink',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Blink the built-in LED every second and print status to the Serial Monitor.',
    parts: ['ESP32 or ESP8266 board', 'USB data cable'],
    wiring: [{ from: 'Onboard LED', to: 'GPIO 2', note: 'Built into most DevKit / NodeMCU boards' }],
    libraries: [],
    baudRate: 115200,
    code: `#define LED_PIN 2

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("Rs-ESP: Onboard LED Blink Ready");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED: ON");
  delay(1000);

  digitalWrite(LED_PIN, LOW);
  Serial.println("LED: OFF");
  delay(1000);
}`
  },
  {
    id: 'basic-micropython-blink',
    title: '02. MicroPython Heartbeat Blink',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'micropython',
    summary: 'Upload directly to a MicroPython ESP board to toggle GPIO 2 at 2 Hz.',
    parts: ['ESP32 or ESP8266 with MicroPython firmware', 'USB cable'],
    wiring: [{ from: 'Onboard LED', to: 'GPIO 2', note: 'Active HIGH on ESP32, active LOW on NodeMCU' }],
    libraries: [],
    baudRate: 115200,
    code: `from machine import Pin
import time

led = Pin(2, Pin.OUT)
print("Rs-ESP MicroPython Heartbeat Started")

while True:
    led.value(1)
    print("LED: 1")
    time.sleep(0.5)
    led.value(0)
    print("LED: 0")
    time.sleep(0.5)`
  },
  {
    id: 'basic-sos-morse',
    title: '03. SOS Morse Code Beacon',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Flash an international S-O-S distress signal using helper timing functions.',
    parts: ['ESP32 or ESP8266', 'External LED + 220Ω resistor (optional)'],
    wiring: [{ from: 'LED Anode (+)', to: 'GPIO 2', note: 'Or use onboard LED' }, { from: 'LED Cathode (-)', to: 'GND', note: 'Via 220Ω resistor' }],
    libraries: [],
    baudRate: 115200,
    code: `const int LED_PIN = 2;

void flashDot() {
  digitalWrite(LED_PIN, HIGH);
  delay(200);
  digitalWrite(LED_PIN, LOW);
  delay(200);
}

void flashDash() {
  digitalWrite(LED_PIN, HIGH);
  delay(600);
  digitalWrite(LED_PIN, LOW);
  delay(200);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  Serial.println("Sending SOS...");
  for (int i = 0; i < 3; i++) flashDot();
  delay(300);
  for (int i = 0; i < 3; i++) flashDash();
  delay(300);
  for (int i = 0; i < 3; i++) flashDot();
  delay(2000);
}`
  },
  {
    id: 'basic-button-pullup',
    title: '04. Pushbutton with Internal Pull-Up',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Read a tactile switch without external resistors using INPUT_PULLUP.',
    parts: ['ESP32 or ESP8266', 'Tactile push button', '2 jumper wires'],
    wiring: [
      { from: 'Button Pin 1', to: 'GPIO 14', note: 'Active LOW when pressed' },
      { from: 'Button Pin 2', to: 'GND', note: 'Common ground' }
    ],
    libraries: [],
    baudRate: 115200,
    code: `const int BTN_PIN = 14;
const int LED_PIN = 2;

void setup() {
  Serial.begin(115200);
  pinMode(BTN_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  bool pressed = (digitalRead(BTN_PIN) == LOW);
  digitalWrite(LED_PIN, pressed ? HIGH : LOW);
  if (pressed) {
    Serial.println("Button Pressed!");
  }
  delay(50);
}`
  },
  {
    id: 'basic-button-debounce-toggle',
    title: '05. Debounced Toggle Switch Latch',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Use a momentary button as an ON/OFF light switch with clean 50ms software debounce.',
    parts: ['ESP32 or ESP8266', 'Tactile push button', 'LED + 220Ω resistor'],
    wiring: [
      { from: 'Button', to: 'GPIO 14 & GND', note: 'Uses internal pull-up' },
      { from: 'LED', to: 'GPIO 2', note: 'Toggles each press' }
    ],
    libraries: [],
    baudRate: 115200,
    code: `const int BTN_PIN = 14;
const int LED_PIN = 2;

bool ledState = false;
int lastReading = HIGH;
int stableState = HIGH;
unsigned long lastDebounceTime = 0;

void setup() {
  Serial.begin(115200);
  pinMode(BTN_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int reading = digitalRead(BTN_PIN);
  if (reading != lastReading) {
    lastDebounceTime = millis();
  }
  if ((millis() - lastDebounceTime) > 50) {
    if (reading != stableState) {
      stableState = reading;
      if (stableState == LOW) {
        ledState = !ledState;
        digitalWrite(LED_PIN, ledState);
        Serial.printf("LED toggled -> %s\\n", ledState ? "ON" : "OFF");
      }
    }
  }
  lastReading = reading;
}`
  },
  {
    id: 'basic-pwm-breathing-led',
    title: '06. Smooth PWM Breathing LED',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Fade an LED brightness smoothly up and down using analogWrite PWM.',
    parts: ['ESP32 or ESP8266', 'LED + 220Ω resistor'],
    wiring: [{ from: 'LED (+)', to: 'GPIO 2', note: 'PWM-capable pin' }, { from: 'LED (-)', to: 'GND' }],
    libraries: [],
    baudRate: 115200,
    code: `const int LED_PIN = 2;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  for (int b = 0; b <= 255; b += 5) {
    analogWrite(LED_PIN, b);
    delay(20);
  }
  for (int b = 255; b >= 0; b -= 5) {
    analogWrite(LED_PIN, b);
    delay(20);
  }
}`
  },
  {
    id: 'basic-rgb-common-cathode',
    title: '07. RGB LED Color Cycle',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Mix Red, Green, and Blue PWM channels to generate custom colors on a standard 4-pin RGB LED.',
    parts: ['ESP32 or ESP8266', 'Common-cathode RGB LED', '3x 220Ω resistors'],
    wiring: [
      { from: 'Red Pin', to: 'GPIO 25', note: 'Via 220Ω resistor (use D5/14 on 8266)' },
      { from: 'Green Pin', to: 'GPIO 26', note: 'Via 220Ω resistor (use D6/12 on 8266)' },
      { from: 'Blue Pin', to: 'GPIO 27', note: 'Via 220Ω resistor (use D7/13 on 8266)' },
      { from: 'Common Cathode', to: 'GND' }
    ],
    libraries: [],
    baudRate: 115200,
    code: `const int RED_PIN = 25;
const int GREEN_PIN = 26;
const int BLUE_PIN = 27;

void setColor(uint8_t r, uint8_t g, uint8_t b) {
  analogWrite(RED_PIN, r);
  analogWrite(GREEN_PIN, g);
  analogWrite(BLUE_PIN, b);
}

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);
}

void loop() {
  setColor(255, 0, 0); delay(700);   // Red
  setColor(0, 255, 0); delay(700);   // Green
  setColor(0, 0, 255); delay(700);   // Blue
  setColor(255, 160, 0); delay(700); // Amber
  setColor(0, 220, 255); delay(700); // Cyan
}`
  },
  {
    id: 'basic-traffic-light',
    title: '08. Three-LED Traffic Light Controller',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Simulate a timed Red-Yellow-Green intersection signal with Serial phase logging.',
    parts: ['ESP32/ESP8266', 'Red, Yellow, Green LEDs', '3x 220Ω resistors'],
    wiring: [
      { from: 'Red LED', to: 'GPIO 13' },
      { from: 'Yellow LED', to: 'GPIO 12' },
      { from: 'Green LED', to: 'GPIO 14' }
    ],
    libraries: [],
    baudRate: 115200,
    code: `const int RED_LED = 13;
const int YEL_LED = 12;
const int GRN_LED = 14;

void setup() {
  Serial.begin(115200);
  pinMode(RED_LED, OUTPUT);
  pinMode(YEL_LED, OUTPUT);
  pinMode(GRN_LED, OUTPUT);
}

void loop() {
  Serial.println("Signal: GREEN");
  digitalWrite(RED_LED, LOW); digitalWrite(YEL_LED, LOW); digitalWrite(GRN_LED, HIGH);
  delay(4000);

  Serial.println("Signal: YELLOW");
  digitalWrite(GRN_LED, LOW); digitalWrite(YEL_LED, HIGH);
  delay(1500);

  Serial.println("Signal: RED");
  digitalWrite(YEL_LED, LOW); digitalWrite(RED_LED, HIGH);
  delay(4000);
}`
  },
  {
    id: 'basic-knight-rider',
    title: '09. 5-LED Chaser (Knight Rider)',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Sweep a light beam back and forth across 5 LEDs using an array of GPIO pins.',
    parts: ['ESP32/ESP8266', '5x LEDs', '5x 220Ω resistors'],
    wiring: [{ from: 'LEDs 1..5', to: 'GPIO 13, 14, 27, 26, 25', note: 'Cathodes to GND' }],
    libraries: [],
    baudRate: 115200,
    code: `const int pins[] = {13, 14, 27, 26, 25};
const int COUNT = 5;

void setup() {
  for (int i = 0; i < COUNT; i++) pinMode(pins[i], OUTPUT);
}

void loop() {
  for (int i = 0; i < COUNT; i++) {
    digitalWrite(pins[i], HIGH); delay(90); digitalWrite(pins[i], LOW);
  }
  for (int i = COUNT - 2; i > 0; i--) {
    digitalWrite(pins[i], HIGH); delay(90); digitalWrite(pins[i], LOW);
  }
}`
  },
  {
    id: 'basic-potentiometer-dimmer',
    title: '10. Potentiometer Analog Dimmer',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Read a 10kΩ rotary knob on ADC and map it smoothly to LED PWM brightness.',
    parts: ['ESP32', '10kΩ Potentiometer', 'LED + 220Ω resistor'],
    wiring: [
      { from: 'Pot Wiper (Middle)', to: 'GPIO 34', note: 'Use A0 on ESP8266' },
      { from: 'Pot Outer Pins', to: '3.3V and GND' },
      { from: 'LED (+)', to: 'GPIO 2' }
    ],
    libraries: [],
    baudRate: 115200,
    code: `const int POT_PIN = 34; // Use A0 on ESP8266
const int LED_PIN = 2;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int raw = analogRead(POT_PIN); // 0..4095 on ESP32
  int pwm = map(raw, 0, 4095, 0, 255);
  analogWrite(LED_PIN, pwm);
  Serial.printf("raw:%d,pwm:%d\\n", raw, pwm);
  delay(100);
}`
  },
  {
    id: 'basic-capacitive-touch',
    title: '11. ESP32 Built-In Capacitive Touch Pad',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Turn any bare wire or foil pad on GPIO 4 into a touch sensor using ESP32 hardware touch.',
    parts: ['ESP32 board', '1 jumper wire or copper foil pad'],
    wiring: [{ from: 'Touch Wire / Foil', to: 'GPIO 4 (T0)', note: 'No external resistor needed' }],
    libraries: [],
    baudRate: 115200,
    code: `const int TOUCH_PIN = 4;
const int LED_PIN = 2;
const int THRESHOLD = 30;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int val = touchRead(TOUCH_PIN);
  Serial.printf("touch:%d\\n", val);
  digitalWrite(LED_PIN, val < THRESHOLD ? HIGH : LOW);
  delay(80);
}`
  },
  {
    id: 'basic-hall-sensor-esp32',
    title: '12. ESP32 Internal Hall Magnet Detector',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Detect magnets near the ESP32 metal shield with zero external components.',
    parts: ['ESP32 DevKit', 'Small fridge magnet'],
    wiring: [{ from: 'Internal Hall Sensor', to: 'Built inside ESP32 chip', note: 'Hold magnet over metal shield' }],
    libraries: [],
    baudRate: 115200,
    code: `void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
}

void loop() {
  int mag = hallRead();
  Serial.printf("hall:%d\\n", mag);
  digitalWrite(2, (mag > 70 || mag < -20) ? HIGH : LOW);
  delay(120);
}`
  },
  {
    id: 'basic-reaction-timer',
    title: '13. LED Reaction Speed Game',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Test your reflexes in milliseconds when the LED flashes after a random delay.',
    parts: ['ESP32/ESP8266', 'Pushbutton', 'LED'],
    wiring: [{ from: 'Button', to: 'GPIO 14 & GND' }, { from: 'LED', to: 'GPIO 2' }],
    libraries: [],
    baudRate: 115200,
    code: `const int BTN = 14, LED = 2;

void setup() {
  Serial.begin(115200);
  pinMode(BTN, INPUT_PULLUP);
  pinMode(LED, OUTPUT);
  randomSeed(analogRead(34));
  Serial.println("Get ready for the LED flash...");
}

void loop() {
  delay(random(1500, 4500));
  digitalWrite(LED, HIGH);
  unsigned long startMs = millis();
  while (digitalRead(BTN) == HIGH) { delay(1); }
  unsigned long reaction = millis() - startMs;
  digitalWrite(LED, LOW);
  Serial.printf("Reaction time: %lu ms!\\n", reaction);
  while (digitalRead(BTN) == LOW) { delay(10); }
  delay(1000);
}`
  },
  {
    id: 'basic-multitask-millis',
    title: '14. Non-Blocking Multitask Blink (millis)',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Blink two LEDs at completely independent speeds without ever calling delay().',
    parts: ['ESP32/ESP8266', '2x LEDs', '2x 220Ω resistors'],
    wiring: [{ from: 'LED A', to: 'GPIO 2' }, { from: 'LED B', to: 'GPIO 4' }],
    libraries: [],
    baudRate: 115200,
    code: `const int LED_A = 2, LED_B = 4;
unsigned long prevA = 0, prevB = 0;
bool stateA = false, stateB = false;

void setup() {
  pinMode(LED_A, OUTPUT);
  pinMode(LED_B, OUTPUT);
}

void loop() {
  unsigned long now = millis();
  if (now - prevA >= 250) {
    prevA = now;
    stateA = !stateA;
    digitalWrite(LED_A, stateA);
  }
  if (now - prevB >= 700) {
    prevB = now;
    stateB = !stateB;
    digitalWrite(LED_B, stateB);
  }
}`
  },
  {
    id: 'basic-serial-command-led',
    title: '15. Serial Monitor LED Command Parser',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Type ON, OFF, or BLINK in the Rs-ESP Serial Monitor to control GPIO 2 live.',
    parts: ['ESP32 or ESP8266', 'USB cable'],
    wiring: [{ from: 'Onboard LED', to: 'GPIO 2' }],
    libraries: [],
    baudRate: 115200,
    code: `const int LED_PIN = 2;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("Type ON, OFF, or STATUS:");
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    cmd.toUpperCase();
    if (cmd == "ON") {
      digitalWrite(LED_PIN, HIGH);
      Serial.println("OK -> LED ON");
    } else if (cmd == "OFF") {
      digitalWrite(LED_PIN, LOW);
      Serial.println("OK -> LED OFF");
    } else if (cmd == "STATUS") {
      Serial.printf("LED=%d, uptime=%lus\\n", digitalRead(LED_PIN), millis() / 1000);
    } else {
      Serial.println("Unknown command. Try ON / OFF / STATUS");
    }
  }
}`
  },
  {
    id: 'basic-rotary-encoder',
    title: '16. KY-040 Rotary Encoder Counter',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Track clockwise/counter-clockwise knob ticks and push-button resets.',
    parts: ['ESP32', 'KY-040 Rotary Encoder', '5 jumper wires'],
    wiring: [
      { from: 'CLK', to: 'GPIO 18' },
      { from: 'DT', to: 'GPIO 19' },
      { from: 'SW', to: 'GPIO 21' },
      { from: '+ / GND', to: '3.3V / GND' }
    ],
    libraries: [],
    baudRate: 115200,
    code: `const int CLK = 18, DT = 19, SW = 21;
int counter = 0, lastClk = HIGH;

void setup() {
  Serial.begin(115200);
  pinMode(CLK, INPUT_PULLUP);
  pinMode(DT, INPUT_PULLUP);
  pinMode(SW, INPUT_PULLUP);
  lastClk = digitalRead(CLK);
}

void loop() {
  int clk = digitalRead(CLK);
  if (clk != lastClk && clk == LOW) {
    counter += (digitalRead(DT) != clk) ? 1 : -1;
    Serial.printf("position:%d\\n", counter);
  }
  lastClk = clk;
  if (digitalRead(SW) == LOW) {
    counter = 0;
    Serial.println("Counter Reset -> 0");
    delay(250);
  }
}`
  },
  {
    id: 'basic-matrix-keypad',
    title: '17. 4x4 Matrix Keypad PIN Lock',
    category: 'Basics & GPIO',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Read a 16-key membrane keypad and verify a 4-digit passcode.',
    parts: ['ESP32', '4x4 Membrane Keypad', 'LED'],
    wiring: [
      { from: 'Rows 1..4', to: 'GPIO 13, 12, 14, 27' },
      { from: 'Cols 1..4', to: 'GPIO 26, 25, 33, 32' }
    ],
    libraries: ['Keypad'],
    baudRate: 115200,
    code: `#include <Keypad.h>

const byte ROWS = 4, COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'}, {'4','5','6','B'},
  {'7','8','9','C'}, {'*','0','#','D'}
};
byte rowPins[ROWS] = {13, 12, 14, 27};
byte colPins[COLS] = {26, 25, 33, 32};
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);
String entered = "";

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  Serial.println("Enter 4-digit PIN (default 1234):");
}

void loop() {
  char k = keypad.getKey();
  if (k) {
    entered += k;
    Serial.print("*");
    if (entered.length() == 4) {
      Serial.println(entered == "1234" ? "\\nUNLOCKED!" : "\\nDENIED!");
      digitalWrite(2, entered == "1234");
      entered = "";
    }
  }
}`
  },
  {
    id: 'basic-shift-register-74hc595',
    title: '18. 74HC595 8-LED Pin Expander',
    category: 'Basics & GPIO',
    difficulty: 'Intermediate',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Control 8 LEDs using only 3 ESP GPIOs via a 74HC595 serial shift register.',
    parts: ['ESP32/ESP8266', '74HC595 IC', '8x LEDs + 220Ω resistors'],
    wiring: [
      { from: 'DS (Data)', to: 'GPIO 23' },
      { from: 'SHCP (Clock)', to: 'GPIO 18' },
      { from: 'STCP (Latch)', to: 'GPIO 5' }
    ],
    libraries: [],
    baudRate: 115200,
    code: `const int DATA = 23, CLOCK = 18, LATCH = 5;

void setup() {
  pinMode(DATA, OUTPUT);
  pinMode(CLOCK, OUTPUT);
  pinMode(LATCH, OUTPUT);
}

void loop() {
  for (int i = 0; i < 8; i++) {
    digitalWrite(LATCH, LOW);
    shiftOut(DATA, CLOCK, MSBFIRST, 1 << i);
    digitalWrite(LATCH, HIGH);
    delay(120);
  }
}`
  },
  {
    id: 'basic-hardware-interrupt',
    title: '19. Hardware Interrupt Pulse Counter',
    category: 'Basics & GPIO',
    difficulty: 'Intermediate',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Count fast pulses reliably using IRAM_ATTR hardware interrupts.',
    parts: ['ESP32/ESP8266', 'Pushbutton or Hall sensor'],
    wiring: [{ from: 'Signal', to: 'GPIO 14', note: 'Triggers on FALLING edge' }],
    libraries: [],
    baudRate: 115200,
    code: `const int INT_PIN = 14;
volatile unsigned long pulseCount = 0;

void IRAM_ATTR onPulse() {
  pulseCount++;
}

void setup() {
  Serial.begin(115200);
  pinMode(INT_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(INT_PIN), onPulse, FALLING);
}

void loop() {
  Serial.printf("pulses:%lu\\n", pulseCount);
  delay(1000);
}`
  },
  {
    id: 'basic-chip-diagnostics',
    title: '20. ESP Chip ID, Flash & Heap Monitor',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Print exact chip model, CPU MHz, Flash size, MAC address, and free RAM.',
    parts: ['Any ESP32 board'],
    wiring: [{ from: 'USB', to: 'Host Computer' }],
    libraries: [],
    baudRate: 115200,
    code: `#include <WiFi.h>

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.printf("Chip Model: %s (Rev %d)\\n", ESP.getChipModel(), ESP.getChipRevision());
  Serial.printf("CPU Cores: %d @ %d MHz\\n", ESP.getChipCores(), ESP.getCpuFreqMHz());
  Serial.printf("Flash Size: %u MB\\n", ESP.getFlashChipSize() / (1024 * 1024));
  Serial.printf("Free Heap: %u bytes\\n", ESP.getFreeHeap());
  Serial.printf("MAC: %s\\n", WiFi.macAddress().c_str());
}

void loop() {
  delay(5000);
}`
  },
  {
    id: 'basic-analog-smoothing',
    title: '21. Moving Average ADC Noise Filter',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Eliminate ADC jitter on analog sensors using a 16-sample rolling buffer.',
    parts: ['ESP32', 'Any analog sensor or potentiometer'],
    wiring: [{ from: 'Analog Out', to: 'GPIO 34' }],
    libraries: [],
    baudRate: 115200,
    code: `const int PIN = 34;
const int SAMPLES = 16;

void setup() {
  Serial.begin(115200);
}

void loop() {
  long sum = 0;
  for (int i = 0; i < SAMPLES; i++) {
    sum += analogRead(PIN);
    delay(5);
  }
  int avg = sum / SAMPLES;
  float volts = avg * (3.3 / 4095.0);
  Serial.printf("avg:%d,volts:%.2f\\n", avg, volts);
  delay(100);
}`
  },
  {
    id: 'basic-digital-dice',
    title: '22. Electronic 6-LED Random Dice',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Press a button to roll a fair 1–6 random number shown on 6 LEDs.',
    parts: ['ESP32', '6x LEDs + 220Ω resistors', 'Pushbutton'],
    wiring: [{ from: 'LEDs 1..6', to: 'GPIO 13,12,14,27,26,25' }, { from: 'Roll Button', to: 'GPIO 4 & GND' }],
    libraries: [],
    baudRate: 115200,
    code: `const int leds[6] = {13, 12, 14, 27, 26, 25};
const int BTN = 4;

void setup() {
  Serial.begin(115200);
  pinMode(BTN, INPUT_PULLUP);
  for (int i = 0; i < 6; i++) pinMode(leds[i], OUTPUT);
  randomSeed(esp_random());
}

void loop() {
  if (digitalRead(BTN) == LOW) {
    int roll = random(1, 7);
    Serial.printf("Rolled: %d\\n", roll);
    for (int i = 0; i < 6; i++) digitalWrite(leds[i], i < roll ? HIGH : LOW);
    delay(400);
  }
}`
  },
  {
    id: 'basic-long-double-click',
    title: '23. Single, Double & Long-Press Button',
    category: 'Basics & GPIO',
    difficulty: 'Intermediate',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Trigger 3 different smart actions from a single physical button.',
    parts: ['ESP32/ESP8266', 'Pushbutton'],
    wiring: [{ from: 'Button', to: 'GPIO 14 & GND' }],
    libraries: [],
    baudRate: 115200,
    code: `const int BTN = 14;
unsigned long pressStart = 0, lastRelease = 0;
int clicks = 0;
bool wasPressed = false;

void setup() {
  Serial.begin(115200);
  pinMode(BTN, INPUT_PULLUP);
}

void loop() {
  bool down = digitalRead(BTN) == LOW;
  if (down && !wasPressed) {
    pressStart = millis();
  } else if (!down && wasPressed) {
    unsigned long dur = millis() - pressStart;
    if (dur >= 800) {
      Serial.println("ACTION: LONG PRESS");
      clicks = 0;
    } else if (dur > 40) {
      clicks++;
      lastRelease = millis();
    }
  }
  if (clicks > 0 && (millis() - lastRelease > 300)) {
    Serial.println(clicks == 1 ? "ACTION: SINGLE CLICK" : "ACTION: DOUBLE CLICK");
    clicks = 0;
  }
  wasPressed = down;
  delay(10);
}`
  },
  {
    id: 'basic-staircase-auto-off',
    title: '24. Staircase Auto-Off Light Timer',
    category: 'Basics & GPIO',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Turn on a hallway light when a button is pressed and auto-shutoff after 10 seconds.',
    parts: ['ESP32/ESP8266', 'Pushbutton', 'LED or Relay'],
    wiring: [{ from: 'Trigger Button', to: 'GPIO 14 & GND' }, { from: 'Light', to: 'GPIO 2' }],
    libraries: [],
    baudRate: 115200,
    code: `const int BTN = 14, LIGHT = 2;
unsigned long offAt = 0;

void setup() {
  Serial.begin(115200);
  pinMode(BTN, INPUT_PULLUP);
  pinMode(LIGHT, OUTPUT);
}

void loop() {
  if (digitalRead(BTN) == LOW) {
    digitalWrite(LIGHT, HIGH);
    offAt = millis() + 10000;
    Serial.println("Light ON for 10s");
    delay(200);
  }
  if (offAt > 0 && millis() > offAt) {
    digitalWrite(LIGHT, LOW);
    offAt = 0;
    Serial.println("Timer expired -> Light OFF");
  }
}`
  }
];
