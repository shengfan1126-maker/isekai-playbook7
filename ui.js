/* isekai-playbook7｜ui.js：畫面、存檔、自由敘事流程。依賴 data.js、game.js、ai.js。 */
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const SAVE_KEY="isekai7_save_v2";
let draft=null;      // 判定面板：{it, p, shesh, said}
let toast="";        // 一行提示
let busy=false;      // 等 AI 回答中

function save(){ls.s(SAVE_KEY,JSON.stringify(S))}
function load(){try{const t=ls.g(SAVE_KEY);if(t){S=JSON.parse(t);return S&&S.ver===VER}}catch(e){}return false}
function healHad(){if(S.had)return;S.had=[];const add=n=>{if(n&&!S.had.includes(n))S.had.push(n)};
  S.skills.concat(S.store||[]).forEach(s=>add(s.n));(S.fac||[]).forEach(f=>f.s&&add(f.s.n));
  (S.log||[]).forEach(l=>{let m;const re=/學會【(.+?)】/g;while((m=re.exec(l.t)))add(m[1]);const f=l.t.match(/整合：(.+?) →/);if(f)f[1].split("＋").forEach(add)})}
function heal(){healHad();S.store=S.store||[];S.frags=S.frags||[];S.seen=[];if(S.mats&&S.mats.魔核){S.mats.無名魔核=(S.mats.無名魔核||0)+S.mats.魔核;delete S.mats.魔核}   /* v5.21：材料魔核改名無名魔核 */   /* v5.19：偷學拿掉 */S.scars=S.scars||[];S.items=S.items||[];S.mats=S.mats||{};worldFix();
  S.scars=S.scars.map(x=>OLD_SCAR[x]||x);S.pts=S.pts||0;S.fac=S.fac||[];S.facPick=S.facPick||null;S.raid=S.raid||null;
  if(S.ch>=2&&!S.bases){S.bases=[];   /* 舊存檔：從紀錄找出當過據點的地方 */
    S.log.forEach(l=>{const m=l.t.match(/你在(.+?)建立了 F 級據點/)||l.t.match(/你把據點搬到(.+?)[。，]/);if(m&&!S.bases.includes(m[1]))S.bases.push(m[1])});
    if(S.base&&!S.bases.includes(S.base))S.bases.push(S.base)}
  S.grow=null;S.growQ=[];S.pick=S.pick||null;if(!S.mvInit){S.mvInit=1;(S.moves||[]).forEach(m=>uniq(m.steps.map(x=>x.src)).forEach(n=>{const k=S.skills.concat(S.store).find(x=>x.n===n);if(k){k.mv=(k.mv||0)+1;if(k.mv%3===0)S.growQ.push(k.n)}}))}if(!S.grow&&typeof nextGrow==="function")nextGrow();if(S.pending&&S.pending.type==="raid")S.pending=null;if(!S.over&&gIdx(S.lv)>nestMax()){const was=S.lv;S.lv=GRADES[nestMax()];S.exist=Math.min(S.exist,EXIST_MAX(S.lv));S.capNote=0;S.hp=Math.min(S.hp,hpMax());S.mp=Math.min(S.mp,mpMax());log(`（v5.10 規則）玩家等級＝據點到過的最高等級：你從 ${was} 級回到 ${S.lv} 級。提升據點等級就會跟著進化。`,"bad")}if(!S.over)autoEvolve();if(S.ch===1&&!S.over)checkChapter();if(S.enc&&S.enc.raid&&!S.raid)S.enc=null;offerFac()}

/* ───── 狀態 ───── */
function renderStatus(){
  const left=Math.max(0,DAYS-S.day+1);
  const tags=[S.tags.飢餓&&"飢餓",S.tags.會冷&&"會冷",S.tags.疾病>0&&`疾病(${S.tags.疾病})`,S.thirst>0&&`口渴 ${S.thirst}/3`,...SCAR_PARTS.filter(p=>scarN(p)).map(p=>`捨身傷:${p}${scarN(p)>1?"×"+scarN(p):""}`)].filter(Boolean);
  const ck=`<span class="ck2 ${S.needs.避難所?"on":""}">${S.needs.避難所?"✔":"□"} 避難所</span>`;
  $("status").innerHTML=`<div class="row"><span>第 <b>${S.day}</b> 天 ${String(S.hour).padStart(2,"0")}:00</span><span>${S.ch===1?"第一章・求生":"第二章・據點"}</span><span>魔王倒數 <b>${left}</b></span></div>
  <div class="row"><span>${esc(S.at)}</span><span>你 <b>${S.lv}</b> 級 BP <b>${bpOf()}</b></span><span>HP <b>${S.hp}</b>/${hpMax()}</span><span>MP <b>${S.mp}</b>/${mpMax()}</span>${S.ch>1?`<span>據點 <b>${S.nest}</b> 點數 ${S.pts}</span>`:""}</div>
  ${S.raid?`<div class="note bad-t">${S.raid.kind==="boss"?"魔王戰":"升級戰"}：第 ${S.raid.i+1}/${S.raid.list.length} 場，已輸 ${S.raid.lost}/${S.raid.max}（再輸 ${S.raid.max-S.raid.lost+1} 場${S.raid.kind==="boss"?"就完了":"據點被攻破"}）${S.raid.shesh?"，這場已捨身過":""}</div>`:""}
  ${S.ch===1?`<div class="note"><b>目標：建立據點</b>——先有避難所：採集湊木材 3、草 3 →「製作」草棚（或占一個岩穴）。</div><div class="needs">${ck}</div>`:""}
  ${tags.length?`<div class="note bad-t">${tags.join("・")}</div>`:""}
  <div class="note">存在值 ${S.exist}/${EXIST_MAX(S.lv)}　碎片 ${S.frags.length}　技能 ${S.skills.length}/${SKILL_SLOTS}（倉庫 ${S.store.length}/${STORE_MAX[S.lv]}）　金幣 ${S.gold}　<a href="#" id="stbag">背包 ${bagWord()}・食物 ${foodCount()}</a></div>
  <div class="note">裝備：${SLOTS.filter(k=>S.eq[k]).map(k=>`${k} ${esc(S.eq[k].n)}${S.eq[k].mg?"✦":""}`).join("・")||"（沒有）"}</div>`;
  bindStatus();
}
function bindStatus(){const a=$("stbag");if(a)a.onclick=e=>{e.preventDefault();sheetBag()}}
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
  const lock=!!(S.pending||S.enc||draft||busy||S.pick);
  const ex=canExchange();
  const B=[["gather","採集"],["explore","探索"],["hunt","狩獵"],["train","鍛鍊"],["exp",`實驗 ${Math.max(0,2-(S.expToday||0))}/2`],["craft","製作"],["move","移動"],["rest","休息"],["sleep","睡覺"],...(homeAt()&&S.at!==homeAt()?[["home","回據點"],["homesleep","回據點睡覺"]]:[]),...(myHouses().length>1?[["fast","快速移動"]]:[]),...(S.ch>=2&&S.at!==S.base?[["house",houses().some(h=>h.at===S.at)?"房子":"蓋房子"]]:[]),...(foodCount()?[["eat",`吃東西 ${foodCount()}`]]:[]),
    ["skills","技能"],["frags",`碎片 ${S.frags.length}${ex.cats.length||ex.any?"！":""}`],["bag","背包・裝備"],["recipes","配方"]];
  const sp=specialHere();if(sp)B.push(["special",sp.label]);
  if(villageAt())B.push(["village",`${villageAt().n}`]);
  if(S.base&&S.at!==S.base&&mgOn("tele").some(x=>mgUses(x)>0))B.push(["tele","傳送回據點"]);
  if(S.ch===1&&S.needs.避難所&&S.shelterAt&&!S.pending)B.push(["ch2",S.at===S.shelterAt?"建立據點":"回避難所建立據點"]);
  if(S.ch===2){const b=canBuild();B.push(["base","據點"],["build",b?`升級據點→${b.target}（${S.pts}/${b.need}）`:"據點已是 S",!b||!b.ok],["movebase","搬家"],["trade","交易"]);}
  if(canEvolve())B.push(["evolve","進化"]);
  if(hasItem("potion"))B.push(["potion","用藥"]);
  if(S.items.some(i=>i.k==="cure")&&S.scars.length)B.push(["cure","治傷（萬靈藥）"]);
  const potionOk=hasItem("potion")&&!draft&&!busy&&!S.pending;   /* 戰鬥中也能喝，敵人會打你一下 */
  B.push(["stats","統計"],["ooc","OOC 更正"]);
  const info=["skills","frags","bag","recipes","stats","ooc","base","cure","village"];
  m.innerHTML=B.map(([k,t,d])=>`<button data-k="${k}" ${(d||(lock&&!info.includes(k)&&!(k==="potion"&&potionOk)))?"disabled":""}>${esc(t)}</button>`).join("");
  m.querySelectorAll("button").forEach(x=>x.onclick=()=>menuClick(x.dataset.k));
}
function refresh(){save();renderStatus();renderPanel();renderSay();renderMenu();renderLog()}

/* ───── 判定面板 ───── */
function openDraft(it,said){draft={it:Object.assign({skills:[],obj:{t:"none",n:""},move:"",goal:"",adv:[],dis:[]},it),p:{hp:0,mp:0,time:0,item:0,items:[]},shesh:false,said:said||""};toast="";
  if(it.costs&&it.costs.length){const q=planOf(draft.it);if(it.costs.includes("shesh"))draft.shesh=true;else{let n=q.need;it.costs.forEach(c=>{const t=Math.min(n,q.caps[c]||0);if(c==="item"){draft.p.items=autoPay(q,t).map(x=>x.t==="mat"?x:{t:x.t,it:x.it});draft.p.item=draft.p.items.length}else draft.p[c]=t;n-=t})}}
  renderAll()}
