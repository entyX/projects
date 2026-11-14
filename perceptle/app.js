'use strict';
// =====================================================================
//  App layer: storage (local or cloud), dailies, home/dashboard, practice,
//  archive, leaderboard, auth modal, settings.
// =====================================================================
const RNG0=Math.random;
const GMAP={count:'Estimation',traj:'Physics',angle:'Spatial',rhythm:'Timing',frac:'Estimation',react:'Reflex',arrows:'Reflex',memory:'Memory',timer:'Timing',shape:'Memory'};
CH.forEach(c=>{if(!c.grp)c.grp=GMAP[c.id];if(c.id==='rhythm')c.name='Tempo';if(c.id==='memory')c.name='Words';});
const GROUPS=['Memory','Spatial','Visual','Estimation','Physics','Timing','Reflex','Audio'];
// ===== difficulty calibration =====
// PAR = expected raw score (0-100) of an average, untrained first-time player on each test.
// Raw scores are shifted on the logit (log-odds) scale by that test's difficulty, as in Rasch / item response theory:
// logit(cal) = logit(raw) + logit(CAL_T) - logit(PAR). PAR lands exactly on CAL_T, 0 stays 0 and 100 stays 100.
// Easy tests (high PAR) shift down, so they score stricter. Hard tests (low PAR) shift up, so they score more leniently. The same player should then total about the same on any daily, whatever tests it draws.
// Tune a PAR toward that test's real median raw score (games store it as g.w) when you have data.
const CAL_T=60;
const PAR={
  // originals
  count:62,traj:62,angle:72,rhythm:68,frac:52,react:80,arrows:58,memory:75,timer:78,shape:72,
  // memory
  flash:62,grid:74,seqmem:72,color:52,digits:72,order:68,disappear:62,
  // visual
  match:72,find:66,follow:74,symmetry:72,pattern:54,sequence:72,blur:64,silhouette:88,focus:70,change:58,wavelength:78,odd:74,disguise:72,
  // spatial
  rotate:55,depth:78,shadow:58,mirror:66,rotation:42,perspective:72,
  // timing
  timing:58,pulse:42,rhythm2:50,duration:30,
  // estimation
  distance:55,length:45,overlap:50,area:32,density:72,estimate:45,
  // physics
  speed:76,weight:72,volume:64,direction:54,balance:80,reflection:45,accel:72,orbit:42,
  // audio
  pitch:74,echo:50,frequency:58,soundloc:70,
};
const logit=p=>Math.log(p/(1-p)),calShift=id=>logit(CAL_T/100)-logit(clamp(PAR[id]||CAL_T,10,95)/100);
function calibrate(id,raw){raw=clamp(isFinite(raw)?raw:0,0,100);if(raw<=0||raw>=100)return raw;const q=clamp(raw/100,.0005,.9995);return Math.round(1000/(1+Math.exp(-(logit(q)+calShift(id)))))/10;}
const DAILY_POOL_N=58; // freeze the daily pool so archived dailies never change
const iconOf=c=>ICON[c.id]||GICON[c.grp];
// ===== placement: unranked until PLACE games are played =====
const PLACE=5,ratedN=u=>u.games.filter(g=>!g.p&&!g.m).length,placed=u=>ratedN(u)>=PLACE;
const UNR_EMB=s=>`<svg width="${s}" height="${s}" viewBox="-12 -12 124 124"><polygon points="50,6 84,24 84,62 50,94 16,62 16,24" fill="#161618" stroke="#4c4c51" stroke-width="2" stroke-dasharray="5 5"/><text x="50" y="58" text-anchor="middle" font-family="Geist Mono,monospace" font-size="26" font-weight="600" fill="#8a8a8e">?</text></svg>`;
function placementLine(u){const k=Math.min(PLACE,ratedN(u));return el('div',{class:'elo'},[el('span',{html:`Placement <b>${k} / ${PLACE}</b>`}),
  el('span',{class:'ppips'},Array.from({length:PLACE},(_,i)=>el('i',{class:i<k?'on':''}))),el('span',{text:k>=PLACE?'Ranked!':`${PLACE-k} more to get ranked`})]);}
let runStartG=99;
function rankHero(u,o={}){if(placed(u))return rankHeroBase(u,o.from!=null&&runStartG<PLACE?{kicker:'Placement complete · your rank'}:o);
  const k=Math.min(PLACE,ratedN(u));
  return el('div',{class:'rhero fade',style:'--tc:#8a8a8e'},[el('div',{class:'rh-em',html:UNR_EMB(168)}),el('div',{class:'rh-body'},[
    el('div',{class:'kicker',text:'Placement matches'}),el('div',{class:'rh-name'},[el('span',{text:'Unranked'})]),
    el('div',{class:'rh-rt',html:`${k} / ${PLACE} <small>finish a rated run of 5 to reveal your rank</small>`}),
    el('div',{class:'rh-bar'},[el('i',{style:`width:${k/PLACE*100}%`})]),
    el('div',{class:'rh-next'},[el('span',{text:'Dailies and random runs of 5 are rated. Single practice tests are not.'})])])]);}

// ================= storage =================
const LKEY='perceive:local';
const freshProfile=(name='')=>({name,created:Date.now(),g:{r:toG(250),rd:350,vol:.06},peak:250,games:[],runs:[],daily:{},dprog:null,prefs:{sound:true,brief:true}});
function fixProfile(u){const f=freshProfile();for(const k in f)if(u[k]==null)u[k]=f[k];u.prefs={...f.prefs,...(u.prefs||{})};return u;}
function loadLocal(){
  try{const d=JSON.parse(localStorage.getItem(LKEY));if(d&&d.g)return fixProfile(d);}catch(e){}
  try{const o=JSON.parse(localStorage.getItem('perceive:db'));if(o&&o.list){const a=o.list[o.cur]||Object.values(o.list)[0];if(a){const u=fixProfile({...freshProfile(),...a});u.prefs={sound:o.sound!==false,brief:o.brief!==false};return u;}}}catch(e){}
  return freshProfile();}
let LOCAL=loadLocal(),CLOUD=null,AUTH_BUSY=false;
const me=()=>CLOUD?CLOUD.u:LOCAL;
const PREF=()=>me().prefs;
const signedIn=()=>!!CLOUD;
const hasLocalData=()=>LOCAL.games.length>0||Object.keys(LOCAL.daily).length>0;
function clearLocal(){try{localStorage.removeItem(LKEY);localStorage.removeItem('perceive:db');}catch(e){}LOCAL=freshProfile();}
let saveT=null,saveFails=0;
function saveDB(){if(CLOUD){clearTimeout(saveT);saveT=setTimeout(pushCloud,450);}else{try{localStorage.setItem(LKEY,JSON.stringify(LOCAL));localStorage.removeItem('perceive:db');}catch(e){}}}
async function pushCloud(){if(!CLOUD)return;const u=CLOUD.u,R=ratingOf(u);
  try{await Cloud.saveProfile(CLOUD.uid,JSON.parse(JSON.stringify(u)),!placed(u)?null:{name:u.name,rating:Math.round(R*10)/10,tier:TIERS[tierIdx(R)],games:u.games.length,peak:Math.round(u.peak*10)/10,t:Date.now()});saveFails=0;}
  catch(e){console.warn(e);if(++saveFails<4){toast('Cloud save failed. Retrying…');setTimeout(pushCloud,3000*saveFails);}else toast('Could not save to the cloud. Check your connection.');}}
function toast(msg){const t=el('div',{class:'toast',text:msg});document.body.append(t);setTimeout(()=>t.classList.add('out'),2600);setTimeout(()=>t.remove(),3100);}

