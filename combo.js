/* isekai-playbook7｜combo.js（v5.1）：標籤式行動組合解析器。
   規格：Project《異世界RPG_標籤式行動組合解析器_規格_1112》。DW 的標籤＋大賢者的解析、拆解、組合。
   AI（大賢者）只把玩家的話拆成「步驟」；這裡只看標籤判斷每一步成不成立、算抵幾項代價。不改狀態（扣次數、MP、材料在 game.js 的 exec 做）。
   v5.1 第一步：只用在一般遭遇（不含升級戰、魔王戰）。招式、永久附加、5 標籤上限之後再接。 */
const ART_TAGS=ELEMS.concat(PROPS);
/* 原語：步驟要帶其中一個標籤才成立 */
const ART_PRIM={
  傷害:["切割","重量","硬化","火","水","風","魔力","土","暗","木","光"],
  防護:["硬化","包覆","土","水","風","木"],
  位移:["移動","風","重量"],
  破綻:["感知","聲音","光"],
  隱匿:["包覆","聲音","暗","木"],
  環境:["土","水","火","風","木"],
  附加:ART_TAGS,增幅:ART_TAGS};
const ART_CTRL={束縛:["包覆","重量","土","木"],減速:["水","土","包覆","暗","木"],致盲:["光","火","暗"],擊退:["重量","風"],
  窒息:["包覆","水","風"],威嚇:["火","光","聲音"],中毒:["暗"]};
const ART_PRIMS=Object.keys(ART_PRIM).concat("控制");
/* 對手標籤：先從現有資料推出來（類別、名字），之後再一隻一隻標 */
const ART_FOE={
  群體:"束縛沒用；傷害要帶火、風、水、土、木這種範圍性質",
  不呼吸:"窒息、中毒沒用",
  構裝:"威嚇、中毒沒用",
  巨大:"束縛、擊退要帶重量"};
