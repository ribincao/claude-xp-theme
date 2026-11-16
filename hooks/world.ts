export const PHASES = ['dawn', 'day', 'dusk', 'night'] as const
export const WEATHERS = ['clear', 'rain', 'snow'] as const
export type Phase = typeof PHASES[number]
export type Weather = typeof WEATHERS[number]
export const LOOKS = ['camp', 'desktop'] as const
export type Look = typeof LOOKS[number]
export type WorldSettings = {
  mode: 'real' | Phase
  weather: Weather
  look: Look
  lapse: number
  lapseStartedAt: number
}

export const DEFAULTS: WorldSettings = { mode: 'real', weather: 'clear', look: 'desktop', lapse: 0, lapseStartedAt: 0 }
export const STORE_KEY = 'world-v1'
export const USAGE = '/world [look camp|desktop | time dawn|day|dusk|night|now | weather clear|rain|snow | lapse <seconds ≥ 20>|off]'

export function isPhase(value: unknown): value is Phase {
  return PHASES.some(p => p === value)
}
export function isWeather(value: unknown): value is Weather {
  return WEATHERS.some(w => w === value)
}

// A store is untyped JSON: reject stale/corrupt values rather than trusting a cast.
export function restoreSettings(value: unknown): WorldSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULTS }
  const data = value as Record<string, unknown>
  return {
    mode: data.mode === 'real' || isPhase(data.mode) ? data.mode : 'real',
    weather: isWeather(data.weather) ? data.weather : 'clear',
    look: LOOKS.some(l => l === data.look) ? data.look as Look : 'desktop',
    lapse: typeof data.lapse === 'number' && Number.isFinite(data.lapse) && data.lapse >= 20 ? data.lapse : 0,
    lapseStartedAt: typeof data.lapseStartedAt === 'number' && Number.isFinite(data.lapseStartedAt) ? data.lapseStartedAt : 0,
  }
}

export function phaseAtMinute(minute: number): Phase {
  if (minute >= 300 && minute < 480) return 'dawn'
  if (minute >= 480 && minute < 1020) return 'day'
  if (minute >= 1020 && minute < 1170) return 'dusk'
  return 'night'
}

export function currentPhase(settings: WorldSettings, now: number): Phase {
  if (settings.lapse > 0) {
    // Begin at 05:00; retain real-world phase proportions over one virtual day.
    const cycleMs = settings.lapse * 1000
    const elapsed = ((now - settings.lapseStartedAt) % cycleMs + cycleMs) % cycleMs
    return phaseAtMinute((300 + elapsed * 1440 / cycleMs) % 1440)
  }
  if (settings.mode !== 'real') return settings.mode
  const local = new Date(now)
  return phaseAtMinute(local.getHours() * 60 + local.getMinutes())
}

export function describe(settings: WorldSettings, now: number): string {
  const time = settings.lapse > 0 ? `time-lapse: ${settings.lapse}s per day (05:00 start)`
    : settings.mode === 'real' ? 'real local clock' : `forced ${settings.mode}`
  return `C++ / WORLD · ${settings.look} · ${currentPhase(settings, now)} · ${settings.weather} · ${time}`
}

export function changeSettings(settings: WorldSettings, args: string, now: number): WorldSettings | undefined {
  const words = args.trim().split(/\s+/)
  if (words.length !== 2) return undefined
  const [command, value] = words
  if (command === 'look' && LOOKS.some(l => l === value)) return { ...settings, look: value as Look }
  if (command === 'time' && (value === 'now' || isPhase(value))) {
    return { ...settings, mode: value === 'now' ? 'real' : value, lapse: 0 }
  }
  // Friendly aliases: sun/sunny → clear, rainy → rain, snowy → snow.
  const alias: Record<string, string> = { sun: 'clear', sunny: 'clear', rainy: 'rain', snowy: 'snow' }
  const weather = value === undefined ? value : (alias[value] ?? value)
  if (command === 'weather' && isWeather(weather)) return { ...settings, weather }
  if (command === 'lapse') {
    if (value === 'off') return { ...settings, lapse: 0 }
    if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return undefined
    const seconds = Number(value)
    if (Number.isFinite(seconds) && seconds >= 20) return { ...settings, lapse: seconds, lapseStartedAt: now }
  }
  return undefined
}
