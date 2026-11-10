/* 魔物篇｜save.js：狀態與存檔：舊存檔補欄位、快照、設定面板、匯出匯入、開新局、啟動（最後載入）。
   所有 .js 共用同一個全域範圍，載入順序見 index.html；改之前先讀 README.md。 */
/* ═════════ 狀態 ═════════ */
let S=null, busy=false, TAB="story", EDIT=false, DRAFT="", TOAST="", RETREAT=false;
/* 舊版存檔補上新欄位 */
function migrate(o){
  if(!o||!Array.isArray(o.log))return null;
  if(o.v===1){
    const d=newGame(o.name||"無名");
    for(const k of ["seg","stage","growth","full","items","corpses","dex","dead"])if(o[k]===undefined)o[k]=d[k];
    o.stage="成體"; o.hpMax=Math.max(o.hpMax||20,20); o.corpses=[];
    o.log.forEach(e=>{if(e.who==="gm"&&!e.alts){e.alts=[{text:e.text,opts:[],loc:null,by:e.by||null}];e.i=0;delete e.text;delete e.by;delete e.fb}
      if(e.who==="gm"&&!e.kind)e.kind="old"});
    const lastGm=[...o.log].reverse().find(e=>e.who==="gm");
    if(lastGm&&!lastGm.alts[lastGm.i].opts.length)lastGm.alts[lastGm.i].opts=o.opts||[];
    o.v=2;
  }
  if(o.v!==2)return null;
  const segH=[6,12,18,22];
  const fixT=x=>{if(x&&x.t==null&&x.day!=null){x.t=x.day*24+segH[x.seg||0];delete x.seg}};
  const fixS=x=>{if(!x)return;if(x.hour==null){x.hour=segH[x.seg||0];x.full=(x.full||0)*6;x.starve=0;delete x.seg}(x.corpses||[]).forEach(fixT)};
  fixS(o); o.log.forEach(e=>{fixS(e.pre);if(e.give&&e.give.corpse)delete e.give.corpse.seg});
  if(o.err)fixS(o.err.pre);
  if(o.err&&!o.err.job)o.err=null;
  for(const [k,v] of [["mat",{}],["gone",[]],["party",[]],["evo",null],["war",null],["sub",null],["evoReady",null],["beaten",[]]])if(o[k]===undefined)o[k]=v;
  if(!o.v025){o=renameDeep(o);o.v025=1}
  skillsFix(o); o.v026=1; if(o.err&&o.err.pre)skillsFix(o.err.pre);
  return o;
}
/* 技能整理（讀檔、撤回／重試還原快照、heal 都會跑）：舊式 Lv 技能補字母、缺字母的當主角現在等級、同名去重留等級高的、
   可用超過上限的放回倉庫；v0.26.1 一次性修復：低於主角等級的技能（被舊快照弄出來的 E 級）補成主角等級 */
