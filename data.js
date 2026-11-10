/* 魔物篇｜data.js：工具、世界資料（地區、生物、技能池、勢力、地點網、章節、進化戰對手、魔法原料）。
   所有 .js 共用同一個全域範圍，載入順序見 index.html；改之前先讀 README.md。 */
/* ═════════ 工具 ═════════ */
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const ls={g:k=>{try{return localStorage.getItem(k)}catch(e){return null}},s:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},
          d:k=>{try{localStorage.removeItem(k)}catch(e){}}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const SAVE_KEY="mowu_save_v2";

/* ═════════ 世界資料 ═════════ */
const PROS=["赤貧","貧窮","普通","富裕","豪富"];
const POP=["離散","衰退","穩定","成長","興盛"];
const NAMELESS=[0,2,5,9,15];   // 人口格 1～5 對應的「沒有名字的族人」大約數量（v0.37：叙事不准多寫）
const DEF=["沒人能打","幾隻能打的","守得住洞口","有像樣的獵手","有一群好手","一方強者","大部族"];
const TRACK_HINT={p:"存糧",pop:"哥布林數量",d:"能打的"};
const GRADES=["F","E","D","C","B","A","S"];
const gIdx=g=>Math.max(0,GRADES.indexOf(g||"F"));
const capOf=lv=>lv==="F"?3:lv==="E"?4:5;          // 技能等級上限：F3、E4、D 以上 5
const PERIOD=h=>h<5?"深夜":h<8?"清晨":h<11?"上午":h<14?"中午":h<17?"下午":h<19?"傍晚":"夜裡";
const isDay=h=>h>=6&&h<18;
const pad2=n=>String(n).padStart(2,"0");
const HUNGER={"幼體":{full:8,every:4},"成體":{full:24,every:24}};   // 吃飽撐幾小時／餓著每幾小時 HP -1
const hungerOf=()=>HUNGER[S.stage]||HUNGER["成體"];
const nowH=()=>S.day*24+S.hour;
const timeStr=()=>`第${S.day}天 ${pad2(S.hour)}:${pad2(S.min||0)}`;
const MENU_HOURS={scav:1,nest:1,forage:2,hunt:3,explore:3};
/* 新鮮食材：活物、蛋、新鮮植物；乾掉的、工具材料不算 */
const CREATURE=/蟲|蟋蟀|鼠|雀|鳥|蛇|蜥|蛙|魚|兔|蝠|蛛|蛹|蛋|蝸|蚯|蝦|蟹/;
const PLANT=/草|苔|菇|蘑|花|葉|藤|根|果|莓|籽|松子|芽|蕨/;
const DRY=/乾|枯|朽|燒|烤|骨|皮|牙|齒|爪|繩|刀|石|木|棍|鱗|羽毛/;
/* 做出來的裝備、工具、材料：就算名字裡有「藤」「蟲」也是物品，不是食材 */
const GEAR=/甲|盔|殼|劍|矛|斧|弓|箭|盾|鎧|護|衣|袍|鞋|靴|套|帽|巾|項鍊|戒|杖|錘|鎚|叉|網|袋|囊|罐|器|具|牌|片|塊|柄|針|刃|鉤|索|鞭|角|篝火|陷阱/;
const isFreshFood=n=>(CREATURE.test(n)||PLANT.test(n))&&!DRY.test(n)&&!GEAR.test(n);
const EDIBLE_ITEM=n=>/果|莓|菇|根|苔|蟲|肉|蛋|籽|松子|蛹|草|葉|花|乾/.test(n)&&!/刀|繩|石|棍|骨|牙|齒|皮|鱗/.test(n)&&!GEAR.test(n);
const SYSTEMS=["火","水","風","土","光","暗","武技","意圖","天生"];
/* v0.26：主角技能沒有 Lv，只有等級字母（學到時的主角等級）。分「可用」和「倉庫」，
   數量看主角等級：[可用上限, 倉庫上限]。總數可以超過可用上限，多的自動放倉庫；倉庫滿了要整合或放棄。 */
const SKILL_BOX={F:[6,15],E:[9,15],D:[9,20],C:[9,20],B:[9,30],A:[9,30],S:[9,30]};
const boxCap=g=>SKILL_BOX[g||"F"]||SKILL_BOX.F;
const isUq=s=>s.sys==="Unique";
/* 技能的功能類（整合時同功能才能併）。沒有存欄位，照名字猜；順序有關，前面先中 */
const SK_FN=[["生活",/手巧|鍛冶|料理|野外求生|設陷阱|開鎖|挖掘|掘土|打洞|讀寫|草藥/],["恢復",/再生|治癒|淨化|蛻皮|斷尾/],
  ["感知",/視|眼|聽|嗅|感知|警覺|定位|觸鬚|追蹤|鑑定|銳/],["威懾",/威嚇|統率|戰吼|咆哮|狡詐|交涉|學舌|鳴叫|群狩|祈禱/],
  ["防禦",/殼|皮|甲|盾|抗|耐|堅|鱗|厚|硬|紮根|痛覺遲鈍/],["攻擊",/牙|爪|咬|擊|撞|術|斧|劍|矛|弓|毒|火|球|角|蠻力|怪力|狂暴|鉗|吸血|俯衝|獠|熊掌|投擲|硫磺|黏液|孢子|吐絲|長舌|岩蹄|尾/],
  ["移動",/跳|走|游|爬|飛|滑|潛|敏捷|輕身|多足|擬態|方向感|疾/]];
const fnOf=s=>s.fn||(SK_FN.find(([,re])=>re.test(s.n))||["其他"])[0];
/* 整合用的大類（v0.30.3：細分功能靠名字猜常猜錯、又太雜湊不齊，改成三大類） */
const FN_CLS={攻擊:"戰鬥",防禦:"戰鬥",威懾:"戰鬥",感知:"機動",移動:"機動",恢復:"生存",生活:"生存",其他:"生存"};
const clsOf=s=>FN_CLS[fnOf(s)]||"生存";
const realSk=()=>S.skills.filter(s=>!isUq(s));
const boxList=b=>realSk().filter(s=>(s.box||"act")===b);
const DMG=[3,5,8,12,17,23,30];
const dmgOf=lv=>Math.max(1,DMG[gIdx(lv||"F")]-(typeof allyShield==="function"&&S?allyShield():0));                 // 對手打你一下：F 3、E 5、D 8、C 12…
const existGain=lv=>Math.max(0,1+gIdx(lv||"F")-gIdx((S&&S.lv)||"F"));
const existMax=lv=>10*2**gIdx(lv||"F");   // 存在值上限：F 10、E 20、D 40、C 80、B 160、A 320、S 640
const rnd=a=>a[Math.floor(Math.random()*a.length)];
const rint=(a,b)=>a+Math.floor(Math.random()*(b-a+1));

