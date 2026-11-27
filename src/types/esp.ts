export type BoardFamily = 'esp32' | 'esp8266';

export type FrameworkId = 'arduino' | 'micropython' | 'espidf';

export type PinCapability =
  | 'GPIO'
  | 'PWM'
  | 'ADC1'
  | 'ADC2'
  | 'DAC'
  | 'TOUCH'
  | 'I2C_SDA'
  | 'I2C_SCL'
  | 'SPI_MOSI'
  | 'SPI_MISO'
  | 'SPI_SCK'
  | 'SPI_CS'
  | 'UART_TX'
  | 'UART_RX'
  | 'INPUT_ONLY'
  | 'FLASH_SPI';

export interface PinSpec {
  gpio: number;
  label: string;
  side: 'left' | 'right';
  capabilities: PinCapability[];
  notes?: string;
  warning?: string;
  isStrapping?: boolean;
  isInputOnly?: boolean;
  isInternalFlash?: boolean;
  isAdc2?: boolean;
}

export interface EspBoard {
  id: string;
  name: string;
  shortName: string;
  family: BoardFamily;
  chip: string;
  architecture: string;
  clockMhz: number;
  flashMb: string;
  sramKb: number;
  logicVoltage: '3.3V';
  connectivity: string[];
  defaultLedPin: number;
  defaultI2c: { sda: number; scl: number };
  defaultSpi: { mosi: number; miso: number; sck: number; cs: number };
  defaultSerialBaud: number;
  defaultUploadBaud: number;
  flashAppOffset: string;
  platformioBoard: string;
  platformioPlatform: string;
  arduinoFqbn: string;
  nativeUsb: boolean;
  bootloaderTip: string;
  summary: string;
  pins: PinSpec[];
}

export interface WiringItem {
  from: string;
  to: string;
  note?: string;
}

export type ProjectCategory =
  | 'Basics & GPIO'
  | 'Sensors & Environment'
  | 'Wi-Fi & Web Servers'
  | 'Smart Home & MQTT'
  | 'Displays & OLED'
  | 'Motors, Servos & Relays'
  | 'Bluetooth & ESP-NOW'
  | 'Audio, Buzzers & IR'
  | 'Power & Deep Sleep'
  | 'Camera & Storage';

export type DifficultyLevel = 'Beginner' | 'Intermediate';

export interface EspProject {
  id: string;
  title: string;
  category: ProjectCategory;
  difficulty: DifficultyLevel;
  boards: BoardFamily[];
  recommendedBoardId: string;
  framework: FrameworkId;
  summary: string;
  parts: string[];
  wiring: WiringItem[];
  libraries: string[];
  baudRate: number;
  code: string;
}

export interface GpioWarning {
  gpio: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface SerialLogEntry {
  id: string;
  timestamp: string;
  direction: 'rx' | 'tx' | 'system' | 'error';
  text: string;
  rawBytes?: number[];
}

export interface PlotPoint {
  index: number;
  series: Record<string, number>;
}

export interface AiGeneratedResult {
  title: string;
  code: string;
  explanation: string;
  wiring: WiringItem[];
  libraries: string[];
  baudRate: number;
  warnings: string[];
}

export interface SavedSketch {
  id: string;
  title: string;
  boardId: string;
  framework: FrameworkId;
  code: string;
  explanation: string;
  wiring: WiringItem[];
  libraries: string[];
  baudRate: number;
  updatedAt: string;
}

export interface WorkspaceDraft {
  boardId: string;
  framework: FrameworkId;
  title: string;
  code: string;
  explanation: string;
  wiring: WiringItem[];
  libraries: string[];
  baudRate: number;
  isDark: boolean;
  updatedAt: string;
}

export type CloudSketchVisibility = 'public' | 'private';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
}

export interface CloudSketch {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  title: string;
  summary: string;
  code: string;
  boardId: string;
  boardName: string;
  framework: FrameworkId;
  visibility: CloudSketchVisibility;
  tags: string[];
  libraries: string[];
  wiring: WiringItem[];
  baudRate: number;
  likesCount: number;
  featured?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CloudComment {
  id: string;
  sketchId: string;
  sketchVisibility: 'public';
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  body: string;
  createdAtMs: number;
}