function renderAll(){renderStatus();renderPanel();renderSay();renderMenu()}
function renderPanel(){
  const P=$("panel");let h="";
  if(toast)h+=`<div class="toast">${esc(toast)}</div>`;
  if(S.over){P.innerHTML=h;return}
  if(S.pending&&!draft){const t=S.pending.type;
    if(t==="ch2"){P.innerHTML=h+`<div class="box"><b>建立據點</b><br>要在「${esc(S.at)}」建立據點，完成第一章、進入第二章嗎？${baseable(S.at)?"":"<br><b>這裡不能當據點</b>（要在野外，或打下來的敵對據點）。選「先不要」，走到別處再從選單建立。"}<br><span class="note">第二章：據點升級會被襲擊；搬家會讓據點變回 F 級、物資減半。</span>
      <p><button class="pri" id="c2y">在這裡建立據點</button> <button id="c2n">先不要</button></p></div>`;
      $("c2y").onclick=()=>{startCh2(true);refresh()};$("c2n").onclick=()=>{startCh2(false);refresh()};return}
    if(t==="failchoice"){const T=S.pending.boss?[]:moveTargets();
      P.innerHTML=h+`<div class="box">${S.pending.boss?"你被消滅了。":S.pending.why==="retreat"?"你放棄了據點。":"據點被攻破了，你還有一口氣。"}<br>`+
        (S.pending.boss?"":T.length?`<span class="note">搬家：帶一半的東西，到一個<b>還沒當過據點</b>的地方從 F 級重來（設施全毀、點數歸零）。搬過的地方不能再回去。</span><br>`+T.map(n=>`<button data-mv="${esc(n)}">搬到${esc(n)}</button> `).join(""):`<span class="note">你找到的地方都當過據點了，已經沒有地方可以搬。</span><br>`)+
        `<button class="bad" id="dd">陣亡</button></div>`;
      P.querySelectorAll("[data-mv]").forEach(b=>b.onclick=()=>{failChoice(b.dataset.mv);refresh()});$("dd").onclick=()=>{failChoice(false);refresh()};return}
    P.innerHTML=h+`<div class="box">365 天到了。魔王（BP 99）復活，帶著六個方位的大軍朝你來了。<br><span class="note">六場（每個方位一支軍團＋一隻 S 級魔物），最後是魔王。輸 4 場或輸給魔王就結束。魔王戰逃不掉。</span><br><button class="pri" id="go">迎擊</button></div>`;
    $("go").onclick=()=>{startBoss();refresh()};return}
  if(S.pick&&!draft&&!S.enc){const p=S.pick;
    P.innerHTML=h+`<div class="box"><b>${esc(p.why)}：三選一</b><br><span class="note">不喜歡可以重抽一次（不扣東西），也可以打字「這不是我要的」。</span>`+
      p.ch.map((c,i)=>`<p><button data-pk="${i}">${c.k==="evo"?`<b>進化【${esc(c.n)}】</b> ${c.from}→${c.to}<br><span class="note">階層更高，對上高階的對手才派得上用場。</span>`:c.k==="new"?`<b>新技能【${esc(c.t.n)}】</b>　${esc((c.t.c||[]).join("・"))}｜${esc((c.t.e||[]).join("・"))}<br><span class="note">${esc(c.t.d||"")}</span>`:`<b>化成據點點數 +${c.v}</b><br><span class="note">這次的心得不留成技能。</span>`}</button></p>`).join("")+
      `<p><button id="pkre" ${p.re?"disabled":""}>${p.re?"已經重抽過了":"重抽一次"}</button></p></div>`;
    P.querySelectorAll("[data-pk]").forEach(b=>b.onclick=()=>{const r=choosePick(+b.dataset.pk);if(r.err)toast=r.err;refresh()});
    $("pkre").onclick=()=>{const r=rerollPick();if(r.err)toast=r.err;refresh()};return}
  if(S.lootQ&&S.lootQ.length&&!draft&&!S.enc&&!S.pick){const L=S.lootQ[0];   /* v5.15：拆解 */
    P.innerHTML=h+`<div class="box"><b>拆解 ${esc(L.from)}（${L.lv}）：${L.k>1?`三選二（還能拿 ${L.k-L.got} 樣）`:"三選一"}</b><br><span class="note">部位能做白字裝備（打字「用鹿角做匕首」），也能捐、賣；魔核能跟白字裝備組合成魔法裝備，或鍛鍊一次學會它的技能。背包沒有上限。</span>`+
      L.ch.map((o,i)=>`<p><button data-lt="${i}">${esc(lootLabel(o))}</button></p>`).join("")+`<p><button id="ltno">剩下的不要了</button>${S.lootQ.length>1?`　<span class="note">後面還有 ${S.lootQ.length-1} 份</span>`:""}</p></div>`;
    P.querySelectorAll("[data-lt]").forEach(b=>b.onclick=()=>{const r=takeLoot(+b.dataset.lt);if(r.err)toast=r.err;refresh()});
    $("ltno").onclick=()=>{skipLoot();refresh()};return}
  if(S.facPick&&!draft&&!S.enc){
    P.innerHTML=h+`<div class="box"><b>蓋一座設施（三選一）</b>　據點 ${S.nest} 級可以有 ${FAC_SLOTS(nestIdx())} 座，現在 ${S.fac.length} 座。<br><span class="note">蓋好後要放一個技能進去才會運作（主角一個人，沒有人手）。每座在運作的設施，升級戰時擋掉 1 條「多打一」的劣勢。</span>`+
      S.facPick.map(n=>{const f=facDef(n);return `<p><button data-fp="${esc(n)}"><b>${esc(n)}</b>　對口：${esc(f.cat)}<br><span class="note">${esc(f.d)}${facHint(n)?"<br>"+esc(facHint(n)):""}</span></button></p>`}).join("")+`</div>`;
    P.querySelectorAll("[data-fp]").forEach(b=>b.onclick=()=>{pickFac(b.dataset.fp);refresh()});return}
  if(S.enc&&!draft){const R=S.enc.raid,E=S.enc,boss=R&&S.raid&&S.raid.kind==="boss";
    const rinfo=R?`${esc(E.dir)}。${E.army?"大軍，沒有技巧可學。":`牠會「${esc(E.t.n)}」（升級戰頭目的獨特技巧，學不來）。`}多打一：劣勢 ${E.dis||0} 條，設施擋掉 ${Math.min(E.dis||0,facBlock())} 條。這是關鍵戰（淨優勢最多 0），不能付「多花時間」，「用掉東西」只能用背包裡的物品、一場一件。${boss?"魔王戰逃不掉。":"逃走＝放棄據點（設施全毀、F 級重來、物資剩一半）。"}`:
      `牠會「${esc(E.t.n)}」。打、用組合、或撤退（撤退也要付代價，例如丟下東西）。${gIdx(E.lv)-pg()>=2?`<br><b>牠比你高 ${gIdx(E.lv)-pg()} 級，看起來打不贏。</b>${S.items.some(x=>x.k==="escape")?"撒逃跑粉就能脫身，不用付代價。":"沒有逃跑粉了（草 2、骨頭 1 可以做）。"}`:""}`;
    const ee=(E.e||[]).length?`屬性：${E.e.join("・")}${(E.e||[]).map(x=>Object.keys(COUNTER).filter(k=>COUNTER[k].includes(x))).flat().length?`（怕：${uniq(E.e.flatMap(x=>Object.keys(COUNTER).filter(k=>COUNTER[k].includes(x)))).join("、")}）`:""}。`:"";
    const ft=R?[]:foeTags(),fa=R?"":foeAtk();const ftx=ft.length||fa?`${ft.length?`特性：${ft.map(t=>`${t}（${ART_FOE[t]||""}）`).join("；")}。`:""}${fa?`攻擊帶「${fa}」${ELEMS.includes(fa)?`（有避${fa}的魔法裝備，輸了傷害減半）`:""}。`:""}`:"";
    const ww=S.eq.武器,wf=E.king?7:gIdx(E.lv);const wwarn=ww&&gIdx(ww.lv)<Math.min(6,wf)?`<br><b>你的${esc(ww.n)}是 ${ww.lv} 級，比牠低：拿來打會壞（不能修）。</b>判定時不勾「用」就不會壞，只是少 +1。`:"";
    const rr=E.amb?"<b>你被突襲了</b>：牠已經在身邊，拿遠程武器要多付 1 項拉開距離。":E.brk?"<b>這一面被突破</b>：敵人衝到身邊，拿遠程武器要多付 1 項拉開距離。":E.r?"牠在遠處（遠程）：近戰要多付 1 項才能接近。":"";
    P.innerHTML=h+`<div class="box enc"><b>${R?(boss?"魔王戰":"升級戰")+` 第 ${S.raid.i+1}/${S.raid.list.length} 場`:"遭遇"}：${esc(E.n)}（${E.lv} 級${E.king?"・BP 99":""}）</b>　你是 ${S.lv} 級。<br><span class="note">${ee}${esc(ftx)}${rr}${rinfo}${wwarn}也可以直接在上面打字說你要怎麼做：技能、武器、材料、地形想串幾個就串幾個，大賢者會拆成步驟，新用法每一步抵 1 項代價；組合成立還會靈光一閃（三選一）。戰鬥中也能喝藥（敵人會打你一下）。</span>
    <div class="row2"><button id="ef">${R?"迎擊":"戰鬥"}</button>${R?`<button id="ec">組合</button>`:""}${boss?"":`<button id="er">${R?"放棄據點逃走":"撤退"}</button>`}${!R&&S.items.some(x=>x.k==="escape")?`<button id="esc">撒逃跑粉（不用付代價）</button>`:""}</div></div>`;
    $("ef").onclick=()=>openDraft({act:"fight"});if($("ec"))$("ec").onclick=()=>openDraft({act:"combo",obj:{t:"enemy",n:S.enc.n}});if($("er"))$("er").onclick=()=>openDraft({act:"retreat"});if($("esc"))$("esc").onclick=()=>{const r=useEscape();if(r.err)toast=r.err;refresh()};
    return}
  if(!draft&&canReroll()){
    P.innerHTML=h+`<div class="box"><b>開局技能</b>　不喜歡就換，換到喜歡為止。做第一件事之後就不能換了。`+
      S.skills.map((s,i)=>`<div class="rr"><span><b>${esc(s.n)}</b> <small>${esc(s.c.join("・"))}｜${esc(s.e.join("・"))}</small><br><span class="note">${esc(s.d)}</span></span><button data-rr="${i}">換 ${i+1}</button></div>`).join("")+`</div>`;
    P.querySelectorAll("[data-rr]").forEach(b=>b.onclick=()=>{rerollStart(+b.dataset.rr);refresh()});return}
  if(!draft){P.innerHTML=h;return}
  const d=draft,it=d.it,q=planOf(it);d.q=q;
  const sel=(id,opts,val)=>`<select id="${id}">${opts.map(([v,t])=>`<option value="${esc(v)}" ${v===val?"selected":""}>${esc(t)}</option>`).join("")}</select>`;
  let f="";
  if(it.act==="combo"){
    f+=`<div class="lbl">技能（最多 3 個，MP＝技能數；✦魔法物品附帶的不扣 MP）</div><div class="chips">`+S.skills.concat(itemSkills()).map((s,i)=>`<label class="chip"><input type="checkbox" class="dsk" value="${esc(s.n)}" ${it.skills.includes(s.n)?"checked":""} ${usesLeft(s)<1?"disabled":""}>${s.fromItem?"✦":""}${esc(s.n)}<small>${s.lv}・${s.e.join("")}・剩${usesLeft(s)}${lowItem(s)?"・比對手低，用了會壞":""}</small></label>`).join("")+`</div>`;
    const objs=[["none|","不對誰（只疊技能）"],["place|"+S.at,`地點：${S.at}（${placeOf().e.join("・")}）`]]
      .concat(S.enc?[["enemy|"+S.enc.n,`眼前的${S.enc.n}`]]:[])
      .concat(S.items.concat(SLOTS.map(k=>S.eq[k]).filter(Boolean)).map(i=>["item|"+i.n,`物品：${i.n}`])).concat(MATS.filter(m=>S.mats[m]).map(m=>["item|"+m,`材料：${m}`]));
    f+=`<label class="ck">對象 ${sel("dob",objs,it.obj.t+"|"+(it.obj.n||""))}</label>`;
    f+=`<label class="ck">手法 ${sel("dmv",[["","（選一個）"]].concat(MOVES.map(m=>[m.n,`${m.n}（${m.f}）`])),it.move)}</label>`;
  }else if(it.act==="fight"&&q.art){
    f+=`<div class="lbl">大賢者拆出的步驟（標籤成立、又是新用法的，每一步抵 1 項）</div><div class="arts">`+q.art.res.map(r=>`<div class="${r.ok?(r.novel?"art-new":"art-ok"):"art-no"}">${esc(r.head)}${r.tags.length?`（${esc(r.tags.join("、"))}）`:""}　${r.ok?(r.novel?"新用法":"照本來的用法"):"不成立："+esc(r.why)}${r.say?`<br><span class="note">${esc(r.say)}</span>`:""}</div>`).join("")+`</div>`+
      (q.art.idle.length?`<div class="note">${esc(q.art.idle.join("、"))}，沒能發動。</div>`:"")+
      (q.art.foe.length?`<div class="note">${esc(S.enc.n)}的標籤：${q.art.foe.map(t=>`${t}（${ART_FOE[t]}）`).map(esc).join("；")}</div>`:"");
  }else if(["gather","explore","fight","craft","retreat","shelter","raid","boss"].includes(it.act)){
    f+=`<label class="ck">技能 ${sel("dsk1",[["","不用"]].concat(S.skills.concat(itemSkills()).map(s=>[s.n,`${s.fromItem?"✦":""}${s.n}（${s.lv}・${s.c.join("")}・剩${usesLeft(s)}${s.fromItem?"・不扣MP":""}${lowItem(s)?"・比對手低，用了會壞":""}）`])),it.skills[0]||"")}</label>`;
  }
  if(it.act==="craft")f+=`<label class="ck">做什麼 ${sel("dcr",[["","（選一個）"]].concat(RECIPES.map(r=>[r.n,`${r.n}（${Object.entries(r.need).map(([m,n])=>m+n).join("＋")}）`])),it.craft)}</label>`;
  if(it.act==="move")f+=`<label class="ck">去哪 ${sel("dpl",[["","（選一個）"]].concat(S.places.filter(n=>n!==S.at).map(n=>{const P=placeOf(n);return [n,n+(KIND_WORD[P.kind]?`（${KIND_WORD[P.kind]}）`:"")]})),it.place||"")}</label>`;
  const step=(k,t)=>`<div class="step"><span>${t}</span><button data-s="${k}-">−</button><span>${d.p[k]}/${q.caps[k]}</span><button data-s="${k}+">＋</button></div>`;
  const sum=sumPick(d.p),res=d.dance&&q.dance?"成功（替身代打）":d.shesh?"大成功（捨身）":sum<q.need?"失敗":sum<q.bigAt?"成功":"大成功";
  const en=S.enc&&["fight","retreat","combo"].includes(it.act)?`　對手：${esc(S.enc.n)}（${S.enc.lv}）`:"";
  h+=`<div class="box"><b>${ACT_NAME[it.act]||it.act}</b>${en}${d.said?`<div class="note">我理解成：${esc(it.say||d.said)}</div>`:""}${f}`;
  if(q.err)h+=`<div class="bad-t">${esc(q.err)}</div>`;
  else if(q.judge){
    h+=`<div class="note">${esc(q.notes.join("；")||"沒有加成")}</div>
    <div>淨優勢 ${q.net} → 要付 <b>${q.need}</b> 項代價成功，<b>${q.bigAt}</b> 項大成功${q.key?"（關鍵戰）":""}${q.mand.mp?`　另扣 MP ${q.mand.mp}`:""}</div>
    ${d.shesh?"":step("hp","受傷 −"+q.unit+" HP")+step("mp","MP −2")+step("time","多花 2 小時")+itemPicker(q)}
    ${q.weakWeapon?`<label class="ck"><input type="checkbox" id="dwp" ${it.weapon?"checked":""}>用${esc(q.weakWeapon.n)}（${q.weakWeapon.lv} 級，比對手低）：+1，但打完會壞、不能修</label>`:""}
    ${q.dance?`<label class="ck"><input type="checkbox" id="ddc" ${d.dance?"checked":""}>讓${esc(q.dance.n)}替你打這一場（今天 1 次，不用付代價就算贏）</label>`:""}
    ${q.raid&&S.raid&&S.raid.shesh?`<div class="note">這場${S.raid.kind==="boss"?"魔王戰":"升級戰"}已經捨身過一次了。</div>`:`<label class="ck">捨身（拿一個部位的傷換大成功${q.raid?"，一場升級戰只能一次":""}）<select id="dsh"><option value="">不捨身</option>${SCAR_PARTS.map(p=>`<option value="${p}" ${d.shesh===p?"selected":""}>${p}：${SCAR_D[p]}${scarN(p)?`（已傷 ${scarN(p)}）`:""}</option>`).join("")}<option value="rand" ${d.shesh===true?"selected":""}>隨便哪裡</option></select></label>`}
    ${S.scars.length?`<div class="note">身上的捨身傷：${S.scars.length} 處。打贏魔王時還有 ${BAD_END_SCARS} 處以上就是壞結局。據點 S 級後可以開發萬靈藥治好一處。</div>`:""}
    <div>目前 → <b>${res}</b>${it.act==="combo"?"（組合失敗也會得到碎片）":""}</div>`;
  }
  h+=`<p><button class="pri" id="dok" ${q.err?"disabled":""}>執行</button> ${q.key?"":`<button id="dno">取消</button>`}</p></div>`;
  P.innerHTML=h;
  P.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{const k=b.dataset.s.slice(0,-1),pl=b.dataset.s.slice(-1)==="+";d.p[k]=Math.max(0,Math.min(q.caps[k],d.p[k]+(pl?1:-1)));renderPanel()});
  P.querySelectorAll("[data-pi]").forEach(b=>b.onclick=()=>{const L=payables(q),x=L[+b.dataset.pi];if(!x||d.p.items.length>=q.caps.item)return;d.p.items.push(x.t==="mat"?{t:"mat",n:x.n}:{t:x.t,it:x.it});d.p.item=d.p.items.length;renderPanel()});
  P.querySelectorAll("[data-px]").forEach(b=>b.onclick=()=>{d.p.items.splice(+b.dataset.px,1);d.p.item=d.p.items.length;renderPanel()});
  P.querySelectorAll(".dsk").forEach(c=>c.onchange=()=>{let a=[...P.querySelectorAll(".dsk:checked")].map(x=>x.value);if(a.length>3){c.checked=false;a=a.filter(x=>x!==c.value)}it.skills=a;clampPick();renderPanel()});
  if($("dsk1"))$("dsk1").onchange=e=>{it.skills=e.target.value?[e.target.value]:[];clampPick();renderPanel()};
  if($("dob"))$("dob").onchange=e=>{const [t,n]=e.target.value.split("|");it.obj={t,n};renderPanel()};
  if($("dmv"))$("dmv").onchange=e=>{it.move=e.target.value;renderPanel()};
  if($("dcr"))$("dcr").onchange=e=>{it.craft=e.target.value;renderPanel()};
  if($("dpl"))$("dpl").onchange=e=>{it.place=e.target.value;renderPanel()};
  if($("ddc"))$("ddc").onchange=e=>{d.dance=e.target.checked;renderPanel()};
  if($("dwp"))$("dwp").onchange=e=>{it.weapon=e.target.checked;clampPick();renderPanel()};
  if($("dsh"))$("dsh").onchange=e=>{const v=e.target.value;d.shesh=v==="rand"?true:v||false;renderPanel()};
  if($("dno"))$("dno").onclick=()=>{draft=null;renderAll()};
  if(q.raid&&S.raid&&S.raid.shesh)d.shesh=false;
  $("dok").onclick=()=>{const q2=planOf(it);if(q2.err)return;narrFrom=S.logN||0;
    const out=exec(q2,Object.assign({},d.p,{shesh:d.shesh,dance:!!(d.dance&&q2.dance)}));const said=d.said;draft=null;refresh();narrate(said)};
}
function clampPick(){const q=planOf(draft.it);["hp","mp","time"].forEach(k=>draft.p[k]=Math.min(draft.p[k],q.caps[k]));draft.p.items=draft.p.items.slice(0,q.caps.item);draft.p.item=draft.p.items.length}
/* 付物品：自己選付哪一件。魔法物品一天 3 次；同一場選第 2 次會壞。壞掉、丟失都不能修 */
function itemPicker(q){
  const d=draft;if(!q.caps.item)return `<div class="note">用掉物品：${q.raid?"升級戰只能付背包或身上的物品，":""}現在沒有能付的。</div>`;
  const L=payables(q),cnt=new Map();d.p.items.forEach(x=>{const k=x.it||x.n;cnt.set(k,(cnt.get(k)||0)+1)});
  const word=q.act==="retreat"?"丟下":"用掉";
  const chosen=d.p.items.map((x,i)=>`<button class="chip on" data-px="${i}">${esc(x.t==="mat"?x.n:x.it.n)}${x.it&&x.it.mg&&d.p.items.filter(y=>y.it===x.it).indexOf(x)===1?"（會壞）":""} ✕</button>`).join(" ");
  const full=d.p.items.length>=q.caps.item;
  const opts=L.map((x,i)=>{const used=cnt.get(x.it||x.n)||0;const left=x.t==="mat"?(S.mats[x.n]||0)-used:x.it.mg?(used<2&&mgUses(x.it)>0?1:0):used?0:1;
    if(left<=0||full)return "";const warn=x.it&&x.it.mg?(used?"・再付就壞":"・魔力 1 次"):x.t==="eq"?"・會壞":"";
    return `<button class="chip" data-pi="${i}">${esc(x.label)}${warn}</button>`}).join(" ");
  return `<div class="step"><span>${word}物品 ${d.p.items.length}/${q.caps.item}</span></div>
    <div class="chips">${chosen||'<span class="note">（還沒選）</span>'}</div>${full?"":`<div class="chips">${opts}</div>`}
    <div class="note">${word}的東西不能修、找不回來。魔法物品付 1 次＝用掉當天 1 次魔力；同一場付第 2 次就壞。</div>`;
}

