import type { Register, EngineInterface, Timer, ThemeSetArgs } from 'claude-code'
import { AVATAR_SVG } from './avatar.js'
import { SCENES } from './scenes.js'
import { paletteFor } from './palettes.js'
import { DEFAULTS, STORE_KEY, USAGE, restoreSettings, currentPhase, describe, changeSettings } from './world.js'
import type { WorldSettings } from './world.js'

type WorldRuntime = {
  settings: WorldSettings
  loading?: Promise<void>
  lastScene?: string
  minuteTimer?: Timer
  lapseTimer?: Timer
  clockTimer?: Timer
  clockMinute?: number
  epoch: number
  queue: Promise<void>
}

// ---- Compact card: C++ portrait, context usage, background tasks ----
// Background tasks have no single API, so they are counted from two sources:
// background shell commands (a Bash result with `backgroundTaskId` starts one;
// its `task-notification` prompt or a TaskStop call ends it), and agents from
// `$.agent.list()` that are still pending, running or waiting.
type CardSnapshot = { percent?: number; fiveHour?: number; week?: number; agents: string[]; at: number }
const ACTIVE_AGENT = new Set(['pending', 'running', 'waiting'])
const shells = new Map<string, string>()
let snapshot: CardSnapshot | undefined
let snapshotLoading: Promise<CardSnapshot> | undefined
const cardTrees = new Map<string, JSX.Element>()
// Latest rate-limit windows pushed by `session.measure` (five_hour, seven_day).
let pushedLimits: { kind: string; percentUsed: number }[] = []

function clampPercent(n: number | undefined): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : undefined
}
// Calm under 50 %, amber from 50 %, red from 80 %.
function levelColor(n: number | undefined): string {
  return n === undefined ? '#8b9bb0' : n >= 80 ? '#ff8a8f' : n >= 50 ? '#f0cf7e' : '#9fe3f2'
}