function foeTags(){
  const e=S.enc;if(!e)return [];const t=foeTypes(),out=[];
  if(/群|大軍|軍團|騎士團/.test(e.n)||e.army)out.push("群體");
  if(t.includes("不死")||t.includes("構裝"))out.push("不呼吸");
  if(t.includes("構裝"))out.push("構裝");
  if(t.includes("龍")||/巨|大野豬|王/.test(e.n))out.push("巨大");
  return uniq(out);
}
/* 本來的用法：照大類（廢柴技能在戰鬥裡用，本來就算新用法）；組合學來的技能照形態 */
const FORM_PRIM={投射:"傷害",附加:"附加",領域:"環境",包住:"防護",威懾:"控制",感知:"破綻",點火:"傷害",壓縮:"傷害",強化:"增幅"};
const CAT_PRIM={戰鬥:"傷害",機動:"位移",生存:"環境",製作:"製作",魔法:"環境",社交:"社交",天生:"傷害"};
const SELF_TAGS=["移動","重量","感知"];
/* 戰鬥裡能拿來用的東西：技能（技能表＋魔法物品附帶）、武器、地形、自己、材料 */
function artSources(){
  const L=[];
  S.skills.concat(itemSkills()).forEach(s=>L.push({n:s.n,k:"skill",tags:s.e.slice(),p:s.f?FORM_PRIM[s.f]||"傷害":(s.c.includes("感知")||s.e.includes("感知")&&s.c.includes("機動")?"破綻":CAT_PRIM[s.c[0]]||"傷害"),s,left:usesLeft(s)}));
  const w=weaponIt();if(w){const tg=/弓|投石/.test(w.n)?["切割","移動"]:/斧|錘/.test(w.n)?["切割","重量"]:["切割"];if(w.mg&&w.mg.t==="elem")tg.push(w.mg.v);L.push({n:w.n,k:"weapon",tags:uniq(tg),p:"傷害"})}
  const P=placeOf();if(P&&P.e&&P.e.length)L.push({n:"周圍",k:"env",tags:P.e.slice(),p:"環境",label:`${P.n}的地形`});
  L.push({n:"自己",k:"self",tags:SELF_TAGS.slice(),p:"傷害",label:"你自己（徒手）"});
  MATS.filter(m=>S.mats[m]&&(ITEM_E[m]||[]).length).forEach(m=>L.push({n:m,k:"mat",tags:ITEM_E[m].slice(),p:"",left:S.mats[m]}));
  return L;
}
/* 檢查一組步驟。回傳每一步的結果、用到哪些來源、新用法幾步、能抵幾項 */
function artCheck(steps,o){
  o=o||{};const src=o.src||artSources(),by=n=>src.find(x=>x.n===n);
  const fired=[],idle=[],res=[],attached={},mp={v:S.mp};
  uniq(steps.map(x=>x.src)).forEach(n=>{const x=by(n);
    if(!x){idle.push(`手邊沒有${n}`);return}
    if(x.k==="skill"){if(x.left<1){idle.push(`【${n}】今天用完了`);return}
      if(!x.s.fromItem&&!o.practice){if(mp.v<1){idle.push(`【${n}】MP 不夠`);return}mp.v--}}
    fired.push(x)});
  const T=foeTags();
  steps.forEach((st,i)=>{
    const x=fired.find(f=>f.n===st.src),head=`${i+1}. ${x?x.label||x.n:st.src}・${st.prim}${st.kind?"・"+st.kind:""}${st.prim==="附加"&&st.to?"→"+st.to:""}${st.prim==="增幅"&&st.to?"→第"+st.to+"步":""}`;
    const r={head,say:st.say||"",prim:st.prim,kind:st.kind,ok:false,novel:false,tags:[]};res.push(r);
    if(!x){r.why="沒發動";return}
    const allow=uniq(x.tags.concat(attached[x.n]||[]));
    const tags=(st.tags||[]).filter(t=>allow.includes(t));r.tags=tags;
    if(!tags.length){r.why=`${x.label||x.n}沒有「${(st.tags||[]).join("、")||"這種"}」的性質`;return}
    if(st.prim==="控制"){const need=ART_CTRL[st.kind];if(!need){r.why="看不出是哪種控制";return}if(!tags.some(t=>need.includes(t))){r.why=`${st.kind}要有${need.join("、")}其中之一`;return}}
    else if(!ART_PRIM[st.prim]){r.why="看不出這一步在做什麼";return}
    else if(!tags.some(t=>ART_PRIM[st.prim].includes(t))){r.why=`${st.prim}要有${ART_PRIM[st.prim].join("、")}其中之一`;return}
    if(st.prim==="增幅"){const j=parseInt(st.to,10)-1,t=res[j];
      if(!(j>=0&&j<i&&t&&t.ok)){r.why="要增幅的那一步不存在或沒成立";return}
      const fit=t.prim==="控制"?(ART_CTRL[t.kind]||[]):(ART_PRIM[t.prim]||[]);
      if(!(tags.some(y=>t.tags.includes(y))||tags.some(y=>fit.includes(y))||(tags.includes("風")&&t.tags.includes("火"))||tags.includes("魔力"))){r.why="和要增幅的那一步沒有關聯";return}}
    if(S.enc&&!o.practice){const has=y=>tags.includes(y);
      if(st.prim==="傷害"&&T.includes("群體")&&!tags.some(y=>["火","風","水","土","木"].includes(y))){r.why="一群東西，單點的攻擊打不完";return}
      if(st.prim==="控制"){
        if(st.kind==="束縛"&&T.includes("群體")){r.why="一群東西束縛不住";return}
        if((st.kind==="窒息"||st.kind==="中毒")&&T.includes("不呼吸")){r.why=`${S.enc.n}不用呼吸`;return}
        if((st.kind==="威嚇"||st.kind==="中毒")&&T.includes("構裝")){r.why=`${S.enc.n}不會怕、也不吃毒`;return}
        if((st.kind==="束縛"||st.kind==="擊退")&&T.includes("巨大")&&!has("重量")){r.why=`${S.enc.n}太大，要帶重量才壓得住`;return}}}
    if(st.prim==="附加"&&st.to)attached[st.to]=uniq((attached[st.to]||[]).concat(tags));
    r.ok=true;
    r.novel=st.prim==="附加"||st.prim==="增幅"||x.p!==st.prim||tags.some(y=>!x.tags.includes(y));
  });
  const nSrc=fired.length,novel=res.filter(r=>r.ok&&r.novel).length;
  return {fired,idle,res,novel,cut:Math.min(novel,nSrc),nSrc,foe:T,
    skills:fired.filter(x=>x.k==="skill").map(x=>x.s),mats:fired.filter(x=>x.k==="mat").map(x=>x.n),
    mp:fired.filter(x=>x.k==="skill"&&!x.s.fromItem).length};
}
/* 給大賢者看的清單 */
function artListText(){
  return artSources().map(x=>`${x.n}｜${{skill:"技能",weapon:"武器",env:"地形",self:"徒手",mat:"材料（用了會少一份）"}[x.k]}｜標籤：${x.tags.join("、")}｜本來用法：${x.p||"無"}${x.k==="skill"?`｜今天剩 ${x.left} 次`:""}${x.k==="mat"?`｜有 ${x.left} 份`:""}`).join("\n");
}