/* 常見生物的技能池：吃到同一種就從同一池抽，已經會的技能不再出現 */
const POOLS={
  "老鼠":[{n:"齧咬",sys:"天生"},{n:"夜視",sys:"天生"},{n:"病菌抗性",sys:"天生"}],
  "山鼠":[{n:"齧咬",sys:"天生"},{n:"夜視",sys:"天生"},{n:"打洞",sys:"土"}],
  "洞穴蜘蛛":[{n:"毒牙",sys:"天生"},{n:"爬壁",sys:"天生"},{n:"吐絲",sys:"天生"}],
  "雪兔":[{n:"跳躍",sys:"天生"},{n:"耐寒",sys:"天生"},{n:"敏銳聽覺",sys:"天生"}],
  "岩蜥":[{n:"硬皮",sys:"天生"},{n:"斷尾",sys:"天生"},{n:"耐寒",sys:"天生"}],
  "硫磺山羊":[{n:"角擊",sys:"天生"},{n:"硫磺氣息",sys:"火"},{n:"岩蹄",sys:"土"}],
  "渡鴉":[{n:"銳眼",sys:"天生"},{n:"學舌",sys:"意圖"},{n:"夜視",sys:"天生"}],
  "野豬崽":[{n:"衝撞",sys:"天生"},{n:"厚脂",sys:"天生"},{n:"嗅覺",sys:"天生"}],
  "雪雀":[{n:"耐寒",sys:"天生"},{n:"輕身",sys:"風"}],
  "蟲子":[{n:"硬殼",sys:"天生"},{n:"病菌抗性",sys:"天生"}],
  "灰狼":[{n:"狼牙",sys:"天生"},{n:"嗅覺",sys:"天生"},{n:"群狩",sys:"意圖"},{n:"耐寒",sys:"天生"}],
  "冰蝠":[{n:"回聲定位",sys:"風"},{n:"夜視",sys:"天生"},{n:"吸血",sys:"天生"}],
  "山貓":[{n:"利爪",sys:"天生"},{n:"潛行",sys:"暗"},{n:"夜視",sys:"天生"}],
  "哥布林":[{n:"棍術",sys:"武技"},{n:"蠻力",sys:"天生"},{n:"威嚇",sys:"意圖"}],
  "蟋蟀":[{n:"跳躍",sys:"天生"},{n:"硬殼",sys:"天生"},{n:"鳴叫",sys:"意圖"}],
  "鳥蛋":[{n:"耐寒",sys:"天生"},{n:"銳眼",sys:"天生"}],
  "苔蘚":[{n:"耐寒",sys:"天生"},{n:"再生",sys:"天生"}],
  "寒霜草":[{n:"耐寒",sys:"天生"},{n:"冰抗",sys:"水"}],
  "蘑菇":[{n:"毒抗",sys:"天生"},{n:"孢子",sys:"天生"}],
  "蟲蛹":[{n:"硬殼",sys:"天生"},{n:"蛻皮",sys:"天生"}],
  "樹根":[{n:"紮根",sys:"土"},{n:"耐寒",sys:"天生"}],
  "松子":[{n:"硬殼",sys:"天生"}],
  "狐狸":[{n:"敏捷",sys:"天生"},{n:"狡詐",sys:"意圖"},{n:"嗅覺",sys:"天生"}],
  "雪原鹿":[{n:"疾走",sys:"天生"},{n:"耐寒",sys:"天生"},{n:"警覺",sys:"天生"}],
  "石甲蟲":[{n:"硬殼",sys:"天生"},{n:"掘土",sys:"土"}],
  "冰鱒":[{n:"游泳",sys:"水"},{n:"耐寒",sys:"天生"}],
  "盲眼蝦":[{n:"觸鬚感知",sys:"天生"},{n:"硬殼",sys:"天生"}],
  "巨蛙":[{n:"長舌",sys:"天生"},{n:"跳躍",sys:"天生"},{n:"黏液",sys:"水"}],
  "諾姆":[{n:"手巧",sys:"意圖"},{n:"夜視",sys:"天生"},{n:"狡詐",sys:"意圖"}],
  "野豬人":[{n:"衝撞",sys:"天生"},{n:"厚皮",sys:"天生"},{n:"獠牙",sys:"天生"}],
  "鐵殼蜈蚣":[{n:"鐵殼",sys:"土"},{n:"毒顎",sys:"天生"},{n:"多足",sys:"天生"}],
  "禿鷲":[{n:"銳眼",sys:"天生"},{n:"滑翔",sys:"風"},{n:"病菌抗性",sys:"天生"}],
  "樹皮毒蛛":[{n:"毒牙",sys:"天生"},{n:"擬態",sys:"暗"},{n:"吐絲",sys:"天生"}],
  "水獺":[{n:"游泳",sys:"水"},{n:"潛水",sys:"水"}],
  "冰甲蟹":[{n:"冰殼",sys:"水"},{n:"鉗擊",sys:"天生"}],
  "狗頭人":[{n:"挖掘",sys:"土"},{n:"設陷阱",sys:"意圖"},{n:"嗅覺",sys:"天生"}],
  "大哥布林":[{n:"棍術",sys:"武技"},{n:"蠻力",sys:"天生"},{n:"統率",sys:"意圖"}],
  "獸人":[{n:"戰吼",sys:"意圖"},{n:"斧術",sys:"武技"},{n:"蠻力",sys:"天生"},{n:"痛覺遲鈍",sys:"天生"}],
  "食人魔":[{n:"怪力",sys:"天生"},{n:"厚皮",sys:"天生"},{n:"大胃",sys:"天生"}],
  "巨魔":[{n:"再生",sys:"天生"},{n:"怪力",sys:"天生"},{n:"夜視",sys:"天生"}],
  "飛龍":[{n:"飛行",sys:"風"},{n:"毒尾",sys:"天生"},{n:"龍鱗",sys:"天生"},{n:"俯衝",sys:"風"}],
  "人類":[{n:"劍術",sys:"武技"},{n:"讀寫",sys:"意圖"},{n:"交涉",sys:"意圖"},{n:"鑑定",sys:"意圖"}],
  "冒險者":[{n:"劍術",sys:"武技"},{n:"野外求生",sys:"意圖"},{n:"鑑定",sys:"意圖"}],
  "精靈":[{n:"弓術",sys:"武技"},{n:"草藥學",sys:"意圖"},{n:"風語",sys:"風"},{n:"治癒",sys:"光"}],
  "矮人":[{n:"鍛冶",sys:"意圖"},{n:"礦物鑑定",sys:"意圖"},{n:"斧術",sys:"武技"},{n:"堅韌",sys:"天生"}],
  "半身人":[{n:"料理",sys:"意圖"},{n:"潛行",sys:"暗"},{n:"投擲",sys:"武技"},{n:"好運",sys:"天生"}],
  "半獸人":[{n:"戰吼",sys:"意圖"},{n:"斧術",sys:"武技"},{n:"蠻力",sys:"天生"},{n:"夜視",sys:"天生"}],
  "牛頭人":[{n:"衝撞",sys:"天生"},{n:"方向感",sys:"意圖"},{n:"巨斧術",sys:"武技"}],
  "蜥蜴人":[{n:"鱗甲",sys:"天生"},{n:"游泳",sys:"水"},{n:"矛術",sys:"武技"}],
  "灰熊":[{n:"蠻力",sys:"天生"},{n:"厚脂",sys:"天生"},{n:"熊掌",sys:"天生"},{n:"咆哮",sys:"意圖"}]
};
const GENERIC=/^(昆蟲|蟲類|蟲子類|植物|鳥類|鳥|獸類|野獸|動物|魚類|生物|魔物|菌類|爬蟲類?|小動物|齧齒類)$/;
const cleanName=n=>String(n||"").replace(/的?屍體|（.*?）|\(.*?\)|\s*[x×]\s*\d+$/g,"").trim();
const speciesOf=(name,kind)=>{const k=cleanName(kind).replace(/群$/,"");return !k||GENERIC.test(k)?cleanName(name):k};
function poolKey(sp){if(POOLS[sp])return sp;return Object.keys(POOLS).filter(k=>String(sp).includes(k)).sort((a,b)=>b.length-a.length)[0]||null}
/* 類人（照 D&D／Pathfinder 的 humanoid）：有類人技能池、職業，適用私下吃／當眾吃 */
const HUMANOID=/人類|冒險者|精靈|矮人|半身人|哥布林|諾姆|狗頭人|半獸人|獸人|野豬人|牛頭人|蜥蜴人|食人魔/;
const isHumanoid=c=>!c.small&&HUMANOID.test(`${c.sp||""}${c.name||""}${c.kind||""}`);
const CLASSES={
 "戰士":{pool:[{n:"劍術",sys:"武技"},{n:"盾擊",sys:"武技"},{n:"堅守",sys:"意圖"}],gear:"戰士的鐵劍",act:"舉盾硬擋、找機會反擊"},
 "盜賊":{pool:[{n:"開鎖",sys:"意圖"},{n:"潛行",sys:"暗"},{n:"短劍術",sys:"武技"}],gear:"盜賊的短劍",act:"丟煙霧、繞到背後、打不過就想逃"},
 "遊俠":{pool:[{n:"弓術",sys:"武技"},{n:"追蹤",sys:"意圖"},{n:"野外求生",sys:"意圖"}],gear:"遊俠的短弓",act:"拉開距離放箭、利用地形"},
 "野蠻人":{pool:[{n:"狂暴",sys:"天生"},{n:"戰吼",sys:"意圖"},{n:"巨斧術",sys:"武技"}],gear:"野蠻人的巨斧",act:"受傷後狂暴、不要命地猛攻"},
 "法師":{pool:[{n:"火球",sys:"火"},{n:"魔力感知",sys:"意圖"},{n:"讀寫",sys:"意圖"}],gear:"法師的法杖",act:"躲在後面詠唱、放火球"},
 "祭司":{pool:[{n:"治癒",sys:"光"},{n:"淨化",sys:"光"},{n:"祈禱",sys:"意圖"}],gear:"祭司的聖徽",act:"替自己或同伴治傷、用聖光逼退魔物"},
 "薩滿":{pool:[{n:"詛咒",sys:"暗"},{n:"治癒",sys:"光"},{n:"通靈",sys:"意圖"}],gear:"薩滿的骨杖",act:"下詛咒、召喚怪異的東西"},
 "鐵匠":{pool:[{n:"鍛冶",sys:"意圖"},{n:"怪力",sys:"天生"},{n:"礦物鑑定",sys:"意圖"}],gear:"鐵匠的鍛錘",act:"用沉重的鍛錘硬砸"},
 "機關師":{pool:[{n:"機關",sys:"意圖"},{n:"設陷阱",sys:"意圖"},{n:"手巧",sys:"意圖"}],gear:"機關師的工具袋",act:"啟動陷阱、丟出怪機關"},
 "獵人":{pool:[{n:"追蹤",sys:"意圖"},{n:"投擲",sys:"武技"},{n:"設陷阱",sys:"意圖"}],gear:"獵人的獵刀",act:"設陷阱、丟標槍"},
 "商人":{pool:[{n:"交涉",sys:"意圖"},{n:"鑑定",sys:"意圖"}],gear:"商人的錢袋",act:"討饒、拿錢收買、叫護衛"}
};
const CLASS_BY_RACE=[[/人類|冒險者/,["戰士","盜賊","遊俠","法師","祭司"]],[/精靈/,["遊俠","法師","祭司"]],[/矮人/,["戰士","鐵匠"]],[/半身人/,["盜賊","遊俠","商人"]],
  [/大哥布林/,["戰士","薩滿"]],[/哥布林/,["遊俠","薩滿","戰士"]],[/諾姆/,["機關師","盜賊"]],[/狗頭人/,["機關師","薩滿"]],[/半獸人|獸人/,["野蠻人","戰士","薩滿"]],
  [/野豬人/,["野蠻人","獵人"]],[/牛頭人/,["野蠻人","戰士"]],[/蜥蜴人/,["獵人","薩滿"]]];
