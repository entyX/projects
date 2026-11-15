'use strict';
// =====================================================================
//  Perceive: extended test library. Shares helpers with index.html.
//  Every test runs on the round engine below. All randomness for a test is
//  drawn up front (in round()), so seeded dailies give everyone the same levels.
// =====================================================================
const PAL=['#ff6b2c','#7dd3a0','#9bb8ff','#f2c94c','#ff5a5f','#c792ea','#5ee0e0','#ecebe8'];
const pick=a=>a[Math.floor(Math.random()*a.length)];
const angDiff=(a,b)=>{let d=((a-b)%360+540)%360-180;return Math.abs(d);};
const deg=r=>r*180/Math.PI,rad=d=>d*Math.PI/180;
function emoji(x,ch,X,Y,s){x.font=`${s}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(ch,X,Y);}
function regPoly(x,X,Y,r,n,rot=0){x.beginPath();for(let i=0;i<n;i++){const a=rot+i*PI2/n-Math.PI/2,px=X+r*Math.cos(a),py=Y+r*Math.sin(a);i?x.lineTo(px,py):x.moveTo(px,py);}x.closePath();}
function blob(n,r,j){return Array.from({length:n},(_,i)=>{const a=i*PI2/n,q=r*(1-j/2+Math.random()*j);return [Math.cos(a)*q,Math.sin(a)*q];});}
function polyPath(x,P,X,Y,s=1,rot=0,smooth=false){const c=Math.cos(rot),sn=Math.sin(rot),T=P.map(([a,b])=>[X+(a*c-b*sn)*s,Y+(a*sn+b*c)*s]);x.beginPath();
  if(!smooth){T.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.closePath();return;}
  const m=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2],n=T.length;let s0=m(T[n-1],T[0]);x.moveTo(s0[0],s0[1]);for(let i=0;i<n;i++){const q=m(T[i],T[(i+1)%n]);x.quadraticCurveTo(T[i][0],T[i][1],q[0],q[1]);}x.closePath();}
function polyArea(P){let a=0;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a)/2;}
function panel(x,X,Y,w,h,{fill='#111113',stroke='rgba(255,255,255,.09)',r=12}={}){x.fillStyle=fill;x.strokeStyle=stroke;x.lineWidth=1;x.beginPath();x.roundRect(X,Y,w,h,r);x.fill();x.stroke();}
function beep(f,dur=.25,o={}){const a=audio();if(!a)return;const t=a.currentTime+(o.at||0),vol=o.vol||.2,os=a.createOscillator(),g=a.createGain();os.type=o.type||'sine';os.frequency.setValueAtTime(f,t);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.012);g.gain.setValueAtTime(vol,t+Math.max(.02,dur-.05));g.gain.linearRampToValueAtTime(0,t+dur);os.connect(g);
  if(o.pan!=null&&a.createStereoPanner){const p=a.createStereoPanner();p.pan.value=o.pan;g.connect(p).connect(a.destination);}else g.connect(a.destination);os.start(t);os.stop(t+dur+.05);}
function noise(dur=.2,o={}){const a=audio();if(!a)return;const t=a.currentTime+(o.at||0),n=Math.floor(a.sampleRate*dur),b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);let s=12345;
  for(let i=0;i<n;i++){s=(s*16807)%2147483647;d[i]=(s/2147483647*2-1)*Math.min(1,i/200,(n-i)/400);}
  const src=a.createBufferSource();src.buffer=b;const f=a.createBiquadFilter();f.type='bandpass';f.frequency.value=o.f||1800;f.Q.value=o.q||.8;const g=a.createGain();g.gain.value=o.vol||.5;src.connect(f).connect(g);
  if(o.pan!=null&&a.createStereoPanner){const p=a.createStereoPanner();p.pan.value=o.pan;g.connect(p).connect(a.destination);}else g.connect(a.destination);src.start(t);}

// ================= ROUND ENGINE =================
// cfg: {n, W, H, sub, grid, round(i,n) -> R, detail(scores,rounds)}
// R: {mode:'choice'|'click'|'aim'|'slider'|'number'|'text'|'custom', show(ms before answering), prompt, ask, choices, answer,
//     draw(x,c,t,st), hit(p,st), aim(p,st), nudge(d,st), slider:{min,max,step,init,fmt}, down(p,st,done), key(e,st,done),
//     score(v,rt,st)->0..100, detail(v,s,st), start(st), onAsk(st,ctx), limit(ms), rev(ms), hint, keys}
function trialGame(api,cfg){
  const W=cfg.W||640,H=cfg.H||380,[c,x]=makeCanvas(W,H);api.body.append(c);if(cfg.sub)api.sub(cfg.sub);
  const n=cfg.n,R=Array.from({length:n},(_,i)=>cfg.round(i,n));
  const status=el('div',{class:'status'}),ctl=el('div',{class:'row tctl'}),pips=el('div',{class:'tpips'},R.map(()=>el('i')));
  api.ctrl.append(el('div',{class:'tstack'},[status,ctl,pips]));
  let i=-1,r=null,st=null,t0=performance.now(),phase='count';const res=[],cst={};
  function nextRound(){i++;if(i>=n)return end();r=R[i];st={phase:r.show?'show':'pre',v:null,hover:null};t0=performance.now();ctl.innerHTML='';
    status.innerHTML=r.prompt||'';[...pips.children].forEach((p,k)=>p.classList.toggle('cur',k===i));c.style.cursor='default';
    if(r.start)r.start(st);if(!r.show)ask();}
  function ask(){st.phase='ask';st.ta=performance.now();ctl.innerHTML='';status.innerHTML=r.ask||r.prompt||'';
    if(r.mode==='click'||r.mode==='aim'||r.mode==='custom')c.style.cursor='crosshair';
    if(r.mode==='choice'){st.btns=r.choices.map((ch,k)=>el('button',{class:'btn',html:ch+(r.choices.length<=9?` <kbd>${k+1}</kbd>`:''),onclick:()=>answer(k)}));ctl.append(...st.btns);}
    else if(r.mode==='slider'){const s=r.slider,lab=el('b',{class:'slv'}),inp=el('input',{type:'range',min:s.min,max:s.max,step:s.step||1,'aria-label':'Your estimate'});
      inp.value=s.init!=null?s.init:(s.min+s.max)/2;const upd=()=>{st.v=+inp.value;lab.textContent=s.fmt?s.fmt(st.v):st.v;};inp.addEventListener('input',upd);upd();
      ctl.append(el('div',{class:'slwrap'},[el('small',{text:s.fmt?s.fmt(s.min):s.min}),inp,el('small',{text:s.fmt?s.fmt(s.max):s.max}),lab]),el('button',{class:'btn primary',html:'Lock in <kbd>↵</kbd>',onclick:()=>answer(st.v)}));
      setTimeout(()=>inp.focus({preventScroll:true}),30);}
    else if(r.mode==='number'||r.mode==='text'){const inp=el('input',{class:'inp',type:r.mode==='number'?'number':'text',inputmode:r.mode==='number'?'decimal':'text',autocomplete:'off',spellcheck:'false',placeholder:'?','aria-label':'Your answer',style:r.mode==='text'?'width:260px;letter-spacing:.12em':''});
      const f=el('form',{class:'row',onsubmit:e=>{e.preventDefault();const v=r.mode==='number'?parseFloat(inp.value):inp.value.trim();if(r.mode==='number'?isNaN(v):!v)return inp.focus();answer(v);}},[inp,el('button',{class:'btn primary',html:'Submit <kbd>↵</kbd>'})]);
      ctl.append(f);setTimeout(()=>inp.focus({preventScroll:true}),30);}
    else if(r.mode==='aim'){st.lock=el('button',{class:'btn primary',html:'Lock in <kbd>↵</kbd>',disabled:true,onclick:()=>{if(st.v!=null)answer(st.v);}});ctl.append(st.lock,hint(r.hint||'Click or drag on the canvas. <kbd>←</kbd><kbd>→</kbd> fine-tune.'));}
    else if(r.hint)ctl.append(hint(r.hint));
    if(r.onAsk)r.onAsk(st,{done:answer,ctl});}
  function answer(v){if(!st||st.phase!=='ask')return;st.phase='reveal';st.v=v;st.tr=performance.now();const rt=st.tr-st.ta;
    // Untimed multiple choice: accuracy decides, speed is a quiet tiebreak (correct = 92..100, slower = lower; wrong = 0).
    const tie=()=>100-8*(1-Math.exp(-Math.max(0,rt-1000)/5000));
    let s=v==null&&!r.allowNull?0:r.score?r.score(v,rt,st):(v===r.answer?(!r.limit&&(r.mode==='choice'||r.mode==='click')?tie():100):0);s=isFinite(s)?clamp(s,0,100):0;st.s=s;res.push(s);c.style.cursor='default';
    if(st.btns)st.btns.forEach((b,k)=>{b.disabled=true;if(k===r.answer)b.classList.add('okb');else if(k===v)b.classList.add('badb');});else ctl.innerHTML='';
    const d=r.detail?r.detail(v,s,st):null;
    status.innerHTML=d!=null?d:v==null?'<b class="b">Out of time</b>':s>=50?'<b class="g">Correct</b>':'<b class="b">Wrong</b>';
    const p=pips.children[i];p.classList.remove('cur');p.classList.add(s>=85?'g':s>=50?'m':'b');
    sfx(s>=85?880:s>=50?660:330,.08,.12);later(nextRound,r.rev||1250);}
  function end(){phase='done';const avg=res.length?res.reduce((a,b)=>a+(isFinite(b)?b:0),0)/res.length:0;
    api.finish(avg,cfg.detail?cfg.detail(res,R):`<b>${res.filter(s=>s>=50).length} / ${n}</b> rounds right.`);}
  loop(now=>{bg(x,c,cfg.grid!==false);
    if(phase==='count'){if(cdown(x,c,now-t0,cst)){phase='run';sfx(1046,.1,.12);nextRound();}return;}
    if(!r)return;const t=now-t0;
    if(st.phase==='show'&&t>=r.show)ask();
    if(st.phase==='ask'&&r.limit){const left=1-(now-st.ta)/r.limit;if(left<=0)answer(null);else{x.fillStyle=C.line;x.fillRect(0,c.H-3,c.W,3);x.fillStyle=left<.25?C.bad:C.you;x.fillRect(0,c.H-3,c.W*left,3);}}
    x.save();r.draw(x,c,t,st);x.restore();
    if(phase!=='done')txt(x,`${i+1} / ${n}`,c.W-14,16,C.dim,`500 10px ${MONO}`,'right');});
  listen(c,'pointerdown',e=>{if(!r||st.phase!=='ask')return;const p=pt(e,c);
    if(r.mode==='click'){const k=r.hit(p,st);if(k!=null&&k>=0)answer(k);}
    else if(r.mode==='aim'){st.drag=true;try{c.setPointerCapture(e.pointerId);}catch(_){}r.aim(p,st);if(st.lock)st.lock.disabled=st.v==null;}
    else if(r.down)r.down(p,st,answer);});
  listen(c,'pointermove',e=>{if(!r)return;const p=pt(e,c);st.hover=p;if(st.phase==='ask'&&r.mode==='aim'&&st.drag)r.aim(p,st);});
  listen(c,'pointerup',()=>{if(st)st.drag=false;});listen(c,'pointerleave',()=>{if(st)st.hover=null;});
  listen(window,'keydown',e=>{if(!r||!st||st.phase!=='ask'||e.repeat)return;const tag=e.target.tagName;
    if(r.key&&r.key(e,st,answer)!==false&&e.defaultPrevented)return;
    if(r.mode==='choice'){const k=+e.key-1;if(k>=0&&k<r.choices.length){e.preventDefault();answer(k);}else if(r.keys&&r.keys[e.key]!=null){e.preventDefault();answer(r.keys[e.key]);}}
    else if(r.mode==='aim'){if(e.key==='Enter'&&st.v!=null){e.preventDefault();answer(st.v);}else if(r.nudge&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();r.nudge((e.key==='ArrowRight'?1:-1)*(e.shiftKey?10:1),st);if(st.lock)st.lock.disabled=st.v==null;}}
    else if(r.mode==='slider'&&e.key==='Enter'&&tag!=='BUTTON'){e.preventDefault();answer(st.v);}});
}
const T=(cfg)=>{const f=api=>trialGame(api,typeof cfg==='function'?cfg():cfg);f.cfg=cfg;return f;}; // .cfg lets the briefing build an auto-demo
const lv=(i,n,a,b)=>a+(b-a)*(n>1?i/(n-1):0); // difficulty ramp
const twoUp=['Left','Right'],tb=['Top','Bottom'];
const LRK={ArrowLeft:0,ArrowRight:1,a:0,d:1},UDK={ArrowUp:0,ArrowDown:1,w:0,s:1};
const avgErrDetail=(unit,f=v=>v.toFixed(1))=>(res,R)=>`Average across ${R.length} rounds. ${R.map(r=>r.err!=null?f(r.err)+unit:'').filter(Boolean).join(' · ')}`;

// ================= GRID RECALL (Flash, Grid, Sequence Memory) =================
function gridRound({N,k,flash,ordered}){
  const cells=shuffle([...Array(N*N).keys()]).slice(0,k),W=640,H=400,S=Math.min(320/N,70),ox=(W-S*N)/2,oy=(H-S*N)/2+4,ON=420,GAP=170;
  const show=ordered?500+k*(ON+GAP)+250:600+flash+350;
  const at=p=>{const cx=Math.floor((p.x-ox)/S),cy=Math.floor((p.y-oy)/S);return cx>=0&&cy>=0&&cx<N&&cy<N?cy*N+cx:-1;};
  return {mode:'custom',show,prompt:ordered?'Watch the order…':'Memorize the lit squares…',ask:ordered?`Repeat the sequence: click <b>${k}</b> squares in order.`:`Click the <b>${k}</b> squares that lit up.`,
    start(st){st.sel=[];},demo:{clicks:cells.map(ci=>[ox+(ci%N+.5)*S,oy+(Math.floor(ci/N)+.5)*S]),sel:cells.slice(),value:cells.slice()},
    down(p,st,done){const ci=at(p);if(ci<0||st.sel.includes(ci))return;st.sel.push(ci);sfx(480+st.sel.length*70,.07,.07);if(st.sel.length>=k)later(()=>done(st.sel.slice()),180);},
    score:v=>ordered?v.filter((c,i)=>c===cells[i]).length/k*100:v.filter(c=>cells.includes(c)).length/k*100,
    detail:(v,s)=>`<b>${Math.round(s/100*k)} / ${k}</b> ${ordered?'in the right order':'squares right'}`,
    draw(x,c,t,st){
      let lit=-1;if(st.phase==='show'&&ordered){const q=t-500,j=Math.floor(q/(ON+GAP));if(q>=0&&q%(ON+GAP)<ON)lit=cells[j];}
      const flashOn=st.phase==='show'&&!ordered&&t>=600&&t<600+flash,hv=st.hover&&st.phase==='ask'?at(st.hover):-1;
      for(let ci=0;ci<N*N;ci++){const X=ox+(ci%N)*S,Y=oy+Math.floor(ci/N)*S,pad=Math.max(3,S*.07);
        let fill='#18181b',stroke='rgba(255,255,255,.07)',glow=null;
        const isT=cells.includes(ci),sel=st.sel?st.sel.indexOf(ci):-1;
        if(lit===ci||(flashOn&&isT)){fill=C.you;glow=C.you;}
        else if(st.phase==='ask'){if(sel>=0){fill=rgba(C.you,.85);}else if(hv===ci)fill='#222226';}
        else if(st.phase==='reveal'){const ok=ordered?st.v&&st.v[cells.indexOf(ci)]===ci:isT;
          if(sel>=0)fill=(ordered?cells[sel]===ci:isT)?C.truth:C.bad;else if(isT){stroke=C.truth;}}
        x.save();if(glow){x.shadowColor=glow;x.shadowBlur=22;}x.fillStyle=fill;x.beginPath();x.roundRect(X+pad,Y+pad,S-2*pad,S-2*pad,Math.min(12,S*.18));x.fill();x.restore();
        x.strokeStyle=stroke;x.lineWidth=stroke===C.truth?2:1;x.stroke();
        if(ordered&&sel>=0&&st.phase!=='show')txt(x,String(sel+1),X+S/2,Y+S/2,'#0a0a0b',`600 ${Math.round(S*.3)}px ${MONO}`);
        if(ordered&&st.phase==='reveal'&&isT&&sel<0)txt(x,String(cells.indexOf(ci)+1),X+S/2,Y+S/2,C.truth,`600 ${Math.round(S*.3)}px ${MONO}`);}}};
}
const flashGame=T({n:6,sub:'A pattern of lights blinks on for a split second. Click every light that was on.',round:(i,n)=>gridRound({N:5,k:Math.round(lv(i,n,4,8)),flash:Math.round(lv(i,n,420,220))}),detail:(r)=>`Avg <b>${fmt(r.reduce((a,b)=>a+b)/r.length)}%</b> of lights recalled.`});
const gridGame=T({n:6,sub:'Squares light up for a moment. Remember where they were and click them all.',round:(i,n)=>{const N=[4,4,5,5,6,6][i]||6;return gridRound({N,k:Math.round(lv(i,n,4,10)),flash:1300});},detail:r=>`Avg <b>${fmt(r.reduce((a,b)=>a+b)/r.length)}%</b> of squares recalled.`});
const seqMemGame=T({n:5,sub:'Squares flash one after another. Repeat the exact sequence.',round:(i,n)=>gridRound({N:i<2?3:4,k:Math.round(lv(i,n,4,8)),ordered:true}),detail:r=>`Avg <b>${fmt(r.reduce((a,b)=>a+b)/r.length)}%</b> of each sequence right.`});

// ================= MATCH =================
const matchGame=T({n:10,sub:'Two shapes. Are they <b>exactly</b> the same? The differences get smaller every round.',round(i,n){
  const P=blob(randi(7,11),1,.55),same=Math.random()<.5,d=lv(i,n,.22,.05),Q=P.map(p=>p.slice());let which=-1;
  if(!same){which=randi(0,Q.length-1);const f=Math.random()<.5?1+d:1-d;Q[which]=[Q[which][0]*f,Q[which][1]*f];}
  const rot=rand(0,PI2),sw=Math.random()<.5;
  return {mode:'choice',choices:['Same','Different'],keys:{s:0,d:1,ArrowLeft:0,ArrowRight:1},answer:same?0:1,limit:7000,ask:'Same or different?',
    draw(x,c,t,st){const A=sw?Q:P,B=sw?P:Q;[[A,180],[B,460]].forEach(([S,X])=>{panel(x,X-120,70,240,240);polyPath(x,S,X,190,88,rot);x.fillStyle=rgba(C.ink,.9);x.fill();});
      if(st.phase==='reveal'&&!same){[[A,180],[B,460]].forEach(([S,X])=>{const p=S[which],cs=Math.cos(rot),sn=Math.sin(rot);x.strokeStyle=C.gap;x.lineWidth=2;x.beginPath();x.arc(X+(p[0]*cs-p[1]*sn)*88,190+(p[0]*sn+p[1]*cs)*88,12,0,PI2);x.stroke();});}}};}});

// ================= 3D polycubes (Rotate, Shadow) =================
const DIRS6=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const mm=(A,B)=>A.map(r=>[0,1,2].map(j=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j]));
const app=(M,p)=>[0,1,2].map(i=>M[i][0]*p[0]+M[i][1]*p[1]+M[i][2]*p[2]);
const ROT24=(()=>{const I=[[1,0,0],[0,1,0],[0,0,1]],RX=[[1,0,0],[0,0,-1],[0,1,0]],RY=[[0,0,1],[0,1,0],[-1,0,0]],out=[I],seen=new Set([I+'']);
  for(let i=0;i<out.length;i++)for(const Rm of [RX,RY]){const M=mm(out[i],Rm);if(!seen.has(M+'')){seen.add(M+'');out.push(M);}}return out;})();
const normSet=s=>{const d=s[0].length,m=[...Array(d).keys()].map(i=>Math.min(...s.map(p=>p[i])));return s.map(p=>p.map((v,i)=>v-m[i]).join()).sort().join('|');};
const canon3=s=>ROT24.map(M=>normSet(s.map(p=>app(M,p)))).sort()[0];
function polycube(n,flat=false){const s=[[0,0,0]],has=new Set(['0,0,0']);let g=0;while(s.length<n&&g++<800){const b=pick(s),d=DIRS6[randi(0,flat?3:5)],q=[b[0]+d[0],b[1]+d[1],b[2]+d[2]];if(!has.has(q+'')){has.add(q+'');s.push(q);}}return s;}
function rotM(a,b,cc){const [ca,sa,cb,sb,c3,s3]=[Math.cos(a),Math.sin(a),Math.cos(b),Math.sin(b),Math.cos(cc),Math.sin(cc)];
  return mm(mm([[1,0,0],[0,cb,-sb],[0,sb,cb]],[[ca,0,sa],[0,1,0],[-sa,0,ca]]),[[c3,-s3,0],[s3,c3,0],[0,0,1]]);}
function drawCubes(x,cubes,M,X,Y,s,hue=22){
  const ctr=[0,1,2].map(i=>cubes.reduce((a,p)=>a+p[i],0)/cubes.length),set=new Set(cubes.map(p=>p+'')),faces=[],L=[-.35,.75,.55];
  for(const p of cubes)for(const d of DIRS6){if(set.has([p[0]+d[0],p[1]+d[1],p[2]+d[2]]+''))continue;const nn=app(M,d);if(nn[2]<=1e-4)continue;
    const u=d[0]?[0,1,0]:[1,0,0],w=d[2]?[0,1,0]:d[0]?[0,0,1]:[0,0,1],cc=p.map((v,i)=>v-ctr[i]+d[i]/2);
    const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>app(M,cc.map((v,i)=>v+u[i]*a/2+w[i]*b/2)));
    faces.push({z:app(M,cc)[2],pts:corners,b:.3+.7*Math.max(0,nn[0]*L[0]+nn[1]*L[1]+nn[2]*L[2])});}
  faces.sort((a,b)=>a.z-b.z);
  for(const f of faces){x.beginPath();f.pts.forEach((q,i)=>{const px=X+q[0]*s,py=Y-q[1]*s;i?x.lineTo(px,py):x.moveTo(px,py);});x.closePath();
    x.fillStyle=`hsl(${hue} ${60}% ${12+f.b*50}%)`;x.fill();x.strokeStyle='rgba(0,0,0,.55)';x.lineWidth=1.2;x.lineJoin='round';x.stroke();}}
const randRot=()=>rotM(rand(0,PI2),rand(-1.1,1.1),rand(0,PI2));
const rotateGame=T({n:6,W:640,H:440,sub:'Which option is the same object as the top one, just rotated? The others are mirror images.',round(i,n){
  let S,MS,g=0;do{S=polycube(randi(5,5+Math.floor(i/2)));MS=S.map(p=>[-p[0],p[1],p[2]]);}while(canon3(S)===canon3(MS)&&g++<50);
  const ans=randi(0,3),opts=[0,1,2,3].map(k=>({S:k===ans?S:MS,M:randRot()})),M0=randRot(),hue=randi(0,360);
  const OX=k=>95+k*150,OY=330;
  return {mode:'click',answer:ans,limit:20000,ask:'Click the rotated match.',hit:p=>{for(let k=0;k<4;k++)if(Math.abs(p.x-OX(k))<70&&Math.abs(p.y-OY)<80)return k;return -1;},
    score:(v,rt)=>v===ans?100*Math.max(.55,Math.exp(-((Math.max(0,rt-2500)/14000)**1.4))):0,
    draw(x,c,t,st){panel(x,220,14,200,190,{fill:'#141416'});drawCubes(x,S,M0,320,112,24,hue);txt(x,'TARGET',320,30,C.dim,`500 9.5px ${MONO}`);
      for(let k=0;k<4;k++){const hov=st.hover&&st.phase==='ask'&&Math.abs(st.hover.x-OX(k))<70&&Math.abs(st.hover.y-OY)<80;
        let stroke=hov?C.you:'rgba(255,255,255,.09)';if(st.phase==='reveal'){if(k===ans)stroke=C.truth;else if(k===st.v)stroke=C.bad;}
        panel(x,OX(k)-68,OY-82,136,164,{stroke});drawCubes(x,opts[k].S,opts[k].M,OX(k),OY,17,hue);txt(x,String(k+1),OX(k)-56,OY-68,C.dim,`500 10px ${MONO}`,'left');}}};}});

// ================= FIND =================
const FINDP=[['O','Q'],['E','F'],['M','N'],['b','d'],['p','q'],['6','9'],['C','G'],['8','B'],['V','Y'],['u','v'],['1','l'],['O','0']];
const findGame=T({n:6,W:640,H:400,sub:'One symbol is different from the rest. Find it and click it, fast.',round(i,n){
  const [a,b]=FINDP[Math.min(FINDP.length-1,Math.floor(lv(i,n,0,FINDP.length-1))+randi(0,1))],sw=Math.random()<.5,base=sw?b:a,odd=sw?a:b;
  const cols=Math.round(lv(i,n,8,14)),rows=Math.round(lv(i,n,5,8)),gw=560/cols,gh=320/rows,tg=randi(0,cols*rows-1),fs=Math.min(gw,gh)*.62,jit=[...Array(cols*rows)].map(()=>[rand(-.12,.12)*gw,rand(-.12,.12)*gh]);
  const pos=k=>[40+gw*(k%cols+.5)+jit[k][0],48+gh*(Math.floor(k/cols)+.5)+jit[k][1]];
  return {mode:'click',answer:tg,limit:15000,ask:'Find the odd one out.',hit(p){let best=-1,bd=1e9;for(let k=0;k<cols*rows;k++){const [X,Y]=pos(k),d=Math.hypot(p.x-X,p.y-Y);if(d<bd){bd=d;best=k;}}return bd<Math.max(gw,gh)*.6?best:-1;},
    score:(v,rt)=>v===tg?100*Math.exp(-((Math.max(0,rt-900)/6500)**1.4)):0,detail:(v,s,st)=>v===tg?`<b class="g">Found</b> in <b>${((st.tr-st.ta)/1000).toFixed(2)}s</b>`:v==null?'<b class="b">Out of time</b>':'<b class="b">Not that one</b>',
    draw(x,c,t,st){if(st.phase==='show')return;for(let k=0;k<cols*rows;k++){const [X,Y]=pos(k);let col=C.ink2||'#c9c8c4';if(st.phase==='reveal'&&k===tg){glowDot(x,X,Y,fs*.75,rgba(C.truth,.25),10);col=C.truth;}
      txt(x,k===tg?odd:base,X,Y,st.phase==='reveal'&&k===st.v&&k!==tg?C.bad:col,`500 ${fs}px ${MONO}`);}}};}});

// ================= FOLLOW (multiple object tracking) =================
const followGame=T({n:5,W:640,H:400,sub:'Watch the highlighted ball. When they all go white and start moving, keep your eyes on it. Then click it.',round(i,n){
  const N=Math.round(lv(i,n,6,11)),sp=lv(i,n,120,210),B=[...Array(N)].map(()=>({x:rand(40,600),y:rand(40,360),vx:0,vy:0})),tg=randi(0,N-1),HL=1600,MV=4200;
  B.forEach(b=>{const a=rand(0,PI2),s=sp*rand(.75,1.25);b.vx=Math.cos(a)*s;b.vy=Math.sin(a)*s;b.w=rand(.6,1.6);b.ph=rand(0,PI2);});
  const tri=(v,lo,hi)=>{const L=hi-lo,m=((v-lo)%(2*L)+2*L)%(2*L);return lo+(m<L?m:2*L-m);};
  const at=(b,tt)=>{const s=Math.max(0,Math.min(tt,MV))/1000,wob=Math.sin(s*b.w*2+b.ph)*30;return [tri(b.x+b.vx*s+wob,20,620),tri(b.y+b.vy*s-wob*.6,20,380)];};
  return {mode:'click',show:HL+MV,answer:tg,prompt:'Track the orange ball…',ask:'Which one was it? Click it.',
    hit(p){let best=-1,bd=1e9;B.forEach((b,k)=>{const [X,Y]=at(b,1e9),d=Math.hypot(p.x-X,p.y-Y);if(d<bd){bd=d;best=k;}});return bd<40?best:-1;},
    draw(x,c,t,st){const tt=st.phase==='show'?t-HL:1e9;B.forEach((b,k)=>{const [X,Y]=at(b,tt);let col=C.ink;if(st.phase==='show'&&t<HL&&k===tg)col=C.you;
      if(st.phase==='reveal'){if(k===tg)col=C.truth;else if(k===st.v)col=C.bad;}glowDot(x,X,Y,13,col,col===C.ink?6:20);});}};}});

// ================= TIMING =================
const timingGame=T({n:6,W:640,H:300,sub:'A ball slides along the rail. Press <kbd>Space</kbd> or click the moment it is centred on the target.',round(i,n){
  const v=lv(i,n,260,640)*(Math.random()<.5?1:-1),tx=rand(300,520)*(v>0?1:-1)+(v>0?0:640),start=v>0?40:600,hide=i>=3?lv(i,n,0,110):0;
  const xAt=t=>start+v*(t-400)/1000,occ=hide?(v>0?[tx-60-hide,tx-60]:[tx+60,tx+60+hide]):null;
  const tap=400+(tx-start)/v*1000+30;
  return {mode:'custom',ask:'Hit it on the target.',hint:'<kbd>Space</kbd> or click',limit:400+(640/Math.abs(v))*1000,demo:{tap,key:'SPACE',value:xAt(tap)},
    start(st){st.go=performance.now();},
    down(p,st,done){done(xAt(performance.now()-st.go));},key(e,st,done){if(e.code==='Space'){e.preventDefault();done(xAt(performance.now()-st.go));}},
    score:(X)=>{if(X==null)return 0;return soft(Math.abs(X-tx),26,1.6);},
    detail:(X,s)=>X==null?'<b class="b">Missed it</b>':`Off by <b>${Math.abs(X-tx).toFixed(0)}px</b> (${((X-tx)*Math.sign(v)>0?'late':'early')}) · <b>${fmt(s)}</b>`,
    draw(x,c,t,st){const Y=160;x.strokeStyle='rgba(255,255,255,.14)';x.lineWidth=6;x.lineCap='round';x.beginPath();x.moveTo(30,Y);x.lineTo(610,Y);x.stroke();
      x.fillStyle=rgba(C.truth,.12);x.fillRect(tx-14,Y-42,28,84);x.strokeStyle=C.truth;x.lineWidth=2;x.beginPath();x.moveTo(tx,Y-46);x.lineTo(tx,Y+46);x.stroke();
      const X=st.phase==='reveal'?st.v:xAt(t);
      if(X!=null){const vis=!(occ&&X>occ[0]&&X<occ[1]);if(vis||st.phase==='reveal')glowDot(x,X,Y,13,st.phase==='reveal'?C.you:C.ink,16);}
      if(occ){x.fillStyle='#202024';x.beginPath();x.roundRect(occ[0],Y-30,occ[1]-occ[0],60,8);x.fill();}
      if(st.phase==='reveal'&&X!=null)chip(x,`${Math.abs(X-tx).toFixed(0)}px`,X,Y-60,C.you);}};}});
// ================= DISTANCE =================
const distanceGame=T({n:4,W:640,H:400,sub:'Use the scale bar to estimate the distance between the two points.',round(i,n){
  const u=rand(50,90),a=[rand(60,580),rand(70,340)];let b;do{b=[rand(60,580),rand(70,340)];}while(Math.hypot(b[0]-a[0],b[1]-a[1])<120);
  const d=Math.hypot(b[0]-a[0],b[1]-a[1])/u*10,r={mode:'number',ask:'How far apart are they, in units?'};
  return Object.assign(r,{score:v=>{r.err=Math.abs(v-d)/d*100;return soft(Math.abs(v-d)/d,.16,1.6);},detail:(v,s)=>`Actual <b>${d.toFixed(1)}</b>, you said <b>${v}</b> · <b>${fmt(s)}</b>`,
    draw(x,c,t,st){x.strokeStyle=C.ink;x.lineWidth=2;x.beginPath();x.moveTo(20,370);x.lineTo(20+u,370);x.moveTo(20,364);x.lineTo(20,376);x.moveTo(20+u,364);x.lineTo(20+u,376);x.stroke();txt(x,'10 units',20+u+10,370,C.muted,`500 11px ${MONO}`,'left');
      if(st.phase==='reveal'){x.setLineDash([4,5]);x.strokeStyle=C.truth;x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b[0],b[1]);x.stroke();x.setLineDash([]);chip(x,d.toFixed(1),(a[0]+b[0])/2,(a[1]+b[1])/2-14,C.truth);}
      glowDot(x,a[0],a[1],7,C.you,14);glowDot(x,b[0],b[1],7,C.you,14);}});},detail:(r,R)=>`Avg error <b>${(R.reduce((s,q)=>s+(q.err||0),0)/R.length).toFixed(1)}%</b>.`});

// ================= DEPTH =================
const depthGame=T({n:6,W:640,H:400,sub:'A scene in perspective. Some objects float, so use their shadows on the ground. Click the one that is asked for.',round(i,n){
  const HZ=110,F=360,camH=1.6,N=Math.round(lv(i,n,3,6)),near=Math.random()<.5,O=[];let g=0;
  while(O.length<N&&g++<400){const o={z:rand(3,16),lx:rand(-4,4),s:rand(.4,1.4)*(i>=2?rand(.6,1.6):1),fl:i>=2&&Math.random()<.6?rand(.5,2.5):0,hue:randi(0,360),kind:randi(0,1)};
    if(O.every(q=>Math.abs(q.z-o.z)>.9))O.push(o);}
  const proj=(lx,y,z)=>[320+lx*F/z,HZ+(camH-y)*F/z];
  const order=O.map((o,k)=>k).sort((a,b)=>O[a].z-O[b].z),ans=near?order[0]:order[order.length-1];
  const ctr=o=>proj(o.lx,o.fl+o.s/2,o.z);
  return {mode:'click',answer:ans,limit:12000,ask:`Click the object that is <b>${near?'closest to you':'farthest away'}</b>.`,
    hit(p){let best=-1,bd=1e9;O.forEach((o,k)=>{const [X,Y]=ctr(o),r=o.s/2*F/o.z,d=Math.hypot(p.x-X,p.y-Y)/Math.max(18,r);if(d<bd){bd=d;best=k;}});return bd<1.6?best:-1;},
    draw(x,c,t,st){const sky=x.createLinearGradient(0,0,0,HZ);sky.addColorStop(0,'#0f1014');sky.addColorStop(1,'#1d1e24');x.fillStyle=sky;x.fillRect(0,0,640,HZ);
      const gr=x.createLinearGradient(0,HZ,0,400);gr.addColorStop(0,'#1b1b1e');gr.addColorStop(1,'#232327');x.fillStyle=gr;x.fillRect(0,HZ,640,290);
      x.strokeStyle='rgba(255,255,255,.06)';x.lineWidth=1;for(let z=2;z<40;z*=1.25){const [,Y]=proj(0,0,z);x.beginPath();x.moveTo(0,Y);x.lineTo(640,Y);x.stroke();}
      for(let lx=-12;lx<=12;lx+=2){const [a,b]=proj(lx,0,1.5),[c2,d2]=proj(lx,0,60);x.beginPath();x.moveTo(a,b);x.lineTo(c2,d2);x.stroke();}
      [...O.keys()].sort((a,b)=>O[b].z-O[a].z).forEach(k=>{const o=O[k],[sx,sy]=proj(o.lx,0,o.z),r=o.s/2*F/o.z;
        x.fillStyle='rgba(0,0,0,.55)';x.beginPath();x.ellipse(sx,sy,r*1.05,r*.28,0,0,PI2);x.fill();
        const [X,Y]=ctr(o);let col=`hsl(${o.hue} 55% 58%)`;
        if(st.phase==='reveal'){if(k===ans)col=C.truth;else if(k===st.v)col=C.bad;}
        if(o.kind){const g2=x.createRadialGradient(X-r*.35,Y-r*.35,r*.1,X,Y,r);g2.addColorStop(0,'#fff');g2.addColorStop(.25,col);g2.addColorStop(1,'#111');x.fillStyle=g2;x.beginPath();x.arc(X,Y,r,0,PI2);x.fill();}
        else{x.fillStyle=col;x.fillRect(X-r,Y-r,2*r,2*r);x.fillStyle='rgba(255,255,255,.25)';x.fillRect(X-r,Y-r,2*r,r*.3);x.fillStyle='rgba(0,0,0,.25)';x.fillRect(X-r,Y+r*.6,2*r,r*.4);}
        if(st.hover&&st.phase==='ask'&&Math.hypot(st.hover.x-X,st.hover.y-Y)<Math.max(18,r)*1.2){x.strokeStyle=C.you;x.lineWidth=2;x.beginPath();x.arc(X,Y,Math.max(r,10)+5,0,PI2);x.stroke();}});}};}});

// ================= PITCH =================
const pitchGame=T({n:8,W:640,H:260,sub:'Two tones play. Which one is higher? 🎧 Sound on.',round(i,n){
  const base=rand(280,640),cents=[90,60,40,28,20,14,9,6][i]||6,hi=Math.random()<.5?0:1,f1=hi===0?base*2**(cents/1200):base,f2=hi===1?base*2**(cents/1200):base;
  const play=st=>{st.p0=performance.now();beep(f1,.45,{type:'triangle'});beep(f2,.45,{type:'triangle',at:.75});};
  return {mode:'choice',show:1350,choices:['First','Second'],keys:LRK,answer:hi,prompt:'Listen…',ask:`Which was higher? <span class="muted">(${cents} cents apart)</span>`,start:play,
    onAsk:(st,{ctl})=>ctl.append(el('button',{class:'btn sm',text:'↻ Replay',onclick:()=>play(st)})),
    draw(x,c,t,st){const q=(performance.now()-(st.p0||0));[[0,200],[1,440]].forEach(([k,X])=>{const on=q>k*750&&q<k*750+450;
      x.save();if(on){x.shadowColor=C.you;x.shadowBlur=30;}panel(x,X-70,70,140,120,{fill:on?'#241712':'#141416',stroke:on?C.you:'rgba(255,255,255,.09)'});x.restore();
      for(let b=0;b<9;b++){const h=on?10+Math.abs(Math.sin(q/40+b))*40:6;x.fillStyle=on?C.you:C.dim;x.fillRect(X-45+b*11,130-h/2,6,h);}
      let lab=k?'2nd':'1st',col=C.muted;if(st.phase==='reveal'&&k===hi){lab+=' · higher';col=C.truth;}txt(x,lab,X,215,col,`500 12px ${MONO}`);});}};}});

// ================= ECHO =================
const SCALE=[261.6,293.7,329.6,392,440,523.3,587.3,659.3,784];
const echoGame=T({n:6,W:640,H:260,sub:'A melody plays, then plays again with one note changed. Which note changed? 🎧',round(i,n){
  const L=Math.round(lv(i,n,4,7)),A=[...Array(L)].map(()=>randi(0,SCALE.length-1)),k=randi(0,L-1),B=A.slice(),step=i<3?randi(2,3):1;B[k]=clamp(A[k]+(Math.random()<.5?step:-step),0,SCALE.length-1);if(B[k]===A[k])B[k]=A[k]+(A[k]<4?step:-step);
  const NT=340,GAP2=700,dur=L*NT*2+GAP2;
  const play=st=>{st.p0=performance.now();A.forEach((v,j)=>beep(SCALE[v],.26,{type:'triangle',at:j*NT/1000}));B.forEach((v,j)=>beep(SCALE[v],.26,{type:'triangle',at:(L*NT+GAP2+j*NT)/1000}));};
  return {mode:'choice',show:dur+200,choices:A.map((_,j)=>String(j+1)),answer:k,prompt:'Listen to both melodies…',ask:'Which note was different the second time?',start:play,
    onAsk:(st,{ctl})=>ctl.append(el('button',{class:'btn sm',text:'↻ Replay',onclick:()=>play(st)})),
    draw(x,c,t,st){const q=performance.now()-(st.p0||0);[0,1].forEach(m=>{const Y=80+m*90,off=m?L*NT+GAP2:0;txt(x,m?'ECHO':'ORIGINAL',40,Y,C.dim,`500 10px ${MONO}`,'left');
      for(let j=0;j<L;j++){const X=170+j*(400/L)+20,on=q>off+j*NT&&q<off+j*NT+260;let col=on?C.you:'#26262a';if(st.phase==='reveal'&&j===k)col=m?C.gap:C.truth;
        glowDot(x,X,Y,on?14:11,col,on?20:0);txt(x,String(j+1),X,Y+28,C.dim,`500 10px ${MONO}`);}});}};}});

// ================= COLOR =================
const okl=(h,s,l)=>oklab(hsl2rgb(h,s,l));
const colorGame=T({n:8,W:640,H:400,sub:'A color appears for a moment. Pick the exact same shade from the swatches.',round(i,n){
  const h=rand(0,360),s=rand(45,85),l=rand(38,66),d=lv(i,n,16,3.2),N=6,ans=randi(0,N-1),opts=[];
  for(let k=0;k<N;k++){if(k===ans){opts.push([h,s,l]);continue;}let o,g=0;do{o=[((h+rand(-1,1)*d*1.6)%360+360)%360,clamp(s+rand(-1,1)*d*2,10,100),clamp(l+rand(-1,1)*d,8,92)];}while(g++<40&&(Math.hypot(...okl(...o).map((v,j)=>v-okl(h,s,l)[j]))<d/220||opts.some(q=>Math.hypot(...okl(...q).map((v,j)=>v-okl(...o)[j]))<d/300)));opts.push(o);}
  const P=k=>[110+(k%3)*210,140+Math.floor(k/3)*150];const col=o=>`hsl(${o[0]} ${o[1]}% ${o[2]}%)`;
  return {mode:'click',show:1700,answer:ans,limit:10000,prompt:'Memorize this color…',ask:'Which swatch was it?',hit:p=>{for(let k=0;k<N;k++){const [X,Y]=P(k);if(Math.abs(p.x-X-50)<80&&Math.abs(p.y-Y)<62)return k;}return -1;},
    draw(x,c,t,st){if(st.phase==='show'){if(t>300&&t<1600){x.save();x.shadowColor=col([h,s,l]);x.shadowBlur=40;x.fillStyle=col([h,s,l]);x.beginPath();x.roundRect(220,90,200,200,24);x.fill();x.restore();}return;}
      for(let k=0;k<N;k++){const [X,Y]=P(k);x.fillStyle=col(opts[k]);x.beginPath();x.roundRect(X-50,Y-52,200,104,14);x.fill();
        let s2=null;if(st.phase==='reveal'){if(k===ans)s2=C.truth;else if(k===st.v)s2=C.bad;}else if(st.hover&&Math.abs(st.hover.x-X-50)<80&&Math.abs(st.hover.y-Y)<62)s2='#fff';
        if(s2){x.strokeStyle=s2;x.lineWidth=3;x.stroke();}}}};}});

// ================= MEMORY (digit/symbol span) =================
const SYMS='ABCDEFGHJKLMNPRSTUVWXYZ';
const digitsGame=T({n:5,W:640,H:260,sub:'Numbers and letters flash one at a time. Type the whole sequence back in order.',round(i,n){
  const L=Math.round(lv(i,n,5,9)),pool=i<2?'0123456789':i<4?'0123456789ABCDEFGHJKLMNPRSTUVWXYZ':SYMS,seq=[...Array(L)].map(()=>pick(pool)).join(''),ON=650,GAP2=180;
  return {mode:'text',demo:{text:seq},show:400+L*(ON+GAP2),prompt:`Memorize <b>${L}</b> characters…`,ask:'Type the sequence (no spaces).',
    score:v=>{const u=String(v).toUpperCase().replace(/\s+/g,'');let k=0;for(let j=0;j<L;j++)if(u[j]===seq[j])k++;return k/L*100;},
    detail:(v,s)=>`Answer <b>${seq}</b> · you typed <b>${String(v).toUpperCase()}</b>`,
    draw(x,c,t,st){if(st.phase==='show'){const q=t-400,j=Math.floor(q/(ON+GAP2));if(q>=0&&q%(ON+GAP2)<ON&&j<L){const a=Math.min(1,(q%(ON+GAP2))/80);x.globalAlpha=a;txt(x,seq[j],320,120,C.ink,`600 92px ${MONO}`);x.globalAlpha=1;}
      for(let k=0;k<L;k++){x.fillStyle=k<j?C.dim:k===j?C.you:C.line;x.beginPath();x.arc(320+(k-(L-1)/2)*18,220,4,0,PI2);x.fill();}}
      else if(st.phase==='ask')txt(x,'?'.repeat(L),320,120,C.dim,`600 48px ${MONO}`);
      else{const u=String(st.v).toUpperCase();for(let k=0;k<L;k++){const X=320+(k-(L-1)/2)*44;txt(x,seq[k],X,100,C.truth,`600 34px ${MONO}`);txt(x,u[k]||'·',X,160,u[k]===seq[k]?C.ink:C.bad,`600 34px ${MONO}`);}}}};}});

// ================= ORDER =================
const orderGame=T({n:5,W:640,H:400,sub:'Objects appear one by one. Then they all turn grey: click them in the order they appeared.',round(i,n){
  const k=Math.round(lv(i,n,4,8)),O=[];let g=0;while(O.length<k&&g++<500){const o={x:rand(60,580),y:rand(60,340),s:randi(3,6),c:pick(PAL),r:rand(0,PI2)};if(O.every(q=>Math.hypot(q.x-o.x,q.y-o.y)>80))O.push(o);}
  const ON=lv(i,n,650,420);
  return {mode:'custom',show:400+k*ON+500,prompt:'Watch the order…',ask:`Click all <b>${k}</b> in the order they appeared.`,start(st){st.sel=[];},demo:{clicks:O.map(o=>[o.x,o.y]),sel:O.map((_,j)=>j),value:O.map((_,j)=>j)},
    down(p,st,done){let best=-1,bd=50;O.forEach((o,j)=>{const d=Math.hypot(p.x-o.x,p.y-o.y);if(d<bd&&!st.sel.includes(j)){bd=d;best=j;}});if(best<0)return;st.sel.push(best);sfx(500+st.sel.length*60,.07,.06);if(st.sel.length===k)later(()=>done(st.sel.slice()),200);},
    score:v=>v.filter((o,j)=>o===j).length/k*100,detail:(v,s)=>`<b>${Math.round(s*k/100)} / ${k}</b> in the right spot`,
    draw(x,c,t,st){const vis=st.phase==='show'?Math.floor((t-400)/ON)+1:k;O.forEach((o,j)=>{if(j>=vis)return;const fresh=st.phase==='show'&&j===vis-1,pop=st.phase==='show'?easeBack(((t-400)-j*ON)/200):1;
      let col=st.phase==='show'?o.c:'#6a6a70';const si=st.sel?st.sel.indexOf(j):-1;if(si>=0&&st.phase==='ask')col=C.you;if(st.phase==='reveal')col=st.v[j]===j?C.truth:C.bad;
      x.save();if(fresh){x.shadowColor=o.c;x.shadowBlur=26;}regPoly(x,o.x,o.y,26*pop,o.s,o.r);x.fillStyle=col;x.fill();x.restore();
      if(st.phase==='ask'&&si>=0)txt(x,String(si+1),o.x,o.y,'#0a0a0b',`700 14px ${MONO}`);
      if(st.phase==='reveal'){txt(x,String(j+1),o.x,o.y,'#0a0a0b',`700 14px ${MONO}`);const ui=st.v.indexOf(j);if(ui!==j)txt(x,'you '+(ui+1),o.x,o.y+38,C.bad,`500 10px ${MONO}`);}});}};}});

// ================= SPEED =================
const speedGame=T({n:8,W:640,H:300,sub:'Two objects move for a moment. Which one is moving <b>faster</b>? Watch out: they travel different distances.',round(i,n){
  const ratio=lv(i,n,1.55,1.07),v0=rand(120,240),fast=randi(0,1),v=[0,1].map(k=>k===fast?v0*ratio:v0),dur=[0,1].map(()=>rand(1300,2400)),dir=[0,1].map(()=>Math.random()<.5?1:-1),x0=[0,1].map(k=>dir[k]>0?rand(30,180):rand(460,610));
  return {mode:'choice',show:2600,choices:tb,keys:UDK,answer:fast,prompt:'Watch…',ask:'Which was faster?',
    draw(x,c,t,st){[0,1].forEach(k=>{const Y=95+k*110;x.strokeStyle='rgba(255,255,255,.08)';x.lineWidth=2;x.beginPath();x.moveTo(20,Y);x.lineTo(620,Y);x.stroke();
      const tt=Math.min(t,dur[k])/1000,X=x0[k]+dir[k]*v[k]*tt,show=st.phase==='show'&&t<dur[k];
      if(show)glowDot(x,X,Y,12,C.ink,14);if(st.phase==='reveal')chip(x,`${Math.round(v[k])} px/s`,320,Y,k===fast?C.truth:C.muted);
      txt(x,k?'BOTTOM':'TOP',24,Y-22,C.dim,`500 9.5px ${MONO}`,'left');});}};}});

// ================= LENGTH =================
const lengthGame=T({n:5,W:640,H:360,sub:'A line appears briefly at an angle. Then drag to draw a horizontal line of the same length.',round(i,n){
  const L=rand(120,420),a=rand(0,Math.PI),cx=rand(200,440),cy=rand(130,200),r={mode:'aim',demo:{y:290},show:1800,prompt:'Memorize the length…',ask:'Drag to match the length, then lock in.'};
  const X0=320-260;
  return Object.assign(r,{aim(p,st){st.v=clamp(p.x-X0,5,560);},nudge(d,st){st.v=clamp((st.v||200)+d,5,560);},
    score:v=>{r.err=Math.abs(v-L)/L*100;return soft(Math.abs(v-L)/L,.11,1.6);},detail:(v,s)=>`Actual <b>${L.toFixed(0)}px</b>, yours <b>${v.toFixed(0)}px</b> (${(r.err).toFixed(1)}% off) · <b>${fmt(s)}</b>`,
    draw(x,c,t,st){x.lineCap='round';if(st.phase==='show'&&t>250&&t<1700){x.strokeStyle=C.ink;x.lineWidth=4;x.beginPath();x.moveTo(cx-Math.cos(a)*L/2,cy-Math.sin(a)*L/2);x.lineTo(cx+Math.cos(a)*L/2,cy+Math.sin(a)*L/2);x.stroke();}
      if(st.phase!=='show'){const Y=290;x.strokeStyle='rgba(255,255,255,.1)';x.lineWidth=1;x.beginPath();x.moveTo(X0,Y-20);x.lineTo(X0,Y+20);x.stroke();
        if(st.v!=null){x.strokeStyle=C.you;x.lineWidth=4;x.beginPath();x.moveTo(X0,Y);x.lineTo(X0+st.v,Y);x.stroke();glowDot(x,X0+st.v,Y,8,C.you,12);}
        if(st.phase==='reveal'){x.strokeStyle=C.truth;x.lineWidth=4;x.beginPath();x.moveTo(X0,Y-26);x.lineTo(X0+L,Y-26);x.stroke();chip(x,L.toFixed(0)+'px',X0+L,Y-48,C.truth);}}}});},detail:(r,R)=>`Avg error <b>${(R.reduce((s,q)=>s+(q.err||0),0)/R.length).toFixed(1)}%</b>.`});

// ================= WEIGHT =================
const MATS=[{n:'Foam',d:.04,c1:'#f3e6a8',c2:'#c9b66a'},{n:'Wood',d:.7,c1:'#c88a4a',c2:'#6b3f17'},{n:'Ice',d:.92,c1:'#dff6ff',c2:'#7fc4e0'},{n:'Stone',d:2.6,c1:'#a7a7a2',c2:'#4d4d4a'},{n:'Iron',d:7.8,c1:'#8d949c',c2:'#2c3036'},{n:'Gold',d:19.3,c1:'#ffe27a',c2:'#a8740c'}];
function drawMat(x,m,X,Y,s,kind){const g=x.createLinearGradient(X-s,Y-s,X+s,Y+s);g.addColorStop(0,m.c1);g.addColorStop(1,m.c2);x.fillStyle=g;
  if(kind===0){x.beginPath();x.roundRect(X-s,Y-s,2*s,2*s,s*.08);x.fill();}else{x.beginPath();x.arc(X,Y,s,0,PI2);x.fill();}
  x.save();x.clip();const R2=srand(Math.round(s*100));
  if(m.n==='Wood'){x.strokeStyle='rgba(60,30,10,.35)';x.lineWidth=1.5;for(let k=-s;k<s;k+=s/6){x.beginPath();x.moveTo(X-s,Y+k);x.bezierCurveTo(X-s/2,Y+k+R2()*6-3,X+s/2,Y+k+R2()*6-3,X+s,Y+k);x.stroke();}}
  if(m.n==='Stone'){for(let k=0;k<s*1.5;k++){x.fillStyle=R2()<.5?'rgba(0,0,0,.18)':'rgba(255,255,255,.14)';x.fillRect(X-s+R2()*2*s,Y-s+R2()*2*s,2,2);}}
  if(m.n==='Foam'){for(let k=0;k<s*.7;k++){x.fillStyle='rgba(120,100,30,.25)';x.beginPath();x.arc(X-s+R2()*2*s,Y-s+R2()*2*s,1+R2()*s*.06,0,PI2);x.fill();}}
  if(m.n==='Iron'||m.n==='Gold'||m.n==='Ice'){const sh=x.createLinearGradient(X-s,Y-s,X+s,Y-s*.2);sh.addColorStop(0,'rgba(255,255,255,0)');sh.addColorStop(.5,'rgba(255,255,255,.4)');sh.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=sh;x.fillRect(X-s,Y-s,2*s,s*.8);}
  x.restore();}
const weightGame=T({n:8,W:640,H:340,sub:'Judge size <b>and</b> material. Which object is heavier?',round(i,n){
  const close=lv(i,n,3,1.12);let A,B,wa,wb,g=0;
  do{A={m:randi(0,5),s:rand(30,95),k:randi(0,1)};B={m:randi(0,5),s:rand(30,95),k:randi(0,1)};const vol=o=>(o.k?4.19:8)*o.s**3;wa=MATS[A.m].d*vol(A);wb=MATS[B.m].d*vol(B);}
  while(g++<500&&(A.m===B.m||Math.max(wa,wb)/Math.min(wa,wb)<1.06||Math.max(wa,wb)/Math.min(wa,wb)>close*1.5||Math.max(wa,wb)/Math.min(wa,wb)<close/1.2));
  const ans=wa>wb?0:1;
  return {mode:'choice',choices:twoUp,keys:LRK,answer:ans,ask:'Which is heavier?',
    draw(x,c,t,st){x.fillStyle='#1a1a1d';x.fillRect(0,270,640,70);[[A,170],[B,470]].forEach(([o,X],k)=>{x.fillStyle='rgba(0,0,0,.5)';x.beginPath();x.ellipse(X,272,o.s*1.05,8,0,0,PI2);x.fill();
      drawMat(x,MATS[o.m],X,270-o.s,o.s,o.k?1:0);txt(x,MATS[o.m].n.toUpperCase(),X,300,C.muted,`500 10px ${MONO}`);
      if(st.phase==='reveal')chip(x,(k?wb:wa)/(Math.min(wa,wb))>=1.005?`×${((k?wb:wa)/Math.min(wa,wb)).toFixed(2)}`:'×1.00',X,322,k===ans?C.truth:C.muted);});}};}});

// ================= SYMMETRY =================
const symmetryGame=T({n:10,W:640,H:380,sub:'Is the pattern <b>perfectly</b> mirror-symmetric about the dashed line?',round(i,n){
  const N=Math.round(lv(i,n,6,12)),half=Math.ceil(N/2),G=[...Array(N)].map(()=>[...Array(half)].map(()=>Math.random()<.45?1:0)),sym=Math.random()<.5,vert=Math.random()<.5;
  const full=G.map(r=>{const m=r.slice(0,Math.floor(N/2)).reverse();return [...r,...m].slice(0,N);});
  const flips=[];if(!sym){const k=i<4?randi(1,2):1;for(let j=0;j<k;j++){const r=randi(0,N-1),cc=randi(0,N-1);full[r][cc]^=1;flips.push([r,cc]);}}
  const isSym=full.every(r=>r.every((v,cc)=>v===r[N-1-cc])),S=280/N,ox=320-S*N/2,oy=190-S*N/2,hue=randi(0,360);
  return {mode:'choice',choices:['Symmetric','Not symmetric'],keys:{y:0,n:1,ArrowLeft:0,ArrowRight:1},answer:isSym?0:1,limit:6000,ask:'Symmetric?',
    draw(x,c,t,st){for(let r=0;r<N;r++)for(let cc=0;cc<N;cc++){const [R2,C2]=vert?[r,cc]:[cc,r];if(!full[R2][C2])continue;let col=`hsl(${hue} 60% 62%)`;
      if(st.phase==='reveal'&&flips.some(f=>f[0]===R2&&f[1]===C2))col=C.bad;x.fillStyle=col;x.fillRect(ox+cc*S+1,oy+r*S+1,S-2,S-2);}
      x.setLineDash([5,5]);x.strokeStyle=rgba(C.you,.7);x.lineWidth=1.5;x.beginPath();if(vert){x.moveTo(320,oy-12);x.lineTo(320,oy+N*S+12);}else{x.moveTo(ox-12,190);x.lineTo(ox+N*S+12,190);}x.stroke();x.setLineDash([]);}};}});

// ================= SHADOW =================
function drawCells(x,cells,X,Y,box,col){const xs=cells.map(p=>p[0]),ys=cells.map(p=>p[1]),mx=Math.min(...xs),my=Math.min(...ys),w=Math.max(...xs)-mx+1,h=Math.max(...ys)-my+1,s=Math.min(box/w,box/h,26);
  x.fillStyle=col;cells.forEach(p=>{x.fillRect(X-w*s/2+(p[0]-mx)*s,Y-h*s/2+(p[1]-my)*s,s-1,s-1);});}
const proj=(S,a,b)=>{const m=new Map();S.forEach(p=>m.set(p[a]+','+p[b],[p[a],p[b]]));return [...m.values()];};
const shadowGame=T({n:6,W:640,H:440,sub:'A light shines straight down on the object. Which shadow does it cast on the floor?',round(i,n){
  let S,opts,g=0;
  do{S=polycube(randi(5,7));const top=proj(S,0,2),cand=[proj(S,0,1),proj(S,2,1),top.map(p=>[-p[0],p[1]]),top.map(p=>[p[0],-p[1]]),proj(polycube(S.length),0,2),proj(polycube(S.length),0,2)];
    const key=c=>normSet(c);const seen=new Set([key(top)]),ds=[];for(const cc of cand){const kk=key(cc);if(!seen.has(kk)){seen.add(kk);ds.push(cc);}if(ds.length===3)break;}opts=ds.length===3?[top,...ds]:null;}
  while(!opts&&g++<80);
  const order=shuffle([0,1,2,3]),ans=order.indexOf(0),M=rotM(rand(-.45,.45),.62,0),hue=randi(0,360),OX=k=>95+k*150,OY=345;
  return {mode:'click',answer:ans,limit:20000,ask:'Click the floor shadow (seen from above).',hit:p=>{for(let k=0;k<4;k++)if(Math.abs(p.x-OX(k))<68&&Math.abs(p.y-OY)<75)return k;return -1;},
    draw(x,c,t,st){panel(x,200,16,240,210,{fill:'#141416'});drawCubes(x,S,M,320,128,24,hue);
      x.fillStyle=C.gap;x.strokeStyle=C.gap;x.lineWidth=2;for(let k=0;k<3;k++){const X=260+k*60;x.beginPath();x.moveTo(X,30);x.lineTo(X,46);x.stroke();x.beginPath();x.moveTo(X-5,42);x.lineTo(X+5,42);x.lineTo(X,50);x.closePath();x.fill();}
      txt(x,'LIGHT ↓',414,30,C.gap,`500 9px ${MONO}`,'right');txt(x,'FRONT',320,214,C.dim,`500 9px ${MONO}`);
      for(let k=0;k<4;k++){const hov=st.hover&&st.phase==='ask'&&Math.abs(st.hover.x-OX(k))<68&&Math.abs(st.hover.y-OY)<75;let stroke=hov?C.you:'rgba(255,255,255,.09)';
        if(st.phase==='reveal'){if(k===ans)stroke=C.truth;else if(k===st.v)stroke=C.bad;}panel(x,OX(k)-66,OY-74,132,148,{fill:'#1c1c1f',stroke});drawCells(x,opts[order[k]],OX(k),OY+4,100,'#050506');
        txt(x,'BACK',OX(k),OY-62,C.dim,`500 8px ${MONO}`);txt(x,'FRONT',OX(k),OY+64,C.dim,`500 8px ${MONO}`);}}};}});

// ================= MIRROR =================
const rot2=(s,k)=>s.map(p=>{let [a,b]=p;for(let j=0;j<k;j++)[a,b]=[-b,a];return [a,b];});
const canon2=s=>[0,1,2,3].map(k=>normSet(rot2(s,k))).sort()[0];
const mirrorGame=T({n:6,W:640,H:420,sub:'Which option is the true mirror image of the shape, as if reflected in the dashed line?',round(i,n){
  let S,MS,g=0;do{S=polycube(randi(6,8),true).map(p=>[p[0],p[1]]);MS=S.map(p=>[-p[0],p[1]]);}while(canon2(S)===canon2(MS)&&g++<60);
  const rotOpt=i>=3,mut=()=>{const s=MS.map(p=>p.slice());s.splice(randi(0,s.length-1),1);const b=pick(s),d=pick([[1,0],[-1,0],[0,1],[0,-1]]),q=[b[0]+d[0],b[1]+d[1]];if(!s.some(p=>p+''===q+''))s.push(q);return s;};
  let opts,gg=0;do{const ds=[S,rot2(S,2),mut(),rot2(S,1),mut()];const ck=s=>rotOpt?canon2(s):normSet(s),mk=ck(MS),seen=new Set([mk]),out=[];for(const d of ds){const kk=ck(d);if(!seen.has(kk)&&canon2(d)!==canon2(MS)){seen.add(kk);out.push(d);}if(out.length===3)break;}opts=out.length===3?[MS,...out]:null;}while(!opts&&gg++<40);
  if(!opts)opts=[MS,S,rot2(S,2),rot2(S,1)];
  const order=shuffle([0,1,2,3]),ans=order.indexOf(0),rots=[0,1,2,3].map(()=>rotOpt?randi(0,3):0),OX=k=>95+k*150,OY=325,hue=randi(0,360);
  return {mode:'click',answer:ans,limit:20000,ask:rotOpt?'Options may be rotated. Which is the mirror image?':'Which is the mirror image?',hit:p=>{for(let k=0;k<4;k++)if(Math.abs(p.x-OX(k))<68&&Math.abs(p.y-OY)<75)return k;return -1;},
    draw(x,c,t,st){panel(x,160,14,320,190,{fill:'#141416'});drawCells(x,S,250,110,130,`hsl(${hue} 60% 62%)`);x.setLineDash([5,5]);x.strokeStyle=rgba(C.you,.8);x.beginPath();x.moveTo(330,26);x.lineTo(330,192);x.stroke();x.setLineDash([]);
      txt(x,'?',405,110,C.dim,`600 40px ${MONO}`);
      for(let k=0;k<4;k++){const hov=st.hover&&st.phase==='ask'&&Math.abs(st.hover.x-OX(k))<68&&Math.abs(st.hover.y-OY)<75;let stroke=hov?C.you:'rgba(255,255,255,.09)';
        if(st.phase==='reveal'){if(k===ans)stroke=C.truth;else if(k===st.v)stroke=C.bad;}panel(x,OX(k)-66,OY-74,132,148,{stroke});drawCells(x,rot2(opts[order[k]],rots[k]),OX(k),OY,100,`hsl(${hue} 60% 62%)`);}}};}});

// ================= PATTERN (matrix reasoning) =================
function drawGlyph(x,a,X,Y,box){const cols=['#ff6b2c','#7dd3a0','#9bb8ff'],n=a.count+1,s=box/(n*2.3+.4),gap=box*.95/n;
  for(let k=0;k<n;k++){const px=X+(k-(n-1)/2)*gap;x.save();x.translate(px,Y);x.rotate(a.rot*Math.PI/6);
    if(a.shape===0)regPoly(x,0,0,s*1.05,5);else if(a.shape===1){x.beginPath();x.rect(-s*.85,-s*.85,s*1.7,s*1.7);}else regPoly(x,0,0,s*1.1,3);
    if(a.fill===0){x.fillStyle=cols[a.color];x.fill();}else if(a.fill===1){x.strokeStyle=cols[a.color];x.lineWidth=2.5;x.stroke();}else{x.strokeStyle=cols[a.color];x.lineWidth=2.5;x.stroke();x.save();x.clip();x.fillStyle=cols[a.color];x.fillRect(-s*1.2,0,s*2.4,s*1.2);x.restore();}
    x.restore();}}
const ATTR=['shape','count','color','fill','rot'];
const patternGame=T({n:6,W:640,H:470,sub:'Each row and column follows rules. Pick the piece that completes the grid.',round(i,n){
  const nVar=Math.min(4,1+Math.floor(i*.7)),vars=shuffle(ATTR).slice(0,nVar),rules={};
  ATTR.forEach(a=>{const perm=shuffle([0,1,2]);const kind=vars.includes(a)?pick(i<2?['row','col']:['row','col','diag','anti']):'const';rules[a]={kind,perm,k:randi(0,2)};});
  const val=(a,r,cc)=>{const R2=rules[a];if(R2.kind==='const')return a==='rot'?0:R2.k;const idx=R2.kind==='row'?r:R2.kind==='col'?cc:R2.kind==='diag'?(r+cc)%3:(r-cc+3)%3;return a==='rot'?[0,1,2][R2.perm[idx]]:R2.perm[idx];};
  const cell=(r,cc)=>{const o={};ATTR.forEach(a=>o[a]=val(a,r,cc));return o;},A=cell(2,2),key=o=>ATTR.map(a=>o[a]).join();
  const opts=[A],seen=new Set([key(A)]);let g=0;while(opts.length<5&&g++<200){const o={...A},a=pick(g<40?vars:ATTR);o[a]=(o[a]+randi(1,2))%3;if(!seen.has(key(o))){seen.add(key(o));opts.push(o);}}
  const order=shuffle(opts.map((_,k)=>k)),ans=order.indexOf(0),OX=k=>80+k*120,OY=400;
  return {mode:'click',answer:ans,limit:35000,ask:'Which piece goes in the empty cell?',hit:p=>{for(let k=0;k<opts.length;k++)if(Math.abs(p.x-OX(k))<52&&Math.abs(p.y-OY)<52)return k;return -1;},
    score:(v,rt)=>v===ans?100*Math.max(.6,Math.exp(-((Math.max(0,rt-6000)/30000)**1.5))):0,
    draw(x,c,t,st){for(let r=0;r<3;r++)for(let cc=0;cc<3;cc++){const X=230+cc*90,Y=60+r*90;panel(x,X-42,Y-42,84,84,{fill:'#141416',r:10});
      if(r===2&&cc===2){if(st.phase==='reveal')drawGlyph(x,A,X,Y,70);else txt(x,'?',X,Y,C.you,`600 30px ${MONO}`);}else drawGlyph(x,cell(r,cc),X,Y,70);}
      for(let k=0;k<opts.length;k++){const hov=st.hover&&st.phase==='ask'&&Math.abs(st.hover.x-OX(k))<52&&Math.abs(st.hover.y-OY)<52;let stroke=hov?C.you:'rgba(255,255,255,.09)';
        if(st.phase==='reveal'){if(k===ans)stroke=C.truth;else if(k===st.v)stroke=C.bad;}panel(x,OX(k)-48,OY-48,96,96,{stroke,r:10});drawGlyph(x,opts[order[k]],OX(k),OY,76);}}};}});

// ================= PULSE =================
const pulseGame=T({n:4,W:640,H:300,sub:'A light flashes steadily for three seconds. Estimate how many times per second (Hz).',round(i,n){
  const f=+rand(1.5,i<2?6:10).toFixed(1),D=3000,r={mode:'slider',show:600+D+200,prompt:'Watch the light…',ask:'How fast was it flashing?',slider:{min:.5,max:12,step:.1,init:5,fmt:v=>(+v).toFixed(1)+' Hz'}};
  return Object.assign(r,{score:v=>{r.err=Math.abs(v-f)/f*100;return soft(Math.abs(v-f)/f,.14,1.6);},detail:(v,s)=>`Actual <b>${f.toFixed(1)} Hz</b>, you said <b>${v.toFixed(1)} Hz</b> · <b>${fmt(s)}</b>`,
    draw(x,c,t,st){const q=t-600,on=st.phase==='show'&&q>=0&&q<D&&((q/1000*f)%1)<.45;x.save();if(on){x.shadowColor=C.you;x.shadowBlur=60;}x.fillStyle=on?C.you:'#1e1e21';x.beginPath();x.arc(320,140,62,0,PI2);x.fill();x.restore();
      if(st.phase==='show'&&q>=0){x.fillStyle=C.line;x.fillRect(220,240,200,3);x.fillStyle=C.muted;x.fillRect(220,240,200*clamp(q/D,0,1),3);}
      if(st.phase==='reveal')chip(x,f.toFixed(1)+' Hz',320,250,C.truth);}});},detail:(r,R)=>`Avg error <b>${(R.reduce((s,q)=>s+(q.err||0),0)/R.length).toFixed(1)}%</b>.`});

// ================= FREQUENCY =================
const SNDS=[{n:'Low',f:220,type:'sine'},{n:'Mid',f:440,type:'triangle'},{n:'High',f:880,type:'sine'},{n:'Buzz',f:330,type:'sawtooth'}];
const frequencyGame=T({n:6,W:640,H:260,sub:'First you hear each sound once. Then a rapid stream plays. Which sound came up most often? 🎧',round(i,n){
  const K=i<2?3:4,L=Math.round(lv(i,n,12,22)),counts=[...Array(K)].map(()=>0),seq=[];let g=0;
  do{counts.fill(0);seq.length=0;for(let j=0;j<L;j++){const s=randi(0,K-1);seq.push(s);counts[s]++;}g++;}while(g<300&&(counts.filter(v=>v===Math.max(...counts)).length>1||Math.max(...counts)-[...counts].sort((a,b)=>b-a)[1]>(i<3?3:1)));
  const ans=counts.indexOf(Math.max(...counts)),IV=lv(i,n,230,150),intro=K*500+400,show=intro+L*IV+300;
  const play=st=>{st.p0=performance.now();for(let k=0;k<K;k++)beep(SNDS[k].f,.3,{type:SNDS[k].type,vol:.16,at:k*.5});seq.forEach((s,j)=>beep(SNDS[s].f,IV/1000*.7,{type:SNDS[s].type,vol:.16,at:(intro+j*IV)/1000}));};
  return {mode:'choice',show,choices:SNDS.slice(0,K).map(s=>s.n),answer:ans,prompt:'Listen…',ask:'Which sound played the most?',start:play,
    detail:(v,s)=>`Counts: ${SNDS.slice(0,K).map((q,k)=>`${q.n} <b>${counts[k]}</b>`).join(' · ')}`,
    draw(x,c,t,st){const q=performance.now()-(st.p0||0);for(let k=0;k<K;k++){const X=320+(k-(K-1)/2)*120,on=q>k*500&&q<k*500+300;glowDot(x,X,90,on?24:18,on?PAL[k]:'#232326',on?24:0);txt(x,SNDS[k].n.toUpperCase(),X,130,on?C.ink:C.dim,`500 10px ${MONO}`);}
      if(q>intro&&q<intro+L*IV){const j=Math.floor((q-intro)/IV);txt(x,'STREAM',320,190,C.muted,`500 10px ${MONO}`);x.strokeStyle=C.you;x.lineWidth=2;x.beginPath();x.arc(320,215,6+((q-intro)%IV)/IV*14,0,PI2);x.stroke();txt(x,`${j+1}/${L}`,370,215,C.dim,`500 10px ${MONO}`,'left');}}};}});

// ================= SEQUENCE =================
function arrowGlyph(x,X,Y,s,rot,col){x.save();x.translate(X,Y);x.rotate(rot);x.fillStyle=col;x.beginPath();x.moveTo(-s,-s*.35);x.lineTo(s*.2,-s*.35);x.lineTo(s*.2,-s*.8);x.lineTo(s,0);x.lineTo(s*.2,s*.8);x.lineTo(s*.2,s*.35);x.lineTo(-s,s*.35);x.closePath();x.fill();x.restore();}
function drawFrame(x,f,X,Y,box){const n=f.count,gap=box/(n+.3);for(let k=0;k<n;k++)arrowGlyph(x,X+(k-(n-1)/2)*gap,Y,box*(n>2?.16:.22)*f.size,f.rot,PAL[f.color]);}
const sequenceGame=T({n:6,W:640,H:420,sub:'Frames flash by quickly, each following a rule. Pick the frame that comes next.',round(i,n){
  const nVar=Math.min(3,1+Math.floor(i/2)),vars=shuffle(['rot','count','color','size']).slice(0,nVar),rs=pick([1,2,3,-1,-2])*Math.PI/4,c0=randi(0,5),cs=randi(1,2),n0=randi(1,2),z0=randi(0,1);
  const fr=j=>({rot:vars.includes('rot')?j*rs:0,count:vars.includes('count')?1+j:n0,color:vars.includes('color')?(c0+j*cs)%6:c0,size:vars.includes('size')?(j+z0)%2?1.25:.8:1});
  const A=fr(4),key=f=>[(((f.rot%PI2)+PI2)%PI2).toFixed(2),f.count,f.color,f.size].join(),opts=[A],seen=new Set([key(A)]);let g=0;
  while(opts.length<4&&g++<200){const o={...A},a=pick(g<30?vars:['rot','count','color','size']);if(a==='rot')o.rot+=pick([1,-1,2])*Math.PI/4;if(a==='count')o.count=clamp(o.count+pick([1,-1]),1,6);if(a==='color')o.color=(o.color+randi(1,5))%6;if(a==='size')o.size=o.size>1?.8:1.25;if(!seen.has(key(o))){seen.add(key(o));opts.push(o);}}
  const ON=lv(i,n,700,450),GAP2=120,order=shuffle([0,1,2,3]),ans=order.indexOf(0),OX=k=>110+k*140,OY=320;
  return {mode:'click',show:300+4*(ON+GAP2)+200,answer:ans,limit:15000,prompt:'Watch the sequence…',ask:'What comes next?',hit:p=>{for(let k=0;k<4;k++)if(Math.abs(p.x-OX(k))<60&&Math.abs(p.y-OY)<60)return k;return -1;},
    draw(x,c,t,st){if(st.phase==='show'){const q=t-300,j=Math.floor(q/(ON+GAP2));panel(x,240,60,160,160,{fill:'#141416'});if(q>=0&&j<4&&q%(ON+GAP2)<ON)drawFrame(x,fr(j),320,140,140);
        for(let k=0;k<5;k++){x.fillStyle=k<=j&&k<4?C.ink:k===4?C.you:C.line;x.beginPath();x.arc(288+k*16,244,3.5,0,PI2);x.fill();}return;}
      for(let j=0;j<4;j++){panel(x,52+j*110,40,96,96,{fill:'#141416',r:10});drawFrame(x,fr(j),100+j*110,88,86);}panel(x,492,40,96,96,{fill:'#141416',stroke:C.you,r:10});
      if(st.phase==='reveal')drawFrame(x,A,540,88,86);else txt(x,'?',540,88,C.you,`600 30px ${MONO}`);
      for(let k=0;k<4;k++){const hov=st.hover&&st.phase==='ask'&&Math.abs(st.hover.x-OX(k))<60&&Math.abs(st.hover.y-OY)<60;let stroke=hov?C.you:'rgba(255,255,255,.09)';
        if(st.phase==='reveal'){if(k===ans)stroke=C.truth;else if(k===st.v)stroke=C.bad;}panel(x,OX(k)-56,OY-56,112,112,{stroke,r:10});drawFrame(x,opts[order[k]],OX(k),OY,100);}}};}});

// ================= OVERLAP =================
function circInter(r1,r2,d){if(d>=r1+r2)return 0;if(d<=Math.abs(r1-r2))return Math.PI*Math.min(r1,r2)**2;
  const a=r1*r1*Math.acos((d*d+r1*r1-r2*r2)/(2*d*r1)),b=r2*r2*Math.acos((d*d+r2*r2-r1*r1)/(2*d*r2)),c2=.5*Math.sqrt((-d+r1+r2)*(d+r1-r2)*(d-r1+r2)*(d+r1+r2));return a+b-c2;}
const overlapGame=T({n:5,W:640,H:380,sub:'Two shapes overlap. Estimate what percentage of the <b style="color:var(--you)">orange</b> shape is covered by the white one.',round(i,n){
  const rect=i%2===1;let pct,draw0;
  if(!rect){const r1=rand(60,110),r2=rand(60,130),d=rand(Math.abs(r1-r2)*.3+10,r1+r2-12),a=rand(0,PI2),cx=320,cy=190,A=[cx-Math.cos(a)*d/2,cy-Math.sin(a)*d/2],B=[cx+Math.cos(a)*d/2,cy+Math.sin(a)*d/2];
    pct=circInter(r1,r2,d)/(Math.PI*r1*r1)*100;draw0=x=>{x.fillStyle=rgba(C.you,.55);x.beginPath();x.arc(A[0],A[1],r1,0,PI2);x.fill();x.fillStyle='rgba(236,235,232,.45)';x.beginPath();x.arc(B[0],B[1],r2,0,PI2);x.fill();};}
  else{const a={x:rand(120,280),y:rand(60,160),w:rand(120,220),h:rand(100,170)},b={x:rand(200,360),y:rand(100,200),w:rand(120,240),h:rand(90,160)};const iw=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),ih=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    pct=iw*ih/(a.w*a.h)*100;draw0=x=>{x.fillStyle=rgba(C.you,.55);x.fillRect(a.x,a.y,a.w,a.h);x.fillStyle='rgba(236,235,232,.45)';x.fillRect(b.x,b.y,b.w,b.h);};}
  const r={mode:'slider',ask:'What % of the orange shape is covered?',slider:{min:0,max:100,step:1,init:50,fmt:v=>v+'%'}};
  return Object.assign(r,{score:v=>{r.err=Math.abs(v-pct);return soft(Math.abs(v-pct),11,1.6);},detail:(v,s)=>`Actual <b>${pct.toFixed(1)}%</b>, you said <b>${v}%</b> · <b>${fmt(s)}</b>`,draw(x){draw0(x);}});},
  detail:(r,R)=>`Avg error <b>${(R.reduce((s,q)=>s+(q.err||0),0)/R.length).toFixed(1)} pts</b>.`});

// ================= AREA =================
const areaGame=T({n:4,W:640,H:400,sub:'Estimate the area of the shape, in grid squares. The reference square is exactly 1.',round(i,n){
  const u=rand(26,40),P=blob(randi(9,14),rand(2.2,4.2),i<2?.5:.9).map(p=>[p[0]*u,p[1]*u]),cx=360,cy=200,A=polyArea(P)/(u*u),r={mode:'number',ask:'How many squares of area?'};
  return Object.assign(r,{score:v=>{r.err=Math.abs(v-A)/A*100;return soft(Math.abs(v-A)/A,.16,1.6);},detail:(v,s)=>`Actual <b>${A.toFixed(1)}</b>, you said <b>${v}</b> · <b>${fmt(s)}</b>`,
    draw(x,c,t,st){x.fillStyle=rgba(C.truth,.8);x.fillRect(40,40,u,u);txt(x,'= 1',48+u,40+u/2,C.muted,`500 12px ${MONO}`,'left');
      polyPath(x,P,cx,cy,1,0,false);const g=x.createLinearGradient(cx-150,cy-150,cx+150,cy+150);g.addColorStop(0,'#ff8a55');g.addColorStop(1,'#b8400f');x.fillStyle=g;x.fill();
      if(st.phase==='reveal'){x.save();x.clip();x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=1;for(let X=cx%u;X<640;X+=u){x.beginPath();x.moveTo(X,0);x.lineTo(X,400);x.stroke();}for(let Y=cy%u;Y<400;Y+=u){x.beginPath();x.moveTo(0,Y);x.lineTo(640,Y);x.stroke();}x.restore();chip(x,A.toFixed(1)+' sq',cx,cy,C.truth);}}});},
  detail:(r,R)=>`Avg error <b>${(R.reduce((s,q)=>s+(q.err||0),0)/R.length).toFixed(1)}%</b>.`});

// ================= VOLUME =================
function drawContainer(x,o,X,B){const g=x.createLinearGradient(X-o.r,0,X+o.r,0);g.addColorStop(0,'rgba(155,184,255,.18)');g.addColorStop(.5,'rgba(155,184,255,.38)');g.addColorStop(1,'rgba(155,184,255,.12)');
  x.strokeStyle='rgba(200,215,255,.8)';x.lineWidth=1.6;x.fillStyle=g;const e=.28;
  if(o.k==='cyl'){x.beginPath();x.ellipse(X,B,o.r,o.r*e,0,0,Math.PI);x.lineTo(X-o.r,B-o.h);x.ellipse(X,B-o.h,o.r,o.r*e,0,Math.PI,0,true);x.closePath();x.fill();x.stroke();x.beginPath();x.ellipse(X,B-o.h,o.r,o.r*e,0,0,PI2);x.stroke();}
  else if(o.k==='box'){const d=o.d*.45;x.beginPath();x.moveTo(X-o.r,B);x.lineTo(X+o.r,B);x.lineTo(X+o.r+d,B-d*.8);x.lineTo(X+o.r+d,B-o.h-d*.8);x.lineTo(X-o.r+d,B-o.h-d*.8);x.lineTo(X-o.r,B-o.h);x.closePath();x.fill();x.stroke();
    x.beginPath();x.moveTo(X-o.r,B-o.h);x.lineTo(X+o.r,B-o.h);x.lineTo(X+o.r+d,B-o.h-d*.8);x.moveTo(X+o.r,B-o.h);x.lineTo(X+o.r,B);x.stroke();}
  else if(o.k==='cone'){x.beginPath();x.ellipse(X,B,o.r,o.r*e,0,0,Math.PI);x.lineTo(X,B-o.h);x.closePath();x.fill();x.stroke();x.beginPath();x.ellipse(X,B,o.r,o.r*e,0,Math.PI,PI2);x.setLineDash([3,4]);x.stroke();x.setLineDash([]);}
  else{x.beginPath();x.arc(X,B-o.r,o.r,0,PI2);x.fill();x.stroke();x.beginPath();x.ellipse(X,B-o.r,o.r,o.r*e,0,0,Math.PI);x.stroke();}}
const volOf=o=>o.k==='cyl'?Math.PI*o.r*o.r*o.h:o.k==='box'?2*o.r*o.d*o.h:o.k==='cone'?Math.PI*o.r*o.r*o.h/3:4/3*Math.PI*o.r**3;
const volumeGame=T({n:8,W:640,H:340,sub:'Two containers. Which one holds more?',round(i,n){
  const target=lv(i,n,1.7,1.1);let A,B,g=0,ra;const mk=()=>{const k=pick(['cyl','box','cone','sph']);return {k,r:rand(35,90),h:rand(60,220),d:rand(40,150)};};
  do{A=mk();B=mk();ra=volOf(A)/volOf(B);g++;}while(g<800&&(A.k===B.k&&i>2||Math.abs(Math.log(Math.max(ra,1/ra))-Math.log(target))>.08||A.h>240||B.h>240));
  const ans=volOf(A)>volOf(B)?0:1;
  return {mode:'choice',choices:twoUp,keys:LRK,answer:ans,ask:'Which holds more?',
    draw(x,c,t,st){x.fillStyle='#19191b';x.fillRect(0,290,640,50);drawContainer(x,A,170,285);drawContainer(x,B,470,285);
      if(st.phase==='reveal'){const m=Math.min(volOf(A),volOf(B));chip(x,'×'+(volOf(A)/m).toFixed(2),170,315,ans===0?C.truth:C.muted);chip(x,'×'+(volOf(B)/m).toFixed(2),470,315,ans===1?C.truth:C.muted);}}};}});

// ================= DIRECTION =================
const directionGame=T({n:5,W:640,H:400,sub:'A dot moves along a curve, then vanishes. Point in the direction it was heading at the very end.',round(i,n){
  const D=lv(i,n,900,480),turn=rand(-1.8,1.8)*(i>=2?1:.5),a0=rand(0,PI2),sp=rand(170,260),P0=[rand(220,420),rand(150,250)];
  const pos=tt=>{let x0=P0[0],y0=P0[1];const N=40;for(let k=0;k<N;k++){const a=a0+turn*(k/N)*(tt/D);x0+=Math.cos(a)*sp*(tt/1000)/N;y0+=Math.sin(a)*sp*(tt/1000)/N;}return [x0,y0];};
  const end=pos(D),hd=deg(a0+turn),r={mode:'aim',show:400+D+150,prompt:'Watch the dot…',ask:'Which way was it heading? Click to aim.'};
  return Object.assign(r,{aim(p,st){st.v=deg(Math.atan2(p.y-end[1],p.x-end[0]));},nudge(d,st){st.v=(st.v||0)+d;},
    score:v=>{r.err=angDiff(v,hd);return soft(angDiff(v,hd),16,1.6);},detail:(v,s)=>`Off by <b>${angDiff(v,hd).toFixed(0)}°</b> · <b>${fmt(s)}</b>`,
    draw(x,c,t,st){const q=Math.min(Math.max(0,t-400),D);if(st.phase==='show'){x.strokeStyle=rgba(C.ink,.18);x.lineWidth=2;x.beginPath();for(let k=0;k<=20;k++){const [a,b]=pos(q*k/20);k?x.lineTo(a,b):x.moveTo(a,b);}x.stroke();if(t<400+D){const [a,b]=pos(q);glowDot(x,a,b,9,C.ink,14);}return;}
      x.strokeStyle='rgba(255,255,255,.08)';x.beginPath();x.arc(end[0],end[1],80,0,PI2);x.stroke();glowDot(x,end[0],end[1],6,C.muted,0);
      const ray=(a,col)=>{x.strokeStyle=col;x.lineWidth=3;x.lineCap='round';x.beginPath();x.moveTo(end[0],end[1]);x.lineTo(end[0]+Math.cos(rad(a))*80,end[1]+Math.sin(rad(a))*80);x.stroke();glowDot(x,end[0]+Math.cos(rad(a))*80,end[1]+Math.sin(rad(a))*80,6,col,10);};
      if(st.v!=null)ray(st.v,C.you);if(st.phase==='reveal')ray(hd,C.truth);}});},detail:(r,R)=>`Avg error <b>${(R.reduce((s,q)=>s+(q.err||0),0)/R.length).toFixed(0)}°</b>.`});

// ================= BALANCE =================
const balanceGame=T({n:8,W:640,H:320,sub:'The beam is held level. When it is released, which side drops? Heavier blocks and blocks further out count more.',round(i,n){
  let Ls,Rs,tl,tr,g=0;const gen=()=>{const k=randi(1,3),o=[];for(let j=0;j<k;j++)o.push({p:randi(1,5),w:randi(1,3)});return o;};
  const tq=a=>a.reduce((s,o)=>s+o.p*o.w,0),gap=Math.round(lv(i,n,5,1));
  do{Ls=gen();Rs=gen();tl=tq(Ls);tr=tq(Rs);g++;}while(g<500&&(tl===tr||Math.abs(tl-tr)>gap+1||(i>3&&Ls.reduce((s,o)=>s+o.w,0)===Rs.reduce((s,o)=>s+o.w,0)&&false)));
  const ans=tl>tr?0:1,S=50,Y=190;
  return {mode:'choice',choices:['Left drops','Right drops'],keys:LRK,answer:ans,ask:'Which side goes down?',
    draw(x,c,t,st){const tilt=st.phase==='reveal'?(ans?1:-1)*.12*ease((performance.now()-st.tr)/600):0;x.fillStyle='#2a2a2e';x.beginPath();x.moveTo(320,Y);x.lineTo(296,Y+70);x.lineTo(344,Y+70);x.closePath();x.fill();
      x.save();x.translate(320,Y);x.rotate(tilt);x.fillStyle='#5a5b60';x.fillRect(-290,-6,580,12);
      for(let p=-5;p<=5;p++){if(!p)continue;x.fillStyle=C.dim;x.fillRect(p*S-1,6,2,6);txt(x,String(Math.abs(p)),p*S,22,C.dim,`500 9px ${MONO}`);}
      const stack=(arr,sg)=>{const h={};arr.forEach(o=>{const X=sg*o.p*S;for(let k=0;k<o.w;k++){const lvl=(h[o.p]=(h[o.p]||0)+1);x.fillStyle=sg<0?'#ff8a55':'#9bb8ff';x.fillRect(X-17,-6-lvl*26,34,24);x.strokeStyle='rgba(0,0,0,.4)';x.strokeRect(X-17,-6-lvl*26,34,24);}});};
      stack(Ls,-1);stack(Rs,1);x.restore();glowDot(x,320,Y,5,C.ink,0);
      if(st.phase==='reveal'){chip(x,`torque ${tl}`,140,290,ans===0?C.truth:C.muted);chip(x,`torque ${tr}`,500,290,ans===1?C.truth:C.muted);}}};}});

// ================= BLUR / SILHOUETTE =================
const OBJ=[['🍎','Apple'],['🍌','Banana'],['🚗','Car'],['🐱','Cat'],['🏠','House'],['🌳','Tree'],['🐟','Fish'],['⭐','Star'],['🎸','Guitar'],['☂️','Umbrella'],['🚲','Bicycle'],['🚀','Rocket'],['🦀','Crab'],['🍕','Pizza'],['🔑','Key'],['⚓','Anchor'],['💡','Light bulb'],['✈️','Airplane'],['🍄','Mushroom'],['🦋','Butterfly'],['🐌','Snail'],['🔨','Hammer'],['🔔','Bell'],['🐘','Elephant'],['🦒','Giraffe'],['🐢','Turtle'],['🍐','Pear'],['🥕','Carrot'],['🎩','Top hat'],['👟','Shoe'],['⏰','Alarm clock'],['☕','Coffee'],['🐇','Rabbit'],['🦉','Owl'],['🐙','Octopus'],['🍇','Grapes'],['🌵','Cactus'],['🚁','Helicopter'],['⛵','Sailboat'],['🎈','Balloon']];
const objCanvas={};function objImg(ch,size,sil){const k=ch+size+sil;if(objCanvas[k])return objCanvas[k];const cv=document.createElement('canvas');cv.width=cv.height=size;const x=cv.getContext('2d');emoji(x,ch,size/2,size/2+size*.04,size*.82);
  if(sil){x.globalCompositeOperation='source-in';x.fillStyle='#e9e8e4';x.fillRect(0,0,size,size);}return objCanvas[k]=cv;}
function objChoices(i,n,k=4){const o=shuffle(OBJ).slice(0,k),ans=randi(0,k-1);return {o,ans,tg:o[ans]};}
const blurGame=T({n:8,W:640,H:360,sub:'An object is blurred beyond recognition and it gets worse every round. What is it?',round(i,n){
  const {o,ans,tg}=objChoices(i,n),res=Math.round(lv(i,n,11,4.5)),rot=rand(-.3,.3);let img=null;
  const make=()=>{const big=objImg(tg[0],160,false),a=document.createElement('canvas');a.width=a.height=res;const ax=a.getContext('2d');ax.imageSmoothingEnabled=true;ax.drawImage(big,0,0,res,res);
    const b=document.createElement('canvas');b.width=b.height=res*3;const bx=b.getContext('2d');bx.imageSmoothingEnabled=true;bx.drawImage(a,0,0,res*3,res*3);return b;};
  return {mode:'choice',choices:o.map(q=>q[1]),answer:ans,limit:10000,ask:'What is it?',
    draw(x,c,t,st){if(!img)img=make();x.save();x.translate(320,170);x.rotate(rot);x.imageSmoothingEnabled=true;if(st.phase==='reveal')x.drawImage(objImg(tg[0],160,false),-110,-110,220,220);else x.drawImage(img,-110,-110,220,220);x.restore();}};}});
const silhouetteGame=T({n:8,W:640,H:360,sub:'Only the outline is left. Name the object from its silhouette.',round(i,n){
  const {o,ans,tg}=objChoices(i,n),rot=i>=3?rand(-1.2,1.2):0,flip=i>=5&&Math.random()<.5,sc=lv(i,n,1,.7);
  return {mode:'choice',choices:o.map(q=>q[1]),answer:ans,limit:9000,ask:'What casts this silhouette?',
    draw(x,c,t,st){x.save();x.translate(320,170);x.rotate(rot);x.scale(flip?-sc:sc,sc);x.drawImage(objImg(tg[0],200,st.phase!=='reveal'),-115,-115,230,230);x.restore();}};}});

// ================= FOCUS (conjunction search) =================
const focusGame=T({n:6,W:640,H:420,sub:'Find the target among increasingly distracting clutter. Click it as fast as you can.',round(i,n){
  const N=Math.round(lv(i,n,18,70)),cols=['#ff5a5f','#9bb8ff','#7dd3a0','#f2c94c'],sh=[3,4,0],tC=randi(0,i<2?1:3),tS=randi(0,2),items=[];let g=0;
  const tgt={x:rand(40,600),y:rand(60,390),c:tC,s:tS,r:rand(0,PI2)};items.push(tgt);
  while(items.length<N&&g++<5000){const o={x:rand(30,610),y:rand(50,400),c:randi(0,i<2?1:3),s:randi(0,2),r:rand(0,PI2)};if(o.c===tC&&o.s===tS)continue;if(i<1&&o.c===tC)continue;if(items.every(q=>Math.hypot(q.x-o.x,q.y-o.y)>26))items.push(o);}
  const sz=lv(i,n,13,10),bgN=Math.round(lv(i,n,0,260)),bgS=[...Array(bgN)].map(()=>[rand(0,640),rand(40,420),rand(0,PI2),randi(0,3)]);
  const order=shuffle(items.map((_,k)=>k));
  const shp=(x,o)=>{if(sh[o.s]===0){x.beginPath();x.arc(o.x,o.y,sz*.9,0,PI2);}else regPoly(x,o.x,o.y,sz,sh[o.s],o.r*(i>=3?1:0));};
  const name=['triangle','square','circle'][tS],cname=['red','blue','green','yellow'][tC];
  return {mode:'click',answer:0,limit:15000,ask:`Find the <b style="color:${cols[tC]}">${cname} ${name}</b>.`,hit(p){let best=-1,bd=24;items.forEach((o,k)=>{const d=Math.hypot(p.x-o.x,p.y-o.y);if(d<bd){bd=d;best=k;}});return best;},
    score:(v,rt)=>v===0?100*Math.exp(-((Math.max(0,rt-1000)/7000)**1.4)):0,detail:(v,s,st)=>v===0?`<b class="g">Found</b> in <b>${((st.tr-st.ta)/1000).toFixed(2)}s</b>`:v==null?'<b class="b">Out of time</b>':'<b class="b">Not the target</b>',
    draw(x,c,t,st){x.globalAlpha=.35;bgS.forEach(([X,Y,a,k])=>{x.strokeStyle=cols[k];x.lineWidth=1.5;x.beginPath();x.moveTo(X-Math.cos(a)*10,Y-Math.sin(a)*10);x.lineTo(X+Math.cos(a)*10,Y+Math.sin(a)*10);x.stroke();});x.globalAlpha=1;
      regPoly(x,24,20,8,sh[tS]||40);if(!sh[tS]){x.beginPath();x.arc(24,20,7,0,PI2);}x.fillStyle=cols[tC];x.fill();txt(x,'TARGET',38,20,C.muted,`500 9.5px ${MONO}`,'left');
      order.forEach(k=>{const o=items[k];shp(x,o);x.fillStyle=cols[o.c];x.fill();if(st.phase==='reveal'&&k===0){x.strokeStyle='#fff';x.lineWidth=3;x.beginPath();x.arc(o.x,o.y,sz+8,0,PI2);x.stroke();}});}};}});

// ================= ROTATION =================
const rotationGame=T({n:5,W:640,H:360,sub:'The right shape is the left one rotated <b>clockwise</b>. By how many degrees?',round(i,n){
  const P=[[-1,-.6],[.4,-.6],[.4,-1.1],[1.3,0],[.4,1.1],[.4,.6],[-.3,.6],[-.3,1.2],[-1,1.2]].map(([a,b])=>[a+rand(-.1,.1),b+rand(-.1,.1)]),a0=rand(0,360),A=randi(10,350),r={mode:'slider',ask:'How many degrees clockwise?',slider:{min:0,max:359,step:1,init:180,fmt:v=>v+'°'}};
  return Object.assign(r,{score:v=>{r.err=angDiff(v,A);return soft(angDiff(v,A),13,1.6);},detail:(v,s)=>`Actual <b>${A}°</b>, you said <b>${v}°</b> · <b>${fmt(s)}</b>`,
    draw(x,c,t,st){[[a0,170,C.ink],[a0+A,470,C.you]].forEach(([a,X,col])=>{panel(x,X-115,50,230,230,{fill:'#141416'});polyPath(x,P,X,165,56,rad(a));x.fillStyle=col;x.fill();x.fillStyle='#0a0a0b';x.beginPath();const cs=Math.cos(rad(a)),sn=Math.sin(rad(a));x.arc(X+(-.6*cs-(-.2)*sn)*56,165+(-.6*sn+(-.2)*cs)*56,6,0,PI2);x.fill();});
      txt(x,'ORIGINAL',170,300,C.dim,`500 10px ${MONO}`);txt(x,'ROTATED ↻',470,300,C.dim,`500 10px ${MONO}`);
      if(st.phase==='ask'&&st.v!=null){x.globalAlpha=.25;polyPath(x,P,470,165,56,rad(a0+st.v));x.strokeStyle=C.ink;x.lineWidth=2;x.stroke();x.globalAlpha=1;}}});},detail:(r,R)=>`Avg error <b>${(R.reduce((s,q)=>s+(q.err||0),0)/R.length).toFixed(0)}°</b>.`});

// ================= REFLECTION =================
const reflectionGame=T({n:5,W:640,H:400,sub:'A light ray hits a mirror. Aim where it bounces. Angle in equals angle out.',round(i,n){
  const H0=[320,210],ma=rand(0,Math.PI),nrm=[-Math.sin(ma),Math.cos(ma)];let ia,g=0;
  do{ia=rand(0,PI2);g++;}while(g<200&&(Math.cos(ia)*nrm[0]+Math.sin(ia)*nrm[1])>-.35);
  const d=[Math.cos(ia),Math.sin(ia)],dn=d[0]*nrm[0]+d[1]*nrm[1],rr=[d[0]-2*dn*nrm[0],d[1]-2*dn*nrm[1]],out=deg(Math.atan2(rr[1],rr[0])),src=[H0[0]-d[0]*170,H0[1]-d[1]*170];
  const r={mode:'aim',ask:'Click to aim the reflected ray, then lock in.'};
  return Object.assign(r,{aim(p,st){st.v=deg(Math.atan2(p.y-H0[1],p.x-H0[0]));},nudge(dd,st){st.v=(st.v!=null?st.v:out+40)+dd;},
    score:v=>{r.err=angDiff(v,out);return soft(angDiff(v,out),9,1.6);},detail:(v,s)=>`Off by <b>${angDiff(v,out).toFixed(1)}°</b> · <b>${fmt(s)}</b>`,
    draw(x,c,t,st){const mx=Math.cos(ma)*130,my=Math.sin(ma)*130;x.strokeStyle='#cfd6e4';x.lineWidth=5;x.lineCap='round';x.beginPath();x.moveTo(H0[0]-mx,H0[1]-my);x.lineTo(H0[0]+mx,H0[1]+my);x.stroke();
      x.strokeStyle='rgba(207,214,228,.35)';x.lineWidth=1;for(let k=-120;k<=120;k+=12){const bx=H0[0]+Math.cos(ma)*k-nrm[0]*4,by=H0[1]+Math.sin(ma)*k-nrm[1]*4;x.beginPath();x.moveTo(bx,by);x.lineTo(bx-nrm[0]*9+Math.cos(ma)*6,by-nrm[1]*9+Math.sin(ma)*6);x.stroke();}
      x.save();x.shadowColor=C.gap;x.shadowBlur=12;x.strokeStyle=C.gap;x.lineWidth=3;x.beginPath();x.moveTo(src[0],src[1]);x.lineTo(H0[0],H0[1]);x.stroke();x.restore();glowDot(x,src[0],src[1],8,C.gap,16);
      const ray=(a,col)=>{x.strokeStyle=col;x.lineWidth=3;x.beginPath();x.moveTo(H0[0],H0[1]);x.lineTo(H0[0]+Math.cos(rad(a))*190,H0[1]+Math.sin(rad(a))*190);x.stroke();};
      if(st.v!=null)ray(st.v,C.you);if(st.phase==='reveal'){x.setLineDash([6,5]);ray(out,C.truth);x.setLineDash([]);}}});},detail:(r,R)=>`Avg error <b>${(R.reduce((s,q)=>s+(q.err||0),0)/R.length).toFixed(1)}°</b>.`});

// ================= RHYTHM (reproduce) =================
const rhythm2Game=T({n:4,W:640,H:300,sub:'Listen to a rhythm, then tap it back with <kbd>Space</kbd> or by clicking. Match the gaps between beats.',round(i,n){
  const k=Math.round(lv(i,n,4,7)),units=[1,1,2,.5,1.5],U=lv(i,n,320,260),gaps=[...Array(k-1)].map(()=>pick(i<1?[1,2]:units)*U),beats=[0];gaps.forEach(g=>beats.push(beats[beats.length-1]+g));
  const lead=600,dur=beats[beats.length-1],dtaps=beats.map((b,j)=>b*(1+(j%2?.05:-.03))),r={demo:{taps:dtaps,key:'SPACE',value:dtaps.map(q=>q-dtaps[0])},mode:'custom',show:lead+dur+700,prompt:'Listen…',ask:`Tap it back: <b>${k}</b> beats.`,hint:'<kbd>Space</kbd> or click to tap'};
  const play=st=>{st.p0=performance.now();beats.forEach(b=>beep(660,.09,{type:'square',vol:.12,at:(lead+b)/1000}));};
  const tap=(st,done)=>{const now=performance.now();if(!st.taps)st.taps=[];if(st.taps.length>=k)return;st.taps.push(now);beep(520,.06,{type:'square',vol:.1});if(st.taps.length>=k){later(()=>done(st.taps.map(q=>q-st.taps[0])),250);}};
  return Object.assign(r,{start:play,down(p,st,done){tap(st,done);},key(e,st,done){if(e.code==='Space'){e.preventDefault();tap(st,done);}},
    score:v=>{if(!Array.isArray(v)||v.length<2)return 0;v=v.slice(0,k);const ug=v.slice(1).map((q,j)=>q-v[j]),e=ug.reduce((s,g,j)=>s+Math.abs(g-gaps[j])/gaps[j],0)/gaps.length;r.err=e*100;return soft(e,.17,1.5);},
    detail:(v,s)=>`Gaps off by <b>${r.err.toFixed(0)}%</b> on average · <b>${fmt(s)}</b>`,
    draw(x,c,t,st){const L=70,Rr=570,sc=(Rr-L)/Math.max(dur,1);x.strokeStyle='rgba(255,255,255,.08)';x.lineWidth=2;x.beginPath();x.moveTo(L,110);x.lineTo(Rr,110);x.moveTo(L,200);x.lineTo(Rr,200);x.stroke();
      txt(x,'RHYTHM',L-10,110,C.dim,`500 9px ${MONO}`,'right');txt(x,'YOU',L-10,200,C.dim,`500 9px ${MONO}`,'right');
      const q=st.phase==='show'?t-lead:1e9;beats.forEach(b=>{const on=q>=b&&q<b+150,vis=q>=b;if(vis||st.phase==='reveal')glowDot(x,L+b*sc,110,on?11:7,on?C.you:C.ink,on?18:0);});
      if(st.taps&&st.taps.length){const ts=st.taps.map(q2=>q2-st.taps[0]),k2=Math.max(ts[ts.length-1],dur)>dur?(Rr-L)/ts[ts.length-1]:sc;ts.forEach(b=>glowDot(x,L+b*Math.min(sc,k2),200,7,st.phase==='reveal'?C.gap:C.you,10));}
      if(st.phase==='ask'){const p=1-Math.min(1,(performance.now()-(st.taps?st.taps[st.taps.length-1]:st.ta))/200);x.strokeStyle=rgba(C.you,.3+p*.7);x.lineWidth=3;x.beginPath();x.arc(320,260,16+p*6,0,PI2);x.stroke();}}});},
  detail:(r,R)=>`Avg gap error <b>${(R.reduce((s,q)=>s+(q.err||0),0)/R.length).toFixed(0)}%</b>.`});

// ================= DURATION =================
const durationGame=T({n:5,W:640,H:300,sub:'A light or a tone turns on, then off. How long did it last?',round(i,n){
  const D=+rand(.4,3.6).toFixed(2),aud=i%2===1,r={mode:'slider',show:700+D*1000+400,prompt:aud?'Listen… 🎧':'Watch…',ask:'How long did it last?',slider:{min:.1,max:5,step:.05,init:2,fmt:v=>(+v).toFixed(2)+'s'}};
  return Object.assign(r,{start(st){if(aud)beep(500,D,{type:'sine',vol:.16,at:.7});},score:v=>{r.err=Math.abs(v-D)/D*100;return soft(Math.abs(v-D)/D,.15,1.6);},detail:(v,s)=>`Actual <b>${D.toFixed(2)}s</b>, you said <b>${v.toFixed(2)}s</b> · <b>${fmt(s)}</b>`,
    draw(x,c,t,st){const on=st.phase==='show'&&t>=700&&t<700+D*1000;if(aud){for(let b=0;b<13;b++){const h=on?8+Math.abs(Math.sin(t/60+b*.7))*50:4;x.fillStyle=on?C.you:C.dim;x.fillRect(320-78+b*12,140-h/2,7,h);}}
      else{x.save();if(on){x.shadowColor=C.gap;x.shadowBlur=60;}x.fillStyle=on?C.gap:'#1e1e21';x.beginPath();x.roundRect(250,80,140,120,20);x.fill();x.restore();}
      if(st.phase==='reveal')chip(x,D.toFixed(2)+'s',320,250,C.truth);}});},detail:(r,R)=>`Avg error <b>${(R.reduce((s,q)=>s+(q.err||0),0)/R.length).toFixed(1)}%</b>.`});

// ================= PERSPECTIVE =================
const perspectiveGame=T({n:8,W:640,H:380,sub:'Two boxes sit on a long road. Ignore how big they <i>look</i>. Which one is actually bigger?',round(i,n){
  const HZ=120,F=420,camH=1.7,ratio=lv(i,n,1.5,1.08),z=[rand(3,6),rand(9,20)],near=randi(0,1),big=randi(0,1),s0=rand(.6,1.1),S=[0,1].map(k=>k===big?s0*ratio:s0),lx=[rand(-2.2,-.5),rand(.5,2.2)];
  const zz=[0,1].map(k=>k===near?z[0]:z[1]),proj=(a,y,zv)=>[320+a*F/zv,HZ+(camH-y)*F/zv];
  return {mode:'choice',choices:['A','B'],keys:{a:0,b:1,ArrowLeft:0,ArrowRight:1},answer:big,limit:8000,ask:'Which box is actually bigger?',
    draw(x,c,t,st){x.fillStyle='#101114';x.fillRect(0,0,640,HZ);x.fillStyle='#1b1b1e';x.fillRect(0,HZ,640,260);
      const road=(a,b)=>{const [x1,y1]=proj(a,0,1.2),[x2,y2]=proj(a,0,400),[x3,y3]=proj(b,0,400),[x4,y4]=proj(b,0,1.2);x.beginPath();x.moveTo(x1,y1);x.lineTo(x2,y2);x.lineTo(x3,y3);x.lineTo(x4,y4);x.closePath();};
      road(-3,3);x.fillStyle='#26262b';x.fill();x.strokeStyle='rgba(255,255,255,.35)';x.lineWidth=2;[-3,3].forEach(a=>{const [x1,y1]=proj(a,0,1.2),[x2,y2]=proj(a,0,400);x.beginPath();x.moveTo(x1,y1);x.lineTo(x2,y2);x.stroke();});
      x.strokeStyle=rgba(C.gap,.6);for(let zv=1.5;zv<200;zv*=1.35){const [a1,b1]=proj(0,0,zv),[a2,b2]=proj(0,0,zv*1.12);x.lineWidth=Math.max(1,6/zv*2);x.beginPath();x.moveTo(a1,b1);x.lineTo(a2,b2);x.stroke();}
      [0,1].sort((a,b)=>zz[b]-zz[a]).forEach(k=>{const [X,Y]=proj(lx[k],0,zz[k]),w=S[k]*F/zz[k];x.fillStyle='rgba(0,0,0,.5)';x.beginPath();x.ellipse(X,Y,w*.7,w*.12,0,0,PI2);x.fill();
        let col=k?'#9bb8ff':'#ff8a55';if(st.phase==='reveal'&&k===big)col=C.truth;x.fillStyle=col;x.fillRect(X-w/2,Y-w,w,w);x.fillStyle='rgba(255,255,255,.2)';x.fillRect(X-w/2,Y-w,w,w*.18);
        txt(x,k?'B':'A',X,Y-w-14,C.ink,`600 ${Math.max(11,Math.min(18,w*.3))}px ${MONO}`);if(st.phase==='reveal')chip(x,`${(S[k]/Math.min(...S)).toFixed(2)}×`,X,Y+18,k===big?C.truth:C.muted);});}};}});

// ================= DISAPPEARANCE =================
const disappearGame=T({n:6,W:640,H:400,sub:'Memorize the objects. After a flash, one is gone. Click where the missing one was.',round(i,n){
  const N=Math.round(lv(i,n,6,14)),O=[];let g=0;const pool=shuffle(OBJ);while(O.length<N&&g++<800){const o={x:rand(50,590),y:rand(50,350),e:pool[O.length][0]};if(O.every(q=>Math.hypot(q.x-o.x,q.y-o.y)>70))O.push(o);}
  const miss=randi(0,O.length-1),SH=lv(i,n,2600,1800),MK=500,sz=lv(i,n,44,36);
  return {mode:'click',show:SH+MK,answer:miss,limit:10000,prompt:'Memorize…',ask:'Which one disappeared? Click its spot.',
    hit(p){let best=-1,bd=1e9;O.forEach((o,k)=>{const d=Math.hypot(p.x-o.x,p.y-o.y);if(d<bd){bd=d;best=k;}});return best;},
    draw(x,c,t,st){if(st.phase==='show'&&t>=SH){const R2=srand(Math.floor(t/60));for(let k=0;k<600;k++){x.fillStyle=`rgba(255,255,255,${R2()*.25})`;x.fillRect(R2()*640,R2()*400,6,6);}return;}
      O.forEach((o,k)=>{if(k===miss&&st.phase!=='show'){if(st.phase==='reveal'){x.globalAlpha=.9;emoji(x,o.e,o.x,o.y,sz);x.globalAlpha=1;x.strokeStyle=C.truth;x.lineWidth=2.5;x.beginPath();x.arc(o.x,o.y,sz*.75,0,PI2);x.stroke();}return;}
        emoji(x,o.e,o.x,o.y,sz);if(st.phase==='reveal'&&k===st.v){x.strokeStyle=C.bad;x.lineWidth=2.5;x.beginPath();x.arc(o.x,o.y,sz*.75,0,PI2);x.stroke();}});}};}});

// ================= CHANGE (flicker) =================
const changeGame=T({n:5,W:640,H:400,sub:'The scene flickers between two versions. One thing is different. Click it as soon as you spot it.',round(i,n){
  const N=Math.round(lv(i,n,10,22)),O=[];let g=0;while(O.length<N&&g++<900){const o={x:rand(40,600),y:rand(40,360),s:randi(0,3),c:randi(0,5),r:rand(14,24),a:rand(0,PI2)};if(O.every(q=>Math.hypot(q.x-o.x,q.y-o.y)>q.r+o.r+14))O.push(o);}
  const k=randi(0,O.length-1),kind=pick(['color','gone','move','shape']),B=O.map(o=>({...o}));
  if(kind==='color')B[k].c=(B[k].c+randi(1,5))%6;else if(kind==='move'){B[k].x+=rand(-1,1)*26;B[k].y+=rand(-1,1)*26;}else if(kind==='shape')B[k].s=(B[k].s+randi(1,3))%4;else B[k].gone=true;
  const ON=560,OFF=lv(i,n,140,220);
  return {mode:'click',answer:k,limit:20000,ask:'Click whatever is changing.',hit(p){let best=-1,bd=1e9;O.forEach((o,j)=>{const d=Math.hypot(p.x-o.x,p.y-o.y);if(d<bd){bd=d;best=j;}});return bd<50?best:-1;},
    score:(v,rt)=>v===k?100*Math.exp(-((Math.max(0,rt-1500)/12000)**1.3)):0,detail:(v,s,st)=>v===k?`<b class="g">Spotted</b> in <b>${((st.tr-st.ta)/1000).toFixed(1)}s</b> (${kind==='gone'?'it vanished':kind})`:v==null?'<b class="b">Out of time</b>':'<b class="b">Not that one</b>',
    draw(x,c,t,st){const cyc=t%(2*(ON+OFF)),scene=st.phase==='reveal'?O:cyc<ON?O:cyc<ON+OFF?null:cyc<2*ON+OFF?B:null;if(!scene)return;
      scene.forEach((o,j)=>{if(o.gone)return;x.fillStyle=PAL[o.c];if(o.s===0){x.beginPath();x.arc(o.x,o.y,o.r,0,PI2);}else regPoly(x,o.x,o.y,o.r*1.1,o.s+2,o.a);x.fill();
        if(st.phase==='reveal'&&j===k){x.strokeStyle='#fff';x.lineWidth=3;x.beginPath();x.arc(o.x,o.y,o.r+9,0,PI2);x.stroke();}});}};}});

// ================= DENSITY =================
const densityGame=T({n:8,W:640,H:340,sub:'Which box is more <b>densely</b> packed? Bigger boxes hold more dots, so think dots per area.',round(i,n){
  const ratio=lv(i,n,1.7,1.12),dense=randi(0,1),d0=rand(.0035,.006),bx=[0,1].map(()=>({w:rand(150,270),h:rand(140,270)})),pts=[0,1].map(k=>{const b=bx[k],N=Math.round(b.w*b.h*d0*(k===dense?ratio:1));return [...Array(N)].map(()=>[rand(6,b.w-6),rand(6,b.h-6)]);});
  return {mode:'choice',choices:twoUp,keys:LRK,answer:dense,limit:5000,ask:'Which is denser?',
    detail:(v,s)=>`Left <b>${(pts[0].length/(bx[0].w*bx[0].h)*1e4).toFixed(1)}</b> vs right <b>${(pts[1].length/(bx[1].w*bx[1].h)*1e4).toFixed(1)}</b> per 100×100`,
    draw(x,c,t,st){[0,1].forEach(k=>{const b=bx[k],X=(k?470:170)-b.w/2,Y=170-b.h/2;panel(x,X,Y,b.w,b.h,{fill:'#131315',r:6,stroke:st.phase==='reveal'&&k===dense?C.truth:'rgba(255,255,255,.12)'});x.fillStyle=C.ink;pts[k].forEach(p=>{x.beginPath();x.arc(X+p[0],Y+p[1],2.4,0,PI2);x.fill();});});}};}});

// ================= WAVELENGTH =================
const wavelengthGame=T({n:8,W:640,H:320,sub:'Which wave has the <b>shorter</b> wavelength (peaks closer together)? Ignore height and speed.',round(i,n){
  const ratio=lv(i,n,1.5,1.06),sh=randi(0,1),l0=rand(50,110),L=[0,1].map(k=>k===sh?l0/ratio:l0),A=[0,1].map(()=>rand(14,46)),ph=[0,1].map(()=>rand(0,PI2)),sp=[0,1].map(()=>rand(-90,90)),x0=[0,1].map(()=>rand(20,90)),x1=[0,1].map(()=>rand(520,620));
  return {mode:'choice',choices:tb,keys:UDK,answer:sh,limit:7000,ask:'Which wavelength is shorter?',
    draw(x,c,t,st){[0,1].forEach(k=>{const Y=90+k*140;x.strokeStyle=st.phase==='reveal'&&k===sh?C.truth:k?'#9bb8ff':C.you;x.lineWidth=2.5;x.beginPath();
      for(let X=x0[k];X<=x1[k];X+=2){const y=Y+Math.sin((X-sp[k]*t/1000)/L[k]*PI2+ph[k])*A[k];X===x0[k]?x.moveTo(X,y):x.lineTo(X,y);}x.stroke();
      if(st.phase==='reveal')chip(x,`λ ${L[k].toFixed(0)}px`,600,Y-50,k===sh?C.truth:C.muted,'right');});}};}});

// ================= ACCELERATION =================
const accelGame=T({n:8,W:640,H:260,sub:'Watch the ball. Is it speeding up or slowing down?',round(i,n){
  const p=lv(i,n,2.1,1.16),acc=Math.random()<.5,e=acc?p:1/p,D=rand(1400,2200),dir=Math.random()<.5?1:-1,L=rand(380,540),xs=dir>0?rand(30,640-L-30):rand(L+30,610);
  return {mode:'choice',show:400+D+150,choices:['Speeding up','Slowing down'],keys:LRK,answer:acc?0:1,prompt:'Watch…',ask:'Accelerating or decelerating?',
    draw(x,c,t,st){const Y=130;x.strokeStyle='rgba(255,255,255,.08)';x.lineWidth=2;x.beginPath();x.moveTo(20,Y+20);x.lineTo(620,Y+20);x.stroke();
      if(st.phase==='show'&&t>=400&&t<400+D){const q=(t-400)/D,X=xs+dir*L*Math.pow(q,e);glowDot(x,X,Y,12,C.ink,14);}
      if(st.phase==='reveal'){for(let k=0;k<=10;k++){const X=xs+dir*L*Math.pow(k/10,e);x.fillStyle=acc?C.truth:C.gap;x.beginPath();x.arc(X,Y,4,0,PI2);x.fill();}txt(x,'positions at equal time steps',320,200,C.muted,`500 10px ${MONO}`);}}};}});

// ================= SOUND LOCATION =================
const SPOS=[-1,-.5,0,.5,1],SNAME=['Far left','Left','Center','Right','Far right'];
const soundLocGame=T({n:8,W:640,H:240,sub:'🎧 Headphones on. A sound plays from somewhere left to right. Where did it come from?',round(i,n){
  const k=randi(0,4),play=st=>{st.p0=performance.now();const v=rand(.35,.6);if(i%2)noise(.35,{pan:SPOS[k],vol:v*1.4,f:rand(900,2600)});else beep(rand(400,900),.35,{pan:SPOS[k],vol:v*.4,type:'triangle'});};
  return {mode:'choice',show:600,choices:SNAME,answer:k,prompt:'Listen…',ask:'Where did it come from?',start:play,score:v=>v===k?100:Math.abs(v-k)===1?45:0,
    onAsk:(st,{ctl})=>ctl.append(el('button',{class:'btn sm',text:'↻ Replay',onclick:()=>play(st)})),detail:(v,s)=>s>=100?'<b class="g">Exactly</b>':s>0?`<b class="m">Close</b>: it was ${SNAME[k]}`:`<b class="b">It was ${SNAME[k]}</b>`,
    draw(x,c,t,st){const q=performance.now()-(st.p0||0);x.strokeStyle='rgba(255,255,255,.08)';x.lineWidth=2;x.beginPath();x.arc(320,230,190,Math.PI,0);x.stroke();
      emoji(x,'🎧',320,200,44);SPOS.forEach((p,j)=>{const a=Math.PI+(p+1)/2*Math.PI,X=320+Math.cos(a)*190,Y=230+Math.sin(a)*190*.7;let col='#2a2a2e';if(st.phase==='reveal'){if(j===k)col=C.truth;else if(j===st.v)col=C.bad;}glowDot(x,X,Y,10,col,0);});
      if(q<400){x.strokeStyle=rgba(C.you,1-q/400);x.lineWidth=2;x.beginPath();x.arc(320,200,30+q/8,0,PI2);x.stroke();}}};}});

// ================= ODD ONE OUT =================
const oddGame=T({n:8,W:640,H:380,sub:'Every item follows a rule except one. Click the rule breaker.',round(i,n){
  const kind=['even','sides','mult','rot','prime','hue','size','sum'][i%8],N=Math.round(lv(i,n,6,10)),items=[],odd=randi(0,N-1);
  const primes=[2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97],nonp=[9,15,21,25,27,33,35,39,45,49,51,55,57,63,65,69,77,81,85,87,91,93,95];
  for(let k=0;k<N;k++){const o={k:kind};const isOdd=k===odd;
    if(kind==='even')o.t=String(isOdd?randi(5,49)*2+1:randi(5,49)*2);
    else if(kind==='mult'){const m=pick([3,4,7]);o.m=m;o.t=String(isOdd?(()=>{let v;do{v=randi(12,99);}while(v%m===0);return v;})():m*randi(3,Math.floor(99/m)));}
    else if(kind==='prime')o.t=String(isOdd?pick(nonp):pick(primes));
    else if(kind==='sides')o.r=rand(0,PI2);
    else if(kind==='rot'){o.a=isOdd?rand(30,150):0;}
    else if(kind==='hue'){o.h=200;o.dh=isOdd?lv(i,n,30,14):0;}
    else if(kind==='size'){o.z=isOdd?lv(i,n,1.4,1.15):1;}
    items.push(o);}
  if(kind==='sides'){const base=pick([3,4,5,6]);items.forEach((o,k)=>o.n=k===odd?pick([3,4,5,6,7].filter(v=>v!==base)):base);}
  if(kind==='sum'){const s=randi(9,13),mk=()=>{let a,b;do{a=randi(1,9);b=s-a;}while(b<0||b>9);return `${a}${b}`;};items.forEach((o,k)=>{if(k===odd){let v;do{v=randi(10,99);}while(Math.floor(v/10)+v%10===s);o.t=String(v);}else o.t=mk();});}
  const cols=Math.ceil(N/2),P=k=>[320+((k%cols)-(cols-1)/2)*(560/cols),130+Math.floor(k/cols)*130],rule={even:'all even',mult:'all multiples of '+items[0].m,prime:'all prime',sum:'digits add to the same total',sides:'same number of sides',rot:'same orientation',hue:'same color',size:'same size'}[kind];
  return {mode:'click',answer:odd,limit:12000,ask:'Click the odd one out.',hit(p){for(let k=0;k<N;k++){const [X,Y]=P(k);if(Math.abs(p.x-X)<50&&Math.abs(p.y-Y)<55)return k;}return -1;},
    score:(v,rt)=>v===odd?100*Math.max(.5,Math.exp(-((Math.max(0,rt-2500)/9000)**1.5))):0,detail:(v,s)=>`${s>=50?'<b class="g">Correct</b>':'<b class="b">No</b>'}: the rest were ${rule}.`,
    draw(x,c,t,st){items.forEach((o,k)=>{const [X,Y]=P(k),hov=st.hover&&st.phase==='ask'&&Math.abs(st.hover.x-X)<50&&Math.abs(st.hover.y-Y)<55;let stroke=hov?C.you:'rgba(255,255,255,.08)';
      if(st.phase==='reveal'){if(k===odd)stroke=C.truth;else if(k===st.v)stroke=C.bad;}panel(x,X-46,Y-52,92,104,{stroke});
      if(o.t)txt(x,o.t,X,Y,C.ink,`500 30px ${MONO}`);
      else if(o.k==='sides'){regPoly(x,X,Y,30,o.n,o.r);x.fillStyle=C.ink;x.fill();}
      else if(o.k==='rot')arrowGlyph(x,X,Y,30,rad(o.a)+0,C.ink);
      else if(o.k==='hue'){x.fillStyle=`hsl(${o.h+o.dh} 65% 60%)`;x.beginPath();x.arc(X,Y,30,0,PI2);x.fill();}
      else if(o.k==='size'){x.fillStyle=C.ink;x.beginPath();x.arc(X,Y,24*o.z,0,PI2);x.fill();}});}};}});

// ================= ESTIMATION =================
const estimationGame=T({n:4,W:640,H:360,sub:'Read the value from the chart. Only the ends of each scale are labelled.',round(i,n){
  const kind=['bar','gauge','jar','bar'][i],max=pick([100,250,500,1000,80]),v=Math.round(rand(.06,.94)*max),r={mode:'number',ask:`Estimate the value (0 to ${max}).`};
  return Object.assign(r,{score:u=>{const e=Math.abs(u-v)/max;r.err=e*100;return soft(e,.045,1.6);},detail:(u,s)=>`Actual <b>${v}</b>, you said <b>${u}</b> · <b>${fmt(s)}</b>`,
    draw(x,c,t,st){const f=v/max,rv=st.phase==='reveal';
      if(kind==='bar'){const L=80,Rr=560,Y=190;x.fillStyle='#1e1e21';x.fillRect(L,Y-20,Rr-L,40);x.fillStyle=C.you;x.fillRect(L,Y-20,(Rr-L)*f,40);txt(x,'0',L,Y+40,C.muted,`500 12px ${MONO}`);txt(x,String(max),Rr,Y+40,C.muted,`500 12px ${MONO}`);if(rv)chip(x,String(v),L+(Rr-L)*f,Y-38,C.truth);}
      else if(kind==='gauge'){const cx=320,cy=250,R=150;x.strokeStyle='#2a2a2e';x.lineWidth=18;x.beginPath();x.arc(cx,cy,R,Math.PI,0);x.stroke();x.strokeStyle=C.you;x.beginPath();x.arc(cx,cy,R,Math.PI,Math.PI+Math.PI*f);x.stroke();
        const a=Math.PI+Math.PI*f;x.strokeStyle=C.ink;x.lineWidth=3;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.cos(a)*(R-24),cy+Math.sin(a)*(R-24));x.stroke();glowDot(x,cx,cy,6,C.ink,0);txt(x,'0',cx-R,cy+26,C.muted,`500 12px ${MONO}`);txt(x,String(max),cx+R,cy+26,C.muted,`500 12px ${MONO}`);if(rv)chip(x,String(v),cx,cy-40,C.truth);}
      else{const X=250,Y=40,w=140,h=280;x.strokeStyle='rgba(200,215,255,.6)';x.lineWidth=2;x.beginPath();x.roundRect(X,Y,w,h,16);x.stroke();x.save();x.beginPath();x.roundRect(X,Y,w,h,16);x.clip();const g=x.createLinearGradient(0,Y+h*(1-f),0,Y+h);g.addColorStop(0,'#9bb8ff');g.addColorStop(1,'#3b5bab');x.fillStyle=g;x.fillRect(X,Y+h*(1-f),w,h*f);x.restore();
        txt(x,String(max),X+w+12,Y+4,C.muted,`500 12px ${MONO}`,'left');txt(x,'0',X+w+12,Y+h,C.muted,`500 12px ${MONO}`,'left');if(rv)chip(x,String(v),X-12,Y+h*(1-f),C.truth,'right');}}});},
  detail:(r,R)=>`Avg error <b>${(R.reduce((s,q)=>s+(q.err||0),0)/R.length).toFixed(1)}%</b> of the scale.`});

// ================= ORBIT =================
const orbitGame=T({n:5,W:640,H:420,sub:'Planets orbit at steady speeds. After they vanish, predict where the orange one will be.',round(i,n){
  const N=Math.round(lv(i,n,2,5)),cx=320,cy=215,O=[...Array(N)].map((_,k)=>({r:60+k*(140/Math.max(1,N-1||1))+rand(-8,8),w:rand(.6,1.7)*(Math.random()<.5?1:-1)*(1+.0),a:rand(0,PI2)})),tg=randi(0,N-1),VIS=2600,ahead=+rand(1,2.5).toFixed(1);
  O[tg].r=Math.max(O[tg].r,80);const at=(o,s)=>o.a+o.w*s,ans=deg(at(O[tg],(VIS/1000)+ahead)),r={mode:'aim',show:VIS,prompt:'Watch the orbits…',ask:`Where will the orange planet be <b>${ahead}s</b> after it vanished? Click on its orbit.`};
  return Object.assign(r,{aim(p,st){st.v=deg(Math.atan2(p.y-cy,p.x-cx));},nudge(d,st){st.v=(st.v||0)+d;},score:v=>{r.err=angDiff(v,ans);return soft(angDiff(v,ans),18,1.6);},detail:(v,s)=>`Off by <b>${angDiff(v,ans).toFixed(0)}°</b> · <b>${fmt(s)}</b>`,
    draw(x,c,t,st){glowDot(x,cx,cy,14,C.gap,30);O.forEach((o,k)=>{x.strokeStyle=k===tg?rgba(C.you,.3):'rgba(255,255,255,.07)';x.lineWidth=1.5;x.beginPath();x.arc(cx,cy,o.r,0,PI2);x.stroke();
      if(st.phase==='show'){const a=at(o,t/1000);glowDot(x,cx+Math.cos(a)*o.r,cy+Math.sin(a)*o.r,k===tg?10:7,k===tg?C.you:C.ink,12);}});
      const R0=O[tg].r;if(st.phase!=='show'){const a0=at(O[tg],VIS/1000);x.strokeStyle=C.dim;x.setLineDash([3,4]);x.beginPath();x.arc(cx+Math.cos(a0)*R0,cy+Math.sin(a0)*R0,9,0,PI2);x.stroke();x.setLineDash([]);}
      if(st.v!=null)glowDot(x,cx+Math.cos(rad(st.v))*R0,cy+Math.sin(rad(st.v))*R0,10,C.you,14);if(st.phase==='reveal')glowDot(x,cx+Math.cos(rad(ans))*R0,cy+Math.sin(rad(ans))*R0,10,C.truth,14);}});},
  detail:(r,R)=>`Avg error <b>${(R.reduce((s,q)=>s+(q.err||0),0)/R.length).toFixed(0)}°</b>.`});

// ================= DISGUISE (texture camouflage) =================
const disguiseGame=T({n:8,W:640,H:400,sub:'A digit is hidden in the texture, camouflaged by orientation or color. Which digit is it?',round(i,n){
  const dg=shuffle('0123456789'.split('')).slice(0,4),ans=randi(0,3),D=dg[ans],m=document.createElement('canvas');m.width=640;m.height=400;const mx=m.getContext('2d');mx.fillStyle='#fff';mx.font=`700 300px ${SANS}`;mx.textAlign='center';mx.textBaseline='middle';mx.fillText(D,320,210);
  const md=mx.getImageData(0,0,640,400).data,inside=(X,Y)=>md[(Math.floor(Y)*640+Math.floor(X))*4+3]>128,colorMode=i%2===1,dTheta=lv(i,n,80,26),jit=lv(i,n,8,26),th0=rand(0,180),hd=lv(i,n,50,14),h0=rand(0,360);
  const E=[];for(let Y=10;Y<400;Y+=13)for(let X=10;X<640;X+=13){const xx=X+rand(-3,3),yy=Y+rand(-3,3),ins=inside(clamp(xx,0,639),clamp(yy,0,399));E.push({x:xx,y:yy,a:rad(th0+(ins?dTheta:0)+rand(-jit,jit)),h:h0+(ins?hd:0)+rand(-8,8),l:rand(50,68),r:rand(3,5.5)});}
  return {mode:'choice',choices:dg,answer:ans,limit:9000,ask:'Which digit is hidden?',
    draw(x,c,t,st){E.forEach(e=>{if(colorMode){x.fillStyle=`hsl(${e.h} 55% ${e.l}%)`;x.beginPath();x.arc(e.x,e.y,e.r,0,PI2);x.fill();}else{x.strokeStyle='rgba(236,235,232,.75)';x.lineWidth=2;x.beginPath();x.moveTo(e.x-Math.cos(e.a)*5,e.y-Math.sin(e.a)*5);x.lineTo(e.x+Math.cos(e.a)*5,e.y+Math.sin(e.a)*5);x.stroke();}});
      if(st.phase==='reveal')txt(x,D,320,210,rgba(C.truth,.55),`700 300px ${SANS}`);}};}});

// ================= register =================
const GICON={
  Memory:'<svg width="34" height="34" viewBox="0 0 34 34" fill="currentColor"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13.5" y="4" width="7" height="7" rx="2" opacity=".3"/><rect x="23" y="4" width="7" height="7" rx="2" opacity=".3"/><rect x="4" y="13.5" width="7" height="7" rx="2" opacity=".3"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/><rect x="23" y="13.5" width="7" height="7" rx="2" opacity=".3"/><rect x="4" y="23" width="7" height="7" rx="2" opacity=".3"/><rect x="13.5" y="23" width="7" height="7" rx="2" opacity=".3"/><rect x="23" y="23" width="7" height="7" rx="2"/></svg>',
  Spatial:'<svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M17 4l11 6v13l-11 7-11-7V10z"/><path d="M6 10l11 6 11-6M17 16v14" opacity=".6"/></svg>',
  Timing:'<svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="17" cy="18" r="12" opacity=".5"/><path d="M17 18l5-5M17 4v2"/></svg>',
  Reflex:'<svg width="34" height="34" viewBox="0 0 34 34" fill="currentColor"><path d="M19 3L7 19h8l-2 12 12-16h-8z"/></svg>',
  Audio:'<svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 17h3l3-8 4 16 4-20 4 18 3-6h5"/></svg>',
  Estimation:'<svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 26h26" opacity=".5"/><path d="M8 26V16M14 26V9M20 26V13M26 26V5"/></svg>',
  Visual:'<svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 17s5.5-9 15-9 15 9 15 9-5.5 9-15 9S2 17 2 17z" opacity=".6"/><circle cx="17" cy="17" r="5" fill="currentColor"/></svg>',
  Physics:'<svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="17" cy="17" r="3" fill="currentColor"/><ellipse cx="17" cy="17" rx="14" ry="6" opacity=".6"/><ellipse cx="17" cy="17" rx="14" ry="6" transform="rotate(60 17 17)" opacity=".6"/></svg>',
};
const NEW=[
  ['flash','Flash','Memory','Recreate a split-second light pattern',flashGame,'A pattern of lights blinks on for a fraction of a second. Recreate it.',['Lights flash on a 5×5 grid for <b>a split second</b>.','Click every square that was lit.','More lights and shorter flashes each round.'],'Share of lit squares recalled.'],
  ['match','Match','Visual','Same shape, or not quite?',matchGame,'Two shapes side by side. Decide if they are exactly identical.',['Compare the two outlines.','Press <b>Same</b> (<kbd>S</kbd>) or <b>Different</b> (<kbd>D</kbd>).','Differences shrink every round.'],'Share of rounds right.'],
  ['rotate','Rotate','Spatial','Find the rotated 3D object',rotateGame,'A 3D block object, and four candidates. Only one is the same object rotated. The rest are mirror images.',['Study the target object.','Click the option that is the <b>same object, rotated</b>.','Faster answers score a little more.'],'Correct picks, with a small speed bonus.'],
  ['find','Find','Visual','Spot the one odd symbol',findGame,'A field of identical symbols hides one that differs. Find it fast.',['Scan the grid.','<b>Click</b> the symbol that is different.','The grid grows and the symbols get closer each round.'],'Correct finds, scored by speed.'],
  ['follow','Follow','Visual','Track one ball in a crowd',followGame,'One ball is marked, then they all look identical and scramble. Keep track of it.',['Note the <b>orange</b> ball.','Follow it with your eyes as they move.','Click it when they stop.'],'Share of rounds you kept track.'],
  ['timing','Timing','Timing','Stop it right on the mark',timingGame,'A ball slides along a rail. Hit the target line exactly as it passes.',['Watch the ball approach the green line.','Press <kbd>Space</kbd> or click at the exact moment.','It gets faster and partly hidden.'],'Pixels between the ball and the target.'],
  ['distance','Distance','Estimation','How far apart are two points?',distanceGame,'Two points and a scale bar. Estimate the distance between them.',['Look at the 10-unit scale bar.','Estimate the gap between the two points.','Type the number of units.'],'Percentage error.'],
  ['depth','Depth','Spatial','Which is closest? Which is farthest?',depthGame,'A scene in perspective. Some objects float, so use their shadows on the ground.',['Read whether you need the <b>closest</b> or the <b>farthest</b>.','Use height in the scene and ground shadows.','Click the object.'],'Share of rounds right.'],
  ['pitch','Pitch','Audio','Which tone is higher?',pitchGame,'Two tones play one after the other. Pick the higher one. 🎧',['Listen to both tones.','Choose <b>First</b> or <b>Second</b> (<kbd>←</kbd> <kbd>→</kbd>).','The gap shrinks down to a few cents.'],'Share of rounds right.'],
  ['echo','Echo','Audio','Spot the changed note',echoGame,'A melody plays twice. One note is different the second time.',['Listen to the original melody.','Listen to the echo.','Pick which note changed.'],'Share of rounds right.'],
  ['color','Color','Memory','Remember an exact shade',colorGame,'A color flashes up. Pick the exact shade from a set of near-identical swatches.',['Memorize the color.','Pick it from six swatches.','The shades get closer every round.'],'Share of rounds right.'],
  ['digits','Memory','Memory','Recall a sequence of characters',digitsGame,'Digits and letters flash one at a time. Type the whole sequence back in order.',['Watch each character.','Type the sequence in order.','Sequences get longer.'],'Characters in the right position.'],
  ['order','Order','Memory','In what order did they appear?',orderGame,'Shapes pop up one by one. Then click them in the order they appeared.',['Watch the order shapes appear.','When they go grey, click them in order.','More shapes, faster, each round.'],'Shapes placed in the right position.'],
  ['speed','Speed','Physics','Which one is moving faster?',speedGame,'Two objects move for a moment, over different distances. Pick the faster one.',['Watch both objects.','Ignore how far they go: judge <b>speed</b>.','Pick <b>Top</b> or <b>Bottom</b>.'],'Share of rounds right.'],
  ['length','Length','Estimation','Redraw a line from memory',lengthGame,'A line appears briefly at an angle. Redraw it at the same length.',['Memorize the line length.','Drag to draw a horizontal line.','Press <kbd>Enter</kbd> to lock in.'],'Percentage error.'],
  ['weight','Weight','Physics','Which object is heavier?',weightGame,'Size and material both matter. Pick the heavier object.',['Judge each object\'s size and material.','Gold > iron > stone > ice > wood > foam.','Pick <b>Left</b> or <b>Right</b>.'],'Share of rounds right.'],
  ['symmetry','Symmetry','Visual','Perfectly symmetrical?',symmetryGame,'Decide whether a pattern is a perfect mirror image about the dashed line.',['Compare both halves.','Answer within 6 seconds.','The patterns get bigger.'],'Share of rounds right.'],
  ['shadow','Shadow','Spatial','Match the object to its shadow',shadowGame,'Light shines straight down on a 3D object. Pick the shadow it casts.',['Study the object from above.','Click the matching floor shadow.','Options are shown from above, front at the bottom.'],'Share of rounds right.'],
  ['mirror','Mirror','Spatial','Pick the true mirror image',mirrorGame,'Which option is the shape reflected in the mirror line?',['Study the shape and the mirror line.','Pick the true reflection.','Later rounds rotate the options.'],'Share of rounds right.'],
  ['pattern','Pattern','Visual','Complete the matrix',patternGame,'A 3×3 grid of pieces follows rules across rows and columns. Fill the gap.',['Find the rules: shape, count, color, fill, rotation.','Pick the piece for the empty cell.','More rules each round.'],'Correct picks.'],
  ['pulse','Pulse','Timing','How fast is it flashing?',pulseGame,'A light flashes at a steady rate. Estimate its frequency.',['Watch the light for 3 seconds.','Set the slider to the flashes per second.','Lock in.'],'Percentage error.'],
  ['frequency','Frequency','Audio','Which sound came most often?',frequencyGame,'A rapid stream of sounds. Which one played the most?',['Learn each sound in the intro.','Count as the stream plays.','Pick the most frequent.'],'Share of rounds right.'],
  ['sequence','Sequence','Visual','What comes next?',sequenceGame,'Frames flash by quickly, following a rule. Predict the next frame.',['Watch the four frames.','Work out what changes each step.','Pick the next frame.'],'Share of rounds right.'],
  ['overlap','Overlap','Estimation','How much do they intersect?',overlapGame,'Two shapes overlap. Estimate how much of the orange one is covered.',['Look at the overlap region.','Set the slider to a percentage.','Lock in.'],'Points off the true percentage.'],
  ['area','Area','Estimation','Estimate an irregular area',areaGame,'Estimate the area of an irregular blob in grid squares.',['Compare against the 1×1 reference square.','Type your estimate.','Submit.'],'Percentage error.'],
  ['volume','Volume','Physics','Which container holds more?',volumeGame,'Cylinders, boxes, cones and spheres. Which holds more?',['Compare the two containers.','Think in 3D: width², not width.','Pick <b>Left</b> or <b>Right</b>.'],'Share of rounds right.'],
  ['direction','Direction','Physics','Where was it heading?',directionGame,'A dot curves across the screen and vanishes. Point where it was heading.',['Watch the dot\'s path.','Click to aim its final heading.','Lock in.'],'Degrees off.'],
  ['balance','Balance','Physics','Which way will it tip?',balanceGame,'Weights sit on a beam at different distances. Which side drops?',['Weight × distance on each side.','Pick the side that goes down.','The sides get closer each round.'],'Share of rounds right.'],
  ['blur','Blur','Visual','Name the blurred object',blurGame,'Identify an object from an increasingly blurry image.',['Look at the blurred image.','Pick its name.','It gets blurrier each round.'],'Share of rounds right.'],
  ['focus','Focus','Visual','Find the target in the clutter',focusGame,'Find a specific shape and color among increasingly distracting clutter.',['Read the target.','Click it as fast as you can.','More clutter each round.'],'Correct finds, scored by speed.'],
  ['rotation','Rotation','Spatial','How far did it turn?',rotationGame,'Estimate how many degrees clockwise the shape was rotated.',['Compare the original and rotated shape.','Set the angle, clockwise.','Lock in.'],'Degrees off.'],
  ['reflection','Reflection','Physics','Where does the light bounce?',reflectionGame,'A ray of light hits a mirror. Aim where it reflects.',['Angle in equals angle out.','Click to aim the reflected ray.','Lock in.'],'Degrees off.'],
  ['seqmem','Sequence Memory','Memory','Repeat the flashing order',seqMemGame,'Squares flash in a sequence. Repeat it exactly.',['Watch the squares flash in order.','Click them in the same order.','Sequences get longer.'],'Positions in the right order.'],
  ['rhythm2','Rhythm','Timing','Tap a rhythm back',rhythm2Game,'Listen to a rhythm, then tap it back with the same spacing.',['Listen to the beat pattern.','Tap it back with <kbd>Space</kbd> or clicks.','Match the gaps between beats.'],'Gap timing error.'],
  ['duration','Duration','Timing','How long did it last?',durationGame,'A light or a tone turns on and off. Estimate how long it lasted.',['Watch or listen.','Set the duration on the slider.','Lock in.'],'Percentage error.'],
  ['silhouette','Silhouette','Visual','Name it from its silhouette',silhouetteGame,'Only the outline is left. Name the object.',['Look at the silhouette.','Pick the object.','Later rounds rotate and flip it.'],'Share of rounds right.'],
  ['perspective','Perspective','Spatial','Which is really bigger?',perspectiveGame,'Two boxes on a road. Account for distance to judge their true size.',['Use the road to judge distance.','Pick the box that is actually bigger.','The size gap shrinks.'],'Share of rounds right.'],
  ['grid','Grid','Memory','Remember the lit squares',gridGame,'Squares light up on a grid. Click them all afterwards.',['Memorize the highlighted squares.','Click them once they hide.','The grid and count grow.'],'Share of squares recalled.'],
  ['disappear','Disappearance','Memory','What vanished?',disappearGame,'After a brief flash, one object is gone. Where was it?',['Memorize all the objects.','After the flash, one is missing.','Click its spot.'],'Share of rounds right.'],
  ['change','Change','Visual','Spot the flickering change',changeGame,'Two versions of a scene flicker back and forth. Find what changes.',['Watch the flickering scene.','Find the one thing that changes.','Click it fast.'],'Correct finds, scored by speed.'],
  ['density','Density','Estimation','Which is more tightly packed?',densityGame,'Two boxes of dots. Which is denser?',['Compare dots per area, not total dots.','Answer within 5 seconds.','Pick <b>Left</b> or <b>Right</b>.'],'Share of rounds right.'],
  ['wavelength','Wavelength','Visual','Which wave is shorter?',wavelengthGame,'Two waves. Which has the shorter wavelength?',['Compare peak spacing.','Ignore height and movement.','Pick <b>Top</b> or <b>Bottom</b>.'],'Share of rounds right.'],
  ['accel','Acceleration','Physics','Speeding up or slowing down?',accelGame,'Watch an object move. Is it accelerating or decelerating?',['Watch the motion.','Pick speeding up or slowing down.','The change gets subtler.'],'Share of rounds right.'],
  ['soundloc','Sound Location','Audio','Where did the sound come from?',soundLocGame,'🎧 A sound plays from somewhere between left and right. Locate it.',['Use headphones.','Listen to the sound.','Pick its position.'],'Exact = 100, one off = 45.'],
  ['odd','Odd One Out','Visual','Find the rule breaker',oddGame,'All items follow a rule except one. Find it.',['Work out the rule.','Click the item that breaks it.','Faster answers score more.'],'Correct picks, with a speed bonus.'],
  ['estimate','Estimation','Estimation','Read an unlabeled chart',estimationGame,'Read a value from a bar, gauge or jar with only the end points labelled.',['Read the scale ends.','Estimate the value.','Type it in.'],'Error as a share of the scale.'],
  ['orbit','Orbit','Physics','Predict a planet\'s position',orbitGame,'Planets orbit at steady speeds. Predict where one will be after it vanishes.',['Watch the orange planet\'s speed.','It vanishes. Imagine it carrying on.','Click where it will be.'],'Degrees off.'],
  ['disguise','Disguise','Visual','Find the hidden digit',disguiseGame,'A digit is camouflaged in a texture. Which one is it?',['Look for the region that differs.','Pick the hidden digit.','The camouflage gets better.'],'Share of rounds right.'],
];
NEW.forEach(([id,name,grp,desc,fn,lead,steps,score])=>CH.push({id,name,cat:grp,grp,desc,fn,lead,steps,score,audio:grp==='Audio'}));
