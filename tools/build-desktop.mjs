#!/usr/bin/env node
// C++ World "desktop" look: an original early-2000s desktop homage (rolling green
// hills, bright sky, puffy clouds, glossy icons, a blue taskbar with a live clock).
// Original drawing: no Microsoft wallpaper, logo or font.
//
// Same rules as build-native.mjs (what animates in the Claude desktop background):
// flat colours + CSS translate keyframes + SMIL translate only. No gradients,
// filters, clip paths, opacity, scale/rotate, crispEdges. Soft looks are faked with
// flat bands and pre-mixed colours.
//
// Placeholders filled in at render time by register.tsx:
//   __CLOCK__       taskbar time, e.g. "10:42 AM"
//   __D0__ … __Dn__ negative animation delays, so a redraw continues the clouds
//                   where they were instead of restarting them.
//
// Run: node tools/build-desktop.mjs   (writes hooks/scenes-desktop.ts, preview/desktop-*.svg)

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const W = 1600, H = 900, BAR = 34 // short enough to leave a gap under the app's prompt box
const LIMIT = 125_000

const hex = (n) => Math.round(n).toString(16).padStart(2, '0')
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a, b, t) => { const [x, y] = [rgb(a), rgb(b)]; return '#' + x.map((v, i) => hex(v + (y[i] - v) * t)).join('') }
const r1 = (n) => Math.round(n * 10) / 10

const PHASES = {
  day:   { top: '#1d5fd8', horizon: '#b8dcf8', cloud: '#ffffff', cloudEdge: '#dbeaf9', hills: ['#2f7d2a', '#3f9b30', '#57b83a', '#7ad14f'], glint: '#9be06b', sun: null, moon: false },
  dawn:  { top: '#4b5aa6', horizon: '#f7c9a6', cloud: '#fff1e8', cloudEdge: '#f2cfc2', hills: ['#2f6a35', '#3d7f38', '#538f3e', '#6fa652'], glint: '#93bd6e', sun: ['#ffd9a0', 1220, 640, 46], moon: false },
  dusk:  { top: '#33337c', horizon: '#f49a68', cloud: '#f7c3a6', cloudEdge: '#d99a8c', hills: ['#21452a', '#2c5a2f', '#3a6d34', '#4c823c'], glint: '#6f9a4a', sun: ['#ffb45e', 1180, 650, 54], moon: false },
  night: { top: '#081230', horizon: '#26396b', cloud: '#3c4b7a', cloudEdge: '#2e3c69', hills: ['#0f2417', '#15301d', '#1c3d24', '#244a2c'], glint: '#2f5a37', sun: null, moon: true },
}

let css = '', delays = 0
function drift(fromX, toX, seconds) {
  const name = `c${delays}`
  css += `@keyframes ${name}{from{transform:translate(${fromX}px,0px)}to{transform:translate(${toX}px,0px)}}`
  css += `.${name}{animation:${name} ${seconds}s linear __D${delays}__ infinite}`
  delays++
  return name
}

// Sky: many flat bands from top colour to horizon colour (no gradients allowed).
function sky(p) {
  const bands = 40, h = 700 / bands
  let out = ''
  for (let i = 0; i < bands; i++) out += `<rect x="0" y="${r1(i * h)}" width="${W}" height="${r1(h + 1)}" fill="${mix(p.top, p.horizon, Math.pow(i / (bands - 1), 1.35))}"/>`
  return out + `<rect x="0" y="700" width="${W}" height="${H - 700}" fill="${p.horizon}"/>`
}

function stars(p) {
  if (!p.moon) return ''
  let dim = '', out = ''
  for (let i = 0; i < 70; i++) {
    const x = (i * 457) % W, y = (i * 193) % 520 + 10
    dim += `M${x} ${y}h2v2h-2z`
    if (i % 7 === 0) {
      const dur = [2.9, 3.7, 4.3, 5.1][i % 4]
      out += `<g><animateTransform attributeName="transform" type="translate" calcMode="discrete" values="0 2000;0 0;0 2000" keyTimes="0;0.6;0.75" dur="${dur}s" repeatCount="indefinite"/><path fill="#fff6d8" d="M${x - 2} ${y}h6v2h-6zM${x} ${y - 2}h2v6h-2z"/></g>`
    }
  }
  return `<path fill="#9fb0d8" d="${dim}"/>` + out +
    `<circle cx="1260" cy="150" r="46" fill="#f3efd2"/><circle cx="1282" cy="138" r="42" fill="${mix(p.top, p.horizon, 0.115)}"/>`
}