const classOf=name=>Object.keys(CLASSES).find(k=>String(name||"").includes(k))||null;
const classesFor=sp=>(CLASS_BY_RACE.find(([re])=>re.test(sp))||[0,[]])[1];

/* 抽籤表（危險荒野的發現／危險結構，換成山裡的東西） */
const PREY={F:[["山鼠","成群"],["洞穴蜘蛛",""],["雪兔",""],["岩蜥",""],["渡鴉",""],["野豬崽","落單"]],
            E:[["灰狼","落單"],["冰蝠","成群"],["山貓",""]]};
/* 地區：每區有自己的生物（依等級）、地形、發現和危險。[名字, 群體描述, 勢力] */
const REGIONS=[
 {n:"灰岩洞周邊",re:/灰岩洞/,terr:["洞口外的亂石堆","通風的岩縫","堆滿骨頭的垃圾坑"],
  F:[["山鼠","成群"],["洞穴蜘蛛",""],["岩蜥",""],["渡鴉",""],["洞穴蟋蟀","成群"]],E:[["冰蝠","成群"],["灰狼","落單","餓狼群"]],D:[],
  find:["一窩鳥蛋","被丟棄的骨器","一處滴水的岩縫"],danger:["鬆動的落石","一群被吵醒的蟲子"]},
 {n:"碎石坡",re:/碎石|亂石|岩棚|懸崖/,terr:["碎石坡上","懸崖下的岩棚","風很大的稜線"],
  F:[["雪兔",""],["岩蜥",""],["石甲蟲","成群"],["山雀","成群"]],E:[["山貓",""],["岩背蜥",""],["禿鷲","兩隻"]],D:[["石像鬼","","",1]],
  find:["懸崖下的鳥巢","一條被雪蓋住的小路","閃著光的石英脈"],danger:["鬆動的落石","被雪蓋住的裂縫"]},
 {n:"黑松林",re:/黑松|松林|森林|林間|林地/,terr:["黑松林裡","倒下的枯樹旁","厚厚的松針地上"],
  F:[["野豬崽","落單"],["松鼠",""],["渡鴉",""],["林蛙",""]],E:[["灰狼","兩隻","餓狼群"],["野豬人","落單","野豬人"],["大哥布林","巡邏的","大哥布林戰團"],["樹皮毒蛛",""],["雪原鹿",""]],D:[["灰熊",""],["樹精",""],["大哥布林隊長","","大哥布林戰團"]],
  find:["長滿蘑菇的倒木","某種大型生物的新鮮足跡","獵人留下的陷阱"],danger:["被雪壓斷的樹枝","暗處有東西在盯著你"]},
 {n:"狼群的舊獵場",re:/獵場/,terr:["積雪的空地","被啃光的鹿骨旁","灌木叢邊"],
  F:[["雪兔",""],["狐狸",""]],E:[["灰狼","一群","餓狼群"],["灰狼","落單","餓狼群"],["雪原鹿","",""]],D:[["白鬃雪狼","",""]],
  find:["一具動物屍體","狼群留下的骨頭堆"],danger:["狼嚎越來越近","暗處有東西在盯著你"]},
 {n:"結冰的山澗",re:/山澗|河邊|溪/,terr:["結冰的山澗邊","薄冰上","瀑布下的水潭"],
  F:[["冰鱒",""],["水鼠","成群"],["河狸",""]],E:[["冰甲蟹",""],["水獺","兩隻"],["冰蝠","成群"]],D:[["寒鱗蛇",""]],
  find:["一處沒結冰的泉水","被沖上岸的魚"],danger:["一層薄冰","湍急的冰水"]},
 {n:"廢棄礦坑",re:/礦坑|礦道|豎井/,terr:["礦坑的支架下","生鏽的軌道邊","崩塌的坑道口"],
  F:[["礦坑鼠","成群"],["石甲蟲",""],["發光蠕蟲","成群"]],E:[["諾姆","兩隻","諾姆部落"],["狗頭人","一隊","狗頭人部落"],["礦坑岩蛛",""],["鐵殼蜈蚣",""]],D:[["石像鬼",""],["礦坑巨蛛",""],["狗頭人頭目","","狗頭人部落"]],
  find:["人類留下的生鏽工具","閃著光的礦脈","一條通往深處的小路"],danger:["崩塌的坑道","一窪冒泡的沼氣"]},
 {n:"地底暗河",re:/暗河|地底|地下/,terr:["暗河邊的淤泥灘","發光苔蘚的岩壁下","水聲回盪的洞廳"],
  F:[["盲眼蝦","成群"],["盲魚",""],["發光水母",""]],E:[["巨蛙",""],["暗河鰻",""],["冰蝠","成群"],["硫磺山羊",""]],D:[["沼地巨蛙",""],["洞穴蛇怪",""]],C:[["巨魔",""]],
  find:["發光的苔蘚","被沖到岸邊的骨頭","一塊發燙的紅石頭"],danger:["突然漲高的水","滑溜的岩石"]},
 {n:"黑水溝",re:/黑水/,terr:["黑水溝的泥沼邊","枯樹林立的低窪地","霧氣瀰漫的水邊"],
  F:[["泥鰍",""],["食腐鳥","成群"],["沼澤蛞蝓",""]],E:[["野豬人","兩隻","野豬人"],["沼澤蜥",""],["黑水熊","",""]],D:[["黑水熊","大型的"],["沼地巨魔","",""]],
  find:["野豬人的營火痕跡","陷在泥裡的鐵器"],danger:["會吞人的泥沼","毒霧"]},
 {n:"雪線以上",re:/雪線|冰原|山頂|冰洞/,terr:["齊膝深的雪地","冰洞口","強風的山頂"],
  F:[["雪兔",""]],E:[["冰原狐",""],["雪狼","兩隻"]],D:[["白鬃雪狼",""],["雪怪",""]],C:[["食人魔",""]],B:[["飛龍",""]],
  find:["冰封的屍體","一處能避風的冰洞"],danger:["雪崩","暴風雪"]},
 {n:"東側山谷",re:/東側|山谷|獸人/,terr:["山谷底的亂草地","被砍倒的林子邊","獸人留下的營地殘跡"],
  F:[["山羊","成群"],["野兔",""]],E:[["獸人斥候","兩個","獸人戰團"],["禿鷲",""]],D:[["獸人戰士","一隊","獸人戰團"],["戰狼","","獸人戰團"]],C:[["食人魔",""],["獸人督軍","","獸人戰團"]],
  find:["獸人的補給堆","一條被軍靴踏出來的路","被燒掉的村落"],danger:["獸人的巡邏隊","陷阱坑"]}
];
/* 勢力：數量會被打少，打光了就不再出現 */
const FACTIONS0={"餓狼群":{n:8,max:8,re:/灰狼|餓狼|狼群|頭狼/,tag:"禍患（餓狼群）"},"野豬人":{n:6,max:6,re:/野豬人/,tag:""},"諾姆部落":{n:10,max:10,re:/諾姆/,tag:""},
  "狗頭人部落":{n:12,max:12,re:/狗頭人/,tag:""},"大哥布林戰團":{n:8,max:8,re:/大哥布林/,tag:""},"獸人戰團":{n:15,max:15,re:/獸人|戰狼/,tag:""}};