const lowItem=s=>!!(s&&s.fromItem&&S.enc&&gIdx(s.fromItem.lv)<Math.min(6,S.enc.king?7:gIdx(S.enc.lv)));
/* ───── 自由敘事 ───── */
async function sendSay(){
  const t=($("sayt").value||"").trim();if(!t)return;narrFrom=S.logN||0;
  if(S.pending||draft){toast="先處理上面的事。";renderPanel();return}
  if(S.pick){if(/不是我要|重抽|換一個|换一个|換別的|换别的|重來|重来/.test(t)){const r=rerollPick();if(r.err)toast=r.err}else toast="先選完三選一（不喜歡可以打「這不是我要的」重抽一次）。";refresh();return}
  {const r=!S.enc&&localGearCmd(t);if(r){if(r.err)toast=r.err;refresh();return}}   /* v5.18：「山鼠群魔核跟石矛組合」「鍛鍊山鼠群魔核」 */
  {const r=localCalm(t);if(r){if(r.err)toast=r.err;refresh();return}}
  {const r=!S.enc&&localPartCraft(t);if(r){if(r.err)toast=r.err;refresh();return}}   /* v5.15：「用鹿角做匕首」 */
  if(S.enc&&!S.enc.raid&&/逃跑粉|逃跑藥|逃跑药/.test(t)){const r=useEscape();if(r.err)toast=r.err;refresh();return}   /* v5.13：打字撒逃跑粉，不經過 AI、不付代價 */
  if(!AI.on()){toast="還沒設定 AI：按右上角 ⚙ 填 Gemini 或 OpenRouter 的金鑰。現在先用下面的按鈕。";renderPanel();return}
  busy=true;toast="";renderAll();
  try{
    if(S.enc&&!S.enc.raid){
      const r=await aiSteps(t);busy=false;
      if(r.act==="retreat"){openDraft({act:"retreat",costs:r.costs,say:r.say},t);return}
      if(r.act==="potion"){const i=S.items.findIndex(x=>x.k==="potion"&&(!r.potion||x.n===r.potion));const u=usePotion(i<0?null:i);if(u.err)toast=u.err;refresh();narrate(t);return}
      if(r.act==="talk"||!r.steps.length){log(`（你）${t}`);toast=r.steps.length?"":"大賢者：這句話裡沒看到要用哪個技能、武器、材料或地形。可以直接寫你怎麼打，例如「用溫度把刀燒熱，再砍牠」。";refresh();narrate(t);return}
      openDraft({act:"fight",steps:r.steps,say:r.say,costs:r.costs},t);return;
    }
    const it=await aiParse(t);
    busy=false;
    if(it.act==="combo"&&!S.enc){const x=experiment();if(x.err)toast=x.err;refresh();return}
    if(S.enc&&!["fight","retreat","combo","potion"].includes(it.act)){it.act=it.act==="talk"?"talk":"fight"}
    if(it.act==="sleep"){sleep();refresh();narrate(t);return}
    if(it.act==="potion"){const i=S.items.findIndex(x=>x.k==="potion"&&(!it.potion||x.n===it.potion));const r=usePotion(i<0?null:i);if(r.err)toast=r.err;refresh();narrate(t);return}
    if(it.act==="delve"){const r=startSpecial();if(r&&r.err)toast=r.err;refresh();narrate(t);return}
    if(it.act==="talk"){log(`（你）${t}`);refresh();narrate(t);return}
    if(["hunt","rest","explore","shelter"].includes(it.act)){const q=planOf(it);if(q.err){toast=q.err;refresh();return}exec(q,{});refresh();narrate(t);return}
    if(it.act==="craft"){if(!it.craft)return sheetCraft();const r=craftDirect(it.craft);if(r.err)toast=r.err;refresh();if(!r.err)narrate(t);return}
    openDraft(it,t);
  }catch(e){busy=false;toast="AI 出錯："+e.message+"（可以改用按鈕）";renderAll()}
}
/* v5.13：旁白只寫上次寫過之後的新紀錄（不會重複寫舊的）；寫好插回那件事的後面（不會落後到別的事情後面） */
let narrFrom=0;   /* 這次行動開始前的紀錄編號：旁白只寫這次行動之後的紀錄 */
async function narrate(said){
  if(!AI.on())return;
  const from=Math.max(S.narrN||0,narrFrom);
  const fresh=S.log.filter(l=>(l.n||0)>from&&l.type!=="story"&&l.type!=="letter"&&l.t);
  S.narrN=S.logN||0;
  if(!fresh.length)return;
  const anchor=fresh[fresh.length-1],prev=(S.log.filter(l=>l.type==="story").slice(-1)[0]||{}).t||"";
  try{const t=await aiNarrate(said,fresh.slice(-6).map(l=>l.t).join("\n"),prev);if(!t||t===prev)return;
    const e={day:anchor.day,hour:anchor.hour,t,type:"story",n:anchor.n};
    const i=S.log.indexOf(anchor);if(i<0)S.log.push(e);else{let j=i+1;while(j<S.log.length&&S.log[j].type==="story")j++;S.log.splice(j,0,e)}
    refresh()}catch(e){}
}