// ================= dailies =================
const D0=Date.UTC(2026,10,13,8); // Daily #1: Nov 13 2026, 12:00 AM PST
const dayNum=(t=Date.now())=>Math.max(1,Math.floor((t-D0)/864e5)+1);
const dayStart=n=>D0+(n-1)*864e5;
const dayLabel=n=>new Date(dayStart(n)+12*3600e3).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'America/Los_Angeles'});
function dailySet(n){const R=srand(n*7919+17),pool=CH.slice(0,DAILY_POOL_N);for(let i=pool.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const out=[],grp={};let aud=0;for(const c of pool){if(c.audio&&aud>=1)continue;if((grp[c.grp]||0)>=2)continue;out.push(c);if(c.audio)aud++;grp[c.grp]=(grp[c.grp]||0)+1;if(out.length===5)break;}return out;}
let RUN=null; // {mode:'daily'|'arch', n}
function seedFor(i){Math.random=RUN&&RUN.n?srand(RUN.n*1000+i*97+1):RNG0;}
function startDaily(n){const u=me(),set=dailySet(n),arch=n!==dayNum();audio();
  if(u.daily[n])return dailyResults(n);
  RUN={mode:arch?'arch':'daily',n};fullRun=false;queue=set;scores=[];idx=0;
  if(u.dprog&&u.dprog.n===n){u.dprog.s.forEach((s,k)=>scores.push({id:set[k].id,name:set[k].name,score:s}));idx=u.dprog.s.length;}
  else{u.dprog={n,arch,s:[],ids:set.map(c=>c.id)};saveDB();}
  runStartR=ratingOf(u);runStartT=tierIdx(runStartR);runStartG=u.games.length;next();}
function onTestDone(id,score){if(!RUN)return;const u=me();if(!u.dprog||u.dprog.n!==RUN.n)return;u.dprog.s.push(Math.round(score*10)/10);
  if(u.dprog.s.length>=5){const p=u.dprog,total=Math.round(p.s.reduce((a,b)=>a+b,0)*10)/10;u.daily[p.n]={s:p.s,ids:p.ids,total,t:Date.now(),arch:!!p.arch,sub:false};u.dprog=null;saveDB();submitPending();}else saveDB();}
async function submitPending(){if(!CLOUD)return;const u=CLOUD.u;let ch=false;
  for(const [n,e] of Object.entries(u.daily)){if(e.arch||e.sub)continue;try{await Cloud.submitDaily(n,CLOUD.uid,{uid:CLOUD.uid,name:u.name,total:e.total,s:e.s,ids:e.ids,t:e.t,rating:Math.round(ratingOf(u))});e.sub=true;ch=true;}catch(err){console.warn(err);}}
  if(ch)saveDB();}
function results(){Math.random=RNG0;if(RUN){const n=RUN.n;RUN=null;return dailyResults(n,true);}runResults();}
function countdown(node){const f=()=>{const ms=dayStart(dayNum()+1)-Date.now();if(ms<=0){node.textContent='now';return;}const h=Math.floor(ms/36e5),m=Math.floor(ms%36e5/6e4),s=Math.floor(ms%6e4/1e3);node.textContent=`${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;};f();every(f,1000);return node;}
const EMO={count:'🔢',traj:'🏀',angle:'📐',rhythm:'🥁',frac:'➗',react:'⚡',arrows:'⌨️',memory:'📝',timer:'⏱️',shape:'🔷',
  flash:'💡',grid:'🔲',seqmem:'🧩',color:'🎨',digits:'🔤',order:'🔀',disappear:'👻',match:'👯',find:'🔎',follow:'👀',symmetry:'🦋',pattern:'🧮',sequence:'⏭️',blur:'🌫️',silhouette:'👤',focus:'🎯',change:'🔄',wavelength:'〰️',odd:'🃏',disguise:'🥷',
  rotate:'🧊',depth:'🏔️',shadow:'🔦',mirror:'🪞',rotation:'🔃',perspective:'🛣️',timing:'🛑',pulse:'💓',rhythm2:'🎶',duration:'⌛',distance:'🗺️',length:'📏',overlap:'⭕',area:'🧱',density:'🧂',estimate:'📊',
  speed:'🏎️',weight:'🏋️',volume:'🧪',direction:'🧭',balance:'⚖️',reflection:'💫',accel:'🚀',orbit:'🪐',pitch:'🎵',echo:'🔁',frequency:'📻',soundloc:'🎧'};
const blocks=s=>{const k=Math.round(s/10),e=s>=85?'🟩':s>=60?'🟨':'🟥';return e.repeat(k)+'⬛'.repeat(10-k);};

// ================= nav =================
const TROPHY='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>';
function drawNav(){const n=document.getElementById('nav');n.innerHTML='';const u=me(),R=ratingOf(u);
  n.append(el('button',{class:'icon',title:'Leaderboard','aria-label':'Leaderboard',html:TROPHY,onclick:leaderboardPage}));
  if(signedIn()||u.games.length)n.append(el('button',{class:'acct',title:'Your stats',onclick:statsPage},placed(u)?[badge(TIERS[tierIdx(R)]),el('span',{class:'an',text:u.name||'Guest'}),el('span',{class:'ar',text:String(Math.round(R))})]:[el('span',{class:'unr',text:'Unranked'}),el('span',{class:'an',text:u.name||'Guest'}),el('span',{class:'ar',text:`${Math.min(PLACE,ratedN(u))}/${PLACE}`})]));
  if(!signedIn())n.append(el('button',{class:'btn sm',text:'Sign in',onclick:()=>openAuth('register')}));
  n.append(el('button',{class:'icon',title:'Settings','aria-label':'Settings',html:GEAR,onclick:settingsPage}));}

// ================= home =================
function menu(){Math.random=RNG0;RUN=null;page();drawNav();const n=dayNum(),u=me();if(u.daily[n])dashboard(n);else dailyHome(n);}
function lensEl(){const lens=el('div',{class:'lens','aria-hidden':'true'},[el('div',{class:'ticks'}),el('div',{class:'glass'},[el('div',{class:'iris'})])]);
  listen(window,'pointermove',e=>{const r=lens.getBoundingClientRect();if(!r.width)return;const dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),d=Math.hypot(dx,dy)||1,m=Math.min(1,d/600)*r.width*.1;
    lens.style.setProperty('--px',(dx/d*m).toFixed(1)+'px');lens.style.setProperty('--py',(dy/d*m).toFixed(1)+'px');});return lens;}
function dailyHome(n){
  const u=me(),set=dailySet(n),prog=u.dprog&&u.dprog.n===n?u.dprog.s.length:0;
  const spec=(v,k)=>el('div',{},[el('b',{},[v]),el('small',{text:k})]);
  stage.append(el('section',{class:'hero'},[
    el('div',{class:'fade'},[
      el('div',{class:'kicker',text:`Daily #${n} · ${dayLabel(n)}`}),
      el('h1',{html:'Today\'s<br><em>five</em>.'}),
      el('p',{text:'Five tests, the same for everyone in the world. One attempt each. Play it, then see where you stand.'}),
      el('ol',{class:'dlist'},set.map((c,i)=>el('li',{class:i<prog?'done':''},[el('span',{class:'n',text:String(i+1).padStart(2,'0')}),el('span',{class:'di',html:iconOf(c)}),el('b',{text:c.name}),el('small',{text:c.grp}),i<prog?el('span',{class:'dv '+grade(u.dprog.s[i]),text:fmt(u.dprog.s[i])}):null]))),
      el('div',{class:'cta'},[el('button',{class:'btn primary lg',html:(prog?`Resume Daily #${n} (${prog}/5)`:`Play Daily #${n}`)+' <span class="ar">→</span>',onclick:()=>startDaily(n)})]),
      el('div',{class:'specs'},[spec('05','Tests'),spec('~5','Minutes'),spec(countdown(el('span',{class:'cd'})),'Resets in')]),
      el('button',{class:'linkbtn',html:'Or practice without the daily →',onclick:practicePage}),
    ]),
    el('div',{class:'lenswrap fade'},[lensEl()]),
  ]));
}
function dashboard(n){
  const u=me(),d=u.daily[n],R=ratingOf(u);
  const rankLine=el('div',{class:'rankline fade'},[signedIn()?el('span',{class:'muted',text:'Global rank: loading…'}):el('span',{},[el('span',{class:'muted',text:'Not on the leaderboard yet. '}),el('button',{class:'linkbtn',text:'Create an account to get ranked →',onclick:()=>openAuth('register')})])]);
  if(!placed(u)){rankLine.innerHTML='';rankLine.append(el('span',{class:'muted',text:'Finish a rated run of 5 to get ranked.'}));}
  else if(signedIn())Cloud.rankOf(Math.round(R*10)/10).then(r=>{rankLine.innerHTML='';rankLine.append(el('span',{html:`Global rank <b>#${r.rank}</b> of ${r.of}`}),el('button',{class:'linkbtn',text:'Leaderboard →',onclick:leaderboardPage}));}).catch(()=>rankLine.firstChild.textContent='Global rank unavailable offline');
  const today=el('div',{class:'today fade'},[
    el('div',{},[el('div',{class:'kicker',text:`Daily #${n} complete`}),el('div',{class:'tt'},[el('span',{class:'num '+grade(d.total/5),text:fmt(d.total)}),el('span',{class:'muted mono',text:' / 500'})]),
      el('div',{class:'em',text:d.s.map(s=>s>=85?'🟩':s>=60?'🟨':'🟥').join('')}),el('div',{class:'muted',style:'font-size:13.5px'},['Next daily in ',countdown(el('b',{class:'mono'}))])]),
    el('div',{class:'btnrow'},[el('button',{class:'btn',text:'View results',onclick:()=>dailyResults(n)}),el('button',{class:'btn primary',html:'Practice <span class="ar">→</span>',onclick:practicePage}),el('button',{class:'btn',text:'Archive',onclick:archivePage})])]);
  const pnl=(t,sub,kid)=>el('div',{class:'panel fade'},[el('div',{class:'ph'},[el('div',{class:'kicker',text:t}),el('span',{text:sub})]),kid]);
  const recent=Object.entries(u.daily).sort((a,b)=>b[0]-a[0]).slice(0,6).map(([k,e])=>el('button',{class:'drow',onclick:()=>dailyResults(+k)},[el('b',{text:`#${k}`}),el('span',{class:'muted',text:dayLabel(+k)}),el('span',{class:'em',text:e.s.map(s=>s>=85?'🟩':s>=60?'🟨':'🟥').join('')}),el('span',{class:'mono '+grade(e.total/5),text:fmt(e.total)})]));
  stage.append(today,el('div',{style:'height:16px'}),rankHero(u),rankLine,
    el('div',{class:'grid2'},[pnl('Skill profile','by category',el('div',{class:'radarwrap'},[radar(u)])),
      pnl('Your dailies',`${Object.keys(u.daily).length} played`,el('div',{class:'dlist2'},[...recent,el('div',{class:'row',style:'justify-content:flex-start;margin-top:12px'},[el('button',{class:'btn sm',text:'All archived dailies',onclick:archivePage}),el('button',{class:'btn sm',text:'Full stats',onclick:statsPage})])]))]));
}