const regionByLoc=loc=>REGIONS.find(r=>r.re.test(loc||""));
/* 世界：像 MUD 一樣的地點網。每個地點連到幾個鄰居，標走路要幾小時。
   一開始只知道灰岩洞和旁邊三個地方；「探索」會找到相連但還沒去過的地方，或發現新的冒險地點、地形。 */
const WORLD0={
 "灰岩洞":{kind:"巢穴",region:"灰岩洞周邊",note:"你出生的哥布林巢穴，山腹裡的洞穴。",links:{"碎石坡":1,"黑松林":1,"結冰的山澗":1},known:true},
 "碎石坡":{kind:"地區",region:"碎石坡",note:"",links:{"廢棄礦坑":2,"雪線以上":3},known:true},
 "黑松林":{kind:"地區",region:"黑松林",note:"",links:{"狼群的舊獵場":1,"黑水溝":2,"大哥布林巢穴":2,"精靈村":3},known:true},
 "結冰的山澗":{kind:"地區",region:"結冰的山澗",note:"",links:{"地底暗河":2,"東側山谷":3},known:true},
 "狼群的舊獵場":{kind:"地區",region:"狼群的舊獵場",note:"",links:{}},
 "廢棄礦坑":{kind:"地區",region:"廢棄礦坑",note:"",links:{"地底暗河":2,"狗頭人窩":1,"諾姆據點":1,"矮人聚落":1}},
 "地底暗河":{kind:"地區",region:"地底暗河",note:"",links:{}},
 "黑水溝":{kind:"地區",region:"黑水溝",note:"",links:{"野豬人營地":1,"半身人田地":3}},
 "雪線以上":{kind:"地區",region:"雪線以上",note:"",links:{}},
 "東側山谷":{kind:"地區",region:"東側山谷",note:"",links:{"獸人營地":1,"半身人田地":2,"人類城鎮":4}},
 "矮人聚落":{kind:"聚落",region:"廢棄礦坑",note:"廢棄礦坑旁邊、依山壁而建的半地下矮人聚落，還在挖礦打鐵，看不起綠皮。",links:{}},
 "精靈村":{kind:"聚落",region:"黑松林",note:"黑松林最深處的樹上村落，精靈射手守著林子，見到魔物就放箭。",links:{}},
 "大哥布林巢穴":{kind:"巢穴",region:"黑松林",note:"大哥布林戰團的地盤，比灰岩洞大得多。",links:{}},
 "野豬人營地":{kind:"營地",region:"黑水溝",note:"野豬人用泥和骨頭搭的營地。",links:{}},
 "半身人田地":{kind:"聚落",region:"東側山谷",note:"山腳下的半身人農莊，有糧倉和看門狗。",links:{}},
 "人類城鎮":{kind:"城鎮",region:"東側山谷",note:"山外的人類小鎮，有冒險者公會和衛兵。",links:{}},
 "狗頭人窩":{kind:"巢穴",region:"廢棄礦坑",note:"礦坑深處的狗頭人窩，到處是陷阱。",links:{}},
 "諾姆據點":{kind:"聚落",region:"廢棄礦坑",note:"諾姆在舊礦道裡蓋的據點，會做機關。",links:{}},
 "獸人營地":{kind:"營地",region:"東側山谷",note:"獸人戰團的前哨營地，木柵欄上掛著頭骨。",links:{}}
};
const RACE_HOME=[[/蜥蜴人/,"蜥蜴人營地"],[/鳥人/,"鳥人聚落"],[/蛙人/,"蛙人村"],[/矮人/,"矮人聚落"],[/精靈/,"精靈村"],[/半身人/,"半身人田地"],[/人類|冒險者|衛兵|商人/,"人類城鎮"],[/大哥布林/,"大哥布林巢穴"],[/野豬人/,"野豬人營地"],[/狗頭人/,"狗頭人窩"],[/諾姆/,"諾姆據點"],[/獸人/,"獸人營地"]];
const homeOf=x=>{const t=`${x.role||""}${x.kind||""}${x.n||""}`;const h=RACE_HOME.find(([re])=>re.test(t));if(!h)return "";
  const w=(typeof S!=="undefined"&&S&&S.world)||{};const hit=Object.keys(w).find(n=>h[0].test(n)&&w[n].kind!=="地區"&&n!==(S&&S.nestAt));return hit||(w[h[1]]?h[1]:"")};