/* ───── 選單 ───── */
function menuClick(k){
  toast="";
  if(["gather","fight","retreat"].includes(k))return openDraft({act:k});
  if(k==="craft")return sheetCraft();
  if(k==="home"){const r=travel(homeAt(),false);if(r.err)toast=r.err;refresh();return}
  if(k==="homesleep"){const r=travel(homeAt(),true);if(r.err)toast=r.err;refresh();return}
  if(k==="fast")return sheetFast();
  if(k==="house")return sheetHouse();
  if(k==="move")return openDraft({act:"move"});
  if(k==="hunt"||k==="rest"||k==="explore"||k==="shelter"){const q=planOf({act:k});if(q.err){toast=q.err;refresh();return}exec(q,{});refresh();return}   /* v5.17：探索、占岩穴必成功，直接做 */
  if(k==="eat")return sheetEat();
  if(k==="train")return sheetTrain();
  if(k==="exp"){const r=experiment();if(r.err)toast=r.err;refresh();return}
  if(k==="sleep"){sleep();refresh();return}
  if(k==="ch2"){if(S.at!==S.shelterAt){const r=travel(S.shelterAt,false);if(r&&r.err){toast=r.err;refresh();return}}S.pending={type:"ch2"};refresh();return}
  if(k==="build")return sheetBuild();
  if(k==="movebase")return sheetMove();
  if(k==="evolve"){evolve();refresh();return}
  if(k==="potion")return sheetPotion();
  if(k==="special"){const r=startSpecial();if(r&&r.err)toast=r.err;refresh();return}
  if(k==="village")return sheetVillage();
  if(k==="tele"){const r=teleport();if(r.err)toast=r.err;refresh();return}
  if(k==="cure")return sheetCure();
  ({skills:sheetSkills,frags:sheetFrags,bag:sheetBag,recipes:sheetRecipes,stats:sheetStats,ooc:sheetOoc,trade:sheetTrade,base:sheetBase}[k]||(()=>{}))();
}
/* v5.12：每一頁上下各一個「關閉」；手機的「上一頁」只會關掉這一頁，不會離開遊戲 */
function sheetHist(){try{if(!(history.state&&history.state.sh))history.pushState({sh:1},"")}catch(e){}}
function dropHist(){try{if(history.state&&history.state.sh)history.back()}catch(e){}}
function sheet(html){$("sbody").innerHTML=`<div class="sxtop"><button class="close2" id="sx0">✕ 關閉</button></div>`+html+`<button class="close" id="sx">關閉</button>`;$("sheet").classList.add("on");sheetHist();$("sx").onclick=closeSheet;$("sx0").onclick=closeSheet}
function closeSheet(){$("sheet").classList.remove("on");dropHist();refresh()}
if(typeof window!=="undefined"&&window.addEventListener)window.addEventListener("popstate",()=>{let hit=false;
  if($("sheet")&&$("sheet").classList.contains("on")){$("sheet").classList.remove("on");hit=true}
  if($("setsheet")&&$("setsheet").classList.contains("on")){closeSet(true);hit=true}
  if(hit)refresh()});
