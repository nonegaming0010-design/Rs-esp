import { jsPDF } from 'jspdf';
import type { EspBoard, FrameworkId, GpioWarning, WiringItem } from '../types/esp';
import { analyzeCircuitFor3d, type Circuit3dAnalysis } from './circuit3dModel';
import { buildPlatformIoIni, detectRequiredLibraries, validateGpioUsage } from './espHelpers';

export interface DatasheetPayload {
  filename: string;
  title: string;
  board: EspBoard;
  framework: FrameworkId;
  frameworkLabel: string;
  baudRate: number;
  explanation: string;
  libraries: string[];
  platformIoIni: string;
  gpioWarnings: GpioWarning[];
  wiringRows: Array<{ component: string; espPin: string; notes: string; colorHex: string }>;
  circuit3d: Circuit3dAnalysis;
  codeLines: string[];
  generatedAtIso: string;
}

export interface BuildDatasheetParams {
  title: string;
  board: EspBoard;
  framework: FrameworkId;
  code: string;
  explanation: string;
  wiring: WiringItem[];
  libraries: string[];
  baudRate: number;
}

const FRAMEWORK_LABELS: Record<FrameworkId, string> = {
  arduino: 'Arduino C++',
  micropython: 'MicroPython',
  espidf: 'ESP-IDF (FreeRTOS)',
};

function sanitizeSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'rs_esp_project'
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [15, 118, 110];
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function buildDatasheetPayload(params: BuildDatasheetParams): DatasheetPayload {
  const mergedLibs = Array.from(
    new Set([...params.libraries, ...detectRequiredLibraries(params.code)])
  );
  const circuit3d = analyzeCircuitFor3d(
    params.board,
    params.code,
    params.wiring,
    params.framework
  );
  const gpioWarnings = validateGpioUsage(params.board.id, params.code);
  const platformIoIni = buildPlatformIoIni(params.board.id, mergedLibs);

  const wiringRows =
    params.wiring.length > 0
      ? params.wiring.map((row, idx) => {
          const matchedWire = circuit3d.wires[idx];
          return {
            component: row.from,
            espPin: row.to,
            notes: row.note || '—',
            colorHex: matchedWire?.colorHex ?? '#0f766e',
          };
        })
      : [
          {
            component: 'Onboard LED',
            espPin: `GPIO ${params.board.defaultLedPin}`,
            notes: `Built-in board indicator (${params.board.shortName})`,
            colorHex: '#2563eb',
          },
        ];

  return {
    filename: `${sanitizeSlug(params.title)}_datasheet.pdf`,
    title: params.title.trim() || 'Rs-ESP Firmware Project',
    board: params.board,
    framework: params.framework,
    frameworkLabel: FRAMEWORK_LABELS[params.framework],
    baudRate: params.baudRate || 115200,
    explanation: params.explanation.trim() || 'Custom ESP firmware built in Rs-ESP Workbench.',
    libraries: mergedLibs,
    platformIoIni,
    gpioWarnings,
    wiringRows,
    circuit3d,
    codeLines: params.code.replace(/\r\n/g, '\n').split('\n'),
    generatedAtIso: new Date().toISOString().slice(0, 10),
  };
}

