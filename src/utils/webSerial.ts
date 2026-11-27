import { ESPLoader, Transport } from 'esptool-js';
import type { IEspLoaderTerminal } from 'esptool-js';

export type LineEnding = '\n' | '\r' | '\r\n' | '';

export interface WebSerialCapabilities {
  supported: boolean;
  reason?: string;
}

export function checkWebSerialSupport(): WebSerialCapabilities {
  if (typeof navigator === 'undefined') {
    return { supported: false, reason: 'Browser environment unavailable.' };
  }
  if (!('serial' in navigator)) {
    return {
      supported: false,
      reason: 'Web Serial API is not supported in this browser. Use desktop Chrome, Edge, or Opera over HTTPS or localhost.',
    };
  }
  return { supported: true };
}

export interface SerialPortSession {
  port: SerialPort;
  baudRate: number;
  close: () => Promise<void>;
  writeText: (text: string) => Promise<void>;
  writeBytes: (bytes: Uint8Array) => Promise<void>;
  pulseReset: () => Promise<void>;
  enterBootloader: () => Promise<void>;
}

export async function requestEspSerialPort(): Promise<SerialPort> {
  const cap = checkWebSerialSupport();
  if (!cap.supported) {
    throw new Error(cap.reason);
  }
  return navigator.serial.requestPort();
}

export async function findAuthorizedEspPort(targetInfo?: {
  usbVendorId?: number;
  usbProductId?: number;
}): Promise<SerialPort | null> {
  const cap = checkWebSerialSupport();
  if (!cap.supported) return null;
  try {
    const ports = await navigator.serial.getPorts();
    if (ports.length === 0) return null;
    if (targetInfo?.usbVendorId !== undefined) {
      const exact = ports.find((p) => {
        const info = p.getInfo();
        return (
          info.usbVendorId === targetInfo.usbVendorId &&
          (targetInfo.usbProductId === undefined || info.usbProductId === targetInfo.usbProductId)
        );
      });
      if (exact) return exact;
    }
    return ports[0] ?? null;
  } catch {
    return null;
  }
}

export async function openSerialMonitorSession(
  port: SerialPort,
  baudRate: number,
  onData: (chunk: string, rawBytes: Uint8Array) => void,
  onError: (msg: string) => void,
  onUnexpectedDisconnect?: () => void
): Promise<SerialPortSession> {
  if (!port.readable && !port.writable) {
    await port.open({ baudRate });
  }

  let keepReading = true;
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  if (port.readable) {
    reader = port.readable.getReader();

    (async () => {
      try {
        while (keepReading && reader) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value && value.length > 0) {
            const decoded = decoder.decode(value, { stream: true });
            onData(decoded, value);
          }
        }
        if (keepReading) {
          onUnexpectedDisconnect?.();
        }
      } catch (err) {
        if (keepReading) {
          onError(err instanceof Error ? err.message : 'Serial connection interrupted');
          onUnexpectedDisconnect?.();
        }
      } finally {
        try {
          reader?.releaseLock();
        } catch {
          // ignore lock errors
        }
      }
    })();
  }

  const encoder = new TextEncoder();

  const writeBytes = async (bytes: Uint8Array) => {
    if (!port.writable) throw new Error('Serial port is not writable');
    const writer = port.writable.getWriter();
    try {
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
  };

  return {
    port,
    baudRate,
    writeText: async (text: string) => writeBytes(encoder.encode(text)),
    writeBytes,
    pulseReset: async () => {
      await port.setSignals({ dataTerminalReady: false, requestToSend: true });
      await new Promise((r) => setTimeout(r, 120));
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    },
    enterBootloader: async () => {
      await port.setSignals({ dataTerminalReady: false, requestToSend: true });
      await new Promise((r) => setTimeout(r, 100));
      await port.setSignals({ dataTerminalReady: true, requestToSend: false });
      await new Promise((r) => setTimeout(r, 120));
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    },
    close: async () => {
      keepReading = false;
      try {
        await reader?.cancel();
      } catch {
        // ignore cancel errors
      }
      try {
        await port.close();
      } catch {
        // ignore if already closed
      }
    },
  };
}

export async function flashFirmwareBinary(options: {
  port: SerialPort;
  baudRate: number;
  files: Array<{ data: Uint8Array; address: number }>;
  eraseAll: boolean;
  onLog: (line: string) => void;
  onProgress: (percent: number, written: number, total: number) => void;
}): Promise<{ chipName: string }> {
  const { port, baudRate, files, eraseAll, onLog, onProgress } = options;

  // Ensure port is closed before Transport takes ownership
  if (port.readable || port.writable) {
    try {
      await port.close();
    } catch {
      // ignore
    }
  }

  const transport = new Transport(port, true);
  const terminal: IEspLoaderTerminal = {
    clean: () => {},
    writeLine: (data: string) => onLog(data),
    write: (data: string) => {
      if (data.trim()) onLog(data.trimEnd());
    },
  };

  try {
    const loader = new ESPLoader({
      transport,
      baudrate: baudRate,
      romBaudrate: 115200,
      terminal,
    });

    onLog(`Connecting to ESP ROM bootloader at ${baudRate} baud...`);
    const chipName = await loader.main('default_reset');
    onLog(`Detected chip: ${chipName}`);

    await loader.writeFlash({
      fileArray: files,
      flashSize: 'keep',
      flashMode: 'keep',
      flashFreq: 'keep',
      eraseAll,
      compress: true,
      reportProgress: (_fileIndex: number, written: number, total: number) => {
        const pct = total > 0 ? Math.min(100, Math.round((written / total) * 100)) : 0;
        onProgress(pct, written, total);
      },
    });

    onLog('Flash complete! Resetting chip into user firmware...');
    await loader.after('hard_reset');
    return { chipName };
  } finally {
    try {
      await transport.disconnect();
    } catch {
      // ignore disconnect errors
    }
  }
}

export async function uploadMicroPythonScript(options: {
  session: SerialPortSession;
  code: string;
  filename?: string;
  onLog: (line: string) => void;
}): Promise<void> {
  const { session, code, filename = 'main.py', onLog } = options;
  onLog(`Interrupting running script (Ctrl+C) and entering MicroPython Raw REPL...`);
  await session.writeText('\x03\x03');
  await new Promise((r) => setTimeout(r, 150));
  await session.writeText('\x01'); // Enter Raw REPL
  await new Promise((r) => setTimeout(r, 150));

  const escaped = JSON.stringify(code);
  const pyCmd = `with open(${JSON.stringify(filename)}, "w") as f:\n    f.write(${escaped})\n`;
  await session.writeText(pyCmd + '\x04'); // Execute in raw REPL
  await new Promise((r) => setTimeout(r, 300));

  onLog(`Saved ${filename} (${code.length} bytes). Soft-rebooting board (Ctrl+B, Ctrl+D)...`);
  await session.writeText('\x02'); // Exit raw REPL
  await new Promise((r) => setTimeout(r, 100));
  await session.writeText('\x04'); // Soft reboot to run main.py
}