function sun(p) {
  if (!p.sun) return ''
  const [c, x, y, r] = p.sun
  return `<circle cx="${x}" cy="${y}" r="${r + 26}" fill="${mix(c, p.horizon, 0.7)}"/><circle cx="${x}" cy="${y}" r="${r + 12}" fill="${mix(c, p.horizon, 0.4)}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`
}

// A puffy cloud: overlapping circles, edge tint underneath, bright core on top.
function cloud(p, scale) {
  const puffs = [[0, 30, 34], [38, 12, 44], [86, 22, 38], [124, 34, 30], [60, 40, 36], [20, 44, 28], [104, 46, 26]]
  const base = puffs.map(([x, y, r]) => `<circle cx="${r1(x * scale)}" cy="${r1(y * scale + 6)}" r="${r1(r * scale)}"/>`).join('')
  const core = puffs.map(([x, y, r]) => `<circle cx="${r1(x * scale - 3)}" cy="${r1(y * scale)}" r="${r1(r * scale * 0.86)}"/>`).join('')
  return `<g fill="${p.cloudEdge}">${base}</g><g fill="${p.cloud}">${core}</g>`
}

function clouds(p) {
  const list = [[110, 1.4, 150], [210, 1.0, 190], [70, 0.8, 230], [300, 1.2, 170], [160, 0.7, 260], [250, 0.9, 210]]
  return list.map(([y, s, sec], i) => {
    const name = drift(-260, W + 60, sec)
    return `<g transform="translate(0 ${y})"><g class="${name}">${cloud(p, s)}</g></g>`
  }).join('')
}

// Rolling hills: smooth curves, each built from 3 flat bands for a soft light-to-dark look.
function hills(p) {
  const back = `M0 610 C 260 520 520 540 760 600 C 980 655 1200 560 1600 590 L1600 ${H} L0 ${H}Z`
  const main = (dy) => `M0 ${700 + dy} C 220 ${560 + dy} 560 ${470 + dy} 900 ${540 + dy} C 1180 ${600 + dy} 1380 ${640 + dy} 1600 ${610 + dy} L1600 ${H} L0 ${H}Z`
  const front = `M0 820 C 300 760 700 790 1000 830 C 1250 860 1450 820 1600 800 L1600 ${H} L0 ${H}Z`
  let out = `<path fill="${p.hills[0]}" d="${back}"/>`
  out += `<path fill="${p.hills[1]}" d="${main(0)}"/>`
  out += `<path fill="${p.hills[2]}" d="${main(26)}"/>`
  out += `<path fill="${p.hills[3]}" d="${main(60)}"/>`
  // A light sheen along the crest.
  out += `<path fill="none" stroke="${p.glint}" stroke-width="6" stroke-linecap="round" d="M150 ${672} C 360 ${560} 620 ${505} 880 ${548}"/>`
  out += `<path fill="${mix(p.hills[3], p.hills[0], 0.35)}" d="${front}"/>`
  return out
}