/* v0.38 隱藏據點：開場把聚落／營地／巢穴隨機分到各地區，地圖上先寫成「？未探索」；在那個地區累積探索 need 次才會發現。
   附近三區 2～4 次，其他地區 3～6 次。黑顎知道位置但不知道裡面有什麼。 */
const SITE_FIXED=["大哥布林巢穴","野豬人營地","狗頭人窩","獸人營地"];   // 跟勢力、進化戰綁在一起的敵對據點，固定存在
/* 亞人村落：不用設定種族，開場從種族池隨機抽 7 個（每個種族最多一個，名字＝種族＋型態）；語言、態度跟著種族走 */
const DEMI=[{n:"矮人聚落",kind:"聚落",st:-1,note:"依山壁而建的半地下矮人聚落，還在挖礦打鐵，看不起綠皮。"},
 {n:"精靈村",kind:"聚落",st:-1,note:"樹上的精靈村落，精靈射手守著林子，見到魔物就放箭。"},
 {n:"半身人田地",kind:"聚落",st:0,note:"半身人的農莊，有糧倉和看門狗。"},
 {n:"人類城鎮",kind:"城鎮",st:0,note:"人類的小鎮，有冒險者公會和衛兵。"},
 {n:"諾姆據點",kind:"聚落",st:0,note:"諾姆蓋的據點，會做機關。"},
 {n:"蜥蜴人營地",kind:"營地",st:-1,note:"蜥蜴人在水邊搭的營地，不愛說話，很記仇。"},
 {n:"鳥人聚落",kind:"聚落",st:-1,note:"懸崖上的鳥人聚落，不喜歡陌生人靠近。"},
 {n:"蛙人村",kind:"聚落",st:0,note:"沼澤邊的蛙人村，用魚和草藥換東西。"},
 {n:"食人魔洞穴",kind:"巢穴",st:-2,note:"食人魔的洞穴，洞口堆著骨頭。"}];