export function generateTechnicalDatasheetPdf(params: BuildDatasheetParams): {
  filename: string;
  pageCount: number;
} {
  const data = buildDatasheetPayload(params);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - 16) {
      doc.addPage();
      y = margin;
    }
  };

  // 1. Technical Header Banner
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, contentW, 24, 2, 2, 'F');
  doc.setTextColor(94, 234, 212);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('RS-ESP HARDWARE & FIRMWARE TECHNICAL DATASHEET', margin + 5, y + 6.5);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  const titleText = doc.splitTextToSize(data.title, contentW - 44)[0] || data.title;
  doc.text(titleText, margin + 5, y + 14);

  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `${data.board.shortName} (${data.board.chip}) · ${data.frameworkLabel} · ${data.baudRate} baud · ${data.generatedAtIso}`,
    margin + 5,
    y + 20
  );
  y += 29;

  // 2. Specs & Summary Grid
  doc.setFillColor(245, 245, 244);
  doc.setDrawColor(214, 211, 209);
  const summaryLines = doc.splitTextToSize(data.explanation, contentW - 8);
  const summaryBoxH = 12 + summaryLines.length * 4.2;
  doc.roundedRect(margin, y, contentW, summaryBoxH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(28, 25, 23);
  doc.text('1. Architecture & Summary', margin + 4, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(68, 64, 60);
  doc.text(summaryLines, margin + 4, y + 10.5);
  y += summaryBoxH + 5;

  // 3. Vector Wiring Schematic Diagram
  const components = data.circuit3d.components;
  const wires = data.circuit3d.wires;
  const diagramHeight = Math.max(46, Math.min(86, 18 + Math.max(wires.length, components.length * 3) * 6.5));
  ensureSpace(diagramHeight + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(28, 25, 23);
  doc.text('2. Schematic Wiring Diagram', margin, y);
  y += 3;

  doc.setFillColor(250, 250, 249);
  doc.setDrawColor(214, 211, 209);
  doc.roundedRect(margin, y, contentW, diagramHeight, 1.5, 1.5, 'FD');

  // ESP Board Block (left)
  const espBoxX = margin + 6;
  const espBoxY = y + 6;
  const espBoxW = 46;
  const espBoxH = diagramHeight - 12;
  doc.setFillColor(24, 24, 27);
  doc.setDrawColor(15, 118, 110);
  doc.roundedRect(espBoxX, espBoxY, espBoxW, espBoxH, 1.5, 1.5, 'FD');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(data.board.shortName, espBoxX + 3.5, espBoxY + 6.5);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${data.board.logicVoltage} · I2C ${data.board.defaultI2c.sda}/${data.board.defaultI2c.scl}`, espBoxX + 3.5, espBoxY + 11);

  if (components.length === 0 || wires.length === 0) {
    // Onboard LED indicator schematic note
    const targetX = margin + 88;
    const midY = espBoxY + espBoxH * 0.5;
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.7);
    doc.line(espBoxX + espBoxW, midY, targetX, midY);
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(37, 99, 235);
    doc.roundedRect(targetX, midY - 9, 76, 18, 1.5, 1.5, 'FD');
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`Onboard LED (GPIO ${data.board.defaultLedPin})`, targetX + 4, midY - 1.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('No external jumper wires required.', targetX + 4, midY + 4.5);
  } else {
    const compBoxX = margin + contentW - 56;
    const compBoxW = 50;
    const compGap = 4;
    const usableH = diagramHeight - 12 - (components.length - 1) * compGap;
    const eachCompH = Math.max(12, usableH / components.length);

    let wireRowCursor = 0;
    const totalWireRows = Math.max(1, wires.length);

    components.forEach((comp, cIdx) => {
      const cy = espBoxY + cIdx * (eachCompH + compGap);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(100, 116, 139);
      doc.setLineWidth(0.35);
      doc.roundedRect(compBoxX, cy, compBoxW, eachCompH, 1.2, 1.2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(comp.name.slice(0, 22), compBoxX + 3, cy + 5.2);

      const compWires = wires.filter((w) => w.componentId === comp.id);
      const tStep = Math.max(3.6, (eachCompH - 7) / Math.max(1, compWires.length));

      compWires.forEach((wire, wIdx) => {
        const leftY = espBoxY + 14 + ((espBoxH - 18) * (wireRowCursor + 0.5)) / totalWireRows;
        const rightY = cy + 7.5 + wIdx * tStep;
        const [r, g, b] = hexToRgb(wire.colorHex);

        // ESP pin label on board edge
        doc.setFont('courier', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(226, 232, 240);
        doc.text(wire.espPinLabel.slice(0, 12), espBoxX + espBoxW - 2, leftY + 1, { align: 'right' });

        // Orthogonal routed wire line
        const elbowX = espBoxX + espBoxW + 10 + (wireRowCursor % 6) * 4.2;
        doc.setDrawColor(r, g, b);
        doc.setLineWidth(0.65);
        doc.line(espBoxX + espBoxW, leftY, elbowX, leftY);
        doc.line(elbowX, leftY, elbowX, rightY);
        doc.line(elbowX, rightY, compBoxX, rightY);

        // Pin terminal dots & label
        doc.setFillColor(r, g, b);
        doc.circle(espBoxX + espBoxW, leftY, 0.9, 'F');
        doc.circle(compBoxX, rightY, 0.9, 'F');

        doc.setFont('courier', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(51, 65, 85);
        doc.text(wire.componentTerminalLabel.slice(0, 10), compBoxX + 2.5, rightY + 1);

        wireRowCursor += 1;
      });
    });
  }

  y += diagramHeight + 6;

  // 4. Pin-to-Pin Wiring Table
  ensureSpace(22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(28, 25, 23);
  doc.text(`3. Pin-to-Pin Wiring Table (${data.board.logicVoltage})`, margin, y);
  y += 3.5;

  // Table header
  doc.setFillColor(231, 229, 228);
  doc.rect(margin, y, contentW, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(41, 37, 36);
  doc.text('Component / Pin', margin + 2.5, y + 4.5);
  doc.text('ESP Pin', margin + 58, y + 4.5);
  doc.text('Notes', margin + 96, y + 4.5);
  y += 6.5;

  data.wiringRows.forEach((row, idx) => {
    const noteLines = doc.splitTextToSize(row.notes, contentW - 99);
    const rowH = Math.max(6, noteLines.length * 3.8 + 2.2);
    ensureSpace(rowH);

    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 249);
      doc.rect(margin, y, contentW, rowH, 'F');
    }
    doc.setDrawColor(231, 229, 228);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowH, margin + contentW, y + rowH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(28, 25, 23);
    doc.text(row.component.slice(0, 28), margin + 2.5, y + 4.2);

    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 118, 110);
    doc.text(row.espPin.slice(0, 22), margin + 58, y + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(87, 83, 78);
    doc.text(noteLines, margin + 96, y + 4.2);
    y += rowH;
  });

  y += 6;

  // 5. Library Requirements & PlatformIO Configuration
  ensureSpace(32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(28, 25, 23);
  doc.text('4. Library Requirements & Build Configuration', margin, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(68, 64, 60);
  const libText =
    data.libraries.length > 0
      ? `Required Libraries: ${data.libraries.join(', ')}`
      : 'Required Libraries: Built-in framework core only (no external libraries required).';
  const libLines = doc.splitTextToSize(libText, contentW);
  doc.text(libLines, margin, y);
  y += libLines.length * 4 + 2;

  const iniLines = data.platformIoIni.trim().split('\n');
  const iniH = iniLines.length * 3.9 + 5;
  ensureSpace(iniH);
  doc.setFillColor(245, 245, 244);
  doc.setDrawColor(214, 211, 209);
  doc.roundedRect(margin, y, contentW, iniH, 1.2, 1.2, 'FD');
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(41, 37, 36);
  iniLines.forEach((line, i) => {
    doc.text(line, margin + 3, y + 4.5 + i * 3.9);
  });
  y += iniH + 5;

  if (data.gpioWarnings.length > 0) {
    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 83, 9);
    doc.text('Hardware Pin Warnings:', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    for (const w of data.gpioWarnings) {
      const wLines = doc.splitTextToSize(`• ${w.message}`, contentW - 3);
      ensureSpace(wLines.length * 3.8 + 1);
      doc.text(wLines, margin + 2, y);
      y += wLines.length * 3.8 + 1;
    }
    y += 3;
  }

  // 6. Complete Firmware Source Code (Multi-page Courier Listing)
  ensureSpace(16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(28, 25, 23);
  doc.text(`5. Firmware Source Code (${data.frameworkLabel})`, margin, y);
  y += 4;

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.6);
  const lineH = 3.75;

  data.codeLines.forEach((rawLine, idx) => {
    const wrapped = doc.splitTextToSize(rawLine || ' ', contentW - 14);
    wrapped.forEach((subLine: string, subIdx: number) => {
      ensureSpace(lineH + 2);
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 2.8, contentW, lineH, 'F');
      if (subIdx === 0) {
        doc.setTextColor(148, 163, 184);
        doc.text(String(idx + 1).padStart(3, ' '), margin + 2, y);
      }
      doc.setTextColor(15, 23, 42);
      doc.text(subLine, margin + 11, y);
      y += lineH;
    });
  });

  // Page Footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 113, 108);
    doc.text(`${data.title} · Rs-ESP Technical Datasheet`, margin, pageH - 8);
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 8, { align: 'right' });
  }

  doc.save(data.filename);
  return { filename: data.filename, pageCount: totalPages };
}
