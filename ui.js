/* isekai-playbook7｜ui.js：畫面、存檔、自由敘事流程。依賴 data.js、game.js、ai.js。 */
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const SAVE_KEY="isekai7_save_v2";
let draft=null;      // 判定面板：{it, p, shesh, said}
let toast="";        // 一行提示
let busy=false;      // 等 AI 回答中

function save(){ls.s(SAVE_KEY,JSON.stringify(S))}
function load(){try{const t=ls.g(SAVE_KEY);if(t){S=JSON.parse(t);return S&&S.ver===VER}}catch(e){}return false}
function heal(){S.store=S.store||[];S.frags=S.frags||[];S.seen=S.seen||[];S.scars=S.scars||[];S.items=S.items||[];S.mats=S.mats||{};
  S.scars=S.scars.map(x=>OLD_SCAR[x]||x);S.pts=S.pts||0;S.fac=S.fac||[];S.facPick=S.facPick||null;S.raid=S.raid||null;
  if(S.ch>=2&&!S.bases){S.bases=[];   /* 舊存檔：從紀錄找出當過據點的地方 */
    S.log.forEach(l=>{const m=l.t.match(/你在(.+?)建立了 F 級據點/)||l.t.match(/你把據點搬到(.+?)[。，]/);if(m&&!S.bases.includes(m[1]))S.bases.push(m[1])});
    if(S.base&&!S.bases.includes(S.base))S.bases.push(S.base)}
  if(S.pending&&S.pending.type==="raid")S.pending=null;if(!S.over)autoEvolve();if(S.enc&&S.enc.raid&&!S.raid)S.enc=null;offerFac()}

/* ───── 狀態 ───── */
function renderStatus(){
  const left=Math.max(0,DAYS-S.day+1);
  const tags=[S.tags.飢餓&&"飢餓",S.tags.會冷&&"會冷",S.tags.疾病>0&&`疾病(${S.tags.疾病})`,S.thirst>0&&`口渴 ${S.thirst}/3`,...SCAR_PARTS.filter(p=>scarN(p)).map(p=>`捨身傷:${p}${scarN(p)>1?"×"+scarN(p):""}`)].filter(Boolean);
  const ck=NEEDS.map(k=>`<span class="ck2 ${S.needs[k]?"on":""}">${S.needs[k]?"✔":"□"} ${k}</span>`).join("");
  $("status").innerHTML=`<div class="row"><span>第 <b>${S.day}</b> 天 ${String(S.hour).padStart(2,"0")}:00</span><span>${S.ch===1?"第一章・求生":"第二章・據點"}</span><span>魔王倒數 <b>${left}</b></span></div>
  <div class="row"><span>${esc(S.at)}</span><span>你 <b>${S.lv}</b> 級 BP <b>${bpOf()}</b></span><span>HP <b>${S.hp}</b>/${hpMax()}</span><span>MP <b>${S.mp}</b>/${mpMax()}</span>${S.ch>1?`<span>據點 <b>${S.nest}</b> 點數 ${S.pts}</span>`:""}</div>
  ${S.raid?`<div class="note bad-t">${S.raid.kind==="boss"?"魔王戰":"升級戰"}：第 ${S.raid.i+1}/${S.raid.list.length} 場，已輸 ${S.raid.lost}/${S.raid.max}（再輸 ${S.raid.max-S.raid.lost+1} 場${S.raid.kind==="boss"?"就完了":"據點被攻破"}）${S.raid.shesh?"，這場已捨身過":""}</div>`:""}
  ${S.ch===1?`<div class="needs">${ck}</div>`:""}
  ${tags.length?`<div class="note bad-t">${tags.join("・")}</div>`:""}
  <div class="note">存在值 ${S.exist}/${EXIST_MAX(S.lv)}　碎片 ${S.frags.length}　技能 ${S.skills.length}/${SKILL_SLOTS}（倉庫 ${S.store.length}/${STORE_MAX[S.lv]}）</div>`;
}
function renderLog(){
  $("logbox").innerHTML=S.log.slice().reverse().map(e=>`<div class="l ${e.type}"><small>第${e.day}天 ${String(e.hour).padStart(2,"0")}:00</small>${esc(e.t)}</div>`).join("");
}
function renderSay(){
  const on=AI.on();
  $("say").innerHTML=`<textarea id="sayt" rows="2" placeholder="${S.over?"遊戲結束":"今天要做什麼？用一句話說，例如：我用包裹把溪水包起來帶回去。"}" ${S.over||busy?"disabled":""}></textarea>
   <div class="row2"><button class="pri" id="sayb" ${S.over||busy?"disabled":""}>${busy?"AI 想一下…":"送出"}</button>
   <span class="note">${on?"自由敘事：AI 讀懂你的話，程式判定。":"還沒設定 AI（⚙），先用下面的按鈕玩。"}</span></div>`;
  $("sayb").onclick=sendSay;
}
function renderMenu(){
  const m=$("menu");
  if(S.over){m.innerHTML=`<button class="pri wide" id="again">結局：${esc(S.over.end)}（第 ${S.over.day} 天）。再玩一次</button>`;$("again").onclick=()=>{newGame();draft=null;refresh()};return}
  const lock=!!(S.pending||S.enc||draft||busy);
  const ex=canExchange();
  const B=[["gather","採集"],["explore","探索"],["hunt","狩獵"],["combo","組合"],["craft","製作"],["move","移動"],["rest","休息"],["sleep","睡覺"],
    ["skills","技能"],["frags",`碎片 ${S.frags.length}${ex.cats.length||ex.any?"！":""}`],["bag","背包"],["recipes","配方"]];
  if(S.ch===1&&S.ch1Offered&&!S.pending)B.push(["ch2","建立據點"]);
  if(S.ch===2){const b=canBuild();B.push(["base","據點"],["build",b?`升級據點→${b.target}（${S.pts}/${b.need}）`:"據點已是 S",!b||!b.ok],["movebase","搬家"],["trade","交易"]);}
  if(canEvolve())B.push(["evolve","進化"]);
  if(hasItem("potion"))B.push(["potion","用藥"]);
  if(S.items.some(i=>i.k==="cure")&&S.scars.length)B.push(["cure","治傷（萬靈藥）"]);
  const potionOk=hasItem("potion")&&!draft&&!busy&&!S.pending;
  B.push(["stats","統計"],["ooc","OOC 更正"]);
  const info=["skills","frags","bag","recipes","stats","ooc","base","cure"];
  m.innerHTML=B.map(([k,t,d])=>`<button data-k="${k}" ${(d||(lock&&!info.includes(k)&&!(k==="potion"&&potionOk)))?"disabled":""}>${esc(t)}</button>`).join("");
  m.querySelectorAll("button").forEach(x=>x.onclick=()=>menuClick(x.dataset.k));
}
function refresh(){save();renderStatus();renderPanel();renderSay();renderMenu();renderLog()}

