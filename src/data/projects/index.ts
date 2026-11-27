import type { EspProject, ProjectCategory } from '../../types/esp';
import { BASICS_GPIO_PROJECTS } from './basicsAndGpio';
import { SENSORS_ENV_PROJECTS } from './sensorsAndEnv';
import { WIFI_SMARTHOME_PROJECTS } from './wifiAndSmartHome';
import { DISPLAYS_MOTORS_PROJECTS } from './displaysAndMotors';
import { COMMS_POWER_AUDIO_CAM_PROJECTS } from './commsPowerAudioCam';

export const BEGINNER_PROJECTS: EspProject[] = [
  ...BASICS_GPIO_PROJECTS,
  ...SENSORS_ENV_PROJECTS,
  ...WIFI_SMARTHOME_PROJECTS,
  ...DISPLAYS_MOTORS_PROJECTS,
  ...COMMS_POWER_AUDIO_CAM_PROJECTS,
];

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  'Basics & GPIO',
  'Sensors & Environment',
  'Wi-Fi & Web Servers',
  'Smart Home & MQTT',
  'Displays & OLED',
  'Motors, Servos & Relays',
  'Bluetooth & ESP-NOW',
  'Audio, Buzzers & IR',
  'Power & Deep Sleep',
  'Camera & Storage',
];
