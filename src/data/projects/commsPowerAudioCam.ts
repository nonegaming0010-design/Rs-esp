import type { EspProject } from '../../types/esp';

export const COMMS_POWER_AUDIO_CAM_PROJECTS: EspProject[] = [
  {
    id: 'ble-beacon-scanner',
    title: '97. BLE Nearby Device & Beacon Scanner',
    category: 'Bluetooth & ESP-NOW',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Scan surrounding Bluetooth Low Energy devices, fitness bands, and iBeacons.',
    parts: ['ESP32 board'],
    wiring: [{ from: 'BLE Radio', to: 'Built-in 2.4GHz antenna' }],
    libraries: ['BLEDevice', 'BLEScan'],
    baudRate: 115200,
    code: `#include <BLEDevice.h>
#include <BLEScan.h>

BLEScan* pScan;

void setup() {
  Serial.begin(115200);
  BLEDevice::init("");
  pScan = BLEDevice::getScan();
  pScan->setActiveScan(true);
}

void loop() {
  BLEScanResults* res = pScan->start(4, false);
  Serial.printf("BLE Devices found: %d\\n", res->getCount());
  for (int i = 0; i < res->getCount(); i++) {
    BLEAdvertisedDevice dev = res->getDevice(i);
    Serial.printf(" - %s (%d dBm)\\n", dev.getAddress().toString().c_str(), dev.getRSSI());
  }
  pScan->clearResults();
  delay(3000);
}`
  },
  {
    id: 'ble-uart-server',
    title: '98. BLE Phone-to-ESP32 Wireless Terminal',
    category: 'Bluetooth & ESP-NOW',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Send text commands from a phone BLE app (nRF Connect) to control ESP32 pins.',
    parts: ['ESP32 board', 'Smartphone with nRF Connect'],
    wiring: [{ from: 'Onboard LED', to: 'GPIO 2' }],
    libraries: ['BLEDevice', 'BLEServer'],
    baudRate: 115200,
    code: `#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>

#define SVC_UUID "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define RX_UUID  "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"

class RxCb : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    String val = c->getValue().c_str();
    Serial.println("BLE RX: " + val);
    digitalWrite(2, val.indexOf("ON") >= 0 ? HIGH : LOW);
  }
};

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  BLEDevice::init("Rs-ESP-BLE");
  BLEServer* srv = BLEDevice::createServer();
  BLEService* svc = srv->createService(SVC_UUID);
  BLECharacteristic* rx = svc->createCharacteristic(RX_UUID, BLECharacteristic::PROPERTY_WRITE);
  rx->setCallbacks(new RxCb());
  svc->start();
  BLEDevice::getAdvertising()->start();
}
void loop() { delay(1000); }`
  },
  {
    id: 'ble-classic-serial-bt',
    title: '99. Classic Bluetooth Serial Bridge',
    category: 'Bluetooth & ESP-NOW',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Pair with your Android phone or PC via Bluetooth SPP without Wi-Fi.',
    parts: ['ESP32 DevKit v1 (Classic BT)'],
    wiring: [{ from: 'Onboard LED', to: 'GPIO 2' }],
    libraries: ['BluetoothSerial'],
    baudRate: 115200,
    code: `#include "BluetoothSerial.h"
BluetoothSerial SerialBT;

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  SerialBT.begin("Rs-ESP-BT");
  Serial.println("Bluetooth Ready! Pair with Rs-ESP-BT");
}

void loop() {
  if (SerialBT.available()) {
    char ch = SerialBT.read();
    digitalWrite(2, ch == '1' ? HIGH : LOW);
    SerialBT.printf("Echo: %c\\n", ch);
  }
}`
  },
  {
    id: 'espnow-sender',
    title: '100. ESP-NOW Ultra-Low-Latency Wireless Sender',
    category: 'Bluetooth & ESP-NOW',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Broadcast sensor packets between two ESP32 boards with no Wi-Fi router needed.',
    parts: ['2x ESP32 boards'],
    wiring: [{ from: 'Sensor', to: 'GPIO 34' }],
    libraries: ['esp_now', 'WiFi'],
    baudRate: 115200,
    code: `#include <esp_now.h>
#include <WiFi.h>

uint8_t peerMac[] = {0xFF,0xFF,0xFF,0xFF,0xFF,0xFF};
typedef struct { int value; } Packet;
Packet pkt;

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  esp_now_init();
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, peerMac, 6);
  esp_now_add_peer(&peer);
}

void loop() {
  pkt.value = analogRead(34);
  esp_now_send(peerMac, (uint8_t*)&pkt, sizeof(pkt));
  Serial.printf("Sent ESP-NOW value: %d\\n", pkt.value);
  delay(1000);
}`
  },
  {
    id: 'espnow-receiver',
    title: '101. ESP-NOW Wireless Packet Receiver',
    category: 'Bluetooth & ESP-NOW',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Receive ESP-NOW packets from another ESP32 and print data to Serial Monitor.',
    parts: ['ESP32 board'],
    wiring: [{ from: 'Onboard LED', to: 'GPIO 2' }],
    libraries: ['esp_now', 'WiFi'],
    baudRate: 115200,
    code: `#include <esp_now.h>
#include <WiFi.h>

typedef struct { int value; } Packet;

void onRecv(const esp_now_recv_info* info, const uint8_t* data, int len) {
  Packet pkt;
  memcpy(&pkt, data, sizeof(pkt));
  Serial.printf("ESP-NOW RX: %d\\n", pkt.value);
  digitalWrite(2, pkt.value > 2000);
}

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  WiFi.mode(WIFI_STA);
  esp_now_init();
  esp_now_register_recv_cb(onRecv);
}
void loop() {}`
  },
  {
    id: 'ble-hid-keyboard-s3',
    title: '102. ESP32-S3 Native USB Macro Keyboard',
    category: 'Bluetooth & ESP-NOW',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-s3',
    framework: 'arduino',
    summary: 'Turn an ESP32-S3 or S2 into a physical USB-C shortcut macro pad.',
    parts: ['ESP32-S3 or ESP32-S2', 'Pushbutton on GPIO 0'],
    wiring: [{ from: 'BOOT Button', to: 'GPIO 0' }],
    libraries: ['USB', 'USBHIDKeyboard'],
    baudRate: 115200,
    code: `#include "USB.h"
#include "USBHIDKeyboard.h"
USBHIDKeyboard Keyboard;

void setup() {
  pinMode(0, INPUT_PULLUP);
  Keyboard.begin();
  USB.begin();
}

void loop() {
  if (digitalRead(0) == LOW) {
    Keyboard.print("Hello from Rs-ESP!");
    delay(600);
  }
}`
  },
  {
    id: 'audio-active-buzzer-siren',
    title: '103. Active Buzzer Police & Alert Siren',
    category: 'Audio, Buzzers & IR',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Sound double-beep and rapid alarm patterns on a 3.3V active buzzer.',
    parts: ['ESP32', 'Active Buzzer module'],
    wiring: [{ from: 'Buzzer (+)', to: 'GPIO 25' }, { from: 'Buzzer (-)', to: 'GND' }],
    libraries: [],
    baudRate: 115200,
    code: `const int BUZ = 25;
void setup() { pinMode(BUZ, OUTPUT); }
void loop() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZ, HIGH); delay(120);
    digitalWrite(BUZ, LOW);  delay(120);
  }
  delay(1200);
}`
  },
  {
    id: 'audio-passive-buzzer-melody',
    title: '104. Passive Buzzer Musical Melody Player',
    category: 'Audio, Buzzers & IR',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Play musical notes (C4–C5 scale) using PWM tone frequencies on a passive piezo.',
    parts: ['ESP32', 'Passive Piezo Buzzer'],
    wiring: [{ from: 'Signal', to: 'GPIO 25' }, { from: 'GND', to: 'GND' }],
    libraries: [],
    baudRate: 115200,
    code: `const int BUZ = 25;
int notes[] = {262, 294, 330, 349, 392, 440, 494, 523};

void setup() {}
void loop() {
  for (int i = 0; i < 8; i++) {
    tone(BUZ, notes[i], 220);
    delay(280);
  }
  noTone(BUZ);
  delay(1500);
}`
  },
  {
    id: 'audio-doorbell-chime',
    title: '105. Two-Tone Ding-Dong Smart Doorbell',
    category: 'Audio, Buzzers & IR',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Play a pleasant two-tone doorbell chime whenever a porch button is pressed.',
    parts: ['ESP32', 'Passive Buzzer', 'Pushbutton'],
    wiring: [{ from: 'Button', to: 'GPIO 14 & GND' }, { from: 'Buzzer', to: 'GPIO 25' }],
    libraries: [],
    baudRate: 115200,
    code: `const int BTN = 14, BUZ = 25;
void setup() { pinMode(BTN, INPUT_PULLUP); }
void loop() {
  if (digitalRead(BTN) == LOW) {
    tone(BUZ, 659, 300); delay(320);
    tone(BUZ, 523, 550); delay(600);
    noTone(BUZ);
  }
}`
  },
  {
    id: 'audio-ir-receiver-decode',
    title: '106. IR TV Remote Button Code Decoder',
    category: 'Audio, Buzzers & IR',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Capture hex button codes from any household IR remote in the Serial Monitor.',
    parts: ['ESP32', 'VS1838B / KY-022 IR Receiver', 'Any TV Remote'],
    wiring: [{ from: 'OUT', to: 'GPIO 15' }, { from: 'VCC', to: '3.3V' }],
    libraries: ['IRremote'],
    baudRate: 115200,
    code: `#include <IRremote.hpp>

void setup() {
  Serial.begin(115200);
  IrReceiver.begin(15, ENABLE_LED_FEEDBACK);
}

void loop() {
  if (IrReceiver.decode()) {
    Serial.printf("IR Hex: 0x%lX\\n", IrReceiver.decodedIRData.decodedRawData);
    IrReceiver.resume();
  }
}`
  },
  {
    id: 'audio-ir-blaster-send',
    title: '107. Universal IR TV Power Blaster',
    category: 'Audio, Buzzers & IR',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Transmit NEC infrared remote signals from an IR LED on button press.',
    parts: ['ESP32', '940nm IR LED + 100Ω resistor', 'Pushbutton'],
    wiring: [{ from: 'IR LED (+)', to: 'GPIO 4' }, { from: 'Button', to: 'GPIO 14 & GND' }],
    libraries: ['IRremote'],
    baudRate: 115200,
    code: `#include <IRremote.hpp>

void setup() {
  pinMode(14, INPUT_PULLUP);
  IrSender.begin(4);
}

void loop() {
  if (digitalRead(14) == LOW) {
    IrSender.sendNEC(0x00FF, 0x01, 0);
    delay(600);
  }
}`
  },
  {
    id: 'audio-dfplayer-mp3',
    title: '108. DFPlayer Mini MP3 Sound Effects Player',
    category: 'Audio, Buzzers & IR',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Play voice alerts or MP3 tracks from a microSD card via UART2.',
    parts: ['ESP32', 'DFPlayer Mini', 'Speaker + MicroSD'],
    wiring: [{ from: 'DF TX', to: 'GPIO 16 (RX2)' }, { from: 'DF RX', to: 'GPIO 17 (TX2 via 1kΩ)' }],
    libraries: ['DFRobotDFPlayerMini'],
    baudRate: 115200,
    code: `#include <DFRobotDFPlayerMini.h>
DFRobotDFPlayerMini mp3;

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, 16, 17);
  if (mp3.begin(Serial2)) {
    mp3.volume(20);
    mp3.play(1);
    Serial.println("Playing Track 0001.mp3");
  }
}
void loop() {}`
  },
  {
    id: 'audio-dac-sine-wave',
    title: '109. ESP32 Hardware DAC Pure Tone Generator',
    category: 'Audio, Buzzers & IR',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Generate smooth analog sine audio waveforms on GPIO 25 using ESP32 internal DAC.',
    parts: ['ESP32 DevKit v1', 'Small amplified speaker or oscilloscope'],
    wiring: [{ from: 'DAC1 Audio Out', to: 'GPIO 25' }],
    libraries: [],
    baudRate: 115200,
    code: `#include <math.h>
void setup() {}
void loop() {
  for (int deg = 0; deg < 360; deg += 15) {
    int val = 128 + (int)(120 * sin(deg * PI / 180.0));
    dacWrite(25, val);
    delayMicroseconds(100);
  }
}`
  },
  {
    id: 'power-deepsleep-timer-esp32',
    title: '110. ESP32 Deep Sleep Timer (Battery Saver)',
    category: 'Power & Deep Sleep',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Wake up every 30 seconds, print boot counter from RTC RAM, and sleep at ~10 µA.',
    parts: ['ESP32 board'],
    wiring: [{ from: 'RTC Memory', to: 'Preserved across deep sleep' }],
    libraries: [],
    baudRate: 115200,
    code: `RTC_DATA_ATTR int bootCount = 0;

void setup() {
  Serial.begin(115200);
  bootCount++;
  Serial.printf("Boot #%d — doing quick work...\\n", bootCount);
  delay(500);
  Serial.println("Entering Deep Sleep for 30s");
  esp_sleep_enable_timer_wakeup(30ULL * 1000000ULL);
  esp_deep_sleep_start();
}
void loop() {}`
  },
  {
    id: 'power-deepsleep-ext0-button',
    title: '111. Deep Sleep Wake on Button Press (EXT0)',
    category: 'Power & Deep Sleep',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Keep ESP32 asleep indefinitely until a door sensor or button pulls GPIO 33 LOW.',
    parts: ['ESP32', 'Pushbutton / Reed Switch', '10kΩ pull-up'],
    wiring: [{ from: 'Wake Pin', to: 'GPIO 33 (RTC GPIO)' }],
    libraries: [],
    baudRate: 115200,
    code: `void setup() {
  Serial.begin(115200);
  Serial.println("Woke up from external trigger!");
  delay(2000);
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_33, 0);
  Serial.println("Going to sleep until GPIO33 == LOW");
  esp_deep_sleep_start();
}
void loop() {}`
  },
  {
    id: 'power-deepsleep-esp8266',
    title: '112. ESP8266 Deep Sleep Wake Cycle',
    category: 'Power & Deep Sleep',
    difficulty: 'Beginner',
    boards: ['esp8266'],
    recommendedBoardId: 'esp8266-nodemcu',
    framework: 'arduino',
    summary: 'Sleep an ESP8266 for 60 seconds and wake automatically via D0 -> RST wire.',
    parts: ['ESP8266 NodeMCU / D1 Mini', '1 jumper wire from D0 to RST'],
    wiring: [{ from: 'D0 (GPIO 16)', to: 'RST', note: 'Remove wire when flashing!' }],
    libraries: ['ESP8266WiFi'],
    baudRate: 115200,
    code: `void setup() {
  Serial.begin(115200);
  Serial.println("\\nESP8266 Awake! Reading sensor...");
  delay(500);
  Serial.println("Sleeping 60s...");
  ESP.deepSleep(60e6);
}
void loop() {}`
  },
  {
    id: 'power-lipo-battery-monitor',
    title: '113. LiPo Battery Percentage Monitor',
    category: 'Power & Deep Sleep',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Measure a 3.7V–4.2V LiPo battery safely via a 100kΩ/100kΩ voltage divider.',
    parts: ['ESP32', '2x 100kΩ resistors', '3.7V LiPo Battery'],
    wiring: [{ from: 'Divider Midpoint', to: 'GPIO 35' }, { from: 'BAT+', to: 'Top 100kΩ' }],
    libraries: [],
    baudRate: 115200,
    code: `void setup() { Serial.begin(115200); }

void loop() {
  int raw = analogRead(35);
  float v = (raw / 4095.0) * 3.3 * 2.0; // 2:1 divider
  int pct = constrain(map((int)(v * 100), 330, 420, 0, 100), 0, 100);
  Serial.printf("batVolts:%.2f,batPct:%d\\n", v, pct);
  delay(2000);
}`
  },
  {
    id: 'power-cpu-freq-scaler',
    title: '114. Dynamic CPU Clock Power Optimizer',
    category: 'Power & Deep Sleep',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Drop ESP32 clock from 240 MHz down to 80 MHz to cut active power consumption.',
    parts: ['ESP32 board'],
    wiring: [{ from: 'Internal PLL', to: '80 MHz / 240 MHz' }],
    libraries: [],
    baudRate: 115200,
    code: `void setup() {
  Serial.begin(115200);
  setCpuFrequencyMhz(80);
  Serial.printf("CPU Clock reduced to: %u MHz\\n", getCpuFrequencyMhz());
}
void loop() { delay(5000); }`
  },
  {
    id: 'power-micropython-deepsleep',
    title: '115. MicroPython Deep Sleep Sensor Node',
    category: 'Power & Deep Sleep',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'micropython',
    summary: 'Read ADC once and immediately enter 15-second MicroPython deep sleep.',
    parts: ['ESP32 (MicroPython)'],
    wiring: [{ from: 'Sensor', to: 'GPIO 34' }],
    libraries: [],
    baudRate: 115200,
    code: `import machine, time
from machine import ADC, Pin

adc = ADC(Pin(34))
adc.atten(ADC.ATTN_11DB)
print("Sample:", adc.read())
time.sleep(0.5)
machine.deepsleep(15000)`
  },
  {
    id: 'cam-esp32cam-flash-blink',
    title: '116. ESP32-CAM High-Power Flash & LED Test',
    category: 'Camera & Storage',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-cam',
    framework: 'arduino',
    summary: 'Verify your ESP32-CAM board flashes and runs properly using GPIO 4 and GPIO 33.',
    parts: ['ESP32-CAM AI-Thinker', 'FTDI / ESP32-CAM-MB'],
    wiring: [{ from: 'Flash LED', to: 'GPIO 4' }, { from: 'Red Indicator', to: 'GPIO 33 (active LOW)' }],
    libraries: [],
    baudRate: 115200,
    code: `#define FLASH_PIN 4
#define RED_LED 33

void setup() {
  Serial.begin(115200);
  pinMode(FLASH_PIN, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  Serial.println("ESP32-CAM Ready!");
}

void loop() {
  digitalWrite(RED_LED, LOW);
  analogWrite(FLASH_PIN, 25); // Soft glow
  delay(500);
  digitalWrite(RED_LED, HIGH);
  analogWrite(FLASH_PIN, 0);
  delay(1500);
}`
  },
  {
    id: 'cam-esp32cam-web-snapshot',
    title: '117. ESP32-CAM Wi-Fi Snapshot Web Server',
    category: 'Camera & Storage',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-cam',
    framework: 'arduino',
    summary: 'Capture JPEG photos over HTTP at /capture.jpg from an AI-Thinker ESP32-CAM.',
    parts: ['ESP32-CAM AI-Thinker (OV2640)'],
    wiring: [{ from: 'OV2640 Camera', to: 'Onboard Ribbon Connector' }],
    libraries: ['esp_camera', 'WiFi', 'WebServer'],
    baudRate: 115200,
    code: `#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>

WebServer server(80);

void setup() {
  Serial.begin(115200);
  camera_config_t cfg = {};
  cfg.pin_pwdn = 32; cfg.pin_reset = -1; cfg.pin_xclk = 0;
  cfg.pin_sccb_sda = 26; cfg.pin_sccb_scl = 27;
  cfg.pin_d7 = 35; cfg.pin_d6 = 34; cfg.pin_d5 = 39; cfg.pin_d4 = 36;
  cfg.pin_d3 = 21; cfg.pin_d2 = 19; cfg.pin_d1 = 18; cfg.pin_d0 = 5;
  cfg.pin_vsync = 25; cfg.pin_href = 23; cfg.pin_pclk = 22;
  cfg.xclk_freq_hz = 20000000; cfg.pixel_format = PIXFORMAT_JPEG;
  cfg.frame_size = FRAMESIZE_VGA; cfg.jpeg_quality = 12; cfg.fb_count = 1;
  esp_camera_init(&cfg);

  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  server.on("/capture.jpg", []() {
    camera_fb_t* fb = esp_camera_fb_get();
    if (fb) { server.send_P(200, "image/jpeg", (const char*)fb->buf, fb->len); esp_camera_fb_return(fb); }
  });
  server.begin();
  Serial.println("Open http://" + WiFi.localIP().toString() + "/capture.jpg");
}
void loop() { server.handleClient(); }`
  },
  {
    id: 'storage-sd-csv-logger',
    title: '118. MicroSD Card CSV Sensor Logger',
    category: 'Camera & Storage',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Append timestamped sensor data rows to /log.csv on an SPI MicroSD card.',
    parts: ['ESP32', 'SPI MicroSD Card Module'],
    wiring: [{ from: 'CS/MOSI/MISO/SCK', to: 'GPIO 5, 23, 19, 18' }],
    libraries: ['SD', 'SPI'],
    baudRate: 115200,
    code: `#include <SD.h>
#include <SPI.h>

void setup() {
  Serial.begin(115200);
  if (!SD.begin(5)) { Serial.println("SD Mount Failed!"); return; }
  Serial.println("SD Card Ready");
}

void loop() {
  File f = SD.open("/log.csv", FILE_APPEND);
  if (f) {
    f.printf("%lu,%d\\n", millis(), analogRead(34));
    f.close();
    Serial.println("Row logged to /log.csv");
  }
  delay(5000);
}`
  },
  {
    id: 'storage-nvs-preferences',
    title: '119. NVS Preferences Permanent Boot Counter',
    category: 'Camera & Storage',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Store Wi-Fi credentials or boot counts permanently in ESP32 Flash NVS.',
    parts: ['ESP32 board'],
    wiring: [{ from: 'Internal Flash NVS', to: 'Built-in' }],
    libraries: ['Preferences'],
    baudRate: 115200,
    code: `#include <Preferences.h>
Preferences prefs;

void setup() {
  Serial.begin(115200);
  prefs.begin("rs-esp", false);
  unsigned int boots = prefs.getUInt("boots", 0) + 1;
  prefs.putUInt("boots", boots);
  Serial.printf("Total power-ons saved in Flash: %u\\n", boots);
  prefs.end();
}
void loop() {}`
  },
  {
    id: 'storage-littlefs-json-config',
    title: '120. LittleFS Internal Flash File Writer',
    category: 'Camera & Storage',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Save and read JSON configuration files directly inside ESP32/ESP8266 flash memory.',
    parts: ['ESP32 or ESP8266'],
    wiring: [{ from: 'LittleFS Partition', to: 'Internal Flash' }],
    libraries: ['LittleFS'],
    baudRate: 115200,
    code: `#include <LittleFS.h>

void setup() {
  Serial.begin(115200);
  LittleFS.begin(true);
  File w = LittleFS.open("/config.json", "w");
  w.print("{\\"device\\":\\"Rs-ESP\\",\\"interval\\":5}");
  w.close();

  File r = LittleFS.open("/config.json", "r");
  Serial.println("Stored config: " + r.readString());
  r.close();
}
void loop() {}`
  }
];
