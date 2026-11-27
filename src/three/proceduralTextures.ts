import * as THREE from 'three';
import type { EspBoard } from '../types/esp';

export function createWorkbenchMatTexture(
  isDark: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // ESD anti-static bench mat surface
  ctx.fillStyle = isDark ? '#14191f' : '#26343d';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle surface grain
  for (let i = 0; i < 2400; i += 1) {
    const x = (i * 197) % 1024;
    const y = (i * 389) % 1024;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Fine 10mm / 50mm engineering grid lines
  ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(226, 232, 240, 0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 1024; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  ctx.strokeStyle = isDark ? 'rgba(45, 212, 191, 0.14)' : 'rgba(94, 234, 212, 0.18)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 1024; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.18)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createEspPcbSilkscreenTexture(
  board: EspBoard,
  leftLabels: string[],
  rightLabels: string[],
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const isBlueBoard = board.id === 'esp8266-d1-mini' || board.id === 'esp8266-01';
  const baseColor = isBlueBoard ? '#0e4a7b' : '#161b22';
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 1024);

  // Subtle copper trace lines under solder mask
  ctx.strokeStyle = isBlueBoard ? 'rgba(56, 189, 248, 0.16)' : 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i += 1) {
    const y = 320 + i * 44;
    ctx.beginPath();
    ctx.moveTo(75, y);
    ctx.lineTo(190, y);
    ctx.lineTo(225, y - 18);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(437, y);
    ctx.lineTo(322, y);
    ctx.lineTo(287, y - 18);
    ctx.stroke();
  }

  // White silkscreen border
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, 484, 996);

  // Board title silkscreen
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 26px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(board.shortName.toUpperCase(), 256, 520);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '18px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(board.chip, 256, 550);
  ctx.fillText(`${board.logicVoltage} LOGIC · ${board.flashMb}`, 256, 578);

  // Pin labels along left & right edges
  ctx.font = 'bold 17px ui-monospace, SFMono-Regular, Menlo, monospace';
  const startY = 300;
  const endY = 955;

  const drawPinLabels = (labels: string[], isLeft: boolean) => {
    const step = labels.length > 1 ? (endY - startY) / (labels.length - 1) : 0;
    labels.forEach((lbl, idx) => {
      const y = startY + idx * step;
      ctx.textAlign = isLeft ? 'left' : 'right';
      const isPower = /3\.3V|3V3|5V|VIN/i.test(lbl);
      const isGnd = /GND/i.test(lbl);
      ctx.fillStyle = isPower ? '#fca5a5' : isGnd ? '#94a3b8' : '#f1f5f9';
      ctx.fillText(lbl.slice(0, 8), isLeft ? 54 : 458, y + 6);
    });
  };

  drawPinLabels(leftLabels, true);
  drawPinLabels(rightLabels, false);

  // Button silkscreen labels near USB end
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 16px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RST / EN', 130, 880);
  ctx.fillText('BOOT / IO0', 382, 880);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createShieldLabelTexture(
  chipName: string,
  hasWifi: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Brushed aluminum RF shield
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#cfd6de');
  grad.addColorStop(0.5, '#e2e8f0');
  grad.addColorStop(1, '#b8c2cc');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(0, y, 512, 1);
  }

  ctx.strokeStyle = 'rgba(71, 85, 105, 0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, 476, 476);

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 34px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ESPRESSIF', 256, 195);

  ctx.font = 'bold 28px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(chipName.slice(0, 18), 256, 250);

  ctx.font = '22px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#475569';
  ctx.fillText(hasWifi ? 'Wi-Fi · BLE · 2.4GHz' : 'ESP MCU MODULE', 256, 305);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function drawOledCanvas(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  tickPhase: number,
  isLcd = false
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  if (isLcd) {
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 32px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';
    const r1 = (lines[0] || 'Rs-ESP 16x2 LCD').slice(0, 16);
    const r2 = (lines[1] || `Val: ${(24 + Math.sin(tickPhase) * 1.5).toFixed(1)} C`).slice(0, 16);
    ctx.fillText(r1, 24, 68);
    ctx.fillText(r2, 24, 128);
    return;
  }

  // SSD1306 dual-color yellow/cyan OLED look
  ctx.fillStyle = '#06090f';
  ctx.fillRect(0, 0, w, h);

  // Top yellow header band
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 28px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText((lines[0] || 'Rs-ESP OLED').slice(0, 18), 20, 40);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 54);
  ctx.lineTo(w - 16, 54);
  ctx.stroke();

  // Main cyan pixels
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 24px ui-monospace, SFMono-Regular, Menlo, monospace';
  const bodyLines = lines.slice(1, 4);
  if (bodyLines.length === 0) {
    bodyLines.push('GPIO Ready', `Temp: ${(24.2 + Math.sin(tickPhase) * 1.4).toFixed(1)} C`);
  }
  bodyLines.forEach((line, idx) => {
    ctx.fillText(line.slice(0, 20), 20, 96 + idx * 42);
  });

  // Animated waveform bar along bottom
  const barW = Math.max(16, Math.round(((Math.sin(tickPhase * 1.6) + 1) * 0.5) * (w - 40)));
  ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
  ctx.fillRect(20, h - 28, w - 40, 10);
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(20, h - 28, barW, 10);
}

export function createModuleSilkscreenTexture(
  title: string,
  pcbColor: string,
  pinLabels: string[],
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = pcbColor;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 5;
  ctx.strokeRect(16, 16, 480, 480);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 34px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title.slice(0, 16).toUpperCase(), 256, 92);

  // Pin labels along bottom edge
  if (pinLabels.length > 0) {
    ctx.font = 'bold 24px ui-monospace, SFMono-Regular, Menlo, monospace';
    const step = 360 / Math.max(1, pinLabels.length - 1);
    const startX = pinLabels.length === 1 ? 256 : 76;
    pinLabels.forEach((lbl, idx) => {
      const x = pinLabels.length === 1 ? startX : startX + idx * step;
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(lbl.slice(0, 5), x, 462);
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createLightGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.45)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function drawSevenSegCanvas(ctx: CanvasRenderingContext2D, text: string): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  // Faint unlit segments backdrop
  ctx.fillStyle = 'rgba(127, 29, 29, 0.25)';
  ctx.font = 'bold 124px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('8888', w * 0.5, h * 0.54);

  // Active bright red LED digits
  ctx.fillStyle = '#ef4444';
  ctx.fillText(text.slice(0, 5), w * 0.5, h * 0.54);
}

