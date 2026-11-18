/* TOEIC 785 — application hors ligne. Toutes les données restent sur le téléphone (localStorage). */
'use strict';
const L = window.LESSONS || [], VOC = window.VOCAB || [];
const KEY = 'toeic785:v1', PASS = 0.7, NEW_WORDS = 20, REVIEW_WORDS = 20, MASTER = 5, INTERVALS = [0, 1, 2, 4, 7, 14];
const MONTHS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

/* ---------- état ---------- */
function blank(){ return {v:1, start:today(), done:{}, les:{}, voc:{}, custom:[], errs:[], tests:[], vhist:[], recaps:[]}; }
let S = load();
function load(){ try{ const s = JSON.parse(localStorage.getItem(KEY)); if(s && s.v===1) return Object.assign(blank(), s); }catch(e){} return blank(); }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){ note("Impossible d'enregistrer : la mémoire du téléphone est peut-être pleine."); } }
function today(){ const d=new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset()*60000)/86400000); }
function dateOf(i){ return new Date(i*86400000 + new Date().getTimezoneOffset()*60000 + 12*3600000); }
function fmt(i){ const d=dateOf(i); return d.getDate()+' '+MONTHS[d.getMonth()]; }
function esc(t){ return String(t).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function pct(s,n){ return n? Math.round(100*s/n) : 0; }
function need(n){ return Math.ceil(PASS*n - 1e-9); }

/* ---------- planning : 1 jour grammaire, 1 jour vocabulaire, le dimanche récap ---------- */
function dayType(i){
  if(dateOf(i).getDay()===0) return 'recap';
  let k=0; for(let d=S.start; d<i; d++) if(dateOf(d).getDay()!==0) k++;
  return k%2===0 ? 'gram' : 'voc';
}
function missedDays(){
  const t=today(), out=[];
  for(let d=Math.max(S.start, t-14); d<t; d++){ if(!S.done[d]) out.push(d); }
  return out;
}
function markDone(day, type){ if(day==null) return; if(!S.done[day]) S.done[day] = {type, at:today()}; save(); }
function status(){ const m=missedDays().length; return m===0 ? {ok:true, txt:'À jour'} : {ok:false, txt:'En retard de '+m+' jour'+(m>1?'s':'')}; }
function nextLesson(){ return L.find(l=>!(S.les[l.id] && S.les[l.id].ok)) || null; }
function allValidated(){ return L.length>0 && L.every(l=>S.les[l.id] && S.les[l.id].ok); }
const TYPE_TXT = {gram:'Grammaire', voc:'Vocabulaire', recap:'Récap du dimanche'};

/* ---------- vocabulaire ---------- */
function head(en){ return en.split(/\s*[\(\/,]|\s+→/)[0].trim(); }
function vkey(en){ return norm(head(en)).replace(/\s+/g,' '); }
function allWords(){
  const seen=new Set(), out=[];
  for(const w of S.custom.concat(VOC)){ const k=vkey(w.en); if(!k||seen.has(k)) continue; seen.add(k); out.push(Object.assign({k}, w)); }
  // les mots perso (fichier de Lenny + ajouts) d'abord, puis la liste TOEIC
  const rank = w => w.src==='toeic' ? 1 : 0;
  return out.sort((a,b)=>rank(a)-rank(b));
}
function norm(t){
  t = String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’']/g,"'")
    .replace(/\(.*?\)/g,' ').replace(/[^a-z' -]/g,' ').replace(/\s+/g,' ').trim();
  let p; do{ p=t; t=t.replace(/^(le|la|les|un|une|des|du|de|se|faire|etre|to) /,'').replace(/^(l'|s'|d')/,'').trim(); }while(t!==p);
  return t;
}
function variants(fr){ return fr.replace(/\(.*?\)/g,' ').split(/[,;\/]| ou /).map(norm).filter(Boolean); }
function lev(a,b){ const m=[...Array(b.length+1).keys()]; for(let i=1;i<=a.length;i++){ let prev=m[0]; m[0]=i;
  for(let j=1;j<=b.length;j++){ const t=m[j]; m[j]=Math.min(m[j]+1,m[j-1]+1,prev+(a[i-1]===b[j-1]?0:1)); prev=t; } } return m[b.length]; }
function isRight(ans, fr){
  const a=norm(ans); if(!a) return false;
  return variants(fr).some(v=>{
    if(a===v) return true;
    const tol = v.length>=9 ? 2 : (v.length>=5 ? 1 : 0);
    if(lev(a,v)<=tol) return true;
    if(a.length>=6 && v.startsWith(a)) return true;
    if(a.length>=4 && (v.split(' ').includes(a) || (v.length>=4 && a.split(' ').includes(v)))) return true;
    return false;
  });
}
function vp(k){ return S.voc[k]; }
function vocabCounts(){
  const t=today(), W=allWords(); let master=0, wrong=0, due=0, fresh=0;
  for(const w of W){ const p=vp(w.k); if(!p){fresh++; continue;} if(p.b>=MASTER) master++; else if(p.b===0) wrong++; else if(p.due<=t) due++; }
  return {total:W.length, master, wrong, due, fresh};
}
function pickVocab(mode){
  const t=today(), W=allWords();
  const wrong=W.filter(w=>vp(w.k) && vp(w.k).b===0).sort((a,b)=>vp(b.k).ko-vp(a.k).ko);
  if(mode==='errors') return wrong.slice(0, 40);
  const due=W.filter(w=>vp(w.k) && vp(w.k).b>0 && vp(w.k).b<MASTER && vp(w.k).due<=t).sort((a,b)=>vp(a.k).due-vp(b.k).due);
  const fresh=W.filter(w=>!vp(w.k));
  const rev=wrong.concat(due).slice(0, REVIEW_WORDS);
  let list=rev.concat(fresh.slice(0, NEW_WORDS + (REVIEW_WORDS-rev.length)));
  const N=NEW_WORDS+REVIEW_WORDS;
  if(list.length<N){ const rest=W.filter(w=>vp(w.k) && !list.includes(w)).sort((a,b)=>vp(a.k).due-vp(b.k).due); list=list.concat(rest.slice(0,N-list.length)); }
  return list;
}
function recordWord(w, ok){
  const p = vp(w.k) || {b:0, due:today(), ok:0, ko:0};
  if(ok){ p.ok++; p.b=Math.min(MASTER,p.b+1); } else { p.ko++; p.b=0; }
  p.due = today()+INTERVALS[p.b]; S.voc[w.k]=p;
  if(!ok) logErr({kind:'v', en:w.en, fr:w.fr});
  save();
}
function logErr(e){ e.d=today(); S.errs.push(e); if(S.errs.length>600) S.errs=S.errs.slice(-600); }

/* ---------- navigation ---------- */
let TAB='home', SUB=null, CTX={};
const V = () => document.getElementById('view');
function go(tab){ TAB=tab; SUB=null; CTX={}; render(); window.scrollTo(0,0); }
function open(sub, ctx){ SUB=sub; CTX=ctx||{}; render(); window.scrollTo(0,0); }
function render(){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on', b.dataset.tab===TAB));
  document.querySelector('nav').classList.toggle('hide', !!(SUB && ['quiz','vsession'].includes(SUB)));
  const f = SUB ? SUBS[SUB] : TABS[TAB];
  V().innerHTML = f();
  const inp=document.getElementById('vans'); if(inp && !CTX.answered) setTimeout(()=>inp.focus(), 50);
}
const I = {
  book:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M9 7h6"/></svg>',
  words:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15l2.5-6 2.5 6M7.8 13h3.4M15 9v6M15 12h3"/></svg>',
  loop:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/></svg>',
  check:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  lock:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  arrow:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};
const back = (label, fn) => `<button class="back" onclick="${fn}">← ${esc(label)}</button>`;

/* ---------- onglet Aujourd'hui ---------- */
function todayCard(type, day, late){
  const when = late ? (day===today()-1 ? 'Hier' : day===today()-2 ? 'Avant-hier' : DAYS[dateOf(day).getDay()]+' '+fmt(day)) : '';
  if(type==='gram'){
    const l=nextLesson();
    if(!l && !allValidated()) return '';
    if(!l){ // parcours fini : révision générale
      return card(late, `${late?when+' · ':''}Révision générale`, '16 questions de toutes les leçons, tes points faibles en premier', 'b', I.loop,
        `startGeneral(${day})`, late ? 'Rattraper' : 'Commencer');
    }
    const st=S.les[l.id], sub = st && st.att.length ? `Dernier essai : ${st.att.at(-1).s}/${st.att.at(-1).n} (${pct(st.att.at(-1).s,st.att.at(-1).n)} %) · pas encore validée` : 'Cours + quiz · 15 min';
    return card(late, `${late?when+' · ':''}Leçon ${l.id} · ${l.title}`, sub, 'b', I.book, `open('lesson',{id:${l.id},day:${day}})`, late ? 'Rattraper' : 'Commencer la leçon');
  }
  if(type==='voc') return card(late, `${late?when+' · ':''}Vocabulaire · 40 mots`, '20 nouveaux + 20 à revoir', 'o', I.words, `startVocab('daily',${day})`, late ? 'Rattraper' : 'Commencer');
  return card(late, `${late?when+' · ':''}Récap du dimanche`, 'Les règles vues + 15 questions qui mélangent tout · 30 min', 'g', I.loop, `open('recapintro',{day:${day}})`, late ? 'Rattraper' : 'Commencer le récap');
}
function card(compact, title, sub, color, icon, action, cta){
  if(compact) return `<div class="card"><div class="row"><div class="ic ${color}">${icon}</div><div class="grow"><div class="t">${esc(title)}</div><div class="small">${esc(sub)}</div></div>
    <button class="link" onclick="${action}">${cta}</button></div></div>`;
  return `<div class="card"><div class="label">${color==='o'?'Vocabulaire du jour':color==='g'?'Récap du jour':'Leçon du jour'}</div>
    <div class="row"><div class="ic ${color}">${icon}</div><div class="grow"><div class="t" style="font-size:17px">${esc(title)}</div><div class="small">${esc(sub)}</div></div></div>
    <button onclick="${action}">${cta} ${I.arrow}</button></div>`;
}
const TABS = {};
TABS.home = () => {
  const t=today(), st=status(), type=dayType(t), tom=dayType(t+1), d=dateOf(t);
  let h = `<div class="row" style="align-items:flex-start"><div class="grow"><div class="small">${DAYS[d.getDay()]} ${fmt(t)}</div><h1>Salut Lenny</h1></div>
    <span class="pill ${st.ok?'ok':'late'}">${st.ok?I.check:''}${st.txt}</span></div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><span class="pill acc">Aujourd'hui · ${TYPE_TXT[type]}</span><span class="pill out">Demain · ${TYPE_TXT[tom]}</span></div>`;
  if(S.done[t]) h += `<div class="okbox"><b>Séance du jour faite.</b> <span class="small">Bravo ! Tu peux rattraper un jour en retard ou réviser.</span></div>`;
  else h += todayCard(type, t, false);
  const miss=missedDays().reverse();
  if(miss.length){ h += `<h2>À rattraper</h2>` + miss.slice(0,4).map(dd=>todayCard(dayType(dd), dd, true)).join('');
    if(miss.length>4) h += `<div class="small">… et ${miss.length-4} autre(s) jour(s) plus ancien(s).</div>`; }
  const ok=L.filter(l=>S.les[l.id]&&S.les[l.id].ok).length;
  h += `<div class="card"><div class="row"><span class="label grow">Parcours de grammaire</span><span class="small">${ok} / ${L.length} leçons validées</span></div>
    <div class="bar"><div style="width:${pct(ok,L.length)}%"></div></div>
    <div class="small">${ok<L.length ? 'Quand toutes les leçons sont validées, la révision générale se débloque.' : 'Parcours terminé : les jours de grammaire deviennent des révisions générales.'}</div></div>`;
  return h;
};

/* ---------- onglet Grammaire ---------- */
TABS.gram = () => {
  const nxt=nextLesson(); let h=`<h1>Grammaire</h1><div class="small">${L.length} leçons, une leçon un jour sur deux. Une leçon est validée à 70 %.</div>`;
  const chaps=[...new Set(L.map(l=>l.chap))];
  for(const c of chaps){
    const ls=L.filter(l=>l.chap===c), ok=ls.filter(l=>S.les[l.id]&&S.les[l.id].ok).length;
    h += `<div class="row mt"><h2 class="grow">${esc(c)}</h2><span class="small">${ok} / ${ls.length}</span></div><div class="card" style="padding:6px;gap:2px">`;
    for(const l of ls){
      const st=S.les[l.id], isNow = nxt && l.id===nxt.id, locked = !st && !isNow && nxt && l.id>nxt.id;
      let dot, sub;
      if(st && st.ok){ dot=`<span class="dot ok">${I.check}</span>`; sub=`<span class="small" style="color:var(--ok);font-weight:600">Validée · meilleur ${st.best}/${st.bn} (${pct(st.best,st.bn)} %)</span>`; }
      else if(isNow){ dot=`<span class="dot now">${l.id}</span>`; sub=`<span class="small" style="color:var(--acc);font-weight:700">${st&&st.att.length?'À refaire · dernier '+st.att.at(-1).s+'/'+st.att.at(-1).n:'Prochaine leçon'}</span>`; }
      else if(st){ dot=`<span class="dot ko">${l.id}</span>`; sub=`<span class="small" style="color:var(--ora);font-weight:600">À refaire · dernier ${st.att.at(-1).s}/${st.att.at(-1).n}</span>`; }
      else { dot=`<span class="dot lock">${I.lock}</span>`; sub=`<span class="small">Pas encore débloquée</span>`; }
      h += `<button class="lessonrow ${isNow?'now':''}" ${locked?'disabled':''} onclick="open('lesson',{id:${l.id}})">${dot}<span class="grow"><span style="font-weight:600;display:block">${l.id}. ${esc(l.title)}</span>${sub}</span></button>`;
    }
    h += `</div>`;
  }
  return h;
};

/* ---------- leçon + quiz ---------- */
const SUBS = {};
SUBS.lesson = () => {
  const l=L.find(x=>x.id===CTX.id), st=S.les[l.id];
  let info='';
  if(st && st.att.length){ const a=st.att.at(-1);
    info = `<div class="${st.ok?'okbox':'warn'}" style="font-size:14px"><b>${st.ok?'Leçon validée':'Pas encore validée'}</b> · dernier essai : ${a.s}/${a.n} (${pct(a.s,a.n)} %) le ${fmt(a.d)} · meilleur : ${st.best}/${st.bn} · ${st.att.length} essai(s)</div>`; }
  const n=l.series[0].length;
  return `${back(TAB==='home'?"Aujourd'hui":TAB==='rev'?'Révisions':'Grammaire', "SUB=null;render()")}
    <div class="label">Leçon ${l.id} · ${esc(l.chap)}</div><h1>${esc(l.title)}</h1>${info}
    <div class="lesson">${l.html}</div>
    <div class="card"><div class="label">À retenir</div><ul style="margin:0;padding-left:20px">${l.keep.map(k=>`<li>${k}</li>`).join('')}</ul></div>
    <button onclick="startLessonQuiz(${l.id},${CTX.day==null?'null':CTX.day})">Quiz · ${n} questions ${I.arrow}</button>
    <div class="small center">${need(n)}/${n} (70 %) pour valider la leçon</div>`;
};
function startLessonQuiz(id, day){
  const l=L.find(x=>x.id===id), st=S.les[id], k = st ? st.att.length % l.series.length : 0;
  const qs = l.series[k].map(q=>Object.assign({lesson:id}, q));
  startQuiz({kind:'lesson', id, day, title:`Leçon ${id} · ${l.title}`, qs, serie:k});
}
function startQuiz(ctx){
  ctx.qs = ctx.qs.map(q=>Object.assign({}, q, {order:shuffle(q.o.map((_,i)=>i))}));
  ctx.i=0; ctx.score=0; ctx.answered=false; ctx.pick=null; ctx.wrong=[];
  open('quiz', ctx);
}
SUBS.quiz = () => {
  const c=CTX, q=c.qs[c.i], n=c.qs.length;
  let h = `<div class="row"><span class="small grow">Question ${c.i+1} sur ${n}</span><span class="small" style="color:var(--acc);font-weight:700">Score : ${c.score}/${c.i+(c.answered?1:0)}</span>
    <button class="link" onclick="ask('Arrêter le quiz ? Ce quiz ne sera pas compté.',()=>{SUB=null;render()})">Arrêter</button></div>
    <div class="bar"><div style="width:${pct(c.i+(c.answered?1:0),n)}%"></div></div>
    <div class="small">${esc(c.title)}</div><div class="q">${q.p}</div>`;
  for(const oi of q.order){
    let cls='';
    if(c.answered){ if(oi===0) cls='right'; else if(oi===c.pick) cls='wrong'; }
    h += `<button class="opt ${cls}" ${c.answered?'disabled style="opacity:1"':''} onclick="answer(${oi})"><span>${esc(q.o[oi])}</span>${cls==='right'?I.check:cls==='wrong'?'✕':''}</button>`;
  }
  if(c.answered){
    h += `<div class="expl"><b style="color:${c.pick===0?'var(--ok)':'var(--ko)'}">${c.pick===0?'Correct':'Réponse : '+esc(q.o[0])}</b><br>${q.e}</div>
      <button onclick="nextQ()">${c.i+1<n?'Question suivante':'Voir mon score'} ${I.arrow}</button>`;
  }
  return h;
};
function answer(oi){
  const c=CTX; if(c.answered) return; c.answered=true; c.pick=oi;
  const q=c.qs[c.i];
  if(oi===0) c.score++; else { c.wrong.push(q); logErr({kind:'g', lesson:q.lesson, p:q.p, ans:q.o[oi], good:q.o[0]}); save(); }
  render();
}
function nextQ(){ const c=CTX; if(c.i+1<c.qs.length){ c.i++; c.answered=false; c.pick=null; render(); window.scrollTo(0,0); } else finishQuiz(); }
function finishQuiz(){
  const c=CTX, n=c.qs.length, s=c.score, ok = s>=need(n);
  if(c.kind==='lesson'){
    const st = S.les[c.id] || {att:[], best:0, bn:n, ok:false};
    st.att.push({d:today(), s, n, serie:c.serie});
    if(pct(s,n) >= pct(st.best, st.bn) ) { st.best=s; st.bn=n; }
    if(ok) st.ok=true;
    S.les[c.id]=st;
    markDone(c.day!=null ? c.day : (dayType(today())==='gram' && !S.done[today()] ? today() : null), 'gram');
  } else if(c.kind==='general'){ markDone(c.day, 'gram'); }
  else if(c.kind==='recap'){ S.recaps.push({d:today(), s, n}); markDone(c.day, 'recap'); }
  save();
  open('result', {kind:c.kind, id:c.id, s, n, ok, wrong:c.wrong, title:c.title});
}
SUBS.result = () => {
  const c=CTX, l = c.kind==='lesson' ? L.find(x=>x.id===c.id) : null;
  let msg;
  if(c.kind==='lesson') msg = c.ok ? 'Leçon validée ! La suivante sera ta prochaine leçon de grammaire.' : `Pas encore validée : il faut ${need(c.n)}/${c.n}. Relis la leçon, puis refais le quiz : tu auras des questions différentes.`;
  else msg = c.ok ? 'Bien joué !' : 'Relis les règles des questions ratées ci-dessous.';
  let h = `<div class="label">${esc(c.title)}</div><div class="${c.ok?'okbox':'warn'}"><div class="big">${c.s}/${c.n} <span style="font-size:20px">· ${pct(c.s,c.n)} %</span></div><div>${msg}</div></div>`;
  if(c.wrong.length) h += `<h2>À retenir de tes erreurs</h2>` + c.wrong.map(q=>`<div class="card" style="gap:4px"><div>${q.p}</div><div style="color:var(--ok);font-weight:700">${esc(q.o[0])}</div><div class="small">${q.e}</div></div>`).join('');
  if(l && !c.ok) h += `<button onclick="open('lesson',{id:${l.id}})">Relire la leçon</button><button class="sec" onclick="startLessonQuiz(${l.id},null)">Refaire le quiz</button>`;
  h += `<button class="${l&&!c.ok?'link':''}" onclick="go('home')">Retour à l'accueil</button>`;
  return h;
};

/* ---------- révisions : générale, erreurs, récap ---------- */
function weightedPool(ids){
  const errCount={}; S.errs.forEach(e=>{ if(e.kind==='g') errCount[e.lesson]=(errCount[e.lesson]||0)+1; });
  const pool=[];
  for(const l of L.filter(l=>ids.includes(l.id))){ const w=1+(errCount[l.id]||0); for(const s of l.series) for(const q of s) pool.push({q:Object.assign({lesson:l.id},q), w:w*Math.random()}); }
  return pool.sort((a,b)=>b.w-a.w).map(x=>x.q);
}
function startGeneral(day){ startQuiz({kind:'general', day, title:'Révision générale', qs:weightedPool(L.map(l=>l.id)).slice(0,16)}); }
function startErrors(){
  const seen=new Set(), qs=[];
  for(const e of S.errs.slice().reverse()){ if(e.kind!=='g') continue; const l=L.find(x=>x.id===e.lesson); if(!l) continue;
    for(const s of l.series) for(const q of s) if(q.p===e.p && !seen.has(q.p)){ seen.add(q.p); qs.push(Object.assign({lesson:l.id},q)); } }
  if(!qs.length){ note('Aucune erreur de grammaire enregistrée pour l\'instant.'); return; }
  startQuiz({kind:'errors', title:'Mes erreurs de grammaire', qs:qs.slice(0,10)});
}
function validatedIds(){ return L.filter(l=>S.les[l.id]&&S.les[l.id].att.length).map(l=>l.id); }
SUBS.recapintro = () => {
  const ids=validatedIds();
  if(!ids.length) return `${back("Aujourd'hui","SUB=null;render()")}<h1>Récap du dimanche</h1><div class="warn">Tu n'as encore fait aucune leçon : le récap reprendra les leçons dès que tu en auras fait.</div>
    <button onclick="markDone(${CTX.day},'recap');go('home')">Marquer ce récap comme fait</button>`;
  const ls=L.filter(l=>ids.includes(l.id));
  return `${back("Aujourd'hui","SUB=null;render()")}<div class="label">30 à 40 minutes</div><h1>Récap du dimanche</h1>
    <div class="small">1. Relis chaque règle et invente une phrase d'exemple à voix haute (10 min). 2. Revois tes mots ratés dans l'onglet Vocabulaire (5 min). 3. Fais le quiz de 15 questions (20 min).</div>
    ${ls.map(l=>`<div class="card" style="gap:6px"><div class="t">${l.id}. ${esc(l.title)}</div><ul style="margin:0;padding-left:20px;font-size:15px">${l.keep.map(k=>`<li>${k}</li>`).join('')}</ul></div>`).join('')}
    <button onclick="startQuiz({kind:'recap',day:${CTX.day},title:'Récap du dimanche',qs:weightedPool(validatedIds()).slice(0,15)})">Quiz récap · 15 questions ${I.arrow}</button>`;
};
TABS.rev = () => {
  const t=today(); let h=`<h1>Révisions</h1>`;
  h += `<div class="card"><div class="label">Récap du dimanche</div><div class="t">Les règles vues + 15 questions · 30 à 40 min</div>
    <div class="small">${S.recaps.length?'Dernier récap : '+S.recaps.at(-1).s+'/'+S.recaps.at(-1).n+' le '+fmt(S.recaps.at(-1).d):'Pas encore fait.'}</div>
    <button class="sec" onclick="open('recapintro',{day:${dayType(t)==='recap'?t:'null'}})">Faire un récap maintenant</button></div>`;
  const done=L.filter(l=>S.les[l.id]&&S.les[l.id].att.length);
  h += `<div class="card"><div class="row"><span class="label grow">Mes leçons</span><span class="small">validée à 70 %</span></div>`;
  if(!done.length) h += `<div class="small">Les leçons que tu fais apparaîtront ici, avec ton score.</div>`;
  else h += `<div class="list">` + done.map(l=>{ const st=S.les[l.id], a=st.att.at(-1);
    return `<div><div class="grow"><div style="font-weight:600">${l.id}. ${esc(l.title)}</div><div class="small">Meilleur ${st.best}/${st.bn} (${pct(st.best,st.bn)} %) · dernier ${a.s}/${a.n} le ${fmt(a.d)}</div></div>
      <span class="pill ${st.ok?'ok':'late'}" style="font-size:12px">${st.ok?'Validée':'À refaire'}</span><button class="link" onclick="open('lesson',{id:${l.id}})">Refaire</button></div>`; }).join('') + `</div>`;
  h += `</div>`;
  const ec={}; S.errs.forEach(e=>{ if(e.kind==='g') ec[e.lesson]=(ec[e.lesson]||0)+1; });
  const weak=Object.entries(ec).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const vweak=allWords().filter(w=>vp(w.k)&&vp(w.k).b===0).slice(0,4);
  h += `<div class="card"><div class="label" style="color:var(--ora)">Tes points faibles</div>`;
  if(!weak.length && !vweak.length) h += `<div class="small">Rien pour l'instant : ils se calculent à partir de tes erreurs.</div>`;
  h += weak.map(([id,n])=>{ const l=L.find(x=>x.id==id); return l?`<div class="row"><span class="grow">${esc(l.title)}</span><span class="small" style="color:var(--ko);font-weight:700">${n} erreur${n>1?'s':''}</span></div>`:''; }).join('');
  if(vweak.length) h += `<div class="row"><span class="grow">Mots : ${vweak.map(w=>esc(head(w.en))).join(', ')}</span></div>`;
  h += `<button class="sec" onclick="startErrors()">Réviser mes erreurs de grammaire</button><button class="sec" onclick="startVocab('errors',null)">Revoir mes mots ratés</button></div>`;
  const all=allValidated();
  h += `<div class="card" style="${all?'':'background:#F7F8FA'}"><div class="row">${all?'':I.lock}<span class="t">Révision générale</span></div>
    <div class="small">${all?'Chaque jour de grammaire devient une révision de 16 questions mêlant toutes les leçons, tes points faibles en premier.':'Se débloque quand les '+L.length+' leçons sont validées.'}</div>
    ${all?`<button onclick="startGeneral(null)">Lancer une révision générale</button>`:`<div class="bar"><div style="width:${pct(L.filter(l=>S.les[l.id]&&S.les[l.id].ok).length,L.length)}%;background:var(--mut)"></div></div>`}</div>`;
  return h;
};

/* ---------- vocabulaire ---------- */
TABS.voc = () => {
  const c=vocabCounts();
  return `<h1>Vocabulaire</h1>
   <div class="grid3"><div class="stat"><b style="color:var(--ok)">${c.master}</b><span class="small">acquis</span></div><div class="stat"><b style="color:var(--ora)">${c.wrong}</b><span class="small">ratés</span></div><div class="stat"><b style="color:var(--acc)">${c.fresh}</b><span class="small">jamais vus</span></div></div>
   <div class="card"><div class="label">Séance de 40 mots</div><div class="small">20 mots nouveaux + 20 à revoir : d'abord tes mots ratés, puis tes anciens mots justes dont la date de révision est arrivée (1, 2, 4, 7 puis 14 jours). Au bout de 5 bonnes réponses d'affilée, un mot est acquis.</div>
   <div class="small">Aujourd'hui : ${Math.min(c.wrong+c.due,REVIEW_WORDS)} mot(s) à revoir disponibles sur ${c.total}.</div>
   <button onclick="startVocab('daily',${dayType(today())==='voc'&&!S.done[today()]?today():'null'})">Commencer une séance ${I.arrow}</button></div>
   <div class="grid2"><button class="sec" onclick="startVocab('errors',null)">Mots ratés</button><button class="sec" onclick="open('addword')">+ Ajouter un mot</button></div>
   <button class="link" onclick="open('allwords')">Voir tous les mots et mon niveau</button>`;
};
function startVocab(mode, day){
  const list=pickVocab(mode);
  if(!list.length){ note(mode==='errors'?'Aucun mot raté : bravo !':'Aucun mot disponible.'); return; }
  open('vsession', {mode, day, queue:shuffle(list).map(w=>({w, retry:false})), pos:0, right:0, total:list.length, missed:[], answered:false});
}
SUBS.vsession = () => {
  const c=CTX, it=c.queue[c.pos], w=it.w, p=vp(w.k), hd=head(w.en);
  return `<div class="row"><span class="small grow">${it.retry?'2e chance · mot raté plus tôt':'Mot '+(c.pos+1)+' sur '+c.total}</span>
     <button class="link" onclick="ask('Arrêter ? Les réponses déjà données sont gardées.',()=>{SUB=null;render()})">Arrêter</button></div>
   <div class="bar"><div style="width:${pct(c.pos,c.queue.length)}%"></div></div>
   <div class="card"><div class="small">${p? 'Niveau '+p.b+'/'+MASTER+' · '+p.ok+' juste(s), '+p.ko+' erreur(s)' : 'Nouveau mot'}</div>
     <div class="big">${esc(hd)}</div>${w.en!==hd?`<div class="small">${esc(w.en)}</div>`:''}
     <label for="vans" class="small" style="font-weight:600">Ta traduction en français</label>
     <input id="vans" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" class="${c.answered?(c.ok?'ok':'ko'):''}" value="${esc(c.ans||'')}" ${c.answered?'disabled':''}
       onkeydown="if(event.key==='Enter'){event.preventDefault();vsubmit()}">
     ${c.answered?`<div><b style="color:${c.ok?'var(--ok)':'var(--ko)'}">${c.ok?'Correct':'Pas tout à fait'}</b> · <b>${esc(w.en)}</b> = ${esc(w.fr)}</div>
       ${!c.ok?`<button class="link" onclick="voverride()">En fait j'avais bon</button>`:''}`:''}
   </div>
   <button onclick="vsubmit()">${c.answered?'Mot suivant':'Valider'} ${I.arrow}</button>
   <div class="small">Les accents et les petites fautes de frappe sont acceptés.</div>`;
};
function vsubmit(){
  const c=CTX;
  if(c.answered){ c.pos++; c.answered=false; c.ans=''; if(c.pos>=c.queue.length) return vfinish(); return render(); }
  const val=document.getElementById('vans').value; if(!val.trim()) return;
  const it=c.queue[c.pos]; c.ans=val; c.answered=true; c.ok=isRight(val, it.w.fr);
  if(!it.retry){ recordWord(it.w, c.ok); if(c.ok) c.right++; else { c.missed.push(it.w); c.queue.push({w:it.w, retry:true}); } }
  it.ok=c.ok; render();
}
function voverride(){
  const c=CTX, it=c.queue[c.pos]; if(it.ok) return;
  if(!it.retry){ const p=vp(it.w.k); p.ko--; p.ok++; p.b=1; p.due=today()+INTERVALS[1]; S.errs.pop(); save(); c.right++;
    c.missed=c.missed.filter(w=>w!==it.w); c.queue.pop(); }
  it.ok=true; c.ok=true; render();
}
function vfinish(){
  const c=CTX; S.vhist.push({d:today(), s:c.right, n:c.total});
  if(c.mode==='daily') markDone(c.day!=null ? c.day : null, 'voc');
  save(); open('vresult', c);
}
SUBS.vresult = () => {
  const c=CTX;
  return `<div class="label">Vocabulaire</div><div class="${c.right>=need(c.total)?'okbox':'warn'}"><div class="big">${c.right}/${c.total}</div><b>${pct(c.right,c.total)} %</b></div>
   ${c.missed.length?`<h2>Ces mots reviendront en priorité</h2><div class="card list">${c.missed.map(w=>`<div><b>${esc(w.en)}</b><span class="small" style="text-align:right">${esc(w.fr)}</span></div>`).join('')}</div>`:'<div class="small">Aucune erreur, bravo !</div>'}
   <button onclick="go('home')">Retour à l'accueil</button>`;
};
SUBS.addword = () => {
  const c=CTX, k=c.en?vkey(c.en):'', ex = k ? allWords().find(w=>w.k===k) : null;
  return `${back('Vocabulaire',"SUB=null;render()")}<h1>Ajouter un mot</h1>
   <div class="card"><label for="aen" class="small" style="font-weight:600">Le mot en anglais</label>
   <input id="aen" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" value="${esc(c.en||'')}" oninput="CTX.en=this.value;checkDup()">
   <label for="afr" class="small" style="font-weight:600">La traduction en français</label>
   <input id="afr" type="text" autocomplete="off" autocorrect="off" value="${esc(c.fr||'')}" oninput="CTX.fr=this.value"></div>
   <div id="dup">${dupHtml(ex)}</div>
   <button onclick="addWord()">Ajouter</button>
   <div class="small center">Les mots ajoutés passent en priorité parmi les mots nouveaux.</div>
   ${S.custom.length?`<h2>Mes mots ajoutés (${S.custom.length})</h2><div class="card list">${S.custom.slice().reverse().map(w=>`<div><b>${esc(w.en)}</b><span class="small">${esc(w.fr)}</span></div>`).join('')}</div>`:''}`;
};
function dupHtml(ex){
  if(!ex) return '';
  const p=vp(ex.k);
  return `<div class="warn"><b style="color:var(--ora)">Ce mot est déjà dans ta liste</b><span style="font-size:15px">${esc(ex.en)} = ${esc(ex.fr)}</span>
    <span class="small">${p?'Niveau '+p.b+'/'+MASTER+' · '+p.ok+' juste(s), '+p.ko+' erreur(s)':'Pas encore vu'}${ex.src==='toeic'?' · liste TOEIC':ex.src==='perso'?' · ton fichier':' · ajouté par toi'}</span></div>`;
}
function checkDup(){ const k=vkey(CTX.en||''); document.getElementById('dup').innerHTML = dupHtml(k?allWords().find(w=>w.k===k):null); }
function addWord(){
  const en=(CTX.en||'').trim(), fr=(CTX.fr||'').trim();
  if(!en||!fr){ note('Remplis le mot anglais et sa traduction.'); return; }
  const k=vkey(en), ex=allWords().find(w=>w.k===k);
  const done=()=>{ save(); CTX={}; render(); note('Mot enregistré.'); };
  if(ex){ ask(`« ${head(ex.en)} » est déjà dans ta liste (${ex.fr}). Remplacer sa traduction par « ${fr} » ?`, ()=>{
    const i=S.custom.findIndex(w=>vkey(w.en)===k); if(i>=0) S.custom[i].fr=fr; else S.custom.push({en, fr, src:'ajout'}); done(); }); return; }
  S.custom.push({en, fr, src:'ajout'}); done();
}
SUBS.allwords = () => {
  const t=today(), W=allWords();
  return `${back('Vocabulaire',"SUB=null;render()")}<h1>Tous les mots (${W.length})</h1>
   <div class="card list">${W.map(w=>{ const p=vp(w.k); return `<div><div class="grow"><b>${esc(w.en)}</b><div class="small">${esc(w.fr)}</div></div>
     <span class="small" style="white-space:nowrap">${p?(p.b>=MASTER?'acquis':(p.b===0?'raté':'niveau '+p.b)):'—'}</span></div>`; }).join('')}</div>`;
};

/* ---------- progrès ---------- */
TABS.prog = () => {
  const st=status(), c=vocabCounts(), ok=L.filter(l=>S.les[l.id]&&S.les[l.id].ok).length;
  const att=Object.values(S.les).flatMap(x=>x.att), tot=att.reduce((a,x)=>a+x.n,0), good=att.reduce((a,x)=>a+x.s,0);
  const tests=S.tests.slice().sort((a,b)=>a.d-b.d);
  return `<h1>Progrès</h1>
   <div class="grid2"><div class="card"><b style="font-size:24px;color:var(--acc)">${ok} / ${L.length}</b><span class="small">leçons validées</span></div>
   <div class="card"><b style="font-size:24px;color:var(--ok)">${c.master} / ${c.total}</b><span class="small">mots acquis</span></div>
   <div class="card"><b style="font-size:20px;color:${st.ok?'var(--ok)':'var(--ora)'}">${st.txt}</b><span class="small">statut</span></div>
   <div class="card"><b style="font-size:24px">${tot?pct(good,tot)+' %':'—'}</b><span class="small">réussite aux quiz</span></div></div>
   <div class="card"><div class="label">Tests blancs</div><div class="list">
     <div><span>Départ · nov. 2026</span><b>600</b></div>
     ${tests.map((x,i)=>`<div><span>${fmt(x.d)} · L ${x.l} / R ${x.r}</span><b>${x.l+x.r}</b></div>`).join('')}
     <div><span class="small">Objectif</span><b>785</b></div></div>
     <div class="grid2"><input id="tl" type="number" inputmode="numeric" placeholder="Listening" aria-label="Score Listening"><input id="tr" type="number" inputmode="numeric" placeholder="Reading" aria-label="Score Reading"></div>
     <button class="sec" onclick="addTest()">+ Ajouter un score de test blanc</button></div>
   <div class="card"><div class="label" style="color:var(--ora)">Carnet d'erreurs</div><div class="small">Chaque réponse fausse est enregistrée automatiquement.</div>
     <button class="sec" onclick="open('errs')">Voir mes ${S.errs.length} erreurs</button></div>
   <div class="card"><div class="label" style="color:var(--mut)">Sauvegarde</div><div class="small">Tout est enregistré sur ce téléphone. Exporte une copie de temps en temps, par sécurité : le fichier va dans « Fichiers ».</div>
     <button class="sec" onclick="exportData()">Exporter ma progression</button>
     <label class="btn sec" style="background:#fff;color:var(--acc);border:1px solid var(--acc)">Restaurer une sauvegarde<input type="file" accept=".json,application/json" onchange="importData(event)" style="display:none"></label>
     <button class="link" onclick="resetAll()">Tout remettre à zéro</button></div>
   <div class="small center">Commencé le ${fmt(S.start)} · ${L.length} leçons · ${VOC.length} mots intégrés</div>`;
};
function addTest(){
  const l=+document.getElementById('tl').value, r=+document.getElementById('tr').value;
  if(!(l>=5&&l<=495&&r>=5&&r<=495)){ note('Entre deux scores entre 5 et 495.'); return; }
  S.tests.push({d:today(), l, r}); save(); render();
}
SUBS.errs = () => {
  const e=S.errs.slice().reverse();
  return `${back('Progrès',"SUB=null;render()")}<h1>Carnet d'erreurs</h1>
   ${e.length?`<div class="card list">${e.slice(0,200).map(x=> x.kind==='g'
     ? `<div><div class="grow"><div style="font-size:15px">${x.p}</div><div class="small">Ta réponse : <s>${esc(x.ans)}</s> · bonne réponse : <b style="color:var(--ok)">${esc(x.good)}</b> · ${fmt(x.d)}</div></div></div>`
     : `<div><div class="grow"><b>${esc(x.en)}</b> = ${esc(x.fr)}<div class="small">Vocabulaire · ${fmt(x.d)}</div></div></div>`).join('')}</div>`:'<div class="small">Aucune erreur pour l\'instant.</div>'}`;
};
function exportData(){
  const blob=new Blob([JSON.stringify(S)],{type:'application/json'}), a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='toeic785-sauvegarde-'+new Date().toISOString().slice(0,10)+'.json'; document.body.appendChild(a); a.click(); a.remove();
}
function importData(ev){
  const f=ev.target.files[0]; if(!f) return; const r=new FileReader();
  r.onload=()=>{ let d; try{ d=JSON.parse(r.result); if(d.v!==1||!d.les) throw 0; }catch(_){ note('Fichier non reconnu.'); return; }
    ask('Remplacer ta progression actuelle par cette sauvegarde ?', ()=>{ S=Object.assign(blank(), d); save(); go('home'); note('Progression restaurée.'); }); };
  r.readAsText(f);
}
function resetAll(){ ask('Effacer toute ta progression ?', ()=>ask('Vraiment ? C\'est impossible à annuler.', ()=>{ S=blank(); save(); go('home'); })); }

/* ---------- fenêtres de message ---------- */
function modal(msg, btns){
  const o=document.createElement('div'); o.className='modal';
  o.innerHTML=`<div class="box" role="dialog" aria-modal="true"><div>${esc(msg)}</div><div class="grid2"></div></div>`;
  const g=o.querySelector('.grid2'); if(btns.length===1) g.style.gridTemplateColumns='1fr';
  btns.forEach(b=>{ const e=document.createElement('button'); e.textContent=b.t; if(b.sec) e.className='sec'; e.onclick=()=>{ o.remove(); b.fn&&b.fn(); }; g.appendChild(e); });
  document.body.appendChild(o); g.lastChild.focus();
}
function note(msg){ modal(msg,[{t:'OK'}]); }
function ask(msg, yes){ modal(msg,[{t:'Annuler',sec:true},{t:'Oui',fn:yes}]); }

/* ---------- démarrage ---------- */
document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click', ()=>go(b.dataset.tab)));
if(!localStorage.getItem(KEY)) save();
render();
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && !SUB) render(); });
