import { getBoardById } from '../data/boards';
import type { FrameworkId, WiringItem } from '../types/esp';
import { buildPlatformIoIni, detectRequiredLibraries } from './espHelpers';
import { buildZipArchive, type ZipEntryInput } from './zipBuilder';

export interface ProjectBundleInput {
  title: string;
  code: string;
  boardId: string;
  framework: FrameworkId;
  wiring: WiringItem[];
  libraries: string[];
  baudRate: number;
  explanation?: string;
}

export function slugifyProjectTitle(title: string): string {
  return (
    (title || 'rs_esp_project')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 36) || 'rs_esp_project'
  );
}

export function buildWiringMarkdown(input: ProjectBundleInput): string {
  const board = getBoardById(input.boardId);
  const rows =
    input.wiring.length > 0
      ? input.wiring.map((w) => `| ${w.from} | ${w.to} | ${w.note || '-'} |`).join('\n')
      : `| Onboard LED | GPIO ${board.defaultLedPin} | Built-in indicator |`;

  return `# ${input.title} — Wiring Guide

- **Target Board:** ${board.name} (${board.chip}, ${board.architecture})
- **Logic Level:** ${board.logicVoltage} (do not feed 5V signals directly into GPIO pins)
- **Serial Baud:** ${input.baudRate}

| Component Pin | ESP Pin | Notes |
| --- | --- | --- |
${rows}
`;
}

export function buildProjectFiles(input: ProjectBundleInput): ZipEntryInput[] {
  const board = getBoardById(input.boardId);
  const slug = slugifyProjectTitle(input.title);
  const mergedLibs = Array.from(new Set([...input.libraries, ...detectRequiredLibraries(input.code)]));
  const wiringMd = buildWiringMarkdown(input);

  if (input.framework === 'micropython') {
    const bootPy = `# Rs-ESP boot.py — runs once at power-on before main.py\nimport gc\ngc.collect()\n`;
    const readme = `# ${input.title} (MicroPython)\n\nTarget: ${board.name} (${board.chip})\nBaud: ${input.baudRate}\n\n## Upload with Rs-ESP\n1. Flash MicroPython firmware (.bin) once via Upload & Serial -> Flash .bin.\n2. Connect USB in Rs-ESP and click "Upload Code to main.py & Run".\n\n## Upload with mpremote\n\`\`\`bash\nmpremote connect auto fs cp main.py :main.py + reset\n\`\`\`\n`;

    return [
      { path: `${slug}/main.py`, content: input.code },
      { path: `${slug}/boot.py`, content: bootPy },
      { path: `${slug}/wiring.md`, content: wiringMd },
      { path: `${slug}/README.md`, content: readme },
    ];
  }

  if (input.framework === 'espidf') {
    const idfTarget = board.id.includes('s3')
      ? 'esp32s3'
      : board.id.includes('c3')
        ? 'esp32c3'
        : board.id.includes('c6')
          ? 'esp32c6'
          : board.id.includes('s2')
            ? 'esp32s2'
            : board.id.includes('h2')
              ? 'esp32h2'
              : 'esp32';

    const rootCmake = `cmake_minimum_required(VERSION 3.16)\ninclude($ENV{IDF_PATH}/tools/cmake/project.cmake)\nproject(${slug})\n`;
    const mainCmake = `idf_component_register(SRCS "main.c"\n                    INCLUDE_DIRS ".")\n`;
    const readme = `# ${input.title} (ESP-IDF)\n\nTarget: ${board.name} (${idfTarget})\n\n## Build & Flash\n\`\`\`bash\nidf.py set-target ${idfTarget}\nidf.py build flash monitor\n\`\`\`\n`;

    return [
      { path: `${slug}/CMakeLists.txt`, content: rootCmake },
      { path: `${slug}/main/main.c`, content: input.code },
      { path: `${slug}/main/CMakeLists.txt`, content: mainCmake },
      { path: `${slug}/wiring.md`, content: wiringMd },
      { path: `${slug}/README.md`, content: readme },
    ];
  }

  // Arduino C++: includes BOTH PlatformIO (platformio.ini + src/main.cpp) AND Arduino IDE/CLI (<slug>/<slug>.ino)
  const platformioIni = buildPlatformIoIni(board.id, mergedLibs);
  const needsArduinoHeader = !/#include\s*<Arduino\.h>/.test(input.code);
  const mainCpp = needsArduinoHeader ? `#include <Arduino.h>\n\n${input.code}` : input.code;
  const readme = `# ${input.title} (Arduino / PlatformIO)\n\nTarget: ${board.name} (${board.chip})\nSerial Baud: ${input.baudRate}\nRequired Libraries: ${mergedLibs.length > 0 ? mergedLibs.join(', ') : 'Built-in core only'}\n\n## Option 1: PlatformIO\n\`\`\`bash\npio run --target upload\npio device monitor -b ${input.baudRate}\n\`\`\`\n\n## Option 2: Arduino CLI (open arduino_sketch/${slug}/${slug}.ino)\n\`\`\`bash\narduino-cli compile --fqbn ${board.arduinoFqbn} arduino_sketch/${slug}\narduino-cli upload -p /dev/ttyUSB0 --fqbn ${board.arduinoFqbn} arduino_sketch/${slug}\n\`\`\`\n`;

  return [
    { path: `${slug}/platformio.ini`, content: platformioIni },
    { path: `${slug}/src/main.cpp`, content: mainCpp },
    { path: `${slug}/arduino_sketch/${slug}/${slug}.ino`, content: input.code },
    { path: `${slug}/wiring.md`, content: wiringMd },
    { path: `${slug}/README.md`, content: readme },
  ];
}

export function buildProjectZipBundle(input: ProjectBundleInput): {
  filename: string;
  archive: Uint8Array;
  files: ZipEntryInput[];
} {
  const slug = slugifyProjectTitle(input.title);
  const files = buildProjectFiles(input);
  const archive = buildZipArchive(files);
  return {
    filename: `${slug}_rs_esp.zip`,
    archive,
    files,
  };
}