/* ───── v5.3：招式 ─────
   成立、又有新用法的一組步驟＝一招。戰鬥裡第一次用就記下來；叫招名＝照那組步驟再來一次（照樣檢查、照樣消耗）。 */
const PRIM_WORD={傷害:"擊",防護:"盾",位移:"步",破綻:"破",隱匿:"隱",環境:"陣",附加:"附",增幅:"增"};
const CTRL_WORD={束縛:"縛",減速:"緩",致盲:"閃",擊退:"推",窒息:"悶",威嚇:"嚇",中毒:"毒"};
function moves(){return S.moves||(S.moves=[])}
const cleanStep=s=>({src:s.src,prim:s.prim,kind:s.kind||"",tags:(s.tags||[]).slice(),to:s.to||"",say:s.say||""});
function stepKey(steps){return steps.map(s=>[s.src,s.prim,s.kind||"",(s.tags||[]).slice().sort().join(""),s.to||""].join("/")).join("|")}
const isAct=x=>!["附加","增幅"].includes(x.prim);
const hasAct=steps=>steps.some(isAct);
function moveName(steps){
  const acts=steps.filter(isAct),main=acts[acts.length-1]||steps[steps.length-1],w=main.prim==="控制"?CTRL_WORD[main.kind]||"控":PRIM_WORD[main.prim]||"招";
  const tg=uniq(steps.flatMap(s=>(s.tags||[]).map(t=>t[0]))).slice(0,2).join("");
  const base=(main.src==="自己"||main.src==="周圍"?"":main.src.slice(0,2))+tg+w;let n=base,k=2;
  while(moves().some(m=>m.n===n))n=base+(k++);return n;
}
function stepWord(s){return `${s.src}${s.prim==="控制"?s.kind:s.prim}${(s.tags||[]).length?"〔"+s.tags.join("")+"〕":""}${s.prim==="附加"&&s.to?"→"+s.to:""}${s.prim==="增幅"&&s.to?"→第"+s.to+"步":""}`}
function moveText(m){return m.steps.map(stepWord).join(" → ")}
/* 同一招：用到的東西一樣、標籤一樣、最後做的事一樣（順序不同也算同一招） */
function moveSig(steps){const l=steps[steps.length-1];return `${uniq(steps.map(x=>x.src)).sort().join("+")}|${uniq(steps.flatMap(x=>x.tags||[])).sort().join("")}|${l.prim}${l.kind||""}`}
function learnMove(steps,how){
  if(!hasAct(steps))return null;
  const key=stepKey(steps),sig=moveSig(steps);if(moves().some(m=>m.key===key||(m.sig||moveSig(m.steps))===sig))return null;
  const m={n:moveName(steps),steps:steps.map(cleanStep),key,sig,day:S.day,how,used:0};moves().push(m);
  growAfterMove(m);return m;
}
/* ───── v5.4：招長成技能 ─────
   一個技能參與的招每攢 3 個 → 三選一：這個技能進化一階，或長出一個帶它標籤的新技能 */