const SITE_NOTE={"大哥布林巢穴":"大哥布林戰團的地盤，比灰岩洞大得多。","野豬人營地":"野豬人用泥和骨頭搭的營地。","狗頭人窩":"狗頭人的窩，到處是陷阱。","獸人營地":"獸人戰團的營地，木柵欄上掛著頭骨。"};
const SITE_ST={"大哥布林巢穴":-2,"野豬人營地":-2,"狗頭人窩":-1,"獸人營地":-2};
const SITE_REGIONS=["碎石坡","黑松林","結冰的山澗","狼群的舊獵場","廢棄礦坑","地底暗河","黑水溝","雪線以上","東側山谷"], SITE_NEAR=["碎石坡","黑松林","結冰的山澗"];
function siteInit(w){
  const demi=[...DEMI].sort(()=>Math.random()-0.5), pick=demi.slice(0,7);
  demi.forEach(x=>{if(!pick.includes(x))delete w[x.n]});
  pick.forEach(x=>{w[x.n]=w[x.n]||{kind:x.kind,links:{}};w[x.n].kind=x.kind;w[x.n].note=x.note;w[x.n].st=x.st});
  const names=[...SITE_FIXED,...pick.map(x=>x.n)];
  Object.values(w).forEach(nd=>[...SITE_FIXED,...DEMI.map(x=>x.n)].forEach(n=>{delete nd.links[n]}));
  return names.map(n=>{const region=SITE_REGIONS[rint(0,SITE_REGIONS.length-1)], need=SITE_NEAR.includes(region)?rint(2,4):rint(3,6);
    const nd=w[n]; nd.region=region; nd.links={}; nd.known=false; if(SITE_ST[n]!=null)nd.st=SITE_ST[n]; if(SITE_NOTE[n])nd.note=SITE_NOTE[n];
    return {n,region,need,found:false}});
}
function worldInit(){
  const w=JSON.parse(JSON.stringify(WORLD0));
  for(const [a,nd] of Object.entries(w))for(const [b,h] of Object.entries(nd.links))if(w[b])w[b].links[a]=h;
  return w;
}
const SETTLE=/聚落|營地|村|部落|據點|要塞|城|寨|巢穴|窩|集市|礦場/;
const baseLoc=l=>String(l||"").replace(/[・·].*$/,"").replace(/(內部|外部|門口|入口|深處|外圍|附近|中央|裡面)$/,"").trim();
const NEST=()=>S&&S.nestAt||"灰岩洞";
const here=()=>S.world[S.at]||S.world[NEST()];
const nodeByLoc=loc=>{const l=String(loc||"");return Object.keys(S.world||{}).filter(n=>S.world[n].known&&l.includes(n)).sort((a,b)=>b.length-a.length)[0]||null};
const exitsOf=n=>Object.entries((S.world[n]||{links:{}}).links).filter(([m])=>S.world[m]&&S.world[m].known);
const hiddenOf=n=>Object.keys((S.world[n]||{links:{}}).links).filter(m=>S.world[m]&&!S.world[m].known);
function pathHours(from,to){                         // 只走已知的地點
  const d={[from]:0}, done=new Set();
  while(true){let u=null;for(const k in d)if(!done.has(k)&&(u==null||d[k]<d[u]))u=k;if(u==null)return null;if(u===to)return d[u];done.add(u);
    for(const [v,h] of exitsOf(u))if(d[v]==null||d[u]+h<d[v])d[v]=d[u]+h}
}
const regionOf=()=>REGIONS.find(r=>r.n===here().region)||regionByLoc(S.loc)||REGIONS[0];
/* 新增或揭露一個地點，接在 from 旁邊 */
function addNode(pl,from,h,notes){
  const n=baseLoc(pl.name).slice(0,12); if(!n)return null;
  const w=S.world, f=w[from]?from:S.at;
  {const rg=regionByLoc(n);if(rg&&!w[n]&&rg.n!=="灰岩洞周邊")pl={...pl,_rg:rg.n}}
  if(w[n]){const was=w[n].known;w[n].known=true;if(pl.note)w[n].note=String(pl.note).slice(0,60);
    if(!w[n].links[f]&&f!==n){w[n].links[f]=h;w[f].links[n]=h}
    if(!was)notes&&notes.push(`發現新地點：${n}（${w[n].kind}，從${f}走 ${w[n].links[f]} 小時）`);return n}
  w[n]={kind:String(pl.kind||"地點").slice(0,6),region:pl._rg||(w[f]?w[f].region:"灰岩洞周邊"),note:String(pl.note||"").slice(0,60),links:{[f]:h},known:true,custom:true};
  w[f].links[n]=h;
  notes&&notes.push(`發現新地點：${n}（${w[n].kind}，從${f}走 ${h} 小時）`);
  return n;
}
const grpW=g=>!g?"":g==="成群"?"成群的":/[隻群的]$/.test(g)?g:g+"的";
function pickTier(){
  const i=gIdx(S.lv), r=Math.random();
  const t=i===0?(r<0.68?0:r<0.96?1:2):(r<0.25?i-1:r<0.8?i:i+1);
  return GRADES[Math.min(GRADES.length-1,Math.max(0,t))];
}
function pickPrey(reg){
  let lv=pickTier();
  for(let k=0;k<3;k++){
    const list=(reg[lv]||[]).filter(e=>!e[2]||!S.factions[e[2]]||S.factions[e[2]].n>0);
    if(list.length){const e=rnd(list);let sp=e[0], cls=null;
      if(HUMANOID.test(sp)&&!classOf(sp)&&Math.random()<0.3){const cs=classesFor(sp);if(cs.length){cls=rnd(cs);sp=sp+cls}}
      return {sp,grp:e[1],lv,fac:e[2]||"",cls}}
    lv=GRADES[Math.max(0,gIdx(lv)-1)];
  }
  return {sp:"山鼠",grp:"成群",lv:"F",fac:""};
}
const ACTIVITY=["正在進食","在睡覺","在巡視地盤","在找吃的","受了傷","在築巢","在舔傷口"];
const TERRAIN=["結冰的山澗邊","黑松林裡","碎石坡上","積雪的空地","一處岩縫前","倒下的枯樹旁"];
const PLACES=["結冰的山澗","廢棄的礦坑口","黑松林深處","懸崖下的鳥巢","狼群的舊獵場邊緣","被雪壓垮的獵人小屋","地底暗河","長滿蘑菇的岩洞"];
const FINDS=["一處沒結冰的泉水","人類留下的生鏽工具","一條通往深處的小路","某種大型生物的新鮮足跡","一窩鳥蛋","一具動物屍體"];
const DANGERS=["鬆動的落石","一層薄冰","被雪蓋住的裂縫","一窪冒泡的沼氣","一群被吵醒的蟲子","暗處有東西在盯著你"];
const FORAGE=["苔蘚","松子","漿果乾","幾根樹根","不知道有沒有毒的蘑菇","蟲蛹"];
const SCAV=["幾塊啃剩的骨頭","牆縫裡的蟲子","發霉的乾草","一塊尖銳的石片","半截斷掉的木棍"];
/* 八個大事件（階段）。內容跟著階段換：世界設定、巢穴事件、這一章的壓力。④以後的細節之後再補。 */
const CHAPTERS=[null,
 {name:"求生",world:"灰岩洞正在沒落：冬天快到了，存糧見底。主角是這窩裡最弱、最晚長大的一隻，只能撿剩的、躲著強的。",press:"餓肚子、比你強的同族",
  events:["分食的時候有人搶食","黑顎在深處劇烈咳嗽","疤臉在找人出氣","石牙一個人在加固洞口","小眼偷偷在藏東西","出去打獵的回來了，帶回的東西少得可憐"]},
 {name:"巢穴",world:"主角長大了。灰岩洞的首領黑顎越來越衰老，疤臉虎視眈眈，誰來當巢穴之主還沒定。",press:"黑顎的衰老、疤臉的挑釁、存糧",
  events:["黑顎吃掉了一隻弱小的同類","疤臉當眾挑釁黑顎","族人為了誰該出去打獵吵起來","有幾隻趁夜偷偷離開了巢穴","黑顎把主角叫到洞穴深處","出去打獵的回來了，帶回的東西少得可憐"]},
 {name:"拓展",world:"主角是灰岩洞的新主人。巢穴要吃飯、要人手；周圍的勢力開始注意這窩突然強起來的哥布林。",press:"養活族人、收服部下、外人的試探",
  events:["部下回報狩獵的收穫","族人為了分肉打起來","有外來的哥布林想投靠","洞口外發現陌生的腳印","有人偷懶被抓到","幼崽餓得一直哭","有族人想學主角的本事"]},
 {name:"搬家與異族爭端",world:"灰岩洞不夠用了，周圍的異族也開始搶地盤。",press:"找新據點、異族擴張",events:["族人擠得睡不下","偵察的部下回報了新地方","異族的斥候在附近出沒","存糧不夠全族吃"]},
 {name:"人類、盟友與強敵",world:"主角的勢力已經不小，人類、盟友和強大的生物都可能找上門。",press:"人類的注目、結盟、強大生物",events:["部下回報人類的動靜","有勢力派使者來","山裡出現了巨大的足跡"]},
 null,null,
 {name:"九王八王",world:"第九名吞噬者的名號傳遍八王的領域。",press:"八王",events:["某位王的使者出現了"]}
];
const chapOf=()=>CHAPTERS[S.chap||1]||CHAPTERS[5];
/* 自動推進：①→② 長大成體；②→③ 黑顎不在了（打倒、吃掉、趕走） */
function chapCheck(notes){
  const before=S.chap||1;
  if(S.chap==null)S.chap=1;
  if(S.chap<2&&S.stage==="成體")S.chap=2;
  if(!S.chief&&S.nest&&S.nest.tags.some(t=>/新首領|巢穴之主/.test(t.t)))becomeChief(null);   // 故事裡已經接下巢穴（例如黑顎退位）
  if(S.chap<3&&S.stage==="成體"&&(S.chief||S.gone.some(x=>x.n==="黑顎")||(S.beaten||[]).includes("黑顎")))S.chap=3;
  if(S.chap!==before&&notes)notes.push(`〈系統〉《世界之聲》：「第${S.chap}章・${chapOf().name}」`);
}
/* 主角成為巢穴之主：老首領退位（還在的話留下來，不再是對手） */
function becomeChief(notes){
  if(S.chief)return; S.chief=true;
  const x=S.npcs.find(y=>y.where===NEST()&&/巢穴之主|首領/.test(y.role||""));
  if(x){x.role="退位的老首領";x.foe=false;x.want="每天還有一口肉吃";x.cap=Math.max(x.cap||0,1)}
  if(!S.nest.tags.some(t=>/新首領/.test(t.t)))S.nest.tags.push({t:"新首領",c:"good"});
  notes&&notes.push(`〈系統〉《世界之聲》：「個體『${S.name}』成為${NEST()}之主。」`);
  nestFix(S); if(S.nest.pick&&notes)notes.push(`${NEST()}是 E 級巢穴了。到「巢穴」頁選第一個設施。`);
}
/* 巢穴事件：只抽現在還在的人；提到不在的人的事件不抽 */
function nestEvent(){
  const gone=new Set(S.gone.map(x=>x.n)), names=["黑顎","疤臉","石牙","小眼",...S.npcs.map(x=>x.n),...S.gone.map(x=>x.n)];
  const ok=chapOf().events.filter(e=>!names.some(n=>e.includes(n)&&(gone.has(n)||!S.npcs.some(x=>x.n===n)&&!S.party.some(x=>x.n===n))));
  return rnd(ok.length?ok:["巢穴裡一片安靜，只有滴水聲"]);
}
const NEST_EVENTS=["分食的時候有人搶食","黑顎在深處劇烈咳嗽","疤臉在找人出氣","石牙一個人在加固洞口","小眼偷偷在藏東西","出去打獵的回來了，帶回的東西少得可憐"];

