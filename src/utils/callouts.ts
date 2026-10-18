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

  // 2. Announce speech over Bluetooth/earbuds using Web Speech Synthesis API
  setTimeout(() => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Stop any pending speech
        const speech = new SpeechSynthesisUtterance(`${riderName} says: ${spokenText}`);
        speech.rate = 1.05;
        speech.pitch = 1.0;
        speech.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();
        // Prefer natural English voice if available
        const preferred = voices.find(
          v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))
        ) || voices.find(v => v.lang.startsWith('en'));

        if (preferred) speech.voice = preferred;

        speech.onend = () => {
          playRadioSquelch('close');
        };

        window.speechSynthesis.speak(speech);
      }
    } catch (e) {
      console.warn('Speech synthesis audio notice warning:', e);
    }
  }, 90);
}