function skillsFix(o){
  if(!o||!Array.isArray(o.skills))return;
  nestFix(o);
  {const bad=(o.items||[]).filter(x=>/(屍體|屍骸|屍首|尸体)$/.test(x));   // 舊版 OOC 把「○○屍體」當普通物品塞進背包：改成真的屍體
   if(bad.length){o.corpses=o.corpses||[];bad.forEach(x=>{const b=cleanName(String(x).replace(/的?(屍體|屍骸|屍首|尸体)$/,""));
     if(!o.corpses.some(c=>c.name===b&&c.t>=o.day*24+o.hour-24))o.corpses.push({name:b,sp:speciesOf(b,b),lv:"F",t:o.day*24+o.hour,small:false})});
     o.items=o.items.filter(x=>!bad.includes(x))}}
  if(!o.langs){o.langs=["哥布林語"];const add=t=>{const l=langOf(t);if(l&&!o.langs.includes(l))o.langs.push(l)};
    (o.eaten||[]).forEach(e=>add(e.what));(o.party||[]).forEach(p=>add(p.kind))}
  (o.party||[]).forEach(p=>{if(p.xp==null)p.xp=0; if(o.nameEvo&&!p.named)p.ready=true}); if(o.nameEvo)o.nameEvo=false;
  if(o.skills.some(s=>s.sys!=="Unique"&&!s.g))skillsV026(o);
  (o.party||[]).forEach(p=>(p.skills||[]).forEach(s=>{if(!s.g){s.g=p.lv||"F"}delete s.lv}));   // v0.31：同伴技能也改等級字母
  const keep=[], by={};
  o.skills.forEach(s=>{const p=by[s.n];
    if(!p){by[s.n]=s;keep.push(s)}
    else if(s.sys!=="Unique"&&gIdx(s.g)>gIdx(p.g)){keep[keep.indexOf(p)]=s;by[s.n]=s}});
  o.skills=keep;
  if(!o.v0261){o.skills.forEach(s=>{if(s.sys!=="Unique"&&gIdx(s.g)<gIdx(o.lv))s.g=o.lv});o.v0261=1}
  const cap=boxCap(o.lv)[0]; let n=0;
  o.skills.forEach(s=>{if(s.sys==="Unique")return;if((s.box||"act")==="act"){if(++n>cap)s.box="store"}else s.box="store"});
}
/* v0.26：技能拿掉 Lv。等級字母＝存檔時的主角等級；Lv 高的先進可用，其餘進倉庫（超過上限的留在倉庫，到技能頁整合或放棄） */
function skillsV026(o){
  const real=(o.skills||[]).filter(s=>s.sys!=="Unique"&&!s.g);
  const ac=boxCap(o.lv)[0];
  [...real].sort((a,b)=>(b.lv||0)-(a.lv||0)).forEach((s,i)=>{s.box=i<ac?"act":"store"});
  real.forEach(s=>{s.g=o.lv||"F";delete s.lv});
  (o.skills||[]).forEach(s=>{if(s.n==="異香")s.note="可用技能第一次滿格時覺醒。你越強，聞起來越香。"});
}
/* v0.25：「地精」改名「諾姆」。舊存檔裡的地精部落、據點、俘虜、同伴、故事一起換 */
const renameDeep=x=>typeof x==="string"?x.replace(/地精/g,"諾姆"):Array.isArray(x)?x.map(renameDeep):
  x&&typeof x==="object"?Object.fromEntries(Object.entries(x).map(([k,v])=>[k.replace(/地精/g,"諾姆"),renameDeep(v)])):x;
const facRe=k=>(FACTIONS0[k]||{}).re||/$^/;
function fixFac(o){if(o&&o.factions)for(const f of Object.values(o.factions))delete f.re;return o}
/* 存檔放 IndexedDB（空間大）；localStorage 只當備用，放不下就算了。
   啟動時兩邊都讀，用比較新的那份（看 S._at）。SAVE_TXT 是目前存檔的文字。 */
let SAVE_TXT=null;
const IDB={db:null,
  open(){return new Promise(r=>{try{const q=indexedDB.open("mowu",1);q.onupgradeneeded=()=>q.result.createObjectStore("kv");
    q.onsuccess=()=>{IDB.db=q.result;r(IDB.db)};q.onerror=q.onblocked=()=>r(null)}catch(e){r(null)}})},
  req(mode,f){return new Promise(r=>{try{const tx=IDB.db.transaction("kv",mode),q=f(tx.objectStore("kv"));
    tx.oncomplete=()=>r(mode==="readonly"?q.result:true);tx.onerror=tx.onabort=()=>r(mode==="readonly"?null:false)}catch(e){r(mode==="readonly"?null:false)}})},
  get(k){return IDB.req("readonly",s=>s.get(k))},
  put(k,v){return IDB.req("readwrite",s=>s.put(v,k))},
  del(k){return IDB.req("readwrite",s=>s.delete(k))}};