/* 進化戰候選對手（依目標等級） */
const FOES={
  E:[{name:"黑顎",kind:"哥布林",where:"灰岩洞深處",note:"巢穴之主。老了，但還是這窩裡最強的。",nest:true},
     {name:"獨眼",kind:"灰狼",where:"狼群的舊獵場",note:"餓狼群的頭狼，左眼是瞎的，專咬喉嚨。"},
     {name:"霜爪",kind:"山貓",where:"碎石坡上方的岩棚",note:"獨來獨往的雪山貓，專吃落單的哥布林。"},
     {name:"冰蝠母",kind:"冰蝠",where:"地底暗河",note:"整窩冰蝠的母體，翅膀張開比你還寬。"},
     {name:"礦坑岩蛛",kind:"洞穴蜘蛛",where:"廢棄礦坑最深處",note:"肚子有你整個身體那麼大，網上掛著哥布林的骨頭。"},
     {name:"狗頭人頭目",kind:"狗頭人",where:"廢棄礦坑的狗頭人窩",note:"在礦坑裡設了一堆陷阱，很會使毒。"}],
  D:[{name:"白鬃",kind:"雪狼",where:"雪線上的狼窟",note:"比灰狼大兩倍，吐出的氣會結霜。"},
     {name:"老疤熊",kind:"灰熊",where:"黑松林深處的樹洞",note:"冬眠前餓得發狂，背上插著人類的斷箭。"},
     {name:"石像鬼",kind:"石像鬼",where:"廢棄礦坑的豎井",note:"白天是石頭，晚上會動。"},
     {name:"刀疤隊長",kind:"大哥布林",where:"黑松林另一側的敵對巢穴",note:"大哥布林戰團的隊長，比你高一個頭。"},
     {name:"沼地巨蛙",kind:"巨蛙",where:"地底暗河的淤泥灘",note:"一口能吞下一隻成年哥布林。"}],
  C:[{name:"冰洞巨魔",kind:"巨魔",where:"地底暗河最深處",note:"砍斷的手會再長回來。"},
     {name:"獨居的食人魔",kind:"食人魔",where:"雪線下的岩洞",note:"一個人吃掉過整支商隊。"},
     {name:"獸人督軍",kind:"獸人",where:"東側山谷的營地",note:"獸人戰團的頭，身邊總有兩頭戰狼。"},
     {name:"影鴉群母",kind:"影鴉",where:"懸崖上的黑巢",note:"一整片會說話的黑影。"},
     {name:"鐵蹄",kind:"野豬王",where:"黑松林",note:"牙比你的手臂還長。"}],
  B:[{name:"灰翼",kind:"飛龍",where:"雪線以上的峭壁",note:"會從天上把獵物抓起來摔死。"},
     {name:"山中老魔",kind:"食人魔",where:"雪線以上的冰洞",note:"活得比灰岩洞還久的食人魔。"}]
};
/* 魔法原料：魔獸（E 級以上）的屍體可以拆出一項。拆了之後屍體只剩肉。 */
const PART=[[/狼|犬/,"毛皮"],[/蛛/,"毒囊"],[/蝠/,"翼膜"],[/貓|豹|虎|獅/,"利爪"],[/熊/,"心臟"],[/蛇|蜥|龍|鱷/,"鱗片"],[/鳥|鴉|鷹|雀/,"羽毛"],[/豬|牛|鹿|羊/,"角"],[/蟲|甲|蠍/,"甲殼"],[/蛙/,"毒腺"]];
const partOf=sp=>(PART.find(([re])=>re.test(sp))||[0,"魔核"])[1];
const isBeast=c=>!c.evo&&!c.harvested&&!c.small;   // v0.30：F 級的也能拆原料（前期才做得出魔法武器）
const matOf=n=>S.mat&&S.mat[n];
/* ✦ 魔法原料／魔法物品的守門：錢、文件、食物、工具、礦料這類普通東西不算；沒有附帶技能的「原料」要有來源屍體，或名字像魔獸部位／魔核／晶石 */
const MUNDANE=/金幣|銀幣|銅幣|錢袋|金錢|文件|情報|信件|地圖|徽記|肉乾|燻肉|乾糧|麵包|酒|打火石|火把|繩|布|劣質|鐵礦石|廢棄/;
const PART_RE=/核|牙|爪|角|鱗|甲片|殼|皮|囊|腺|翼|心臟|血|精華|晶|結晶|嫩芽|骨|羽|毛|眼|舌|肢|牙齒/;
/* 魔法物品等級上限：最多比主角高一級、最高 A（從屍體拆的原料照屍體等級，不受限） */
/* 一天一次：S.usedSk 記今天用過的技能（自己的技能用技能名；魔法物品的用「技能（物品）」，每件各自算），隔天（dayChange）清空 */
const skUsed=k=>!!k&&(S.usedSk||[]).includes(k);
/* 白字（普通）武器防具：帶在身上可當一次性物品，用掉換一層優勢；藥水：紅回 HP、藍回 MP、紫兩個都回 */
const GEAR_RE=/劍|刀|匕首|矛|斧|弓|盾|甲|護|棍|錘|槌|鞭|弩/;
const POTION=n=>{const m=/(紅|藍|紫)(色)?(藥水|藥劑|藥)/.exec(n||"");return m?m[1]:null};
const oneShots=()=>S.items.filter(n=>!matOf(n)&&GEAR_RE.test(n)&&!POTION(n));
const capItemLv=l=>GRADES[Math.min(gIdx(l),gIdx(S.lv)+1,5)];
const cleanItemName=n=>String(n||"").replace(/\s*[（(][^）)]*級[）)]\s*$/,"").trim();
/* v0.38 語言：吃哪一族學哪一族的語言（人類也一樣）。哥布林語＝母語；野獸沒有語言（學舌的動物叫聲靠 OOC） */
const LANG_OF=[[/野豬人/,"野豬人語"],[/狗頭人/,"狗頭人語"],[/諾姆|地精|侏儒/,"諾姆語"],[/精靈/,"精靈語"],[/矮人/,"矮人語"],[/獸人/,"獸人語"],[/食人魔/,"食人魔語"],[/蜥蜴人/,"蜥蜴人語"],[/鳥人/,"鳥人語"],[/蛙人/,"蛙人語"],[/人類|冒險者|商人|士兵|騎士|衛兵|傭兵|鐵匠|牧師|商隊|流民/,"人類語"],[/哥布林/,"哥布林語"]];
const langOf=t=>{const m=LANG_OF.find(([re])=>re.test(t||""));return m?m[1]:null};
const hasLang=t=>{const l=langOf(t);return !l||l==="哥布林語"||(S.langs||[]).includes(l)};
function newGame(name){
  const w=worldInit(), sites=siteInit(w);
  return {
    v:2, v025:1, v026:1, v0261:1, usedSk:[], langs:["哥布林語"], name, day:1, hour:5, lv:"F", stage:"幼體", growth:0, starve:0,
    hp:8, hpMax:10, mp:10, mpMax:10, exist:0, full:0,
    loc:"灰岩洞・幼崽窩",
    skills:[{n:"吞噬",sys:"Unique",lv:null,note:"前世繼承。吃下新鮮的肉或死去一天內的屍體，可以從中學到技能。"}],
    tags:["幼體","飢餓"], items:[], corpses:[{name:"老鼠（咬了一口）",sp:"老鼠",lv:"F",t:29}],
    titles:[], eaten:[], dex:{}, dead:false,
    nest:{name:"灰岩洞",p:1,pop:2,d:2,food:0,fed:0,
      tags:[{t:"需求（食物）",c:"bad"},{t:"天然屏障",c:"good"},{t:"禍患（餓狼群）",c:"bad"}],
      note:"山腹裡的洞穴。冬天快到了，獵場被一群餓瘋的狼佔了。"},
    npcs:[
      {n:"黑顎",role:"巢穴之主",lv:"E",want:"再多活一天就好",knack:"一個祕密",face:"首領、貪食",secret:"衰老：他已經打不動了，吃弱者是為了撐下去",inst:"貪食",rel:"無視",r:0,cap:0,foe:true,where:"灰岩洞"},
      {n:"疤臉",role:"同一批裡最強的打手",lv:"F",want:"把一切吞下肚",knack:"一身蠻力",face:"粗暴、愛欺負弱小",secret:"",inst:"地盤",rel:"輕蔑",r:-2,cap:1,foe:true,where:"灰岩洞"},
      {n:"石牙",role:"力氣最大的那隻",lv:"F",want:"安定下來",knack:"耐力",face:"老實、話少",secret:"",inst:"群聚",rel:"無視",r:0,cap:3,where:"灰岩洞"},
      {n:"小眼",role:"最瘦小的母哥布林",lv:"F",want:"逃出去",knack:"注意細節的眼睛",face:"機靈、膽小",secret:"",inst:"恐懼",rel:"警戒",r:-1,cap:3,where:"灰岩洞"}
    ],
    chap:1, world:w, sites, expl:{}, at:"灰岩洞", party:[], evo:null, war:null, sub:null, evoReady:null, beaten:[], gone:[], mat:{}, region:"灰岩洞周邊", factions:fixFac({factions:JSON.parse(JSON.stringify(FACTIONS0))}).factions,
    log:[], opts:[], err:null
  };
}

