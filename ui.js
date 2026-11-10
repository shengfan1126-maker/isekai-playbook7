/* isekai-playbook7｜ui.js：畫面、存檔、自由敘事流程。依賴 data.js、game.js、ai.js。 */
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const SAVE_KEY="isekai7_save_v2";
let draft=null;      // 判定面板：{it, p, shesh, said}
let toast="";        // 一行提示
let busy=false;      // 等 AI 回答中

function save(){ls.s(SAVE_KEY,JSON.stringify(S))}
function load(){try{const t=ls.g(SAVE_KEY);if(t){S=JSON.parse(t);return S&&S.ver===VER}}catch(e){}return false}
function heal(){S.store=S.store||[];S.frags=S.frags||[];S.seen=S.seen||[];S.scars=S.scars||[];S.items=S.items||[];S.mats=S.mats||{}}

/* ───── 狀態 ───── */
function renderStatus(){
  const left=Math.max(0,DAYS-S.day+1);
  const tags=[S.tags.飢餓&&"飢餓",S.tags.會冷&&"會冷",S.tags.疾病>0&&`疾病(${S.tags.疾病})`,S.thirst>0&&`口渴 ${S.thirst}/3`,...S.scars.map(x=>"傷殘:"+x)].filter(Boolean);
  const ck=NEEDS.map(k=>`<span class="ck2 ${S.needs[k]?"on":""}">${S.needs[k]?"✔":"□"} ${k}</span>`).join("");
  $("status").innerHTML=`<div class="row"><span>第 <b>${S.day}</b> 天 ${String(S.hour).padStart(2,"0")}:00</span><span>${S.ch===1?"第一章・求生":"第二章・據點"}</span><span>魔王倒數 <b>${left}</b></span></div>
  <div class="row"><span>${esc(S.at)}</span><span>你 <b>${S.lv}</b> 級 BP <b>${bpOf()}</b></span><span>HP <b>${S.hp}</b>/${hpMax()}</span><span>MP <b>${S.mp}</b>/${MP_MAX}</span>${S.ch>1?`<span>據點 <b>${S.nest}</b></span>`:""}</div>
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
  if(S.ch===2){const b=canBuild();B.push(["build",b?`升級據點→${b.target}`:"據點已是 S",!b||!b.ok],["movebase","搬家"],["trade","交易"]);}
  if(canEvolve())B.push(["evolve","進化"]);
  if(hasItem("potion"))B.push(["potion","用藥"]);
  B.push(["stats","統計"],["ooc","OOC 更正"]);
  const info=["skills","frags","bag","recipes","stats","ooc"];
  m.innerHTML=B.map(([k,t,d])=>`<button data-k="${k}" ${(d||(lock&&!info.includes(k)))?"disabled":""}>${esc(t)}</button>`).join("");
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
    if(t==="failchoice"){P.innerHTML=h+`<div class="box">${S.pending.boss?"你被消滅了。":"據點毀了，你還活著。"}<br>${S.pending.boss?"":`<button id="fl">帶一半的東西逃走，據點從 F 重來</button> `}<button class="bad" id="dd">放棄（死亡）</button></div>`;
      if($("fl"))$("fl").onclick=()=>{failChoice(true);refresh()};$("dd").onclick=()=>{failChoice(false);refresh()};return}
    P.innerHTML=h+`<div class="box">${t==="boss"?"365 天到了。魔王復活了，朝你走來。":`襲擊！有東西攻擊你剛升到 ${S.pending.lv} 級的據點。`}<br><button class="pri" id="go">迎擊</button></div>`;
    $("go").onclick=()=>openDraft({act:t==="boss"?"boss":"raid"});return}
  if(S.enc&&!draft){P.innerHTML=h+`<div class="box enc"><b>遭遇：${esc(S.enc.n)}（${S.enc.lv} 級）</b>　你是 ${S.lv} 級。<br><span class="note">牠會「${esc(S.enc.t.n)}」。打、用組合、或撤退（撤退也要付代價，例如丟下東西）。也可以直接在上面打字說你要怎麼做。</span>
    <div class="row2"><button id="ef">戰鬥</button><button id="ec">組合</button><button id="er">撤退</button></div></div>`;
    $("ef").onclick=()=>openDraft({act:"fight"});$("ec").onclick=()=>openDraft({act:"combo",obj:{t:"enemy",n:S.enc.n}});$("er").onclick=()=>openDraft({act:"retreat"});return}
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
    ${d.shesh?"":step("hp","受傷 −"+q.unit+" HP")+step("mp","MP −2")+step("time","多花 2 小時")+step("item",it.act==="retreat"?"丟下 1 件東西":"用掉 1 件材料")}
    <label class="ck"><input type="checkbox" id="dsh" ${d.shesh?"checked":""}>捨身：拿一處傷殘（HP 上限 −2）換大成功</label>
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
  if($("dsh"))$("dsh").onchange=e=>{d.shesh=e.target.checked;renderPanel()};
  if($("dno"))$("dno").onclick=()=>{draft=null;renderAll()};
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
  if(k==="build"){build();refresh();return}
  if(k==="movebase"){moveBase();refresh();return}
  if(k==="evolve"){evolve();refresh();return}
  if(k==="potion"){usePotion();refresh();return}
  ({skills:sheetSkills,frags:sheetFrags,bag:sheetBag,recipes:sheetRecipes,stats:sheetStats,ooc:sheetOoc,trade:sheetTrade}[k]||(()=>{}))();
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
