/**
 * ThrottleLog — Motorcycle Rider Callout & Helmet Intercom Voice Alerts
 * 
 * Provides 1-tap glove-friendly intent callouts (Fuel, Chai, Regroup, Photos, Hazards)
 * with dual-channel delivery:
 * 1. Screen Flash: High-contrast animated visual card across the rider's map.
 * 2. Helmet Intercom Audio: Natural synthesized voice spoken directly into earbuds/intercom.
 */

import { playRadioSquelch } from './voiceBlast';
import { triggerHaptic } from './audioChimes';
import { speakAlert } from './tts';

export type CalloutType = 'fuel' | 'chai' | 'regroup' | 'scenic' | 'hazard';

export interface CalloutPreset {
  type: CalloutType;
  icon: string;
  label: string;
  spokenText: string;
  badgeColor: string;
}

export interface RiderCallout {
  id: string;
  riderId: string;
  riderName: string;
  bikeModel?: string;
  color?: string;
  type: CalloutType;
  icon: string;
  title: string;
  message: string;
  spokenText: string;
  timestamp: number;
}

export const CALLOUT_PRESETS: CalloutPreset[] = [
  {
    type: 'fuel',
    icon: '⛽',
    label: 'Fuel Stop',
    spokenText: 'Stopping for fuel in a bit',
    badgeColor: '#f59e0b', // Amber
  },
  {
    type: 'chai',
    icon: '☕',
    label: 'Chai / Break',
    spokenText: 'Chai and snack break ahead',
    badgeColor: '#00f0ff', // Cyan
  },
  {
    type: 'regroup',
    icon: '🛑',
    label: 'Pull Over',
    spokenText: 'Pulling over at next safe spot, please regroup',
    badgeColor: '#ef4444', // Rose Red
  },
  {
    type: 'scenic',
    icon: '📸',
    label: 'Photo / View',
    spokenText: 'Stopping for quick photo and scenic viewpoint',
    badgeColor: '#10b981', // Emerald
  },
  {
    type: 'hazard',
    icon: '⚠️',
    label: 'Road Hazard',
    spokenText: 'Caution, potholes and bad road ahead, slow down',
    badgeColor: '#f97316', // Orange
  },
];

/**
 * Plays two-way radio squelch chirp and speaks the callout announcement into helmet intercom or earbuds.
 */
export function playCalloutAlert(riderName: string, spokenText: string) {
  if (typeof window === 'undefined') return;

  // 1. Play opening two-way radio squelch chirp + glove tactile haptic
  playRadioSquelch('open');
  triggerHaptic([60, 40, 60]);

  // 2. Announce speech over Bluetooth/earbuds using universal TTS (Native Android + Web fallback)
  setTimeout(() => {
    speakAlert(`${riderName} says: ${spokenText}`, {
      rate: 1.05,
      pitch: 1.0,
      onEnd: () => {
        playRadioSquelch('close');
      },
    });
  }, 90);
}
