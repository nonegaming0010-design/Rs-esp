import * as THREE from 'three';
import type { EspBoard } from '../types/esp';
import type { CircuitComponentNode, CircuitWireSpec } from '../utils/circuit3dModel';
import {
  createContactShadowTexture,
  createEspPcbSilkscreenTexture,
  createLightGlowTexture,
  createModuleSilkscreenTexture,
  createShieldLabelTexture,
  drawOledCanvas,
  drawSevenSegCanvas,
} from './proceduralTextures';

export interface InspectableMeta {
  type: 'board' | 'component' | 'wire' | 'pin';
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  colorHex?: string;
  interactiveAction?: 'button' | 'potentiometer' | 'power';
  focusTarget?: [number, number, number];
}

export interface BuiltEspBoard {
  group: THREE.Group;
  pinAnchors: Map<string, THREE.Vector3>;
  gpioPinAnchors: Map<number, THREE.Vector3>;
  railAnchors: { '3v3': THREE.Vector3; '5v': THREE.Vector3; gnd: THREE.Vector3 };
  onboardLedMat: THREE.MeshStandardMaterial;
  onboardLedGlowMat: THREE.MeshBasicMaterial;
  rgbLedMat: THREE.MeshStandardMaterial;
  powerLedMat: THREE.MeshStandardMaterial;
  wifiArcMat: THREE.MeshBasicMaterial;
}

export interface BuiltComponent {
  id: string;
  spec: CircuitComponentNode;
  group: THREE.Group;
  baseY: number;
  terminalAnchors: Map<string, THREE.Vector3>;
  animRefs: {
    ledDomeMat?: THREE.MeshPhysicalMaterial;
    ledGlowMat?: THREE.MeshBasicMaterial;
    rgbDomeMat?: THREE.MeshPhysicalMaterial;
    rgbGlowMat?: THREE.MeshBasicMaterial;
    trafficMats?: {
      red: THREE.MeshStandardMaterial;
      yellow: THREE.MeshStandardMaterial;
      green: THREE.MeshStandardMaterial;
    };
    lampBulbMat?: THREE.MeshPhysicalMaterial;
    lampGlowMat?: THREE.MeshBasicMaterial;
    servoHornGroup?: THREE.Group;
    stepperRotorGroup?: THREE.Group;
    stepperLedMats?: THREE.MeshStandardMaterial[];
    relayLedMat?: THREE.MeshStandardMaterial;
    buzzerWaves?: THREE.Group;
    ultrasonicWaves?: THREE.Group;
    ultrasonicTarget?: THREE.Mesh;
    potShaftGroup?: THREE.Group;
    neoPixelMats?: THREE.MeshStandardMaterial[];
    oledCanvasCtx?: CanvasRenderingContext2D;
    oledTexture?: THREE.CanvasTexture;
    isLcd?: boolean;
    sevenSegCtx?: CanvasRenderingContext2D;
    sevenSegTex?: THREE.CanvasTexture;
    pirDomeMat?: THREE.MeshPhysicalMaterial;
    buttonCapMesh?: THREE.Mesh;
    sensorLedMat?: THREE.MeshStandardMaterial;
  };
}

export interface BuiltWire {
  spec: CircuitWireSpec;
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  tubeMesh: THREE.Mesh;
  tubeMat: THREE.MeshStandardMaterial;
  pulseMesh: THREE.Mesh;
  pulseMat: THREE.MeshBasicMaterial;
}

function addShadowMesh(
  parent: THREE.Object3D,
  width: number,
  depth: number,
  shadowTex: THREE.CanvasTexture
): void {
  const geo = new THREE.PlaneGeometry(width * 1.32, depth * 1.32);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const plane = new THREE.Mesh(geo, mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.015;
  parent.add(plane);
}

function addGlowHalo(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  size: number,
  colorHex: number,
  glowTex: THREE.CanvasTexture
): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: colorHex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mat;
}

function createPinHeaderRow(
  count: number,
  x: number,
  yBase: number,
  zStart: number,
  zEnd: number,
  goldMat: THREE.Material,
  plasticMat: THREE.Material
): { group: THREE.Group; positions: THREE.Vector3[] } {
  const headerGroup = new THREE.Group();
  const positions: THREE.Vector3[] = [];
  const step = count > 1 ? (zEnd - zStart) / (count - 1) : 0;

  const shroudGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  const pinGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.38, 8);
  const shrouds = new THREE.InstancedMesh(shroudGeo, plasticMat, count);
  const pins = new THREE.InstancedMesh(pinGeo, goldMat, count);
  shrouds.castShadow = true;
  pins.castShadow = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i += 1) {
    const z = count === 1 ? (zStart + zEnd) * 0.5 : zStart + i * step;

    dummy.position.set(x, yBase + 0.07, z);
    dummy.updateMatrix();
    shrouds.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, yBase + 0.17, z);
    dummy.updateMatrix();
    pins.setMatrixAt(i, dummy.matrix);

    positions.push(new THREE.Vector3(x, yBase + 0.34, z));
  }
  shrouds.instanceMatrix.needsUpdate = true;
  pins.instanceMatrix.needsUpdate = true;
  shrouds.computeBoundingSphere();
  pins.computeBoundingSphere();

  headerGroup.add(shrouds, pins);
  return { group: headerGroup, positions };
}

export interface ActivePinSelection {
  gpios: Set<number>;
  rails: Set<string>;
}

