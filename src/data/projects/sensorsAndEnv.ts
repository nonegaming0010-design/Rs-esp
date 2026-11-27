import type { EspProject } from '../../types/esp';

export const SENSORS_ENV_PROJECTS: EspProject[] = [
  {
    id: 'sensor-dht11',
    title: '25. DHT11 Temperature & Humidity Logger',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Read room temperature and humidity from a budget DHT11 sensor for Serial Plotter.',
    parts: ['ESP32/ESP8266', 'DHT11 module', '3 jumper wires'],
    wiring: [{ from: 'VCC', to: '3.3V' }, { from: 'DATA', to: 'GPIO 4' }, { from: 'GND', to: 'GND' }],
    libraries: ['DHT sensor library', 'Adafruit Unified Sensor'],
    baudRate: 115200,
    code: `#include <DHT.h>
#define DHTPIN 4
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();
}

void loop() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) {
    Serial.println("Failed to read DHT11!");
  } else {
    Serial.printf("temp:%.1f,humidity:%.1f\\n", t, h);
  }
  delay(2000);
}`
  },
  {
    id: 'sensor-dht22',
    title: '26. DHT22 Precision Climate Monitor',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Measure temperature (°C/°F), humidity, and heat index with DHT22.',
    parts: ['ESP32/ESP8266', 'DHT22 (AM2302)', '10kΩ pull-up resistor'],
    wiring: [{ from: 'VCC', to: '3.3V' }, { from: 'DATA', to: 'GPIO 4' }, { from: 'GND', to: 'GND' }],
    libraries: ['DHT sensor library', 'Adafruit Unified Sensor'],
    baudRate: 115200,
    code: `#include <DHT.h>
DHT dht(4, DHT22);

void setup() {
  Serial.begin(115200);
  dht.begin();
}

void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t) && !isnan(h)) {
    float hi = dht.computeHeatIndex(t, h, false);
    Serial.printf("temp:%.2f,humidity:%.2f,heatIndex:%.2f\\n", t, h, hi);
  }
  delay(2000);
}`
  },
  {
    id: 'sensor-bme280',
    title: '27. BME280 Weather Station (I2C)',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Read temperature, humidity, barometric pressure, and estimated altitude via I2C.',
    parts: ['ESP32/ESP8266', 'BME280 I2C breakout'],
    wiring: [{ from: 'SDA', to: 'GPIO 21 (D2 on 8266)' }, { from: 'SCL', to: 'GPIO 22 (D1 on 8266)' }, { from: 'VCC/GND', to: '3.3V / GND' }],
    libraries: ['Adafruit BME280 Library', 'Adafruit Unified Sensor'],
    baudRate: 115200,
    code: `#include <Wire.h>
#include <Adafruit_BME280.h>

Adafruit_BME280 bme;

void setup() {
  Serial.begin(115200);
  if (!bme.begin(0x76)) {
    Serial.println("BME280 not found at 0x76!");
    while (1) delay(100);
  }
}

void loop() {
  Serial.printf("temp:%.2f,hum:%.2f,pressure:%.1f\\n",
    bme.readTemperature(), bme.readHumidity(), bme.readPressure() / 100.0F);
  delay(2000);
}`
  },
  {
    id: 'sensor-bmp280',
    title: '28. BMP280 Altitude & Pressure Sensor',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Track barometric pressure trends and relative elevation with BMP280.',
    parts: ['ESP32', 'BMP280 I2C sensor'],
    wiring: [{ from: 'SDA', to: 'GPIO 21' }, { from: 'SCL', to: 'GPIO 22' }, { from: 'VCC', to: '3.3V' }],
    libraries: ['Adafruit BMP280 Library'],
    baudRate: 115200,
    code: `#include <Wire.h>
#include <Adafruit_BMP280.h>

Adafruit_BMP280 bmp;

void setup() {
  Serial.begin(115200);
  if (!bmp.begin(0x76)) {
    Serial.println("BMP280 missing!");
    while (1) delay(100);
  }
}

void loop() {
  Serial.printf("temp:%.2f,hpa:%.1f,alt:%.1f\\n",
    bmp.readTemperature(), bmp.readPressure() / 100.0F, bmp.readAltitude(1013.25));
  delay(1500);
}`
  },
  {
    id: 'sensor-ds18b20',
    title: '29. DS18B20 Waterproof Aquarium Probe',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Measure liquid or outdoor temperatures via 1-Wire DS18B20 stainless probe.',
    parts: ['ESP32/ESP8266', 'DS18B20 probe', '4.7kΩ pull-up resistor'],
    wiring: [{ from: 'Data (Yellow)', to: 'GPIO 4 (+4.7kΩ to 3.3V)' }, { from: 'VCC (Red)', to: '3.3V' }, { from: 'GND (Black)', to: 'GND' }],
    libraries: ['OneWire', 'DallasTemperature'],
    baudRate: 115200,
    code: `#include <OneWire.h>
#include <DallasTemperature.h>

OneWire oneWire(4);
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(115200);
  sensors.begin();
}

void loop() {
  sensors.requestTemperatures();
  float c = sensors.getTempCByIndex(0);
  Serial.printf("waterTempC:%.2f\\n", c);
  delay(1500);
}`
  },
  {
    id: 'sensor-hcsr04-ultrasonic',
    title: '30. HC-SR04 Ultrasonic Distance Meter',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Measure obstacle distance in centimeters using sound echo timing.',
    parts: ['ESP32', 'HC-SR04 sensor (or RCWL-1601 3.3V)'],
    wiring: [{ from: 'TRIG', to: 'GPIO 5' }, { from: 'ECHO', to: 'GPIO 18 (use voltage divider if 5V)' }, { from: 'VCC', to: '5V/VIN' }],
    libraries: [],
    baudRate: 115200,
    code: `const int TRIG = 5, ECHO = 18;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
  digitalWrite(TRIG, LOW); delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long duration = pulseIn(ECHO, HIGH, 30000);
  float cm = duration * 0.0343 / 2.0;
  Serial.printf("distanceCm:%.1f\\n", cm);
  delay(200);
}`
  },
  {
    id: 'sensor-vl53l0x-tof',
    title: '31. VL53L0X Laser Time-of-Flight Ranging',
    category: 'Sensors & Environment',
    difficulty: 'Intermediate',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Millimeter-accurate invisible laser distance measurement up to 2 meters.',
    parts: ['ESP32', 'VL53L0X module'],
    wiring: [{ from: 'SDA/SCL', to: 'GPIO 21 / 22' }, { from: 'VIN/GND', to: '3.3V / GND' }],
    libraries: ['Adafruit_VL53L0X'],
    baudRate: 115200,
    code: `#include <Adafruit_VL53L0X.h>
Adafruit_VL53L0X lox = Adafruit_VL53L0X();

void setup() {
  Serial.begin(115200);
  if (!lox.begin()) { Serial.println("VL53L0X error"); while (1); }
}

void loop() {
  VL53L0X_RangingMeasurementData_t m;
  lox.rangingTest(&m, false);
  if (m.RangeStatus != 4) Serial.printf("rangeMm:%d\\n", m.RangeMilliMeter);
  delay(100);
}`
  },
  {
    id: 'sensor-pir-motion',
    title: '32. HC-SR501 PIR Motion Security Sensor',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Trigger an alert LED and log timestamps whenever warm body motion is detected.',
    parts: ['ESP32', 'HC-SR501 PIR sensor'],
    wiring: [{ from: 'OUT', to: 'GPIO 13' }, { from: 'VCC', to: '5V/VIN' }, { from: 'GND', to: 'GND' }],
    libraries: [],
    baudRate: 115200,
    code: `const int PIR_PIN = 13, LED_PIN = 2;

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  bool motion = digitalRead(PIR_PIN) == HIGH;
  digitalWrite(LED_PIN, motion);
  if (motion) Serial.println("MOTION DETECTED!");
  delay(200);
}`
  },
  {
    id: 'sensor-rcwl0516-radar',
    title: '33. RCWL-0516 Doppler Radar Presence',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Detect movement through plastic enclosures or drywall using microwave radar.',
    parts: ['ESP32', 'RCWL-0516 module'],
    wiring: [{ from: 'OUT', to: 'GPIO 13' }, { from: 'VIN', to: '5V' }, { from: 'GND', to: 'GND' }],
    libraries: [],
    baudRate: 115200,
    code: `const int RADAR = 13;
void setup() {
  Serial.begin(115200);
  pinMode(RADAR, INPUT);
  pinMode(2, OUTPUT);
}
void loop() {
  int v = digitalRead(RADAR);
  digitalWrite(2, v);
  Serial.printf("radar:%d\\n", v);
  delay(150);
}`
  },
  {
    id: 'sensor-ldr-nightlight',
    title: '34. LDR Automatic Dusk-to-Dawn Nightlight',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Measure ambient room light with a photoresistor and switch an LED on in the dark.',
    parts: ['ESP32', 'LDR photoresistor', '10kΩ resistor'],
    wiring: [{ from: 'LDR+10k Divider', to: 'GPIO 34' }, { from: 'LED', to: 'GPIO 2' }],
    libraries: [],
    baudRate: 115200,
    code: `const int LDR = 34, LED = 2;

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
}

void loop() {
  int light = analogRead(LDR);
  digitalWrite(LED, light < 1200 ? HIGH : LOW);
  Serial.printf("light:%d\\n", light);
  delay(250);
}`
  },
  {
    id: 'sensor-bh1750-lux',
    title: '35. BH1750 Digital Lux Meter',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Measure exact calibrated illuminance in Lux over I2C.',
    parts: ['ESP32', 'BH1750 module'],
    wiring: [{ from: 'SDA/SCL', to: 'GPIO 21 / 22' }, { from: 'VCC', to: '3.3V' }],
    libraries: ['BH1750'],
    baudRate: 115200,
    code: `#include <Wire.h>
#include <BH1750.h>

BH1750 lightMeter;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  lightMeter.begin();
}

void loop() {
  float lux = lightMeter.readLightLevel();
  Serial.printf("lux:%.1f\\n", lux);
  delay(500);
}`
  },
  {
    id: 'sensor-soil-moisture',
    title: '36. Capacitive Soil Moisture Plant Alert',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Monitor potted plant moisture percentage and warn when soil dries out.',
    parts: ['ESP32', 'Capacitive Soil Moisture v1.2'],
    wiring: [{ from: 'AOUT', to: 'GPIO 34' }, { from: 'VCC', to: '3.3V' }, { from: 'GND', to: 'GND' }],
    libraries: [],
    baudRate: 115200,
    code: `const int SOIL_PIN = 34;
const int AIR_VAL = 3200;
const int WATER_VAL = 1400;

void setup() {
  Serial.begin(115200);
}

void loop() {
  int raw = analogRead(SOIL_PIN);
  int pct = constrain(map(raw, AIR_VAL, WATER_VAL, 0, 100), 0, 100);
  Serial.printf("raw:%d,moisturePct:%d\\n", raw, pct);
  if (pct < 25) Serial.println("ALERT: Water your plant!");
  delay(2000);
}`
  },
  {
    id: 'sensor-raindrop',
    title: '37. Raindrop Weather Plate Detector',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Detect rain intensity on an analog/digital rain sensor board.',
    parts: ['ESP32', 'Raindrop sensor module'],
    wiring: [{ from: 'AO', to: 'GPIO 34' }, { from: 'DO', to: 'GPIO 14' }, { from: 'VCC', to: '3.3V' }],
    libraries: [],
    baudRate: 115200,
    code: `void setup() {
  Serial.begin(115200);
  pinMode(14, INPUT);
}

void loop() {
  int analogVal = analogRead(34);
  bool raining = digitalRead(14) == LOW;
  Serial.printf("rainAnalog:%d,raining:%d\\n", analogVal, raining ? 1 : 0);
  delay(1000);
}`
  },
  {
    id: 'sensor-mq2-gas',
    title: '38. MQ-2 Smoke & LPG Gas Alarm',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Monitor combustible gas/smoke levels and sound an alert when threshold exceeds safe limits.',
    parts: ['ESP32', 'MQ-2 Gas Sensor', '10k/20k divider if 5V AO', 'Buzzer'],
    wiring: [{ from: 'AO (scaled <=3.3V)', to: 'GPIO 34' }, { from: 'Buzzer', to: 'GPIO 25' }],
    libraries: [],
    baudRate: 115200,
    code: `const int GAS_PIN = 34, BUZZER = 25;

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER, OUTPUT);
}

void loop() {
  int gas = analogRead(GAS_PIN);
  Serial.printf("gasLevel:%d\\n", gas);
  digitalWrite(BUZZER, gas > 2000 ? HIGH : LOW);
  delay(500);
}`
  },
  {
    id: 'sensor-mq135-aqi',
    title: '39. MQ-135 Indoor Air Quality Index',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Track indoor VOC/CO2 trend changes over time via Serial Plotter.',
    parts: ['ESP32', 'MQ-135 Air Quality module'],
    wiring: [{ from: 'AO (3.3V scaled)', to: 'GPIO 35' }],
    libraries: [],
    baudRate: 115200,
    code: `void setup() { Serial.begin(115200); }
void loop() {
  int air = analogRead(35);
  Serial.printf("airQuality:%d\\n", air);
  delay(1000);
}`
  },
  {
    id: 'sensor-mpu6050-imu',
    title: '40. MPU6050 6-Axis Accelerometer & Gyro',
    category: 'Sensors & Environment',
    difficulty: 'Intermediate',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Stream real-time X/Y/Z acceleration and gyro orientation to Serial Plotter.',
    parts: ['ESP32', 'MPU6050 GY-521 module'],
    wiring: [{ from: 'SDA/SCL', to: 'GPIO 21 / 22' }, { from: 'VCC', to: '3.3V' }],
    libraries: ['Adafruit MPU6050', 'Adafruit Unified Sensor'],
    baudRate: 115200,
    code: `#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>

Adafruit_MPU6050 mpu;

void setup() {
  Serial.begin(115200);
  if (!mpu.begin()) { Serial.println("MPU6050 not found"); while (1) delay(10); }
}

void loop() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  Serial.printf("ax:%.2f,ay:%.2f,az:%.2f\\n", a.acceleration.x, a.acceleration.y, a.acceleration.z);
  delay(80);
}`
  },
  {
    id: 'sensor-tilt-vibration',
    title: '41. SW-420 Vibration & Earthquake Sensor',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Detect physical knocks, washing machine cycles, or vibration events.',
    parts: ['ESP32', 'SW-420 Vibration module'],
    wiring: [{ from: 'DO', to: 'GPIO 14' }, { from: 'VCC', to: '3.3V' }],
    libraries: [],
    baudRate: 115200,
    code: `void setup() {
  Serial.begin(115200);
  pinMode(14, INPUT);
  pinMode(2, OUTPUT);
}
void loop() {
  int hit = digitalRead(14);
  digitalWrite(2, hit);
  if (hit == HIGH) Serial.println("VIBRATION EVENT!");
  delay(50);
}`
  },
  {
    id: 'sensor-water-level-float',
    title: '42. Water Tank Level & Overflow Alarm',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Use a non-contact float switch to prevent sump or aquarium overflow.',
    parts: ['ESP32', 'Magnetic float switch', 'LED/Buzzer'],
    wiring: [{ from: 'Float Switch', to: 'GPIO 14 & GND' }, { from: 'Alarm', to: 'GPIO 2' }],
    libraries: [],
    baudRate: 115200,
    code: `void setup() {
  Serial.begin(115200);
  pinMode(14, INPUT_PULLUP);
  pinMode(2, OUTPUT);
}
void loop() {
  bool full = digitalRead(14) == LOW;
  digitalWrite(2, full);
  Serial.println(full ? "TANK FULL" : "Tank Normal");
  delay(1000);
}`
  },
  {
    id: 'sensor-yf-s201-flow',
    title: '43. YF-S201 Water Flow Rate Meter',
    category: 'Sensors & Environment',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Calculate Liters/Minute using interrupt pulses from a Hall-effect water flow turbine.',
    parts: ['ESP32', 'YF-S201 Flow Sensor'],
    wiring: [{ from: 'Signal (Yellow)', to: 'GPIO 14' }, { from: 'VCC', to: '5V' }],
    libraries: [],
    baudRate: 115200,
    code: `volatile int flowPulses = 0;
void IRAM_ATTR pulseISR() { flowPulses++; }

void setup() {
  Serial.begin(115200);
  pinMode(14, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(14), pulseISR, RISING);
}

void loop() {
  flowPulses = 0;
  delay(1000);
  float lpm = flowPulses / 7.5;
  Serial.printf("flowLPM:%.2f\\n", lpm);
}`
  },
  {
    id: 'sensor-ina219-power',
    title: '44. INA219 DC Voltage, Current & Watt Meter',
    category: 'Sensors & Environment',
    difficulty: 'Intermediate',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Measure solar panel or battery voltage, mA draw, and milliwatts over I2C.',
    parts: ['ESP32', 'INA219 breakout'],
    wiring: [{ from: 'SDA/SCL', to: 'GPIO 21 / 22' }, { from: 'VCC', to: '3.3V' }],
    libraries: ['Adafruit INA219'],
    baudRate: 115200,
    code: `#include <Wire.h>
#include <Adafruit_INA219.h>
Adafruit_INA219 ina219;

void setup() {
  Serial.begin(115200);
  if (!ina219.begin()) { Serial.println("INA219 missing"); while (1); }
}

void loop() {
  float v = ina219.getBusVoltage_V();
  float ma = ina219.getCurrent_mA();
  Serial.printf("volts:%.2f,currentMa:%.1f\\n", v, ma);
  delay(1000);
}`
  },
  {
    id: 'sensor-acs712-current',
    title: '45. ACS712 Hall Current Sensor Reader',
    category: 'Sensors & Environment',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Sample load current draw and display smoothed Amps on Serial Monitor.',
    parts: ['ESP32', 'ACS712 5A/20A module (with voltage divider to 3.3V)'],
    wiring: [{ from: 'OUT (scaled <=3.3V)', to: 'GPIO 34' }],
    libraries: [],
    baudRate: 115200,
    code: `void setup() { Serial.begin(115200); }
void loop() {
  long sum = 0;
  for (int i = 0; i < 50; i++) { sum += analogRead(34); delay(2); }
  float mv = (sum / 50.0) * (3300.0 / 4095.0);
  float amps = (mv - 1650.0) / 185.0;
  Serial.printf("amps:%.2f\\n", amps);
  delay(300);
}`
  },
  {
    id: 'sensor-max30102-pulse',
    title: '46. MAX30102 Heartbeat Finger Detector',
    category: 'Sensors & Environment',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Read infrared PPG waveform from a finger pulse oximeter module.',
    parts: ['ESP32', 'MAX30102 breakout'],
    wiring: [{ from: 'SDA/SCL', to: 'GPIO 21 / 22' }, { from: 'VIN', to: '3.3V' }],
    libraries: ['SparkFun MAX3010x Pulse and Proximity Sensor Library'],
    baudRate: 115200,
    code: `#include <Wire.h>
#include "MAX30105.h"
MAX30105 particleSensor;

void setup() {
  Serial.begin(115200);
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30102 not found"); while (1);
  }
  particleSensor.setup();
}

void loop() {
  long ir = particleSensor.getIR();
  Serial.printf("irSignal:%ld\\n", ir);
  delay(40);
}`
  },
  {
    id: 'sensor-hx711-scale',
    title: '47. HX711 Digital Load Cell Kitchen Scale',
    category: 'Sensors & Environment',
    difficulty: 'Intermediate',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Read weight in grams from a 5kg load cell and HX711 24-bit ADC.',
    parts: ['ESP32', 'Load Cell + HX711 module'],
    wiring: [{ from: 'DT', to: 'GPIO 16' }, { from: 'SCK', to: 'GPIO 4' }, { from: 'VCC', to: '3.3V' }],
    libraries: ['HX711'],
    baudRate: 115200,
    code: `#include "HX711.h"
HX711 scale;

void setup() {
  Serial.begin(115200);
  scale.begin(16, 4);
  scale.set_scale(420.0); // Calibrate with known weight
  scale.tare();
}

void loop() {
  Serial.printf("grams:%.1f\\n", scale.get_units(5));
  delay(500);
}`
  },
  {
    id: 'sensor-ky038-sound',
    title: '48. Clap Switch Sound Peak Detector',
    category: 'Sensors & Environment',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Toggle an LED on and off by clapping near a sound sensor microphone.',
    parts: ['ESP32', 'KY-037 / KY-038 Sound Sensor'],
    wiring: [{ from: 'DO', to: 'GPIO 14' }, { from: 'VCC', to: '3.3V' }],
    libraries: [],
    baudRate: 115200,
    code: `const int MIC = 14, LED = 2;
bool state = false;

void setup() {
  Serial.begin(115200);
  pinMode(MIC, INPUT);
  pinMode(LED, OUTPUT);
}

void loop() {
  if (digitalRead(MIC) == HIGH) {
    state = !state;
    digitalWrite(LED, state);
    Serial.printf("Clap detected! LED -> %s\\n", state ? "ON" : "OFF");
    delay(350);
  }
}`
  }
];
