/* isekai-playbook7｜ui.js：畫面、存檔、選擇性的模型潤飾。依賴 game.js。 */
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const ls={g:k=>{try{return localStorage.getItem(k)}catch(e){return null}},s:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},d:k=>{try{localStorage.removeItem(k)}catch(e){}}};
const SAVE_KEY="isekai7_save_v1";
const NAME={gather:"採集",hunt:"狩獵",craft:"製作",fuse:"整合",raid:"迎擊襲擊",boss:"魔王戰"};
let draft=null;   // 目前打開的判定面板 {q, p, kind}

function save(){ls.s(SAVE_KEY,JSON.stringify(S))}
function load(){try{const t=ls.g(SAVE_KEY);if(t){S=JSON.parse(t);return true}}catch(e){}return false}
const TAGN={gather:"採集",hunt:"狩獵",craft:"製作",build:"建造",defense:"防守"};
function heal(){S.recipes=S.recipes||[];S.tried=S.tried||[];S.itemUsed=S.itemUsed||{};S.stats=S.stats||{};["nestDay","lvDay","actions","skillUse","itemUse","crafted"].forEach(k=>S.stats[k]=S.stats[k]||{});S.stats.raids=S.stats.raids||[];S.stats.hunts=S.stats.hunts||{ok:0,big:0,fail:0};S.stats.ooc=S.stats.ooc||{add:0,remove:0,edit:0}}

/* ───── 畫面 ───── */
function bar(a,b){return `<div class="bar"><i style="width:${Math.max(0,Math.min(100,a/b*100))}%"></i></div>`}
function renderStatus(){
  const left=Math.max(0,DAYS-S.day+1);
  const mats=MATS.filter(m=>S.mats[m]).map(m=>m+"×"+S.mats[m]).join(" ")||"（空）";
  const sk=S.skills.map(s=>`${esc(s.n)}（${s.lv}）${SKILL_PER_DAY-s.used}/${SKILL_PER_DAY}`).join("　");
  const it=S.items.map(i=>esc(i.n)+(i.kind==="magic"?(S.itemUsed[i.n]?"（今天用過）":"（可用）"):"")).join("、")||"（無）";
  $("status").innerHTML=`<div class="row"><span>第 <b>${S.day}</b> 天 ${String(S.hour).padStart(2,"0")}:00</span><span>魔王倒數 <b>${left}</b> 天</span><span>金幣 ${S.gold}</span></div>
  <div class="row"><span>你 <b>${S.lv}</b> 級　BP <b>${bpOf()}</b>/99</span><span>據點 <b>${S.nest||"尚未建立"}</b></span></div>
  存在值 ${S.exist}/${EXIST_MAX(S.lv)}${bar(S.exist,EXIST_MAX(S.lv))}
  <div class="row"><span>HP ${S.hp}/${HP_MAX(S.lv)}</span><span>MP ${S.mp}/${MP_MAX}</span></div>
  <div class="note">技能（今天剩餘）：${sk}</div>
  <div class="note">材料：${mats}</div><div class="note">物品：${it}</div>`;
}
function renderLog(){
  $("logbox").innerHTML=S.log.slice().reverse().map(e=>`<div class="l ${e.type}"><small>第${e.day}天 ${String(e.hour).padStart(2,"0")}:00</small> ${esc(e.t)}</div>`).join("");
}
function renderMenu(){
  const m=$("menu");
  if(S.over){m.innerHTML=`<button class="pri" style="grid-column:1/-1" id="again">結局：${esc(S.over.end)}（第 ${S.over.day} 天）。再玩一次</button>`;$("again").onclick=()=>{newGame();refresh()};return}
  if(S.pending){m.innerHTML="";return}
  const b=canBuild();
  const bt=!b?"據點已是 S":`${S.nest==null?"蓋據點":"升級據點"}→${b.target}`;
  m.innerHTML=[["gather","採集（2h）"],["hunt","狩獵（3h）"],["craft","製作（2h）"],
    ["build",bt,!b||!b.ok],["evolve","進化"+(canEvolve()?"":"（未滿）"),!canEvolve()],["fuse","整合（3→1）"],
    ["trade","交易"],["potion","喝藥水",!S.items.some(i=>i.kind==="potion")],["sleep","睡覺（到明天）"],
    ["stats","統計"],["ooc","OOC 更正"]].map(([k,t,d])=>`<button data-k="${k}" ${d?"disabled":""}>${esc(t)}</button>`).join("");
  m.querySelectorAll("button").forEach(x=>x.onclick=()=>menuClick(x.dataset.k));
}
function refresh(){save();renderStatus();renderLog();renderMenu();renderPanel()}