function sheetSkills(){
  const row=(s,i,where)=>`<tr><td><input type="checkbox" class="fk" value="${where}|${i}"></td><td><b>${esc(s.n)}</b> ${s.lv}<br><span class="note">${s.c.join("・")}｜${s.e.join("・")}｜用了 ${s.used} 次｜今天剩 ${usesLeft(s)}</span></td><td><button data-sw="${where}|${i}">${where==="skills"?"→倉庫":"→技能表"}</button><br><button data-dn="${where}|${i}">捐 +${skillPts(s)}點</button>${canSellSkill()?` <button data-sl="${where}|${i}">賣 +${skillGold(s)}金</button>`:""} <button data-fo="${where}|${i}">忘掉</button></td></tr>`;
  sheet(`<h3>技能表 ${S.skills.length}/${SKILL_SLOTS}</h3><div class="note">每個技能一天 3 次。交換一次花 1 小時。勾 3 個同大類、同階的技能（技能表、倉庫都可以勾）可以整合成高一階（4 小時）。技能滿了：整合、捐掉（據點點數，隨時）、賣掉（金幣，要在村子或有商人來的 D 級以上據點），或忘掉。</div>
  <table>${S.skills.map((s,i)=>row(s,i,"skills")).join("")}</table><p><button id="fz">整合勾選的 3 個</button></p>
  <h3>倉庫 ${S.store.length}/${STORE_MAX[S.lv]}</h3><table>${S.store.map((s,i)=>row(s,i,"store")).join("")||"<tr><td>（空）</td></tr>"}</table>`);
  const two=(b,f)=>{const [w,i]=b.dataset[f].split("|");return [w,+i]};
  $("sbody").querySelectorAll("[data-dn]").forEach(b=>b.onclick=()=>{const r=donateSkill(...two(b,"dn"));if(r.err)toast=r.err;save();sheetSkills()});
  $("sbody").querySelectorAll("[data-sl]").forEach(b=>b.onclick=()=>{const r=sellSkill(...two(b,"sl"));if(r.err)toast=r.err;save();sheetSkills()});
  $("sbody").querySelectorAll("[data-fo]").forEach(b=>{let armed=false;b.onclick=()=>{if(!armed){armed=true;b.textContent="再按一次確定忘掉";return}forgetSkill(...two(b,"fo"));save();sheetSkills()}});
  $("sbody").querySelectorAll("[data-sw]").forEach(b=>b.onclick=()=>{const [w,i]=b.dataset.sw.split("|");const r=swapSkill(w,+i);if(r&&r.err)toast=r.err;save();sheetSkills()});
  $("fz").onclick=()=>{const ids=[...$("sbody").querySelectorAll(".fk:checked")].map(x=>x.value);const r=fuse(ids);if(r.err){toast=r.err;closeSheet()}else{save();sheetSkills()}};
}
/* v5.15：魔核組合、部位做裝備 */
function sheetCombine(ci){const c=S.items[ci];if(!isCore(c))return;const L=whiteRefs();
  sheet(`<h3>組合：${esc(c.n)}（${c.lv}）</h3><div class="note">白字裝備＋魔核 → 魔法裝備，帶技能 ${esc(coreWord(c))}（用它不扣 MP，一天 3 次，也能拿來付代價），等級變成 ${c.lv}。${atForge()?`在鍛冶台 ${COMBINE_H_FORGE} 小時。`:`${COMBINE_H} 小時（在據點的鍛冶台只要 ${COMBINE_H_FORGE} 小時）。`}</div>`+
    (L.length?`<table>${L.map(x=>`<tr><td>${esc(x.it.n)}（${x.it.lv}・${gearOf(x.it).slot}）${x.ref.startsWith("eq")?"（身上）":""}</td><td><button data-cg="${x.ref}">用這件</button></td></tr>`).join("")}</table>`:`<p class="note">沒有白字裝備。可以照配方做，或用部位做（打字「用鹿角做匕首」）。</p>`));
  $("sbody").querySelectorAll("[data-cg]").forEach(b=>b.onclick=()=>{const r=combineCore(ci,b.dataset.cg);if(r.err)toast=r.err;save();closeSheet()})}
function sheetPartCraft(pi){const p=S.items[pi];if(!isPart(p))return;
  sheet(`<h3>用${esc(p.n)}做裝備（${p.lv}）</h3><div class="note">${PART_CRAFT_H} 小時，做出來的白字裝備等級＝${p.lv}。也可以直接打字「用${esc(p.part)}做匕首」，名字照你說的。</div><table>`+
    WHITE_BASES.map(b=>`<tr><td>${esc(p.src+p.part+BASE_WORD[b])}（${gearOf({n:b}).slot}${gearOf({n:b}).wt?"・"+gearOf({n:b}).wt:""}）</td><td><button data-pb="${b}">做</button></td></tr>`).join("")+`</table>`);
  $("sbody").querySelectorAll("[data-pb]").forEach(b=>b.onclick=()=>{const r=craftPart(pi,b.dataset.pb);if(r.err)toast=r.err;save();closeSheet()})}
