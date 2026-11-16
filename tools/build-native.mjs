#!/usr/bin/env node
// C++ World v4 scene builder (written by Claude, 2026-11-16).
//
// Uses ONLY the SVG features proven to animate in the Claude desktop background:
//   - flat-colour <path>/<rect>
//   - CSS @keyframes on transform: translate (linear), on classed elements
//   - SMIL <animateTransform type="translate">, smooth or calcMode="discrete"
// Never used: clipPath, mask, gradients, filters, opacity (static or animated),
// scale/rotate, transform-box, shape-rendering, <title>/<desc>, width/height on <svg>.
// Frame swaps hop each frame on/off canvas with discrete translate instead of a clip.
//
// Input: tools/art/v2-scenes.ts (static 640x360 art) and tools/art/v2-sprites.ts.
// Output: hooks/scenes-<phase>.ts, hooks/scenes.ts (index), preview/<phase>-<weather>.svg
//
// Run: node tools/build-native.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (file) => {
  const t = readFileSync(resolve(root, file), 'utf8')
  return JSON.parse(t.slice(t.indexOf('= ') + 2).trim().replace(/ as const\s*$/, ''))
}
const BASES = readJson('tools/art/v2-scenes.ts')
const S = readJson('tools/art/v2-sprites.ts')

const W = 640, H = 360, OFF = 2000 // OFF: how far a hidden frame is moved away
const PHASES = ['dawn', 'day', 'dusk', 'night']
const WEATHERS = ['clear', 'rain', 'snow']
const LIMIT = 125_000
// shape-rendering="crispEdges" FREEZES all animation in the desktop background (tested 2026-11-16).
// Keep it off. CRISP=1 exists only for testing a future app version.
const CRISP = process.env.CRISP === '1'

const rect = (x, y, w = 1, h = 1) => `M${x} ${y}h${w}v${h}h-${w}z`
const path = (fill, d) => (d ? `<path fill="${fill}" d="${d}"/>` : '')
const at = (x, y, art) => `<g transform="translate(${x} ${y})">${art}</g>`
const mod = (n, p) => ((n % p) + p) % p
const r3 = (n) => Math.round(n * 1000) / 1000

