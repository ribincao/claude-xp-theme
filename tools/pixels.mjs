// Original integer raster geometry. Merge horizontal runs vertically, then by colour.
export class Pixels {
  constructor(w = 640, h = 360) { this.w = w; this.h = h; this.data = new Array(w * h) }
  rect(x, y, w, h, color) {
    for (let yy = Math.max(0, Math.round(y)); yy < Math.min(this.h, y + h); yy++)
      for (let xx = Math.max(0, Math.round(x)); xx < Math.min(this.w, x + w); xx++) this.data[yy * this.w + xx] = color
  }
  polygon(points, color) {
    const lo = Math.max(0, Math.min(...points.map(p => p[1]))), hi = Math.min(this.h, Math.max(...points.map(p => p[1])))
    for (let y = lo; y < hi; y++) {
      const hits = []
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length]
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) hits.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]))
      }
      hits.sort((a,b) => a-b)
      for (let i = 0; i < hits.length; i += 2) this.rect(Math.ceil(hits[i]), y, Math.ceil(hits[i+1]) - Math.ceil(hits[i]), 1, color)
    }
  }
  ellipse(cx, cy, rx, ry, color) {
    for (let y = -ry; y <= ry; y++) {
      const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)))
      this.rect(cx - half, cy + y, half * 2 + 1, 1, color)
    }
  }
  line(x0, y0, x1, y1, color) {
    const dx = Math.abs(x1-x0), sx = x0<x1 ? 1:-1, dy = -Math.abs(y1-y0), sy = y0<y1 ? 1:-1
    let e = dx+dy
    for (;;) { this.rect(x0,y0,1,1,color); if (x0===x1 && y0===y1) break; const e2=e*2; if (e2>=dy) {e+=dy;x0+=sx} if (e2<=dx) {e+=dx;y0+=sy} }
  }
  svg() {
    const paths = new Map(); let active = new Map()
    const finish = r => { const [x,y,w,h,c]=r; paths.set(c,(paths.get(c)||'')+`M${x} ${y}h${w}v${h}h-${w}z`) }
    for (let y=0; y<this.h; y++) {
      const next=new Map()
      for (let x=0;x<this.w;) {
        const c=this.data[y*this.w+x]; if(!c){x++;continue}
        let end=x+1; while(end<this.w && this.data[y*this.w+end]===c)end++
        const w=end-x, key=`${c}:${x}:${w}`, old=active.get(key)
        if(old){old[3]++;next.set(key,old);active.delete(key)}else next.set(key,[x,y,w,1,c])
        x=end
      }
      for(const r of active.values())finish(r);active=next
    }
    for(const r of active.values())finish(r)
    // Trace the raster's exact perimeter as an alternative encoding. Native
    // one-pixel detail is retained, while solid terrain avoids row repetition.
    const edges=new Map(),stride=this.w+1
    const edge=(c,a,b)=>{if(!edges.has(c))edges.set(c,new Map());const m=edges.get(c);if(!m.has(a))m.set(a,[]);m.get(a).push(b)}
    for(let y=0;y<this.h;y++)for(let x=0;x<this.w;x++){
      const c=this.data[y*this.w+x];if(!c)continue
      const a=y*stride+x,b=a+1,d=a+stride,e=d+1
      if(y===0||this.data[(y-1)*this.w+x]!==c)edge(c,a,b)
      if(x===this.w-1||this.data[y*this.w+x+1]!==c)edge(c,b,e)
      if(y===this.h-1||this.data[(y+1)*this.w+x]!==c)edge(c,e,d)
      if(x===0||this.data[y*this.w+x-1]!==c)edge(c,d,a)
    }
    for(const [c,m] of edges){
      let d=''
      while(m.size){
        const start=m.keys().next().value;let cur=start,axis='',distance=0
        d+=`M${start%stride} ${Math.floor(start/stride)}`
        do{
          const list=m.get(cur),next=list.pop();if(!list.length)m.delete(cur)
          const delta=next-cur,a=Math.abs(delta)===1?'h':'v',n=a==='h'?delta:delta/stride
          if(a===axis)distance+=n;else{if(axis)d+=axis+distance;axis=a;distance=n}
          cur=next
        }while(cur!==start)
        if(axis)d+=axis+distance
        d+='z'
      }
      if(d.length<paths.get(c).length)paths.set(c,d)
    }
    return [...paths].map(([fill,d])=>`<path fill="${fill}" fill-rule="evenodd" d="${d}"/>`).join('')
  }
}
export const rng = seed => () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
export const translate = (x,y,svg) => `<g transform="translate(${x} ${y})">${svg}</g>`
export const mix = (a,b,t=.5) => '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('')