function skillByName(n){return S.skills.concat(S.store).find(x=>x.n===n)}
function growAfterMove(m){
  uniq(m.steps.map(x=>x.src)).forEach(n=>{const s=skillByName(n);if(!s)return;s.mv=(s.mv||0)+1;if(s.mv%3===0)(S.growQ=S.growQ||[]).push(s.n)});
  nextGrow();
}
function growChoices(s){
  const ch=[],cap=Math.min(6,pg()+1);
  if(gIdx(s.lv)<cap)ch.push({evo:true,n:s.n,d:`【${s.n}】進化成 ${GRADES[gIdx(s.lv)+1]}（階層更高，對上高階的對手才派得上用場）`});
  shuffle(COMBOS.filter(t=>t.e.some(e=>s.e.includes(e))&&!nameTaken(t.n))).forEach(t=>{if(ch.length<3)ch.push(t)});
  if(ch.length<3)drawChoices(s.c[0]).forEach(t=>{if(ch.length<3&&!nameTaken(t.n)&&!ch.some(x=>x.n===t.n))ch.push(t)});
  return ch;
}
function nextGrow(){
  if(S.grow||!S.growQ||!S.growQ.length)return;
  const n=S.growQ.shift(),s=skillByName(n);if(!s)return nextGrow();
  const ch=growChoices(s);if(!ch.length)return nextGrow();
  S.grow={sk:n,mv:s.mv,ch};
}
function pickGrow(i){
  const g=S.grow;if(!g||!g.ch[i])return {err:"沒有這個選項"};
  const c=g.ch[i],s=skillByName(g.sk);S.grow=null;
  if(c.evo){if(s&&lvUp(s))log(`★ 【${s.n}】的招攢到 ${g.mv} 個，進化成 ${s.lv}。`,"good")}
  else{const where=learnSkill(c,s?s.lv:"F");
    log(`★ 【${g.sk}】的招攢到 ${g.mv} 個，長出新技能【${c.n}】${where==="倉庫"?"（技能表滿了，放進倉庫）":where==="滿了"?"（技能表和倉庫都滿了，沒學到）":""}。${c.d||""}`,"good");
    if(where==="技能表"||where==="倉庫"){gainExist(1);applyEffect({e:c.e,f:c.f||"",n:c.n,g:c.g},null)}}
  nextGrow();return {ok:true};
}
/* 招裡帶火、水、土牆 → 求生打勾（和舊的組合一樣） */
function moveNeeds(m){
  const T=uniq(m.steps.flatMap(x=>x.tags||[]));
  if(T.includes("火"))tick("火",`用【${m.n}】弄出了火`);
  if(T.includes("水")){tick("水",`用【${m.n}】弄到了水`);S.drank=true}
  if(m.steps.some(x=>["環境","防護"].includes(x.prim)&&(x.tags||[]).includes("土")))tick("避難所",`用【${m.n}】把土堆成能擋風雨的牆`);
}
function findMove(t){return moves().slice().sort((a,b)=>b.n.length-a.n.length).find(m=>t.includes(m.n))}
function renameMove(a,b){b=String(b||"").trim();const m=moves().find(x=>x.n===a);if(!m)return {err:`沒有【${a}】這一招`};
  if(!b)return {err:"新名字是空的"};if(moves().some(x=>x.n===b))return {err:`已經有【${b}】了`};m.n=b;return {ok:true}}