async function readSnapshot($: EngineInterface): Promise<CardSnapshot> {
  const [usage, agents] = await Promise.all([
    $.session.usage().catch(() => undefined),
    $.agent.list().catch(() => []),
  ])
  const pct = usage?.context.percent
  const limit = (kind: string) => (usage?.rateLimits.find(r => r.kind === kind) ?? pushedLimits.find(r => r.kind === kind))?.percentUsed
  return {
    percent: clampPercent(pct),
    fiveHour: clampPercent(limit('five_hour')),
    week: clampPercent(limit('seven_day')),
    agents: agents.filter(a => ACTIVE_AGENT.has(a.status)).map(a => a.description || a.type),
    at: Date.now(),
  }
}
// Cached for 2 s: the backdrop redraws 10x/s, the card's data does not need to.
async function currentSnapshot($: EngineInterface): Promise<CardSnapshot> {
  if (snapshot && Date.now() - snapshot.at < 2000) return snapshot
  snapshotLoading ??= readSnapshot($).finally(() => { snapshotLoading = undefined })
  snapshot = await snapshotLoading
  return snapshot
}
// Fill the desktop scene's placeholders: the taskbar clock, and negative animation
// delays taken from the wall clock so a redraw continues the clouds where they were.
function desktopSource(svg: string): string {
  const now = Date.now()
  const clock = new Date(now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  // Each placeholder sits in an `animation:<name> <seconds>s linear __D<n>__` rule.
  const durations = new Map([...svg.matchAll(/animation:\w+ ([\d.]+)s linear __D(\d+)__/g)].map(m => [m[2]!, Number(m[1])]))
  return svg.replace('__CLOCK__', clock).replace(/__D(\d+)__/g, (_, i: string) => {
    const d = durations.get(i) ?? 120
    return `-${((now / 1000 + Number(i) * 37) % d).toFixed(1)}s`
  })
}

function refreshCard($: EngineInterface) {
  snapshot = undefined
  $.ui.invalidate('ui.render')
}

// Serialise timer, lifecycle, and command writes so an older request cannot win.
function serial<T>(state: WorldRuntime, work: () => Promise<T>): Promise<T> {
  const result = state.queue.then(work)
  state.queue = result.then(() => {}, () => {})
  return result
}

async function applyWorld($: EngineInterface, state: WorldRuntime) {
  return serial(state, async () => {
    const phase = currentPhase(state.settings, await $.clock.now())
    const scene = state.settings.look === 'desktop' ? `cpp-world-desktop-${phase}-${state.settings.weather}` : `cpp-world-${phase}-${state.settings.weather}`
    if (scene === state.lastScene) return
    const palette = paletteFor(phase, state.settings.weather)
    const rejection = palette.problems.find(p => p.startsWith("Desktop won't paint"))
    if (rejection) { $.ui.toast(rejection); return }
    const look: ThemeSetArgs = {
      colors: palette.theme,
      backdrop: { scene, glass: { blur: 0, tint: palette.tint, opacity: 0.40 } },
    }
    const result = await $.theme.set(look)
    // Do not cache a pre-attachment attempt: retry when a drawing client arrives.
    if (result.isDrawn) state.lastScene = scene
    else if (!result.reason.includes('no attached')) $.ui.status(result.reason)
  })
}

function refresh($: EngineInterface, state: WorldRuntime) {
  void applyWorld($, state).catch(() => $.ui.status('C++ World: theme refresh failed; retry with /world time now.'))
}
function syncLapseTimer($: EngineInterface, state: WorldRuntime) {
  state.lapseTimer?.cancel()
  state.lapseTimer = state.settings.lapse > 0 ? $.clock.every(250, () => refresh($, state)) : undefined
}
async function initialise($: EngineInterface, state: WorldRuntime) {
  if (!state.loading) {
    const epoch = state.epoch
    state.loading = (async () => {
      const settings = restoreSettings(await $.store.get(STORE_KEY))
      if (epoch !== state.epoch) return
      state.settings = settings
      state.minuteTimer = $.clock.every(60_000, () => refresh($, state))
      // Desktop look: redraw when the taskbar clock's minute changes.
      state.clockTimer ??= $.clock.every(5_000, () => {
        if (state.settings.look !== 'desktop') return
        const minute = Math.floor(Date.now() / 60_000)
        if (minute !== state.clockMinute) { state.clockMinute = minute; $.ui.invalidate('ui.render') }
      })
      syncLapseTimer($, state)
    })().catch(error => { if (epoch === state.epoch) state.loading = undefined; throw error })
  }
  await state.loading
}
async function registerCommand($: EngineInterface) {
  await $.command.register({
    name: 'world',
    description: 'Inspect C++ World or change its time, weather and time-lapse.',
    argumentHint: '[time dawn|day|dusk|night|now | weather clear|rain|snow | lapse seconds|off]',
  })
}

export const register: Register = on => {
  let applying = false
  const state: WorldRuntime = { settings: { ...DEFAULTS }, queue: Promise.resolve(), epoch: 0 }

  on('session.start', async ($, e, next) => {
    await initialise($, state)
    await registerCommand($)
    await applyWorld($, state)
    return next(e)
  })
  // Attachment may follow a no-client session.start; a fresh client needs the look.
  on('session.attach', async ($, e, next) => {
    const result = await next(e)
    if (e.surface === 'desktop' || e.surface === 'mobile') {
      await initialise($, state)
      await registerCommand($)
      await applyWorld($, state)
    }
    return result
  })
  on('session.end', ($, e, next) => {
    state.epoch++
    snapshot = undefined
    cardTrees.clear()
    state.minuteTimer?.cancel()
    state.lapseTimer?.cancel()
    state.clockTimer?.cancel()
    state.minuteTimer = state.lapseTimer = state.clockTimer = undefined
    // /clear emits session.end with no subsequent session.start. The next drawing
    // can initialise a fresh pair of timers, without duplicating the old ones.
    state.loading = undefined
    state.lastScene = undefined
    applying = false
    return next(e)
  })
  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    const scene = e.props.scene
    if (!SCENES[scene]) return next(e)
    if (scene.startsWith('cpp-world-desktop-')) {
      const { Svg } = $.ui.resolve(e)
      return <Svg source={desktopSource(SCENES[scene]!)} alt="A retro desktop with green hills, drifting clouds and a taskbar clock" isInteractive />
    }
    const { Svg } = $.ui.resolve(e)
    return <Svg source={SCENES[scene]} alt="C++ the blue-eyed cream cat in a pixel camping valley" isInteractive />
  })
  on('command.run', { command: 'world' }, async ($, e) => {
    // Diagnostic: raw usage figures the engine reports to mods.
    if (e.args.trim() === 'debug') {
      const usage = await $.session.usage().catch(error => ({ error: String(error) }))
      const surface = await $.session.surface().catch(() => null)
      return { text: `usage: ${JSON.stringify(usage)}\npushed by session.measure: ${JSON.stringify(pushedLimits)}\nsurface: ${surface}` }
    }
    await initialise($, state)
    const text = await serial(state, async () => {
      const now = await $.clock.now()
      if (!e.args.trim()) return describe(state.settings, now)
      const changed = changeSettings(state.settings, e.args, now)
      if (!changed) return USAGE
      // Persist before changing the active scene: a failed write leaves it alone.
      await $.store.set(STORE_KEY, changed)
      state.settings = changed
      syncLapseTimer($, state)
      return describe(state.settings, now)
    })
    await applyWorld($, state)
    return { text }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.hasSurvey || e.props.maxRows < 3) return next(e)
    // First card after /clear also reinitialises the look and timers.
    if (!applying) {
      applying = true
      try { await initialise($, state); await applyWorld($, state) } catch { applying = false }
    }
    const data = await currentSnapshot($)
    const tasks = [...shells.values(), ...data.agents]
    const narrow = e.props.bodyColumns < 70
    const treeKey = `${e.surface}:${e.props.bodyColumns}:${data.percent}:${data.fiveHour}:${data.week}:${tasks.join('|')}`
    const cached = cardTrees.get(treeKey)
    if (cached) return cached
    const { Box, Text, Svg } = $.ui.resolve(e)
    // App font (not monospace): small muted labels, semibold tabular numbers.
    const stat = (label: string, value: number | undefined) =>
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Text size="footnote" color="#8b9bb0">{label}</Text>
        <Text size="body" weight="semibold" tabular color={levelColor(value)}>{value === undefined ? '—' : `${value}%`}</Text>
      </Box>
    const divider = <Text size="body" color="#3a4a5e">│</Text>
    const taskLine = tasks.length === 0
      ? 'No background tasks'
      : `${tasks.length} background ${tasks.length === 1 ? 'task' : 'tasks'}${narrow ? '' : ` · ${tasks.slice(0, 2).join(' · ')}${tasks.length > 2 ? ' …' : ''}`}`
    const tree = <Box width={Math.max(16, e.props.bodyColumns)} flexDirection="row" alignItems="center" gap={2} paddingX={1} borderStyle="round" borderColor="#3d5a4a" backgroundColor="#0b1220">
      <Svg source={AVATAR_SVG} width={44} height={44} alt="C++ the cat" />
      <Box flexDirection="column" flexGrow={1} gap={0}>
        <Box flexDirection="row" alignItems="center" gap={2}>
          {stat('Context', data.percent)}
          {divider}
          {stat('5-hour', data.fiveHour)}
          {divider}
          {stat('Weekly', data.week)}
        </Box>
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text size="footnote" color={tasks.length ? '#f0cf7e' : '#5f6f84'}>{tasks.length ? '●' : '○'}</Text>
          <Text size="footnote" weight="medium" color={tasks.length ? '#e9dcb8' : '#8b9bb0'}>{taskLine}</Text>
        </Box>
      </Box>
    </Box>
    if (cardTrees.size > 16) cardTrees.clear()
    cardTrees.set(treeKey, tree)
    return tree
  })

  // Background task bookkeeping: observe only, never change the call.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const out = await next(e)
    try {
      const id = out.isError ? undefined : (out.result as { backgroundTaskId?: string } | undefined)?.backgroundTaskId
      if (id) { shells.set(id, (e.description || e.command || 'shell').slice(0, 60)); refreshCard($) }
    } catch { /* observe only */ }
    return out
  })
  on('tool.call', { tool: 'TaskStop' }, async ($, e, next) => {
    const out = await next(e)
    try {
      const id = e.task_id ?? e.shell_id
      if (id && shells.delete(id)) refreshCard($)
    } catch { /* observe only */ }
    return out
  })
  on('prompt.submit', async ($, e, next) => {
    try {
      if (e.origin.kind === 'task-notification') {
        for (const m of e.text.matchAll(/<task-id>([^<]+)<\/task-id>/g)) shells.delete(m[1]!.trim())
        refreshCard($)
      }
    } catch { /* observe only */ }
    return next(e)
  })

  // The engine pushes fresh figures after each turn and when a limit moves a point.
  on('session.measure', ($, e, next) => {
    try {
      if (e.rateLimits.length) pushedLimits = e.rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed }))
      refreshCard($)
    } catch { /* observe only */ }
    return next(e)
  })
  on('turn.complete', ($, e, next) => {
    refreshCard($)
    return next(e)
  })
}
