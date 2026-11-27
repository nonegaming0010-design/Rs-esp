import {
  ArrowLeft,
  Box,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Eye,
  Layers,
  Pause,
  Play,
  Plus,
  Power,
  RotateCcw,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  buildComponentModel,
  buildEspBoardModel,
  buildJumperWire,
  disposeObject3D,
  type BuiltComponent,
  type BuiltEspBoard,
  type BuiltWire,
  type InspectableMeta,
} from '../three/espHardwareBuilder';
import {
  createWorkbenchMatTexture,
  drawOledCanvas,
  drawSevenSegCanvas,
} from '../three/proceduralTextures';
import type { EspBoard, FrameworkId, WiringItem } from '../types/esp';
import { analyzeCircuitFor3d, type CircuitWireSpec } from '../utils/circuit3dModel';
import {
  DEFAULT_SIM_ENV,
  evaluateRealTestSimulation,
  type SimEnvironmentState,
} from '../utils/circuitSimEngine';

interface Circuit3dPreviewProps {
  title: string;
  board: EspBoard;
  code: string;
  wiring: WiringItem[];
  framework: FrameworkId;
  isDark: boolean;
  isPhoneView?: boolean;
  onBackToStudio: () => void;
}

type CameraPresetId = 'iso' | 'top' | 'pins' | 'esp';

const CAMERA_PRESETS: Record<
  CameraPresetId,
  { pos: [number, number, number]; target: [number, number, number]; label: string }
> = {
  iso: { pos: [0.6, 5.9, 7.8], target: [0.55, 0.2, 0.45], label: '3D View' },
  top: { pos: [0.4, 8.6, 0.4], target: [0.4, 0.2, 0], label: 'Top Pins' },
  pins: { pos: [-3.4, 2.5, 4.4], target: [-0.8, 0.45, 0.2], label: 'Pin Headers' },
  esp: { pos: [-1.45, 2.8, 3.6], target: [-1.45, 0.3, 0], label: 'ESP Focus' },
};

interface QuickAddPreset {
  id: string;
  label: string;
  wiringItems: WiringItem[];
}

const QUICK_ADD_PRESETS: QuickAddPreset[] = [
  {
    id: 'led',
    label: '+ LED Light',
    wiringItems: [
      { from: 'External LED +', to: 'GPIO 12', note: 'Test LED via 220Ω resistor' },
      { from: 'External LED GND', to: 'GND', note: 'Common ground' },
    ],
  },
  {
    id: 'lamp',
    label: '+ Bulb Lamp',
    wiringItems: [
      { from: 'Smart Lamp DATA', to: 'GPIO 26', note: 'Switched lamp output' },
    ],
  },
  {
    id: 'rgb',
    label: '+ RGB LED',
    wiringItems: [
      { from: 'Red Pin', to: 'GPIO 25', note: 'Red channel' },
      { from: 'Green Pin', to: 'GPIO 26', note: 'Green channel' },
      { from: 'Blue Pin', to: 'GPIO 27', note: 'Blue channel' },
      { from: 'Common Cathode', to: 'GND', note: 'Common cathode' },
    ],
  },
  {
    id: 'oled',
    label: '+ OLED 0.96"',
    wiringItems: [
      { from: 'SSD1306 OLED SDA', to: 'GPIO 21', note: 'I2C Data' },
      { from: 'SSD1306 OLED SCL', to: 'GPIO 22', note: 'I2C Clock' },
    ],
  },
  {
    id: 'dht11',
    label: '+ DHT11 Sensor',
    wiringItems: [{ from: 'DHT11 DATA', to: 'GPIO 4', note: 'Temp & humidity bus' }],
  },
  {
    id: 'dht22',
    label: '+ DHT22 Sensor',
    wiringItems: [{ from: 'DHT22 DATA', to: 'GPIO 4', note: 'Precision temp & humidity bus' }],
  },
  {
    id: 'ldr',
    label: '+ Light Sensor',
    wiringItems: [{ from: 'LDR Light Sensor AOUT', to: 'GPIO 34', note: 'Analog lux divider' }],
  },
  {
    id: 'ultrasonic',
    label: '+ Ultrasonic',
    wiringItems: [{ from: 'HC-SR04 TRIG/ECHO', to: 'GPIO 5 / 18', note: 'Distance trigger & echo' }],
  },
  {
    id: 'servo',
    label: '+ Servo',
    wiringItems: [{ from: 'SG90 Servo SIG', to: 'GPIO 13', note: '50Hz PWM signal' }],
  },
  {
    id: 'button',
    label: '+ Button',
    wiringItems: [{ from: 'Push Button', to: 'GPIO 14 & GND', note: 'Internal pull-up input' }],
  },
  {
    id: 'pot',
    label: '+ Potentiometer',
    wiringItems: [{ from: 'Potentiometer AOUT', to: 'GPIO 35', note: 'ADC1 analog wiper' }],
  },
];

// Pre-allocated scratch helpers (zero GC inside animation loop)
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _pulsePos = new THREE.Vector3();
const _wireColor = new THREE.Color();