// Desktop icons: original glossy-ish drawings with a dark text outline for legibility.
// Drawn at 70 % via scaled coordinates (a scale transform would freeze the animation).
// Column centre x≈138 and rows y≈60–410 land in the window's top-left corner on a
// 1.6:1 window (the app crops ~80 units off each side).
const IK = 0.7
const n = (v) => Math.round(v * IK * 10) / 10
function label(x, y, text) {
  const t = (fill, dx, dy) => `<text x="${x + dx}" y="${y + dy}" fill="${fill}" font-family="Verdana, Tahoma, sans-serif" font-size="12" text-anchor="middle">${text}</text>`
  return t('#0b1e45', 1, 1) + t('#0b1e45', -1, 1) + t('#ffffff', 0, 0)
}
function icon(kind, cx, top) {
  // Shapes are written for a 52-wide icon whose top-left is (0,0), then scaled by IK.
  const X = (v) => r1(cx + n(v - 26)), Y = (v) => r1(top + n(v))
  const rect = (x, y, w, h, fill, rx = 0) => `<rect x="${X(x)}" y="${Y(y)}" width="${n(w)}" height="${n(h)}"${rx ? ` rx="${n(rx)}"` : ''} fill="${fill}"/>`
  if (kind === 'monitor') return rect(0, 0, 52, 38, '#dfe6ee', 4) + rect(5, 5, 42, 28, '#2f6fd6') + rect(5, 5, 42, 10, '#5c92e6') + rect(20, 38, 12, 7, '#b9c3cf') + rect(8, 45, 36, 5, '#dfe6ee', 2)
  if (kind === 'folder') return `<path fill="#e7b43c" d="M${X(0)} ${Y(0)}h${n(18)}l${n(5)} ${n(6)}h${n(29)}v${n(34)}h-${n(52)}z"/>` + rect(0, 12, 52, 28, '#f8d36a') + rect(0, 12, 52, 6, '#fbe39a')
  if (kind === 'globe') {
    const c = `cx="${X(26)}" cy="${Y(25)}"`
    return `<circle ${c} r="${n(25)}" fill="#2f78d8"/><circle cx="${X(18)}" cy="${Y(20)}" r="${n(9)}" fill="#58b947"/><circle cx="${X(34)}" cy="${Y(14)}" r="${n(6)}" fill="#58b947"/><circle cx="${X(32)}" cy="${Y(36)}" r="${n(6)}" fill="#58b947"/>` +
      `<path fill="none" stroke="#9cc8f2" stroke-width="1.5" d="M${X(1)} ${Y(25)}h${n(50)}M${X(26)} ${Y(0)}c-${n(12)} ${n(14)} -${n(12)} ${n(36)} 0 ${n(50)}M${X(26)} ${Y(0)}c${n(12)} ${n(14)} ${n(12)} ${n(36)} 0 ${n(50)}"/>`
  }
  // recycle bin
  return `<path fill="#c9d3dd" d="M${X(8)} ${Y(8)}h${n(36)}l-${n(4)} ${n(44)}h-${n(28)}z"/>` + rect(5, 0, 42, 8, '#e3e9ef', 2) +
    `<path fill="none" stroke="#9aa7b4" stroke-width="1.5" d="M${X(18)} ${Y(14)}v${n(32)}M${X(26)} ${Y(14)}v${n(32)}M${X(34)} ${Y(14)}v${n(32)}"/>`
}
function icons() {
  const cx = 138, rows = [['monitor', 'Computer'], ['folder', 'Documents'], ['globe', 'Internet'], ['bin', 'Recycle Bin']]
  return rows.map(([kind, text], i) => {
    const top = 62 + i * 90
    return icon(kind, cx, top) + label(cx, top + 52, text)
  }).join('')
}

// Taskbar: flat blue bands, a green pill button, a clock tray. Clock text is __CLOCK__.
// The app crops the scene's sides to fill the window (~80 units each side on a 1.6:1
// window), so the pill and the tray start at the true edge and their visible part is
// a classic, compact size.
function taskbar() {
  const y = H - BAR, mid = y + BAR / 2
  const CROP = 80
  let out = `<rect x="0" y="${y}" width="${W}" height="${BAR}" fill="#2457cf"/>`
  out += `<rect x="0" y="${y}" width="${W}" height="2" fill="#5f8ff0"/><rect x="0" y="${y + 2}" width="${W}" height="4" fill="#3a6fe0"/><rect x="0" y="${H - 4}" width="${W}" height="4" fill="#1a43a8"/>`
  // Green pill: visible width about 100 units.
  const pill = CROP + 100, r = BAR / 2
  out += `<path fill="#2f8f2f" d="M0 ${y}h${pill - r}q${r} 0 ${r} ${r}t-${r} ${r}h-${pill - r}z"/><path fill="#47b143" d="M0 ${y + 3}h${pill - r - 2}q${r - 6} 0 ${r - 6} ${r - 5}h-${pill - 8}z"/>`
  const sx = CROP + 16
  out += `<path fill="#e8814f" d="M${sx} ${mid}l3-8 3 8 8 3-8 3-3 8-3-8-8-3z"/>`
  out += `<text x="${sx + 18}" y="${mid + 6}" fill="#ffffff" font-family="Verdana, Tahoma, sans-serif" font-size="16" font-style="italic" font-weight="bold">start</text>`
  // Clock tray: visible width about 100 units.
  const tray = CROP + 100
  out += `<rect x="${W - tray}" y="${y}" width="${tray}" height="${BAR}" fill="#0f9be6"/><rect x="${W - tray}" y="${y}" width="2" height="${BAR}" fill="#0a6fb3"/><rect x="${W - tray + 2}" y="${y}" width="${tray - 2}" height="3" fill="#4fc0f2"/>`
  out += `<text x="${W - CROP - 50}" y="${mid + 5}" fill="#ffffff" font-family="Verdana, Tahoma, sans-serif" font-size="13" text-anchor="middle">__CLOCK__</text>`
  return out
}


