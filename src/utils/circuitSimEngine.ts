import type { EspBoard } from '../types/esp';
import type { Circuit3dAnalysis } from './circuit3dModel';

export interface SimEnvironmentState {
  powered: boolean;
  buttonPressed: boolean;
  buttonLatch: boolean;
  potentiometerPct: number;
  temperatureC: number;
  humidityPct: number;
  lightLux: number;
  distanceCm: number;
  motionDetected: boolean;
  gasPpm: number;
}

export const DEFAULT_SIM_ENV: SimEnvironmentState = {
  powered: true,
  buttonPressed: false,
  buttonLatch: false,
  potentiometerPct: 55,
  temperatureC: 24.5,
  humidityPct: 58.0,
  lightLux: 420,
  distanceCm: 48,
  motionDetected: false,
  gasPpm: 140,
};

export interface FirmwareStep {
  durationMs: number;
  pinStates: Record<number, number>; // 0..1 duty
}

export interface RealTestSimFrame {
  onboardLedBrightness: number;
  pinDuty: Record<number, number>;
  rgbColor: [number, number, number];
  trafficState: { red: number; yellow: number; green: number };
  servoAngleDeg: number;
  stepperAngleRad: number;
  relayOn: boolean;
  lampBrightness: number;
  buzzerActive: boolean;
  displayLines: string[];
  sevenSegText: string;
  serialOutput: string;
}

function parseConstants(code: string): Map<string, number> {
  const map = new Map<string, number>();
  const defineRe = /^\s*#define\s+([A-Za-z_][A-Za-z0-9_]*)\s+(\d{1,2})\b/gm;
  let m: RegExpExecArray | null;
  while ((m = defineRe.exec(code)) !== null) map.set(m[1], Number(m[2]));
  const constRe = /\b(?:const\s+)?(?:int|uint8_t|byte)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\d{1,2})\s*;/g;
  while ((m = constRe.exec(code)) !== null) map.set(m[1], Number(m[2]));
  return map;
}

/**
 * Extracts real digitalWrite/delay sequence steps from loop() so sketches like
 * Blink, SOS Morse, Traffic Light, or Chaser play their authentic timing.
 */
export function parseLoopTimingSteps(code: string, defaultLedPin: number): FirmwareStep[] {
  const constants = parseConstants(code);
  const loopMatch = code.match(/void\s+loop\s*\([^)]*\)\s*\{([\s\S]*)$/);
  const body = loopMatch ? loopMatch[1] : code;

  const events: Array<{ type: 'write'; pin: number; val: number } | { type: 'delay'; ms: number }> = [];
  const tokenRe =
    /\b(?:digitalWrite\s*\(\s*([A-Za-z0-9_]+)\s*,\s*(HIGH|LOW|1|0)\s*\)|delay\s*\(\s*(\d+)\s*\)|time\.sleep\s*\(\s*(\d+(?:\.\d+)?)\s*\))/g;

  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(body)) !== null) {
    if (m[1]) {
      const rawPin = m[1];
      let pin = defaultLedPin;
      if (/^\d{1,2}$/.test(rawPin)) pin = Number(rawPin);
      else if (rawPin === 'LED_BUILTIN') pin = defaultLedPin;
      else if (constants.has(rawPin)) pin = constants.get(rawPin)!;
      const val = m[2] === 'HIGH' || m[2] === '1' ? 1 : 0;
      events.push({ type: 'write', pin, val });
    } else if (m[3]) {
      events.push({ type: 'delay', ms: Math.max(40, Math.min(8000, Number(m[3]))) });
    } else if (m[4]) {
      events.push({ type: 'delay', ms: Math.max(40, Math.min(8000, Math.round(Number(m[4]) * 1000))) });
    }
    if (events.length > 48) break;
  }

  const steps: FirmwareStep[] = [];
  const currentPins: Record<number, number> = {};

  for (const ev of events) {
    if (ev.type === 'write') {
      currentPins[ev.pin] = ev.val;
    } else {
      steps.push({
        durationMs: ev.ms,
        pinStates: { ...currentPins },
      });
    }
  }

  return steps;
}