export function buildEspBoardModel(
  board: EspBoard,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  activePins?: ActivePinSelection,
  boardOffsetX = 0
): BuiltEspBoard {
  const group = new THREE.Group();
  const shadowTex = createContactShadowTexture();
  const glowTex = createLightGlowTexture();

  const isCompact =
    board.id === 'esp8266-d1-mini' ||
    board.id === 'esp8266-01' ||
    board.id === 'esp32-c3' ||
    board.id === 'esp32-s2';
  const boardW = isCompact ? 1.75 : 2.15;
  const boardD = board.id === 'esp8266-01' ? 2.2 : isCompact ? 2.85 : 3.75;
  const boardH = 0.11;
  const pcbY = 0.24;

  addShadowMesh(group, boardW, boardD, shadowTex);

  const leftPins = board.pins.filter((p) => p.side === 'left').slice(0, 12);
  const rightPins = board.pins.filter((p) => p.side === 'right').slice(0, 12);

  const leftLabels = ['3V3', 'EN', ...leftPins.map((p) => `IO${p.gpio}`), 'GND'];
  const rightLabels = ['GND', ...rightPins.map((p) => `IO${p.gpio}`), '5V'];
  const rowCount = Math.max(leftLabels.length, rightLabels.length);
  while (leftLabels.length < rowCount) leftLabels.push('NC');
  while (rightLabels.length < rowCount) rightLabels.push('NC');

  // 1. PCB Substrate with dynamic silkscreen
  const pcbTopTex = createEspPcbSilkscreenTexture(board, leftLabels, rightLabels, maxAnisotropy);
  const sideMat = new THREE.MeshStandardMaterial({
    color: board.id === 'esp8266-d1-mini' || board.id === 'esp8266-01' ? 0x0b3a60 : 0x11151b,
    roughness: 0.72,
    metalness: 0.08,
  });
  const topMat = new THREE.MeshStandardMaterial({
    map: pcbTopTex,
    roughness: 0.58,
    metalness: 0.12,
  });
  const pcbGeo = new THREE.BoxGeometry(boardW, boardH, boardD);
  const pcbMesh = new THREE.Mesh(pcbGeo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
  pcbMesh.position.y = pcbY;
  pcbMesh.castShadow = !isSoftwareGl;
  pcbMesh.receiveShadow = true;
  pcbMesh.userData.inspectInfo = {
    type: 'board',
    id: board.id,
    title: board.name,
    subtitle: `${board.chip} · ${board.architecture} · ${board.clockMhz} MHz`,
    detail: board.summary,
    focusTarget: [boardOffsetX, 0.3, 0],
  } satisfies InspectableMeta;
  group.add(pcbMesh);

  // Corner mounting hole copper rings
  const mountRingGeo = new THREE.RingGeometry(0.048, 0.095, 20);
  const mountRingMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.2,
    metalness: 0.9,
    side: THREE.DoubleSide,
  });
  const mx = boardW * 0.5 - 0.14;
  const mz = boardD * 0.5 - 0.14;
  (
    [
      [-mx, -mz],
      [mx, -mz],
      [-mx, mz],
      [mx, mz],
    ] as const
  ).forEach(([hx, hz]) => {
    const ring = new THREE.Mesh(mountRingGeo, mountRingMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(hx, pcbY + boardH / 2 + 0.004, hz);
    group.add(ring);
  });

  // 2. Brushed Metal RF Shield Can
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xd1d8e0,
    roughness: 0.25,
    metalness: 0.88,
  });
  const shieldTex = createShieldLabelTexture(board.chip, true, maxAnisotropy);
  const shieldTopMat = new THREE.MeshStandardMaterial({
    map: shieldTex,
    roughness: 0.24,
    metalness: 0.86,
  });
  const shieldW = boardW * 0.62;
  const shieldD = boardD * 0.34;
  const shieldH = 0.22;
  const shieldMesh = new THREE.Mesh(
    new THREE.BoxGeometry(shieldW, shieldH, shieldD),
    [metalMat, metalMat, shieldTopMat, metalMat, metalMat, metalMat]
  );
  shieldMesh.position.set(0, pcbY + boardH / 2 + shieldH / 2, -boardD * 0.16);
  shieldMesh.castShadow = !isSoftwareGl;
  shieldMesh.userData.inspectInfo = pcbMesh.userData.inspectInfo;
  group.add(shieldMesh);

  // 3. PCB Meander Antenna
  const antMat = new THREE.MeshStandardMaterial({ color: 0x0f1318, roughness: 0.75, metalness: 0.05 });
  const antBase = new THREE.Mesh(new THREE.BoxGeometry(shieldW, 0.03, boardD * 0.14), antMat);
  antBase.position.set(0, pcbY + boardH / 2 + 0.015, -boardD * 0.41);
  group.add(antBase);

  const goldMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.16, metalness: 0.94 });
  for (let i = 0; i < 4; i += 1) {
    const trace = new THREE.Mesh(new THREE.BoxGeometry(shieldW * 0.72, 0.012, 0.045), goldMat);
    trace.position.set(0, pcbY + boardH / 2 + 0.032, -boardD * 0.46 + i * 0.11);
    group.add(trace);
  }

  // 4. USB Connector (click to toggle USB power!)
  const usbShell = new THREE.Mesh(
    new THREE.BoxGeometry(board.nativeUsb ? 0.54 : 0.46, 0.2, 0.42),
    metalMat
  );
  usbShell.position.set(0, pcbY + boardH / 2 + 0.1, boardD / 2 - 0.12);
  usbShell.castShadow = !isSoftwareGl;
  usbShell.userData.inspectInfo = {
    type: 'board',
    id: `${board.id}_usb`,
    title: 'USB Power & Serial Port',
    subtitle: 'Click to toggle board power ON / OFF',
    detail: `${board.nativeUsb ? 'Native USB-C' : 'USB-UART Bridge'} · ${board.defaultSerialBaud} baud`,
    interactiveAction: 'power',
    focusTarget: [boardOffsetX, 0.35, boardD / 2 - 0.12],
  } satisfies InspectableMeta;
  group.add(usbShell);

  const usbPortInner = new THREE.Mesh(
    new THREE.BoxGeometry(board.nativeUsb ? 0.42 : 0.34, 0.11, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8, metalness: 0.1 })
  );
  usbPortInner.position.set(0, pcbY + boardH / 2 + 0.1, boardD / 2 + 0.06);
  group.add(usbPortInner);

  // 5. Tactile BOOT & RST Buttons + ICs
  const plasticMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.78, metalness: 0.06 });
  const icMat = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.6, metalness: 0.12 });

  [-0.48, 0.48].forEach((bx) => {
    const btnFrame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.24), metalMat);
    btnFrame.position.set(bx, pcbY + boardH / 2 + 0.04, boardD / 2 - 0.45);
    const btnCap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.06, 16), plasticMat);
    btnCap.position.set(bx, pcbY + boardH / 2 + 0.09, boardD / 2 - 0.45);
    group.add(btnFrame, btnCap);
  });

  if (!board.nativeUsb) {
    const uartIc = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.32), icMat);
    uartIc.position.set(-0.18, pcbY + boardH / 2 + 0.03, boardD * 0.24);
    uartIc.rotation.y = Math.PI / 4;
    group.add(uartIc);
  }

  const vreg = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.26), icMat);
  vreg.position.set(0.24, pcbY + boardH / 2 + 0.04, boardD * 0.14);
  group.add(vreg);

  // 6. Onboard Power LED + Programmable User LED + Glow Halo + Optional RGB LED
  const powerLedMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: new THREE.Color(0xef4444),
    emissiveIntensity: 1.3,
    roughness: 0.3,
  });
  const powerLed = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.07), powerLedMat);
  powerLed.position.set(-0.28, pcbY + boardH / 2 + 0.02, boardD * 0.34);
  group.add(powerLed);

  const onboardLedMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    emissive: new THREE.Color(0x2563eb),
    emissiveIntensity: 0.05,
    roughness: 0.25,
  });
  const onboardLed = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.08), onboardLedMat);
  onboardLed.position.set(0.28, pcbY + boardH / 2 + 0.022, boardD * 0.34);
  group.add(onboardLed);

  const onboardLedGlowMat = addGlowHalo(
    group,
    0.28,
    pcbY + boardH / 2 + 0.05,
    boardD * 0.34,
    0.65,
    0x3b82f6,
    glowTex
  );

  const rgbLedMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: new THREE.Color(0x22d3ee),
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });
  const rgbLed = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.16), rgbLedMat);
  rgbLed.position.set(0, pcbY + boardH / 2 + 0.025, boardD * 0.05);
  rgbLed.visible = board.id === 'esp32-s3' || board.id === 'esp32-c6' || board.id === 'esp32-h2';
  group.add(rgbLed);

  const wifiArcMat = new THREE.MeshBasicMaterial({
    color: 0x14b8a6,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const wifiArc = new THREE.Mesh(
    new THREE.RingGeometry(0.24, 0.28, 28, 1, Math.PI * 0.18, Math.PI * 0.64),
    wifiArcMat
  );
  wifiArc.rotation.x = -Math.PI / 2;
  wifiArc.position.set(0, pcbY + boardH / 2 + 0.15, -boardD * 0.44);
  group.add(wifiArc);

  // 7. Dual-Row Gold Header Pins
  const headerZStart = -boardD * 0.12;
  const headerZEnd = boardD * 0.44;
  const headerXOffset = boardW * 0.42;

  const leftHeader = createPinHeaderRow(
    rowCount,
    -headerXOffset,
    pcbY + boardH / 2,
    headerZStart,
    headerZEnd,
    goldMat,
    plasticMat
  );
  const rightHeader = createPinHeaderRow(
    rowCount,
    headerXOffset,
    pcbY + boardH / 2,
    headerZStart,
    headerZEnd,
    goldMat,
    plasticMat
  );
  group.add(leftHeader.group, rightHeader.group);

  const standoffGeo = new THREE.CylinderGeometry(0.022, 0.022, pcbY, 8);
  const standoffs = new THREE.InstancedMesh(standoffGeo, goldMat, rowCount * 2);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < rowCount; i += 1) {
    dummy.position.set(-headerXOffset, pcbY / 2, leftHeader.positions[i].z);
    dummy.updateMatrix();
    standoffs.setMatrixAt(i * 2, dummy.matrix);

    dummy.position.set(headerXOffset, pcbY / 2, rightHeader.positions[i].z);
    dummy.updateMatrix();
    standoffs.setMatrixAt(i * 2 + 1, dummy.matrix);
  }
  standoffs.instanceMatrix.needsUpdate = true;
  standoffs.computeBoundingSphere();
  group.add(standoffs);

  const pinAnchors = new Map<string, THREE.Vector3>();
  const gpioPinAnchors = new Map<number, THREE.Vector3>();

  // Shared geometry/material for per-pin invisible hover/click colliders & active pin collars
  const pinHitGeo = new THREE.BoxGeometry(0.15, 0.38, 0.15);
  const pinHitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const collarGeo = new THREE.CylinderGeometry(0.068, 0.068, 0.03, 14);

  const attachHeaderPinMeta = (
    lbl: string,
    pos: THREE.Vector3,
    pinSpec?: EspBoard['pins'][number]
  ) => {
    const isRail3v3 = lbl === '3V3';
    const isRail5v = lbl === '5V';
    const isRailGnd = lbl === 'GND';
    const isActive =
      (pinSpec && activePins?.gpios.has(pinSpec.gpio)) ||
      (isRail3v3 && activePins?.rails.has('3v3')) ||
      (isRail5v && activePins?.rails.has('5v')) ||
      (isRailGnd && activePins?.rails.has('gnd'));

    if (isActive) {
      const collarHex = isRail3v3 || isRail5v ? 0xef4444 : isRailGnd ? 0x64748b : 0x14b8a6;
      const collarMat = new THREE.MeshStandardMaterial({
        color: collarHex,
        emissive: new THREE.Color(collarHex),
        emissiveIntensity: 0.9,
        roughness: 0.3,
      });
      const collar = new THREE.Mesh(collarGeo, collarMat);
      collar.position.set(pos.x, pcbY + boardH / 2 + 0.15, pos.z);
      group.add(collar);
    }

    if (lbl === 'NC') return;
    const hitBox = new THREE.Mesh(pinHitGeo, pinHitMat);
    hitBox.position.set(pos.x, pcbY + boardH / 2 + 0.18, pos.z);
    const caps = pinSpec ? pinSpec.capabilities.join(', ') : lbl === 'EN' ? 'Chip Enable / Reset' : 'Power Rail';
    const warn = pinSpec?.warning ? ` · Note: ${pinSpec.warning}` : '';
    hitBox.userData.inspectInfo = {
      type: 'pin',
      id: `${board.id}_pin_${lbl}`,
      title: pinSpec ? `${pinSpec.label} (GPIO ${pinSpec.gpio})` : `${board.shortName} ${lbl} Pin`,
      subtitle: `${isActive ? 'Connected in circuit' : 'Header Pin'} · ${caps}`,
      detail: `${pinSpec ? pinSpec.notes : lbl === '3V3' ? '3.3V regulated supply (max ~500mA)' : lbl === '5V' ? '5V USB / VIN rail' : lbl === 'GND' ? 'Common ground reference' : 'Pull HIGH to run; LOW resets chip'}${warn}`,
      colorHex: isRail3v3 || isRail5v ? '#ef4444' : isRailGnd ? '#475569' : isActive ? '#0d9488' : '#eab308',
      focusTarget: [boardOffsetX + pos.x, pos.y, pos.z],
    } satisfies InspectableMeta;
    group.add(hitBox);
  };

  leftLabels.forEach((lbl, idx) => {
    const pos = leftHeader.positions[idx];
    pinAnchors.set(lbl, pos.clone());
    const pinSpec = idx >= 2 && idx - 2 < leftPins.length ? leftPins[idx - 2] : undefined;
    if (pinSpec) {
      gpioPinAnchors.set(pinSpec.gpio, pos.clone());
    }
    attachHeaderPinMeta(lbl, pos, pinSpec);
  });
  rightLabels.forEach((lbl, idx) => {
    const pos = rightHeader.positions[idx];
    pinAnchors.set(lbl, pos.clone());
    const pinSpec = idx >= 1 && idx - 1 < rightPins.length ? rightPins[idx - 1] : undefined;
    if (pinSpec) {
      gpioPinAnchors.set(pinSpec.gpio, pos.clone());
    }
    attachHeaderPinMeta(lbl, pos, pinSpec);
  });

  const railAnchors = {
    '3v3': pinAnchors.get('3V3') ?? leftHeader.positions[0].clone(),
    '5v': pinAnchors.get('5V') ?? rightHeader.positions[rowCount - 1].clone(),
    gnd: pinAnchors.get('GND') ?? rightHeader.positions[0].clone(),
  };

  return {
    group,
    pinAnchors,
    gpioPinAnchors,
    railAnchors,
    onboardLedMat,
    onboardLedGlowMat,
    rgbLedMat,
    powerLedMat,
    wifiArcMat,
  };
}

