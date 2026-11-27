import type { EspProject } from '../../types/esp';

export const WIFI_SMARTHOME_PROJECTS: EspProject[] = [
  {
    id: 'wifi-network-scanner',
    title: '49. Wi-Fi Network & RSSI Scanner',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Scan all nearby 2.4 GHz Wi-Fi access points and print SSID, signal dBm, and encryption.',
    parts: ['ESP32 board'],
    wiring: [{ from: 'Onboard Antenna', to: 'Built-in Wi-Fi radio' }],
    libraries: ['WiFi'],
    baudRate: 115200,
    code: `#include <WiFi.h>

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
}

void loop() {
  Serial.println("Scanning Wi-Fi networks...");
  int n = WiFi.scanNetworks();
  for (int i = 0; i < n; i++) {
    Serial.printf("%d: %s (%d dBm) ch%d\\n", i + 1, WiFi.SSID(i).c_str(), WiFi.RSSI(i), WiFi.channel(i));
  }
  delay(5000);
}`
  },
  {
    id: 'wifi-8266-scanner',
    title: '50. ESP8266 Wi-Fi Signal Scanner',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Beginner',
    boards: ['esp8266'],
    recommendedBoardId: 'esp8266-nodemcu',
    framework: 'arduino',
    summary: 'Discover nearby Wi-Fi networks and signal strength using an ESP8266 NodeMCU or D1 Mini.',
    parts: ['ESP8266 NodeMCU / D1 Mini'],
    wiring: [{ from: 'USB', to: 'Host Computer' }],
    libraries: ['ESP8266WiFi'],
    baudRate: 115200,
    code: `#include <ESP8266WiFi.h>

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
}

void loop() {
  int n = WiFi.scanNetworks();
  Serial.printf("Found %d networks:\\n", n);
  for (int i = 0; i < n; i++) {
    Serial.printf(" - %s (%d dBm)\\n", WiFi.SSID(i).c_str(), WiFi.RSSI(i));
  }
  delay(6000);
}`
  },
  {
    id: 'wifi-station-connect',
    title: '51. Wi-Fi Station Auto-Reconnect',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Connect cleanly to your home router, print local IP, and log RSSI quality.',
    parts: ['ESP32 board', 'Wi-Fi Router'],
    wiring: [{ from: 'Built-in LED', to: 'GPIO 2', note: 'Lights up when connected' }],
    libraries: ['WiFi'],
    baudRate: 115200,
    code: `#include <WiFi.h>

const char* SSID = "YOUR_WIFI_SSID";
const char* PASS = "YOUR_WIFI_PASSWORD";

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  WiFi.begin(SSID, PASS);
  Serial.print("Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  digitalWrite(2, HIGH);
  Serial.printf("\\nConnected! IP: %s\\n", WiFi.localIP().toString().c_str());
}

void loop() {
  Serial.printf("rssi:%d\\n", WiFi.RSSI());
  delay(3000);
}`
  },
  {
    id: 'wifi-softap-hotspot',
    title: '52. Standalone SoftAP Wi-Fi Hotspot',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Create a private ESP32 Wi-Fi network without needing an external router.',
    parts: ['ESP32 board', 'Phone or Laptop'],
    wiring: [{ from: 'Wi-Fi Radio', to: 'Access Point Mode' }],
    libraries: ['WiFi'],
    baudRate: 115200,
    code: `#include <WiFi.h>

void setup() {
  Serial.begin(115200);
  WiFi.softAP("Rs-ESP-Hotspot", "12345678");
  Serial.print("AP IP address: ");
  Serial.println(WiFi.softAPIP());
}

void loop() {
  Serial.printf("Connected devices: %d\\n", WiFi.softAPgetStationNum());
  delay(3000);
}`
  },
  {
    id: 'wifi-webserver-led-esp32',
    title: '53. Web Server LED Control (ESP32)',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Host a clean browser control page directly on your ESP32 to toggle GPIO 2.',
    parts: ['ESP32 board'],
    wiring: [{ from: 'Onboard LED', to: 'GPIO 2' }],
    libraries: ['WiFi', 'WebServer'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <WebServer.h>

const char* SSID = "YOUR_WIFI";
const char* PASS = "YOUR_PASS";
WebServer server(80);
bool ledOn = false;

void handleRoot() {
  String html = "<h2>Rs-ESP Control</h2><p>LED is " + String(ledOn ? "ON" : "OFF") +
    "</p><a href='/on'><button>Turn ON</button></a> <a href='/off'><button>Turn OFF</button></a>";
  server.send(200, "text/html", html);
}

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  WiFi.begin(SSID, PASS);
  while (WiFi.status() != WL_CONNECTED) delay(300);
  Serial.println(WiFi.localIP());
  server.on("/", handleRoot);
  server.on("/on", []() { ledOn = true; digitalWrite(2, HIGH); handleRoot(); });
  server.on("/off", []() { ledOn = false; digitalWrite(2, LOW); handleRoot(); });
  server.begin();
}

void loop() { server.handleClient(); }`
  },
  {
    id: 'wifi-webserver-led-esp8266',
    title: '54. Web Server LED Control (ESP8266)',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Beginner',
    boards: ['esp8266'],
    recommendedBoardId: 'esp8266-nodemcu',
    framework: 'arduino',
    summary: 'Control your NodeMCU or Wemos D1 Mini LED from any phone browser.',
    parts: ['ESP8266 NodeMCU / D1 Mini'],
    wiring: [{ from: 'Onboard LED', to: 'GPIO 2 (active LOW)' }],
    libraries: ['ESP8266WiFi', 'ESP8266WebServer'],
    baudRate: 115200,
    code: `#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

ESP8266WebServer server(80);

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  digitalWrite(2, HIGH);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  Serial.println(WiFi.localIP());
  server.on("/", []() {
    server.send(200, "text/html", "<a href='/on'>ON</a> | <a href='/off'>OFF</a>");
  });
  server.on("/on", []() { digitalWrite(2, LOW); server.sendHeader("Location", "/"); server.send(303); });
  server.on("/off", []() { digitalWrite(2, HIGH); server.sendHeader("Location", "/"); server.send(303); });
  server.begin();
}

void loop() { server.handleClient(); }`
  },
  {
    id: 'wifi-json-rest-api',
    title: '55. ESP32 JSON REST API Endpoint',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Serve live ADC sensor readings as a JSON endpoint `/api/status` for dashboards.',
    parts: ['ESP32 board', 'Analog sensor on GPIO 34'],
    wiring: [{ from: 'Sensor', to: 'GPIO 34' }],
    libraries: ['WiFi', 'WebServer'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <WebServer.h>

WebServer server(80);

void setup() {
  Serial.begin(115200);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  server.on("/api/status", []() {
    String json = "{\\"adc\\":" + String(analogRead(34)) +
                  ",\\"rssi\\":" + String(WiFi.RSSI()) +
                  ",\\"uptime\\":" + String(millis() / 1000) + "}";
    server.send(200, "application/json", json);
  });
  server.begin();
  Serial.println(WiFi.localIP());
}

void loop() { server.handleClient(); }`
  },
  {
    id: 'wifi-ntp-clock',
    title: '56. NTP Internet Clock Sync',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Fetch exact atomic internet time via NTP without needing a battery RTC module.',
    parts: ['ESP32 board'],
    wiring: [{ from: 'Wi-Fi', to: 'pool.ntp.org' }],
    libraries: ['WiFi'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <time.h>

void setup() {
  Serial.begin(115200);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  configTime(0, 0, "pool.ntp.org");
}

void loop() {
  struct tm t;
  if (getLocalTime(&t)) {
    Serial.printf("%04d-%02d-%02d %02d:%02d:%02d UTC\\n",
      t.tm_year + 1900, t.tm_mon + 1, t.tm_mday, t.tm_hour, t.tm_min, t.tm_sec);
  }
  delay(1000);
}`
  },
  {
    id: 'wifi-mdns-local',
    title: '57. mDNS Friendly Hostname (.local)',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Reach your ESP32 at http://rs-esp.local instead of typing IP addresses.',
    parts: ['ESP32 board'],
    wiring: [{ from: 'mDNS', to: 'Port 5353 UDP' }],
    libraries: ['WiFi', 'WebServer', 'ESPmDNS'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>

WebServer server(80);

void setup() {
  Serial.begin(115200);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  MDNS.begin("rs-esp");
  server.on("/", []() { server.send(200, "text/plain", "Hello from rs-esp.local!"); });
  server.begin();
  Serial.println("Open http://rs-esp.local");
}

void loop() { server.handleClient(); }`
  },
  {
    id: 'wifi-ota-updates',
    title: '58. ArduinoOTA Wireless Firmware Updates',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Flash new code over Wi-Fi after initial USB upload using ArduinoOTA.',
    parts: ['ESP32 board'],
    wiring: [{ from: 'Wi-Fi OTA', to: 'Port 3232' }],
    libraries: ['WiFi', 'ArduinoOTA'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <ArduinoOTA.h>

void setup() {
  Serial.begin(115200);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  ArduinoOTA.setHostname("rs-esp-ota");
  ArduinoOTA.begin();
  Serial.println("OTA Ready: " + WiFi.localIP().toString());
}

void loop() {
  ArduinoOTA.handle();
}`
  },
  {
    id: 'wifi-http-get-weather',
    title: '59. Open-Meteo Live Weather HTTP Fetch',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Fetch real-time local weather JSON from Open-Meteo API with zero API key.',
    parts: ['ESP32 board'],
    wiring: [{ from: 'HTTPS Client', to: 'api.open-meteo.com' }],
    libraries: ['WiFi', 'HTTPClient'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <HTTPClient.h>

void setup() {
  Serial.begin(115200);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  HTTPClient http;
  http.begin("https://api.open-meteo.com/v1/forecast?latitude=37.77&longitude=-122.42&current_weather=true");
  int code = http.GET();
  if (code > 0) Serial.println(http.getString());
  http.end();
}

void loop() { delay(60000); }`
  },
  {
    id: 'wifi-discord-webhook',
    title: '60. Discord / Slack Door Alert Webhook',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Send an instant chat notification via HTTPS POST when a sensor button triggers.',
    parts: ['ESP32', 'Door reed switch or button on GPIO 14'],
    wiring: [{ from: 'Switch', to: 'GPIO 14 & GND' }],
    libraries: ['WiFi', 'HTTPClient'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <HTTPClient.h>

const char* WEBHOOK = "https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN";

void sendAlert(String msg) {
  HTTPClient http;
  http.begin(WEBHOOK);
  http.addHeader("Content-Type", "application/json");
  http.POST("{\\"content\\":\\"" + msg + "\\"}");
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(14, INPUT_PULLUP);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
}

void loop() {
  if (digitalRead(14) == LOW) {
    sendAlert("Rs-ESP Alert: Door opened!");
    delay(5000);
  }
}`
  },
  {
    id: 'wifi-static-ip',
    title: '61. Fast Static IP Wi-Fi Connection',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Skip DHCP wait times for battery projects by assigning a fixed IP address.',
    parts: ['ESP32 board'],
    wiring: [{ from: 'Wi-Fi', to: 'Static IP 192.168.1.180' }],
    libraries: ['WiFi'],
    baudRate: 115200,
    code: `#include <WiFi.h>

IPAddress localIP(192, 168, 1, 180), gateway(192, 168, 1, 1), subnet(255, 255, 255, 0);

void setup() {
  Serial.begin(115200);
  WiFi.config(localIP, gateway, subnet);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(100);
  Serial.printf("Fast connect IP: %s\\n", WiFi.localIP().toString().c_str());
}
void loop() {}`
  },
  {
    id: 'wifi-captive-portal',
    title: '62. DNS Captive Portal Wi-Fi Setup',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Auto-open a setup webpage when a phone connects to the ESP32 AP hotspot.',
    parts: ['ESP32 board'],
    wiring: [{ from: 'DNSServer', to: 'Port 53' }],
    libraries: ['WiFi', 'DNSServer', 'WebServer'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <DNSServer.h>
#include <WebServer.h>

DNSServer dns;
WebServer server(80);

void setup() {
  WiFi.softAP("Rs-ESP-Setup");
  dns.start(53, "*", WiFi.softAPIP());
  server.onNotFound([]() {
    server.send(200, "text/html", "<h1>Rs-ESP Portal</h1><p>Device Ready</p>");
  });
  server.begin();
}

void loop() {
  dns.processNextRequest();
  server.handleClient();
}`
  },
  {
    id: 'wifi-wol-magic',
    title: '63. Wake-on-LAN PC Remote Starter',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Send a UDP Wake-on-LAN magic packet to boot your desktop PC remotely.',
    parts: ['ESP32', 'Pushbutton on GPIO 14'],
    wiring: [{ from: 'Button', to: 'GPIO 14 & GND' }],
    libraries: ['WiFi', 'WiFiUdp'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <WiFiUdp.h>

WiFiUDP udp;
byte targetMac[6] = {0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF};

void sendWOL() {
  byte pkt[102];
  memset(pkt, 0xFF, 6);
  for (int i = 1; i <= 16; i++) memcpy(&pkt[i * 6], targetMac, 6);
  udp.beginPacket("255.255.255.255", 9);
  udp.write(pkt, 102);
  udp.endPacket();
  Serial.println("WOL Magic Packet Sent!");
}

void setup() {
  Serial.begin(115200);
  pinMode(14, INPUT_PULLUP);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
}

void loop() {
  if (digitalRead(14) == LOW) { sendWOL(); delay(1000); }
}`
  },
  {
    id: 'wifi-micropython-webserver',
    title: '64. MicroPython Socket Web Switch',
    category: 'Wi-Fi & Web Servers',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'micropython',
    summary: 'Zero-dependency MicroPython HTTP server to control GPIO 2 over Wi-Fi.',
    parts: ['ESP32/ESP8266 with MicroPython'],
    wiring: [{ from: 'LED', to: 'GPIO 2' }],
    libraries: [],
    baudRate: 115200,
    code: `import network, socket
from machine import Pin

led = Pin(2, Pin.OUT)
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect("YOUR_WIFI", "YOUR_PASS")
while not wlan.isconnected():
    pass
print("IP:", wlan.ifconfig()[0])

s = socket.socket()
s.bind(("", 80))
s.listen(2)
while True:
    conn, _ = s.accept()
    req = conn.recv(512).decode()
    if "/on" in req: led.value(1)
    if "/off" in req: led.value(0)
    conn.send("HTTP/1.1 200 OK\\r\\nContent-Type: text/html\\r\\n\\r\\n<a href=/on>ON</a> <a href=/off>OFF</a>")
    conn.close()`
  },
  {
    id: 'smarthome-mqtt-publish',
    title: '65. MQTT Sensor Telemetry Publisher',
    category: 'Smart Home & MQTT',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Publish sensor readings every 5 seconds to an MQTT broker.',
    parts: ['ESP32', 'MQTT Broker (Mosquitto / HiveMQ)'],
    wiring: [{ from: 'Analog Sensor', to: 'GPIO 34' }],
    libraries: ['WiFi', 'PubSubClient'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient espClient;
PubSubClient mqtt(espClient);

void setup() {
  Serial.begin(115200);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  mqtt.setServer("broker.hivemq.com", 1883);
}

void loop() {
  if (!mqtt.connected()) mqtt.connect("rs-esp-pub-01");
  mqtt.loop();
  String payload = String(analogRead(34));
  mqtt.publish("rsesp/sensor/adc", payload.c_str());
  Serial.println("Published: " + payload);
  delay(5000);
}`
  },
  {
    id: 'smarthome-mqtt-relay',
    title: '66. MQTT Smart Relay Switch',
    category: 'Smart Home & MQTT',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Subscribe to an MQTT topic to turn a lamp relay ON or OFF from anywhere.',
    parts: ['ESP32', '5V Relay module'],
    wiring: [{ from: 'Relay IN', to: 'GPIO 26' }],
    libraries: ['WiFi', 'PubSubClient'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient net;
PubSubClient mqtt(net);
const int RELAY = 26;

void onMsg(char* topic, byte* payload, unsigned int len) {
  String msg;
  for (unsigned int i = 0; i < len; i++) msg += (char)payload[i];
  digitalWrite(RELAY, msg == "ON" ? HIGH : LOW);
  Serial.println("Relay -> " + msg);
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY, OUTPUT);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  mqtt.setServer("broker.hivemq.com", 1883);
  mqtt.setCallback(onMsg);
  if (mqtt.connect("rs-esp-relay")) mqtt.subscribe("rsesp/relay/cmd");
}

void loop() { mqtt.loop(); }`
  },
  {
    id: 'smarthome-homeassistant-discovery',
    title: '67. Home Assistant MQTT Auto-Discovery',
    category: 'Smart Home & MQTT',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Automatically register an ESP32 switch inside Home Assistant with zero YAML.',
    parts: ['ESP32', 'Home Assistant + Mosquitto'],
    wiring: [{ from: 'Switch Output', to: 'GPIO 2' }],
    libraries: ['WiFi', 'PubSubClient'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient net;
PubSubClient mqtt(net);

void setup() {
  pinMode(2, OUTPUT);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  mqtt.setServer("192.168.1.50", 1883);
  mqtt.setCallback([](char* t, byte* p, unsigned int l) {
    digitalWrite(2, p[1] == 'N' ? HIGH : LOW);
    mqtt.publish("rsesp/light/state", p[1] == 'N' ? "ON" : "OFF");
  });
  if (mqtt.connect("rsesp-ha", "mqtt_user", "mqtt_pass")) {
    mqtt.publish("homeassistant/switch/rsesp_led/config",
      "{\\"name\\":\\"Rs-ESP Light\\",\\"cmd_t\\":\\"rsesp/light/set\\",\\"stat_t\\":\\"rsesp/light/state\\"}", true);
    mqtt.subscribe("rsesp/light/set");
  }
}
void loop() { mqtt.loop(); }`
  },
  {
    id: 'smarthome-4ch-relay-web',
    title: '68. 4-Channel Smart Power Strip Web UI',
    category: 'Smart Home & MQTT',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Control 4 appliances independently from a clean mobile-friendly local web page.',
    parts: ['ESP32', '4-Channel Relay Module'],
    wiring: [{ from: 'IN1..IN4', to: 'GPIO 13, 12, 14, 27' }],
    libraries: ['WiFi', 'WebServer'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <WebServer.h>

int pins[4] = {13, 12, 14, 27};
bool states[4] = {false, false, false, false};
WebServer server(80);

void setup() {
  for (int i = 0; i < 4; i++) pinMode(pins[i], OUTPUT);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  server.on("/", []() {
    String s = "<h2>Rs-ESP 4CH Strip</h2>";
    for (int i = 0; i < 4; i++) {
      s += "<p>CH" + String(i+1) + ": <a href='/t?c=" + String(i) + "'>" + (states[i] ? "ON" : "OFF") + "</a></p>";
    }
    server.send(200, "text/html", s);
  });
  server.on("/t", []() {
    int c = server.arg("c").toInt();
    if (c >= 0 && c < 4) { states[c] = !states[c]; digitalWrite(pins[c], states[c]); }
    server.sendHeader("Location", "/"); server.send(303);
  });
  server.begin();
}
void loop() { server.handleClient(); }`
  },
  {
    id: 'smarthome-auto-plant-pump',
    title: '69. Automated Smart Plant Watering Pump',
    category: 'Smart Home & MQTT',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Read soil moisture and run a 5V water pump relay briefly only when soil is dry.',
    parts: ['ESP32', 'Capacitive Soil Sensor', 'Relay + 5V Pump'],
    wiring: [{ from: 'Soil AOUT', to: 'GPIO 34' }, { from: 'Pump Relay', to: 'GPIO 26' }],
    libraries: [],
    baudRate: 115200,
    code: `const int SOIL = 34, PUMP = 26;

void setup() {
  Serial.begin(115200);
  pinMode(PUMP, OUTPUT);
}

void loop() {
  int val = analogRead(SOIL);
  Serial.printf("soil:%d\\n", val);
  if (val > 2700) {
    Serial.println("Dry soil -> watering 3s");
    digitalWrite(PUMP, HIGH);
    delay(3000);
    digitalWrite(PUMP, LOW);
  }
  delay(60000);
}`
  },
  {
    id: 'smarthome-telegram-alert',
    title: '70. Telegram Bot Sensor & LED Controller',
    category: 'Smart Home & MQTT',
    difficulty: 'Intermediate',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Send `/led_on` or `/status` to your ESP32 directly from Telegram chat.',
    parts: ['ESP32 board', 'Telegram Bot Token'],
    wiring: [{ from: 'Built-in LED', to: 'GPIO 2' }],
    libraries: ['WiFi', 'WiFiClientSecure', 'UniversalTelegramBot'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <UniversalTelegramBot.h>

WiFiClientSecure secured;
UniversalTelegramBot bot("YOUR_BOT_TOKEN", secured);

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  secured.setInsecure();
}

void loop() {
  int n = bot.getUpdates(bot.last_message_received + 1);
  for (int i = 0; i < n; i++) {
    String txt = bot.messages[i].text;
    String cid = bot.messages[i].chat_id;
    if (txt == "/on") { digitalWrite(2, HIGH); bot.sendMessage(cid, "LED ON", ""); }
    if (txt == "/off") { digitalWrite(2, LOW); bot.sendMessage(cid, "LED OFF", ""); }
  }
  delay(1500);
}`
  },
  {
    id: 'smarthome-thingspeak-logger',
    title: '71. ThingSpeak Cloud Chart Data Logger',
    category: 'Smart Home & MQTT',
    difficulty: 'Beginner',
    boards: ['esp32'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Upload temperature or analog metrics to a free ThingSpeak cloud dashboard every 20s.',
    parts: ['ESP32', 'Analog sensor on GPIO 34'],
    wiring: [{ from: 'Sensor', to: 'GPIO 34' }],
    libraries: ['WiFi', 'HTTPClient'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <HTTPClient.h>

const char* API_KEY = "YOUR_THINGSPEAK_WRITE_KEY";

void setup() {
  Serial.begin(115200);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
}

void loop() {
  HTTPClient http;
  String url = String("http://api.thingspeak.com/update?api_key=") + API_KEY + "&field1=" + analogRead(34);
  http.begin(url);
  Serial.printf("HTTP %d\\n", http.GET());
  http.end();
  delay(20000);
}`
  },
  {
    id: 'smarthome-garage-ultrasonic',
    title: '72. Smart Garage Door Open/Closed Monitor',
    category: 'Smart Home & MQTT',
    difficulty: 'Beginner',
    boards: ['esp32', 'esp8266'],
    recommendedBoardId: 'esp32-devkit-v1',
    framework: 'arduino',
    summary: 'Detect whether a garage door is open or shut using a reed switch + status webpage.',
    parts: ['ESP32', 'Magnetic Door Reed Switch'],
    wiring: [{ from: 'Reed Switch', to: 'GPIO 14 & GND' }],
    libraries: ['WiFi', 'WebServer'],
    baudRate: 115200,
    code: `#include <WiFi.h>
#include <WebServer.h>
WebServer server(80);

void setup() {
  pinMode(14, INPUT_PULLUP);
  WiFi.begin("YOUR_WIFI", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  server.on("/", []() {
    bool closed = digitalRead(14) == LOW;
    server.send(200, "text/plain", closed ? "Garage: CLOSED" : "Garage: OPEN!");
  });
  server.begin();
}
void loop() { server.handleClient(); }`
  }
];
