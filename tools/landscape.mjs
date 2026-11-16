import { Pixels, rng, mix, translate } from './pixels.mjs'
const skies = {
  dawn: ['#554b78', '#8c658c', '#c4899a', '#e6a68e', '#f4c39d', '#f6d5ac'],
  day: ['#508aa4', '#609fb4', '#77b1bf', '#95c7ce', '#b1d6d4', '#c8dfd6'],
  dusk: ['#363654', '#675074', '#a36c85', '#d58b89', '#efb28d', '#f1c99d'],
  night: ['#10172e', '#18203d', '#21294a', '#2c3454', '#37405e', '#424d66'],
}
const land = {
  dawn: ['#93839c', '#797c92', '#5f7683', '#446866', '#334f51', '#293e44', '#476458'],
  day: ['#85a8b4', '#6b96a1', '#4e858b', '#3c726d', '#305d52', '#24463f', '#50765a'],
  dusk: ['#927a91', '#786e88', '#5b677b', '#405a64', '#30474e', '#26373f', '#4b6058'],
  night: ['#414b68', '#36435f', '#2b3c54', '#243b49', '#1b303b', '#162833', '#31494a'],
}
function palette(phase, weather) {
  if (weather === 'rain') {
    const mix = (a, b) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * .45 + parseInt(b.slice(i, i + 2), 16) * .55).toString(16).padStart(2, '0')).join('')
    return {
      sky: skies[phase].map((c, i) => mix(c, ['#293443', '#354352', '#465565', '#586574', '#6b7783', '#7d8790'][i])),
      land: land[phase].map((c, i) => mix(c, ['#687585', '#556775', '#455e6a', '#354f59', '#2a4249', '#22353e', '#49605d'][i])),
    }
  }
  if (weather === 'snow') return { sky: skies[phase], land: land[phase] }
  return { sky: skies[phase], land: land[phase] }
}
function pine(p,x,y,h,c,snow=false){
  const shade=mix(c,'#111e2b',.18),light=mix(c,'#8ca590',.22)
  p.rect(x-2,y+h-15,5,20,'#514c46');p.rect(x,y+h-14,1,17,'#82705c')
  for(let n=0;n<6;n++){
    const top=y+Math.floor(n*h/9),half=3+Math.floor(n*h/17),bottom=top+Math.floor(h/4)
    p.polygon([[x,top],[x+half,bottom],[x+half-4,bottom-1],[x+half-2,bottom+2],[x-half,bottom+2]],shade)
    p.polygon([[x,top],[x+1,bottom-3],[x-half,bottom]],c)
    p.line(x-1,top+4,x-half+2,bottom-2,light)
    if(n>1){p.line(x+2,bottom-7,x+half-2,bottom-1,c);p.rect(x-half+2,bottom,3,1,light)}
    if(snow)p.polygon([[x,top],[x+Math.max(2,half-4),top+Math.floor(h/9)],[x+2,top+Math.floor(h/9)-1],[x-half+3,top+Math.floor(h/9)+1]],'#dbe5df')
  }
}
const snowGround=phase=>({dawn:['#c9c3cf','#b5b1c2'],day:['#d3dfdd','#bccdcc'],dusk:['#c7b9c3','#ad9fb2'],night:['#5d6a85','#4c5874']}[phase])
export function buildBase(phase,weather,umbrella){
 const {sky,land:l}=palette(phase,weather),snowy=weather==='snow',night=phase==='night',lit=night||phase==='dusk'||weather!=='clear',r=rng(7193)
 const p=new Pixels()
 for(let i=0;i<6;i++)p.rect(0,i*34,640,34,sky[i])
 // A subtle one-pixel dither seam in the sky rather than scaled 2px blocks.
 for(let i=1;i<6;i++)for(let x=0;x<640;x+=8)p.rect(x+(i%2)*3,i*34-1,2,1,sky[i])
 if(weather!=='rain'){
   if(night){
     for(let y=-17;y<=17;y++)for(let x=-17;x<=17;x++)if(x*x+y*y<=289&&(x-9)**2+(y+5)**2>260)p.rect(532+x,60+y,1,1,x<0?'#e0d5b7':'#f3e6bd')
     p.rect(521,59,2,3,'#c2bea9');p.rect(524,69,3,2,'#c2bea9')
   }else{
     const sx=phase==='day'?512:494,sy=phase==='day'?56:154
     p.ellipse(sx,sy,22,22,phase==='dusk'?'#f8ca91':'#fff0bf');p.ellipse(sx-3,sy-4,16,16,phase==='dusk'?'#ffdda3':'#fff4ce')
     p.rect(sx-24,sy+7,49,1,sky[4]);p.rect(sx-20,sy+15,41,2,sky[4])
   }
 }
 if(night&&weather!=='rain')for(let i=0;i<65;i++){
   const x=Math.floor(r()*632)+4,y=Math.floor(r()*130)+6
   p.rect(x,y,1,1,i%3?'#8b9bb8':'#b5bcd0')
   if(i%13===0){p.rect(x-1,y,3,1,'#c4c4cb');p.rect(x,y-1,1,3,'#c4c4cb')}
 }
 const ridge=[[0,190],[36,170],[78,160],[120,174],[164,146],[222,168],[286,182],[334,176],[388,192],[432,164],[480,146],[518,164],[572,144],[640,172],[640,360],[0,360]]
 p.polygon(ridge,l[0])
 p.polygon([[0,210],[52,192],[98,206],[148,192],[206,202],[252,214],[316,212],[362,208],[420,210],[484,190],[546,196],[592,174],[640,186],[640,360],[0,360]],l[1])
 // Contour ridges, broken rock strata, native-resolution highlights.
 for(const [x,y] of [[26,177],[142,163],[465,158],[557,155]]){
   p.line(x,y,x+14,y-5,mix(l[0],sky[4],.18));p.line(x+17,y+2,x+29,y+7,mix(l[0],l[1],.25))
 }
 for(let i=0;i<140;i++){
   const x=Math.floor(r()*640),y=162+Math.floor(r()*58)
   if(p.data[y*640+x]===l[0]||p.data[y*640+x]===l[1])p.rect(x,y,2+Math.floor(r()*5),1,mix(p.data[y*640+x],l[2],.15))
 }
 p.polygon([[0,230],[64,214],[124,222],[180,208],[238,222],[306,230],[364,222],[434,228],[488,214],[560,210],[640,220],[640,360],[0,360]],l[2])
 for(let x=0;x<640;x+=15){if(x>230&&x<420)continue;pine(p,x,202+Math.floor(r()*14),23+Math.floor(r()*8),l[3],false)}
 p.polygon([[0,256],[66,240],[148,244],[208,250],[280,260],[354,256],[428,252],[514,234],[576,240],[640,232],[640,360],[0,360]],snowy?snowGround(phase)[0]:l[4])
 p.polygon([[0,288],[104,282],[212,296],[312,300],[408,286],[488,286],[576,278],[640,282],[640,360],[0,360]],snowy?snowGround(phase)[1]:l[5])
 const stream=night?'#2e4254':phase==='dusk'?'#636678':'#789c9e',waterLight=mix(stream,sky[4],.23)
 p.polygon([[356,238],[364,238],[346,254],[356,264],[342,276],[374,290],[378,302],[368,316],[380,338],[408,360],[376,360],[356,338],[352,316],[360,300],[340,284],[328,276],[340,264],[336,254]],stream)
 for(let i=0;i<90;i++){
   const x=325+Math.floor(r()*85),y=238+Math.floor(r()*122)
   if(p.data[y*640+x]===stream)p.rect(x,y,2+Math.floor(r()*4),1,waterLight)
 }
 for(let i=0;i<390;i++){
   const x=Math.floor(r()*640),y=251+Math.floor(r()*108)
   if(x>216&&x<456)continue
   const grass=snowy?mix(snowGround(phase)[1],'#e4e8df',.2):i%3?l[6]:l[4]
   p.rect(x,y,1+Math.floor(r()*5),1,grass)
   if(i%7===0){p.line(x,y,x-1,y-3,grass);p.line(x+1,y,x+2,y-2,grass)}
   if(i%23===0){p.ellipse(x,y,3,1,mix(l[4],'#afa599',.3));p.rect(x-1,y-1,3,1,mix(l[4],'#c6bba6',.4))}
 }
 if(phase==='dawn'){
   const c=mix(l[1],'#e4d5ce',.2)
   p.rect(0,204,218,1,c);p.rect(451,218,189,2,c);p.rect(54,226,136,1,c)
 }
 for(const [x,y,h] of [[8,150,106],[48,174,80],[606,152,106],[638,182,82]])pine(p,x,y,h,l[5],snowy)
 // Low canvas tent, ribs, seams, pegged ropes, flap and roll at the ridge.
 p.ellipse(72,274,47,5,l[5]);p.polygon([[28,267],[58,220],[84,224],[114,269]],'#805a48')
 p.polygon([[30,264],[58,222],[86,266]],night?'#c09a70':'#e1b37d')
 p.polygon([[60,224],[83,226],[110,264],[87,264]],night?'#796454':'#b48a62')
 p.polygon([[45,265],[58,238],[71,265]],'#303941');p.polygon([[48,264],[58,241],[57,264]],'#525653')
 p.line(58,224,32,264,'#f1cd96');p.line(61,226,86,263,'#b38b65');p.line(60,239,60,266,'#e3c99f')
 p.line(72,230,93,262,'#997455');p.line(81,228,105,262,'#c29a6f')
 p.rect(28,267,86,2,'#473e3b');p.rect(55,219,8,2,'#e4bc86');p.rect(29,264,14,2,'#c49a6c')
 p.line(58,222,22,269,'#a7997b');p.line(84,225,119,270,'#a7997b')
 for(const x of [22,118]){p.rect(x,267,2,8,'#8e8071');p.rect(x-1,267,4,1,'#c3b399')}
 if(snowy)p.polygon([[30,262],[58,220],[84,224],[90,234],[82,231],[65,229],[60,226],[40,259]],'#e1e7dc')
 // Fire: individual ring stones and crossed logs with bark and end grain.
 p.ellipse(190,278,23,5,'#3d4141')
 for(const [x,y,w] of [[171,274,6],[181,279,5],[195,280,6],[207,275,5],[178,271,4],[202,271,4]]){
   p.ellipse(x,y,w,3,'#68635c');p.rect(x-w+2,y-2,w,1,'#aaa08a');p.rect(x,y+2,w-1,1,'#484b48')
 }
 p.polygon([[177,268],[202,273],[201,277],[176,272]],'#6c4939');p.line(180,269,200,273,'#b18559')
 p.polygon([[180,276],[200,267],[204,270],[182,279]],'#72503c');p.line(183,276,200,269,'#c18c58')
 p.ellipse(179,272,3,2,'#c08e5b');p.rect(179,272,1,1,'#6d4b37')
 p.ellipse(202,270,3,2,'#bd8a58');p.rect(202,270,1,1,'#6d4b37')
 // Enamel mug and its handle.
 p.rect(164,283,10,6,'#b1a289');p.rect(165,283,8,1,'#dfc9a2');p.rect(174,284,3,4,'#b1a289');p.rect(175,285,1,2,l[4]);p.rect(165,285,1,3,'#d5c7ab')
 // Lantern's bracket, handle, glass mullion and bevels.
 p.rect(554,202,4,69,'#66594f');p.rect(555,203,1,66,'#978066');p.rect(532,202,26,3,'#8a7862')
 p.line(555,204,546,213,'#66594f');p.rect(533,205,1,10,'#b9a27d')
 p.ellipse(534,216,5,4,'#524b49');p.ellipse(534,216,3,2,l[4]);p.rect(524,217,20,3,'#524b49')
 p.rect(526,220,16,15,'#7b6d57');p.rect(528,222,12,10,lit?'#ffe3a3':'#a7b5a2')
 p.rect(529,223,3,8,lit?'#fff0c3':'#d0cdb2');p.rect(535,221,1,13,'#8a7759');p.rect(524,236,20,3,'#524b49');p.rect(527,236,14,1,'#a38c67');p.rect(550,271,12,3,'#554e47')
 // Log bench, grain, leg and saw-cut end.
 p.rect(584,272,32,7,'#5a5048');p.rect(587,270,28,4,'#97806a');p.line(589,271,612,271,'#c1a082');p.line(590,275,613,275,'#72604e')
 p.rect(588,278,3,4,'#483f38');p.rect(610,278,3,4,'#483f38');p.ellipse(585,274,3,4,'#b29774');p.ellipse(585,274,1,2,'#776451')
 if(snowy)p.rect(584,268,32,2,'#e1e7dc')
 let svg=p.svg()
 if(weather==='rain')svg+=translate(105,191,umbrella)
 if(lit){const g=new Pixels();g.ellipse(534,262,34,8,'#f3c784');g.rect(521,215,26,26,'#ffdd99');svg+=`<g opacity=".10">${g.svg()}</g>`}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" role="img"><title>C++ World · ${phase} · ${weather}</title><desc>Original fine pixel camping valley; cream Ragdoll C++ with blue eyes. Native transform-only SVG animation; no redraw clock.</desc>${svg}</svg>`
}