/* ───── 判定面板 ───── */
function openJudge(kind,o){draft={kind,o,p:{hp:0,mp:0,time:0,item:0}};renderPanel()}
function renderPanel(){
  const P=$("panel");
  if(S.over){P.innerHTML="";return}
  if(S.pending&&S.pending.type==="failchoice"){
    P.innerHTML=`<div class="box">${S.pending.boss?"你被消滅了。":"據點毀了，你還活著。"}<br>
    ${S.pending.boss?"":`<button id="fl">逃跑，從 F 級重新開始</button> `}<button class="bad" id="dd">放棄（死亡，遊戲結束）</button></div>`;
    if($("fl"))$("fl").onclick=()=>{failChoice(true);refresh()};$("dd").onclick=()=>{failChoice(false);refresh()};return}
  if(S.pending&&!draft){const t=S.pending.type;
    P.innerHTML=`<div class="box">${t==="boss"?"365 天到了。魔王復活了，朝你走來。":`襲擊！有東西攻擊你新建的 ${S.pending.lv} 級據點。`}<br><button class="pri" id="go">迎擊</button></div>`;
    $("go").onclick=()=>openJudge(t==="boss"?"boss":"raid",{});return}
  if(!draft){P.innerHTML="";return}
  const d=draft, o=Object.assign({},d.o);
  o.skill=d.skill!=null?d.skill:null;o.weapon=!!d.weapon;o.magic=d.magic!=null?d.magic:null;
  const q=planOf(d.kind,o);d.q=q;
  const sum=sumPick(d.p),res=sum<q.need?"失敗":sum<q.bigAt?"成功":"大成功";
  const skOpts=S.skills.map((s,i)=>`<option value="${i}" ${d.skill===i?"selected":""}>${esc(s.n)}（${s.lv}，剩 ${SKILL_PER_DAY-s.used}，擅長：${s.tags.map(t=>TAGN[t]||t).join("、")}）</option>`).join("");
  const mg=S.items.map((it,i)=>it.kind==="magic"?`<option value="${i}" ${d.magic===i?"selected":""}>${esc(it.n)}${S.itemUsed[it.n]?"（今天用過）":""}</option>`:"").join("");
  const step=(k,t)=>`<div class="step"><span>${t}</span><button data-s="${k}-">−</button><span>${d.p[k]}/${q.caps[k]}</span><button data-s="${k}+">＋</button></div>`;
  P.innerHTML=`<div class="box"><b>${NAME[d.kind]}</b>${q.eIdx!=null&&d.kind!=="gather"&&d.kind!=="craft"&&d.kind!=="fuse"?"　對手："+(q.boss?"魔王":GRADES[q.eIdx]+" 級"):""}
  <div class="note">${q.notes.join("；")||"沒有加成"}</div>
  <div>淨優勢 ${q.net}　→　要付 <b>${q.need}</b> 項代價才成功，<b>${q.bigAt}</b> 項大成功${q.key?"（關鍵戰：失敗＝據點毀／死亡）":""}</div>
  <label class="ck">技能 <select id="jsk"><option value="">不用</option>${skOpts}</select></label>
  <label class="ck"><input type="checkbox" id="jwp" ${d.weapon?"checked":""}>消耗一件白色武器（有 ${S.items.filter(i=>i.kind==="white").length} 件）</label>
  ${mg?`<label class="ck">魔法物品 <select id="jmg"><option value="">不用</option>${mg}</select></label>`:""}
  ${step("hp","受傷 −"+q.unit+" HP")}${step("mp","MP −2")}${step("time","多花 2 小時")}${step("item","用掉 1 件材料")}
  <div>目前付 ${sum} 項 → <b>${res}</b></div>
  <button class="pri" id="jok">執行</button> ${q.key?"":`<button id="jno">取消</button>`}</div>`;
  P.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{const k=b.dataset.s.slice(0,-1),pl=b.dataset.s.slice(-1)==="+";d.p[k]=Math.max(0,Math.min(q.caps[k],d.p[k]+(pl?1:-1)));renderPanel()});
  $("jsk").onchange=e=>{d.skill=e.target.value===""?null:+e.target.value;clampPick();renderPanel()};
  $("jwp").onchange=e=>{d.weapon=e.target.checked;renderPanel()};
  if($("jmg"))$("jmg").onchange=e=>{d.magic=e.target.value===""?null:+e.target.value;renderPanel()};
  if($("jno"))$("jno").onclick=()=>{draft=null;renderPanel()};
  $("jok").onclick=()=>{
    const q2=d.q,out=exec(q2,d.p);draft=null;refresh();narrate(out);
  };
}
function clampPick(){const q=planOf(draft.kind,Object.assign({},draft.o,{skill:draft.skill}));["hp","mp","time","item"].forEach(k=>draft.p[k]=Math.min(draft.p[k],q.caps[k]))}