/* v5.16：鍛冶台 */
let FGT="";   /* 特定打造：打的字 */
function sheetForge(msg){
  const lv=S.nest||"F",c=orderCost(lv),u=useLv(lv),mg=[];SLOTS.forEach(k=>{if(S.eq[k]&&S.eq[k].mg)mg.push({ref:"eq:"+k,it:S.eq[k]})});S.items.forEach((it,i)=>{if(it.mg&&it.slot)mg.push({ref:"i:"+i,it})});
  const o=S.forgeOrder;
  sheet(`<h3>鍛冶台（${lv}）</h3>
  <h4>特定打造</h4><div class="note">說你想做什麼，例如「隱形皮甲」「吸血斧頭」「抗火頭盔」「加速靴」「看穿之眼戒指」。大賢者拆成 底子＋標籤＋用途，標籤做得到那個用途才做得出來。<br>做好的東西：做那種事時多 ${u.n} 條優勢${u.raid?"，升級戰、魔王戰也算":"（D 級起升級戰也算）"}${u.free?"，一天一次那件事不用付代價":""}；名字裡有「抗火、吸血、加速、飛行、守護、豐收、歸巢」這種字，還會多一個被動效果。全身的用途加成最多 +${USE_CAP}。<br>等級＝據點等級（${lv}），一件 ${FORGE_DAYS} 天，一次一件。材料：${costWord(c)}。</div>
  ${o?`<p><b>正在打造「${esc(o.n)}」</b>（${o.lv}・${esc(useWord(o.use))}），還要 ${o.left} 天。</p>`:`<p><input id="fgt" maxlength="12" placeholder="想做什麼？" value="${esc(FGT)}" style="font:inherit;padding:6px;width:60%"> <button id="fgok">打造</button></p>`}
  ${msg?`<p class="note">${esc(msg)}</p>`:""}
  <h4>改變外形</h4><div class="note">魔法裝備換成別的樣子（長矛 → 弓、皮甲 → 斗篷），等級、效果不變，${RESHAPE_H} 小時。</div>`+
  (mg.length?`<table>${mg.map(x=>`<tr><td>${esc(x.it.n)}（${x.it.lv}・${gearOf(x.it).slot}）</td><td><select data-rs="${x.ref}"><option value="">換成…</option>${WHITE_BASES.filter(b=>b!==(x.it.base||x.it.n)).map(b=>`<option value="${b}">${BASE_WORD[b]}（${gearOf({n:b}).slot}）</option>`).join("")}</select></td></tr>`).join("")}</table>`:`<p class="note">還沒有魔法裝備。</p>`)+
  `<h4>組合</h4><div class="note">白字裝備＋魔核在這裡做只要 ${COMBINE_H_FORGE} 小時（背包頁的魔核按「組合」）。</div>`);
  if($("fgok"))$("fgok").onclick=async()=>{FGT=$("fgt").value.trim();if(!FGT)return;
    let f=parseForgeLocal(FGT),why="";
    if((!f||forgeCheck(f))&&AI.on()){try{$("fgok").disabled=true;$("fgok").textContent="大賢者在想…";const a=await aiForge(FGT);if(a){if(!a.base&&f&&f.base)a.base=f.base;if(f&&f.x)a.x=f.x;f=a;why=a.why||""}}catch(e){why="AI 出錯："+e.message}}
    if(!f&&!AI.on())return sheetForge("看不出要什麼效果。名字裡加上「隱形」「吸血」「抗火」「加速」「看穿」這種字，或在設定填 AI 金鑰讓大賢者幫你拆。");
    const r=forgeOrder(f||{n:FGT});if(r.err)return sheetForge((why?why+"　":"")+r.err);FGT="";save();closeSheet()};
  $("sbody").querySelectorAll("[data-rs]").forEach(sl=>sl.onchange=()=>{if(!sl.value)return;const r=reshape(sl.dataset.rs,sl.value);if(r.err)return sheetForge(r.err);save();closeSheet()});
}
/* v5.2：專心鍛鍊、專心實驗 */
function sheetTrain(){
  const cs=S.items.map((it,i)=>({it,i})).filter(x=>isCore(x.it));
  const box=cs.length?`<h3>魔核</h3><div class="note">照著魔核鍛鍊 1 次（${CORE_TRAIN_H} 小時），就學會它的技能，等級＝魔核等級。魔核會化掉。</div><table>`+cs.map(x=>`<tr><td>${esc(x.it.n)}（${x.it.lv}）：${esc(coreWord(x.it))}</td><td><button data-tc="${x.i}">鍛鍊學會</button></td></tr>`).join("")+`</table>`:"";
  sheet(`<h3>專心鍛鍊</h3><div class="note">一小時練一次：扣今天的一次次數，熟練 +2（每 10 次進化一階）。不扣 MP。練到次數用完為止。也可以直接打字：「專心鍛鍊 發火」「鍛鍊 發火 2 次」。</div><table>`+
    S.skills.concat(S.store).map((s,i)=>`<tr><td><b>${esc(s.n)}</b>${i>=S.skills.length?"（倉庫）":""} ${s.lv}<br><span class="note">熟練 ${s.used}（下次進化在 ${Math.ceil((s.used+1)/10)*10}）｜今天剩 ${usesLeft(s)} 次</span></td><td><button data-tr="${i}" ${usesLeft(s)<1?"disabled":""}>練 ${usesLeft(s)} 小時</button></td></tr>`).join("")+`</table>`+box);
  $("sbody").querySelectorAll("[data-tc]").forEach(b=>b.onclick=()=>{const r=trainCore(+b.dataset.tc);if(r.err)toast=r.err;save();closeSheet()});
  $("sbody").querySelectorAll("[data-tr]").forEach(b=>b.onclick=()=>{const r=train(S.skills.concat(S.store)[+b.dataset.tr].n);if(r.err)toast=r.err;closeSheet()});
}
/* 打字的鍛鍊、實驗：程式自己認，不叫 AI */
function localCalm(t){
  const m=t.match(/^\s*(?:專心|专心)?(鍛鍊|锻炼|鍛煉|練習|练习|實驗|实验)(.*)$/);if(!m)return null;
  const exp=/實驗|实验/.test(m[1]),rest=m[2]||"";
  const nm=rest.match(/(\d+)\s*(?:次|小時|小时|個小時|个小时)/),max=nm?+nm[1]:0;
  const names=S.skills.map(s=>s.n).filter(n=>rest.includes(n));
  if(exp)return experiment();
  if(!names.length)return {err:"要鍛鍊哪個技能？例如「專心鍛鍊 發火」"};
  return train(names[0],max);
}
function sheetFrags(){
  const c=fragCounts(),ex=canExchange();
  let h=`<h3>技能碎片 ${S.frags.length}</h3><div class="note">升級戰的「組合」不管成敗都會留下碎片（以前的碎片也還能換）。3 片同大類 → 同大類三選一；10 片任意 → 任意三選一。跨大類的碎片每一類都算。</div>
  <p>${Object.entries(c).map(([k,n])=>`${k} ${n}`).join("、")||"還沒有碎片"}</p>`;
  h+=ex.cats.map(k=>`<button data-x="${k}">用 3 片「${k}」碎片換技能</button>`).join(" ");
  if(ex.any)h+=` <button data-x="">用 10 片任意碎片換技能</button>`;
  h+=`<div id="xch"></div>`;
  sheet(h);
  $("sbody").querySelectorAll("[data-x]").forEach(b=>b.onclick=()=>{const cat=b.dataset.x||null;const ch=drawChoices(cat);
    $("xch").innerHTML=`<h3>三選一</h3>`+ch.map((t,i)=>`<p><button data-c="${i}"><b>${esc(t.n)}</b>　${esc((t.c||[]).join("・"))}｜${esc((t.e||[]).join("・"))}<br><span class="note">${esc(t.d||"")}</span></button></p>`).join("")+`<div class="note">這次沒有想要的，可以先不換，下次再抽。</div>`;
    $("xch").querySelectorAll("[data-c]").forEach(x=>x.onclick=()=>{exchange(cat,ch[+x.dataset.c]);save();sheetFrags()})});
}
/* v5.8：製作（直接做）、材料、房子、快速移動 */
const GRP_ORDER=["求生","工具","藥","裝備"];
function recipeRow(r){
  const miss=lacks(r.need),fireMiss=r.cook&&!S.needs.火,q=planOf({act:"craft",craft:r.n}),hrs=q.hours;
  const why=fireMiss?"要先有火（先做火種）":miss.length?"還差 "+miss.join("、"):q.err||"";
  return `<tr><td><b>${esc(r.n)}</b><br><span class="note">${esc(costWord(r.need))}・${hrs} 小時<br>${esc(r.d)}</span></td><td><button class="${why?"":"pri"}" data-mk="${esc(r.n)}" ${why?"disabled":""}>做</button>${why?`<br><span class="note">${esc(why)}</span>`:""}</td></tr>`;
}
function sheetCraft(){
  const L=RECIPES.filter(recipeShown),off=!!(draft||busy||S.pending||S.enc||S.raid);
  sheet(`<h3>製作</h3><div class="note">點「做」就做，一定成功，只花時間（不用選技能、不付代價）。${RECIPES.some(r=>r.tag&&!hasTag(r.tag))?"有些配方要有帶某種標籤的技能才會出現。":""}</div>`+
    GRP_ORDER.map(g=>{const R=L.filter(r=>r.grp===g);return R.length?`<h4>${g}</h4><table>${R.map(recipeRow).join("")}</table>`:""}).join("")+
    (S.ch>=2?`<div class="note">房子（避難所）在別處用「蓋房子」，主據點用點數升級。</div>`:""));
  $("sbody").querySelectorAll("[data-mk]").forEach(b=>{if(off)b.disabled=true;b.onclick=()=>{const r=craftDirect(b.dataset.mk);if(r.err)toast=r.err;closeSheet()}});
}
function sheetMat(m){
  const use=RECIPES.filter(r=>recipeShown(r)&&r.need[m]);
  let h=`<h3>${m}×${S.mats[m]||0}</h3>`;
  if(FOODS.includes(m))h+=`<p><button class="pri" data-eat="${m}">吃</button>${m==="生肉"&&S.needs.火?` <button data-cook="1">烤（1 小時）</button>`:""}</p>`;
  h+=use.length?`<h4>能做</h4><table>${use.map(recipeRow).join("")}</table>`:`<p class="note">沒有用到它的配方。</p>`;
  const hu=HOUSES.filter(x=>x.cost[m]).map(x=>`${x.n}（${x.lv}）`);if(hu.length)h+=`<p class="note">蓋房子會用到：${hu.join("、")}</p>`;
  if(S.ch>=2)h+=`<p class="note">捐給據點：1 個 ${ptsOf(m)} 點（在「據點」頁捐）。</p>`;
  sheet(h);bindFood(()=>{save();sheetMat(m)});
  $("sbody").querySelectorAll("[data-mk]").forEach(b=>b.onclick=()=>{const r=craftDirect(b.dataset.mk);if(r.err)toast=r.err;closeSheet()});
}
function sheetHouse(){
  const ok=canHouseHere(),cur=houses().find(h=>h.at===S.at),cap=houseCap();
  let h=`<h3>${esc(S.at)}的房子</h3><div class="note">主據點只有一個（升級戰、設施只在主據點）。別處的房子<b>只能睡覺</b>，睡飽有那一級的效果；最高＝主據點 −1 級。一張地圖最多一間；拆掉拿回一半材料。打下來的敵對據點也能蓋，費用一樣。</div>`;
  if(cur)h+=`<p>現在：<b>${houseName(cur.lv)}（${cur.lv}）</b>　${esc(HOUSES.find(x=>x.lv===cur.lv).d)}${cur.rev?"（復活已用過）":""} <button id="raze">拆掉（1 小時）</button></p>`;
  if(ok!==true)h+=`<p class="note">${esc(ok)}</p>`;
  else h+=`<table>${HOUSES.filter(x=>gIdx(x.lv)<=cap).map(x=>{const miss=lacks(x.cost),same=cur&&cur.lv===x.lv;return `<tr><td><b>${x.n}（${x.lv}）</b><br><span class="note">${esc(costWord(x.cost))}・${4+gIdx(x.lv)} 小時<br>${esc(x.d)}（含更低等級的效果）</span></td><td><button data-bh="${x.lv}" ${miss.length||same?"disabled":""}>${cur?"改建":"蓋"}</button>${miss.length?`<br><span class="note">還差 ${esc(miss.join("、"))}</span>`:""}</td></tr>`}).join("")}</table>`;
  sheet(h);
  $("sbody").querySelectorAll("[data-bh]").forEach(b=>b.onclick=()=>{const r=buildHouse(b.dataset.bh);if(r.err)toast=r.err;closeSheet()});
  if($("raze"))$("raze").onclick=()=>{const r=razeHouse();if(r.err)toast=r.err;closeSheet()};
}
function sheetFast(){
  const L=myHouses();
  sheet(`<h3>快速移動</h3><div class="note">到自己的房子只要 1 小時。「去睡」＝走過去直接睡（睡飽有那一級的效果）。</div><table>${L.map((x,i)=>`<tr><td><b>${esc(x.at)}</b>${x.main?"（主據點）":x.ch1?"（避難所）":""}<br><span class="note">${houseName(x.lv)}（${x.lv}）</span></td><td>${x.at===S.at?`<span class="note">你在這裡</span>`:`<button data-ft="${i}">過去</button>`} <button data-fs="${i}">去睡</button></td></tr>`).join("")}</table>`);
  $("sbody").querySelectorAll("[data-ft]").forEach(b=>b.onclick=()=>{const r=travel(L[+b.dataset.ft].at,false);if(r.err)toast=r.err;closeSheet()});
  $("sbody").querySelectorAll("[data-fs]").forEach(b=>b.onclick=()=>{const r=travel(L[+b.dataset.fs].at,true);if(r.err)toast=r.err;closeSheet()});
}
/* v5.7：吃東西（選單「吃東西」、背包都能點） */
function foodHtml(off){
  const food=FOODS.filter(m=>S.mats[m]);
  return `<h3>食物</h3><div class="note">點了就吃，不花時間：熟肉回 30% HP，野果、生肉回 10%（沒火吃生肉可能生病）。今天吃過，晚上就不會飢餓。${S.needs.火?"有火：生肉可以烤成熟肉（1 小時）。":"還沒有火：做出火種之後才能烤肉。"}${S.ateToday?"<br>今天已經吃過了。":""}</div>`+
    (food.length?`<table>`+food.map(m=>`<tr><td>${m}×${S.mats[m]}</td><td><button class="pri" data-eat="${m}" ${off?"disabled":""}>吃</button>${m==="生肉"&&S.needs.火?` <button data-cook="1" ${off?"disabled":""}>烤（1 小時）</button>`:""}</td></tr>`).join("")+`</table>`:`<p class="note">（沒有食物：林邊空地、草原採得到野果，溪邊採得到生肉，打倒魔物也會掉肉。）</p>`);
}
function bindFood(R){
  $("sbody").querySelectorAll("[data-eat]").forEach(b=>b.onclick=()=>{const r=eatFood(b.dataset.eat);if(r.err)toast=r.err;R()});
  $("sbody").querySelectorAll("[data-cook]").forEach(b=>b.onclick=()=>{const r=cookMeat();if(r.err)toast=r.err;R()});
}
function sheetEat(){
  const off=!!(draft||busy||S.pending||S.enc||S.raid);
  sheet(`<div class="note">HP ${S.hp}/${hpMax()}</div>`+foodHtml(off));bindFood(()=>{save();sheetEat()});
}
function sheetBag(){
  const lock=!!(draft||busy||S.pending),inFight=!!S.enc;
  let h=`<h3>裝備</h3><div class="note">武器 +1；遠程再 +1；近戰打遠程的對手要多付 1 項才能接近；雙手近戰大成功少付 1 項。盾、衣服、頭減傷。比對手等級低的裝備用完就壞（不能修）。✦＝魔法物品（一個效果、一天 3 次）。</div><table>`+
    SLOTS.map(k=>{const it=S.eq[k];return `<tr><td>${k}</td><td>${it?esc(itemDesc(it)):'<span class="note">（空）</span>'}</td><td>${it&&!inFight?`<button data-uq="${k}" ${lock?"disabled":""}>卸下</button>`:""}</td></tr>`}).join("")+`</table>`;
  const fg=canForge();
  h+=`<h3>背包 ${bagWord()}</h3>`+(fg===true?`<p><button id="gofg" ${lock?"disabled":""}>鍛冶台（特定打造、改外形）</button>${S.forgeOrder?`　<span class="note">正在打造「${esc(S.forgeOrder.n)}」，還要 ${S.forgeOrder.left} 天</span>`:""}</p>`:`<div class="note">鍛冶台：${fg}。</div>`)+
    `<table>`+(S.items.map((it,i)=>`<tr><td>${esc(itemDesc(it))}</td><td>${it.slot&&!inFight?`<button data-eq="${i}" ${lock?"disabled":""}>裝上</button>`:""}${it.k==="potion"?`<button data-dr="${i}" ${lock?"disabled":""}>喝</button>`:""}${isCore(it)&&!inFight?` <button data-cb="${i}" ${lock?"disabled":""}>組合</button> <button data-ct="${i}" ${lock?"disabled":""}>鍛鍊學會</button>${S.items.some((x,j)=>j!==i&&isCore(x)&&x.lv===it.lv&&it.lv!=="S")?` <button data-cm="${i}" ${lock?"disabled":""}>合成升級</button>`:""}`:""}${isPart(it)&&!inFight?` <button data-pc="${i}" ${lock?"disabled":""}>做成裝備</button>`:""}</td></tr>`).join("")||"<tr><td>（空）</td></tr>")+`</table>`;
  h+=foodHtml(lock||inFight);
  h+=`<h3>材料</h3><p class="chips">${MATS.filter(m=>S.mats[m]).map(m=>`<button class="chip" data-mat="${m}">${m}×${S.mats[m]}</button>`).join(" ")||"（空）"}</p><div class="note">點材料看能做什麼。</div><p>金幣：${S.gold}　語言：${S.langs.join("、")||"沒有"}</p>
  <p>已知地點：${S.places.map(n=>{const p=placeOf(n);return `${n}（${KIND_WORD[p.kind]?KIND_WORD[p.kind]+"・":""}${p.e.join("・")}${p.water?"・有水":""}${p.cave?"・岩穴":""}${p.kind==="hostile"&&S.cleared.includes(n)?"・已打下":""}）`}).join("、")}</p>
  <div class="note">相剋：水剋火、火剋木、木剋土、土剋風、風剋水；光暗互剋；切割剋包覆、重量剋硬化。剋到對手多 1 條優勢。</div>`;
  sheet(h);
  const R=()=>{save();sheetBag()};
  $("sbody").querySelectorAll("[data-uq]").forEach(b=>b.onclick=()=>{const r=unequip(b.dataset.uq);if(r.err)toast=r.err;R()});
  $("sbody").querySelectorAll("[data-eq]").forEach(b=>b.onclick=()=>{const r=equip(+b.dataset.eq);if(r.err)toast=r.err;R()});
  $("sbody").querySelectorAll("[data-cb]").forEach(b=>b.onclick=()=>sheetCombine(+b.dataset.cb));
  $("sbody").querySelectorAll("[data-ct]").forEach(b=>b.onclick=()=>{const r=trainCore(+b.dataset.ct);if(r.err)toast=r.err;save();closeSheet()});
  $("sbody").querySelectorAll("[data-cm]").forEach(b=>b.onclick=()=>{const i=+b.dataset.cm,j=S.items.findIndex((x,k)=>k!==i&&isCore(x)&&x.lv===S.items[i].lv);const r=mergeCores(i,j);if(r.err)toast=r.err;save();closeSheet()});
  $("sbody").querySelectorAll("[data-pc]").forEach(b=>b.onclick=()=>sheetPartCraft(+b.dataset.pc));
  bindFood(R);
  $("sbody").querySelectorAll("[data-mat]").forEach(b=>b.onclick=()=>sheetMat(b.dataset.mat));
  $("sbody").querySelectorAll("[data-dr]").forEach(b=>b.onclick=()=>{usePotion(+b.dataset.dr);closeSheet()});
  if($("gofg"))$("gofg").onclick=()=>sheetForge();
}
function sheetPotion(){
  const L=S.items.map((it,i)=>[it,i]).filter(([it])=>it.k==="potion");
  sheet(`<h3>喝藥</h3>${S.enc?`<div class="bad-t">戰鬥中喝藥，${esc(S.enc.n)}會打你一下（HP −${hpUnit(!!S.enc.raid)}）。</div>`:""}`+
    L.map(([it,i])=>`<p><button data-dr="${i}">喝${esc(it.n)}</button> <span class="note">${potionWord(it.n)}</span></p>`).join(""));
  $("sbody").querySelectorAll("[data-dr]").forEach(b=>b.onclick=()=>{usePotion(+b.dataset.dr);closeSheet()});
}
function sheetVillage(){
  const P=villageAt();if(!P)return;const R=RACES[P.race],rel=relOf(P.race),lang=knowsLang(R.lang),lock=!!(S.enc||S.pending||busy);
  const tr=tradeRel(P.race);
  let h=`<h3>${esc(P.n)}</h3><p>${P.race}對你：<b>${REL_WORD[rel]}</b>（你身上的異香讓他們討厭你，最多只到中立；警戒時價錢 ×2，中立 ×1.5）。金幣 ${S.gold}。</p>
  <p class="note">貿易關係：${tr?`<b>已建立</b>。可以買${esc(RACE_ITEM[P.race].n)}；打倒魔王時有貿易關係的聚落會跟你一起生活（好結局）。`:`還沒有（要${lang?"✔":"✘"}會${R.lang}、${rel>=0?"✔":"✘"}態度中立、${S.traded[P.race]?"✔":"✘"}在這裡買賣過）。有了才買得到${esc(RACE_ITEM[P.race].n)}（${esc(RACE_ITEM[P.race].d)}）。`}</p>`;
  if(rel<0)h+=`<p><button data-v="gift|gold" ${lock?"disabled":""}>送禮（金幣 ${VILLAGE_PRICE.gift}）</button> <button data-v="gift|core" ${lock?"disabled":""}>送禮（無名魔核 ×2）</button> <span class="note">態度 +1</span></p>`;
  if(rel<-1)h+=`<p class="bad-t">他們敵視你，連話都不跟你說。先送禮。</p>`;
  else{
    if(!lang)h+=`<p><button data-v="lang" ${lock?"disabled":""}>學${R.lang}（${Math.ceil(VILLAGE_PRICE.lang*relMult(P.race))} 金幣，4 小時）</button> <span class="note">不會語言不能交易、不能學技能。</span></p>`;
    else{
      const has=racialOwned(P.race);
      h+=`<p>${has?`你已經學過【${R.sk.n}】。`:`<button data-v="skill" ${lock?"disabled":""}>學【${R.sk.n}】（${Math.ceil(VILLAGE_PRICE.skill*relMult(P.race))} 金幣，6 小時）</button>`}<br><span class="note">${esc(R.sk.d)}放進「${FAC.find(f=>f.race===P.race).n}」效果更好；升級戰對上${R.vs}多一條優勢。</span></p>`;
      h+=`<h4>買（今天的貨）</h4>`+villageStock().map((x,i)=>`<button data-v="buy|${i}" ${lock?"disabled":""}>${esc(x.n)} ${x.p}</button>`).join(" ");
      h+=`<h4>賣</h4>`+MATS.filter(m=>S.mats[m]).map(m=>`<button data-v="sell|${m}" ${lock?"disabled":""}>${m}（${S.mats[m]}）+${Math.ceil((SELL[m]||1)*sellMult())}</button>`).join(" ");
    }
  }
  sheet(h);
  $("sbody").querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{const [k,a]=b.dataset.v.split("|");
    const r=k==="gift"?villageGift(a):k==="lang"?villageLang():k==="skill"?villageSkill():k==="buy"?villageBuy(+a):villageSell(a,1);
    if(r&&r.err)toast=r.err;save();sheetVillage()});
}
function sheetRecipes(){
  sheet(`<h3>配方</h3><table>${RECIPES.map(r=>`<tr><td><b>${r.n}</b></td><td>${Object.entries(r.need).map(([m,n])=>m+"×"+n).join("＋")}</td><td class="note">${r.d}</td></tr>`).join("")}</table>
  <div class="note">也可以直接打字，例如「我用石片和木頭做一把石刀」。</div>`);
}
function exportText(){
  return `孤獨異世界紀錄 v${APP_VER}（存檔 ${VER}）\n第${S.day}天 ${String(S.hour).padStart(2,"0")}:00　第${S.ch}章　在${S.at}　${S.lv}級 BP${bpOf()}　HP ${S.hp}/${hpMax()}　MP ${S.mp}\n`+
   `避難所：${S.needs.避難所?"✔":"✘"}　房子：${myHouses().map(h=>`${h.at}${h.lv}`).join("、")||"無"}\n技能：${S.skills.map(s=>`${s.n}${s.lv}(用${s.used})`).join("、")}\n倉庫：${S.store.map(s=>s.n).join("、")||"無"}\n`+
   `碎片：${S.frags.length}\n材料：${MATS.filter(m=>S.mats[m]).map(m=>m+"×"+S.mats[m]).join("、")}　物品：${S.items.map(i=>i.n).join("、")}　裝備：${SLOTS.filter(k=>S.eq[k]).map(k=>k+"="+S.eq[k].n).join("、")}　金幣 ${S.gold}\n`+
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
  <p>直接改：<select id="of"><option value="hp">HP</option><option value="mp">MP</option><option value="gold">金幣</option><option value="避難所">避難所（1＝打勾，0＝取消）</option></select><input id="ov" type="number"><button id="oe">改</button></p>`);
  $("oa").onclick=()=>{if($("on").value){oocAdd($("on").value.trim(),+$("oc").value||1);save();closeSheet()}};
  $("or").onclick=()=>{if($("on").value){oocRemove($("on").value.trim(),+$("oc").value||1);save();closeSheet()}};
  $("oe").onclick=()=>{if($("ov").value!==""){oocSet($("of").value,+$("ov").value);save();closeSheet()}};
}
function sheetBase(){
  const b=canBuild(),lock=!!(S.enc||S.pending||busy);
  let h=`<h3>據點 ${S.nest} 級（${esc(S.base||"")}）</h3><p class="note">還能搬的地方：${moveTargets().length?esc(moveTargets().join("、")):"沒有"}</p><p>點數 <b>${S.pts}</b>${b?`　升到 ${b.target} 要 ${b.need}`:"　已是 S"}</p>
  <div class="note">捐物資換點數：一般材料 1 點、獸皮 2、無名魔核 4、物品 ${ITEM_PTS}。捐出去就沒了。升一級就會引來一場升級戰。</div>
  ${b&&S.pts<b.need?`<p><button id="dnext" ${lock?"disabled":""}>捐到夠升 ${b.target}（還差 ${b.need-S.pts} 點）</button> <span class="note">先捐骨頭、獸皮、無名魔核，再木材、石片、草，食物留 5 份。</span></p>`:""}<table>`+
  MATS.filter(m=>S.mats[m]).map(m=>`<tr><td>${m}×${S.mats[m]}</td><td class="note">${ptsOf(m)} 點</td><td><button data-dn="${m}|1" ${lock?"disabled":""}>捐 1</button> <button data-dn="${m}|h" ${lock?"disabled":""}>捐一半</button> <button data-dn="${m}|a" ${lock?"disabled":""}>全捐</button></td></tr>`).join("")+`</table>`;
  if(S.items.length)h+=`<p class="note">物品（背包 ${bagWord()}）：</p><p>`+S.items.map((it,i)=>`<button data-di="${i}" ${lock?"disabled":""}>捐 ${esc(it.n)}</button>`).join(" ")+`</p>`;
  if(S.nest==="S")h+=`<p><button id="retire" ${lock?"disabled":""}>蓋${MANSION.n}（退休）</button> <span class="note">${esc(costWord(MANSION.cost))}。${esc(MANSION.d)}</span></p>`;
  if(S.nest==="S")h+=`<p><button id="mkcure" ${lock?"disabled":""}>開發萬靈藥（無名魔核 5、草 5，4 小時）</button> <span class="note">治好一處捨身傷。</span></p>`;
  h+=`<h3>設施 ${S.fac.length}/${FAC_SLOTS(nestIdx())}</h3><div class="note">放一個技能進去才會運作；技能大類對口效果更好。放進去的技能離開技能表，拿回來放回技能表（滿了進倉庫）。放、拿各花 1 小時。升級戰時，每座在運作的設施擋掉 1 條劣勢。</div>`;
  h+=S.fac.map((f,fi)=>{const d=facDef(f.n);return `<div class="box"><b>${esc(f.n)}</b>　對口：${esc(d.cat)}${f.s?(facMatch(f)?"　✔對口":""):"　（沒在運作）"}<br><span class="note">${esc(d.d)}${facHint(f.n)?"<br>"+esc(facHint(f.n)):""}</span><br>
    ${f.s?`技能：【${esc(f.s.n)}】${f.s.lv}・${esc(f.s.c.join("・"))} <button data-fo="${fi}" ${lock?"disabled":""}>拿回來</button>`:""}
    <select data-fs="${fi}" ${lock?"disabled":""}><option value="">${f.s?"換成…":"放一個技能進去…"}</option>${S.skills.map((s,si)=>`<option value="${si}">${esc(s.n)}（${s.lv}・${esc(s.c.join("・"))}${s.c.includes(d.cat)?"・對口":""}）</option>`).join("")}</select></div>`}).join("")||"<p>（還沒有設施）</p>";
  sheet(h);
  const R=()=>{save();sheetBase()};
  $("sbody").querySelectorAll("[data-dn]").forEach(x=>x.onclick=()=>{const [m,k]=x.dataset.dn.split("|");const n=k==="1"?1:k==="h"?Math.ceil((S.mats[m]||0)/2):(S.mats[m]||0);donate(m,n);R()});
  if($("dnext"))$("dnext").onclick=()=>{const r=donateToNext();if(r.err)toast=r.err;R()};
  if($("retire")){let armed=false;$("retire").onclick=()=>{if(!armed){armed=true;$("retire").textContent="再按一次：真的要退休（遊戲結束）";return}const r=retire();if(r.err)toast=r.err;closeSheet()}}
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
  const weap=hasWeapon()?1:0,pot=S.items.filter(i=>i.k==="potion").length,pay=payables({raid:true}).length;
  const unit=hpUnit(true),warn=[];
  if(S.hp<hpMax())warn.push(`HP 沒滿（${S.hp}/${hpMax()}）。輸一場扣 ${unit}，${S.hp<=unit?"<b>輸一場就會死</b>":`大約輸 ${Math.ceil(S.hp/unit)} 場會死`}。`);
  if(S.mp<mpMax())warn.push(`MP 沒滿（${S.mp}/${mpMax()}）。用技能一場扣 1，付代價一次扣 2。`);
  if(!weap)warn.push("沒有裝備武器（武器一場 +1，遠程再 +1）。");
  if(!pot)warn.push("沒有藥。");
  const top=P.rounds?P.mon:P.mon.reduce((a,g)=>gIdx(g)>gIdx(a)?g:a);
  if(gIdx(top)-gIdx(S.lv)>=2)warn.push(`你是 ${S.lv} 級，對手最高 ${top} 級，差 ${gIdx(top)-gIdx(S.lv)} 級。`);
  if(!moveTargets().length)warn.push("已經沒有能搬的地方：這一戰輸了就是陣亡。");
  if(S.hour>=18)warn.push("天快黑了，打完才能睡（升級戰中間不能睡）。");
  sheet(`<h3>升級據點 → ${b.target}？</h3>
  <p>升級後<b>馬上</b>開打：${what}。輸 ${lose} 場或 HP 歸零，據點被攻破；中途逃走＝放棄據點。被攻破只能搬家（去沒當過據點的地方）或陣亡。還能搬的地方：${moveTargets().length?esc(moveTargets().join("、")):"<b>沒有了，被攻破就是陣亡</b>"}。</p>
  <p class="note">你現在：${S.lv} 級，HP ${S.hp}/${hpMax()}，MP ${S.mp}/${mpMax()}，武器 ${hasWeapon()?esc(S.eq.武器.n):"沒有"}、藥 ${pot}（可付代價的物品 ${pay} 件，一場最多付 1 件）；運作中的設施 ${facOn().length} 座（擋 ${facBlock()} 條劣勢）。</p>
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
  sheet(`<h3>交易</h3><div class="note">金幣 ${S.gold}。賣：</div>`+MATS.filter(m=>S.mats[m]).map(m=>`<button data-t="sell|${m}">賣 ${m}（${S.mats[m]}）+${Math.ceil((SELL[m]||1)*sellMult())}</button>`).join(" ")+
   `<div class="note">買（厭惡加價）：</div>`+Object.keys(BUY).map(m=>`<button data-t="buy|${m}">${m} ${Math.ceil(BUY[m]*2*buyMult())}</button>`).join(" "));
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
/* v5.10：欄位是空的就不蓋掉已經存的金鑰（避免不小心清掉）；要清掉金鑰請打「清除」 */
function keepKey(k,el){const v=el.value.trim();if(v==="清除"){ls.d(k);el.value="";return}if(v)ls.s(k,v);else if(ls.g(k))el.value=ls.g(k)}
function closeSet(fromBack){disarmNewg();keepKey("or_key",EL.key);keepKey("gm_key",EL.gkey);ls.s("or_model",EL.model.value.trim());$("setsheet").classList.remove("on");if(fromBack!==true)dropHist();refresh()}
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function initSettings(){
  $("mseg").querySelectorAll("button").forEach(b=>b.onclick=()=>{MODE=b.dataset.m;ls.s("mowu_mode",MODE);modeUI()});
  $("pseg").querySelectorAll("button").forEach(b=>b.onclick=()=>{PROV=b.dataset.p;ls.s("mowu_prov",PROV);provUI()});
  $("regem").onclick=async()=>{const b=$("regem");keepKey("gm_key",EL.gkey);b.disabled=true;b.textContent="抓取中…";
    try{await gemModels(true)}catch(e){snoteSet("抓不到："+(e.message||e),1)}b.disabled=false;b.textContent="重新抓 Gemini 模型名單";provUI()};
  $("refree").onclick=async()=>{const b=$("refree");b.disabled=true;b.textContent="抓取中…";
    try{await cachedList("free",true);ls.s("mowu_bad","{}")}catch(e){snoteSet("抓不到："+(e.message||e),1)}b.disabled=false;b.textContent="重新抓免費模型名單";modeUI()};
  $("bset").onclick=()=>{modeUI();provUI();snoteSet("");$("setsheet").classList.add("on");sheetHist()};
  if($("setdone0"))$("setdone0").onclick=()=>closeSet();
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