// ================= practice =================
let PFILT='All';
function practicePage(){Math.random=RNG0;RUN=null;page();drawNav();const u=me();
  const chips=el('div',{class:'chips fade'},['All',...GROUPS].map(g=>el('button',{class:'chip'+(g===PFILT?' on':''),text:g,onclick:()=>{PFILT=g;practicePage();}})));
  const list=CH.filter(c=>PFILT==='All'||c.grp===PFILT);
  stage.append(el('div',{class:'phero fade'},[el('div',{},[el('div',{class:'kicker',text:`Practice · ${CH.length} tests`}),el('h2',{text:'Practice'}),el('p',{class:'sub',text:'Single tests are free practice and never touch your rank. A random run of 5 is rated: your rank updates once, after all five.'})]),
      el('div',{class:'btnrow'},[el('button',{class:'btn primary lg',html:'Random run of 5 <span class="ar">→</span>',onclick:()=>startRun(pick5(),true)}),el('button',{class:'btn lg',text:'Archive',onclick:archivePage})])]),
    chips,
    el('div',{class:'cards fade'},list.map(c=>{const pb=bestOf(u,c.id),i=CH.indexOf(c);return el('button',{class:'card',onclick:()=>startRun([c])},[
      el('div',{class:'ct'},[el('span',{text:String(i+1).padStart(2,'0')}),el('span',{text:c.grp})]),el('span',{class:'ic',html:iconOf(c)}),
      el('div',{},[el('b',{text:c.name}),el('small',{text:c.desc})]),
      el('div',{class:'cb'},[el('span',{text:pb!=null?'Best':'Unplayed'}),pb!=null?el('span',{class:'pbv '+grade(pb),text:fmt(pb)}):el('span',{text:'—'})])]);})));}

// ================= archive =================
function archivePage(){Math.random=RNG0;RUN=null;page('narrow');drawNav();const u=me(),N=dayNum();
  const rows=[];for(let k=N;k>=1;k--){const d=u.daily[k],today=k===N,set=dailySet(k);
    rows.push(el('div',{class:'arow'+(today?' cur':'')},[el('div',{class:'nm'},[`Daily #${k}${today?' · today':''}`,el('small',{text:`${dayLabel(k)} · ${set.map(c=>c.name).join(', ')}`})]),
      d?el('span',{class:'mono '+grade(d.total/5),text:fmt(d.total)}):null,
      el('button',{class:'btn sm'+(d?'':' primary'),text:d?'Results':u.dprog&&u.dprog.n===k?'Resume':'Play',onclick:()=>d?dailyResults(k):startDaily(k)})]));}
  stage.append(el('div',{class:'kicker fade',text:'Archive'}),el('h2',{class:'fade',text:'Past dailies'}),
    el('p',{class:'sub fade',text:'Every daily stays playable. Archived dailies are rated runs, but only same-day plays go on the daily leaderboard.'}),el('div',{class:'alist fade'},rows));}

