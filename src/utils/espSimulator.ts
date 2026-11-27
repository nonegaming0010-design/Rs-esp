import { getBoardById } from '../data/boards';

export interface SimCommandResponse {
  lines: string[];
  ledState?: boolean;
}

export function processVirtualEspCommand(
  command: string,
  boardId: string,
  currentLed: boolean
): SimCommandResponse {
  const board = getBoardById(boardId);
  const raw = command.trim();
  const cmd = raw.toLowerCase();

  if (!cmd) return { lines: [] };

  if (cmd === 'help' || cmd === '?') {
    return {
      lines: [
        `[Sim ${board.shortName}] Available commands: help, status, chip, wifi scan, gpio on, gpio off, sensor, reboot`,
      ],
    };
  }

  if (cmd === 'at') {
    return { lines: ['OK'] };
  }

  if (cmd === 'chip' || cmd === 'info') {
    return {
      lines: [
        `Chip: ${board.chip} (${board.architecture})`,
        `Clock: ${board.clockMhz} MHz | Flash: ${board.flashMb} | SRAM: ${board.sramKb} KB`,
        `Default I2C: SDA=GPIO${board.defaultI2c.sda}, SCL=GPIO${board.defaultI2c.scl}`,
      ],
    };
  }

  if (cmd === 'status') {
    return {
      lines: [
        `Board=${board.shortName}, LED(GPIO${board.defaultLedPin})=${currentLed ? 'HIGH' : 'LOW'}, WiFi=Connected(192.168.1.142), RSSI=-54dBm`,
      ],
    };
  }

  if (cmd === 'gpio on' || cmd === 'on' || cmd === 'led on') {
    return {
      ledState: true,
      lines: [`GPIO${board.defaultLedPin} -> HIGH (LED ON)`],
    };
  }

  if (cmd === 'gpio off' || cmd === 'off' || cmd === 'led off') {
    return {
      ledState: false,
      lines: [`GPIO${board.defaultLedPin} -> LOW (LED OFF)`],
    };
  }

  if (cmd === 'wifi scan') {
    return {
      lines: [
        'Scanning 2.4 GHz channels...',
        '1: LabBench_24G (-48 dBm) ch1 [WPA2]',
        '2: Workshop_IoT (-63 dBm) ch6 [WPA2]',
        '3: Guest_WiFi (-79 dBm) ch11 [OPEN]',
      ],
    };
  }

  if (cmd === 'sensor') {
    const temp = (23.5 + (Math.random() * 2 - 1)).toFixed(1);
    const hum = (54.0 + (Math.random() * 4 - 2)).toFixed(1);
    return {
      lines: [`temp:${temp},humidity:${hum}`],
    };
  }

  if (cmd === 'reboot' || cmd === 'reset') {
    return {
      lines: [
        `ets Jul 29 2019 12:21:46`,
        `rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)`,
        `[Sim ${board.shortName}] Boot complete @ ${board.defaultSerialBaud} baud.`,
      ],
    };
  }

  return {
    lines: [`Echo: "${raw}" (type "help" for virtual board commands)`],
  };
}

export function processVirtualEspHexBytes(
  bytes: Uint8Array,
  boardId: string,
  currentLed: boolean
): { rawFrames: Uint8Array[]; textLines: string[]; ledState?: boolean } {
  const decoded = new TextDecoder().decode(bytes).trim();
  const isAsciiCommand =
    bytes.every((b) => (b >= 32 && b <= 126) || b === 10 || b === 13) &&
    ['help', 'status', 'chip', 'sensor', 'at', 'gpio on', 'gpio off', 'wifi scan', 'reboot'].includes(
      decoded.toLowerCase()
    );

  if (isAsciiCommand) {
    const res = processVirtualEspCommand(decoded, boardId, currentLed);
    const enc = new TextEncoder();
    return {
      rawFrames: res.lines.map((l) => enc.encode(l + '\n')),
      textLines: res.lines,
      ledState: res.ledState,
    };
  }

  // Binary UART / Modbus-style echo response with checksum byte
  const sum = bytes.reduce((acc, b) => (acc + b) & 0xff, 0);
  const ackFrame = new Uint8Array([0xaa, 0x55, bytes.length & 0xff, ...Array.from(bytes.slice(0, 8)), sum]);
  const hexPreview = Array.from(ackFrame)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
  return {
    rawFrames: [ackFrame],
    textLines: [`Binary ACK (${ackFrame.length}B): ${hexPreview}`],
  };
}