/* ───── 選單 ───── */
function menuClick(k){
  if(k==="gather")return openJudge("gather",{});
  if(k==="hunt")return sheetHunt();
  if(k==="craft")return sheetCraft();
  if(k==="fuse")return sheetFuse();
  if(k==="trade")return sheetTrade();
  if(k==="stats")return sheetStats();
  if(k==="ooc")return sheetOoc();
  if(k==="build"){build();refresh();return}
  if(k==="evolve"){evolve();refresh();return}
  if(k==="sleep"){sleep();refresh();return}
  if(k==="potion"){usePotion(S.items.findIndex(i=>i.kind==="potion"));refresh();return}
}
function sheet(html){$("sbody").innerHTML=html+`<p><button id="sx">關閉</button></p>`;$("sheet").classList.add("on");$("sx").onclick=closeSheet}
function closeSheet(){$("sheet").classList.remove("on")}
function sheetHunt(){
  const pg=gIdx(S.lv),opts=[];for(let g=Math.max(0,pg-2);g<=Math.min(6,pg+2);g++)opts.push(g);
  sheet(`<h3>狩獵：選對手階層</h3><div class="note">越強存在值越多，但階層差每級 −1。比你低兩級以上沒有存在值。</div>`+
    opts.map(g=>`<p><button data-g="${g}">${GRADES[g]} 級${g>pg?"（強）":g<pg?"（弱）":""}</button></p>`).join(""));
  $("sbody").querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{closeSheet();openJudge("hunt",{g:+b.dataset.g})});
}
function sheetCraft(){
  const have=MATS.filter(m=>S.mats[m]);
  if(!have.length)return sheet("<p>你沒有材料。</p>");
  const left=RECIPES.filter(r=>!S.recipes.includes(r.id));
  const n2=left.filter(r=>r.need.length===2).length, n3=left.filter(r=>r.need.length===3).length;
  const nestN=left.filter(r=>r.nest!=null).length;
  const hint=left.length?`還有 ${left.length} 個配方沒找到（兩樣材料 ${n2} 個、三樣材料 ${n3} 個）。${nestN?`其中 ${nestN} 個要先有據點才做得出來。`:""}`:"所有配方都找到了。";
  const knownKeys=S.recipes.map(id=>RECIPES.find(x=>x.id===id).need.slice().sort().join("＋"));
  const tried=S.tried.filter(k=>!knownKeys.includes(k));
  sheet(`<h3>製作</h3><div class="note">選 2～3 樣材料（可重複）。已知配方直接做；沒找過的組合要付 1 項代價（受傷、MP、時間或材料）才可能成功，失敗扣 1 份材料，湊不出東西材料不會扣。</div>
   <div class="note">${hint}</div>
   ${[0,1,2].map(i=>`<select class="cm"><option value="">—</option>${have.map(m=>`<option>${m}</option>`).join("")}</select>`).join("")}
   <p>已知配方：${S.recipes.map(id=>{const r=RECIPES.find(x=>x.id===id);return esc(r.need.join("＋")+"→"+r.out.n)}).join("；")||"（無）"}</p>
   <p>試過、還沒成功的組合：${tried.length?tried.map(esc).join("、"):"（無）"}</p>
   <p><button id="rtab">配方表（測試用，全部顯示）</button></p>
   <button class="pri" id="cgo">開始</button>`);
  $("rtab").onclick=sheetRecipes;
  $("cgo").onclick=()=>{
    const ms=[...document.querySelectorAll(".cm")].map(s=>s.value).filter(Boolean);
    const c={};ms.forEach(m=>c[m]=(c[m]||0)+1);
    if(ms.length<2||Object.entries(c).some(([m,n])=>(S.mats[m]||0)<n))return alert("材料不夠或少於 2 樣");
    if(!matchRecipe(ms)&&gatedRecipe(ms))return alert("這組材料要先蓋據點才做得出來");
    closeSheet();openJudge("craft",{mats:ms});
  };
}
function sheetRecipes(){
  sheet(`<h3>配方表（測試用，全部顯示）</h3><div class="note">共 ${RECIPES.length} 個配方，已知 ${S.recipes.length} 個。</div>`+
    RECIPES.map(r=>`<p>${esc(r.need.join("＋"))} → <b>${esc(r.out.n)}</b>（${esc(r.out.kind)}${r.out.tag?"・"+esc(TAGN[r.out.tag]||r.out.tag):""}）${r.nest!=null?"・要據點":""}・${S.recipes.includes(r.id)?"已知":"未知"}</p>`).join(""));
}
function sheetFuse(){
  sheet(`<h3>整合：3 個同類同階技能合成 1 個（高一階）</h3>`+S.skills.map((s,i)=>`<label class="ck"><input type="checkbox" class="fk" value="${i}">${esc(s.n)}（${s.cls}・${s.lv}）</label>`).join("")+`<button class="pri" id="fgo">開始</button>`);
  $("fgo").onclick=()=>{
    const ids=[...document.querySelectorAll(".fk:checked")].map(x=>+x.value);
    if(ids.length!==3)return alert("要選 3 個");
    const a=ids.map(i=>S.skills[i]);
    if(new Set(a.map(s=>s.cls)).size>1||new Set(a.map(s=>s.lv)).size>1)return alert("要同類、同階");
    if(a[0].lv==="S")return alert("已經是 S");
    closeSheet();openJudge("fuse",{fuse:ids,newLv:GRADES[gIdx(a[0].lv)+1]});
  };
}
function sheetTrade(){
  if(nestIdx()<2)return sheet("<p>據點要 D 級以上，才會有人肯做你的生意。（他們看到你就厭惡，買價 ×2）</p>");
  sheet(`<h3>交易</h3><div class="note">金幣 ${S.gold}。賣：</div>`+MATS.filter(m=>S.mats[m]).map(m=>`<button data-t="sell|${m}">賣 ${m}（${S.mats[m]}）+${SELL[m]}</button>`).join(" ")+
   `<div class="note">買（含厭惡加價）：</div>`+Object.keys(BUY).map(m=>`<button data-t="buy|${m}">${m} ${BUY[m]*2}</button>`).join(" "));
  $("sbody").querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{const [k,m]=b.dataset.t.split("|"),r=trade(k,m,1);if(r.err)alert(r.err);refresh();sheetTrade()});
}
function sheetStats(){
  const st=S.stats,row=(o)=>Object.entries(o).map(([k,v])=>k+" "+v).join("，")||"—";
  sheet(`<h3>統計（原型要看的數字）</h3>
  <p>據點達成天數：${row(st.nestDay)}</p><p>自身進化天數：${row(st.lvDay)}</p>
  <p>行動次數：${row(st.actions)}</p><p>技能使用次數：${row(st.skillUse)}</p>
  <p>物品使用：${row(st.itemUse)}</p><p>做出的物品：${row(st.crafted)}</p>
  <p>狩獵 成功/大成功/失敗：${st.hunts.ok}/${st.hunts.big}/${st.hunts.fail}</p>
  <p>襲擊：${st.raids.map(r=>r.lv+(r.res==="fail"?"✗":"✓")+"@"+r.day).join(" ")||"—"}</p>
  <p>OOC 更正：補登 ${st.ooc.add}・撤銷 ${st.ooc.remove}・改數 ${st.ooc.edit}</p>
  <button id="sexp">複製統計 JSON</button>`);
  $("sexp").onclick=()=>{try{navigator.clipboard.writeText(JSON.stringify(S.stats))}catch(e){}};
}
function sheetOoc(){
  sheet(`<h3>OOC：更正遊戲外的帳</h3><div class="note">AI 或你覺得算錯時用。不花遊戲時間。</div>
  <input id="on" placeholder="名稱（材料名、金幣、或物品名）"><input id="oc" type="number" value="1">
  <p><button id="oa">補登</button> <button id="or">撤銷</button></p>
  <p>直接改：<select id="of"><option value="hp">HP</option><option value="mp">MP</option><option value="gold">金幣</option></select><input id="ov" type="number"><button id="oe">改數</button></p>`);
  $("oa").onclick=()=>{if($("on").value){oocAdd($("on").value,+$("oc").value||1);refresh()}};
  $("or").onclick=()=>{if($("on").value){oocRemove($("on").value,+$("oc").value||1);refresh()}};
  $("oe").onclick=()=>{if($("ov").value!==""){oocSet($("of").value,+$("ov").value);refresh()}};
}
$("bset").onclick=()=>{
  sheet(`<h3>設定</h3><div class="note">不填金鑰也能玩（用程式內建的文字）。金鑰只存在這台裝置。</div>
  <label>Gemini API Key</label><input type="password" id="gk" value="${esc(ls.g("gm_key")||"")}">
  <label>模型名</label><input id="gm" value="${esc(ls.g("gm_model")||"gemini-2.5-flash")}">
  <p><button class="pri" id="gs">儲存</button></p>
  <p><button id="ex">匯出存檔</button> <button id="nw" class="bad">重新開始</button></p>`);
  $("gs").onclick=()=>{ls.s("gm_key",$("gk").value.trim());ls.s("gm_model",$("gm").value.trim());closeSheet()};
  $("ex").onclick=()=>{try{navigator.clipboard.writeText(JSON.stringify(S));alert("存檔已複製")}catch(e){}};
  $("nw").onclick=()=>{if(confirm("確定重新開始？")){newGame();draft=null;closeSheet();refresh()}};
};

/* ───── 選擇性的模型潤飾：只寫敘事，不改任何數字 ───── */
async function narrate(out){
  const k=ls.g("gm_key");if(!k||!out)return;
  const last=S.log[S.log.length-1];if(!last)return;
  const prompt=`你是異世界冒險的旁白。玩家是個孤獨、被所有人厭惡的轉生者。只用繁體中文寫 2～3 句描述剛發生的事，不要加任何新的物品、數字、人物或同伴，不要替玩家做決定。\n發生的事：${last.t}`;
  try{
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ls.g("gm_model")||"gemini-2.5-flash"}:generateContent?key=${encodeURIComponent(k)}`,
      {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
    const j=await r.json(),t=j.candidates&&j.candidates[0].content.parts.map(p=>p.text).join("").trim();
    if(t){log(t,"story");refresh()}
  }catch(e){}
}

if(!load())newGame();else heal();
refresh();