// ================= daily results =================
function dailyResults(n,fresh){Math.random=RNG0;page('narrow');drawNav();const u=me(),d=u.daily[n];if(!d)return menu();
  const set=d.ids.map(id=>CH.find(c=>c.id===id)||{id,name:id}),total=d.total,avg=total/5,title=avg>=92?'Superhuman':avg>=82?'Eagle-eyed':avg>=70?'Sharp':avg>=55?'Solid':avg>=40?'Getting there':'Needs calibration';
  const [gc,gx]=makeCanvas(160,160);gc.style.width='160px';gc.style.border='none';gc.style.boxShadow='none';
  const totalEl=el('div',{class:'num '+grade(avg),text:'0.0',style:'font-size:48px'}),pctEl=el('div',{class:'muted',text:d.arch?'Archive play · not ranked':'Comparing with other players…'});
  const curveBox=el('div',{class:'curvebox'},[el('div',{class:'empty',text:'Loading scores…'})]);
  let pctTop=null;
  const share=()=>{const R='━'.repeat(16),site=location.origin+location.pathname,lines=['┏'+R+'┓',`   🧠 PERCEIVE LABS · DAILY #${n}`,`   📅 ${dayLabel(n)}`,'┗'+R+'┛',''];
    d.s.forEach((s,k)=>lines.push(`${blocks(s)} ${EMO[set[k].id]||'🔹'} ${set[k].name} · ${Math.round(s)}`));
    lines.push('',`${avg>=82?'🏅':avg>=60?'⭐':'💪'} ${fmt(total)} / 500 · ${title}`);if(pctTop!=null)lines.push(`🏆 Top ${pctTop}% of players`);
    lines.push(R,'🔓 Log in to save your results and join the ranked leaderboard',`👉 ${site}`);return lines.join('\n');};
  const copyBtn=el('button',{class:'btn primary',html:'Copy results 📋',onclick:async()=>{try{await navigator.clipboard.writeText(share());copyBtn.innerHTML='Copied ✓';setTimeout(()=>copyBtn.innerHTML='Copy results 📋',1800);}catch(e){prompt('Copy your results:',share());}}});
  const join=!signedIn()&&!d.arch?(()=>{const inp=el('input',{placeholder:'Pick a username',maxlength:20,value:u.name||'','aria-label':'Username'});
    return el('div',{class:'panel join fade'},[el('div',{},[el('b',{text:'Join the leaderboard'}),el('div',{class:'muted',style:'font-size:13.5px',text:'Pick a username and your score is saved to a free account, along with all your progress on this device.'})]),
      el('form',{class:'field',onsubmit:e=>{e.preventDefault();openAuth('register',{name:inp.value.trim(),after:()=>dailyResults(n)});}},[inp,el('button',{class:'btn primary',text:'Register'})])]);})():null;
  stage.append(el('div',{class:'kicker fade',text:`Daily #${n} · ${dayLabel(n)}`}),
    el('div',{class:'rhead fade'},[gc,el('div',{class:'t'},[el('div',{style:'display:flex;align-items:baseline;gap:8px'},[totalEl,el('span',{class:'muted',style:`font:600 18px ${MONO}`,text:'/ 500'})]),el('h2',{text:title}),pctEl])]),
    el('div',{class:'res fade'},d.s.map((s,k)=>el('div',{class:'rr'},[el('div',{text:set[k].name}),el('div',{class:'bar'},[el('i',{'data-w':s,style:`background:var(--${{g:'truth',m:'gap',b:'bad'}[grade(s)]})`})]),el('div',{class:'v '+grade(s),text:fmt(s)})]))),
    el('div',{class:'panel fade'},[el('div',{class:'ph'},[el('div',{class:'kicker',text:'How you compare'}),el('span',{text:`Daily #${n} · all players`})]),curveBox]),
    el('div',{class:'row fade',style:'justify-content:flex-start;margin:18px 0'},[copyBtn,el('button',{class:'btn',text:'Dashboard',onclick:menu}),el('button',{class:'btn',text:'Practice',onclick:practicePage}),el('button',{class:'btn',text:'Leaderboard',onclick:()=>leaderboardPage(n)})]),
    ...(join?[join]:[]),el('div',{style:'height:16px'}),rankHero(u,fresh?{from:runStartT,kicker:'Rank after this daily'}:{}));
  requestAnimationFrame(()=>requestAnimationFrame(()=>stage.querySelectorAll('.bar i').forEach(i=>i.style.width=i.dataset.w+'%')));
  countUp(totalEl,total,1200);const col=C[{g:'truth',m:'gap',b:'bad'}[grade(avg)]],t0=performance.now();
  loop(t=>{const p=ease((t-t0)/1200);gx.clearRect(0,0,160,160);gx.lineCap='round';gx.lineWidth=8;gx.strokeStyle=C.line;gx.beginPath();gx.arc(80,80,64,0,PI2);gx.stroke();
    gx.save();gx.shadowColor=col;gx.shadowBlur=16;gx.strokeStyle=col;gx.beginPath();gx.arc(80,80,64,-Math.PI/2,-Math.PI/2+PI2*(total/500)*p+.0001);gx.stroke();gx.restore();txt(gx,Math.round(avg*p)+'%',80,80,C.muted,`600 13px ${MONO}`);});
  if(!window.Cloud){curveBox.innerHTML='';curveBox.append(el('div',{class:'empty',text:'Offline: comparison unavailable.'}));return;}
  Cloud.dailyScores(n).then(list=>{let tot=list.map(q=>q.total);const mine=CLOUD&&list.some(q=>q.id===CLOUD.uid);if(!mine)tot.push(total);
    const below=tot.filter(v=>v<total).length,eq=tot.filter(v=>v===total).length,pct=(below+eq*.5)/tot.length*100;pctTop=Math.max(1,Math.round(100-pct));
    if(!d.arch)pctEl.innerHTML=tot.length>1?`Better than <b>${pct.toFixed(0)}%</b> of ${tot.length} players · top <b>${pctTop}%</b>`:'You are the first to finish today 🎉';
    else pctEl.innerHTML=`Archive play · would place top <b>${pctTop}%</b> of ${tot.length}`;
    curveBox.innerHTML='';curveBox.append(curve(tot,total));}).catch(e=>{console.warn(e);curveBox.innerHTML='';curveBox.append(el('div',{class:'empty',text:'Could not load other scores.'}));});}
function curve(vals,mine){const W=720,H=230,[c,x]=makeCanvas(W,H);c.style.maxWidth='none';c.style.border='none';c.style.boxShadow='none';
  const L=24,Rr=W-24,T=24,B=H-34,X=v=>L+v/500*(Rr-L),bw=Math.max(14,30-Math.log2(vals.length+1)*2),sd=vals.length>1?Math.sqrt(vals.reduce((s,v)=>s+(v-vals.reduce((a,b)=>a+b)/vals.length)**2,0)/vals.length):40,h=Math.max(12,1.06*sd*vals.length**-.2);
  const dens=[];for(let k=0;k<=200;k++){const v=k*2.5;dens.push(vals.reduce((s,q)=>s+Math.exp(-.5*((v-q)/h)**2),0));}const mx=Math.max(...dens,1e-9),t0=performance.now();
  const bins=Array(20).fill(0);vals.forEach(v=>bins[Math.min(19,Math.floor(v/25))]++);const bm=Math.max(...bins,1);
  loop(now=>{const p=ease((now-t0)/900);x.clearRect(0,0,W,H);
    bins.forEach((b,k)=>{const hh=(B-T)*b/bm*.85*p;x.fillStyle='rgba(255,255,255,.05)';x.fillRect(X(k*25)+2,B-hh,X(25)-X(0)-4,hh);});
    const ag=x.createLinearGradient(0,T,0,B);ag.addColorStop(0,rgba(C.you,.3));ag.addColorStop(1,rgba(C.you,0));
    x.beginPath();dens.forEach((d,k)=>{const px=X(k*2.5),py=B-(B-T)*d/mx*p;k?x.lineTo(px,py):x.moveTo(px,py);});x.lineTo(Rr,B);x.lineTo(L,B);x.closePath();x.fillStyle=ag;x.fill();
    x.beginPath();dens.forEach((d,k)=>{const px=X(k*2.5),py=B-(B-T)*d/mx*p;k?x.lineTo(px,py):x.moveTo(px,py);});x.strokeStyle=C.you;x.lineWidth=2;x.stroke();
    x.strokeStyle='rgba(255,255,255,.12)';x.beginPath();x.moveTo(L,B+.5);x.lineTo(Rr,B+.5);x.stroke();
    [0,100,200,300,400,500].forEach(v=>txt(x,String(v),X(v),B+16,C.dim,`500 10px ${MONO}`));
    const mxp=X(mine);x.strokeStyle=C.ink;x.setLineDash([4,4]);x.beginPath();x.moveTo(mxp,T-6);x.lineTo(mxp,B);x.stroke();x.setLineDash([]);glowDot(x,mxp,B,5,C.ink,10);chip(x,`You · ${fmt(mine)}`,clamp(mxp,60,W-60),T-8,C.ink);});
  return c;}