async function bootSave(){
  await IDB.open();
  try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}   // 請瀏覽器別自動清掉
  const a=IDB.db?await IDB.get(SAVE_KEY):null, b=ls.g(SAVE_KEY)||ls.g("mowu_save_v1");
  const at=t=>{try{return JSON.parse(t)._at||0}catch(e){return -1}};
  SAVE_TXT=!a?b:!b?a:(at(b)>at(a)?b:a);
}
function load(){try{const t=SAVE_TXT;if(!t)return null;return fixFac(migrate(JSON.parse(t)))}catch(e){return null}}
/* 撤回、重寫只用得到最後幾段的快照；更早的快照拿掉，存檔才不會超過瀏覽器的 5MB 上限 */
function prunePre(){if(!S||!S.log)return;const L=S.log,k=L.length-12;for(let i=0;i<k;i++)if(L[i].pre)delete L[i].pre}
function save(){prunePre();
  const fail=()=>{S.saveFail=true;TOAST="⚠ 存檔失敗（瀏覽器空間不夠）。請先到 ⚙ 匯出存檔備份。"};
  let t; try{if(S){S._at=Date.now();S.saveFail=false}t=JSON.stringify(S)}catch(e){console.warn(e);fail();return}
  SAVE_TXT=t;
  let lsOK=true; try{localStorage.setItem(SAVE_KEY,t)}catch(e){lsOK=false}
  if(IDB.db)IDB.put(SAVE_KEY,t).then(ok=>{
    if(ok&&!lsOK)ls.d(SAVE_KEY);            // 備用那份放不下又是舊的：清掉，留空間給金鑰等設定
    if(!ok&&!lsOK&&S){fail();render()}});
  else if(!lsOK)fail();
}
/* 存檔停在「玩家送出、模型還沒回」：補一個「再試一次」 */
function heal(){
  if(!S)return;
  if(S.evo&&S.exist<existMax(S.lv))S.evo=null;
  if(!S.gone)S.gone=[];
  if(!Array.isArray(S.usedSk))S.usedSk=[];
  skillsFix(S);
  S.skills.forEach(s=>{if(s.n==="異香"&&/Lv/.test(s.note||""))s.note="可用技能第一次滿格時覺醒。你越強，聞起來越香。"});   // 舊存檔的異香說明還寫 Lv3
  if(S.heat==null){S.heat=0;S.heatDay=S.day}
  if(!S.v023){S.v023=1;                                   // v0.23：注目度門檻提高；灌水造成、還沒開打的討伐取消；同伴同行人數修正
    if(S.raid&&!S.raid.on&&!S.raid.now&&S.heat<HEAT[3].at){S.raid=null;S.raidCool=S.day+5}
    if(S.party.filter(p=>p.with).length>2)S.party.forEach((p,i)=>p.with=i<2&&p.with);
    S.party.forEach(p=>{if(!p.hold)p.hold=[]}); nestSync()}
  chapCheck(null);
  Object.keys(S.world||{}).forEach(n=>{const x=S.world[n];if(x.st!=null||!isSettle(n))return;      // 舊存檔：聚落態度照住在那裡的人推
    const rs=S.npcs.filter(y=>y.where===n).map(relOf); x.st=rs.length?Math.max(-1,Math.min(2,Math.max(...rs))):-1; if(x.grudge)x.st=Math.max(-2,x.st-1)});
  S.npcs.forEach(x=>{if(x.where==null&&/黑顎|疤臉|石牙|小眼/.test(x.n))x.where="灰岩洞"});
  if(S.nest.food==null){S.nest.food=0;S.nest.fed=0}
  if(!S.factions){                                   // 舊存檔：照打倒過的數量扣
    S.factions=fixFac({factions:JSON.parse(JSON.stringify(FACTIONS0))}).factions; const party=new Set(S.party.map(x=>x.n));
    S.log.forEach(e=>{if(e.who==="gm"&&e.alts){const d=e.alts[e.i].defeated;if(d&&!party.has(d.name))for(const [k,f] of Object.entries(S.factions))if(facRe(k).test(d.name+(d.kind||"")))f.n=Math.max(0,f.n-1)}});
    for(const [k,f] of Object.entries(S.factions))if(f.n<=0&&f.tag)S.nest.tags=S.nest.tags.filter(t=>t.t!==f.tag);
  }
  for(const [k,f] of Object.entries(FACTIONS0))if(!S.factions[k])S.factions[k]={n:f.n,max:f.max,tag:f.tag};
  fixFac(S);
  if(!S.world){
    S.world=worldInit();
    for(const r of REGIONS){const n=r.n==="灰岩洞周邊"?"灰岩洞":r.n;if(S.world[n])S.world[n].known=true}   // 舊存檔：地區都去過了
    (S.places||[]).forEach(p=>{const rn=p.region==="灰岩洞周邊"?"灰岩洞":p.region;addNode({name:p.n,kind:p.kind,note:p.note},S.world[rn]?rn:"灰岩洞",2,null)});
    S.at=nodeByLoc(S.loc)||(S.region==="灰岩洞周邊"?"灰岩洞":S.world[S.region]?S.region:"灰岩洞");
  }
  delete S.places; delete S.region;
  {const w=S.world, d=w["矮人聚落"];
   if(d&&!d.custom&&!d.links["廢棄礦坑"]){for(const k of Object.keys(d.links))if(w[k]&&!w[k].custom&&k!=="灰岩洞")delete w[k].links["矮人聚落"],delete d.links[k];
     d.links["廢棄礦坑"]=1;w["廢棄礦坑"].links["矮人聚落"]=1;d.region="廢棄礦坑";if(/依山壁/.test(d.note)&&!/礦坑/.test(d.note))d.note="廢棄礦坑旁邊、"+d.note}
   S.log.forEach(e=>{if(e.who==="gm"&&e.alts){const l=e.alts[e.i].loc||"";for(const n of Object.keys(w))if(!w[n].known&&l.includes(n)){w[n].known=true;if(w[n].kind!=="地區"&&!Object.keys(w[n].links).some(k=>w[k].known)){const nb=Object.keys(w[n].links)[0];if(nb)w[nb].known=true}}}});
   S.npcs.forEach(x=>{if(x.where&&w[x.where])return;if(/黑顎|疤臉|石牙|小眼/.test(x.n)){x.where="灰岩洞";return}
     const h=homeOf(x);x.where=h||"";if(h&&w[h])w[h].known=true});}
  nestSync();
  S.corpses.filter(c=>!c.evo&&GEAR.test(c.name)).forEach(c=>{if(!S.items.includes(c.name))S.items.push(c.name)});
  S.corpses=S.corpses.filter(c=>c.evo||!GEAR.test(c.name));
  const dead=new Set([...(S.beaten||[]),...S.eaten.map(x=>cleanName(x.what))]);
  S.log.forEach(e=>{if(e.who==="gm"&&e.alts){const d=e.alts[e.i].defeated;if(d&&d.name)dead.add(d.name)}});
  S.npcs.filter(x=>dead.has(x.n)).forEach(x=>npcGone(x.n,S.eaten.some(y=>cleanName(y.what)===x.n)?"被你吃掉":"被你打倒",null));                     // 進化完還留著的進化戰卡

  if(S.exist>=existMax(S.lv)&&!S.evo&&!S.war&&!S.evoReady&&!S.dead&&!S.corpses.some(c=>c.evo)&&!pendingSubs()){   // 舊存檔存在值已滿：補上進化戰提示
    const notes=[]; S.evo=newEvo(); evoAnnounce(notes); S.log.push(sysEntry(notes.join("\n")));
  }
  if(S.err||!S.log.length)return;
  const L=S.log, last=L[L.length-1];
  if(last.who==="you"&&last.prompt&&last.pre)
    S.err={job:{kind:"turn",prompt:last.prompt},pre:last.pre,ctxEnd:L.length-1,msg:"上次這回合沒有跑完（可能是中途關掉或匯出）。",raw:""};
}
const gmText=e=>e.alts[e.i].text;
/* 每個行動開始前拍一張狀態快照，撤回和重新回答都退回這張 */
function snap(){const o={...S};delete o.log;delete o.err;return JSON.parse(JSON.stringify(o))}
function restore(pre){const log=S.log;S=JSON.parse(JSON.stringify(pre));S.log=log;S.err=null;fixFac(S);skillsFix(S)}