function attachComponentHeaders(
  group: THREE.Group,
  terminals: CircuitComponentNode['terminals'],
  xStart: number,
  xEnd: number,
  yTop: number,
  zPos: number,
  goldMat: THREE.Material,
  plasticMat: THREE.Material
): Map<string, THREE.Vector3> {
  const map = new Map<string, THREE.Vector3>();
  const count = terminals.length;
  const step = count > 1 ? (xEnd - xStart) / (count - 1) : 0;

  terminals.forEach((term, idx) => {
    const px = count === 1 ? (xStart + xEnd) * 0.5 : xStart + idx * step;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.11), plasticMat);
    base.position.set(px, yTop + 0.05, zPos);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 8), goldMat);
    pin.position.set(px, yTop + 0.14, zPos);
    group.add(base, pin);
    map.set(term.id, new THREE.Vector3(px, yTop + 0.26, zPos));
  });

  return map;
}

export function buildComponentModel(
  spec: CircuitComponentNode,
  isSoftwareGl: boolean,
  maxAnisotropy: number
): BuiltComponent {
  const group = new THREE.Group();
  group.position.set(spec.position.x, 0, spec.position.z);

  const shadowTex = createContactShadowTexture();
  const glowTex = createLightGlowTexture();
  addShadowMesh(group, 1.5, 1.5, shadowTex);

  const goldMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.16, metalness: 0.94 });
  const silverMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.22, metalness: 0.9 });
  const darkPlasticMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.78, metalness: 0.06 });
  const animRefs: BuiltComponent['animRefs'] = {};
  let terminalAnchors = new Map<string, THREE.Vector3>();

  switch (spec.kind) {
    case 'led': {
      const ledColor = new THREE.Color(spec.ledColorHex || '#ef4444');
      const carrier = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.14, 0.95),
        new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.65, metalness: 0.05 })
      );
      carrier.position.y = 0.07;
      carrier.castShadow = !isSoftwareGl;
      group.add(carrier);

      // 220Ω axial resistor
      const resBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.36, 16),
        new THREE.MeshStandardMaterial({ color: 0xd6b588, roughness: 0.62, metalness: 0.04 })
      );
      resBody.rotation.z = Math.PI / 2;
      resBody.position.set(-0.22, 0.24, 0.05);
      const band1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.079, 0.079, 0.04, 16),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 })
      );
      band1.rotation.z = Math.PI / 2;
      band1.position.set(-0.3, 0.24, 0.05);
      const band2 = band1.clone();
      band2.position.set(-0.18, 0.24, 0.05);
      group.add(resBody, band1, band2);

      const flange = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.17, 0.07, 24),
        new THREE.MeshPhysicalMaterial({ color: ledColor, roughness: 0.18, metalness: 0.05 })
      );
      flange.position.set(0.18, 0.32, 0);
      const ledMat = new THREE.MeshPhysicalMaterial({
        color: ledColor,
        emissive: ledColor,
        emissiveIntensity: 0.08,
        roughness: 0.15,
        metalness: 0.05,
        transmission: isSoftwareGl ? 0 : 0.42,
        transparent: true,
        opacity: isSoftwareGl ? 0.88 : 1,
        clearcoat: 1,
      });
      const ledCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.26, 24), ledMat);
      ledCyl.position.set(0.18, 0.47, 0);
      const ledDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.145, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        ledMat
      );
      ledDome.position.set(0.18, 0.6, 0);
      const leadL = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 8), silverMat);
      leadL.position.set(0.12, 0.22, 0);
      const leadR = leadL.clone();
      leadR.position.set(0.24, 0.22, 0);
      group.add(flange, ledCyl, ledDome, leadL, leadR);

      animRefs.ledDomeMat = ledMat;
      animRefs.ledGlowMat = addGlowHalo(group, 0.18, 0.16, 0, 1.3, ledColor.getHex(), glowTex);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.35, 0.35, 0.14, 0.34, goldMat, darkPlasticMat);
      break;
    }

    case 'rgb_led': {
      const carrier = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 0.12, 1.15),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.62, metalness: 0.1 })
      );
      carrier.position.y = 0.06;
      group.add(carrier);

      // 3x 220Ω resistors
      [-0.3, 0, 0.3].forEach((rx, idx) => {
        const res = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.055, 0.28, 12),
          new THREE.MeshStandardMaterial({ color: 0xd6b588, roughness: 0.6 })
        );
        res.rotation.x = Math.PI / 2;
        res.position.set(rx, 0.18, 0.18);
        const tint = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12),
          new THREE.MeshStandardMaterial({ color: [0xef4444, 0x22c55e, 0x3b82f6][idx] })
        );
        tint.rotation.x = Math.PI / 2;
        tint.position.set(rx, 0.18, 0.24);
        group.add(res, tint);
      });

      const rgbDomeMat = new THREE.MeshPhysicalMaterial({
        color: 0xf8fafc,
        emissive: new THREE.Color(0x22d3ee),
        emissiveIntensity: 1.2,
        roughness: 0.22,
        clearcoat: 1,
      });
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.32, 24), rgbDomeMat);
      cyl.position.set(0, 0.38, -0.18);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.21, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        rgbDomeMat
      );
      dome.position.set(0, 0.54, -0.18);
      group.add(cyl, dome);

      animRefs.rgbDomeMat = rgbDomeMat;
      animRefs.rgbGlowMat = addGlowHalo(group, 0, 0.14, -0.18, 1.75, 0x22d3ee, glowTex);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.45, 0.45, 0.12, 0.44, goldMat, darkPlasticMat);
      break;
    }

    case 'traffic_light': {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.1, 1.35),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72 })
      );
      base.position.y = 0.05;
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 1.25, 0.42),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55 })
      );
      tower.position.set(0, 0.68, -0.16);
      tower.castShadow = !isSoftwareGl;
      group.add(base, tower);

      const mkLensMat = (hex: number) =>
        new THREE.MeshStandardMaterial({
          color: hex,
          emissive: new THREE.Color(hex),
          emissiveIntensity: 0.12,
          roughness: 0.2,
        });
      const redMat = mkLensMat(0xef4444);
      const yellowMat = mkLensMat(0xeab308);
      const greenMat = mkLensMat(0x22c55e);

      const specs = [
        { y: 1.06, mat: redMat },
        { y: 0.72, mat: yellowMat },
        { y: 0.38, mat: greenMat },
      ];
      specs.forEach(({ y, mat }) => {
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 16), mat);
        lens.scale.set(1, 1, 0.55);
        lens.position.set(0, y, 0.06);
        const visor = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.14, 18, 1, true, 0, Math.PI),
          darkPlasticMat
        );
        visor.rotation.z = Math.PI / 2;
        visor.rotation.y = Math.PI / 2;
        visor.position.set(0, y + 0.02, 0.1);
        group.add(lens, visor);
      });

      animRefs.trafficMats = { red: redMat, yellow: yellowMat, green: greenMat };
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.36, 0.36, 0.1, 0.48, goldMat, darkPlasticMat);
      break;
    }

    case 'lamp_bulb': {
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 0.1, 1.25),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 })
      );
      pcb.position.y = 0.05;
      const socket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.34, 0.28, 24),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.38 })
      );
      socket.position.set(0, 0.24, -0.1);
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.26, 0.14, 24),
        silverMat
      );
      neck.position.set(0, 0.44, -0.1);

      const bulbMat = new THREE.MeshPhysicalMaterial({
        color: 0xfef3c7,
        emissive: new THREE.Color(0xfbbf24),
        emissiveIntensity: 0.15,
        roughness: 0.18,
        clearcoat: 1,
        transparent: true,
        opacity: 0.92,
      });
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.4, 28, 20), bulbMat);
      globe.position.set(0, 0.82, -0.1);
      globe.castShadow = !isSoftwareGl;
      group.add(pcb, socket, neck, globe);

      animRefs.lampBulbMat = bulbMat;
      animRefs.lampGlowMat = addGlowHalo(group, 0, 0.12, -0.1, 2.35, 0xfbbf24, glowTex);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.36, 0.36, 0.1, 0.46, goldMat, darkPlasticMat);
      break;
    }

    case 'dht22': {
      const isDht11 = /dht\s*11/i.test(spec.name);
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 0.09, 1.32),
        new THREE.MeshStandardMaterial({ color: 0x161b22, roughness: 0.66, metalness: 0.1 })
      );
      pcb.position.y = 0.045;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.36, 0.96),
        new THREE.MeshStandardMaterial({
          color: isDht11 ? 0x0ea5e9 : 0xf8fafc,
          roughness: 0.48,
          metalness: 0.05,
        })
      );
      body.position.set(0, 0.27, -0.1);
      body.castShadow = !isSoftwareGl;
      group.add(pcb, body);

      const gridMat = new THREE.MeshStandardMaterial({
        color: isDht11 ? 0x0369a1 : 0xcbd5e1,
        roughness: 0.72,
        metalness: 0.05,
      });
      for (let gx = -0.22; gx <= 0.22; gx += 0.145) {
        for (let gz = -0.38; gz <= 0.16; gz += 0.18) {
          const slot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.09), gridMat);
          slot.position.set(gx, 0.455, gz);
          group.add(slot);
        }
      }
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.26, 0.26, 0.09, 0.54, goldMat, darkPlasticMat);
      break;
    }

    case 'light_sensor': {
      const tex = createModuleSilkscreenTexture(
        'LDR / LUX',
        '#1d4ed8',
        spec.terminals.map((t) => t.label),
        maxAnisotropy
      );
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(1.18, 0.09, 1.25),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0.1 })
      );
      pcb.position.y = 0.045;
      pcb.castShadow = !isSoftwareGl;

      // Photocell ceramic head with serpentine CdS look
      const ldrDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.09, 24),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.32 })
      );
      ldrDisc.position.set(-0.22, 0.26, -0.18);
      const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.18, 8), silverMat);
      leg1.position.set(-0.28, 0.15, -0.18);
      const leg2 = leg1.clone();
      leg2.position.set(-0.16, 0.15, -0.18);

      // Blue calibration trimpot
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.18, 0.32),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45 })
      );
      trim.position.set(0.26, 0.18, -0.12);

      const ledMat = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: new THREE.Color(0x22c55e),
        emissiveIntensity: 0.4,
      });
      const indLed = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.07), ledMat);
      indLed.position.set(0.26, 0.11, 0.24);
      animRefs.sensorLedMat = ledMat;

      group.add(pcb, ldrDisc, leg1, leg2, trim, indLed);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.34, 0.34, 0.09, 0.48, goldMat, darkPlasticMat);
      break;
    }

    case 'soil_moisture': {
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(0.86, 0.08, 1.75),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.58, metalness: 0.18 })
      );
      pcb.position.y = 0.04;
      pcb.castShadow = !isSoftwareGl;
      // Gold capacitive sense prongs at tip
      const prong1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.015, 0.85), goldMat);
      prong1.position.set(-0.2, 0.085, -0.38);
      const prong2 = prong1.clone();
      prong2.position.set(0.2, 0.085, -0.38);
      const ic = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.22), darkPlasticMat);
      ic.position.set(0, 0.12, 0.38);
      group.add(pcb, prong1, prong2, ic);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.24, 0.24, 0.08, 0.72, goldMat, darkPlasticMat);
      break;
    }

    case 'gas_sensor': {
      const tex = createModuleSilkscreenTexture(
        'MQ-2 GAS',
        '#b91c1c',
        spec.terminals.map((t) => t.label),
        maxAnisotropy
      );
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(1.22, 0.09, 1.25),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.1 })
      );
      pcb.position.y = 0.045;
      const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.12, 24), darkPlasticMat);
      baseRing.position.set(0, 0.14, -0.1);
      const meshCan = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.44, 24),
        new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.82 })
      );
      meshCan.position.set(0, 0.42, -0.1);
      meshCan.castShadow = !isSoftwareGl;
      const ledMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: new THREE.Color(0xef4444),
        emissiveIntensity: 0.2,
      });
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.08), ledMat);
      led.position.set(0.38, 0.11, 0.22);
      animRefs.sensorLedMat = ledMat;
      group.add(pcb, baseRing, meshCan, led);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.34, 0.34, 0.09, 0.48, goldMat, darkPlasticMat);
      break;
    }

    case 'imu_mpu6050': {
      const tex = createModuleSilkscreenTexture(
        'MPU-6050',
        '#6d28d9',
        spec.terminals.map((t) => t.label),
        maxAnisotropy
      );
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.08, 1.1),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.58, metalness: 0.14 })
      );
      pcb.position.y = 0.04;
      const qfn = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.28), darkPlasticMat);
      qfn.position.set(0, 0.105, -0.08);
      const axisX = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.015, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc })
      );
      axisX.position.set(0.22, 0.09, -0.32);
      group.add(pcb, qfn, axisX);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.36, 0.36, 0.08, 0.42, goldMat, darkPlasticMat);
      break;
    }

    case 'sound_mic': {
      const tex = createModuleSilkscreenTexture(
        'SOUND MIC',
        '#be123c',
        spec.terminals.map((t) => t.label),
        maxAnisotropy
      );
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(1.18, 0.09, 1.25),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62 })
      );
      pcb.position.y = 0.045;
      const micCan = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.24, 24), silverMat);
      micCan.rotation.x = Math.PI / 2;
      micCan.position.set(0, 0.28, -0.45);
      const felt = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 20), darkPlasticMat);
      felt.rotation.x = Math.PI / 2;
      felt.position.set(0, 0.28, -0.58);
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.18, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45 })
      );
      trim.position.set(0.24, 0.18, 0.05);
      group.add(pcb, micCan, felt, trim);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.32, 0.32, 0.09, 0.48, goldMat, darkPlasticMat);
      break;
    }

    case 'ir_receiver': {
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.08, 1.05),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.62 })
      );
      pcb.position.y = 0.04;
      const cage = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.26), silverMat);
      cage.position.set(0, 0.26, -0.15);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 18, 14),
        new THREE.MeshPhysicalMaterial({ color: 0x1e1b4b, roughness: 0.15, clearcoat: 1 })
      );
      dome.position.set(0, 0.28, -0.27);
      group.add(pcb, cage, dome);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.26, 0.26, 0.08, 0.38, goldMat, darkPlasticMat);
      break;
    }

    case 'seven_seg': {
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(1.75, 0.09, 0.95),
        new THREE.MeshStandardMaterial({ color: 0x161b22, roughness: 0.62 })
      );
      pcb.position.y = 0.045;
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(1.48, 0.18, 0.62),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 })
      );
      housing.position.set(0, 0.16, -0.06);

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 192;
      const ctx = canvas.getContext('2d')!;
      drawSevenSegCanvas(ctx, '0000');
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;

      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 0.54),
        new THREE.MeshStandardMaterial({
          map: tex,
          emissiveMap: tex,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.85,
          roughness: 0.2,
        })
      );
      face.rotation.x = -Math.PI / 2;
      face.position.set(0, 0.255, -0.06);
      group.add(pcb, housing, face);

      animRefs.sevenSegCtx = ctx;
      animRefs.sevenSegTex = tex;
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.5, 0.5, 0.09, 0.36, goldMat, darkPlasticMat);
      break;
    }

    case 'stepper': {
      const driverPcb = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.08, 1.35),
        new THREE.MeshStandardMaterial({ color: 0x0e4a7b, roughness: 0.6 })
      );
      driverPcb.position.set(0, 0.04, 0.15);
      // ULN2003 4 phase LEDs
      const phaseMats: THREE.MeshStandardMaterial[] = [];
      [-0.36, -0.12, 0.12, 0.36].forEach((lx) => {
        const lm = new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: new THREE.Color(0xef4444),
          emissiveIntensity: 0.2,
        });
        phaseMats.push(lm);
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.06), lm);
        led.position.set(lx, 0.1, 0.36);
        group.add(led);
      });
      animRefs.stepperLedMats = phaseMats;

      // Cylindrical silver 28BYJ-48 motor body
      const motorCan = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.48, 28), silverMat);
      motorCan.position.set(0, 0.34, -0.18);
      motorCan.castShadow = !isSoftwareGl;
      const rotorGroup = new THREE.Group();
      rotorGroup.position.set(0, 0.62, -0.18);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 16), goldMat);
      const pointer = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.05, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
      );
      pointer.position.set(0.2, 0.08, 0);
      rotorGroup.add(shaft, pointer);
      animRefs.stepperRotorGroup = rotorGroup;

      group.add(driverPcb, motorCan, rotorGroup);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.45, 0.45, 0.08, 0.68, goldMat, darkPlasticMat);
      break;
    }

    case 'oled_ssd1306':
    case 'lcd_1602': {
      const isLcd = spec.kind === 'lcd_1602';
      const w = isLcd ? 1.95 : 1.38;
      const d = isLcd ? 1.15 : 1.38;
      const tex = createModuleSilkscreenTexture(
        isLcd ? '16x2 I2C LCD' : 'SSD1306 OLED',
        isLcd ? '#15803d' : '#0e4a7b',
        spec.terminals.map((t) => t.label),
        maxAnisotropy
      );
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.09, d),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0.12 })
      );
      pcb.position.y = 0.045;
      pcb.castShadow = !isSoftwareGl;
      group.add(pcb);

      const bezel = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.86, 0.14, d * 0.6),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.32, metalness: 0.28 })
      );
      bezel.position.set(0, 0.15, 0.1);
      group.add(bezel);

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = isLcd ? 180 : 256;
      const ctx = canvas.getContext('2d')!;
      drawOledCanvas(ctx, ['Rs-ESP Ready', 'Waiting Data'], 0, isLcd);
      const screenTex = new THREE.CanvasTexture(canvas);
      screenTex.colorSpace = THREE.SRGBColorSpace;
      screenTex.anisotropy = maxAnisotropy;

      const screenPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.78, d * 0.48),
        new THREE.MeshStandardMaterial({
          map: screenTex,
          emissiveMap: screenTex,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.82,
          roughness: 0.14,
          metalness: 0.05,
        })
      );
      screenPlane.rotation.x = -Math.PI / 2;
      screenPlane.position.set(0, 0.225, 0.1);
      group.add(screenPlane);

      animRefs.oledCanvasCtx = ctx;
      animRefs.oledTexture = screenTex;
      animRefs.isLcd = isLcd;
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -w * 0.28, w * 0.28, 0.09, -d * 0.41, goldMat, darkPlasticMat);
      break;
    }

    case 'ultrasonic': {
      // Orient HC-SR04 facing +X (twin transducers + sound waves + movable orange obstacle block to the right)
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.92, 1.75),
        new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.62, metalness: 0.12 })
      );
      pcb.position.set(0, 0.54, 0);
      pcb.castShadow = !isSoftwareGl;
      group.add(pcb);

      const carrierBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.1, 1.75),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75, metalness: 0.05 })
      );
      carrierBase.position.set(-0.12, 0.05, 0);
      group.add(carrierBase);

      [-0.48, 0.48].forEach((tz) => {
        const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.42, 28), silverMat);
        outer.rotation.z = Math.PI / 2;
        outer.position.set(0.24, 0.56, tz);
        outer.castShadow = !isSoftwareGl;
        const innerCone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.12, 0.08, 24),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.15 })
        );
        innerCone.rotation.z = Math.PI / 2;
        innerCone.position.set(0.42, 0.56, tz);
        group.add(outer, innerCone);
      });

      const crystal = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.24), silverMat);
      crystal.position.set(0.07, 0.86, 0);
      group.add(crystal);

      const waves = new THREE.Group();
      for (let i = 0; i < 3; i += 1) {
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(0.28 + i * 0.18, 0.015, 8, 24, Math.PI * 0.6),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.48 })
        );
        arc.rotation.z = -Math.PI * 0.3;
        arc.position.set(0.62 + i * 0.22, 0.56, 0);
        waves.add(arc);
      }
      group.add(waves);
      animRefs.ultrasonicWaves = waves;

      // Movable target obstacle block on +X side so distance slider moves it visibly!
      const targetBlock = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.72, 0.75),
        new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45, metalness: 0.1 })
      );
      targetBlock.position.set(1.25, 0.42, 0);
      targetBlock.castShadow = !isSoftwareGl;
      group.add(targetBlock);
      animRefs.ultrasonicTarget = targetBlock;

      // 4 gold header pins along -X side facing ESP32
      const count = spec.terminals.length;
      const step = count > 1 ? 0.84 / (count - 1) : 0;
      spec.terminals.forEach((term, idx) => {
        const pz = count === 1 ? 0 : -0.42 + idx * step;
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.11), darkPlasticMat);
        base.position.set(-0.28, 0.15, pz);
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 8), goldMat);
        pin.position.set(-0.28, 0.24, pz);
        group.add(base, pin);
        terminalAnchors.set(term.id, new THREE.Vector3(-0.28, 0.36, pz));
      });
      break;
    }

    case 'servo': {
      const blueHousingMat = new THREE.MeshPhysicalMaterial({
        color: 0x0284c7,
        roughness: 0.28,
        metalness: 0.05,
        transmission: isSoftwareGl ? 0 : 0.35,
        transparent: true,
        opacity: 0.88,
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.92, 0.58), blueHousingMat);
      body.position.set(0, 0.46, 0);
      body.castShadow = !isSoftwareGl;
      const flange = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.1, 0.58), blueHousingMat);
      flange.position.set(0, 0.7, 0);
      const gearCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.18, 24), blueHousingMat);
      gearCollar.position.set(-0.26, 1.0, 0);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 16), silverMat);
      shaft.position.set(-0.26, 1.12, 0);
      group.add(body, flange, gearCollar, shaft);

      const hornGroup = new THREE.Group();
      hornGroup.position.set(-0.26, 1.19, 0);
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.42, metalness: 0.05 });
      const hornHub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 20), hornMat);
      const hornArm = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.14), hornMat);
      hornArm.position.x = 0.28;
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 12), silverMat);
      hornGroup.add(hornHub, hornArm, screw);
      group.add(hornGroup);
      animRefs.servoHornGroup = hornGroup;

      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.32, 0.32, 0.02, 0.42, goldMat, darkPlasticMat);
      break;
    }

    case 'relay': {
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.09, 1.15),
        new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.62, metalness: 0.12 })
      );
      pcb.position.y = 0.045;
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.62, 0.62),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.42, metalness: 0.06 })
      );
      cube.position.set(-0.18, 0.4, -0.08);
      cube.castShadow = !isSoftwareGl;

      const screwBlock = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.34, 0.72),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.55, metalness: 0.05 })
      );
      screwBlock.position.set(0.5, 0.26, -0.05);

      const relayLedMat = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: new THREE.Color(0x22c55e),
        emissiveIntensity: 0.1,
        roughness: 0.3,
      });
      const relayLed = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.08), relayLedMat);
      relayLed.position.set(0.25, 0.12, 0.35);
      animRefs.relayLedMat = relayLedMat;

      group.add(pcb, cube, screwBlock, relayLed);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.45, 0.15, 0.09, 0.48, goldMat, darkPlasticMat);
      break;
    }

    case 'rgb_neopixel': {
      const ringPcb = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.76, 32),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.62, metalness: 0.12, side: THREE.DoubleSide })
      );
      ringPcb.rotation.x = -Math.PI / 2;
      ringPcb.position.y = 0.08;
      const ringBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.76, 0.76, 0.07, 32),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.08 })
      );
      ringBase.position.y = 0.035;
      group.add(ringBase, ringPcb);

      const pixelMats: THREE.MeshStandardMaterial[] = [];
      for (let i = 0; i < 8; i += 1) {
        const ang = (i / 8) * Math.PI * 2;
        const pMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          emissive: new THREE.Color().setHSL(i / 8, 0.9, 0.5),
          emissiveIntensity: 0.9,
          roughness: 0.22,
        });
        pixelMats.push(pMat);
        const ledPkg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.07, 0.17), pMat);
        ledPkg.position.set(Math.cos(ang) * 0.58, 0.11, Math.sin(ang) * 0.58);
        ledPkg.rotation.y = -ang;
        group.add(ledPkg);
      }
      animRefs.neoPixelMats = pixelMats;
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.25, 0.25, 0.07, 0.65, goldMat, darkPlasticMat);
      break;
    }

    case 'potentiometer': {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 0.28, 0.92),
        new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5, metalness: 0.08 })
      );
      base.position.y = 0.14;
      const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 20), silverMat);
      bushing.position.y = 0.36;
      const shaftGroup = new THREE.Group();
      shaftGroup.position.y = 0.56;
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.36, 24), darkPlasticMat);
      const pointer = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.06, 0.24),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
      );
      pointer.position.set(0, 0.17, -0.1);
      shaftGroup.add(knob, pointer);
      animRefs.potShaftGroup = shaftGroup;
      group.add(base, bushing, shaftGroup);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.28, 0.28, 0.04, 0.48, goldMat, darkPlasticMat);
      break;
    }

    case 'buzzer': {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.46, 28), darkPlasticMat);
      cyl.position.y = 0.23;
      cyl.castShadow = !isSoftwareGl;
      const hole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.05, 16),
        new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.25, metalness: 0.85 })
      );
      hole.position.y = 0.45;
      const waves = new THREE.Group();
      for (let i = 0; i < 2; i += 1) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.24 + i * 0.18, 0.015, 8, 28),
          new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.45 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.58 + i * 0.16;
        waves.add(ring);
      }
      animRefs.buzzerWaves = waves;
      group.add(cyl, hole, waves);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.2, 0.2, 0.02, 0.46, goldMat, darkPlasticMat);
      break;
    }

    case 'button': {
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.08, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.1 })
      );
      pcb.position.y = 0.04;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.52), silverMat);
      body.position.y = 0.17;
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.16, 20),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, metalness: 0.05 })
      );
      cap.position.y = 0.32;
      animRefs.buttonCapMesh = cap;
      group.add(pcb, body, cap);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.22, 0.22, 0.08, 0.38, goldMat, darkPlasticMat);
      break;
    }

    case 'pir': {
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.09, 1.25),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.62, metalness: 0.12 })
      );
      pcb.position.y = 0.045;
      const domeMat = new THREE.MeshPhysicalMaterial({
        color: 0xf8fafc,
        emissive: new THREE.Color(0xf97316),
        emissiveIntensity: 0,
        roughness: 0.35,
        metalness: 0.02,
        flatShading: true,
      });
      const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 1), domeMat);
      dome.position.y = 0.14;
      dome.scale.set(1, 0.78, 1);
      animRefs.pirDomeMat = domeMat;
      group.add(pcb, dome);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.28, 0.28, 0.09, 0.54, goldMat, darkPlasticMat);
      break;
    }

    case 'bme280':
    case 'generic_module':
    default: {
      const tex = createModuleSilkscreenTexture(
        spec.name,
        spec.kind === 'bme280' ? '#581c87' : '#0f766e',
        spec.terminals.map((t) => t.label),
        maxAnisotropy
      );
      const pcb = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.09, 1.15),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0.12 })
      );
      pcb.position.y = 0.045;
      pcb.castShadow = !isSoftwareGl;
      const ic = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.09, 0.32),
        spec.kind === 'bme280' ? silverMat : darkPlasticMat
      );
      ic.position.set(0, 0.135, -0.05);
      group.add(pcb, ic);
      terminalAnchors = attachComponentHeaders(group, spec.terminals, -0.38, 0.38, 0.09, 0.48, goldMat, darkPlasticMat);
      break;
    }
  }

  // Attach interactive metadata to all child meshes for Raycasting + real-test click actions
  const interactiveAction: InspectableMeta['interactiveAction'] =
    spec.kind === 'button' ? 'button' : spec.kind === 'potentiometer' ? 'potentiometer' : undefined;

  const meta: InspectableMeta = {
    type: 'component',
    id: spec.id,
    title: spec.name,
    subtitle:
      spec.kind === 'button'
        ? `${spec.subtitle} · Click 3D button to press!`
        : spec.kind === 'potentiometer'
          ? `${spec.subtitle} · Click 3D knob to turn!`
          : spec.subtitle,
    detail: spec.terminals.map((t) => `${t.label} → ${t.espPinLabel}`).join('  |  '),
    interactiveAction,
    focusTarget: [spec.position.x, 0.35, spec.position.z],
  };
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.userData.inspectInfo = meta;
    }
  });

  return {
    id: spec.id,
    spec,
    group,
    baseY: 0,
    terminalAnchors,
    animRefs,
  };
}