// ================= leaderboard =================
let LBTAB='rating';
function leaderboardPage(n){Math.random=RNG0;RUN=null;page('narrow');drawNav();if(typeof n==='number')LBTAB='daily';const N=typeof n==='number'?n:dayNum();
  const tabs=el('div',{class:'chips fade'},[el('button',{class:'chip'+(LBTAB==='rating'?' on':''),text:'Rating',onclick:()=>{LBTAB='rating';leaderboardPage();}}),el('button',{class:'chip'+(LBTAB==='daily'?' on':''),text:`Daily #${N}`,onclick:()=>{LBTAB='daily';leaderboardPage(N);}})]);
  const box=el('div',{class:'tblwrap fade'},[el('div',{class:'empty',text:'Loading…'})]);
  stage.append(el('div',{class:'kicker fade',text:'Leaderboard'}),el('h2',{class:'fade',text:LBTAB==='rating'?'Top players':`Daily #${N}`}),tabs,box);
  if(!signedIn())stage.append(el('div',{class:'panel join fade',style:'margin-top:16px'},[el('div',{},[el('b',{text:'You are playing as a guest'}),el('div',{class:'muted',style:'font-size:13.5px',text:'Create a free account to appear here. Your local progress comes with you.'})]),el('button',{class:'btn primary',text:'Create account',onclick:()=>openAuth('register',{after:()=>leaderboardPage()})})]));
  if(!window.Cloud){box.innerHTML='';box.append(el('div',{class:'empty',text:'Offline.'}));return;}
  const myId=CLOUD&&CLOUD.uid;
  const show=(rows,cols)=>{box.innerHTML='';if(!rows.length){box.append(el('div',{class:'empty',text:'No one here yet. Be the first!'}));return;}
    box.append(el('table',{},[el('thead',{},[el('tr',{},cols.map((h,i)=>el('th',{class:i>1?'n':'',text:h})))]),el('tbody',{},rows)]));};
  if(LBTAB==='rating')Cloud.leaders(100).then(L=>show(L.map((p,i)=>el('tr',{class:p.id===myId?'me':''},[el('td',{class:'mono rk',text:'#'+(i+1)}),el('td',{},[el('span',{class:'lbn'},[badge(p.tier||TIERS[tierIdx(p.rating)]),el('span',{text:p.name})])]),el('td',{class:'n',text:fmt(p.rating)}),el('td',{class:'n',text:p.games})])),['#','Player','Rating','Games'])).catch(e=>{box.innerHTML='';box.append(el('div',{class:'empty',text:'Could not load the leaderboard.'}));console.warn(e);});
  else Cloud.dailyScores(N).then(L=>show(L.slice(0,100).map((p,i)=>el('tr',{class:p.id===myId?'me':''},[el('td',{class:'mono rk',text:'#'+(i+1)}),el('td',{text:p.name}),el('td',{class:'n em',text:(p.s||[]).map(s=>s>=85?'🟩':s>=60?'🟨':'🟥').join('')}),el('td',{class:'n',text:fmt(p.total)})])),['#','Player','Tests','Score'])).catch(e=>{box.innerHTML='';box.append(el('div',{class:'empty',text:'Could not load scores.'}));console.warn(e);});}

// ================= auth =================
function modal(kids){const ov=el('div',{class:'modal'}),card=el('div',{class:'mcard'},kids);ov.append(card);document.body.append(ov);requestAnimationFrame(()=>ov.classList.add('on'));
  const close=()=>{ov.classList.remove('on');setTimeout(()=>ov.remove(),200);};ov.addEventListener('pointerdown',e=>{if(e.target===ov&&!AUTH_BUSY)close();});return {ov,card,close};}
const GLOGO='<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function openAuth(mode='register',o={}){if(!window.Cloud)return toast('Accounts are unavailable offline.');
  let m;const err=el('div',{class:'merr'}),name=el('input',{placeholder:'Username',maxlength:20,autocomplete:'username',value:o.name||'','aria-label':'Username'}),pass=el('input',{type:'password',placeholder:'Password (6+ characters)',autocomplete:mode==='register'?'new-password':'current-password','aria-label':'Password'});
  const busy=(b,btn)=>{AUTH_BUSY=b;m.card.querySelectorAll('button,input').forEach(q=>q.disabled=b);if(btn)btn.classList.toggle('loading',b);};
  const finish=async(user,nm,btn)=>{try{await attachCloud(user,{name:nm});AUTH_BUSY=false;m.close();toast(`Signed in as ${CLOUD.u.name}`);(o.after||menu)();}catch(e){busy(false,btn);err.textContent=Cloud.errMsg(e);}};
  const submit=async e=>{e.preventDefault();err.textContent='';const n=name.value.trim(),p=pass.value;if(!n)return name.focus();if(p.length<6){err.textContent='Password needs at least 6 characters.';return pass.focus();}
    const btn=e.submitter||m.card.querySelector('.btn.primary');busy(true,btn);
    try{const user=mode==='register'?await Cloud.register(n,p):await Cloud.login(n,p);await finish(user,mode==='register'?n:null,btn);}catch(x){busy(false,btn);err.textContent=Cloud.errMsg(x);}};
  const google=async()=>{err.textContent='';busy(true);try{const user=await Cloud.google();await finish(user,null);}catch(x){busy(false);err.textContent=Cloud.errMsg(x);}};
  const tab=(k,t)=>el('button',{type:'button',class:'chip'+(mode===k?' on':''),text:t,onclick:()=>{m.close();openAuth(k,{...o,name:name.value});}});
  m=modal([el('div',{class:'mhead'},[el('div',{class:'mark'}),el('b',{text:mode==='register'?'Create your account':'Welcome back'})]),
    el('div',{class:'chips'},[tab('register','Create account'),tab('login','Sign in')]),
    el('p',{class:'muted',style:'font-size:13.5px;margin:4px 0 14px',text:mode==='register'?(hasLocalData()?`Your ${LOCAL.games.length} games and dailies on this device will move into the account.`:'Just a username and password. No email needed.'):'Sign in with your username, or with Google.'}),
    el('form',{class:'mform',onsubmit:submit},[name,pass,el('button',{class:'btn primary lg',html:mode==='register'?'Create account':'Sign in'})]),
    el('div',{class:'or',text:'or'}),el('button',{class:'btn lg gbtn',html:GLOGO+' Continue with Google',onclick:google}),err]);
  setTimeout(()=>(name.value?pass:name).focus(),60);}
function askUsername(user){return new Promise((res,rej)=>{const err=el('div',{class:'merr'}),inp=el('input',{placeholder:'Username',maxlength:20,value:(LOCAL.name||'').replace(/[^\w.-]/g,'').slice(0,20),'aria-label':'Username'});
  const m=modal([el('div',{class:'mhead'},[el('div',{class:'mark'}),el('b',{text:'Pick a username'})]),el('p',{class:'muted',style:'font-size:13.5px',text:'This is how you appear on the leaderboard. 3–20 letters, numbers, _ . or -'}),
    el('form',{class:'mform',onsubmit:async e=>{e.preventDefault();const n=inp.value.trim();err.textContent='';try{await Cloud.setName(user.uid,n,null);m.close();res(n);}catch(x){err.textContent=Cloud.errMsg(x);}}},[inp,el('button',{class:'btn primary lg',text:'Continue'})]),
    el('button',{class:'linkbtn',text:'Cancel and sign out',onclick:async()=>{m.close();await Cloud.logout();rej({message:'Sign-in cancelled.'});}}),err]);setTimeout(()=>inp.focus(),60);});}
async function attachCloud(user,o={}){AUTH_BUSY=true;
  try{let u=await Cloud.loadProfile(user.uid);
    if(!u){const name=o.name||await askUsername(user);const base=hasLocalData()?JSON.parse(JSON.stringify(LOCAL)):freshProfile();u=fixProfile({...base,name});u.created=u.created||Date.now();
      CLOUD={uid:user.uid,u};await pushCloud();if(hasLocalData())toast('Your local progress was moved into your account.');clearLocal();}
    else{u=fixProfile(u);CLOUD={uid:user.uid,u};
      if(hasLocalData()&&confirm(`Import ${LOCAL.games.length} games and ${Object.keys(LOCAL.daily).length} dailies from this device into ${u.name}?`)){
        u.games=[...u.games,...LOCAL.games].sort((a,b)=>a.t-b.t);u.runs=[...u.runs,...LOCAL.runs].sort((a,b)=>a.t-b.t);for(const k in LOCAL.daily)if(!u.daily[k])u.daily[k]=LOCAL.daily[k];
        if(LOCAL.games.length>u.games.length/2){u.g=LOCAL.g;}u.peak=Math.max(u.peak,LOCAL.peak);await pushCloud();clearLocal();toast('Local progress imported.');}}
    await submitPending();}
  finally{AUTH_BUSY=false;}}