/* ───── 判定面板 ───── */
function openDraft(it,said){draft={it:Object.assign({skills:[],obj:{t:"none",n:""},move:"",goal:"",adv:[],dis:[]},it),p:{hp:0,mp:0,time:0,item:0},shesh:false,said:said||""};toast="";
  if(it.costs&&it.costs.length){const q=planOf(draft.it);if(it.costs.includes("shesh"))draft.shesh=true;else{let n=q.need;it.costs.forEach(c=>{const t=Math.min(n,q.caps[c]||0);draft.p[c]=t;n-=t})}}
  renderAll()}
function renderAll(){renderStatus();renderPanel();renderSay();renderMenu()}
function renderPanel(){
  const P=$("panel");let h="";
  if(toast)h+=`<div class="toast">${esc(toast)}</div>`;
  if(S.over){P.innerHTML=h;return}
  if(S.pending&&!draft){const t=S.pending.type;
    if(t==="ch2"){P.innerHTML=h+`<div class="box"><b>第一章完成</b><br>食物、火、水、避難所都有了。要在「${esc(S.at)}」建立據點，進入第二章嗎？<br><span class="note">第二章：據點升級會被襲擊；搬家會讓據點變回 F 級、物資減半。</span>
      <p><button class="pri" id="c2y">在這裡建立據點</button> <button id="c2n">先不要</button></p></div>`;
      $("c2y").onclick=()=>{startCh2(true);refresh()};$("c2n").onclick=()=>{startCh2(false);refresh()};return}
    if(t==="failchoice"){const T=S.pending.boss?[]:moveTargets();
      P.innerHTML=h+`<div class="box">${S.pending.boss?"你被消滅了。":S.pending.why==="retreat"?"你放棄了據點。":"據點被攻破了，你還有一口氣。"}<br>`+
        (S.pending.boss?"":T.length?`<span class="note">搬家：帶一半的東西，到一個<b>還沒當過據點</b>的地方從 F 級重來（設施全毀、點數歸零）。搬過的地方不能再回去。</span><br>`+T.map(n=>`<button data-mv="${esc(n)}">搬到${esc(n)}</button> `).join(""):`<span class="note">你找到的地方都當過據點了，已經沒有地方可以搬。</span><br>`)+
        `<button class="bad" id="dd">陣亡</button></div>`;
      P.querySelectorAll("[data-mv]").forEach(b=>b.onclick=()=>{failChoice(b.dataset.mv);refresh()});$("dd").onclick=()=>{failChoice(false);refresh()};return}
    P.innerHTML=h+`<div class="box">365 天到了。魔王（BP 99）復活，帶著六個方位的大軍朝你來了。<br><span class="note">六場（每個方位一支軍團＋一隻 S 級魔物），最後是魔王。輸 4 場或輸給魔王就結束。魔王戰逃不掉。</span><br><button class="pri" id="go">迎擊</button></div>`;
    $("go").onclick=()=>{startBoss();refresh()};return}
  if(S.facPick&&!draft&&!S.enc){
    P.innerHTML=h+`<div class="box"><b>蓋一座設施（三選一）</b>　據點 ${S.nest} 級可以有 ${FAC_SLOTS(nestIdx())} 座，現在 ${S.fac.length} 座。<br><span class="note">蓋好後要放一個技能進去才會運作（主角一個人，沒有人手）。每座在運作的設施，升級戰時擋掉 1 條「多打一」的劣勢。</span>`+
      S.facPick.map(n=>{const f=facDef(n);return `<p><button data-fp="${esc(n)}"><b>${esc(n)}</b>　對口：${esc(f.cat)}<br><span class="note">${esc(f.d)}</span></button></p>`}).join("")+`</div>`;
    P.querySelectorAll("[data-fp]").forEach(b=>b.onclick=()=>{pickFac(b.dataset.fp);refresh()});return}
  if(S.enc&&!draft){const R=S.enc.raid,E=S.enc,boss=R&&S.raid&&S.raid.kind==="boss";
    const rinfo=R?`${esc(E.dir)}。${E.army?"大軍，沒有技巧可學。":`牠會「${esc(E.t.n)}」（升級戰頭目的獨特技巧，學不來）。`}多打一：劣勢 ${E.dis||0} 條，設施擋掉 ${Math.min(E.dis||0,facBlock())} 條。這是關鍵戰（淨優勢最多 0），不能付「多花時間」，「用掉東西」只能用背包裡的物品、一場一件。${boss?"魔王戰逃不掉。":"逃走＝放棄據點（設施全毀、F 級重來、物資剩一半）。"}`:
      `牠會「${esc(E.t.n)}」。打、用組合、或撤退（撤退也要付代價，例如丟下東西）。`;
    P.innerHTML=h+`<div class="box enc"><b>${R?(boss?"魔王戰":"升級戰")+` 第 ${S.raid.i+1}/${S.raid.list.length} 場`:"遭遇"}：${esc(E.n)}（${E.lv} 級${E.king?"・BP 99":""}）</b>　你是 ${S.lv} 級。<br><span class="note">${rinfo}也可以直接在上面打字說你要怎麼做。</span>
    <div class="row2"><button id="ef">${R?"迎擊":"戰鬥"}</button><button id="ec">組合</button>${boss?"":`<button id="er">${R?"放棄據點逃走":"撤退"}</button>`}</div></div>`;
    $("ef").onclick=()=>openDraft({act:"fight"});$("ec").onclick=()=>openDraft({act:"combo",obj:{t:"enemy",n:S.enc.n}});if($("er"))$("er").onclick=()=>openDraft({act:"retreat"});return}
  if(!draft&&canReroll()){
    P.innerHTML=h+`<div class="box"><b>開局技能</b>　不喜歡就換，換到喜歡為止。做第一件事之後就不能換了。`+
      S.skills.map((s,i)=>`<div class="rr"><span><b>${esc(s.n)}</b> <small>${esc(s.c.join("・"))}｜${esc(s.e.join("・"))}</small><br><span class="note">${esc(s.d)}</span></span><button data-rr="${i}">換 ${i+1}</button></div>`).join("")+`</div>`;
    P.querySelectorAll("[data-rr]").forEach(b=>b.onclick=()=>{rerollStart(+b.dataset.rr);refresh()});return}
  if(!draft){P.innerHTML=h;return}
  const d=draft,it=d.it,q=planOf(it);d.q=q;
  const sel=(id,opts,val)=>`<select id="${id}">${opts.map(([v,t])=>`<option value="${esc(v)}" ${v===val?"selected":""}>${esc(t)}</option>`).join("")}</select>`;
  let f="";
  if(it.act==="combo"){
    f+=`<div class="lbl">技能（最多 3 個，MP＝技能數）</div><div class="chips">`+S.skills.map((s,i)=>`<label class="chip"><input type="checkbox" class="dsk" value="${esc(s.n)}" ${it.skills.includes(s.n)?"checked":""} ${usesLeft(s)<1?"disabled":""}>${esc(s.n)}<small>${s.lv}・${s.e.join("")}・剩${usesLeft(s)}</small></label>`).join("")+`</div>`;
    const objs=[["none|","不對誰（只疊技能）"],["place|"+S.at,`地點：${S.at}（${placeOf().e.join("・")}）`]]
      .concat(S.enc?[["enemy|"+S.enc.n,`眼前的${S.enc.n}`]]:[])
      .concat(S.seen.map(x=>["seen|"+x.n,`偷學：${x.n}（${x.from}${x.used?"，學過了":""}）`]))
      .concat(S.items.map(i=>["item|"+i.n,`物品：${i.n}`])).concat(MATS.filter(m=>S.mats[m]).map(m=>["item|"+m,`材料：${m}`]));
    f+=`<label class="ck">對象 ${sel("dob",objs,it.obj.t+"|"+(it.obj.n||""))}</label>`;
    f+=`<label class="ck">手法 ${sel("dmv",[["","（選一個）"]].concat(MOVES.map(m=>[m.n,`${m.n}（${m.f}）`])),it.move)}</label>`;
  }else if(["gather","explore","fight","craft","retreat","shelter","raid","boss"].includes(it.act)){
    f+=`<label class="ck">技能 ${sel("dsk1",[["","不用"]].concat(S.skills.map(s=>[s.n,`${s.n}（${s.lv}・${s.c.join("")}・剩${usesLeft(s)}）`])),it.skills[0]||"")}</label>`;
  }
  if(it.act==="craft")f+=`<label class="ck">做什麼 ${sel("dcr",[["","（選一個）"]].concat(RECIPES.map(r=>[r.n,`${r.n}（${Object.entries(r.need).map(([m,n])=>m+n).join("＋")}）`])),it.craft)}</label>`;
  if(it.act==="move")f+=`<label class="ck">去哪 ${sel("dpl",[["","（選一個）"]].concat(S.places.filter(n=>n!==S.at).map(n=>[n,n])),it.place||"")}</label>`;
  if(["fight","combo","raid","boss"].includes(it.act)&&hasItem("white"))f+=`<label class="ck"><input type="checkbox" id="dwp" ${it.weapon?"checked":""}>用掉一件武器（+1）</label>`;
  const step=(k,t)=>`<div class="step"><span>${t}</span><button data-s="${k}-">−</button><span>${d.p[k]}/${q.caps[k]}</span><button data-s="${k}+">＋</button></div>`;
  const sum=sumPick(d.p),res=d.shesh?"大成功（捨身）":sum<q.need?"失敗":sum<q.bigAt?"成功":"大成功";
  const en=S.enc&&["fight","retreat","combo"].includes(it.act)?`　對手：${esc(S.enc.n)}（${S.enc.lv}）`:"";
  h+=`<div class="box"><b>${ACT_NAME[it.act]||it.act}</b>${en}${d.said?`<div class="note">我理解成：${esc(it.say||d.said)}</div>`:""}${f}`;
  if(q.err)h+=`<div class="bad-t">${esc(q.err)}</div>`;
  else if(q.judge){
    h+=`<div class="note">${esc(q.notes.join("；")||"沒有加成")}</div>
    <div>淨優勢 ${q.net} → 要付 <b>${q.need}</b> 項代價成功，<b>${q.bigAt}</b> 項大成功${q.key?"（關鍵戰）":""}${q.mand.mp?`　另扣 MP ${q.mand.mp}`:""}</div>
    ${d.shesh?"":step("hp","受傷 −"+q.unit+" HP")+step("mp","MP −2")+step("time","多花 2 小時")+step("item",it.act==="retreat"?"丟下 1 件東西":q.raid?"用掉 1 件物品":"用掉 1 件材料")}
    ${q.raid&&S.raid&&S.raid.shesh?`<div class="note">這場${S.raid.kind==="boss"?"魔王戰":"升級戰"}已經捨身過一次了。</div>`:`<label class="ck">捨身（拿一個部位的傷換大成功${q.raid?"，一場升級戰只能一次":""}）<select id="dsh"><option value="">不捨身</option>${SCAR_PARTS.map(p=>`<option value="${p}" ${d.shesh===p?"selected":""}>${p}：${SCAR_D[p]}${scarN(p)?`（已傷 ${scarN(p)}）`:""}</option>`).join("")}<option value="rand" ${d.shesh===true?"selected":""}>隨便哪裡</option></select></label>`}
    ${S.scars.length?`<div class="note">身上的捨身傷：${S.scars.length} 處。打贏魔王時還有 ${BAD_END_SCARS} 處以上就是壞結局。據點 S 級後可以開發萬靈藥治好一處。</div>`:""}
    <div>目前 → <b>${res}</b>${it.act==="combo"?"（組合失敗也會得到碎片）":""}</div>`;
  }
  h+=`<p><button class="pri" id="dok" ${q.err?"disabled":""}>執行</button> ${q.key?"":`<button id="dno">取消</button>`}</p></div>`;
  P.innerHTML=h;
  P.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{const k=b.dataset.s.slice(0,-1),pl=b.dataset.s.slice(-1)==="+";d.p[k]=Math.max(0,Math.min(q.caps[k],d.p[k]+(pl?1:-1)));renderPanel()});
  P.querySelectorAll(".dsk").forEach(c=>c.onchange=()=>{let a=[...P.querySelectorAll(".dsk:checked")].map(x=>x.value);if(a.length>3){c.checked=false;a=a.filter(x=>x!==c.value)}it.skills=a;clampPick();renderPanel()});
  if($("dsk1"))$("dsk1").onchange=e=>{it.skills=e.target.value?[e.target.value]:[];clampPick();renderPanel()};
  if($("dob"))$("dob").onchange=e=>{const [t,n]=e.target.value.split("|");it.obj={t,n};renderPanel()};
  if($("dmv"))$("dmv").onchange=e=>{it.move=e.target.value;renderPanel()};
  if($("dcr"))$("dcr").onchange=e=>{it.craft=e.target.value;renderPanel()};
  if($("dpl"))$("dpl").onchange=e=>{it.place=e.target.value;renderPanel()};
  if($("dwp"))$("dwp").onchange=e=>{it.weapon=e.target.checked;renderPanel()};
  if($("dsh"))$("dsh").onchange=e=>{const v=e.target.value;d.shesh=v==="rand"?true:v||false;renderPanel()};
  if($("dno"))$("dno").onclick=()=>{draft=null;renderAll()};
  if(q.raid&&S.raid&&S.raid.shesh)d.shesh=false;
  $("dok").onclick=()=>{const q2=planOf(it);if(q2.err)return;
    const out=exec(q2,Object.assign({},d.p,{shesh:d.shesh}));const said=d.said;draft=null;refresh();narrate(said)};
}
function clampPick(){const q=planOf(draft.it);["hp","mp","time","item"].forEach(k=>draft.p[k]=Math.min(draft.p[k],q.caps[k]))}

