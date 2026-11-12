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
function artCheck(steps){
  const src=artSources(),by=n=>src.find(x=>x.n===n);
  const fired=[],idle=[],res=[],attached={},mp={v:S.mp};
  uniq(steps.map(x=>x.src)).forEach(n=>{const x=by(n);
    if(!x){idle.push(`手邊沒有${n}`);return}
    if(x.k==="skill"){if(x.left<1){idle.push(`【${n}】今天用完了`);return}
      if(!x.s.fromItem){if(mp.v<1){idle.push(`【${n}】MP 不夠`);return}mp.v--}}
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
    if(S.enc){const has=y=>tags.includes(y);
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