export function buildJumperWire(
  wireSpec: CircuitWireSpec,
  startBoardLocal: THREE.Vector3,
  endCompWorld: THREE.Vector3,
  wireIndex: number,
  isSoftwareGl: boolean
): BuiltWire {
  const group = new THREE.Group();

  const dist = startBoardLocal.distanceTo(endCompWorld);
  const archHeight = Math.min(2.1, 0.72 + dist * 0.22 + (wireIndex % 4) * 0.14);
  const zSpread = ((wireIndex % 5) - 2) * 0.075;
  const mid1 = new THREE.Vector3().lerpVectors(startBoardLocal, endCompWorld, 0.26);
  mid1.y = Math.max(startBoardLocal.y, endCompWorld.y) + archHeight * 0.86;
  mid1.z += zSpread;
  const mid2 = new THREE.Vector3().lerpVectors(startBoardLocal, endCompWorld, 0.74);
  mid2.y = Math.max(startBoardLocal.y, endCompWorld.y) + archHeight * 0.92;
  mid2.z += zSpread * 0.6;

  const pStartTip = startBoardLocal.clone().add(new THREE.Vector3(0, 0.12, 0));
  const pEndTip = endCompWorld.clone().add(new THREE.Vector3(0, 0.12, 0));

  const curve = new THREE.CatmullRomCurve3([pStartTip, mid1, mid2, pEndTip]);
  const tubeGeo = new THREE.TubeGeometry(curve, 36, 0.026, 10, false);
  const tubeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(wireSpec.colorHex),
    roughness: 0.45,
    metalness: 0.05,
  });
  const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
  tubeMesh.castShadow = !isSoftwareGl;

  const bootGeo = new THREE.BoxGeometry(0.11, 0.22, 0.11);
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.78, metalness: 0.05 });
  const startBoot = new THREE.Mesh(bootGeo, bootMat);
  startBoot.position.copy(startBoardLocal).add(new THREE.Vector3(0, 0.05, 0));
  const endBoot = new THREE.Mesh(bootGeo, bootMat);
  endBoot.position.copy(endCompWorld).add(new THREE.Vector3(0, 0.05, 0));

  const pulseMat = new THREE.MeshBasicMaterial({
    color: wireSpec.signalKind === 'power' ? 0xfca5a5 : 0x5eead4,
    transparent: true,
    opacity: wireSpec.signalKind === 'ground' ? 0 : 0.9,
  });
  const pulseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 12), pulseMat);
  pulseMesh.visible = wireSpec.signalKind !== 'ground';

  const wireMid = curve.getPointAt(0.5);
  const meta: InspectableMeta = {
    type: 'wire',
    id: wireSpec.id,
    title: `${wireSpec.componentName} (${wireSpec.componentTerminalLabel}) ↔ ${wireSpec.espPinLabel}`,
    subtitle: `${wireSpec.signalKind.toUpperCase()} Wire`,
    detail: wireSpec.note,
    colorHex: wireSpec.colorHex,
    focusTarget: [wireMid.x, wireMid.y * 0.7, wireMid.z],
  };
  tubeMesh.userData.inspectInfo = meta;
  startBoot.userData.inspectInfo = meta;
  endBoot.userData.inspectInfo = meta;

  group.add(tubeMesh, startBoot, endBoot, pulseMesh);

  return {
    spec: wireSpec,
    group,
    curve,
    tubeMesh,
    tubeMat,
    pulseMesh,
    pulseMat,
  };
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => {
        disposeMaterialTextures(m);
        m.dispose();
      });
    } else if (mat) {
      disposeMaterialTextures(mat);
      mat.dispose();
    }
  });
}

function disposeMaterialTextures(mat: THREE.Material): void {
  const std = mat as THREE.MeshStandardMaterial;
  std.map?.dispose();
  std.emissiveMap?.dispose();
  std.normalMap?.dispose();
  std.roughnessMap?.dispose();
  std.metalnessMap?.dispose();
}
