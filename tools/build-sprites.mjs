import { Pixels, mix } from './pixels.mjs'
const f={outline:'#574b4a',cream:'#f4e9d4',white:'#fff7e5',shadow:'#cfc2b2',mask:'#776861',ear:'#b2918c',eye:'#72b9f0',pupil:'#273c57',warm:'#e4d5bd'}
// Original v2 pixel silhouettes, separated into layers for native transforms.
function cat(pose) {
  const breath=0, blink=0, tail=0, twitch=0
  let p=new Pixels(56,54)
  const nap=pose==='nap'||pose==='curl', stretch=pose==='stretch'
  if(nap){
    p.ellipse(25,39,23,12,f.outline);p.ellipse(25,38-breath,22,11,f.shadow)
    p.ellipse(22,36-breath,19,9,f.cream);p.ellipse(20,33-breath,13,5,f.white)
    p.polygon([[3,35],[1,38],[4,39],[2,42],[6,43],[4,46],[12,48],[31,48],[35,43],[29,39]],f.cream)
    p.rect(19,48,19,3,f.white);p.rect(22,50,2,1,f.shadow);p.rect(29,50,2,1,f.shadow)
  } else if(stretch){
    p.polygon([[5,37],[8,25-breath],[15,22-breath],[24,26-breath],[32,38],[45,43],[51,49],[21,50],[18,38],[13,49],[6,49]],f.outline)
    p.polygon([[6,36],[10,26-breath],[15,24-breath],[22,27-breath],[30,39],[46,45],[49,48],[23,49],[18,35],[12,48],[7,48]],f.cream)
    p.polygon([[10,27-breath],[15,25-breath],[22,28-breath],[26,34],[18,31],[12,34]],f.white)
    p.rect(23,48,28,3,f.white);p.rect(32,50,2,1,f.shadow);p.rect(43,50,2,1,f.shadow)
    p.line(14,33,17,40,f.warm)
  }else{
    p.polygon([[10,48],[12,33],[17,24],[23,21-breath],[36,22-breath],[44,32],[43,46],[48,50],[11,51]],f.outline)
    p.polygon([[12,47],[14,33],[19,25],[25,23-breath],[35,24-breath],[42,32],[40,46],[44,49],[13,50]],f.shadow)
    p.ellipse(29,35-breath,12,13,f.cream)
    p.polygon([[21,25-breath],[34,24-breath],[41,30],[38,31],[40,34],[35,33],[36,37],[32,36],[29,40],[26,36],[22,37],[23,33],[19,34]],f.white)
    p.rect(25,39,5,10,f.cream);p.rect(35,38,5,11,f.white)
    p.ellipse(25,49,6,2,f.white);p.ellipse(38,49,6,2,f.white)
    p.rect(23,50,1,1,f.shadow);p.rect(27,50,1,1,f.shadow);p.rect(37,50,1,1,f.shadow);p.rect(40,50,1,1,f.shadow)
    p.line(16,37,18,43,f.warm)
  }
  const body=p.svg(); p=new Pixels(56,54)
  // Fluffy, dark tail, separate outline tufts and a warm upper edge.
  if(stretch){
    p.polygon([[8,31],[3,25],[1,16],[3,9],[6,7],[8,10],[6,17],[7,23],[12,29]],f.outline)
    p.polygon([[7,28],[4,23],[3,16],[5,10],[6,11],[5,17],[6,22],[10,28]],f.mask)
    p.line(4,16,5,23,'#a29385')
  }else{
    p.polygon([[17,45],[12,47],[7,44+tail],[3,38+tail],[0,39+tail],[1,44+tail],[4,49],[10,52],[21,52],[25,49],[24,46]],f.outline)
    p.polygon([[17,46],[11,48],[6,45+tail],[3,40+tail],[2,42+tail],[5,48],[11,51],[21,51],[23,48]],f.mask)
    p.line(7,48,17,50,'#a29385');p.rect(18,49,4,1,'#a29385')
  }
  if(pose==='curl'){
    p.polygon([[6,43],[12,46],[26,48],[39,46],[45,42],[48,43],[47,48],[40,52],[24,53],[9,50],[4,46]],f.outline)
    p.polygon([[7,44],[13,47],[27,49],[40,47],[46,44],[45,48],[39,51],[24,52],[10,49],[5,46]],f.mask)
    p.line(14,49,26,51,'#a29385');p.line(28,51,38,50,'#a29385')
  }
  const hx=pose==='curl'?25:nap?27:stretch?28:20, hy=(pose==='curl'?28:nap?26:stretch?28:pose==='look'?4:7)-breath
  const h=new Pixels(28,29)
  h.polygon([[2,12],[1,1+twitch],[5,2],[10,6],[18,5],[23,0],[25,2],[26,12],[28,16],[26,22],[22,25],[17,28],[8,26],[3,23],[0,18]],f.outline)
  h.polygon([[3,12],[3,3+twitch],[6,4],[10,8],[18,7],[23,3],[24,11],[26,16],[24,22],[18,26],[9,25],[4,22],[2,18]],f.cream)
  h.polygon([[4,5+twitch],[7,7],[8,11],[4,10]],f.ear);h.polygon([[23,5],[20,8],[20,11],[23,10]],f.ear)
  h.polygon([[5,11],[10,9],[14,11],[18,9],[23,11],[24,17],[22,22],[16,24],[9,23],[4,18]],f.mask)
  h.rect(7,10,4,1,'#a39484');h.rect(18,10,3,1,'#a39484')
  h.polygon([[14,12],[12,17],[9,21],[13,23],[19,22],[16,18]],f.white)
  if(blink){h.rect(5,16,6,1,f.outline);h.rect(18,16,6,1,f.outline)}else{
    for(const x of [5,18]){
      h.rect(x,14,6,4,f.outline);h.rect(x+1,14,4,3,f.eye);h.rect(x+2,14,1,3,f.pupil);h.rect(x+1,14,1,1,f.white)
      if(nap)h.rect(x,14,6,1,f.mask)
    }
  }
  h.rect(13,21,3,1,'#423c3f');h.rect(14,22,1,2,'#423c3f');h.rect(12,24,2,1,f.shadow);h.rect(15,24,2,1,f.shadow)
  h.line(1,20,8,21,f.white);h.line(0,23,7,22,f.shadow);h.line(21,21,27,20,f.white);h.line(22,23,27,24,f.shadow)
  // Ruff strands cross the jaw, avoiding a flat block-shaped head.
  h.rect(4,23,2,2,f.white);h.rect(8,25,2,2,f.white);h.rect(18,25,2,2,f.white);h.rect(23,22,2,2,f.white)
  const ear=new Pixels(28,29)
  // Move the existing left ear pixels; leave an overlapping root at y=10.
  for(let y=0;y<11;y++)for(let x=0;x<11;x++){
    ear.data[y*28+x]=h.data[y*28+x]
    if(y<10)h.data[y*28+x]=undefined
  }
  const lids=new Pixels(28,29)
  for(const x of [5,18]){lids.rect(x,14,6,4,f.mask);lids.rect(x,16,6,1,f.outline)}
  return {body,tail:p.svg(),head:h.svg(),ear:ear.svg(),eyelids:lids.svg(),hx,hy}

}
function flame(t){
  const p=new Pixels(30,36), wobble=[0,1,0,-1][t]
  p.polygon([[3,33],[1,26],[5,18],[8,21],[12,9+wobble],[15,15],[18,2+wobble],[20,15],[24,12-wobble],[24,22],[28,27],[25,34]],'#d96845')
  p.polygon([[6,32],[5,27],[10,18],[12,24],[18,13+wobble],[19,23],[23,21],[25,29],[23,34]],'#ee9751')
  p.polygon([[10,33],[9,28],[13,22],[16,26],[19,20+wobble],[22,30],[20,34]],'#f8c671')
  p.polygon([[13,33],[13,29],[16,26+wobble],[19,31],[18,34]],'#fff0b5')
  return p.svg()
}
function cloud(phase,weather){
 const p=new Pixels(94,28),top=weather==='rain'?'#6c7c87':phase==='night'?'#46536d':'#dcdcd3',shadow=weather==='rain'?'#4b5c69':phase==='night'?'#303e5b':'#bccbd0'
 p.ellipse(21,17,19,7,shadow);p.ellipse(48,17,28,9,shadow);p.ellipse(76,18,17,6,shadow)
 p.ellipse(22,13,17,6,top);p.ellipse(43,10,18,9,top);p.ellipse(62,13,19,7,top)
 p.rect(12,19,71,3,top);p.rect(26,6,19,1,mix(top,'#ffffff',.12));p.rect(36,4,9,1,mix(top,'#ffffff',.12));p.rect(57,19,24,1,shadow)
 return p.svg()
}
export function buildSprites(){
 const cats=Object.fromEntries(['stretch','nap','sit','look','curl'].map(pose=>[pose,cat(pose)]))
 const clouds={};for(const phase of ['dawn','day','dusk','night'])for(const weather of ['clear','rain','snow'])clouds[`${phase}-${weather}`]=cloud(phase,weather)
 const umbrella=new Pixels(80,80)
 umbrella.rect(50,20,2,48,'#c3ab83');umbrella.line(50,67,46,69,'#c3ab83')
 umbrella.polygon([[1,25],[6,16],[18,7],[35,2],[50,5],[64,13],[72,25]],'#486f64')
 umbrella.polygon([[4,24],[10,16],[21,9],[34,4],[27,23]],'#719887')
 umbrella.polygon([[29,23],[36,4],[48,7],[53,23]],'#8ca996')
 umbrella.line(36,3,36,23,'#c1cfab');umbrella.line(36,3,64,22,'#a3bd9d');umbrella.rect(1,25,72,1,'#b7c7a4')
 const glow=new Pixels(100,30);glow.ellipse(50,15,45,12,'#efa15e');glow.ellipse(50,15,29,7,'#ffcb78')
 return {cats,flames:[0,1,2,3].map(flame),clouds,umbrella:umbrella.svg(),glow:glow.svg()}
}