/* ───── 自由敘事 ───── */
async function sendSay(){
  const t=($("sayt").value||"").trim();if(!t)return;
  if(S.pending||draft){toast="先處理上面的事。";renderPanel();return}
  if(!AI.on()){toast="還沒設定 AI：按右上角 ⚙ 填 Gemini 或 OpenRouter 的金鑰。現在先用下面的按鈕。";renderPanel();return}
  busy=true;toast="";renderAll();
  try{
    const it=await aiParse(t);
    busy=false;
    if(S.enc&&!["fight","retreat","combo"].includes(it.act)){it.act=it.act==="talk"?"talk":"fight"}
    if(it.act==="sleep"){sleep();refresh();narrate(t);return}
    if(it.act==="talk"){log(`（你）${t}`);refresh();narrate(t);return}
    if(it.act==="hunt"||it.act==="rest"){const q=planOf(it);exec(q,{});refresh();narrate(t);return}
    openDraft(it,t);
  }catch(e){busy=false;toast="AI 出錯："+e.message+"（可以改用按鈕）";renderAll()}
}
async function narrate(said){
  if(!AI.on())return;
  const last=S.log[S.log.length-1];if(!last)return;
  try{const t=await aiNarrate(said,last.t);if(t){log(t,"story");refresh()}}catch(e){}
}

