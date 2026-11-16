import { makeColors } from './make-colors.js'
import type { Phase, Weather } from './world.js'

// All eight combinations are built once, using the unmodified design-system helper.
const SEEDS = {
  dawn: { surface: ['#211c29', '#282332', '#302a3a', '#373141'], accent: '#f5b59b', pro: '#c5b3ed', tint: '#211c29' },
  day: { surface: ['#162b30', '#1d3237', '#24393e', '#2b4045'], accent: '#9fdae7', pro: '#c6b8ee', tint: '#162b30' },
  dusk: { surface: ['#211b30', '#282237', '#30293f', '#373047'], accent: '#efb28c', pro: '#c9b2f0', tint: '#211b30' },
  night: { surface: ['#10182b', '#172032', '#1e2739', '#252e40'], accent: '#a8c9f0', pro: '#c1b6ec', tint: '#10182b' },
} as const

export const PALETTES = Object.fromEntries(
  (Object.keys(SEEDS) as Phase[]).flatMap(phase => [false, true].map(rain => {
    const seed = SEEDS[phase]
    const surfaces = rain ? ['#1b242d', '#222b34', '#29323b', '#303942'] as const : seed.surface
    const result = makeColors({
      label: `C++ World ${phase}${rain ? ' rain' : ''}`,
      only: 'dark',
      roles: {
        accent: rain ? '#b0c9d2' : seed.accent,
        danger: '#f58f94', success: '#a4d7b9', warning: '#ebca8e', pro: seed.pro,
      },
      dark: { gray: { anchors: {
        'surface-0': surfaces[0], 'surface-1': surfaces[1],
        'surface-2': surfaces[2], 'surface-3': surfaces[3],
        'text-primary': '#f7f2e9', 'text-secondary': '#dfded9', 'text-muted': '#c2c6c8',
      } } },
    })
    return [`${phase}-${rain ? 'rain' : 'clear'}`, { ...result, tint: rain ? '#1b242d' : seed.tint }]
  })),
)

export function paletteFor(phase: Phase, weather: Weather) {
  return PALETTES[`${phase}-${weather === 'rain' ? 'rain' : 'clear'}`]!
}