// ================= settings =================
function settingsPage(){Math.random=RNG0;RUN=null;page('narrow');drawNav();const u=me(),R=ratingOf(u),T=tinfo(tierIdx(R));
  const sect=(t,kids)=>[el('div',{class:'kicker sect',text:t}),el('div',{class:'panel fade'},kids)];
  const row=(title,desc,ctl)=>el('div',{class:'toggle'},[el('div',{},[el('b',{text:title}),el('div',{class:'muted',style:'font-size:13px',text:desc})]),ctl]);
  const sw=key=>{const on=()=>u.prefs[key]!==false,b=el('button',{class:'sw2'+(on()?' on':''),'aria-label':key,onclick:()=>{u.prefs[key]=!on();b.classList.toggle('on',on());saveDB();}});return b;};
  const nameInp=el('input',{value:u.name||'',placeholder:signedIn()?'Username':'Name (optional)',maxlength:20,'aria-label':'Name'}),nerr=el('div',{class:'merr'});
  const rename=async e=>{e.preventDefault();const n=nameInp.value.trim();nerr.textContent='';
    if(signedIn()){if(!n||n===u.name)return;try{await Cloud.setName(CLOUD.uid,n,u.name);u.name=n;saveDB();drawNav();toast('Username updated');}catch(x){nerr.textContent=Cloud.errMsg(x);}}
    else{u.name=n;saveDB();drawNav();toast(n?'Name saved':'Name cleared');}};
  const exportIt=()=>{const a=el('a',{href:URL.createObjectURL(new Blob([JSON.stringify(u,null,2)],{type:'application/json'})),download:`perceive-${(u.name||'guest').replace(/\W+/g,'_')}.json`});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);};
  const file=el('input',{type:'file',accept:'application/json,.json',hidden:true});
  file.addEventListener('change',async()=>{const f=file.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d||!d.g||typeof d.g.r!=='number'||!Array.isArray(d.games))throw 0;
    if(LOCAL.games.length&&!confirm('Replace the progress on this device with the imported file?'))return;LOCAL=fixProfile({...freshProfile(),...d});saveDB();drawNav();settingsPage();toast(`Imported ${LOCAL.games.length} games`);}catch(e){alert('That file is not a Perceive profile.');}});
  stage.append(
    el('div',{class:'phead fade',style:`--tc:${placed(u)?T.G.gl:'#8a8a8e'}`},[el('span',{html:placed(u)?emblem(T.i,84):UNR_EMB(84)}),el('div',{},[el('div',{class:'kicker',text:'Settings'}),el('h2',{text:u.name||'Guest'}),
      el('div',{class:'muted mono',style:'font-size:13px',text:`${placed(u)?`${T.name} · ${T.code} · ${R.toFixed(1)}`:`Unranked · placement ${Math.min(PLACE,ratedN(u))}/${PLACE}`} · ${u.games.length} games${signedIn()?' · cloud account':' · saved on this device'}`})])]),
    ...sect('Account',signedIn()?[row(`Signed in as ${u.name}`,'Your progress syncs to the cloud and shows on the leaderboard.',el('button',{class:'btn sm',text:'Sign out',onclick:async()=>{await Cloud.logout();CLOUD=null;LOCAL=loadLocal();toast('Signed out');menu();}}))]
      :[row('Playing as a guest','Progress is stored in this browser only. Create an account to sync it and join the leaderboard. Everything here comes with you.',el('div',{class:'btnrow'},[el('button',{class:'btn sm primary',text:'Create account',onclick:()=>openAuth('register',{after:settingsPage})}),el('button',{class:'btn sm',text:'Sign in',onclick:()=>openAuth('login',{after:settingsPage})})]))]),
    ...sect(signedIn()?'Username':'Display name',[el('form',{class:'field',onsubmit:rename},[nameInp,el('button',{class:'btn',text:signedIn()?'Rename':'Save'})]),nerr]),
    ...sect('Preferences',[row('Sound effects','UI blips. Audio tests always play sound.',sw('sound')),row('Briefings','Show the instructions and demo before each test.',sw('brief'))]),
    ...sect('Data',[row(signedIn()?'Export your data':'Back up your progress',signedIn()?'Download your full history as a file.':'Download your rating and history as a file, or load one back in. Useful for moving between browsers.',
      el('div',{class:'btnrow'},[el('button',{class:'btn sm',text:'Export',onclick:exportIt}),...(signedIn()?[]:[el('button',{class:'btn sm',text:'Import',onclick:()=>file.click()}),file])]))]),
    ...(signedIn()?[]:sect('Danger zone',[row('Reset local data','Wipes the rating, history and dailies stored in this browser. Can\'t be undone.',armBtn('Reset','Click again to reset',()=>{LOCAL=freshProfile();saveDB();drawNav();settingsPage();}))])));}

// ================= misc overrides =================
function radar(u){
  const W=380,H=340,[c,x]=makeCanvas(W,H);c.style.maxWidth=W+'px';c.style.border='none';c.style.boxShadow='none';const cx=W/2,cy=H/2+2,R=108,n=GROUPS.length;
  const vals=GROUPS.map(g=>{const ids=new Set(CH.filter(t=>t.grp===g).map(t=>t.id)),gs=u.games.filter(q=>ids.has(q.id)).slice(-12);return gs.length?gs.reduce((s,q)=>s+q.s,0)/gs.length:null;});
  const P=(i,r)=>{const a=-Math.PI/2+i*PI2/n;return [cx+Math.cos(a)*r,cy+Math.sin(a)*r];},t0=performance.now();
  loop(now=>{const p=ease((now-t0)/900);x.clearRect(0,0,W,H);
    [.25,.5,.75,1].forEach(f=>{x.beginPath();for(let i=0;i<=n;i++){const [a,b]=P(i%n,R*f);i?x.lineTo(a,b):x.moveTo(a,b);}x.strokeStyle=f===1?'rgba(255,255,255,.14)':'rgba(255,255,255,.05)';x.lineWidth=1;x.stroke();});
    for(let i=0;i<n;i++){const [a,b]=P(i,R);x.strokeStyle='rgba(255,255,255,.05)';x.beginPath();x.moveTo(cx,cy);x.lineTo(a,b);x.stroke();
      const [lx,ly]=P(i,R+26),v=vals[i];txt(x,GROUPS[i].toUpperCase(),lx,ly-6,v==null?C.dim:C.muted,`500 9px ${MONO}`);txt(x,v==null?'—':fmt(v),lx,ly+7,v==null?C.dim:C[{g:'truth',m:'gap',b:'bad'}[grade(v)]],`500 10.5px ${MONO}`);}
    x.beginPath();vals.forEach((v,i)=>{const [a,b]=P(i,R*(v||0)/100*p);i?x.lineTo(a,b):x.moveTo(a,b);});x.closePath();
    const fg=x.createRadialGradient(cx,cy,0,cx,cy,R);fg.addColorStop(0,rgba(C.you,.05));fg.addColorStop(1,rgba(C.you,.28));x.fillStyle=fg;x.fill();x.strokeStyle=C.you;x.lineWidth=1.8;x.lineJoin='round';x.stroke();
    vals.forEach((v,i)=>{if(v==null)return;const [a,b]=P(i,R*v/100*p);x.fillStyle='#0d0d0e';x.beginPath();x.arc(a,b,4,0,PI2);x.fill();glowDot(x,a,b,2.6,C.you,6);});});
  return c;}
