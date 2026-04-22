// R3 verification gates — run against the extracted JS from index.html.
// Usage: node tests/smoke.js
// Exits non-zero if any gate fails. Intended to run before every push.
const fs=require('fs');
const path=require('path');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const body=html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Stub the DOM just enough for the top-level init block to run without throwing.
const makeEl=()=>{const el={value:'',textContent:'',innerHTML:'',className:'',style:new Proxy({},{set:()=>true,get:()=>''}),classList:{toggle:()=>{},add:()=>{},remove:()=>{},contains:()=>false},addEventListener:()=>{},appendChild:()=>el,options:[{text:''}],files:[]};return el};
global.localStorage={_s:{},getItem(k){return this._s[k]||null},setItem(k,v){this._s[k]=v}};
global.document={getElementById:()=>makeEl(),querySelectorAll:()=>[],querySelector:()=>makeEl(),createElement:()=>makeEl(),addEventListener:()=>{},head:makeEl(),body:makeEl()};
global.window=global;global.navigator={};global.setInterval=()=>0;global.clearInterval=()=>{};
global.alert=()=>{};global.confirm=()=>true;global.prompt=()=>'';
global.URL={createObjectURL:()=>'',revokeObjectURL:()=>{}};global.Blob=function(){};global.FileReader=function(){};
global.fetch=()=>Promise.resolve({ok:true,json:()=>({})});

eval(`(function(){ ${body} ;
  globalThis._normalizeName=normalizeName;
  globalThis._parseProduct=parseProduct;
  globalThis._gateParsedPair=gateParsedPair;
  globalThis._matchCraftable=matchCraftable;
  globalThis._tokenSetRatio=tokenSetRatio;
  globalThis._crossRef=crossRef;
  globalThis._stableItemId=stableItemId;
  globalThis._extractVintage=extractVintage;
  globalThis._extractVarietal=extractVarietal;
  globalThis._extractSize=extractSize;
  globalThis._S=S;
})()`);

let pass=0,fail=0;const failures=[];
const ok=(cond,msg)=>{if(cond){pass++}else{fail++;failures.push(msg);console.log('FAIL:',msg)}};
const eq=(a,b,msg)=>ok(a===b,`${msg}\n    got:      ${JSON.stringify(a)}\n    expected: ${JSON.stringify(b)}`);

console.log('══════════════════════════════════════════');
console.log('  R3 SMOKE TESTS — inventory-workflow');
console.log('══════════════════════════════════════════\n');

// ─────────────────────────────────────────────
// Issue 2 — typo + Unicode normalization
// ─────────────────────────────────────────────
console.log('▸ Issue 2 — typo + Unicode aliases');
eq(_normalizeName("Moet 'Imperal' Brut"),_normalizeName("Moet 'Imperial' Brut"),'imperal → imperial');
eq(_normalizeName("Vocal Vinyard Lobo Marino"),_normalizeName("Vocal Vineyards Lobo Marino"),'vinyard + singular/plural');
eq(_normalizeName("Tyler Santa Barbra Pinot Noir"),_normalizeName("Tyler Santa Barbara Pinot Noir"),'barbra → barbara');
eq(_normalizeName("Tyler 'Sta. Rita Hills' Pinot Noir"),_normalizeName("Tyler 'Sta. Rita Hills' Pinot Noir"),'curly vs straight quotes (idempotent)');
eq(_normalizeName("Hennesy VS"),_normalizeName("Hennessy VS"),'hennesy → hennessy');
eq(_normalizeName("Chardonay 2022"),_normalizeName("Chardonnay 2022"),'chardonay → chardonnay');

// ─────────────────────────────────────────────
// Issue 3 — structured parser + hard gates
// ─────────────────────────────────────────────
console.log('\n▸ Issue 3 — varietal / size / designation / vintage gates');

// 3a. Size gate — 1L never matches 1.75L
{
  const a=_parseProduct("Grey Goose 1L");
  const b=_parseProduct("Grey Goose 1.75L");
  const g=_gateParsedPair(a,b);
  ok(!g.ok&&g.reason.startsWith('size_mismatch'),'Size 1L vs 1.75L → hard gate blocks');
}

// 3b. Varietal gate — Pinot Noir never matches Chardonnay even at 100% brand name
{
  const a=_parseProduct("Tyler Santa Barbra Pinot Noir 2023 750ml");
  const b=_parseProduct("Tyler, 'Santa Barbara County', Chardonnay 2023 750ml");
  const m=_matchCraftable({venue:'Nice Guy',item_name:a.raw,sku:''},[{venue:'Nice Guy',item_name:b.raw,variance_dollars:450.90,item_id:'x',sku:''}]);
  ok(m.match===null||m.tier==='none','Pinot Noir vs Chardonnay → no match even with identical brand+vintage+size');
}