// ---- weather: recolour a phase for rain or snow ----
function withWeather(p, weather) {
  if (weather === 'clear') return p
  if (weather === 'rain') {
    const grey = p.moon ? '#1b2233' : '#6c7788'
    return { ...p, top: mix(p.top, grey, 0.65), horizon: mix(p.horizon, grey, 0.55), cloud: mix(p.cloud, '#8a94a3', 0.6), cloudEdge: mix(p.cloudEdge, '#5d6676', 0.6),
      hills: p.hills.map((c) => mix(c, '#3a4a44', 0.35)), glint: mix(p.glint, '#3a4a44', 0.5), sun: null }
  }
  const snowLight = p.moon ? '#4a5878' : '#eef3f6', snowMid = p.moon ? '#3c4867' : '#d8e2ea'
  return { ...p, hills: [mix(p.hills[0], snowMid, 0.7), mix(p.hills[1], snowMid, 0.75), mix(p.hills[2], snowLight, 0.8), mix(p.hills[3], snowLight, 0.85)], glint: p.moon ? '#5b6a8c' : '#ffffff' }
}

// Falling rain or snow: each layer is a 900-high tile drawn twice and slid down one tile.
function precipitation(p, weather) {
  if (weather === 'clear') return ''
  const rain = weather === 'rain'
  let out = ''
  for (let layer = 0; layer < 3; layer++) {
    let d = ''
    const count = rain ? 70 : 55
    for (let i = 0; i < count; i++) {
      const seed = i * 7919 + layer * 104729
      const x = seed % W, y = (seed * 31) % H
      if (rain) d += `M${x} ${y}l-3 ${14 + layer * 6}h2l3-${14 + layer * 6}z`
      else { const r = 2 + layer; d += `M${x} ${y}h${r}v${r}h-${r}z` }
    }
    const color = rain ? mix('#dfe9f2', p.top, [0.55, 0.4, 0.25][layer]) : mix('#ffffff', p.top, [0.45, 0.25, 0.05][layer])
    const name = `p${layer}`
    css += `@keyframes ${name}{from{transform:translate(0px,0px)}to{transform:translate(${rain ? -60 : 0}px,${H}px)}}`
    css += `.${name}{animation:${name} ${rain ? [2.6, 1.9, 1.3][layer] : [24, 17, 11][layer]}s linear 0s infinite}`
    let art = `<g class="${name}"><path fill="${color}" d="${d}"/><g transform="translate(${rain ? 60 : 0} -${H})"><path fill="${color}" d="${d}"/></g></g>`
    if (!rain) art = `<g><animateTransform attributeName="transform" type="translate" values="0 0;${8 - layer * 2} 0;0 0;-${8 - layer * 2} 0;0 0" dur="${[7.3, 5.9, 4.7][layer]}s" repeatCount="indefinite"/>${art}</g>`
    out += art
  }
  return out
}