/* ═════════ 設定與存檔 ═════════ */
function modeUI(){
  mseg.querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.m===MODE));
  autobox.hidden=MODE==="list"; listbox.hidden=MODE!=="list";
  let c=null;try{c=JSON.parse(ls.g("mowu_free3")||"null")}catch(e){}
  const good=ls.g("mowu_good");
  autoinfo.innerHTML=`遊戲只用 OpenRouter 上價格為 0 的免費聊天模型，不會花你的點數。每回合最多試 3 個，成功的記下來下次先用；剛失敗的先跳過十分鐘。<br>免費模型一天 1000 次、每分鐘 20 次，試失敗的也算。`+
    (good?`<br>上次成功：<b>${esc(shortName(good))}</b>`:"")+(c&&c.list?`<br>目前名單：${c.list.length} 個`:"");
}
mseg.querySelectorAll("button").forEach(b=>b.onclick=()=>{MODE=b.dataset.m;ls.s("mowu_mode",MODE);modeUI()});
function provUI(){
  pseg.querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.p===PROV));
  gembox.hidden=PROV==="or"; orbox.hidden=PROV==="gemini";
  let c=null;try{c=JSON.parse(ls.g("mowu_gem")||"null")}catch(e){}
  const good=ls.g("mowu_gem_good");
  geminfo.innerHTML=`遊戲自己挑 Gemini 模型，flash 系列優先（免費額度最寬），每回合最多試 3 個，成功的記下來下次先用。<br><b>不花錢的前提：</b>這把 key 所在的 Google 專案沒有開計費（billing）。到 AI Studio 的 API key 頁面確認它是免費方案。`+
    (good?`<br>上次成功：<b>${esc(good)}</b>`:"")+(c&&c.list?`<br>目前名單：${c.list.length} 個`:"");
}
pseg.querySelectorAll("button").forEach(b=>b.onclick=()=>{PROV=b.dataset.p;ls.s("mowu_prov",PROV);provUI()});
regem.onclick=async()=>{
  ls.s("gm_key",gkey.value.trim());
  regem.disabled=true;regem.textContent="抓取中…";
  try{await gemModels(true)}catch(e){snoteSet("抓不到："+(e.message||e),1)}
  regem.disabled=false;regem.textContent="重新抓 Gemini 模型名單";provUI();
};
refree.onclick=async()=>{
  refree.disabled=true;refree.textContent="抓取中…";
  try{await cachedList("free",true);ls.s("mowu_bad","{}")}catch(e){snoteSet("抓不到："+(e.message||e),1)}
  refree.disabled=false;refree.textContent="重新抓免費模型名單";modeUI();
};
gear.onclick=()=>{modeUI();provUI();snoteSet("");sheet.classList.add("open")};
function closeSheet(){disarmNewg();ls.s("or_key",key.value.trim());ls.s("gm_key",gkey.value.trim());ls.s("or_model",model.value.trim());sheet.classList.remove("open");if(!S)render()}
done.onclick=closeSheet;
sheet.onclick=e=>{if(e.target===sheet)closeSheet()};
pick.onclick=async()=>{
  pick.disabled=true;pick.textContent="查詢中…";
  try{
    const r=await fetch("https://openrouter.ai/api/v1/models");
    const all=(await r.json()).data||[];
    const cap=outCap;
    const free=all.filter(m=>{const p=m.pricing||{};return parseFloat(p.prompt||"1")===0&&parseFloat(p.completion||"1")===0}).sort((a,b)=>cap(b)-cap(a));
    if(!free.length) throw new Error("沒查到免費模型");
    const have=model.value.split(/[\n,]/).map(s=>s.trim());
    freelist.innerHTML=`<div class="note" style="margin-top:6px">點一下加進上面的清單。右邊是輸出上限。</div><div class="mlist">`+
      free.map(m=>{const c=cap(m);return `<div class="mrow${have.includes(m.id)?" has":""}" data-id="${esc(m.id)}"><span class="nm2"><span class="t1">${esc(m.name||m.id)}</span><span class="t2">${esc(m.id)}</span></span><span class="o2">${c?(c>=1000?Math.round(c/1000)+"K":c):"—"}</span></div>`}).join("")+`</div>`;
    freelist.querySelectorAll(".mrow").forEach(el=>el.onclick=()=>{
      const cur=model.value.split(/[\n,]/).map(s=>s.trim()).filter(Boolean);
      if(!cur.includes(el.dataset.id)){model.value=cur.concat(el.dataset.id).join("\n");el.classList.add("has")}
    });
  }catch(e){freelist.innerHTML=`<div class="note" style="color:var(--bad)">查不到：${esc(e.message||e)}</div>`}
  pick.disabled=false;pick.textContent="列出現在免費的模型";
};
function download(blob,name){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
exp.onclick=()=>{
  if(!S){snoteSet("目前沒有進行中的遊戲。",1);return}
  download(new Blob([JSON.stringify(S)],{type:"application/json"}),`魔物篇_${S.name}_第${S.day}天.json`);
};
/* 匯出故事：只留玩家的行動和敘述，按章節分段；判定卡、系統訊息、數字、OOC 都拿掉 */
const STORY_KINDS=["turn","resolve","stage","war","raid","old"];
function storyText(){
  const out=[`權能進化・魔物篇｜${S.name}的故事`,""];
  let ch=1; out.push(`━━ 第1章・${(CHAPTERS[1]||{}).name||""} ━━`,"");
  S.log.forEach((e,i)=>{
    if(e.who==="you"){if(!e.ooc&&e.text)out.push("▶ "+e.text,"");return}
    const a=e.alts&&e.alts[e.i]; if(!a)return;
    if(STORY_KINDS.includes(e.kind)||(i===0&&e.kind==="sys"))out.push(String(a.text||"").trim(),"");
    for(const m of [a.text,...(e.notes||[])].join("\n").matchAll(/《世界之聲》：「第(\d+)章・([^」\n]+)」/g))
      if(+m[1]>ch){ch=+m[1];out.push(`━━ 第${ch}章・${m[2]} ━━`,"")}
  });
  return out.join("\n");
}
expst.onclick=()=>{
  if(!S){snoteSet("目前沒有進行中的遊戲。",1);return}
  download(new Blob(["﻿"+storyText()],{type:"text/plain;charset=utf-8"}),`魔物篇_${S.name}_故事.txt`);
};
imp.onclick=()=>impfile.click();
impfile.onchange=()=>{
  const f=impfile.files[0]; if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{const o=migrate(JSON.parse(rd.result)); if(!o) throw 0;
      S=o; S.err=null; heal(); EDIT=false; busy=false; save(); TAB="story"; sheet.classList.remove("open"); render();}
    catch(e){sheet.classList.add("open");snoteSet("這不是魔物篇的存檔。",1)}
    impfile.value="";
  };
  rd.readAsText(f);
};
let newgArmed=false,newgTimer=null;
function disarmNewg(){newgArmed=false;newg.textContent="重新開始";snoteSet("")}
function snoteSet(t,bad){snote.textContent=t;snote.style.color=bad?"var(--bad)":""}
newg.onclick=()=>{
  /* 不用瀏覽器的確認框（有些開啟方式會擋掉），改成按兩次 */
  if(!newgArmed){
    newgArmed=true; newg.textContent="再按一次，確定清除進度";
    snoteSet("目前的進度會被清掉。想留著就先按「匯出存檔」。",1);
    clearTimeout(newgTimer); newgTimer=setTimeout(disarmNewg,5000); return;
  }
  disarmNewg(); ls.d(SAVE_KEY); ls.d("mowu_save_v1"); if(IDB.db)IDB.del(SAVE_KEY); SAVE_TXT=null; S=null; busy=false; EDIT=false; TOAST="";
  sheet.classList.remove("open"); render();
};

totop.onclick=()=>window.scrollTo({top:0,behavior:"smooth"});
const tobot=document.getElementById("tobot");
tobot.onclick=()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:"smooth"});
const arrows=()=>{totop.hidden=scrollY<300;tobot.hidden=scrollY+innerHeight>document.documentElement.scrollHeight-300};
addEventListener("scroll",arrows,{passive:true}); addEventListener("resize",arrows); setInterval(arrows,1500);
bootSave().then(()=>{S=load(); heal(); if(S)save(); render(); if(!ls.g("guide_seen"))openGuide()});