export function evaluateRealTestSimulation(
  board: EspBoard,
  code: string,
  analysis: Circuit3dAnalysis,
  env: SimEnvironmentState,
  elapsedSec: number
): RealTestSimFrame {
  if (!env.powered) {
    return {
      onboardLedBrightness: 0,
      pinDuty: {},
      rgbColor: [0, 0, 0],
      trafficState: { red: 0, yellow: 0, green: 0 },
      servoAngleDeg: 0,
      stepperAngleRad: 0,
      relayOn: false,
      lampBrightness: 0,
      buzzerActive: false,
      displayLines: ['POWER OFF', 'Click USB/Power', 'to boot ESP'],
      sevenSegText: '    ',
      serialOutput: '[OFF] Board unpowered',
    };
  }

  const sim = analysis.simulation;
  const steps = parseLoopTimingSteps(code, board.defaultLedPin);
  const pinDuty: Record<number, number> = {};

  // 1. Evaluate loop digitalWrite/delay sequence when available
  if (steps.length > 0) {
    const totalMs = steps.reduce((sum, s) => sum + s.durationMs, 0);
    let cursorMs = ((elapsedSec * 1000) % totalMs + totalMs) % totalMs;
    for (const step of steps) {
      if (cursorMs <= step.durationMs) {
        Object.assign(pinDuty, step.pinStates);
        break;
      }
      cursorMs -= step.durationMs;
    }
  }

  // 2. Smooth PWM breathing when analogWrite/ledcWrite loop is detected
  const isPwmBreathing = /\b(analogWrite|ledcWrite)\b/.test(code) && /\bfor\s*\(/.test(code);
  if (isPwmBreathing) {
    const breath = (Math.sin(elapsedSec * 2.6) + 1) * 0.5;
    for (const g of sim.activeGpios) {
      pinDuty[g] = breath;
    }
    if (sim.usesOnboardLed) {
      pinDuty[board.defaultLedPin] = breath;
    }
  }

  // 3. Interactive real-world sensor & input rules (so bench controls genuinely drive the circuit!)
  const hasButtonInCircuit = sim.hasButton || analysis.components.some((c) => c.kind === 'button');
  const hasPotInCircuit = sim.hasPotentiometer || analysis.components.some((c) => c.kind === 'potentiometer');
  const hasLightInCircuit = sim.hasLightSensor || analysis.components.some((c) => c.kind === 'light_sensor');
  const hasUltrasonicInCircuit = sim.hasUltrasonic || analysis.components.some((c) => c.kind === 'ultrasonic');
  const hasPirInCircuit = sim.hasPir || analysis.components.some((c) => c.kind === 'pir');
  const hasGasInCircuit = sim.hasGasSensor || analysis.components.some((c) => c.kind === 'gas_sensor');
  const hasDhtInCircuit = sim.hasDht || sim.hasBme || analysis.components.some((c) => c.kind === 'dht22' || c.kind === 'bme280');

  // If sketch uses INPUT_PULLUP / latch button, button latch/press drives output pins
  const buttonActive = /toggle|latch|state\s*=\s*!/i.test(code) ? env.buttonLatch : env.buttonPressed;
  if (hasButtonInCircuit) {
    const outputActive = buttonActive ? 1 : 0;
    for (const w of analysis.wires) {
      if (w.espGpio !== null && !/button/i.test(w.componentName)) {
        pinDuty[w.espGpio] = outputActive;
      }
    }
    if (sim.usesOnboardLed) {
      pinDuty[board.defaultLedPin] = outputActive;
    }
  }

  // Potentiometer drives PWM brightness or Servo angle
  if (hasPotInCircuit && !isPwmBreathing) {
    const norm = env.potentiometerPct / 100;
    for (const w of analysis.wires) {
      if (w.espGpio !== null && /led|lamp|bulb/i.test(w.componentName)) {
        pinDuty[w.espGpio] = norm;
      }
    }
    if (sim.usesOnboardLed && /led|dimmer/i.test(code)) {
      pinDuty[board.defaultLedPin] = norm;
    }
  }

  // Light sensor (LDR / BH1750): turns nightlight/relay ON when ambient light < 300 lux
  let lightTriggered = false;
  if (hasLightInCircuit) {
    lightTriggered = env.lightLux < 300;
    for (const w of analysis.wires) {
      if (w.espGpio !== null && /led|lamp|bulb|relay/i.test(w.componentName)) {
        pinDuty[w.espGpio] = lightTriggered ? 1 : 0;
      }
    }
    if (sim.usesOnboardLed) {
      pinDuty[board.defaultLedPin] = lightTriggered ? 1 : 0;
    }
  }

  // Ultrasonic distance alert (< 25 cm triggers alarm/LED)
  const ultrasonicAlert = hasUltrasonicInCircuit && env.distanceCm < 25;
  if (ultrasonicAlert) {
    const beep = Math.sin(elapsedSec * (26 - Math.min(20, env.distanceCm * 0.7))) > 0 ? 1 : 0;
    for (const w of analysis.wires) {
      if (w.espGpio !== null && /buzzer|led|relay/i.test(w.componentName)) {
        pinDuty[w.espGpio] = beep;
      }
    }
  } else if (hasUltrasonicInCircuit && !hasButtonInCircuit) {
    for (const w of analysis.wires) {
      if (w.espGpio !== null && /buzzer/i.test(w.componentName)) {
        pinDuty[w.espGpio] = 0;
      }
    }
  }

  // PIR motion trigger
  if (hasPirInCircuit) {
    for (const w of analysis.wires) {
      if (w.espGpio !== null && /led|lamp|relay|buzzer/i.test(w.componentName)) {
        pinDuty[w.espGpio] = env.motionDetected ? 1 : 0;
      }
    }
    if (sim.usesOnboardLed) {
      pinDuty[board.defaultLedPin] = env.motionDetected ? 1 : 0;
    }
  }

  // Gas alarm trigger (> 400 ppm)
  const gasAlert = hasGasInCircuit && env.gasPpm > 400;
  if (gasAlert) {
    const alarmPulse = Math.sin(elapsedSec * 14) > 0 ? 1 : 0;
    for (const w of analysis.wires) {
      if (w.espGpio !== null && /buzzer|led|relay/i.test(w.componentName)) {
        pinDuty[w.espGpio] = alarmPulse;
      }
    }
  }

  // Fallback blink if onboard LED is used without explicit timing steps
  if (sim.usesOnboardLed && pinDuty[board.defaultLedPin] === undefined) {
    const period = Math.max(0.3, sim.blinkPeriodMs / 1000);
    pinDuty[board.defaultLedPin] = (elapsedSec % period) / period < sim.dutyHighRatio ? 1 : 0;
  }

  // Traffic Light (Red -> Yellow -> Green realistic cycle)
  const trafficPhase = elapsedSec % 6;
  const trafficState =
    sim.hasTrafficLight || analysis.components.some((c) => c.kind === 'traffic_light')
      ? steps.length >= 3
        ? {
            red: pinDuty[25] ?? 0,
            yellow: pinDuty[26] ?? 0,
            green: pinDuty[27] ?? 0,
          }
        : {
            red: trafficPhase < 2.6 ? 1 : 0,
            yellow: trafficPhase >= 2.6 && trafficPhase < 3.6 ? 1 : 0,
            green: trafficPhase >= 3.6 ? 1 : 0,
          }
      : { red: 0, yellow: 0, green: 0 };

  // RGB LED color
  const hue = (elapsedSec * 0.25) % 1;
  const h6 = hue * 6;
  const c = 1;
  const x = 1 - Math.abs((h6 % 2) - 1);
  let rgbColor: [number, number, number] = [0.2, 0.8, 1];
  if (h6 < 1) rgbColor = [c, x, 0];
  else if (h6 < 2) rgbColor = [x, c, 0];
  else if (h6 < 3) rgbColor = [0, c, x];
  else if (h6 < 4) rgbColor = [0, x, c];
  else if (h6 < 5) rgbColor = [x, 0, c];
  else rgbColor = [c, 0, x];

  // Servo Angle
  const servoAngleDeg = hasPotInCircuit
    ? Math.round((env.potentiometerPct / 100) * 180)
    : Math.round(
        sim.servoAngleMin +
          ((Math.sin(elapsedSec * 1.8) + 1) * 0.5) * (sim.servoAngleMax - sim.servoAngleMin)
      );

  // Relay & Lamp state
  const relayWire = analysis.wires.find((w) => /relay/i.test(w.componentName) && w.espGpio !== null);
  const lampWire = analysis.wires.find((w) => /lamp|bulb/i.test(w.componentName) && w.espGpio !== null);
  const relayOn =
    hasDhtInCircuit && env.temperatureC >= 28
      ? true
      : relayWire && relayWire.espGpio !== null && pinDuty[relayWire.espGpio] !== undefined
        ? pinDuty[relayWire.espGpio] > 0.4
        : lightTriggered || env.motionDetected || (elapsedSec % 2.4) < 1.2;

  const lampBrightness =
    lampWire && lampWire.espGpio !== null && pinDuty[lampWire.espGpio] !== undefined
      ? pinDuty[lampWire.espGpio]
      : relayOn
        ? 1
        : 0;

  // Buzzer active
  const buzzerWire = analysis.wires.find((w) => /buzzer/i.test(w.componentName) && w.espGpio !== null);
  const buzzerActive =
    ultrasonicAlert ||
    gasAlert ||
    (buzzerWire && buzzerWire.espGpio !== null && pinDuty[buzzerWire.espGpio] !== undefined
      ? pinDuty[buzzerWire.espGpio] > 0.4
      : hasButtonInCircuit
        ? buttonActive
        : (elapsedSec % 1.4) < 0.7);

  // Live OLED / LCD / 7-Segment text reflecting real sensor state & code literals
  const uptimeSec = Math.floor(elapsedSec);
  const displayLines: string[] = [];
  if (sim.oledLines.length > 0) {
    displayLines.push(sim.oledLines[0]);
  } else {
    displayLines.push(board.shortName);
  }
  if (hasDhtInCircuit) {
    displayLines.push(`Temp: ${env.temperatureC.toFixed(1)} C`);
    displayLines.push(`Hum : ${env.humidityPct.toFixed(1)} %`);
  } else if (hasLightInCircuit) {
    displayLines.push(`Light: ${env.lightLux} lx`);
    displayLines.push(lightTriggered ? 'Lamp: ON (Dark)' : 'Lamp: OFF (Day)');
  } else if (hasUltrasonicInCircuit) {
    displayLines.push(`Dist: ${env.distanceCm} cm`);
    displayLines.push(ultrasonicAlert ? 'ALERT: TOO CLOSE' : 'Range: Clear');
  } else if (hasPotInCircuit) {
    const adc = Math.round((env.potentiometerPct / 100) * 4095);
    displayLines.push(`ADC : ${adc}`);
    displayLines.push(`Level: ${env.potentiometerPct}%`);
  } else if (hasGasInCircuit) {
    displayLines.push(`Gas : ${env.gasPpm} ppm`);
    displayLines.push(gasAlert ? 'ALARM: HIGH GAS' : 'Air: Normal');
  } else {
    displayLines.push(`Uptime: ${uptimeSec}s`);
    displayLines.push(`GPIO${board.defaultLedPin}: ${(pinDuty[board.defaultLedPin] ?? 0) > 0.3 ? 'HIGH' : 'LOW'}`);
  }

  const sevenSegText = hasDhtInCircuit
    ? `${env.temperatureC.toFixed(1).padStart(4, ' ')}`
    : hasUltrasonicInCircuit
      ? `${String(Math.round(env.distanceCm)).padStart(4, '0')}`
      : `${String(uptimeSec % 9999).padStart(4, '0')}`;

  // Live Serial Monitor line
  let serialOutput = `GPIO${board.defaultLedPin}=${(pinDuty[board.defaultLedPin] ?? 0) > 0.3 ? 'HIGH' : 'LOW'} | millis=${uptimeSec * 1000}`;
  if (hasDhtInCircuit) {
    serialOutput = `temp:${env.temperatureC.toFixed(1)},humidity:${env.humidityPct.toFixed(1)}${relayOn ? ',fan:ON' : ''}`;
  } else if (hasUltrasonicInCircuit) {
    serialOutput = `distance_cm:${env.distanceCm}${ultrasonicAlert ? ' [ALARM]' : ''}`;
  } else if (hasLightInCircuit) {
    serialOutput = `lux:${env.lightLux},nightlight:${lightTriggered ? 'ON' : 'OFF'}`;
  } else if (hasGasInCircuit) {
    serialOutput = `gas_ppm:${env.gasPpm},alarm:${gasAlert ? 'ON' : 'OFF'}`;
  } else if (hasPotInCircuit) {
    const adc = Math.round((env.potentiometerPct / 100) * 4095);
    serialOutput = `adc:${adc},pct:${env.potentiometerPct}%${sim.hasServo ? `,servo:${servoAngleDeg}deg` : ''}`;
  } else if (sim.hasServo) {
    serialOutput = `servo_angle:${servoAngleDeg} deg`;
  } else if (hasPirInCircuit) {
    serialOutput = `pir_motion:${env.motionDetected ? 'DETECTED' : 'CLEAR'}`;
  } else if (hasButtonInCircuit) {
    serialOutput = `button:${buttonActive ? 'PRESSED/ON' : 'RELEASED'}`;
  }

  return {
    onboardLedBrightness: pinDuty[board.defaultLedPin] ?? (sim.usesOnboardLed ? 1 : 0.2),
    pinDuty,
    rgbColor,
    trafficState,
    servoAngleDeg,
    stepperAngleRad: elapsedSec * 2.2,
    relayOn,
    lampBrightness,
    buzzerActive,
    displayLines,
    sevenSegText,
    serialOutput,
  };
}