/* ───── 選單 ───── */
function menuClick(k){
  toast="";
  if(["gather","explore","fight","retreat","shelter"].includes(k))return openDraft({act:k});
  if(k==="combo")return openDraft({act:"combo",obj:{t:"place",n:S.at}});
  if(k==="craft")return openDraft({act:"craft"});
  if(k==="move")return openDraft({act:"move"});
  if(k==="hunt"||k==="rest"){exec(planOf({act:k}),{});refresh();return}
  if(k==="sleep"){sleep();refresh();return}
  if(k==="ch2"){S.pending={type:"ch2"};refresh();return}
  if(k==="build")return sheetBuild();
  if(k==="movebase")return sheetMove();
  if(k==="evolve"){evolve();refresh();return}
  if(k==="potion"){usePotion();refresh();return}
  if(k==="cure")return sheetCure();
  ({skills:sheetSkills,frags:sheetFrags,bag:sheetBag,recipes:sheetRecipes,stats:sheetStats,ooc:sheetOoc,trade:sheetTrade,base:sheetBase}[k]||(()=>{}))();
}
function sheet(html){$("sbody").innerHTML=html+`<p><button id="sx">關閉</button></p>`;$("sheet").classList.add("on");$("sx").onclick=closeSheet}
function closeSheet(){$("sheet").classList.remove("on");refresh()}
function sheetSkills(){
  const row=(s,i,where)=>`<tr><td><input type="checkbox" class="fk" value="${i}" ${where==="store"?"disabled":""}></td><td><b>${esc(s.n)}</b> ${s.lv}<br><span class="note">${s.c.join("・")}｜${s.e.join("・")}｜用了 ${s.used} 次｜今天剩 ${usesLeft(s)}</span></td><td><button data-sw="${where}|${i}">${where==="skills"?"→倉庫":"→技能表"}</button></td></tr>`;
  sheet(`<h3>技能表 ${S.skills.length}/${SKILL_SLOTS}</h3><div class="note">每個技能一天 3 次。交換一次花 1 小時。勾 3 個同大類、同階的技能可以整合成高一階（4 小時）。</div>
  <table>${S.skills.map((s,i)=>row(s,i,"skills")).join("")}</table><p><button id="fz">整合勾選的 3 個</button></p>
  <h3>倉庫 ${S.store.length}/${STORE_MAX[S.lv]}</h3><table>${S.store.map((s,i)=>row(s,i,"store")).join("")||"<tr><td>（空）</td></tr>"}</table>`);
  $("sbody").querySelectorAll("[data-sw]").forEach(b=>b.onclick=()=>{const [w,i]=b.dataset.sw.split("|");const r=swapSkill(w,+i);if(r&&r.err)toast=r.err;save();sheetSkills()});
  $("fz").onclick=()=>{const ids=[...document.querySelectorAll(".fk:checked")].map(x=>+x.value);const r=fuse(ids);if(r.err){toast=r.err;closeSheet()}else{save();sheetSkills()}};
}
function sheetFrags(){
  const c=fragCounts(),ex=canExchange();
  let h=`<h3>技能碎片 ${S.frags.length}</h3><div class="note">組合不管成敗都會留下碎片。3 片同大類 → 同大類三選一；10 片任意 → 任意三選一。跨大類的碎片每一類都算。</div>
  <p>${Object.entries(c).map(([k,n])=>`${k} ${n}`).join("、")||"還沒有碎片"}</p>`;
  h+=ex.cats.map(k=>`<button data-x="${k}">用 3 片「${k}」碎片換技能</button>`).join(" ");
  if(ex.any)h+=` <button data-x="">用 10 片任意碎片換技能</button>`;
  h+=`<div id="xch"></div>`;
  sheet(h);
  $("sbody").querySelectorAll("[data-x]").forEach(b=>b.onclick=()=>{const cat=b.dataset.x||null;const ch=drawChoices(cat);
    $("xch").innerHTML=`<h3>三選一</h3>`+ch.map((t,i)=>`<p><button data-c="${i}"><b>${esc(t.n)}</b>　${esc((t.c||[]).join("・"))}｜${esc((t.e||[]).join("・"))}<br><span class="note">${esc(t.d||"")}</span></button></p>`).join("")+`<div class="note">這次沒有想要的，可以先不換，下次再抽。</div>`;
    $("xch").querySelectorAll("[data-c]").forEach(x=>x.onclick=()=>{exchange(cat,ch[+x.dataset.c]);save();sheetFrags()})});
}
function sheetBag(){
  sheet(`<h3>背包</h3><p>材料：${MATS.filter(m=>S.mats[m]).map(m=>m+"×"+S.mats[m]).join("、")||"（空）"}</p>
  <p>物品：${S.items.map(i=>esc(i.n)).join("、")||"（無）"}</p><p>金幣：${S.gold}</p>
  <p>看過的魔物技巧：${S.seen.map(x=>`${esc(x.n)}（${esc(x.from)}・${x.lv}${x.used?"・已偷學":""}）`).join("、")||"（無）"}</p>
  <p>已知地點：${S.places.map(n=>{const p=placeOf(n);return `${n}（${p.e.join("・")}${p.water?"・水":""}${p.cave?"・岩穴":""}）`}).join("、")}</p>`);
}
function sheetRecipes(){
  sheet(`<h3>配方</h3><table>${RECIPES.map(r=>`<tr><td><b>${r.n}</b></td><td>${Object.entries(r.need).map(([m,n])=>m+"×"+n).join("＋")}</td><td class="note">${r.d}</td></tr>`).join("")}</table>
  <div class="note">也可以直接打字，例如「我用石片和木頭做一把石刀」。</div>`);
}
function exportText(){
  return `孤獨異世界紀錄 v${VER}\n第${S.day}天 ${String(S.hour).padStart(2,"0")}:00　第${S.ch}章　在${S.at}　${S.lv}級 BP${bpOf()}　HP ${S.hp}/${hpMax()}　MP ${S.mp}\n`+
   `求生：${NEEDS.map(k=>k+(S.needs[k]?"✔":"✘")).join(" ")}\n技能：${S.skills.map(s=>`${s.n}${s.lv}(用${s.used})`).join("、")}\n倉庫：${S.store.map(s=>s.n).join("、")||"無"}\n`+
   `碎片：${S.frags.length}　看過的技巧：${S.seen.map(x=>x.n).join("、")||"無"}\n材料：${MATS.filter(m=>S.mats[m]).map(m=>m+"×"+S.mats[m]).join("、")}　物品：${S.items.map(i=>i.n).join("、")}\n`+
   `統計：${JSON.stringify(S.stats)}\n紀錄：\n`+S.log.map(l=>`第${l.day}天 ${String(l.hour).padStart(2,"0")}:00 ${l.t}`).join("\n");
}
function sheetStats(){
  const st=S.stats,row=o=>Object.entries(o).map(([k,v])=>k+" "+v).join("，")||"—";
  sheet(`<h3>統計</h3><p>第一章完成：${st.ch1Day?`第 ${st.ch1Day} 天`:"還沒"}</p><p>行動：${row(st.actions)}</p><p>技能使用：${row(st.skillUse)}</p>
  <p>組合：${st.combos.try} 次，學會 ${st.combos.learn}，碎片 ${st.combos.frag}</p><p>遭遇：${st.enc}</p>
  <p>OOC：補登 ${st.ooc.add}・撤銷 ${st.ooc.remove}・改數 ${st.ooc.edit}</p>
  <p><button id="cp">複製紀錄（貼給 Claude 看）</button> <span class="note" id="cpm"></span></p><textarea id="dump" rows="6" hidden readonly></textarea>`);
  $("cp").onclick=()=>{const t=exportText();const fb=()=>{const d=$("dump");d.hidden=false;d.value=t;d.focus();d.select();$("cpm").textContent="請長按全選後複製。"};
    try{navigator.clipboard.writeText(t).then(()=>{$("cpm").textContent="已複製。"},fb)}catch(e){fb()}};
}
function sheetOoc(){
  sheet(`<h3>OOC：更正帳目</h3><div class="note">AI 或你覺得算錯時用。不花遊戲時間。</div>
  <input id="on" placeholder="名稱（材料名、金幣、或物品名）"><input id="oc" type="number" value="1">
  <p><button id="oa">補登</button> <button id="or">撤銷</button></p>
  <p>直接改：<select id="of"><option value="hp">HP</option><option value="mp">MP</option><option value="gold">金幣</option>${NEEDS.map(k=>`<option value="${k}">${k}（1＝打勾，0＝取消）</option>`).join("")}</select><input id="ov" type="number"><button id="oe">改</button></p>`);
  $("oa").onclick=()=>{if($("on").value){oocAdd($("on").value.trim(),+$("oc").value||1);save();closeSheet()}};
  $("or").onclick=()=>{if($("on").value){oocRemove($("on").value.trim(),+$("oc").value||1);save();closeSheet()}};
  $("oe").onclick=()=>{if($("ov").value!==""){oocSet($("of").value,+$("ov").value);save();closeSheet()}};
}
function sheetBase(){
  const b=canBuild(),lock=!!(S.enc||S.pending||busy);
  let h=`<h3>據點 ${S.nest} 級（${esc(S.base||"")}）</h3><p class="note">還能搬的地方：${moveTargets().length?esc(moveTargets().join("、")):"沒有"}</p><p>點數 <b>${S.pts}</b>${b?`　升到 ${b.target} 要 ${b.need}`:"　已是 S"}</p>
  <div class="note">捐物資換點數：一般材料 1 點、獸皮 2、魔核 4、物品 ${ITEM_PTS}。捐出去就沒了。升一級就會引來一場升級戰。</div>
  ${b&&S.pts<b.need?`<p><button id="dnext" ${lock?"disabled":""}>捐到夠升 ${b.target}（還差 ${b.need-S.pts} 點）</button> <span class="note">先捐骨頭、獸皮、魔核，再木材、石片、草，食物留 5 份。</span></p>`:""}<table>`+
  MATS.filter(m=>S.mats[m]).map(m=>`<tr><td>${m}×${S.mats[m]}</td><td class="note">${ptsOf(m)} 點</td><td><button data-dn="${m}|1" ${lock?"disabled":""}>捐 1</button> <button data-dn="${m}|h" ${lock?"disabled":""}>捐一半</button> <button data-dn="${m}|a" ${lock?"disabled":""}>全捐</button></td></tr>`).join("")+`</table>`;
  if(S.items.length)h+=`<p class="note">物品（背包 ${S.items.length}/${bagMax()}）：</p><p>`+S.items.map((it,i)=>`<button data-di="${i}" ${lock?"disabled":""}>捐 ${esc(it.n)}</button>`).join(" ")+`</p>`;
  if(S.nest==="S")h+=`<p><button id="mkcure" ${lock?"disabled":""}>開發萬靈藥（魔核 5、草 5，4 小時）</button> <span class="note">治好一處捨身傷。</span></p>`;
  h+=`<h3>設施 ${S.fac.length}/${FAC_SLOTS(nestIdx())}</h3><div class="note">放一個技能進去才會運作；技能大類對口效果更好。放進去的技能離開技能表，拿回來放回技能表（滿了進倉庫）。放、拿各花 1 小時。升級戰時，每座在運作的設施擋掉 1 條劣勢。</div>`;
  h+=S.fac.map((f,fi)=>{const d=facDef(f.n);return `<div class="box"><b>${esc(f.n)}</b>　對口：${esc(d.cat)}${f.s?(facMatch(f)?"　✔對口":""):"　（沒在運作）"}<br><span class="note">${esc(d.d)}</span><br>
    ${f.s?`技能：【${esc(f.s.n)}】${f.s.lv}・${esc(f.s.c.join("・"))} <button data-fo="${fi}" ${lock?"disabled":""}>拿回來</button>`:""}
    <select data-fs="${fi}" ${lock?"disabled":""}><option value="">${f.s?"換成…":"放一個技能進去…"}</option>${S.skills.map((s,si)=>`<option value="${si}">${esc(s.n)}（${s.lv}・${esc(s.c.join("・"))}${s.c.includes(d.cat)?"・對口":""}）</option>`).join("")}</select></div>`}).join("")||"<p>（還沒有設施）</p>";
  sheet(h);
  const R=()=>{save();sheetBase()};
  $("sbody").querySelectorAll("[data-dn]").forEach(x=>x.onclick=()=>{const [m,k]=x.dataset.dn.split("|");const n=k==="1"?1:k==="h"?Math.ceil((S.mats[m]||0)/2):(S.mats[m]||0);donate(m,n);R()});
  if($("dnext"))$("dnext").onclick=()=>{const r=donateToNext();if(r.err)toast=r.err;R()};
  if($("mkcure"))$("mkcure").onclick=()=>{const r=makeCure();if(r.err)toast=r.err;R()};
  $("sbody").querySelectorAll("[data-di]").forEach(x=>x.onclick=()=>{donateItem(+x.dataset.di);R()});
  $("sbody").querySelectorAll("[data-fo]").forEach(x=>x.onclick=()=>{facOut(+x.dataset.fo);R()});
  $("sbody").querySelectorAll("[data-fs]").forEach(x=>x.onchange=()=>{if(x.value!=="")facPut(+x.dataset.fs,+x.value);R()});
}
/* 升級前確認：告訴玩家要來什麼、自己現在的狀態 */
function sheetBuild(){
  const b=canBuild();if(!b||!b.ok)return;
  const P=RAID_PLAN[b.target],n=P.rounds||(P.army+P.mon.length),lose=Math.floor((n-1)/2)+1;
  const what=P.rounds?`一隻 ${P.mon} 級個體，${P.rounds} 回合`:`${P.army} 場 ${b.target} 級軍隊＋${P.mon.map(g=>g+" 級").join("、")}魔物（${n} 場）`;
  const weap=S.items.filter(i=>i.k==="white").length,pot=S.items.filter(i=>i.k==="potion").length,pay=S.items.filter(i=>i.k==="white"||i.k==="potion").length;
  const unit=hpUnit(true),warn=[];
  if(S.hp<hpMax())warn.push(`HP 沒滿（${S.hp}/${hpMax()}）。輸一場扣 ${unit}，${S.hp<=unit?"<b>輸一場就會死</b>":`大約輸 ${Math.ceil(S.hp/unit)} 場會死`}。`);
  if(S.mp<mpMax())warn.push(`MP 沒滿（${S.mp}/${mpMax()}）。用技能一場扣 1，付代價一次扣 2。`);
  if(!weap)warn.push("沒有武器（用武器一場 +1）。");
  if(!pot)warn.push("沒有藥。");
  const top=P.rounds?P.mon:P.mon.reduce((a,g)=>gIdx(g)>gIdx(a)?g:a);
  if(gIdx(top)-gIdx(S.lv)>=2)warn.push(`你是 ${S.lv} 級，對手最高 ${top} 級，差 ${gIdx(top)-gIdx(S.lv)} 級。`);
  if(!moveTargets().length)warn.push("已經沒有能搬的地方：這一戰輸了就是陣亡。");
  if(S.hour>=18)warn.push("天快黑了，打完才能睡（升級戰中間不能睡）。");
  sheet(`<h3>升級據點 → ${b.target}？</h3>
  <p>升級後<b>馬上</b>開打：${what}。輸 ${lose} 場或 HP 歸零，據點被攻破；中途逃走＝放棄據點。被攻破只能搬家（去沒當過據點的地方）或陣亡。還能搬的地方：${moveTargets().length?esc(moveTargets().join("、")):"<b>沒有了，被攻破就是陣亡</b>"}。</p>
  <p class="note">你現在：${S.lv} 級，HP ${S.hp}/${hpMax()}，MP ${S.mp}/${mpMax()}，武器 ${weap}、藥 ${pot}（可付代價的物品 ${pay} 件）；運作中的設施 ${facOn().length} 座（擋 ${facBlock()} 條劣勢）。</p>
  ${warn.length?`<div class="box enc"><b>還沒準備好：</b><br>${warn.join("<br>")}<br><span class="note">先睡一覺、做武器和藥再來比較好。</span></div>`:`<p>準備好了。</p>`}
  <div class="row2"><button class="${warn.length?"":"pri"}" id="bgo">升級，開打</button><button class="${warn.length?"pri":""}" id="bno">先準備</button></div>`);
  $("bgo").onclick=()=>{closeSheet();build();refresh()};$("bno").onclick=()=>closeSheet();
}
function sheetMove(){
  const T=moveTargets();
  sheet(`<h3>搬家</h3><div class="note">據點變回 F 級，設施全毀、點數歸零，物資只帶走一半，花 6 小時。只能搬到<b>還沒當過據點</b>的地方，搬過的不能再回去；升級戰被攻破時也要從這些地方選，沒地方可搬就只能陣亡。</div>
  <p>當過據點：${esc((S.bases||[]).join("、"))}</p>`+(T.length?T.map(n=>`<p><button data-mv="${esc(n)}">搬到${esc(n)}</button></p>`).join(""):"<p>沒有可以搬的地方。去探索找新地方。</p>"));
  $("sbody").querySelectorAll("[data-mv]").forEach(b=>b.onclick=()=>{const r=moveBase(b.dataset.mv);if(r&&r.err)toast=r.err;save();closeSheet();refresh()});
}
function sheetCure(){
  sheet(`<h3>治傷（萬靈藥 ${S.items.filter(i=>i.k==="cure").length} 瓶）</h3><div class="note">一瓶治好一處捨身傷。</div>`+
    uniq(S.scars).map(p=>`<p><button data-cu="${p}">治好 ${p}${scarN(p)>1?`（${scarN(p)} 處中的 1 處）`:""}</button> <span class="note">${SCAR_D[p]}</span></p>`).join(""));
  $("sbody").querySelectorAll("[data-cu]").forEach(x=>x.onclick=()=>{useCure(x.dataset.cu);save();closeSheet()});
}
function sheetTrade(){
  if(nestIdx()<2)return sheet("<p>據點要 D 級以上，才會有商人來。（他們看到你就厭惡，買價 ×2）</p>");
  sheet(`<h3>交易</h3><div class="note">金幣 ${S.gold}。賣：</div>`+MATS.filter(m=>S.mats[m]).map(m=>`<button data-t="sell|${m}">賣 ${m}（${S.mats[m]}）+${SELL[m]||1}</button>`).join(" ")+
   `<div class="note">買（厭惡加價）：</div>`+Object.keys(BUY).map(m=>`<button data-t="buy|${m}">${m} ${BUY[m]*2}</button>`).join(" "));
  $("sbody").querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{const [k,m]=b.dataset.t.split("|"),r=trade(k,m);if(r.err)toast=r.err;save();sheetTrade()});
}
/* ───── 設定（照搬魔物篇的設定頁；金鑰沿用魔物篇存的那一份） ───── */
function modeUI(){
  $("mseg").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.m===MODE));
  $("autobox").hidden=MODE==="list";$("listbox").hidden=MODE!=="list";
  let c=null;try{c=JSON.parse(ls.g("mowu_free3")||"null")}catch(e){}
  const good=ls.g("mowu_good");
  $("autoinfo").innerHTML=`遊戲只用 OpenRouter 上價格為 0 的免費聊天模型，不會花你的點數。每回合最多試 3 個，成功的記下來下次先用；剛失敗的先跳過十分鐘。<br>免費模型一天 1000 次、每分鐘 20 次，試失敗的也算。`+
    (good?`<br>上次成功：<b>${esc(shortName(good))}</b>`:"")+(c&&c.list?`<br>目前名單：${c.list.length} 個`:"");
}
function provUI(){
  $("pseg").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.p===PROV));
  $("gembox").hidden=PROV==="or";$("orbox").hidden=PROV==="gemini";
  let c=null;try{c=JSON.parse(ls.g("mowu_gem")||"null")}catch(e){}
  const good=ls.g("mowu_gem_good");
  $("geminfo").innerHTML=`遊戲自己挑 Gemini 模型，flash 系列優先（免費額度最寬），每回合最多試 3 個，成功的記下來下次先用。<br><b>不花錢的前提：</b>這把 key 所在的 Google 專案沒有開計費（billing）。到 AI Studio 的 API key 頁面確認它是免費方案。`+
    (good?`<br>上次成功：<b>${esc(good)}</b>`:"")+(c&&c.list?`<br>目前名單：${c.list.length} 個`:"");
}
function snoteSet(t,bad){$("snote").textContent=t;$("snote").style.color=bad?"var(--bad)":""}
let newgArmed=false,newgTimer=null;
function disarmNewg(){newgArmed=false;$("newg").textContent="重新開始";snoteSet("")}
function closeSet(){disarmNewg();ls.s("or_key",EL.key.value.trim());ls.s("gm_key",EL.gkey.value.trim());ls.s("or_model",EL.model.value.trim());$("setsheet").classList.remove("on");refresh()}
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function initSettings(){
  $("mseg").querySelectorAll("button").forEach(b=>b.onclick=()=>{MODE=b.dataset.m;ls.s("mowu_mode",MODE);modeUI()});
  $("pseg").querySelectorAll("button").forEach(b=>b.onclick=()=>{PROV=b.dataset.p;ls.s("mowu_prov",PROV);provUI()});
  $("regem").onclick=async()=>{const b=$("regem");ls.s("gm_key",EL.gkey.value.trim());b.disabled=true;b.textContent="抓取中…";
    try{await gemModels(true)}catch(e){snoteSet("抓不到："+(e.message||e),1)}b.disabled=false;b.textContent="重新抓 Gemini 模型名單";provUI()};
  $("refree").onclick=async()=>{const b=$("refree");b.disabled=true;b.textContent="抓取中…";
    try{await cachedList("free",true);ls.s("mowu_bad","{}")}catch(e){snoteSet("抓不到："+(e.message||e),1)}b.disabled=false;b.textContent="重新抓免費模型名單";modeUI()};
  $("bset").onclick=()=>{modeUI();provUI();snoteSet("");$("setsheet").classList.add("on")};
  $("setdone").onclick=closeSet;
  $("setsheet").onclick=e=>{if(e.target===$("setsheet"))closeSet()};
  $("pickfree").onclick=async()=>{const b=$("pickfree");b.disabled=true;b.textContent="查詢中…";
    try{const r=await fetch("https://openrouter.ai/api/v1/models");const all=(await r.json()).data||[];
      const free=all.filter(m=>{const p=m.pricing||{};return parseFloat(p.prompt||"1")===0&&parseFloat(p.completion||"1")===0}).sort((a,b)=>outCap(b)-outCap(a));
      if(!free.length)throw new Error("沒查到免費模型");
      const have=EL.model.value.split(/[\n,]/).map(s=>s.trim());
      $("freelist").innerHTML=`<div class="note" style="margin-top:6px">點一下加進上面的清單。右邊是輸出上限。</div><div class="mlist">`+
        free.map(m=>{const c=outCap(m);return `<div class="mrow${have.includes(m.id)?" has":""}" data-id="${esc(m.id)}"><span class="nm2"><span class="t1">${esc(m.name||m.id)}</span><span class="t2">${esc(m.id)}</span></span><span class="o2">${c?(c>=1000?Math.round(c/1000)+"K":c):"—"}</span></div>`}).join("")+`</div>`;
      $("freelist").querySelectorAll(".mrow").forEach(el=>el.onclick=()=>{const cur=EL.model.value.split(/[\n,]/).map(s=>s.trim()).filter(Boolean);
        if(!cur.includes(el.dataset.id)){EL.model.value=cur.concat(el.dataset.id).join("\n");el.classList.add("has")}});
    }catch(e){$("freelist").innerHTML=`<div class="note" style="color:var(--bad)">查不到：${esc(e.message||e)}</div>`}
    b.disabled=false;b.textContent="列出現在免費的模型"};
  $("exp").onclick=()=>download(new Blob([JSON.stringify(S)],{type:"application/json"}),`孤獨異世界_第${S.day}天.json`);
  $("expst").onclick=()=>download(new Blob(["\ufeff"+exportText()],{type:"text/plain;charset=utf-8"}),`孤獨異世界_紀錄_第${S.day}天.txt`);
  $("imp").onclick=()=>$("impfile").click();
  $("impfile").onchange=()=>{const f=$("impfile").files[0];if(!f)return;const rd=new FileReader();
    rd.onload=()=>{try{const o=JSON.parse(rd.result);if(!o||o.ver!==VER||!o.needs)throw 0;S=o;heal();draft=null;busy=false;save();closeSet()}
      catch(e){snoteSet("這不是這個版本的存檔。",1)}$("impfile").value=""};rd.readAsText(f)};
  $("newg").onclick=()=>{
    if(!newgArmed){newgArmed=true;$("newg").textContent="再按一次，確定清除進度";snoteSet("目前的進度會被清掉。想留著就先按「匯出存檔」。",1);
      clearTimeout(newgTimer);newgTimer=setTimeout(disarmNewg,5000);return}
    disarmNewg();newGame();draft=null;busy=false;toast="";closeSet()};
}
initSettings();

if(!load())newGame();else heal();
refresh();