// ---- the orange Claude pet (original pixel drawing, same design as the camp look) ----
const PET = { body: '#d97757', shade: '#b8603f', eye: '#1d1714' }
const PU = 6 // one pet "pixel" in scene units: 15 x 9 grid → 90 x 54
function petArt({ legs = 'a', eyes = 'open', bob = 0 } = {}) {
  const px = (c, r, w = 1, h = 1) => `M${c * PU} ${(r + bob) * PU}h${w * PU}v${h * PU}h-${w * PU}z`
  const body = px(2, 0, 11, 3) + px(0, 3, 15, 2) + px(2, 5, 11, 1)
  let shade = px(2, 6, 11, 1)
  for (const c of legs === 'a' ? [2, 4, 10, 12] : [3, 5, 9, 11]) shade += px(c, 7, 1, 2)
  const eye = eyes === 'up' ? px(4, 1, 1, 2) + px(10, 1, 1, 2) : eyes === 'closed' ? px(4, 3) + px(10, 3) : px(4, 2, 1, 2) + px(10, 2, 1, 2)
  return `<path fill="${PET.body}" d="${body}"/><path fill="${PET.shade}" d="${shade}"/><path fill="${PET.eye}" d="${eye}"/>`
}
function hop(frames, steps, dur) {
  const n = steps.length, keyTimes = steps.map((_, i) => (i / n).toFixed(3)).join(';')
  return frames.map((art, f) => steps.includes(f)
    ? `<g><animateTransform attributeName="transform" type="translate" calcMode="discrete" values="${steps.map((s) => (s === f ? '0 0' : '0 3000')).join(';')}" keyTimes="${keyTimes}" dur="${dur}s" repeatCount="indefinite"/>${art}</g>` : '').join('')
}
function umbrella() {
  return `<path fill="#3f8f6a" d="M-18 -26q63-58 126 0z"/><path fill="#57ad83" d="M-18 -26q63-40 126 0z"/><rect x="43" y="-46" width="4" height="58" fill="#c9b48a"/>`
}
function pet(p, weather) {
  const feetY = 714 // just above the card and prompt box
  if (p.moon && weather !== 'rain') {
    // Night: sits and gazes up at the moon, blinking now and then.
    const steps = Array.from({ length: 24 }, (_, i) => (i === 21 ? 1 : 0))
    return `<g transform="translate(1040 ${feetY - 54})">${hop([petArt({ eyes: 'up' }), petArt({ eyes: 'closed' })], steps, 6)}</g>`
  }
  // Strolls back and forth across the meadow; legs step, a blink every few seconds.
  const walk = hop([petArt({ legs: 'a' }), petArt({ legs: 'b', bob: -1 }), petArt({ legs: 'a', eyes: 'closed' })],
    Array.from({ length: 16 }, (_, i) => (i === 13 ? 2 : i % 2)), 4)
  const name = 'walk'
  css += `@keyframes ${name}{0%{transform:translate(0px,0px)}50%{transform:translate(860px,0px)}100%{transform:translate(0px,0px)}}`
  css += `.${name}{animation:${name} ${weather === 'snow' ? 70 : 48}s linear __D99__ infinite}`
  return `<g transform="translate(330 ${feetY - 54})"><g class="${name}">${weather === 'rain' ? umbrella() : ''}${walk}</g></g>`
}

const scenes = {}
for (const [phase, base] of Object.entries(PHASES)) for (const weather of ['clear', 'rain', 'snow']) {
  css = ''; delays = 0
  const p = withWeather(base, weather)
  const body = sky(p) + stars(weather === 'rain' ? { ...p, moon: false } : p) + sun(p) + clouds(p) + hills(p) + icons() + pet(p, weather) + precipitation(p, weather) + taskbar()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><style>${css}</style>${body}</svg>`
  if (svg.length >= LIMIT) throw new Error(`desktop-${phase}-${weather}: ${svg.length} characters`)
  if (/opacity|clip|Gradient|filter|mask|transform-box|scale\(|rotate\(|shape-rendering/.test(svg)) throw new Error(`desktop-${phase}-${weather}: uses an avoided feature`)
  scenes[`cpp-world-desktop-${phase}-${weather}`] = svg
  console.log(`desktop-${phase}-${weather}`.padEnd(20), svg.length, 'chars')
}

writeFileSync(resolve(root, 'hooks/scenes-desktop.ts'),
  `// Generated by tools/build-desktop.mjs. Do not edit.\n// __CLOCK__ and __D<n>__ are filled in at render time (see register.tsx).\nexport const SCENES_DESKTOP: Record<string, string> = ${JSON.stringify(scenes, null, 2)}\n`)
mkdirSync(resolve(root, 'preview'), { recursive: true })
for (const [n, svg] of Object.entries(scenes)) {
  // Previews get a fixed clock and zero delays so they render standalone.
  writeFileSync(resolve(root, 'preview', `${n.slice(10)}.svg`), svg.replace('__CLOCK__', '10:42 AM').replace(/__D(\d+)__/g, (_, i) => `-${40 + Number(i) * 37}s`))
}