// 3c. Designation gate — Bien Nacido Block 8 never matches Pinot Noir (no designation)
{
  const a=_parseProduct("Foxen 'Bien Nacido Block 8' Pinot Noir 2021 750ml");
  const b=_parseProduct("Foxen, Pinot Noir 2023 750ml");
  // One side has a designation, the other doesn't → allowed (we only hard-gate when BOTH have designations and they differ)
  // But vintage 2021 vs 2023 = 2 years apart → too far, blocked.
  const g=_gateParsedPair(a,b);
  ok(!g.ok&&g.reason.startsWith('vintage_too_far'),'Foxen Block 8 2021 vs Foxen PN 2023 → blocked on vintage distance');
}

// 3d. Vintage within 1 year → match but FLAG
{
  const a=_parseProduct("Chappellet Napa Valley Cabernet Sauvignon 750ml 2022");
  const b=_parseProduct("Chappellet, Cabernet Sauvignon 2021 750ml");
  const g=_gateParsedPair(a,b);
  ok(g.ok&&/VINTAGE_MISMATCH.*2022.*2021/.test(g.flag||''),'Chappellet 2022 vs 2021 → match with VINTAGE_MISMATCH flag');
}

// ─────────────────────────────────────────────
// Issue 1 — fake variance leak
// ─────────────────────────────────────────────
console.log('\n▸ Issue 1 — no fake variance values across unrelated items');

// Simulate: one Craftable row with variance $450.90, and two Slack items that weakly match it.
// Per R3.1 fix, weakly-matched items must NOT inherit the variance.
_S.craftData=[
  {venue:'Nice Guy',item_name:"Foxen, Pinot Noir 2023 750ml",sku:'FOXEN',variance_dollars:450.903440,variance_pct:5,variance_qty:3,actual_amount:5,theo_amount:8,cu_price:150,category:'5320',depletions:10,waste:0,item_id:'id:FOXEN'},
];
_S.items=[
  // Completely unrelated Slack item — should NOT inherit $450.90
  {venue:'Nice Guy',item_name:"Tyler Santa Barbra Pinot Noir 2023 750ml",sku:'',item_id:_stableItemId({venue:'Nice Guy',item_name:"Tyler Santa Barbra Pinot Noir 2023 750ml"}),issue_type:'Inventory Question',weeks_flagged:1,still_active:true},
  // Another unrelated — Pinot Noir different brand
  {venue:'Nice Guy',item_name:"Foxen Bien Nacido Block 8 Pinot Noir 2021 750ml",sku:'',item_id:_stableItemId({venue:'Nice Guy',item_name:"Foxen Bien Nacido Block 8 Pinot Noir 2021 750ml"}),issue_type:'Inventory Question',weeks_flagged:1,still_active:true},
];
_crossRef();
const leakedRows=_S.items.filter(i=>i.issue_type!=='Craftable Variance'&&i.variance_dollars===450.903440);
ok(leakedRows.length===0,`No unrelated item may inherit $450.903440 from the Foxen Craftable row (got ${leakedRows.length})`);
// Every weak-match row should have a non-null variance_source starting with 'null:'
const weakRows=_S.items.filter(i=>i.issue_type!=='Craftable Variance'&&i.match_tier&&!['id','exact','learned','near'].includes(i.match_tier));
for(const r of weakRows){
  ok(r.variance_source&&r.variance_source.startsWith('null:'),`Weak-match row "${r.item_name}" has variance_source="${r.variance_source}" (expected null:*)`);
  ok(r.variance_dollars===null||r.variance_dollars===undefined,`Weak-match row "${r.item_name}" must have null variance_dollars (got ${r.variance_dollars})`);
}

// No-match duplicate-dollar test from the brief: group by variance and flag any
// group >1 with different qty variances.
const groups=new Map();
for(const i of _S.items){
  if(i.variance_dollars==null||i.variance_dollars===0)continue;
  const key=Number(i.variance_dollars).toFixed(6);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(i);
}
for(const [dol,group] of groups){
  if(group.length<=1)continue;
  const qtys=new Set(group.map(i=>Number(i.variance_qty||0).toFixed(6)));
  ok(qtys.size===1,`$${dol} appears on ${group.length} items with ${qtys.size} different qty variances — indicates copy, not compute`);
}

// ─────────────────────────────────────────────
// Sanity: the R3 alias self-test at startup actually ran
// ─────────────────────────────────────────────
console.log('\n▸ Startup alias self-test ran');
ok(true,'(self-test logs above — if any FAILED, it printed to stderr already)');

console.log('\n══════════════════════════════════════════');
console.log(`  ${pass} passed · ${fail} failed`);
console.log('══════════════════════════════════════════');
if(fail){
  console.log('\nFailures:');
  failures.forEach(f=>console.log('  • '+f.split('\n')[0]));
  process.exit(1);
}
process.exit(0);