const OPENING=`黑暗。潮濕。一股混著霉味和腐肉的氣息。
你記得自己死過一次——記得很清楚。可現在你縮在一堆骨頭和乾草裡，手腳又細又短，皮膚是灰綠色的。
同一批出生的那幾隻早就長大了，跟著出去打獵。洞裡只剩你，和幾具沒撐過來的小小屍體。你是這窩裡最晚站起來的那一個。
肚子餓得發痛。身邊有一隻老鼠，身子還是溫的。
你咬了一口。熟悉的感覺從喉嚨深處湧上來。
〈系統〉《大賢者》：「告。前世能力『吞噬』繼承確認。」
洞口那頭傳來一陣粗啞的笑聲：「喂，最小的那隻還活著啊。」`;
const OPEN_OPTS=["縮回骨堆裡裝死，聽聽外面的動靜","趁還沒人過來，摸黑看看這個窩裡還有什麼","撐起身子，朝笑聲的方向看過去"];
/* 第一章：黑顎、疤臉是要打倒的對手；石牙、小眼可以拉攏 */


/* v0.30：高等級生物太少的區域補上 C／D 級，主角升級後才不會只遇到弱怪 */
[["灰岩洞周邊","D",[["灰熊",""]]],["碎石坡","C",[["食人魔",""]]],["黑松林","C",[["食人魔",""]]],["結冰的山澗","C",[["雪怪",""]]],
 ["廢棄礦坑","C",[["巨魔",""]]],["黑水溝","C",[["黑水熊","成年的"]]],["狼群的舊獵場","C",[["白鬃雪狼","一群"]]]
].forEach(([n,lv,l])=>{const r=REGIONS.find(x=>x.n===n);if(r)r[lv]=[...(r[lv]||[]),...l]});
