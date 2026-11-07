export const DEFAULT_PRESET_ID = 'midnight';

export const BACKGROUND_PRESETS = [
  {id: 'midnight', label: 'Midnight', bg: '#0d0d12', accent: '#3584e4'},
  {id: 'graphite', label: 'Graphite', bg: '#15151a', accent: '#c0bfbc'},
  {id: 'navy', label: 'Navy', bg: '#0b1626', accent: '#62a0ea'},
  {id: 'forest', label: 'Forest', bg: '#0d1a12', accent: '#57e389'},
  {id: 'plum', label: 'Plum', bg: '#1a1024', accent: '#c061cb'},
  {id: 'wine', label: 'Wine', bg: '#200f17', accent: '#e56b8a'},
  {id: 'ember', label: 'Ember', bg: '#1f140c', accent: '#ffa348'},
  {id: 'lagoon', label: 'Lagoon', bg: '#081a1c', accent: '#2ec4b6'},
];

const PRESETS = new Map(BACKGROUND_PRESETS.map(preset => [preset.id, preset]));

export function presetById(id) {
  return PRESETS.get(id) ?? PRESETS.get(DEFAULT_PRESET_ID);
}

export function hexToRgb(hex) {
  const raw = String(hex ?? '').replace('#', '');
  const value = raw.length === 3
    ? raw.split('').map(ch => ch + ch).join('')
    : raw.padEnd(6, '0').slice(0, 6);
  const parsed = Number.parseInt(value, 16);
  if (!Number.isFinite(parsed))
    return [0, 0, 0];
  return [(parsed >> 16) & 0xff, (parsed >> 8) & 0xff, parsed & 0xff];
}

export function cssRgba(hex, alpha = 1) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