// ===== auto demos =====
// Every round-engine test gets a real preview: an easy round of the actual test is generated with a fixed seed,
// drawn scaled into the briefing monitor, and "played" by a scripted cursor (watch → answer → reveal).
const stripTags=s=>String(s==null?'':s).replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
function pills(x,labels,cx,Y,o={}){x.save();x.font=`500 12.5px ${SANS}`;const ws=labels.map(l=>x.measureText(l).width+30),gap=8,tot=ws.reduce((a,b)=>a+b,0)+gap*(labels.length-1);
  let X=cx-tot/2;const ctr=[];labels.forEach((l,k)=>{const w=ws[k],on=o.down===k,ok=o.ok===k,bad=o.bad===k,col=ok?C.truth:bad?C.bad:on?C.you:null;
    x.fillStyle=col?rgba(col,.14):'#1b1b1d';x.strokeStyle=col||'rgba(255,255,255,.14)';x.lineWidth=1;x.beginPath();x.roundRect(X,Y-16+(on?1:0),w,32,9);x.fill();x.stroke();
    txt(x,l,X+w/2,Y+(on?1:0),col||C.ink,`500 12.5px ${SANS}`);ctr.push(X+w/2);X+=w+gap;});x.restore();return ctr;}
function autoDemo(ch){const cfg=ch.fn&&ch.fn.cfg;if(!cfg||typeof cfg!=='object')return genericDemo(ch);return()=>{
  const W=cfg.W||640,H=cfg.H||380,save=Math.random;let r;
  Math.random=srand([...ch.id].reduce((a,q)=>(a*31+q.charCodeAt(0))|0,7)); // same preview every time, and never touches the daily's seeded RNG
  try{r=cfg.round(0,cfg.n);}catch(e){console.warn(e);Math.random=save;return genericDemo(ch)();}finally{Math.random=save;}
  const D=r.demo||{},mode=r.mode,gc={W,H},sc0=v=>{try{const q=r.score?r.score(v,1400,{}):(v===r.answer?100:0);return isFinite(q)?q:0;}catch(e){return 0;}};
  const bar=mode==='choice'||mode==='slider'||mode==='number'||mode==='text'||!!D.key,top=38,bot=bar?268:292,s=Math.min(540/W,(bot-top)/H),ox=(560-W*s)/2,oy=top+(bot-top-H*s)/2;
  const toD=(gx,gy)=>[ox+gx*s,oy+gy*s],toG=(dx,dy)=>({x:(dx-ox)/s,y:(dy-oy)/s});
  // pick a near-best answer (scores ~85-96 look human; fall back to the best one)
  const pickNear=(C2,dist)=>{if(!C2.length)return null;const best=C2.reduce((a,b)=>b.s>a.s?b:a);const ok=C2.filter(q=>q.s>=84&&q.s<=96);return ok.length?ok.reduce((a,b)=>dist(b,best)<dist(a,best)?b:a):best;};
  let V=null,tgt=null,from=null,typed='',clicks=[],askMs=1800;
  if(mode==='choice'){V=r.answer;askMs=1900;}
  else if(mode==='click'){const hs=[];for(let y=3;y<H;y+=6)for(let X=3;X<W;X+=6){let k=-1;try{k=r.hit({x:X,y},{});}catch(e){}if(k===r.answer)hs.push([X,y]);}
    if(hs.length){const m=hs.reduce((a,p)=>[a[0]+p[0]/hs.length,a[1]+p[1]/hs.length],[0,0]);tgt=hs.reduce((a,p)=>Math.hypot(p[0]-m[0],p[1]-m[1])<Math.hypot(a[0]-m[0],a[1]-m[1])?p:a);}else tgt=[W/2,H/2];
    V=r.answer;askMs=1500;}
  else if(mode==='aim'){const C2=[];for(let y=4;y<H;y+=8)for(let X=4;X<W;X+=8){const st={};try{r.aim({x:X,y:D.y!=null?D.y:y},st);}catch(e){continue;}if(st.v==null)continue;C2.push({p:[X,D.y!=null?D.y:y],v:st.v,s:sc0(st.v)});}
    const ctr=[W/2,H/2],q=pickNear(C2,(a,b)=>Math.hypot(a.p[0]-b.p[0],a.p[1]-b.p[1])*.2+Math.hypot(a.p[0]-ctr[0],a.p[1]-ctr[1])*.05)||{p:ctr,v:0};
    tgt=q.p;V=q.v;from=[clamp(tgt[0]+(tgt[0]<W/2?70:-70),10,W-10),clamp(tgt[1]+(tgt[1]<H/2?50:-50),10,H-10)];askMs=3000;}
  else if(mode==='slider'){const S2=r.slider,C2=[];for(let v=S2.min;v<=S2.max+1e-9;v+=S2.step||1){const vv=Math.round(v*1000)/1000;C2.push({v:vv,s:sc0(vv)});}V=(pickNear(C2,(a,b)=>Math.abs(a.v-b.v))||{v:S2.init}).v;askMs=3000;}
  else if(mode==='number'){const C2=[];for(let v=0;v<=2000;v++)C2.push({v,s:sc0(v)});V=(pickNear(C2,(a,b)=>Math.abs(a.v-b.v))||{v:0}).v;typed=String(V);askMs=900+typed.length*230+800;}
  else if(mode==='text'){V=D.text||'';typed=V;askMs=900+typed.length*230+800;}
  else if(D.clicks){clicks=D.clicks;V=D.value;askMs=700+clicks.length*480+300;}
  else if(D.tap!=null){V=D.value;askMs=D.tap+120;}
  else if(D.taps){V=D.value;askMs=600+D.taps[D.taps.length-1]+450;}
  else return genericDemo(ch)();
  const showMs=r.show||0,revMs=2400,A=showMs/1000,Ae=A+askMs/1000,P=Ae+revMs/1000+.2;
  const S=(()=>{try{const q=r.score?r.score(V,1400,{}):(V===r.answer?100:0);return isFinite(q)?clamp(q,0,100):0;}catch(e){return 0;}})();
  let label='';try{const st={phase:'reveal',v:V,s:S,ta:0,tr:1400,sel:D.sel||[]};label=r.detail?stripTags(r.detail(V,S,st)):'';}catch(e){}
  if(!label||label.length>46)label=(mode==='choice'||mode==='click'?(S>=50?'Correct':'Wrong')+' · ':'Score · ')+fmt(S);
  const steps=ch.steps.map(stripTags),capTxt=k=>{const q=steps[k-1]||'';return q.length>54?q.slice(0,52)+'…':q;};
  // cursor script, in demo seconds
  const REST=[505,312],K=[[0,...REST,0],[A,...REST,0]];let keyAt=null,slX=null;
  if(mode==='choice'){/* button centers are only known while drawing; resolved lazily below */}
  else if(mode==='click'){const [X,Y]=toD(...tgt);K.push([A+.9,X,Y,0],[A+1.05,X,Y,1],[A+1.2,X,Y,0],[P,X,Y,0]);}
  else if(mode==='aim'){const [fx,fy]=toD(...from),[X,Y]=toD(...tgt);K.push([A+.7,fx,fy,0],[A+.8,fx,fy,1],[A+1.9,X,Y,1],[A+2,X,Y,0],[A+2.4,REST[0],REST[1]-40,0],[P,REST[0],REST[1]-40,0]);keyAt=A+2.6;}
  else if(mode==='slider'){const S2=r.slider,L=100,R=400,xv=v=>L+(v-S2.min)/(S2.max-S2.min)*(R-L),x0=xv(S2.init!=null?S2.init:(S2.min+S2.max)/2),x1=xv(V);slX={L,R,xv,x0,x1};
    K.push([A+.6,x0+3,304,0],[A+.7,x0+3,304,1],[A+2,x1+3,304,1],[A+2.1,x1+3,304,0],[A+2.5,x1+40,322,0],[P,x1+40,322,0]);keyAt=A+2.7;}
  else if(mode==='number'||mode==='text'){K.push([A+.5,250,302,0],[A+.6,250,302,1],[A+.7,250,302,0],[A+1.2,330,322,0],[P,330,322,0]);keyAt=Ae-.45;}
  else if(clicks.length){clicks.forEach((p,j)=>{const [X,Y]=toD(...p),t=A+.7+j*.48;K.push([t-.12,X,Y,0],[t,X,Y,1],[t+.1,X,Y,0]);});K.push([P,K[K.length-1][1],K[K.length-1][2],0]);}
  return {P,draw(x,c,t){const now=performance.now(),ms=t*1000,ph=ms<showMs?'show':t<Ae?'ask':'reveal',ae=Math.max(0,ms-showMs),re=Math.max(0,t-Ae)*1000;
    let Pt=mode==='choice'?null:track(K,t);
    const st={phase:ph,v:null,hover:null,sel:[],p0:now-ms,ta:now-ae,tr:now-re,s:null};
    if(ph==='ask'){if(Pt&&(mode==='click'||mode==='aim'||clicks.length))st.hover=toG(Pt.x,Pt.y);
      if(mode==='aim'&&t>=A+.8){try{r.aim(toG(Pt.x,Pt.y),st);}catch(e){}if(t>=A+2)st.v=V;}
      if(mode==='slider'&&t>=A+.7)st.v=V;
      if(clicks.length)st.sel=(D.sel||[]).slice(0,clicks.filter((_,j)=>t>=A+.7+j*.48).length);
      if(D.taps){const done=D.taps.filter(q=>ae>=600+q);if(done.length)st.taps=done.map(q=>now-(ae-600-q));}}
    if(ph==='reveal'){st.v=V;st.s=S;st.sel=D.sel||[];if(D.taps)st.taps=D.taps.map(q=>now-1e4+q);}
    // the test itself, scaled into the monitor
    x.save();x.beginPath();x.roundRect(ox-6,oy-4,W*s+12,H*s+8,10);x.fillStyle='rgba(8,8,9,.55)';x.fill();x.strokeStyle='rgba(255,255,255,.07)';x.lineWidth=1;x.stroke();x.clip();
    x.translate(ox,oy);x.scale(s,s);try{r.draw(x,gc,mode==='custom'&&D.tap!=null&&ph==='ask'?ae:ms,st);}catch(e){}x.restore();
    // controls under the test
    const Y=bar?300:312;
    if(mode==='choice'&&ph!=='show'){const o=ph==='reveal'?{ok:r.answer}:{};const ctr=pills(x,r.choices.map(stripTags),c.W/2,Y,{...o,down:ph==='ask'&&t>A+1.05&&t<A+1.25?r.answer:-1});
      const bx=ctr[r.answer]||c.W/2;Pt=track([[0,...REST,0],[A,...REST,0],[A+.85,bx+6,Y+6,0],[A+1.05,bx+6,Y+6,1],[A+1.25,bx+6,Y+6,0],[P,bx+6,Y+6,0]],t);}
    else if(mode==='slider'&&ph!=='reveal'){const {L,R,xv,x0,x1}=slX,cur=t<A+.7?x0:t<A+2.1?track(K,t).x-3:x1,vv=r.slider.min+(cur-L)/(R-L)*(r.slider.max-r.slider.min);
      x.fillStyle='rgba(255,255,255,.12)';x.beginPath();x.roundRect(L,Y-2,R-L,4,2);x.fill();x.fillStyle=C.you;x.beginPath();x.roundRect(L,Y-2,cur-L,4,2);x.fill();
      x.fillStyle='#dededb';x.beginPath();x.arc(cur,Y,9,0,PI2);x.fill();
      txt(x,r.slider.fmt?r.slider.fmt(Math.round(vv/(r.slider.step||1))*(r.slider.step||1)):String(Math.round(vv)),R+18,Y,C.ink,`500 13px ${MONO}`,'left');
      if(t>=A+2.2)keycap(x,'ENTER',515,Y,keyAt&&t>keyAt&&t<keyAt+.2,{w:62});}
    else if((mode==='number'||mode==='text')&&ph!=='reveal'){const n=Math.max(0,Math.min(typed.length,Math.floor((t-A-.8)/.23)+1)),sh=t>=A+.8?typed.slice(0,n):'';
      inputBox(x,c.W/2-110,Y-20,180,40,t>=A+.6?C.you:'rgba(255,255,255,.14)');txt(x,sh||'?',c.W/2-20,Y,sh?C.ink:C.dim,`500 ${typed.length>7?16:20}px ${MONO}`);
      keycap(x,'ENTER',c.W/2+120,Y,keyAt&&t>keyAt&&t<keyAt+.2,{w:62});}
    else if(mode==='aim'&&ph==='ask'&&t>=A+2)keycap(x,'ENTER',c.W/2,Y,t>keyAt&&t<keyAt+.2,{w:62});
    else if(D.key&&ph!=='reveal'){const taps=D.taps?D.taps.map(q=>A+(600+q)/1000):[A+D.tap/1000];keycap(x,D.key,c.W/2,Y,ph==='ask'&&taps.some(q=>t>=q&&t<q+.12),{w:120,h:28});}
    if(ph==='reveal'){const g=S>=85?C.truth:S>=60?C.gap:C.bad,p=seg(re/1000,0,.25);x.globalAlpha=p;chip(x,label,c.W/2,mode==='choice'?Y-36:Y,g);x.globalAlpha=1;}
    // captions: 1 = watch / read, 2 = answer, 3 = scoring
    const k=ph==='reveal'?3:ph==='show'||(showMs===0&&ae<700)?1:2;cap(x,k,capTxt(k));
    if(Pt&&!D.key)pointer(x,Pt,seg(t,A-.25,A)*(mode==='click'||mode==='choice'||clicks.length?1-seg(t,P-.35,P-.1):1-seg(t,Ae-.3,Ae)));}};};}