function forgetMove(n){const i=moves().findIndex(x=>x.n===n);if(i<0)return {err:"沒有這一招"};moves().splice(i,1);return {ok:true}}
/* 有步驟沒成立時，只留成立的部分（附加、增幅接到的步驟編號跟著改） */
function keepOk(steps,res){
  const map={},out=[];
  steps.forEach((st,i)=>{if(!res[i]||!res[i].ok)return;
    const c=cleanStep(st);if(c.prim==="增幅"){const j=map[parseInt(c.to,10)-1];if(j==null)return;c.to=String(j+1)}
    map[i]=out.length;out.push(c)});
  return out;
}
/* 戰鬥（一般遭遇）用完組合之後：記招、或留著給「記下」 */
function artAfter(q,out){
  const a=q.art,it=q.it;S.lastArt=null;
  if(it.move){const m=moves().find(x=>x.n===it.move);if(m&&stepKey(it.steps)===m.key){m.used++;return}}
  const allOk=a.res.every(r=>r.ok)&&!a.idle.length;
  if(allOk&&a.novel){const m=learnMove(it.steps,"戰鬥");if(m){out.gain.push(`招式【${m.n}】`);log(`★ 學會招式【${m.n}】：${moveText(m)}`,"good")}return}
  const ok=keepOk(it.steps,a.res);
  if(a.novel&&ok.length&&ok.length<it.steps.length){S.lastArt=ok;out.lines.push("有步驟沒成立；打「記下」可以只把成立的部分記成招。")}
}
function noteMove(){
  if(!S.lastArt||!S.lastArt.length)return {err:"現在沒有可以記下的組合"};
  const steps=S.lastArt;S.lastArt=null;
  const r=artCheck(steps,{practice:true});if(!r.novel)return {err:"成立的部分沒有新用法，記了也沒用"};
  const m=learnMove(steps,"記下");if(!m)return {err:"這一招已經會了"};
  log(`★ 記下招式【${m.n}】：${moveText(m)}`,"good");return {ok:true,m};
}
/* 戰鬥裡能直接使出的招（來源都在、次數夠） */
function readyMoves(){
  return moves().map(m=>({m,a:artCheck(m.steps)})).filter(x=>!x.a.idle.length&&x.a.res.every(r=>r.ok)).sort((x,y)=>y.a.cut-x.a.cut||y.m.used-x.m.used);
}
/* ───── v5.3：專心實驗（標籤版）─────
   一小時想一招：程式用標籤拼出「成立、又有新用法、還沒學過」的搭配，一定學會。
   參與的技能各扣今天一次次數（熟練跟著漲），不扣 MP；只是練手法，材料不會用掉。拼不出來就停。 */