// Mix colour a over b at alpha (replaces opacity, which never animates and is avoided).
function mix(a, b, alpha) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return '#' + x.map((v, i) => Math.round(v * alpha + y[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')
}

// ---- CSS: one keyframe set per scene, referenced by classes ----
let css = ''
let cssId = 0
function cssMove(fromX, fromY, toX, toY, seconds, delay = 0) {
  const name = `k${cssId++}`
  css += `@keyframes ${name}{from{transform:translate(${fromX}px,${fromY}px)}to{transform:translate(${toX}px,${toY}px)}}`
  css += `.${name}{animation:${name} ${r3(seconds)}s linear ${r3(delay)}s infinite}`
  return name
}

// SMIL flipbook: frame i is on canvas only during its own steps of the cycle.
// steps: array of frame indexes, one per equal time slot; dur in seconds.
function flipbook(frames, steps, dur) {
  const n = steps.length
  const keyTimes = steps.map((_, i) => r3(i / n)).join(';')
  return frames.map((art, f) => {
    if (!steps.includes(f)) return ''
    const values = steps.map((s) => (s === f ? '0 0' : `0 ${OFF}`)).join(';')
    return `<g><animateTransform attributeName="transform" type="translate" calcMode="discrete" values="${values}" keyTimes="${keyTimes}" dur="${dur}s" repeatCount="indefinite"/>${art}</g>`
  }).join('')
}

// ---- moving layers ----
function stars(phase, weather) {
  if (phase !== 'night' || weather === 'rain') return ''
  let dim = '', out = ''
  for (let i = 0; i < 12; i++) {
    const x = 20 + (i * 49) % 596, y = 12 + (i * 29) % 117
    dim += rect(x, y)
    // A bright twin hops on for a moment at its own rhythm.
    const dur = [2.3, 3.1, 3.7, 4.3, 5.3, 5.9][i % 6]
    out += `<g><animateTransform attributeName="transform" type="translate" calcMode="discrete" values="0 ${OFF};0 0;0 ${OFF}" keyTimes="0;${r3(0.55 + (i % 4) * 0.08)};${r3(0.7 + (i % 4) * 0.08)}" dur="${dur}s" repeatCount="indefinite"/>${path('#fff0c6', rect(x - 1, y, 3) + rect(x, y - 1, 1, 3))}</g>`
  }
  return path('#7185a8', dim) + out
}

function clouds(phase, weather) {
  const cloud = S.clouds[`${phase}-${weather}`]
  // [start x, y, seconds per full pass]: slow, layered drift; negative delay places each mid-pass.
  return [[-48, 50, 140], [64, 78, 190], [414, 24, 165], [568, 96, 210]].map(([x, y, sec]) => {
    const span = W + 94 * 2
    const progress = mod(x + 94, span) / span
    return at(0, y, `<g class="${cssMove(-94, 0, W + 94, 0, sec, -progress * sec)}">${cloud}</g>`)
  }).join('')
}

function birds(phase, weather) {
  if (weather !== 'clear' || (phase !== 'dawn' && phase !== 'day')) return ''
  let out = ''
  for (let i = 0; i < 2; i++) {
    const y = 91 + i * 12
    const up = path('#3d4852', rect(0, 0, 2) + rect(-1, -1) + rect(2, -1) + rect(-2, -2) + rect(3, -2))
    const down = path('#3d4852', rect(0, 0, 2) + rect(-1, -1) + rect(2, -1) + rect(-2, -1) + rect(3, -1))
    const wings = flipbook([up, down], [0, 1], 0.4)
    // Cross in 22 s, then rest off-screen: the keyframe runs 0→1500 px, only 0→660 is visible.
    out += at(0, y, `<g class="${cssMove(-20 - i * 18, 0, 1480 - i * 18, 0, 50, -i * 3)}">${wings}</g>`)
  }
  return out
}

function precipitation(phase, weather) {
  if (weather === 'clear') return ''
  const sky = { dawn: '#9a7f8f', day: '#6f8c99', dusk: '#7d6577', night: '#3a4560' }[phase]
  const rain = weather === 'rain'
  const tile = 384
  let out = ''
  for (let layer = 0; layer < 3; layer++) {
    let d = ''
    const count = rain ? 46 : 34
    for (let i = 0; i < count; i++) {
      const seed = i + layer * 31
      const x = mod(17 + seed * 137, 638)
      if (x > 103 && x < 181) continue // keep the umbrella / cat shelter dry
      const y = mod(seed * 79, tile)
      const w = !rain && layer === 2 && i % 5 === 0 ? 2 : 1
      const h = rain ? 3 + layer * 2 : (layer === 2 && i % 5 === 0 ? 2 : 1)
      d += rect(x, y, w, h)
    }
    const color = rain ? mix('#c8e0e6', sky, [0.3, 0.45, 0.62][layer]) : mix('#f1f4ee', sky, [0.55, 0.75, 0.95][layer])
    const art = path(color, d) + at(0, -tile, path(color, d))
    const seconds = rain ? [3.6, 2.4, 1.5][layer] : [26, 18, 12][layer]
    let moving = `<g class="${cssMove(0, 0, 0, tile, seconds)}">${art}</g>`
    if (!rain) {
      // Gentle side-to-side sway for snow, smooth SMIL translate.
      moving = `<g><animateTransform attributeName="transform" type="translate" values="0 0;${3 - layer} 0;0 0;${-(3 - layer)} 0;0 0" dur="${[7.3, 5.9, 4.7][layer]}s" repeatCount="indefinite"/>${moving}</g>`
    }
    out += moving
  }
  if (rain) {
    // Tiny splashes hopping on and off around the ground.
    for (let i = 0; i < 10; i++) {
      const x = 20 + i * 59, y = 282 + (i * 19) % 66
      out += `<g><animateTransform attributeName="transform" type="translate" calcMode="discrete" values="0 ${OFF};0 0;0 ${OFF}" keyTimes="0;${r3(0.1 * (i % 7))};${r3(0.1 * (i % 7) + 0.12)}" dur="${r3(1.7 + (i % 4) * 0.4)}s" repeatCount="indefinite"/>${path('#9bb9bf', rect(x, y) + rect(x + 3, y))}</g>`
    }
  }
  return out
}

function fire() {
  let out = at(176, 237, flipbook(S.flames, [0, 1, 2, 3, 1, 2], 0.72))
  // Embers rise from the fire and reset.
  for (let i = 0; i < 5; i++) {
    const sec = 2.6 + i * 0.45
    out += at(183 + i * 4, 260, `<g class="${cssMove(0, 0, (i % 2 ? 4 : -3), -40, sec, -i * 0.9)}">${path('#f9c77f', rect(0, 0))}</g>`)
  }
  return out
}

// ---- The orange Claude pet (original pixel drawing) ----
// Drawn on a 2-unit grid so it reads as a chunky pixel character at scene scale.
const PET = { body: '#d97757', shade: '#b8603f', eye: '#1d1714' }
const U = 3
function petArt({ legs = 'a', eyes = 'open', bob = 0 } = {}) {
  let body = '', shade = '', eye = ''
  const px = (c, r, w = 1, h = 1) => rect(c * U, (r + bob) * U, w * U, h * U)
  body += px(2, 0, 11, 2)            // head/top rows
  body += px(2, 2, 11, 1)
  body += px(0, 3, 15, 2)            // arms stick out on both sides
  body += px(2, 5, 11, 1)
  shade += px(2, 6, 11, 1)           // darker bottom edge
  const legCols = legs === 'a' ? [2, 4, 10, 12] : [3, 5, 9, 11]
  for (const c of legCols) shade += px(c, 7, 1, legs === 'tuck' ? 1 : 2)
  // Eyes: two tall dark blocks; closed = a thin line; up = looking at the sky.
  if (eyes === 'open') eye = px(4, 2, 1, 2) + px(10, 2, 1, 2)
  if (eyes === 'up') eye = px(4, 1, 1, 2) + px(10, 1, 1, 2)
  if (eyes === 'closed') eye = px(4, 3, 1, 1) + px(10, 3, 1, 1)
  return path(PET.body, body) + path(PET.shade, shade) + path(PET.eye, eye)
}

function pet(phase, weather) {
  // The pet stands on the ground between the tent and the fire (feet at y≈266).
  const x0 = 120, y0 = 239
  const idle = (eyes) => {
    // 6 s loop of 0.25 s slots: a small hop every 1.5 s, a blink near the end.
    const frames = [
      petArt({ eyes }), petArt({ eyes, bob: -1 }), petArt({ eyes: 'closed' }),
    ]
    const steps = []
    for (let i = 0; i < 24; i++) steps.push(i === 21 ? 2 : (i % 6 === 3 ? 1 : 0))
    return flipbook(frames, steps, 6)
  }
  if (weather === 'clear' && (phase === 'day' || phase === 'dawn')) {
    // Daytime: strolls back and forth in front of the camp, legs stepping.
    const walk = flipbook([petArt({ legs: 'a' }), petArt({ legs: 'b', bob: -1 })], [0, 1], 0.5)
    const name = `k${cssId++}`
    css += `@keyframes ${name}{0%{transform:translate(0px,0px)}50%{transform:translate(70px,0px)}100%{transform:translate(0px,0px)}}`
    css += `.${name}{animation:${name} 16s linear 0s infinite}`
    return at(215, y0, `<g class="${name}">${walk}</g>`)  // right of the fire: the app's sidebar covers the left edge
  }
  if (phase === 'night' && weather === 'clear') return at(x0, y0, idle('up'))   // stargazing
  if (weather === 'snow') return at(x0, y0 + 3, flipbook([petArt({ legs: 'tuck' }), petArt({ legs: 'tuck', bob: -1 }), petArt({ legs: 'tuck', eyes: 'closed' })], Array.from({ length: 24 }, (_, i) => (i === 21 ? 2 : i % 8 === 4 ? 1 : 0)), 6))
  return at(x0, y0, idle('open'))
}

function fireflies(phase) {
  if (phase !== 'night' && phase !== 'dusk') return ''
  let out = ''
  const starts = [[211, 225], [506, 243], [458, 260], [99, 214]]
  for (let i = 0; i < 4; i++) {
    const pts = []
    for (let k = 0; k < S.fly.length; k += 10) { const [dx, dy] = S.fly[mod(k + i * 37, S.fly.length)]; pts.push(`${dx} ${dy}`) }
    pts.push(pts[0])
    out += at(starts[i][0], starts[i][1], `<g><animateTransform attributeName="transform" type="translate" values="${pts.join(';')}" dur="${16 + i * 3}s" repeatCount="indefinite"/>${path('#f6e6a4', rect(0, 0))}</g>`)
  }
  return out
}

// ---- assemble ----
function staticBase(name) {
  const svg = BASES[name]
  let body = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'))
  body = body.replace(/^<title>[\s\S]*?<\/title>/, '').replace(/^<desc>[\s\S]*?<\/desc>/, '')
  // Drop the faint lantern halo (a static opacity group); opacity is avoided entirely.
  body = body.replace(/<g opacity="[^"]*">[\s\S]*?<\/g>/g, '')
  if (/opacity|clip|Gradient|filter|mask/.test(body)) throw new Error(`${name}: base still uses an avoided feature`)
  return body
}

const scenes = {}
const sizes = {}
for (const phase of PHASES) for (const weather of WEATHERS) {
  const name = `cpp-world-${phase}-${weather}`
  css = ''; cssId = 0
  const layers =
    stars(phase, weather) + clouds(phase, weather) + birds(phase, weather) +
    precipitation(phase, weather) + fire() + pet(phase, weather) + fireflies(phase)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"${CRISP ? ' shape-rendering="crispEdges"' : ''}><style>${css}</style>${staticBase(name)}${layers}</svg>`
  if (svg.length >= LIMIT) throw new Error(`${name}: ${svg.length} characters (limit ${LIMIT})`)
  if (/opacity|clip-path|clipPath|Gradient|filter|mask|transform-box|scale\(|rotate\(/.test(svg)) throw new Error(`${name}: uses an avoided feature`)
  scenes[name] = svg
  sizes[name] = svg.length
}

// One module per phase: the engine refuses modules over 1 MiB.
mkdirSync(resolve(root, 'preview'), { recursive: true })
for (const phase of PHASES) {
  const part = Object.fromEntries(Object.entries(scenes).filter(([n]) => n.startsWith(`cpp-world-${phase}-`)))
  const text = `// Generated by tools/build-native.mjs. Do not edit.\nexport const SCENES_${phase.toUpperCase()}: Record<string, string> = ${JSON.stringify(part, null, 2)}\n`
  if (Buffer.byteLength(text) >= 1_000_000) throw new Error(`scenes-${phase}.ts too large`)
  writeFileSync(resolve(root, `hooks/scenes-${phase}.ts`), text)
}
writeFileSync(resolve(root, 'hooks/scenes.ts'),
  `// Generated by tools/build-native.mjs. Index of the per-phase scene files.\n` +
  PHASES.map((p) => `import { SCENES_${p.toUpperCase()} } from './scenes-${p}.js'`).join('\n') +
  `\nimport { SCENES_DESKTOP } from './scenes-desktop.js'` +
  `\nexport const SCENES: Record<string, string> = { ${PHASES.map((p) => `...SCENES_${p.toUpperCase()}`).join(', ')}, ...SCENES_DESKTOP }\n`)
for (const [n, svg] of Object.entries(scenes)) writeFileSync(resolve(root, 'preview', `${n.slice(10)}.svg`), svg)
for (const [n, len] of Object.entries(sizes)) console.log(n.slice(10).padEnd(12), len, 'chars')