function genericDemo(ch){return()=>{const img=new Image();img.src='data:image/svg+xml,'+encodeURIComponent(iconOf(ch).replace(/currentColor/g,'#ff6b2c').replace('width="34" height="34"','width="200" height="200"'));
  const steps=ch.steps.map(s=>s.replace(/<[^>]+>/g,''));
  return {P:7.5,draw(x,c,t){const k=Math.floor(t/2.5)%3,cx=c.W/2,cy=c.H/2+8;demoStep=k+1;
    for(let r=0;r<3;r++){const q=((t*.5+r/3)%1);x.strokeStyle=rgba(C.you,(1-q)*.35);x.lineWidth=1.5;x.beginPath();x.arc(cx,cy,50+q*110,0,PI2);x.stroke();}
    x.fillStyle='#141416';x.beginPath();x.arc(cx,cy,62,0,PI2);x.fill();x.strokeStyle='rgba(255,255,255,.1)';x.stroke();
    if(img.complete&&img.naturalWidth){const s=70,f=Math.sin(t*2)*3;x.drawImage(img,cx-s/2,cy-s/2+f,s,s);}
    const s=steps[k]||'';cap(x,k+1,s.length>58?s.slice(0,56)+'…':s);}};};}

async function boot(){
  stage.innerHTML='';stage.append(el('div',{class:'empty',style:'padding-top:120px',text:'Loading…'}));
  let tries=0;while(!window.cloudReady&&tries++<40)await new Promise(r=>setTimeout(r,100));
  let user=null;if(window.cloudReady){try{user=await Promise.race([window.cloudReady,new Promise(r=>setTimeout(()=>r(null),6000))]);}catch(e){}}
  if(user){try{await attachCloud(user);}catch(e){console.warn(e);CLOUD=null;}}
  menu();
  window.addEventListener('cloud-auth',async e=>{if(AUTH_BUSY)return;if(e.detail){if(CLOUD&&CLOUD.uid===e.detail.uid)return;try{await attachCloud(e.detail);}catch(x){}}else{if(!CLOUD)return;CLOUD=null;LOCAL=loadLocal();}menu();});
}
document.getElementById('logo').onclick=menu;
boot();