export function Circuit3dPreview({
  title,
  board,
  code,
  wiring,
  framework,
  isDark,
  isPhoneView = false,
  onBackToStudio,
}: Circuit3dPreviewProps) {
  const [extraWiring, setExtraWiring] = useState<WiringItem[]>([]);
  const combinedWiring = useMemo(() => [...wiring, ...extraWiring], [wiring, extraWiring]);

  // Reset quick-added bench parts when switching projects/sketches
  useEffect(() => {
    setExtraWiring([]);
  }, [title]);

  const analysis = useMemo(
    () => analyzeCircuitFor3d(board, code, combinedWiring, framework),
    [board, code, combinedWiring, framework]
  );

  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [explodePct, setExplodePct] = useState<number>(0);
  const [showSignalFlow, setShowSignalFlow] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [dockTab, setDockTab] = useState<'none' | 'wires' | 'bench'>('none');
  const [selectedMeta, setSelectedMeta] = useState<InspectableMeta | null>(null);
  const [highlightedWireId, setHighlightedWireId] = useState<string | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{
    id: string;
    title: string;
    subtitle: string;
    colorHex?: string;
    x: number;
    y: number;
  } | null>(null);

  const [envState, setEnvState] = useState<SimEnvironmentState>(DEFAULT_SIM_ENV);
  const [serialReadout, setSerialReadout] = useState<string>('Booting simulated ESP...');
  const lastSerialTextRef = useRef<string>('');

  // Mutable refs read by the persistent WebGL animation loop
  const simStateRef = useRef({
    isPlaying: true,
    simSpeed: 1,
    explodeTarget: 0,
    explodeCurrent: 0,
    showSignalFlow: true,
    highlightedWireId: null as string | null,
    hoveredWireId: null as string | null,
    isDark,
    env: DEFAULT_SIM_ENV,
    simElapsed: 0,
    forceUiSync: true,
  });

  const sceneRefs = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    renderer: THREE.WebGLRenderer;
    isSoftwareGl: boolean;
    maxAnisotropy: number;
    circuitRoot: THREE.Group;
    benchMatMesh: THREE.Mesh;
    boardBuilt: BuiltEspBoard | null;
    componentsBuilt: BuiltComponent[];
    wiresBuilt: BuiltWire[];
    cameraAnim: { active: boolean; pos: THREE.Vector3; target: THREE.Vector3 };
  } | null>(null);

  useEffect(() => {
    simStateRef.current.isPlaying = isPlaying;
    simStateRef.current.simSpeed = simSpeed;
    simStateRef.current.explodeTarget = explodePct / 100;
    simStateRef.current.showSignalFlow = showSignalFlow;
    simStateRef.current.highlightedWireId = highlightedWireId;
    simStateRef.current.isDark = isDark;
    simStateRef.current.env = envState;
    simStateRef.current.forceUiSync = true;
  }, [isPlaying, simSpeed, explodePct, showSignalFlow, highlightedWireId, isDark, envState]);

  const contextRef = useRef({ board, code, analysis });
  useEffect(() => {
    contextRef.current = { board, code, analysis };
    simStateRef.current.forceUiSync = true;
  }, [board, code, analysis]);

  // Immediately update HUD serial output & display textures when bench sliders or components change
  useEffect(() => {
    const frame = evaluateRealTestSimulation(
      board,
      code,
      analysis,
      envState,
      simStateRef.current.simElapsed
    );
    if (frame.serialOutput !== lastSerialTextRef.current) {
      lastSerialTextRef.current = frame.serialOutput;
      setSerialReadout(frame.serialOutput);
    }
    const refs = sceneRefs.current;
    if (refs) {
      for (const comp of refs.componentsBuilt) {
        if (comp.animRefs.oledCanvasCtx && comp.animRefs.oledTexture) {
          drawOledCanvas(
            comp.animRefs.oledCanvasCtx,
            frame.displayLines,
            simStateRef.current.simElapsed,
            comp.animRefs.isLcd
          );
          comp.animRefs.oledTexture.needsUpdate = true;
        }
        if (comp.animRefs.sevenSegCtx && comp.animRefs.sevenSegTex) {
          drawSevenSegCanvas(comp.animRefs.sevenSegCtx, frame.sevenSegText);
          comp.animRefs.sevenSegTex.needsUpdate = true;
        }
      }
    }
  }, [board, code, analysis, envState]);

  // 1. Initialize Three.js WebGL scene ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGL 3D acceleration is unavailable in this browser.');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(320, container.clientHeight);
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('3D GPU context was interrupted. Reload or switch tabs to restore.');
    };
    const handleContextRestored = () => setWebglError(null);
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    const bgHex = simStateRef.current.isDark ? 0x0f1419 : 0xe7e5e4;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.Fog(bgHex, 15, 34);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(...CAMERA_PRESETS.iso.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.iso.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 2.2;
    controls.maxDistance = 16;

    const cameraAnim = {
      active: false,
      pos: new THREE.Vector3(...CAMERA_PRESETS.iso.pos),
      target: new THREE.Vector3(...CAMERA_PRESETS.iso.target),
    };
    controls.addEventListener('start', () => {
      cameraAnim.active = false;
    });

    // 3-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x334155, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.85);
    keyLight.position.set(5.5, 9.5, 6.0);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -7;
    keyLight.shadow.camera.right = 7;
    keyLight.shadow.camera.top = 7;
    keyLight.shadow.camera.bottom = -7;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    rimLight.position.set(-6, 5, -6);
    scene.add(rimLight);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const benchTex = createWorkbenchMatTexture(simStateRef.current.isDark, maxAnisotropy);
    const benchMat = new THREE.MeshStandardMaterial({
      map: benchTex,
      roughness: 0.85,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const benchMatMesh = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), benchMat);
    benchMatMesh.rotation.x = -Math.PI / 2;
    benchMatMesh.position.y = 0;
    benchMatMesh.receiveShadow = true;
    scene.add(benchMatMesh);

    const circuitRoot = new THREE.Group();
    scene.add(circuitRoot);

    sceneRefs.current = {
      scene,
      camera,
      controls,
      renderer,
      isSoftwareGl,
      maxAnisotropy,
      circuitRoot,
      benchMatMesh,
      boardBuilt: null,
      componentsBuilt: [],
      wiresBuilt: [],
      cameraAnim,
    };

    // Raycaster for hover tooltip + click inspection + direct 3D testing (Button / Pot / USB Power)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverCheckMs = 0;
    let lastHoveredId: string | null = null;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons !== 0) {
        if (lastHoveredId !== null) {
          lastHoveredId = null;
          simStateRef.current.hoveredWireId = null;
          setHoverTooltip(null);
        }
        return;
      }
      const now = performance.now();
      if (now - lastHoverCheckMs < 45) return;
      lastHoverCheckMs = now;

      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(circuitRoot.children, true);
      const hitWithMeta = hits.find((h) => h.object.userData?.inspectInfo);

      if (hitWithMeta) {
        const info = hitWithMeta.object.userData.inspectInfo as InspectableMeta;
        renderer.domElement.style.cursor = 'pointer';
        simStateRef.current.hoveredWireId = info.type === 'wire' ? info.id : null;
        const clampedX = Math.min(Math.max(12, e.clientX - rect.left + 14), rect.width - 240);
        const clampedY = Math.min(Math.max(12, e.clientY - rect.top - 12), rect.height - 72);
        lastHoveredId = info.id;
        setHoverTooltip({
          id: info.id,
          title: info.title,
          subtitle: info.subtitle,
          colorHex: info.colorHex,
          x: clampedX,
          y: clampedY,
        });
      } else {
        renderer.domElement.style.cursor = 'grab';
        if (lastHoveredId !== null) {
          lastHoveredId = null;
          simStateRef.current.hoveredWireId = null;
          setHoverTooltip(null);
        }
      }
    };

    const onPointerLeave = () => {
      renderer.domElement.style.cursor = 'grab';
      lastHoveredId = null;
      simStateRef.current.hoveredWireId = null;
      setHoverTooltip(null);
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(circuitRoot.children, true);
      const hitWithMeta = hits.find((h) => h.object.userData?.inspectInfo);
      if (hitWithMeta) {
        const info = hitWithMeta.object.userData.inspectInfo as InspectableMeta;
        setSelectedMeta(info);
        setHighlightedWireId(info.type === 'wire' ? info.id : null);

        if (info.interactiveAction === 'button') {
          setEnvState((prev) => ({
            ...prev,
            buttonPressed: !prev.buttonPressed,
            buttonLatch: !prev.buttonLatch,
          }));
        } else if (info.interactiveAction === 'potentiometer') {
          setEnvState((prev) => ({
            ...prev,
            potentiometerPct: (prev.potentiometerPct + 20) % 120 > 100 ? 0 : (prev.potentiometerPct + 20) % 105,
          }));
        } else if (info.interactiveAction === 'power') {
          setEnvState((prev) => ({ ...prev, powered: !prev.powered }));
        }
      } else {
        setSelectedMeta(null);
        setHighlightedWireId(null);
      }
    };
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = Math.max(320, mountRef.current.clientWidth);
      const h = Math.max(320, mountRef.current.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const timer = new THREE.Timer();
    timer.connect(document);
    let lastDisplayRedraw = -1;
    let lastSerialUpdate = -1;
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (sync && state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick(timestamp?: number) {
      if (disposed) return;
      timer.update(timestamp);
      const delta = Math.min(0.25, timer.getDelta());
      const state = simStateRef.current;
      const refs = sceneRefs.current;
      if (!refs) return;

      state.explodeCurrent = THREE.MathUtils.damp(
        state.explodeCurrent,
        state.explodeTarget,
        7.5,
        delta
      );

      if (refs.cameraAnim.active) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, refs.cameraAnim.pos.x, 6.5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, refs.cameraAnim.pos.y, 6.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, refs.cameraAnim.pos.z, 6.5, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, refs.cameraAnim.target.x, 6.5, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, refs.cameraAnim.target.y, 6.5, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, refs.cameraAnim.target.z, 6.5, delta);

        if (
          camera.position.distanceTo(_camGoalPos.copy(refs.cameraAnim.pos)) < 0.03 &&
          controls.target.distanceTo(_camGoalTarget.copy(refs.cameraAnim.target)) < 0.03
        ) {
          refs.cameraAnim.active = false;
        }
      }

      controls.update();

      if (state.isPlaying && state.env.powered) {
        state.simElapsed += delta * state.simSpeed;
      }

      const ctxInfo = contextRef.current;
      const frame = evaluateRealTestSimulation(
        ctxInfo.board,
        ctxInfo.code,
        ctxInfo.analysis,
        state.env,
        state.simElapsed
      );

      const needsDisplayRedraw = state.forceUiSync || state.simElapsed - lastDisplayRedraw > 0.25;
      if (
        (state.forceUiSync || state.simElapsed - lastSerialUpdate > 0.35 || !state.env.powered) &&
        frame.serialOutput !== lastSerialTextRef.current
      ) {
        lastSerialUpdate = state.simElapsed;
        lastSerialTextRef.current = frame.serialOutput;
        setSerialReadout(frame.serialOutput);
      }

      // Update ESP Board LEDs & Wi-Fi indicator
      if (refs.boardBuilt) {
        const ledB = state.env.powered ? frame.onboardLedBrightness : 0;
        refs.boardBuilt.powerLedMat.emissiveIntensity = state.env.powered ? 1.3 : 0.02;
        refs.boardBuilt.onboardLedMat.emissiveIntensity = 0.05 + ledB * 2.2;
        refs.boardBuilt.onboardLedGlowMat.opacity = ledB * 0.55;

        if (ctxInfo.analysis.simulation.usesOnboardRgb && state.env.powered) {
          refs.boardBuilt.rgbLedMat.emissive.setRGB(...frame.rgbColor);
          refs.boardBuilt.rgbLedMat.emissiveIntensity = 2.0;
        } else {
          refs.boardBuilt.rgbLedMat.emissiveIntensity = 0;
        }
        refs.boardBuilt.wifiArcMat.opacity =
          state.env.powered && ctxInfo.analysis.simulation.hasWifi
            ? 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(state.simElapsed * 4.5))
            : 0;
      }

      // Update every 3D hardware component from real simulated pin & environment state
      for (const comp of refs.componentsBuilt) {
        comp.group.position.y = state.explodeCurrent * 0.9;

        const firstGpio = comp.spec.terminals.find((t) => t.gpio !== null)?.gpio ?? null;
        const compDuty = !state.env.powered
          ? 0
          : firstGpio !== null && frame.pinDuty[firstGpio] !== undefined
            ? frame.pinDuty[firstGpio]
            : frame.onboardLedBrightness;

        if (comp.animRefs.ledDomeMat) {
          comp.animRefs.ledDomeMat.emissiveIntensity = 0.05 + compDuty * 2.3;
          if (comp.animRefs.ledGlowMat) {
            comp.animRefs.ledGlowMat.opacity = compDuty * 0.6;
          }
        }
        if (comp.animRefs.rgbDomeMat) {
          const [r, g, b] = state.env.powered ? frame.rgbColor : [0, 0, 0];
          comp.animRefs.rgbDomeMat.emissive.setRGB(r, g, b);
          comp.animRefs.rgbDomeMat.emissiveIntensity = state.env.powered ? 1.75 : 0.04;
          if (comp.animRefs.rgbGlowMat) {
            comp.animRefs.rgbGlowMat.color.setRGB(r, g, b);
            comp.animRefs.rgbGlowMat.opacity = state.env.powered ? 0.55 : 0;
          }
        }
        if (comp.animRefs.trafficMats) {
          comp.animRefs.trafficMats.red.emissiveIntensity = 0.05 + frame.trafficState.red * 2.2;
          comp.animRefs.trafficMats.yellow.emissiveIntensity = 0.05 + frame.trafficState.yellow * 2.2;
          comp.animRefs.trafficMats.green.emissiveIntensity = 0.05 + frame.trafficState.green * 2.2;
        }
        if (comp.animRefs.lampBulbMat) {
          comp.animRefs.lampBulbMat.emissiveIntensity = 0.06 + frame.lampBrightness * 2.4;
          if (comp.animRefs.lampGlowMat) {
            comp.animRefs.lampGlowMat.opacity = frame.lampBrightness * 0.72;
          }
        }
        if (comp.animRefs.servoHornGroup) {
          comp.animRefs.servoHornGroup.rotation.y = THREE.MathUtils.degToRad(frame.servoAngleDeg - 90);
        }
        if (comp.animRefs.stepperRotorGroup) {
          comp.animRefs.stepperRotorGroup.rotation.y = frame.stepperAngleRad;
          comp.animRefs.stepperLedMats?.forEach((m, idx) => {
            const activeStep = Math.floor((state.simElapsed * 6) % 4) === idx;
            m.emissiveIntensity = state.env.powered && activeStep ? 1.8 : 0.08;
          });
        }
        if (comp.animRefs.relayLedMat) {
          comp.animRefs.relayLedMat.emissiveIntensity = frame.relayOn ? 2.1 : 0.06;
        }
        if (comp.animRefs.potShaftGroup) {
          const potRad = THREE.MathUtils.lerp(-2.2, 2.2, state.env.potentiometerPct / 100);
          comp.animRefs.potShaftGroup.rotation.y = potRad;
        }
        if (comp.animRefs.buttonCapMesh) {
          comp.animRefs.buttonCapMesh.position.y = state.env.buttonPressed ? 0.275 : 0.32;
        }
        if (comp.animRefs.pirDomeMat) {
          comp.animRefs.pirDomeMat.emissiveIntensity = state.env.motionDetected ? 0.65 : 0.0;
        }
        if (comp.animRefs.sensorLedMat) {
          const active =
            (comp.spec.kind === 'light_sensor' && state.env.lightLux < 300) ||
            (comp.spec.kind === 'gas_sensor' && state.env.gasPpm > 400);
          comp.animRefs.sensorLedMat.emissiveIntensity = state.env.powered && active ? 1.9 : 0.15;
        }
        if (comp.animRefs.buzzerWaves) {
          comp.animRefs.buzzerWaves.visible = frame.buzzerActive;
          comp.animRefs.buzzerWaves.scale.setScalar(1 + 0.14 * Math.sin(state.simElapsed * 16));
        }
        if (comp.animRefs.ultrasonicWaves) {
          comp.animRefs.ultrasonicWaves.visible = state.env.powered;
          comp.animRefs.ultrasonicWaves.scale.setScalar(0.95 + 0.16 * ((state.simElapsed * 1.5) % 1));
        }
        if (comp.animRefs.ultrasonicTarget) {
          const xDist = 0.72 + (Math.min(180, Math.max(4, state.env.distanceCm)) / 180) * 1.55;
          comp.animRefs.ultrasonicTarget.position.x = xDist;
        }
        if (comp.animRefs.neoPixelMats) {
          comp.animRefs.neoPixelMats.forEach((pMat, idx) => {
            pMat.emissive.setHSL((state.simElapsed * 0.35 + idx / 8) % 1, 0.95, 0.5);
            pMat.emissiveIntensity = state.env.powered ? 1.65 : 0.02;
          });
        }

        if (
          (comp.animRefs.oledCanvasCtx || comp.animRefs.sevenSegCtx) &&
          needsDisplayRedraw
        ) {
          if (comp.animRefs.oledCanvasCtx && comp.animRefs.oledTexture) {
            drawOledCanvas(
              comp.animRefs.oledCanvasCtx,
              frame.displayLines,
              state.simElapsed,
              comp.animRefs.isLcd
            );
            comp.animRefs.oledTexture.needsUpdate = true;
          }
          if (comp.animRefs.sevenSegCtx && comp.animRefs.sevenSegTex) {
            drawSevenSegCanvas(comp.animRefs.sevenSegCtx, frame.sevenSegText);
            comp.animRefs.sevenSegTex.needsUpdate = true;
          }
        }
      }
      if (needsDisplayRedraw) {
        lastDisplayRedraw = state.simElapsed;
      }
      state.forceUiSync = false;

      // Update Jumper Wires (lift + selected/hovered highlight + traveling signal pulse)
      refs.wiresBuilt.forEach((wire, wIdx) => {
        wire.group.position.y = state.explodeCurrent * 1.5;

        const isHighlighted = state.highlightedWireId === wire.spec.id;
        const isHovered = state.hoveredWireId === wire.spec.id;
        _wireColor.set(wire.spec.colorHex);
        wire.tubeMat.emissive.copy(_wireColor);
        wire.tubeMat.emissiveIntensity = isHighlighted ? 0.65 : isHovered ? 0.35 : 0.04;

        const showBead =
          state.env.powered && state.showSignalFlow && wire.spec.signalKind !== 'ground';
        wire.pulseMesh.visible = showBead;
        if (showBead) {
          const t = (state.simElapsed * (wire.spec.signalKind === 'power' ? 0.55 : 0.85) + wIdx * 0.17) % 1;
          wire.curve.getPointAt(t, _pulsePos);
          wire.pulseMesh.position.copy(_pulsePos);
        }
      });

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    if (isSoftwareGl) {
      frameId = window.setTimeout(() => tick(), 16);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      timer.dispose();
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.dispose();
      disposeObject3D(scene);
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRefs.current = null;
    };
  }, []);

  // 2. Rebuild 3D circuit geometry whenever board, code, or wiring changes
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    disposeObject3D(refs.circuitRoot);
    refs.circuitRoot.clear();

    const activeGpios = new Set<number>();
    const activeRails = new Set<string>();
    for (const w of analysis.wires) {
      if (w.espGpio !== null) activeGpios.add(w.espGpio);
      if (w.espRail) activeRails.add(w.espRail);
    }

    const boardOffsetX = analysis.components.length > 0 ? -1.45 : 0;
    const boardBuilt = buildEspBoardModel(
      board,
      refs.isSoftwareGl,
      refs.maxAnisotropy,
      { gpios: activeGpios, rails: activeRails },
      boardOffsetX
    );
    boardBuilt.group.position.set(boardOffsetX, 0, 0);
    refs.circuitRoot.add(boardBuilt.group);
    refs.boardBuilt = boardBuilt;

    const builtComponents: BuiltComponent[] = [];
    const compMap = new Map<string, BuiltComponent>();

    analysis.components.forEach((compSpec) => {
      const built = buildComponentModel(compSpec, refs.isSoftwareGl, refs.maxAnisotropy);
      refs.circuitRoot.add(built.group);
      builtComponents.push(built);
      compMap.set(compSpec.id, built);
    });
    refs.componentsBuilt = builtComponents;

    const builtWires: BuiltWire[] = [];
    analysis.wires.forEach((wireSpec, idx) => {
      const compBuilt = compMap.get(wireSpec.componentId);
      if (!compBuilt) return;

      const compLocalAnchor = compBuilt.terminalAnchors.get(wireSpec.componentTerminalId);
      if (!compLocalAnchor) return;
      const endWorld = compLocalAnchor.clone().add(compBuilt.group.position);

      let boardLocalAnchor: THREE.Vector3 | undefined;
      if (wireSpec.espRail) {
        boardLocalAnchor = boardBuilt.railAnchors[wireSpec.espRail];
      } else if (wireSpec.espGpio !== null) {
        boardLocalAnchor = boardBuilt.gpioPinAnchors.get(wireSpec.espGpio);
      }
      if (!boardLocalAnchor) {
        boardLocalAnchor =
          boardBuilt.gpioPinAnchors.get(board.defaultLedPin) ?? boardBuilt.railAnchors['3v3'];
      }
      const startWorld = boardLocalAnchor.clone().add(boardBuilt.group.position);

      const wireBuilt = buildJumperWire(wireSpec, startWorld, endWorld, idx, refs.isSoftwareGl);
      refs.circuitRoot.add(wireBuilt.group);
      builtWires.push(wireBuilt);
    });
    refs.wiresBuilt = builtWires;

    if (!refs.isSoftwareGl) {
      refs.renderer.compile(refs.scene, refs.camera);
    }
    refs.controls.update();
    refs.renderer.render(refs.scene, refs.camera);
  }, [analysis, board]);

  // 3. Update background, fog, and workbench mat when theme switches
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const bgHex = isDark ? 0x0f1419 : 0xe7e5e4;
    refs.scene.background = new THREE.Color(bgHex);
    refs.scene.fog = new THREE.Fog(bgHex, 15, 34);
    const mat = refs.benchMatMesh.material as THREE.MeshStandardMaterial;
    const oldMap = mat.map;
    mat.map = createWorkbenchMatTexture(isDark, refs.maxAnisotropy);
    mat.needsUpdate = true;
    oldMap?.dispose();
  }, [isDark]);

  const handleCameraPreset = (presetId: CameraPresetId) => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const preset = CAMERA_PRESETS[presetId];
    refs.cameraAnim.pos.set(...preset.pos);
    refs.cameraAnim.target.set(...preset.target);
    refs.cameraAnim.active = true;
  };

  const handleFocusTarget = (target: [number, number, number]) => {
    const refs = sceneRefs.current;
    if (!refs) return;
    refs.cameraAnim.target.set(target[0], target[1], target[2]);
    refs.cameraAnim.pos.set(target[0] + 1.15, target[1] + 2.35, target[2] + 2.75);
    refs.cameraAnim.active = true;
  };

  const handleSelectWireFromLegend = (wire: CircuitWireSpec) => {
    const built = sceneRefs.current?.wiresBuilt.find((w) => w.spec.id === wire.id);
    const mid = built ? built.curve.getPointAt(0.5) : null;
    setHighlightedWireId((prev) => (prev === wire.id ? null : wire.id));
    setSelectedMeta({
      type: 'wire',
      id: wire.id,
      title: `${wire.componentName} (${wire.componentTerminalLabel}) ↔ ${wire.espPinLabel}`,
      subtitle: `${wire.signalKind.toUpperCase()} Jumper Wire`,
      detail: wire.note,
      colorHex: wire.colorHex,
      focusTarget: mid ? [mid.x, mid.y * 0.7, mid.z] : undefined,
    });
  };

  const handleAddQuickPreset = (preset: QuickAddPreset) => {
    setExtraWiring((prev) => [...prev, ...preset.wiringItems]);
  };

  return (
    <section aria-label="3D Hardware & Code Preview" className="space-y-3">
      <div
        className={`relative w-full overflow-hidden rounded-lg border border-stone-300 bg-stone-200 dark:border-stone-800 dark:bg-stone-950 ${
          isPhoneView ? 'h-[520px] min-h-[480px]' : 'h-[calc(100vh-195px)] min-h-[560px]'
        }`}
      >
        {webglError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="font-display text-base font-semibold text-stone-800 dark:text-stone-100">
              3D Preview Unavailable
            </p>
            <p className="max-w-md text-xs text-stone-600 dark:text-stone-400">{webglError}</p>
            <button
              type="button"
              onClick={onBackToStudio}
              className="rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Back to Code Studio
            </button>
          </div>
        ) : (
          <div ref={mountRef} data-testid="circuit-3d-canvas" className="h-full w-full" />
        )}

        {/* Non-blocking 3D Hover Tooltip */}
        {hoverTooltip && !webglError && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute z-20 max-w-[230px] rounded border border-stone-300 px-2.5 py-1.5 shadow-md dark:border-stone-700"
            style={{
              left: `${hoverTooltip.x}px`,
              top: `${hoverTooltip.y}px`,
              backgroundColor: isDark ? 'rgba(17, 24, 39, 0.94)' : 'rgba(255, 255, 255, 0.95)',
            }}
          >
            <div className="flex items-center gap-1.5">
              {hoverTooltip.colorHex && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full border border-black/20"
                  style={{ backgroundColor: hoverTooltip.colorHex }}
                />
              )}
              <p className="truncate text-[11px] font-semibold text-stone-900 dark:text-stone-100">
                {hoverTooltip.title}
              </p>
            </div>
            <p className="truncate text-[10px] text-teal-700 dark:text-teal-300">
              {hoverTooltip.subtitle}
            </p>
          </div>
        )}

        {/* Top-Left HUD: Sketch Info + Live Simulated Serial Stream + Selection Card */}
        <div
          className={`pointer-events-none absolute left-2.5 top-2.5 z-10 space-y-2 ${
            isPhoneView ? 'right-2.5' : 'max-w-md left-3 top-3'
          }`}
        >
          <div
            className="pointer-events-auto rounded-md border border-stone-300/90 px-3.5 py-2 shadow-sm dark:border-stone-700"
            style={{
              backgroundColor: isDark ? 'rgba(20, 25, 31, 0.92)' : 'rgba(255, 255, 255, 0.92)',
            }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBackToStudio}
                className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
              >
                <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                <span>Code</span>
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-display text-sm font-semibold text-stone-900 dark:text-stone-50">
                  {title}
                </h1>
                <p className="truncate text-[11px] text-stone-600 dark:text-stone-400">
                  {board.shortName} · {analysis.components.length} external component{analysis.components.length === 1 ? '' : 's'} · {analysis.wires.length} wire{analysis.wires.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnvState((p) => ({ ...p, powered: !p.powered }))}
                title="Toggle USB Power"
                className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold ${
                  envState.powered
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                }`}
              >
                <Power className="h-3 w-3" aria-hidden="true" />
                <span>{envState.powered ? 'USB ON' : 'OFF'}</span>
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-stone-200/80 pt-1.5 dark:border-stone-800">
              <span className="truncate text-[11px] font-medium text-teal-800 dark:text-teal-300">
                {analysis.simulation.summaryAction}
              </span>
              <span className="shrink-0 rounded bg-stone-900 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                {serialReadout}
              </span>
            </div>
          </div>

          {selectedMeta && (
            <div
              className="pointer-events-auto rounded-md border border-teal-600/70 px-3.5 py-2 text-xs shadow-sm"
              style={{
                backgroundColor: isDark ? 'rgba(17, 24, 39, 0.94)' : 'rgba(255, 255, 255, 0.95)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {selectedMeta.colorHex && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/20"
                      style={{ backgroundColor: selectedMeta.colorHex }}
                    />
                  )}
                  <span className="truncate font-semibold text-stone-900 dark:text-stone-100">
                    {selectedMeta.title}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedMeta.focusTarget && (
                    <button
                      type="button"
                      onClick={() => handleFocusTarget(selectedMeta.focusTarget!)}
                      className="inline-flex items-center gap-1 rounded border border-teal-600/60 bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800 hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300"
                    >
                      <Crosshair className="h-2.5 w-2.5" aria-hidden="true" />
                      <span>Focus</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMeta(null);
                      setHighlightedWireId(null);
                    }}
                    className="text-[11px] text-stone-500 hover:text-stone-800 dark:text-stone-400"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300">
                {selectedMeta.subtitle}
              </p>
              <p className="mt-1 text-[11px] text-stone-600 dark:text-stone-300">
                {selectedMeta.detail}
              </p>
            </div>
          )}
        </div>

        {/* Collapsible Unified Bottom Control Dock */}
        <div
          className="absolute bottom-2.5 left-1/2 z-20 -translate-x-1/2 flex flex-col items-center"
          style={{ width: isPhoneView ? 'calc(100% - 16px)' : 'min(1120px, calc(100% - 24px))' }}
        >
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-t-md border border-b-0 border-stone-300 px-3 py-1 text-[11px] font-semibold text-stone-700 hover:text-stone-950 dark:border-stone-700 dark:text-stone-200"
            style={{
              backgroundColor: isDark ? 'rgba(20, 25, 31, 0.94)' : 'rgba(255, 255, 255, 0.94)',
            }}
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Show Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Hide Controls</span>
              </>
            )}
          </button>

          {!dockCollapsed && (
            <div
              className="w-full rounded-lg border border-stone-300 p-2.5 shadow-lg dark:border-stone-700"
              style={{
                backgroundColor: isDark ? 'rgba(20, 25, 31, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              }}
            >
              {/* Expandable Wire Legend Drawer */}
              {dockTab === 'wires' && (
                <div className="mb-2.5 max-h-36 overflow-y-auto rounded border border-stone-200 bg-stone-50 p-2 dark:border-stone-800 dark:bg-stone-950">
                  {analysis.wires.length === 0 ? (
                    <p className="text-xs text-stone-500 dark:text-stone-400 px-1 py-1">
                      This sketch uses only the onboard {board.shortName} LED (GPIO {board.defaultLedPin}). Open Test Bench to snap 3D lights, sensors, OLED, or motors onto the mat!
                    </p>
                  ) : (
                    <div
                      className={`grid gap-1.5 ${
                        isPhoneView ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                      }`}
                    >
                      {analysis.wires.map((w) => {
                        const active = highlightedWireId === w.id;
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => handleSelectWireFromLegend(w)}
                            className={`flex items-center gap-2 rounded border px-2 py-1 text-left text-[11px] transition-colors ${
                              active
                                ? 'border-teal-600 bg-teal-50 text-teal-950 dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-100'
                                : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300'
                            }`}
                          >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/20"
                              style={{ backgroundColor: w.colorHex }}
                            />
                            <span className="truncate font-medium">
                              {w.componentName} ({w.componentTerminalLabel})
                            </span>
                            <span className="ml-auto shrink-0 font-mono text-teal-700 dark:text-teal-400">
                              {w.espPinLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Expandable Real Test Bench Drawer (Live Sensors + Quick Add 3D Modules) */}
              {dockTab === 'bench' && (
                <div className="mb-2.5 space-y-2.5 rounded border border-stone-200 bg-stone-50 p-2.5 text-[11px] dark:border-stone-800 dark:bg-stone-950">
                  <div
                    className={`grid gap-2.5 items-center ${
                      isPhoneView ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-stone-700 dark:text-stone-300">
                        Button Input
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setEnvState((p) => ({
                            ...p,
                            buttonPressed: !p.buttonPressed,
                            buttonLatch: !p.buttonLatch,
                          }))
                        }
                        className={`rounded border px-2 py-1 font-semibold ${
                          envState.buttonPressed
                            ? 'border-rose-600 bg-rose-600 text-white'
                            : 'border-stone-300 bg-white text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200'
                        }`}
                      >
                        {envState.buttonPressed ? 'Pressed (LOW)' : 'Press Button'}
                      </button>
                    </div>

                    <label className="flex flex-col gap-1 text-stone-700 dark:text-stone-300">
                      <span className="flex justify-between font-medium">
                        <span>Potentiometer</span>
                        <span className="font-mono">{envState.potentiometerPct}%</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={envState.potentiometerPct}
                        onChange={(e) =>
                          setEnvState((p) => ({ ...p, potentiometerPct: Number(e.target.value) }))
                        }
                        className="accent-teal-700"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-stone-700 dark:text-stone-300">
                      <span className="flex justify-between font-medium">
                        <span>Temp (DHT)</span>
                        <span className="font-mono">{envState.temperatureC.toFixed(1)}°C</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={50}
                        step={0.5}
                        value={envState.temperatureC}
                        onChange={(e) =>
                          setEnvState((p) => ({ ...p, temperatureC: Number(e.target.value) }))
                        }
                        className="accent-teal-700"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-stone-700 dark:text-stone-300">
                      <span className="flex justify-between font-medium">
                        <span>Light (LDR)</span>
                        <span className="font-mono">{envState.lightLux} lx</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={1000}
                        step={10}
                        value={envState.lightLux}
                        onChange={(e) =>
                          setEnvState((p) => ({ ...p, lightLux: Number(e.target.value) }))
                        }
                        className="accent-teal-700"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-stone-700 dark:text-stone-300">
                      <span className="flex justify-between font-medium">
                        <span>Distance</span>
                        <span className="font-mono">{envState.distanceCm} cm</span>
                      </span>
                      <input
                        type="range"
                        min={4}
                        max={180}
                        value={envState.distanceCm}
                        onChange={(e) =>
                          setEnvState((p) => ({ ...p, distanceCm: Number(e.target.value) }))
                        }
                        className="accent-teal-700"
                      />
                    </label>

                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-stone-700 dark:text-stone-300">
                        PIR Motion
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setEnvState((p) => ({ ...p, motionDetected: !p.motionDetected }))
                        }
                        className={`rounded border px-2 py-1 font-semibold ${
                          envState.motionDetected
                            ? 'border-amber-600 bg-amber-500 text-white'
                            : 'border-stone-300 bg-white text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200'
                        }`}
                      >
                        {envState.motionDetected ? 'Motion Active' : 'Trigger Motion'}
                      </button>
                    </div>
                  </div>

                  {/* Quick Add 3D Test Modules Row */}
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-stone-200 pt-2 dark:border-stone-800">
                    <span className="inline-flex items-center gap-1 font-semibold text-stone-700 dark:text-stone-300 mr-1">
                      <Plus className="h-3 w-3 text-teal-700" aria-hidden="true" />
                      Add 3D Test Part:
                    </span>
                    {QUICK_ADD_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleAddQuickPreset(preset)}
                        className="rounded border border-stone-300 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-700 hover:border-teal-600 hover:text-teal-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                      >
                        {preset.label}
                      </button>
                    ))}
                    {extraWiring.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExtraWiring([])}
                        className="ml-auto rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
                      >
                        Reset Added Parts
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* Simulation Play/Pause + Speed */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 whitespace-nowrap"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Pause Sim</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Run Sim</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center rounded-md border border-stone-300 bg-stone-100 p-0.5 dark:border-stone-700 dark:bg-stone-900">
                    {[0.5, 1, 2].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setSimSpeed(spd)}
                        className={`rounded-sm px-2 py-1 text-[11px] font-mono font-medium transition-colors ${
                          simSpeed === spd
                            ? 'bg-white text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                            : 'text-stone-600 dark:text-stone-400'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exploded Pin Lift Slider */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="explode-lift-slider"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-700 dark:text-stone-300 whitespace-nowrap"
                  >
                    <Layers className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                    <span>Lift Wires</span>
                  </label>
                  <input
                    id="explode-lift-slider"
                    type="range"
                    min={0}
                    max={100}
                    value={explodePct}
                    onChange={(e) => setExplodePct(Number(e.target.value))}
                    className="w-16 accent-teal-700"
                  />
                  <span className="w-8 text-right font-mono text-[11px] tabular-nums text-stone-600 dark:text-stone-400">
                    {explodePct}%
                  </span>
                </div>

                {/* Camera Presets */}
                <div className="flex items-center gap-1 rounded-md border border-stone-300 bg-stone-100 p-0.5 dark:border-stone-700 dark:bg-stone-900">
                  {(Object.keys(CAMERA_PRESETS) as CameraPresetId[]).map((presetKey) => (
                    <button
                      key={presetKey}
                      type="button"
                      onClick={() => handleCameraPreset(presetKey)}
                      className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-white dark:text-stone-300 dark:hover:bg-stone-800 whitespace-nowrap"
                    >
                      {presetKey === 'iso' && <RotateCcw className="h-3 w-3" aria-hidden="true" />}
                      <span>{CAMERA_PRESETS[presetKey].label}</span>
                    </button>
                  ))}
                </div>

                {/* Signal Flow, Test Bench & Wire Guide Toggles */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowSignalFlow((s) => !s)}
                    aria-pressed={showSignalFlow}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                      showSignalFlow
                        ? 'border-teal-700 bg-teal-50 text-teal-900 dark:border-teal-600 dark:bg-teal-950/60 dark:text-teal-200'
                        : 'border-stone-300 bg-white text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300'
                    }`}
                  >
                    <Zap className="h-3 w-3" aria-hidden="true" />
                    <span>Signal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDockTab((t) => (t === 'bench' ? 'none' : 'bench'))}
                    aria-expanded={dockTab === 'bench'}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                      dockTab === 'bench'
                        ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-500 dark:bg-teal-600'
                        : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200'
                    }`}
                  >
                    <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
                    <span>Test Bench</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDockTab((t) => (t === 'wires' ? 'none' : 'wires'))}
                    aria-expanded={dockTab === 'wires'}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                      dockTab === 'wires'
                        ? 'border-stone-900 bg-stone-900 text-white dark:border-stone-200 dark:bg-stone-100 dark:text-stone-900'
                        : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200'
                    }`}
                  >
                    <Eye className="h-3 w-3" aria-hidden="true" />
                    <span>Wires ({analysis.wires.length})</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-stone-600 dark:text-stone-400">
        <span className="inline-flex items-center gap-1.5">
          <Box className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
          <span>
            Drag to orbit · Scroll to zoom · Click 3D Button/Potentiometer/USB or open Test Bench to simulate real sensor inputs &amp; add 3D parts
          </span>
        </span>
        <span className="font-mono text-[11px] tabular-nums">
          Blink/Loop Cadence: {analysis.simulation.blinkPeriodMs} ms
        </span>
      </div>
    </section>
  );
}