const ART_DO=["傷害","防護","位移","破綻","隱匿","環境"];
const artUses=()=>ART_DO.map(p=>[p,""]).concat(Object.keys(ART_CTRL).map(k=>["控制",k]));
const needOf=(p,k)=>p==="控制"?ART_CTRL[k]||[]:ART_PRIM[p]||[];
function artGen(only){
  const src=artSources().filter(x=>x.k!=="skill"||x.left>0),U=artUses(),C=[];
  const want=x=>!only||!only.length||only.includes(x.n);
  const sk=src.filter(x=>x.k==="skill"),targets=src.filter(x=>["weapon","mat","self"].includes(x.k));
  sk.filter(want).forEach(A=>{
    /* 一步：技能拿去做本來以外的事 */
    U.forEach(([p,k])=>{if(p===A.p)return;const t=A.tags.filter(y=>needOf(p,k).includes(y));if(t.length)C.push({w:1,steps:[{src:A.n,prim:p,kind:k,tags:t.slice(0,2),to:""}]})});
    /* 兩步：把技能的標籤附加到武器、材料、自己身上，再拿那樣東西出手 */
    targets.forEach(B=>A.tags.filter(t=>!B.tags.includes(t)).forEach(t=>U.forEach(([p,k])=>{if(needOf(p,k).includes(t))
      C.push({w:3,steps:[{src:A.n,prim:"附加",kind:"",tags:[t],to:B.n},{src:B.n,prim:p,kind:k,tags:[t],to:""}]})})));
    /* 兩步：別的東西照本來用法出手，技能增幅它 */
    src.filter(B=>B!==A&&ART_PRIM[B.p]).forEach(B=>{const tb=B.tags.filter(y=>ART_PRIM[B.p].includes(y));if(!tb.length)return;
      A.tags.forEach(t=>{if(t===tb[0]||ART_PRIM[B.p].includes(t)||(t==="風"&&tb.includes("火"))||t==="魔力")
        C.push({w:2,steps:[{src:B.n,prim:B.p,kind:"",tags:[tb[0]],to:""},{src:A.n,prim:"增幅",kind:"",tags:[t],to:"1"}]})})});
  });
  const have={};moves().forEach(m=>have[m.sig||moveSig(m.steps)]=1);const seen={},ok=[];
  C.forEach(c=>{const k=moveSig(c.steps);if(have[k]||seen[k])return;seen[k]=1;
    const r=artCheck(c.steps,{practice:true,src});if(r.novel&&r.res.every(x=>x.ok)&&!r.idle.length)ok.push(c)});
  return ok;
}
function pickW(L,f){f=f||(x=>x.w);let t=L.reduce((a,x)=>a+f(x),0)*rand();for(const x of L){t-=f(x);if(t<0)return x}return L[L.length-1]}
function experiment(only,max){
  const e=calmErr();if(e)return {err:e};
  if(only&&only.length&&!only.some(n=>S.skills.concat(itemSkills()).some(s=>s.n===n)))return {err:`技能表裡沒有${only.join("、")}`};
  const got=[],extra={lines:[]},tried={};let h=0,why="";
  /* 打人、控制的招多一點；這次實驗已經用過的技能少一點，讓每個技能都輪到 */
  const wt=c=>c.w*(["傷害","控制"].includes(c.steps[c.steps.length-1].prim)?2:1)/(1+c.steps.reduce((a,x)=>a+(tried[x.src]||0),0));
  while(S.hour+h+1<24&&(!max||h<max)){
    const C=artGen(only);if(!C.length){why=h?"能拼的都拼過了，或技能今天的次數用完了":"想不出新的搭配：技能今天的次數用完了，或能拼的都拼過了。換個地方、拿到新材料、學新技能，就有新的搭配。";break}
    const c=pickW(C,wt),m=learnMove(c.steps,"實驗");h++;c.steps.forEach(x=>tried[x.src]=(tried[x.src]||0)+1);
    uniq(c.steps.map(x=>x.src)).forEach(n=>{const s=S.skills.concat(itemSkills()).find(y=>y.n===n);if(s)useSkill(s,extra)});
    got.push(m);
  }
  if(!h)return {err:why};
  count(S.stats.actions,"experiment");
  log(`[專心實驗] 花了 ${h} 小時，想到 ${got.length} 招${only&&only.length?`（只用${only.join("、")}）`:""}。${why?why+"。":""}`,"act");
  got.forEach(m=>{log(`★ 學會招式【${m.n}】：${moveText(m)}`,"good");moveNeeds(m)});
  advance(h);return {ok:true,h,learned:got.map(m=>m.n)};
}
/* 戰鬥外打字試招（大賢者拆步驟）：成立就學會；花 1 小時、參與的技能各扣一次，不扣 MP */
function practice(steps){
  const e=calmErr();if(e)return {err:e};
  const a=artCheck(steps,{practice:true}),out={lines:[]};
  if(!a.fired.length)return {err:"這句話裡沒看到要用哪個技能、武器、材料或地形"};
  a.skills.forEach(s=>useSkill(s,out));
  const lines=["試招："+a.res.map(r=>`${r.say||r.head}${r.ok?(r.novel?"（新用法）":"（照本來的用法）"):`（沒成立：${r.why}）`}`).join("；")+"。"];
  if(a.idle.length)lines.push(a.idle.join("、")+"，沒能發動。");
  let m=null;S.lastArt=null;
  if(a.res.every(r=>r.ok)&&!a.idle.length){if(!hasAct(steps))lines.push("只有附加、增幅，還沒拿來做事；再加一步（例如用加過標籤的東西攻擊）才算一招。");else if(a.novel){m=learnMove(steps,"試招");lines.push(m?`學會招式【${m.n}】。`:"這一招已經會了（一樣的東西、一樣的標籤、一樣的動作）。")}else lines.push("都是照本來的用法，不算新招。")}
  else{const ok=keepOk(steps,a.res);if(a.novel&&ok.length){S.lastArt=ok;lines.push("打「記下」可以只把成立的部分記成招。")}}
  count(S.stats.actions,"practice");log(`[試招] ${lines.join(" ")}`,"act");out.lines.forEach(x=>log(x,"good"));
  if(m){log(`★ 學會招式【${m.n}】：${moveText(m)}`,"good");moveNeeds(m)}
  advance(1);return {ok:true,m};
}
function movesListText(){return moves().map(m=>`${m.n}：${JSON.stringify(m.steps.map(s=>({src:s.src,prim:s.prim,kind:s.kind,tags:s.tags,to:s.to})))}`).join("\n")}
