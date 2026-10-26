(()=>{'use strict';
const API='https://pc28.world/api/v1';
const $=s=>document.querySelector(s);
// Keep the live 星轨算法 module in 下一期预测; compact 和值 candidates now sit below 二门 within the left prediction stack.
(()=>{const panel=$('#goblinPanel'),prediction=$('#predictionSection');if(panel&&prediction&&panel.parentElement!==prediction)prediction.append(panel);})();
const state={records:[],latest:null,updatedAt:null,nextDrawAt:null,countdownSeconds:null,window:50,loading:false,historyLoading:false,historyLoaded:false,historyError:'',lastKenoAttempt:{},lastKenoNotice:0};
const STORAGE={records:'ka28.lab.records.v2',keno:'ka28.lab.keno.v2'};
const theoretical=Array(28).fill(0);for(let a=0;a<10;a++)for(let b=0;b<10;b++)for(let c=0;c<10;c++)theoretical[a+b+c]++;
const theoryP=theoretical.map(n=>n/1000);
const sourceAlgoPack = (()=>{

/* ============================================================
   第一步：统一工具函数（兼容各文件的"形态"口径差异）
   ============================================================ */
// A 口径（李商隐系）：和值<=13为小，>=14为大
function typeA(sum){ return (sum<=13?'小':'大') + (sum%2===0?'双':'单'); }
// B 口径（落秋系）：和值<14为小
function typeB(sum){ return (sum<14?'小':'大') + (sum%2===0?'双':'单'); }

const COMBOS = ['大单','小单','大双','小双'];
function opposite(c){ return {'大单':'小双','小双':'大单','大双':'小单','小单':'大双'}[c]||c; }
function recommend(c){ const o=opposite(c); return COMBOS.filter(x=>x!==c).sort((a,b)=>(a===o?-1:1)); }

/* ============================================================
   第二步：收录 49 个可回测公式（另有 2 个融合模型）
   每个算法：{id, name, src, fn(history)} -> {killGroup} 或 null
   history[0]=最新一期, history[1]=上一期... 由新到旧
   ============================================================ */
const ALGOS = [];
function add(id,name,src,fn,formula=''){ ALGOS.push({id,name,src,fn,formula}); }

/* ---------- 李商隐算法19 系列（A口径，算法1-19，缺6） ---------- */
// 算法1
add('A01','算法1','李商隐算法19',h=>{
  if(!h[0]) return null; const p=h[0],c=p.nums;
  let r=(c[0]*c[2]*c[1]+30)+p.sum+p.sum; while(r>27)r-=27; if(r<=0)r=1;
  const kg=opposite(typeA(r)); return {killGroup:kg};
});
// 算法2
add('A02','算法2','李商隐算法19',h=>{
  if(!h[0]) return null; const p=h[0],c=p.nums;
  let r=(c[0]*c[2]*4+c[1])+p.sum; while(r>27)r-=27; if(r<=0)r=1;
  const kg=opposite(typeA(r)); return {killGroup:kg};
});
// 算法3
add('A03','算法3','李商隐算法19',h=>{
  if(!h[0]) return null; const p=h[0],c=p.nums,s=p.sum;
  let r=c[0]*c[2]*c[0]+c[1]+s+s+11; while(r>27)r-=28; if(r<=0)r=1;
  const kg=opposite(typeA(r)); return {killGroup:kg};
});
// 算法4
add('A04','算法4','李商隐算法19',h=>{
  if(!h[0]) return null; const p=h[0];
  const lastTwo=parseInt(String(p.expect).slice(-2))||0;
  let N=Math.floor(lastTwo*3.14+5)+p.sum, K=Math.floor(N/28), res=N+K;
  while(res>27)res-=27; while(res<0)res+=27; if(res<=0)res=1;
  const kg=opposite(typeA(res)); return {killGroup:kg};
});
// 算法5（三期各位拼接）
add('A05','算法5','李商隐算法19',h=>{
  if(h.length<3) return null;
  const a=parseInt(`${h[2].nums[0]}${h[1].nums[0]}${h[0].nums[0]}`,10)||0;
  const b=parseInt(`${h[2].nums[1]}${h[1].nums[1]}${h[0].nums[1]}`,10)||0;
  const c=parseInt(`${h[2].nums[2]}${h[1].nums[2]}${h[0].nums[2]}`,10)||0;
  let dr=a+b+c; while(dr>9){let s=0,tt=dr;while(tt>0){s+=tt%10;tt=Math.floor(tt/10);}dr=s;}
  const fv=dr===0?14:dr; const kg=opposite(typeA(fv)); return {killGroup:kg};
});
// 算法7
add('A07','算法7','李商隐算法19',h=>{
  if(h.length<3) return null;
  let raw=h[2].sum+h[1].sum+h[0].sum+h[1].nums[1]; while(raw>27)raw-=27; if(raw<=0)raw=1;
  return {killGroup:typeA(raw)};
});
// 算法8
add('A08','算法8','李商隐算法19',h=>{
  if(!h[0]) return null; const p=h[0];
  let r=(p.sum*p.nums[0]+7)%27+1; return {killGroup:typeA(r)};
});
// 来源：原始算法源页的 forest3（三期共振法）。
// 为保持 49 个公式的既有数量，使用 A09 槽位；另两个融合模型仍在独立投票层。
add('A09','素数黄金共振杀组','森林算法 3 · 三期共振法',h=>{
  if(!Array.isArray(h)||h.length<3||h.slice(0,3).some(r=>!Number.isFinite(Number(r.sum))))return null;
  const primes=[2,3,5,7,11,13,17,19,23,29];
  const nearestPrime=value=>primes.reduce((best,p)=>Math.abs(p-value)<Math.abs(best-value)?p:best,primes[0]);
  const primeSums=h.slice(0,3).map(r=>nearestPrime(Number(r.sum)));
  const product=primeSums.reduce((a,b)=>a*b,1);
  let foldedRoot=Math.abs(Math.trunc(product));
  while(foldedRoot>=28)foldedRoot=String(foldedRoot).split('').reduce((a,d)=>a+Number(d),0);
  let resonance=foldedRoot+Math.floor(foldedRoot*618/1000);
  while(resonance>27)resonance-=27;
  while(resonance<0)resonance+=27;
  const mapped=typeA(resonance),kill=opposite(mapped);
  // 与来源实现一致：双组按 0–27 三球和值理论分布排序，排除杀号后取前两组。
  const groupChance=Object.fromEntries(COMBOS.map(g=>[g,0]));
  for(let sum=0;sum<=27;sum++)groupChance[typeA(sum)]+=theoretical[sum];
  const priority=COMBOS.slice().sort((a,b)=>groupChance[b]-groupChance[a]||(a<b?-1:a>b?1:0));
  const recommends=priority.filter(g=>g!==kill).slice(0,2);
  return {killGroup:kill,recommends,sourceSummary:{primeSums,product,foldedRoot,resonance,mapped,kill,method:'forest3 / 三期共振法'}};
},'来源模型：森林算法 3（三期共振法）\nP₁、P₂、P₃ = 最近三期和值各自最邻近的素数（候选素数：2, 3, 5, 7, 11, 13, 17, 19, 23, 29）\nM = P₁ × P₂ × P₃\nR = 对 M 取绝对整数部分；当 R ≥ 28 时反复做十进制数字和折叠\nG = R + floor(R × 0.618)；若 G > 27，则反复减 27\n基础形态 = G < 14 ? 小 : 大，单双按 G 的奇偶决定\n杀号 = 基础形态的对角形态（小单↔大双；小双↔大单）\n二门 = 按 0–27 三球和值理论分布排序，排除杀号后取前两组\n说明：来源模型未原生输出三门或特码；三门及和值候选由 KA28 的补充参考模块展示，并会注明非该公式原始输出');
// 算法10
add('A10','算法10','李商隐算法19',h=>{
  if(!h[0]) return null; const p=h[0];
  let periodLast=parseInt(String(p.expect).slice(-1))||0;
  let r=(p.sum*2+periodLast*3)%27; if(r<=0)r=1;
  return {killGroup:typeA(r)};
});
// 算法11（三期各位拼接求均值）
add('A11','算法11','李商隐算法19',h=>{
  if(h.length<3) return null;
  const a=parseInt(`${h[2].nums[0]}${h[1].nums[0]}${h[0].nums[0]}`,10)||0;
  const b=parseInt(`${h[2].nums[1]}${h[1].nums[1]}${h[0].nums[1]}`,10)||0;
  const c=parseInt(`${h[2].nums[2]}${h[1].nums[2]}${h[0].nums[2]}`,10)||0;
  const avg=Math.floor((a+b+c)/3);
  let fs=String(avg).split('').reduce((s,d)=>s+parseInt(d),0); while(fs>27)fs-=27; if(fs<=0)fs=1;
  const kg=(fs===14||fs===13)?typeA(fs):opposite(typeA(fs)); return {killGroup:kg};
});
// 算法12
add('A12','算法12','李商隐算法19',h=>{
  if(h.length<3) return null;
  const A=parseInt(String(h[1].sum).slice(-1)), B=h[1].nums[1], C=parseInt(String(h[2].sum).slice(-1));
  let K=(A+B+C+8)*2; while(K>27)K-=27; if(K<=0)K=1;
  return {killGroup:typeA(K)};
});
// 算法13（y组+差值）
add('A13','算法13','李商隐算法19',h=>{
  if(h.length<2||!h[0]) return null;
  const yGroups={'y0':[0,3,6,9,12,15,18,21,24,27],'y1':[1,4,7,10,13,16,19,22,25],'y2':[2,5,8,11,14,17,20,23,26]};
  const curNum=parseInt(`${h[0].nums[0]}${h[0].nums[1]}${h[0].nums[2]}`,10);
  let yValue=curNum+h[0].sum; yValue=String(yValue).split('').reduce((s,d)=>s+parseInt(d),0);
  while(yValue>27)yValue-=27; if(yValue<=0)yValue=1;
  let curY=null; for(const [g,ar] of Object.entries(yGroups)) if(ar.includes(yValue)) curY=g;
  if(!curY) return {killGroup:typeA(yValue)};
  let hist=null;
  for(let j=1;j<h.length;j++){ if(!h[j]||h[j].sum===undefined) continue;
    let py=null; for(const [g,ar] of Object.entries(yGroups)) if(ar.includes(h[j].sum)) py=g;
    if(py===curY){hist=h[j];break;} }
  if(!hist&&h.length>1) hist=h[1]; if(!hist) return {killGroup:typeA(yValue)};
  const diffs=[Math.abs(h[0].nums[0]-hist.nums[0]),Math.abs(h[0].nums[1]-hist.nums[1]),Math.abs(h[0].nums[2]-hist.nums[2])];
  let fs=diffs[0]+diffs[1]+diffs[2]; while(fs>27)fs-=27; if(fs<=0)fs=1;
  return {killGroup:typeA(fs)};
});
// 算法14（乘积小数位）
add('A14','算法14','李商隐算法19',h=>{
  if(h.length<3) return null;
  const calc=n=>`${n[0]}${n[1]}${n[2]}`;
  const v0=parseInt(calc(h[0].nums),10), v1=parseInt(calc(h[1].nums),10), v2=parseInt(calc(h[2].nums),10);
  const sumPart=v0+v0/10+v0/100 + v1+v1/10+v1/100 + v2+v2/10+v2/100;
  const productSum=h[0].sum*h[1].sum*h[2].sum;
  const combined=sumPart*productSum;
  const decimal=combined.toFixed(12).split('.')[1]||'000';
  let ds=0; for(let i=0;i<3;i++) ds+=parseInt(decimal[i],10); if(ds<=0)ds=1;
  let fs=ds; while(fs>27)fs-=27; if(fs<=0)fs=1;
  return {killGroup:typeA(fs)};
});
// 算法15
add('A15','算法15','李商隐算法19',h=>{
  if(h.length<3) return null;
  const a=parseInt(`${h[2].nums[0]}${h[1].nums[0]}${h[0].nums[0]}`,10)||0;
  const b=parseInt(`${h[2].nums[1]}${h[1].nums[1]}${h[0].nums[1]}`,10)||0;
  const c=parseInt(`${h[2].nums[2]}${h[1].nums[2]}${h[0].nums[2]}`,10)||0;
  let fs=String(a+b+c).split('').reduce((s,d)=>s+parseInt(d),0); while(fs>27)fs-=27; if(fs<=0)fs=1;
  return {killGroup:typeA(fs)};
});
// 算法16
add('A16','算法16','李商隐算法19',h=>{
  if(h.length<3) return null;
  let r=(h[1].nums[1]+h[0].nums[0]+h[2].nums[0]+h[1].nums[2]+h[1].sum)*h[2].nums[1];
  while(r>27)r-=27; if(r<=0)r=1;
  return {killGroup:typeA(r)};
});
// 算法17
add('A17','算法17','李商隐算法19',h=>{
  if(h.length<3) return null;
  let r=(h[0].nums[1]*h[1].nums[2]*h[2].sum)+h[1].nums[1]+h[2].sum+h[0].nums[1];
  let ds=String(r).split('').reduce((s,d)=>s+parseInt(d),0); while(ds>27)ds-=27; if(ds<=0)ds=1;
  return {killGroup:typeA(ds)};
});
// 算法18
add('A18','算法18','李商隐算法19',h=>{
  if(h.length<3) return null;
  let r=h[2].sum+h[1].sum+h[0].sum+h[1].nums[1]; while(r>27)r-=27; if(r<=0)r=1;
  return {killGroup:typeA(r)};
});
// 算法19
add('A19','算法19','李商隐算法19',h=>{
  if(h.length<3) return null;
  const sumAdd=h[1].sum+h[0].sum;
  const newNum=parseInt(`${h[0].nums[0]}${h[0].nums[1]}${h[0].nums[2]}`,10);
  const total=sumAdd+newNum;
  let ds=String(total).split('').reduce((s,d)=>s+parseInt(d),0); while(ds>27)ds-=27; if(ds<=0)ds=1;
  return {killGroup:typeA(ds)};
});

/* ---------- 李商隐16预测网 系列（A口径） ---------- */
add('B01','形态反转杀','李商隐16',h=>{
  if(!h[0]) return null; const cur=h[0];
  let hasPair=false; if(h[1]) hasPair=(h[1].nums[0]===h[1].nums[1]||h[1].nums[0]===h[1].nums[2]||h[1].nums[1]===h[1].nums[2]);
  const reverseMap={'大单':'大双','大双':'大单','小单':'小双','小双':'小单'};
  let rev=false;
  if(cur.sum===13||cur.sum===14) rev=hasPair; else rev=!hasPair;
  if(cur.type==='大单'&&h.length>=3){ const dc=h.slice(0,3).filter(x=>x.parity==='双').length; rev=(dc!==3); }
  if(cur.type==='大双'&&h.length>=3){ const sc=h.slice(0,3).filter(x=>x.parity==='单').length; rev=(sc!==3); }
  return {killGroup: rev?(reverseMap[cur.type]||cur.type):cur.type};
});
add('B02','4y·5y乘积','李商隐16',h=>{
  if(!h[0]||h.length<2) return null; const cur=h[0],sum=cur.sum;
  const m4=h.find(x=>(x.sum%4)===sum%4), m5=h.find(x=>(x.sum%5)===sum%5);
  if(!m4||!m5) return null;
  const prod=parseInt(cur.nums.join(''))*parseInt(m4.nums.join(''))*parseInt(m5.nums.join(''));
  let val=prod; for(let i=0;i<5;i++) val=Math.floor(val/sum);
  const r=Math.floor(val%100)%28; return {killGroup:opposite(typeA(r))};
});
add('B03','y组差值','李商隐16',h=>{
  if(!h[0]||h.length<2) return null; const sum=h[0].sum;
  const yGroups={0:[20,15,25,5,10],1:[1,11,21,6,16,26],2:[2,12,22,7,17,27],3:[13,23,3,8,18],4:[14,24,4,19,9]};
  let cy=-1; for(const y in yGroups) if(yGroups[y].includes(sum)){cy=parseInt(y);break;} if(cy===-1)cy=sum%5;
  const m=h.find(x=>(x.sum%5)===cy); if(!m) return null;
  const ad=(cy===0||cy===1||cy===4)?m.nums[0]:(cy===2?m.nums[1]:m.nums[2]);
  const ns=sum+ad, t=ns%5, nt=typeA(ns);
  return {killGroup: t===cy ? nt : opposite(nt)};
});
add('B04','三球乘积','李商隐16',h=>{
  if(!h[0]||h.length<2) return null; const c=h[0].nums,sum=h[0].sum;
  let prod=1; c.forEach(x=>{if(x!==0)prod*=x;});
  const A=prod*sum, s=Math.abs(A).toString().slice(0,3);
  const B=s.split('').reduce((a,d)=>a+parseInt(d),0);
  const y5={0:[0,5,10,15,20,25],1:[1,6,11,16,21,26],2:[2,7,12,17,22,27],3:[3,8,13,18,23],4:[4,9,14,19,24]};
  let ty=-1; for(const y in y5) if(y5[y].includes(B)){ty=parseInt(y);break;} if(ty===-1) return null;
  const m=h.find(x=>y5[ty].includes(x.sum)); if(!m) return null;
  let pb=1; s.split('').forEach(d=>{if(parseInt(d)!==0)pb*=parseInt(d);});
  let ph=1; m.nums.forEach(x=>{if(x!==0)ph*=x;});
  const S=pb+ph, ss=Math.abs(S).toString().slice(0,3);
  const Z=ss.split('').reduce((a,d)=>a+parseInt(d),0); return {killGroup:opposite(typeA(Z))};
});
add('B05','号码和差','李商隐16',h=>{
  if(!h[0]||h.length<2) return null; const c=h[0].nums,sum=h[0].sum;
  const num=parseInt(`${c[0]}${c[1]}${c[2]}`), add=num+sum;
  const yg=String(add).split('').reduce((a,d)=>a+parseInt(d),0)%3;
  const m=h.find(x=>(x.sum%3)===yg); if(!m) return null;
  const ds=(c[0]-m.nums[0])+(c[1]-m.nums[1])+(c[2]-m.nums[2]);
  return {killGroup:typeA(ds)};
});
add('B06','编码K值','李商隐16',h=>{
  if(!h[0]||h.length<3) return null; const cur=h[0],p1=h[0],p2=h[1];
  const A=p1.sum%10,B=p1.nums[1],C=p2.sum%10,K=(A+B+C+8)*2;
  return {killGroup:typeA(K%28===0?1:K%28)};
});
add('B07','纵向均值','李商隐16',h=>{
  if(h.length<3) return null;
  const na=parseInt(`${h[0].nums[0]}${h[1].nums[0]}${h[2].nums[0]}`,10)||0;
  const nb=parseInt(`${h[0].nums[1]}${h[1].nums[1]}${h[2].nums[1]}`,10)||0;
  const nc=parseInt(`${h[0].nums[2]}${h[1].nums[2]}${h[2].nums[2]}`,10)||0;
  const tot=na+nb+nc, div=Math.floor(tot/3);
  const ds=String(div).split('').reduce((s,d)=>s+parseInt(d),0);
  const t=typeA(ds); return {killGroup:{'小单':'大双','大双':'小单','大单':'小双','小双':'大单'}[t]||t};
});

/* ---------- 15种算法模型 系列（A口径） ---------- */
add('C01','形态3y','15模型',h=>{
  if(h.length<3) return null;
  const r=h.slice(0,3).map(d=>d.sum);
  return {killGroup:COMBOS[r[0]%4]};
});
add('C02','冷热分布','15模型',h=>{
  if(h.length<8) return null;
  const cnt={大单:0,小单:0,大双:0,小双:0};
  h.slice(0,8).forEach(d=>{const c=typeA(d.sum); cnt[c]++;});
  const s=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]);
  return {killGroup:s[3]};
});
add('C03','高频杀','15模型',h=>{
  if(h.length<5) return null;
  const freq={}; h.slice(0,5).forEach(d=>{const c=typeA(d.sum); freq[c]=(freq[c]||0)+1;});
  const high=Object.keys(freq).reduce((a,b)=>freq[a]>freq[b]?a:b);
  return {killGroup:high};
});
add('C04','形态模型','15模型',h=>{
  if(h.length<5) return null;
  const r=h.slice(0,5).map(d=>typeA(d.sum));
  return {killGroup: r[2]==='大单'?'小双':'大单'};
});
add('C05','尾数杀','15模型',h=>{
  if(!h[0]) return null;
  const lq=String(h[0].expect).slice(-2), st=h[0].sum%10;
  const ki=(parseInt(lq[0]||0)+st)%4;
  return {killGroup:COMBOS[ki]};
});
add('C06','期号编码','15模型',h=>{
  if(!h[0]) return null;
  const code=parseInt(String(h[0].expect).slice(-3))||111;
  const kn=(code+h[0].sum*2)%28;
  const m={0:'大单',1:'小单',2:'大双'};
  return {killGroup:m[kn%4]||'小双'};
});
add('C07','abc参数','15模型',h=>{
  if(h.length<3) return null;
  const c=h[0].nums, abc=c[0]*100+c[1]*10+c[2];
  const div=(new Date().getMinutes()%5+3);
  const pn=Math.floor(abc/div)%28;
  return {killGroup: pn%2===0?'大单':'小双'};
});
add('C08','双特码','15模型',h=>{
  if(!h[0]) return null;
  const q=String(h[0].expect).slice(-2);
  const s=(parseInt(q[0]||0)+parseInt(q[1]||0))*5+h[0].sum;
  const a1=((s%27+27)%27*4+11)%27, a2=(a1+13)%27;
  return {killGroup:typeA(a2)};
});
add('C09','函数频率','15模型',h=>{
  if(h.length<5) return null;
  const freq={}; h.slice(0,5).forEach(d=>{const c=typeA(d.sum); freq[c]=(freq[c]||0)+1;});
  const s=Object.keys(freq).sort((a,b)=>freq[b]-freq[a]);
  return {killGroup:s[s.length-1]||'大单'};
});
add('C10','23条规则','15模型',h=>{
  if(h.length<8) return null;
  const big=h.slice(0,8).map(d=>d.sum).filter(s=>s>13).length;
  return {killGroup: big>4?'小双':'大单'};
});
add('C11','多维复合','15模型',h=>{
  if(!h[0]) return null;
  const mv=h[0].sum*(new Date().getSeconds()%5+1)%28;
  return {killGroup:typeA((mv+13)%28)};
});
add('C12','LSTM轻量','15模型',h=>{
  if(h.length<10) return null;
  const w=h.slice(0,10).reduce((a,d)=>a+d.sum,0)%4;
  return {killGroup:COMBOS[w]};
});
add('C13','一球杀','15模型',h=>{
  if(h.length<5) return null;
  const b1=h.slice(0,5).map(d=>d.nums[0]||0);
  // 映射到形态：一球为奇数则单，偶数则双；大小用 6 作分界
  const v=b1[0]; if(v===undefined||v===null) return null;
  const sz=v<=4?'小':'大', oe=v%2===0?'双':'单';
  return {killGroup:sz+oe};
});
add('C14','走势关联','15模型',h=>{
  if(!h[0]) return null;
  const w=h[0].sum%3;
  const main=w===0?'大单':w===1?'小双':'大双';
  return {killGroup: main==='大单'?'小单':'大单'};
});
add('C15','建议形态','15模型',h=>{
  if(!h[0]) return null;
  const r=h[0].sum%5;
  const bet=r>2?'大单':'小双';
  return {killGroup: bet==='大单'?'小双':'大单'};
});

/* ---------- 李商隐三套算法 引擎 ---------- */
// 算法一：位运算法
add('D01','位运算法','三套算法',h=>{
  if(h.length<5) return null;
  const cur=h[0],prev=h[1],p3=h[3],p4=h[4];
  let br=0;
  for(let i=0;i<3;i++){ const s=prev.nums[i]+cur.nums[i]; br+=(s>=0&&s<=9)?s:Math.abs(prev.nums[i]-cur.nums[i]); }
  const d3=Math.abs(p3.sum%10), d4=Math.abs(p4.sum%10);
  const fs=br+Math.abs(d3-d4);
  return {killGroup:opposite(typeA(fs))};
});
// 算法二：差值推杀
add('D02','差值推杀','三套算法',h=>{
  if(h.length<2) return null;
  const cur=h[0];
  const tn=cur.nums[0]*100+cur.nums[1]*10+cur.nums[2];
  const ad=tn+cur.sum, s3=String(ad).padStart(3,'0').slice(-3);
  const sd=parseInt(s3[0])+parseInt(s3[1])+parseInt(s3[2]);
  const yg=sd<=2?sd:sd%3;
  let t=null; for(let i=1;i<h.length;i++){ let g=null;
    [0,3,6,9,12,15,18,21,24,27].includes(h[i].sum)?g=0:[1,4,7,10,13,16,19,22,25].includes(h[i].sum)?g=1:g=2;
    if(g===yg){t=h[i];break;} }
  if(!t) return null;
  const td=Math.abs(cur.nums[0]-t.nums[0])+Math.abs(cur.nums[1]-t.nums[1])+Math.abs(cur.nums[2]-t.nums[2]);
  return {killGroup:typeA(td)};
});
// 算法三：K值杀组
add('D03','K值杀组','三套算法',h=>{
  if(h.length<2) return null;
  const cur=h[0],prev=h[1];
  const A=cur.sum%10,B=cur.nums[1],C=prev.sum%10;
  let K=(A+B+C+8)*2; while(K>27)K-=27; if(K<=0)K=1;
  return {killGroup:typeA(K)};
});

/* ---------- uu顶级思路 系列（A口径，固定杀组+三门池） ---------- */
add('E01','109.446变换','uu思路',h=>{
  if(!h[0]) return null;
  const sum=h[0].sum, factor=sum/10, trans=109.446*factor;
  const frac=trans-Math.floor(trans);
  const idx=Math.floor(frac*4)%4;
  return {killGroup:['大单','小单','大双','小双'][idx]};
});
add('E02','五球随机路径','uu思路',h=>{
  if(!h[0]) return null;
  const c=h[0].nums, expect=parseInt(h[0].expect||0);
  const seed=expect*1000+(c[0]*100+c[1]*10+c[2]);
  let s=seed|0;
  const rnd=()=>{ s=(s|0)+0x6D2B79F5|0; let t=Math.imul(s^s>>>15,s|1); t=t^Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; };
  const maxC=Math.max(...c,1); let fr=rnd();
  for(let i=0;i<maxC;i++) fr=rnd();
  const product=fr*0.5*c[1]*c[2]*(h[0].sum||1);
  const dec=String(product.toFixed(10)).split('.')[1]||'000';
  const ds=dec.slice(0,3).split('').map(Number).reduce((a,b)=>a+b,0);
  return {killGroup:COMBOS[ds%4]};
});

/* ---------- 独家双组算法 系列（B口径：和值<14为小） ---------- */
function luoqiuSeedGroups(seed,item){
  const rng=(()=>{ let a=seed+parseInt(item.expect); return ()=>{ a=(a|0)+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,a|1); t=t^Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; })();
  const rand=Number(rng().toFixed(8));
  const prod=rand*item.sum;
  const finalSum=String(prod.toFixed(3)).replace('.','').split('').reduce((a,b)=>a+parseInt(b),0);
  const type=typeB(finalSum);
  const randStr=rand.toFixed(8).split('.')[1].slice(0,3);
  const randSum=String(randStr).split('').reduce((a,b)=>a+parseInt(b),0);
  const SEQ=[[0,3,9,12,15,18,21,24,27],[1,4,7,10,13,16,19,22,25],[2,5,8,11,14,17,20,23,26]];
  const ia=SEQ.findIndex(s=>s.includes(randSum)), ib=SEQ.findIndex(s=>s.includes(item.sum));
  const same=(ia!==-1&&ib!==-1&&ia===ib);
  const RULES={ same:{'小双':['小双','大双','大单'],'小单':['小单','大单','大双'],'大双':['大双','小双','小单'],'大单':['大单','小单','小双']},
    diff:{'小双':['小双','小单','大单'],'小单':['小单','小双','大双'],'大双':['大双','大单','小单'],'大单':['大单','大双','小双']} };
  return same?RULES.same[type]:RULES.diff[type];
}
// 取一组种子跑双组，返回杀组
function luoqiuKill(seed,h){ if(h.length<2) return null; const grp=luoqiuSeedGroups(seed,h[1]); if(!grp||grp.length<3) return null;
  let best=-1,bIdx=0; for(let ki=0;ki<3;ki++){ let hit=0; for(let i=0;i<Math.min(8,h.length-1);i++){
    const g=luoqiuSeedGroups(seed,h[i+1]); if(g&&g.length>=3){ const d=g.filter((_,x)=>x!==ki); if(h[i].sum===13||h[i].sum===14||d.includes(typeB(h[i].sum))) hit++; } }
    if(hit>best){best=hit;bIdx=ki;} } return {killGroup:grp[bIdx]}; }
const LQ_SEEDS=[1024,2048,4096,8192];
LQ_SEEDS.forEach((sd,i)=>add('F'+String(i+1).padStart(2,'0'),'双组种子'+(i+1),'独家双组',h=>luoqiuKill(sd,h)));

return {ALGOS, typeA, typeB, COMBOS, opposite, recommend, luoqiuSeedGroups, luoqiuKill};
})();

function safeGet(key){try{return localStorage.getItem(key)}catch(_){return null}}
function safeSet(key,value){try{localStorage.setItem(key,value)}catch(_){}}
function readKenoCache(){try{const x=JSON.parse(safeGet(STORAGE.keno)||'{}');return x&&typeof x==='object'?x:{}}catch(_){return {}}}
function validKeno(v){if(typeof v==='string'){try{v=JSON.parse(v)}catch(_){v=v.split(/[\s,，;；|]+/).filter(Boolean)}}if(v&&typeof v==='object'&&!Array.isArray(v))v=v.numbers??v.items??v.balls??v.data??v.keno;if(!Array.isArray(v))return[];const a=v.map(x=>Number(typeof x==='object'&&x!==null?(x.number??x.n??x.value??x.ball):x));return a.length===20&&a.every(n=>Number.isInteger(n)&&n>=1&&n<=80)&&new Set(a).size===20?a:[]}
function cacheKeno(id,nums){
  if(!id||!Array.isArray(nums)||nums.length!==20)return;
  const key=String(id),clean=nums.map(Number),cache=readKenoCache(),old=validKeno(cache[key]);
  if(old.length===20&&old.every((n,i)=>n===clean[i]))return;
  cache[key]=clean.slice();
  const keys=Object.keys(cache);for(const k of keys.slice(0,Math.max(0,keys.length-250)))delete cache[k];
  safeSet(STORAGE.keno,JSON.stringify(cache));
}
const VALID_COMBOS=new Set(['大单','大双','小单','小双']);
const VALID_SHAPES=new Set(['豹子','对子','顺子','杂六']);
const VALID_DRAGONS=new Set(['龙','虎','和']);
const VALID_EDGES=new Set(['小边','中边','大边']);
const VALID_EXTREMES=new Set(['极小','普通','极大']);
function categoryOr(value,allowed,fallback){const text=String(value??'');return allowed.has(text)?text:fallback}
function parseDraw(d){if(!d||typeof d!=='object')return null;const digits=[Number(d.n1),Number(d.n2),Number(d.n3)];if(!digits.every(n=>Number.isInteger(n)&&n>=0&&n<=9))return null;const sum=digits.reduce((a,b)=>a+b,0);const id=String(d.nbr??d.id??'');if(!id)return null;let keno=validKeno(d.keno??d.keno20??d.keno_numbers??d.kenoNumbers??d.original_keno??d.originalKeno??d.numbers20);const cache=readKenoCache();if(keno.length===20)cacheKeno(id,keno);else if(cache[id])keno=validKeno(cache[id]);return {id,digits,sum,time:String(d.time||''),opentime:d.opentime??d.open_time??d.timestamp??null,combo:categoryOr(d.combo,VALID_COMBOS,comboOf(sum)),shape:categoryOr(d.shape,VALID_SHAPES,shapeOf(digits)),dragon:categoryOr(d.dragon,VALID_DRAGONS,dragonOf(digits)),edge:categoryOr(d.pos??d.edge,VALID_EDGES,edgeOf(sum)),extreme:categoryOr(d.extreme,VALID_EXTREMES,extremeOf(sum)),keno,source:'API'} }
function normalizeTime(t){if(!t)return'—';return String(t).replace('T',' ').replace(/([+-]\d\d:\d\d|Z)$/,'').slice(0,19)}
function sumOf(r){return r.digits.reduce((a,b)=>a+b,0)}
function comboOf(sum){return (sum<=13?'小':'大')+(sum%2?'单':'双')}
function edgeOf(sum){return sum<=7?'小边':sum<=17?'中边':'大边'}
function extremeOf(sum){return sum<=5?'极小':sum>=22?'极大':'普通'}
function dragonOf(d){return d[0]>d[2]?'龙':d[0]<d[2]?'虎':'和'}
function shapeOf(d){const u=new Set(d).size;if(u===1)return'豹子';if(u===2)return'对子';const a=[...d].sort((x,y)=>x-y);return a[1]===a[0]+1&&a[2]===a[1]+1?'顺子':'杂六'}
function enrich(r){if(!r||!String(r.id??'').trim()||!Array.isArray(r.digits)||r.digits.length!==3||!r.digits.every(n=>Number.isInteger(n)&&n>=0&&n<=9))return null;r.id=String(r.id);r.sum=sumOf(r);r.combo=categoryOr(r.combo,VALID_COMBOS,comboOf(r.sum));r.edge=categoryOr(r.edge,VALID_EDGES,edgeOf(r.sum));r.extreme=categoryOr(r.extreme,VALID_EXTREMES,extremeOf(r.sum));r.dragon=categoryOr(r.dragon,VALID_DRAGONS,dragonOf(r.digits));r.shape=categoryOr(r.shape,VALID_SHAPES,shapeOf(r.digits));r.keno=validKeno(r.keno);if(r.keno.length===20)cacheKeno(r.id,r.keno);return r}
function currentRecords(){return state.records.slice().sort((a,b)=>Number(a.id)-Number(b.id))}
function recordStorageSignature(r){return [String(r?.id??''),String(r?.time??''),String(r?.opentime??''),(r?.digits||[]).join(','),String(r?.sum??''),String(r?.combo??''),String(r?.shape??''),String(r?.dragon??''),String(r?.edge??''),String(r?.extreme??''),validKeno(r?.keno).join(',')].join('|')}
function mergeDraws(draws){
  const m=new Map(state.records.map(r=>[String(r.id),r]));
  const kcache=readKenoCache();
  let storageDirty=false;
  for(const raw of draws){
    const r=raw&&raw.digits?enrich({...raw}):parseDraw(raw);
    if(!r)continue;
    const id=String(r.id),old=m.get(id);
    if(r.keno.length!==20&&old?.keno?.length===20)r.keno=old.keno.slice();
    if(r.keno.length!==20&&kcache[id])r.keno=validKeno(kcache[id]);
    if(!old||recordStorageSignature(old)!==recordStorageSignature(r))storageDirty=true;
    m.set(id,r);
  }
  const merged=[...m.values()].sort((a,b)=>Number(a.id)-Number(b.id)).slice(-500);
  if(merged.length!==state.records.length)storageDirty=true;
  state.records=merged;
  const latest=state.latest&&m.get(String(state.latest.id));
  if(latest&&latest.keno.length!==20){
    const retained=state.records.find(r=>String(r.id)===String(latest.id));
    if(retained?.keno?.length===20)state.latest={...state.latest,keno:retained.keno.slice()};
  }
  if(storageDirty)safeSet(STORAGE.records,JSON.stringify(state.records.map(r=>({...r,source:'cache'}))));
}
function restoreCache(){try{const raw=JSON.parse(safeGet(STORAGE.records)||'[]');if(Array.isArray(raw))mergeDraws(raw.slice(-500))}catch(_){}}
function setStatus(text,type='ok'){
  const detail=String(text??'');
  const dot=$('#statusDot'),label=$('#statusText'),status=label?.closest('.status');
  let compact=detail;
  if(/API\s*已同步/.test(detail))compact='已同步';
  else if(/暂不可用|同步失败|载入失败|请求失败|发生错误/.test(detail))compact='离线';
  else if(/正在连接|连接中|同步中/.test(detail))compact='连接中';
  else if(/正在联网校准|校准/.test(detail))compact='校准中';
  else if(/显示缓存|缓存数据/.test(detail))compact='缓存';
  else if(detail.length>7)compact=detail.slice(0,6)+'…';
  if(label){label.textContent=compact;label.title=detail;label.setAttribute('aria-label',detail)}
  if(status){status.title=detail;status.setAttribute('aria-label','API 状态：'+detail);status.classList.toggle('is-ok',type==='ok');status.classList.toggle('is-warn',type==='warn');status.classList.toggle('is-error',type==='err')}
  if(dot)dot.className='dot'+(type==='warn'?' warn':type==='err'?' err':'');
}
let toastTimer=0;function toast(msg){const e=$('#toast');e.textContent=String(msg);e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),3100)}
async function getJSON(path,timeout=9000){const ctrl=new AbortController();const tid=setTimeout(()=>ctrl.abort(),timeout);try{const res=await fetch(API+path,{signal:ctrl.signal,headers:{Accept:'application/json'},cache:'no-store'});if(!res.ok)throw new Error('HTTP '+res.status);const j=await res.json();if(j?.ok===false)throw new Error(j.error?.message||'API 返回错误');return j}finally{clearTimeout(tid)}}
function getDrawFromLatest(j){return j?.data?.draw??j?.data?.item??null}
function setCountdown(j){const c=j?.data?.countdown;const sec=Number(c?.seconds);const at=Number(c?.next_draw_at);state.countdownSeconds=Number.isFinite(sec)&&sec>=0?sec:null;state.nextDrawAt=Number.isFinite(at)&&at>1e12?at:(state.countdownSeconds===null?null:Date.now()+state.countdownSeconds*1000)}
function drawDataSignature(r){if(!r)return '';return [String(r.id??''),String(r.time??''),String(r.opentime??''),(r.digits||[]).join(','),String(r.sum??''),String(r.combo??''),String(r.shape??''),String(r.dragon??''),String(r.edge??''),String(r.extreme??''),validKeno(r.keno).join(',')].join('|')}
async function fetchLatest({silent=false}={}){
  if(state.loading)return;state.loading=true;
  try{
    const previousSignature=drawDataSignature(latestDraw());
    const j=await getJSON('/draws/latest?format=json');const raw=getDrawFromLatest(j);const d=parseDraw(raw);
    if(!d)throw new Error('latest 响应中没有有效的 data.draw');
    const previous=state.records.find(r=>String(r.id)===String(d.id));
    if(d.keno.length!==20&&previous?.keno?.length===20)d.keno=previous.keno.slice();
    if(d.keno.length!==20)await maybeFetchKeno(d);
    state.latest=d;mergeDraws([d]);state.latest=state.records.find(r=>String(r.id)===String(d.id))||d;
    state.updatedAt=new Date();setCountdown(j);setStatus('API 已同步 · '+state.updatedAt.toLocaleTimeString('zh-CN',{hour12:false}));
    const changed=previousSignature!==drawDataSignature(state.latest);
    if(changed){renderDraw();analyticsRenderSignature='';rollingForecastCacheKey='';renderAnalytics(true)}
    else $('#metaUpdated').textContent=state.updatedAt.toLocaleString('zh-CN',{hour12:false});
    if(!silent&&state.latest)toast('最新开奖已同步：第 '+d.id+' 期');
  }catch(e){setStatus('API 暂不可用 · 保留已有数据','warn');if(!state.latest&&state.records.length){state.latest=state.records[state.records.length-1];renderDraw();analyticsRenderSignature='';renderAnalytics(true)}if(!silent)toast('同步失败：'+(e.message||'请检查网络'))}
  finally{state.loading=false}
}
async function maybeFetchKeno(draw){const id=String(draw.id),now=Date.now();if((state.lastKenoAttempt[id]||0)>now-15000)return;state.lastKenoAttempt[id]=now;const cached=readKenoCache()[id];if(cached){draw.keno=validKeno(cached);if(draw.keno.length===20)return}try{const j=await getJSON('/draws/'+encodeURIComponent(id),6000);const raw=j?.data?.draw??j?.data?.item??j?.data;const k=validKeno(raw?.keno??raw?.keno20??raw?.keno_numbers??raw?.kenoNumbers);if(String(raw?.nbr??raw?.id??id)===id&&k.length===20){draw.keno=k;cacheKeno(id,k);return}}catch(_){} }
function recordsRenderSignature(){return state.records.map(recordStorageSignature).join('\n')}
async function fetchHistory({quiet=true}={}){
  if(state.historyLoading)return false;
  state.historyLoading=true;
  try{
    const beforeRecords=recordsRenderSignature();
    const beforeLatest=drawDataSignature(latestDraw());
    const j=await getJSON('/draws?limit=200',12000);
    const items=j?.data?.items;
    if(!Array.isArray(items))throw new Error('历史响应中缺少 data.items');
    mergeDraws(items);
    state.historyLoaded=true;state.historyError='';
    if(!state.latest&&state.records.length)state.latest=state.records[state.records.length-1];
    if(state.latest){const r=state.records.find(x=>String(x.id)===String(state.latest.id));if(r&&r.keno.length===20)state.latest={...state.latest,keno:r.keno.slice()}}
    const recordsChanged=beforeRecords!==recordsRenderSignature();
    const latestChanged=beforeLatest!==drawDataSignature(latestDraw());
    if(recordsChanged||latestChanged){rollingForecastCacheKey='';analyticsRenderSignature='';renderDraw();renderAnalytics(true)}
    // The history endpoint succeeding must not mask a failed latest-draw request in the top status.
    return true;
  }catch(e){
    state.historyError=e.message||'history API 请求失败';state.historyLoaded=true;
    if(!state.updatedAt)setStatus('历史 API 暂不可用 · 保留已有数据','warn');
    if(!quiet)toast('历史载入失败：'+state.historyError);
    analyticsRenderSignature='';renderAnalytics(true);return false;
  }finally{
    state.historyLoading=false;
  }
}
function latestDraw(){return state.latest||state.records[state.records.length-1]||null}
function setDataReady(ready){
  const isReady=Boolean(ready);
  document.body.dataset.dataReady=isReady?'true':'false';
  document.querySelectorAll('[data-skeleton-region]').forEach(el=>el.setAttribute('aria-busy',String(!isReady)));
  if(isReady&&!latestDraw()){
    const tags=$('#drawTags');
    if(tags){tags.querySelectorAll('.skeleton-placeholder').forEach(el=>el.remove());if(!tags.children.length)tags.innerHTML='<span class="chip">等待 API 开奖数据</span>'}
  }
}
let scratchPrivacySnapshot=null,scratchRevealedForDraw=false;
let analyticsRenderSignature="";
function drawTags(r){const s=r.sum;const tags=[{v:s<=13?'小':'大',c:''},{v:s%2?'单':'双',c:'blue'},{v:r.combo,c:'amber'},{v:r.shape,c:'violet'},{v:'龙虎 '+r.dragon,c:'blue'},{v:'边数 '+r.edge,c:''},{v:'和值 '+s,c:'amber'}];$('#drawTags').innerHTML=tags.map(x=>`<span class="chip ${x.c}">${esc(x.v)}</span>`).join('')}
function renderDraw(){
  const r=latestDraw();if(!r)return;
  const prevId=lastRenderedDrawId;
  lastRenderedDrawId=String(r.id);
  const isNewDraw=!!prevId&&prevId!==lastRenderedDrawId;
  if(isNewDraw&&soundEnabled)playTripleChime();
  $('#periodNo').textContent=r.id;
  const drawTimeText=normalizeTime(r.time);
  $('#drawTimeInline').textContent=drawTimeText;
  const heroTime=$('#heroDrawTime');
  if(heroTime){
    heroTime.textContent=drawTimeText;
    if(!prevId||isNewDraw){heroTime.classList.remove('time-changed');void heroTime.offsetWidth;heroTime.classList.add('time-changed')}
  }
  $('#drawBalls').innerHTML=`<span class="ball">${r.digits[0]}</span><span class="op">+</span><span class="ball b2">${r.digits[1]}</span><span class="op">+</span><span class="ball b3">${r.digits[2]}</span><span class="op">=</span><span class="ball sum">${r.sum}</span>`;
  $('#drawCombo').textContent=`组合：${r.combo} · ${r.sum%2?'单':'双'}`;
  $('#drawShape').textContent=`形态：${r.shape}`;
  $('#drawStatus').innerHTML='<i class="dot"></i> 已开奖';
  drawTags(r);
  $('#metaDrawTime').textContent=drawTimeText;
  const valid=r.digits.length===3&&r.digits.every(n=>Number.isInteger(n)&&n>=0&&n<=9)&&r.sum===sumOf(r);
  $('#metaValidate').textContent=valid?'换算校验通过':'校验异常';
  $('#metaValidate').style.color=valid?'var(--mint)':'var(--rose)';
  $('#metaUpdated').textContent=state.updatedAt?state.updatedAt.toLocaleString('zh-CN',{hour12:false}):'使用缓存数据';
  $('#metaNextTime').textContent=state.nextDrawAt?new Date(state.nextDrawAt).toLocaleString('zh-CN',{hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'API 暂未提供';
  const nums=validKeno(r.keno);
  $('#kenoState').textContent=nums.length===20?'已载入 20 球':(readKenoCache()[String(r.id)]?'正在恢复号码':'API 未返回 Keno 20 球');
  $('#kenoGrid').innerHTML=nums.length===20?nums.map(n=>`<div class="keno-ball">${n}</div>`).join(''):'<div class="tag" style="grid-column:1/-1;justify-content:center;padding:12px">API 未返回 Keno 20 号码；其余开奖与预测数据仍可正常使用。</div>';
  if(scratchEnabled){
    if(isNewDraw||!prevId)resetScratchForNewDraw(false);
    else if(!scratchRevealedForDraw){scratchPrivacySnapshot=captureScratchDetails();maskScratchDetails()}
  }
}
function renderCountdown(){const e=$('#countdownText'),hint=$('#countdownHint');if(!state.nextDrawAt){e.textContent='--:--';hint.textContent='等待 API 下期开奖时间';return}const remain=Math.max(0,Math.ceil((state.nextDrawAt-Date.now())/1000));e.textContent=String(Math.floor(remain/60)).padStart(2,'0')+':'+String(remain%60).padStart(2,'0');hint.textContent=remain===0?'等待 API 更新开奖状态':'以 API 下期开奖时间为基准；页面每 3 秒同步一次'}
function windowN(){return Number($('#windowSelect').value)||50}
function probabilityWindow(hist,n){const tail=hist.slice(-n);const counts=Array(28).fill(0);for(const r of tail)counts[r.sum]++;const shrink=Math.max(4,Math.round(n*.16));return counts.map((v,i)=>(v+shrink*theoryP[i])/(tail.length+shrink||1))}
function decayProbability(hist){const counts=Array(28).fill(0);let total=0;const tau=32;hist.slice(-200).forEach((r,i,a)=>{const age=a.length-1-i;const w=Math.exp(-age/tau);counts[r.sum]+=w;total+=w});const prior=7;return counts.map((v,i)=>(v+prior*theoryP[i])/(total+prior))}
function getScores(hist,focus=windowN()){
  const n=Math.max(20,Math.min(200,Number(focus)||50));
  const h=hist.slice(-n);if(!h.length)return theoryP.slice();
  const d=decayProbability(h),p20=probabilityWindow(h,Math.min(20,n)),pfocus=probabilityWindow(h,n),p100=probabilityWindow(h,Math.min(100,n));
  // 去除短窗口下重复采样造成的重复计权；窗口越长，越有空间单独使用中期频率。
  let scores=Array(28).fill(0);
  if(n<=20){for(let i=0;i<28;i++)scores[i]=.52*p20[i]+.28*d[i]+.20*theoryP[i]}
  else if(n<=50){for(let i=0;i<28;i++)scores[i]=.22*p20[i]+.38*pfocus[i]+.30*d[i]+.10*theoryP[i]}
  else if(n<=100){for(let i=0;i<28;i++)scores[i]=.18*p20[i]+.47*p100[i]+.25*d[i]+.10*theoryP[i]}
  else{for(let i=0;i<28;i++)scores[i]=.10*p20[i]+.20*pfocus[i]+.25*p100[i]+.35*d[i]+.10*theoryP[i]}
  const sum=scores.reduce((a,b)=>a+b,0);return scores.map(v=>v/(sum||1))
}
function breakdown(sum){return `${sum<=13?'小':'大'}${sum%2?'单':'双'} · ${edgeOf(sum)} · ${extremeOf(sum)}`}
function ranked(hist,focus=windowN()){const ps=getScores(hist,focus);return ps.map((score,sum)=>({sum,score})).sort((a,b)=>b.score-a.score||a.sum-b.sum)}
function backtest(hist,focus){const n=hist.length;const warm=Math.min(100,Math.max(35,Math.floor(n*.45)));const start=Math.max(35,warm);if(n-start<20)return {n:0,rates:null,baseline:null};let hits=[0,0,0],tested=0;for(let i=start;i<n;i++){const actual=hist[i].sum;const top=ranked(hist.slice(0,i),focus).slice(0,5).map(x=>x.sum);tested++;if(top.slice(0,1).includes(actual))hits[0]++;if(top.slice(0,3).includes(actual))hits[1]++;if(top.includes(actual))hits[2]++}const topTheory=theoryP.map((p,sum)=>({p,sum})).sort((a,b)=>b.p-a.p);const baseline=[1,3,5].map(k=>topTheory.slice(0,k).reduce((a,x)=>a+x.p,0));return{n:tested,rates:hits.map(v=>v/tested),baseline}}
function sumModelScores(hist,focus,model){
  const n=Math.max(1,Math.min(200,Number(focus)||50)),h=hist.slice(-n);
  if(model==='theory')return theoryP.slice();
  if(model==='frequency')return probabilityWindow(h,n);
  if(model==='decay')return decayProbability(h);
  if(model==='markov'){
    const cur=h.at(-1)?.sum;
    if(cur===undefined)return theoryP.slice();
    const counts=Array(28).fill(0);let total=0;
    for(let i=Math.max(0,h.length-120);i<h.length-1;i++){
      if(h[i].sum!==cur)continue;
      const age=(h.length-2)-i,w=Math.exp(-age/45);
      counts[h[i+1].sum]+=w;total+=w;
    }
    const alpha=8;
    return counts.map((v,i)=>(v+alpha*theoryP[i])/(total+alpha));
  }
  return getScores(h,n);
}
function sumModelBacktest(hist,focus,model){
  const h=hist.slice(-Math.max(1,Math.min(200,Number(focus)||50)));
  const start=Math.max(25,Math.min(60,Math.floor(h.length*.4)));
  if(h.length-start<15)return {tested:0,top1:0,top3:0,top5:0};
  let top1=0,top3=0,top5=0,tested=0;
  for(let i=start;i<h.length;i++){
    const prior=h.slice(0,i),actual=h[i].sum;
    const scores=sumModelScores(prior,focus,model);
    const order=scores.map((score,sum)=>({score,sum})).sort((a,b)=>b.score-a.score||a.sum-b.sum);
    if(order[0]?.sum===actual)top1++;
    if(order.slice(0,3).some(x=>x.sum===actual))top3++;
    if(order.slice(0,5).some(x=>x.sum===actual))top5++;
    tested++;
  }
  return {tested,top1:top1/(tested||1),top3:top3/(tested||1),top5:top5/(tested||1)};
}
const SUM_MODEL_CATALOG = [
  {key:'ensemble',name:'融合模型'},
  {key:'frequency',name:'历史频率（平滑）'},
  {key:'markov',name:'一阶转移（平滑）'},
  {key:'decay',name:'近期衰减模型'},
  {key:'theory',name:'理论概率基线'}
];
function orderedSumModels(hist,focus){
  return SUM_MODEL_CATALOG.map((model,index)=>({...model,index,stats:sumModelBacktest(hist,focus,model.key)}))
    .sort((a,b)=>{
      if(a.stats.tested!==b.stats.tested && (a.stats.tested>0 || b.stats.tested>0)){
        if(!a.stats.tested)return 1;if(!b.stats.tested)return -1;
      }
      return b.stats.top3-a.stats.top3 || b.stats.top1-a.stats.top1 || b.stats.top5-a.stats.top5 || a.index-b.index;
    });
}
function fourSumCandidates(hist,focus){
  const models=orderedSumModels(hist,focus),picked=[],seen=new Set();
  // Each of the four best-performing available sum models contributes its highest-ranked unused value.
  for(const model of models.slice(0,4)){
    const scores=sumModelScores(hist,focus,model.key);
    const order=scores.map((score,sum)=>({score,sum})).sort((a,b)=>b.score-a.score||a.sum-b.sum);
    const item=order.find(x=>!seen.has(x.sum));
    if(item){seen.add(item.sum);picked.push({...item,model:model.name,modelTested:model.stats.tested,modelTop3:model.stats.top3});}
  }
  // Keep four unique values even when several models nominate the same sum.
  for(const item of ranked(hist,focus)){
    if(picked.length>=4)break;
    if(seen.has(item.sum))continue;
    seen.add(item.sum);picked.push({...item,model:'融合候选补位',modelTested:0,modelTop3:0});
  }
  return {items:picked.slice(0,4),models};
}
function goblinFourSumCandidates(hist,focus=windowN()){
  if(!Array.isArray(hist)||!hist.length)return [];
  const recent=hist.slice(-Math.max(1,Math.min(200,Number(focus)||50)));
  const prediction=goblinPredictNext(recent.at(-1));
  if(!prediction)return [];
  const scores=getScores(recent,recent.length);
  const allowed=new Set(prediction.threeDoor||[]);
  // Goblin's original output is group-oriented. Expand its three-door groups into four sum candidates.
  // Within eligible groups, preserve the KA28 sum score ordering; this is a transparent hybrid mapping.
  const rankedSums=scores.map((score,sum)=>({sum,score,group:comboOf(sum)}))
    .filter(x=>allowed.has(x.group))
    .sort((a,b)=>b.score-a.score||a.sum-b.sum);
  const chosen=rankedSums.slice(0,4);
  if(chosen.length<4){
    const seen=new Set(chosen.map(x=>x.sum));
    for(const x of scores.map((score,sum)=>({sum,score,group:comboOf(sum)})).sort((a,b)=>b.score-a.score||a.sum-b.sum)){
      if(chosen.length>=4)break;if(seen.has(x.sum))continue;seen.add(x.sum);chosen.push(x);
    }
  }
  return chosen.slice(0,4).map((x,i)=>({...x,rank:i+1,group:comboOf(x.sum),source:allowed.has(x.group)?'星轨三门':'融合补位'}));
}
function renderGoblinFourAndCompare(hist){
  // 哥布林四码现在逐期显示在“真实开奖预测记录”的哥布林算法模块下；不再渲染独立四码排行榜。
  return;
}

function renderPrediction(hist){
  const focus=windowN(),used=Math.min(hist.length,focus);
  $('#historyCount').textContent=hist.length+' 期历史';
  const summary=$('#windowSummary');
  if(summary)summary.textContent=hist.length?`本次使用 ${used} / ${focus} 期 · 可用历史 ${hist.length} 期`:`最近 ${focus} 期 · 等待真实历史数据`;
  const root=$('#sumFourCodes'),note=$('#sumFourNote');
  if(!root)return;
  if(!hist.length){
    root.innerHTML=Array.from({length:4},(_,i)=>`<button class="sum-four-card" type="button" disabled><span class="sum-four-kicker">参考 0${i+1}</span><strong>—</strong><small>等待历史数据</small></button>`).join('');
    if(note)note.textContent='连接真实历史 API 后，将按和值模型回测表现选出四码；当前没有足够样本。';
    return;
  }
  const {items,models}=fourSumCandidates(hist,focus);
  root.innerHTML=items.map((x,i)=>`<button class="sum-four-card" type="button" data-sum-value="${x.sum}" aria-label="和值候选 ${x.sum}，${breakdown(x.sum)}"><span class="sum-four-kicker">参考 0${i+1}</span><strong>${x.sum}<span class="sum-four-chicken" aria-hidden="true">🐓</span></strong><small>${breakdown(x.sum)}</small><em>${x.model}</em></button>`).join('');
  const tested=items.filter(x=>x.modelTested>0).length;
  if(note)note.textContent=tested?`候选四码来自和值模型历史回测排名；当前有 ${tested}/4 个入选模型具备可用回测样本。所有候选仅作统计参考，不保证未来命中。`:'回测样本暂不足，四码按现有和值模型输出临时排序；积累更多历史后才可比较模型表现。';
}


const FOUR_GROUPS=sourceAlgoPack.COMBOS;
let killModelCacheKey='',killModelCache=null,threeDoorCacheKey='',threeDoorCache=null,rangeKillCacheKey='',rangeKillCache=null;
let soundEnabled=false,audioContext=null,audioMasterGain=null,lastRenderedDrawId=null,scratchEnabled=false,scratchContext=null,scratchMoved=0,scratchLastPoint=null;
let rangeBacktestPeriod=Math.max(10,Math.min(100,Number(safeGet('ka28.rangeBacktestPeriod'))||30));
const selectedAlgoIds=new Set();let currentAlgoRankings=[];let algoRankExpanded=false;let sheetCloseTimer=0;let sheetMode='algo';let sheetReturnFocus=null;
function legacyHistory(hist){return hist.slice().reverse().map(r=>({expect:String(r.id),nums:r.digits.slice(),sum:r.sum,type:sourceAlgoPack.typeA(r.sum),time:r.time||'',opentime:r.opentime??r.timestamp??null}))}
function calcOwnGroupModel(hist){
  const prior={};const theoreticalGroup={};FOUR_GROUPS.forEach(g=>{theoreticalGroup[g]=0});
  for(let sum=0;sum<=27;sum++)theoreticalGroup[sourceAlgoPack.typeA(sum)]+=theoretical[sum];
  const totalPrior=Object.values(theoreticalGroup).reduce((a,b)=>a+b,0)||1;
  FOUR_GROUPS.forEach(g=>prior[g]=theoreticalGroup[g]/totalPrior);
  const freq=(arr)=>{const c=Object.fromEntries(FOUR_GROUPS.map(g=>[g,0]));arr.forEach(r=>c[r.combo]++);const n=arr.length,alpha=4;return Object.fromEntries(FOUR_GROUPS.map(g=>[g,(c[g]+alpha*prior[g])/(n+alpha)]))};
  const p20=freq(hist.slice(-20)),p50=freq(hist.slice(-50)),p100=freq(hist.slice(-100));
  const cur=hist.at(-1)?.combo;const trans=Object.fromEntries(FOUR_GROUPS.map(g=>[g,2*prior[g]]));let tn=0;
  // Only historical transitions are counted; mild exponential decay favors recent transitions.
  for(let i=Math.max(0,hist.length-120);i<hist.length-1;i++){if(hist[i].combo!==cur)continue;const age=(hist.length-2)-i,w=Math.exp(-age/45);trans[hist[i+1].combo]+=w;tn+=w}
  const tTotal=Object.values(trans).reduce((a,b)=>a+b,0)||1;const tp=Object.fromEntries(FOUR_GROUPS.map(g=>[g,trans[g]/tTotal]));
  const scores=Object.fromEntries(FOUR_GROUPS.map(g=>[g,.2*p20[g]+.3*p50[g]+.15*p100[g]+.35*tp[g]]));
  return {kill:Object.keys(scores).sort((a,b)=>scores[a]-scores[b])[0],scores,weights:{p20:.2,p50:.3,p100:.15,transition:.35}};
}
function sourceRangeKill(prev,range){if(!prev)return null;const rnd=seeded01(parseInt(prev.id,10)||0);const rand=Number((rnd()*(range.max-range.min)+range.min).toFixed(8));const prod=rand*prev.sum;const digitSum=value=>String(value).replace('.','').split('').reduce((a,c)=>a+(Number(c)||0),0);const finalSum=digitSum(prod.toFixed(3));const finalType=(finalSum<14?'小':'大')+(finalSum%2===0?'双':'单');const frac=rand.toFixed(8).split('.')[1]||'000';const rdSum=[...frac.slice(0,3)].reduce((a,c)=>a+Number(c),0);const seqIdx=n=>THREE_SEQ.map((v,i)=>v.includes(n)?i:-1).filter(i=>i>=0);const same=seqIdx(rdSum).some(i=>seqIdx(prev.sum).includes(i));const rules=same?THREE_RULES.same:THREE_RULES.diff;const groups=uniqueThree(rules[finalType]);return FOUR_GROUPS.find(g=>!groups.includes(g))||null}
function rangeKillModel(hist,force=false){const key=[hist.length,hist[0]?.id,hist.at(-1)?.id,rangeBacktestPeriod].join('|');if(!force&&key===rangeKillCacheKey&&rangeKillCache)return rangeKillCache;if(hist.length<6)return {kill:null,range:null,rate:null,tested:0};const ranges=[];for(let min=0;min<=.8;min+=.1)for(let width=.2;width<=.5;width+=.1)if(min+width<=1.0001)ranges.push({min:Number(min.toFixed(2)),max:Number((min+width).toFixed(2))});const begin=Math.max(1,hist.length-Math.min(rangeBacktestPeriod,hist.length-1));let best=null;for(const range of ranges){let hit=0,tested=0;for(let i=begin;i<hist.length;i++){const predicted=sourceRangeKill(hist[i-1],range);if(!predicted)continue;tested++;if(hist[i].combo!==predicted)hit++}const rate=tested?hit/tested:0;const score=rate-.025*Math.abs((range.max-range.min)-.3);if(!best||score>best.score)best={range,hit,tested,rate,score}}const kill=sourceRangeKill(hist.at(-1),best?.range||{min:.25,max:.45});rangeKillCache={kill,range:best?.range||null,rate:best?.rate??null,tested:best?.tested||0};rangeKillCacheKey=key;return rangeKillCache}
function sourceVoteModel(hist){
  const key=[hist.length,hist[0]?.id,hist.at(-1)?.id,windowN()].join('|');if(key===killModelCacheKey&&killModelCache)return killModelCache;
  const adapted=legacyHistory(hist), limit=Math.min(50,Math.max(0,adapted.length-1)), stats={};
  sourceAlgoPack.ALGOS.forEach(algo=>{let hit=0,tested=0;for(let i=0;i<limit;i++){const prev=adapted.slice(i+1);if(prev.length<2)continue;let result=null;try{result=algo.fn(prev)}catch(_){}const kill=result?.killGroup;if(!FOUR_GROUPS.includes(kill))continue;tested++;if(adapted[i].type!==kill)hit++}const rate=(hit+15)/(tested+20);const reliability=tested/(tested+18);stats[algo.id]={hit,tested,rate,weight:Math.max(.12,Math.min(1.5,(rate/.75)*reliability)),algo}});
  const tally=Object.fromEntries(FOUR_GROUPS.map(g=>[g,0]));const contributors=Object.fromEntries(FOUR_GROUPS.map(g=>[g,0]));
  sourceAlgoPack.ALGOS.forEach(algo=>{let result=null;try{result=algo.fn(adapted)}catch(_){}const g=result?.killGroup;if(!FOUR_GROUPS.includes(g))return;const w=stats[algo.id]?.weight||.5;tally[g]+=w;contributors[g]++});
  const own=calcOwnGroupModel(hist);const ownWeight=4.2;tally[own.kill]+=ownWeight;contributors[own.kill]++;const interval=rangeKillModel(hist);if(interval.kill){tally[interval.kill]+=2.8;contributors[interval.kill]++;}
  // 所有历史公式、频率转移自研模型、区间杀号模型共同投票；权重来自仅使用过去期的滚动验证。
  const winner=FOUR_GROUPS.slice().sort((a,b)=>tally[b]-tally[a]||own.scores[a]-own.scores[b])[0];
  const total=Object.values(tally).reduce((a,b)=>a+b,0)||1;const result={winner,tally,contributors,own,interval,algoCount:sourceAlgoPack.ALGOS.length,agree:contributors[winner],share:tally[winner]/total,stats};killModelCacheKey=key;killModelCache=result;return result;
}
function seeded01(seed){let s=seed|0;return()=>{s=(s|0)+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,s|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
const THREE_SEQ=[[0,3,9,12,15,18,21,24,27],[1,4,7,10,13,16,19,22,25],[2,5,8,11,14,17,20,23,26]];
const THREE_RULES={same:{'小双':['小双','大双','大单'],'小单':['小单','大单','大双'],'大双':['大双','小双','小单'],'大单':['大单','小单','小双']},diff:{'小双':['小双','小单','大单'],'小单':['小单','小双','大双'],'大双':['大双','大单','小单'],'大单':['大单','大双','小单']},none:{'小双':['小双','小单','大双'],'小单':['小单','小双','大双'],'大双':['大双','小单','大单'],'大单':['大单','大双','小单']}};
function uniqueThree(groups){return [...new Set(groups||[])].filter(g=>FOUR_GROUPS.includes(g)).slice(0,3)}
function threeDoorForPrev(prev,range){if(!prev)return FOUR_GROUPS.slice(0,3);const rnd=seeded01((parseInt(prev.id,10)||0)*1000+prev.digits[0]*100+prev.digits[1]*10+prev.digits[2]);let n=rnd();for(let i=1;i<Math.max(...prev.digits);i++)n=rnd();const rand=Number((n*(range.max-range.min)+range.min).toFixed(8));const prod=rand*prev.sum;const dec=(prod.toFixed(10).split('.')[1]||'000').slice(0,3).padEnd(3,'0');const decSum=[...dec].reduce((a,b)=>a+Number(b),0);const hasMatch=[...dec].some(ch=>prev.digits.includes(Number(ch)));const sequenceIdx=n=>THREE_SEQ.map((v,i)=>v.includes(n)?i:-1).filter(i=>i>=0);const same=sequenceIdx(decSum).some(i=>sequenceIdx(prev.sum).includes(i));const typ=(prev.sum<14?'小':'大')+(prev.sum%2===0?'双':'单');const groups=hasMatch?(same?THREE_RULES.same[typ]:THREE_RULES.diff[typ]):THREE_RULES.none[typ];return uniqueThree(groups)}
function threeDoorModel(hist){const key=[hist.length,hist[0]?.id,hist.at(-1)?.id].join('|');if(key===threeDoorCacheKey&&threeDoorCache)return threeDoorCache;if(hist.length<12)return {groups:[],range:null,rate:null,tested:0};const ranges=[];for(let min=0;min<=.8;min+=.1)for(let width=.2;width<=.5;width+=.1){const max=min+width;if(max<=1.0001)ranges.push({min:Number(min.toFixed(2)),max:Number(max.toFixed(2))})}const tail=hist.slice(-Math.min(50,hist.length));let best=null;for(const range of ranges){let hits=0,tested=0;for(let i=1;i<tail.length;i++){const groups=threeDoorForPrev(tail[i-1],range);const actual=tail[i].combo;tested++;if(groups.includes(actual))hits++}const rate=tested?hits/tested:0;const score=rate-.035*Math.abs((range.max-range.min)-.3);if(!best||score>best.score)best={range,rate,tested,hits,score}}const last=hist.at(-1);threeDoorCache={groups:threeDoorForPrev(last,best?.range||{min:.25,max:.55}),range:best?.range||null,rate:best?.rate??null,tested:best?.tested||0};threeDoorCacheKey=key;return threeDoorCache}
function renderAlgoLeaderboard(hist,models){
  const root=$('#algoLeaderboard');if(!root)return;
  const windowTag=$('#algoRankWindow');if(windowTag)windowTag.textContent=`最近 ${hist.length||windowN()} 期窗口`;
  if(!hist.length||!models){currentAlgoRankings=[];root.innerHTML='<div class="tag">历史样本不足，暂时无法排行</div>';const actions=$('#algoRankActions');if(actions)actions.hidden=true;selectedAlgoIds.clear();if(sheetMode==='algo')closeAlgoSheet(false);return}
  const adapted=legacyHistory(hist);
  const items=sourceAlgoPack.ALGOS.map(algo=>{
    const st=models.stats?.[algo.id]||{hit:0,tested:0,rate:0,weight:0};
    let prediction=null;try{prediction=algo.fn(adapted)}catch(_){prediction=null}
    const rawKill=prediction?.killGroup,hasKill=FOUR_GROUPS.includes(rawKill),kill=hasKill?rawKill:'—';
    const tested=Number(st.tested)||0,hit=Number(st.hit)||0,rate=tested?hit/tested:0;
    const rest=FOUR_GROUPS.filter(g=>g!==rawKill).sort((a,b)=>(models.tally[b]||0)-(models.tally[a]||0));
    const ownTwo=Array.isArray(prediction?.recommends)?prediction.recommends.filter(g=>FOUR_GROUPS.includes(g)).slice(0,2):null;
    const ownThree=Array.isArray(prediction?.mainCandidates)?prediction.mainCandidates.filter(g=>FOUR_GROUPS.includes(g)).slice(0,3):null;
    return {id:algo.id,name:algo.name,source:algo.src,formula:algo.formula||'',hit,tested,rate,smoothedRate:Number(st.rate)||0,weight:Number(st.weight)||0,kill,hasKill,
      twoGroups:ownTwo?.length===2?ownTwo:rest.slice(0,2),threeGroups:ownThree?.length===3?ownThree:rest.slice(0,3),
      specialCodes:Array.isArray(prediction?.specialCodes)?prediction.specialCodes.slice(0,4):[],output:prediction};
  }).sort((a,b)=>b.rate-a.rate||b.tested-a.tested||b.weight-a.weight||a.id.localeCompare(b.id));
  currentAlgoRankings=items;
  for(const id of [...selectedAlgoIds])if(!items.some(x=>x.id===id))selectedAlgoIds.delete(id);
  const visibleItems=algoRankExpanded?items:items.slice(0,3);
  root.classList.toggle('is-expanded',algoRankExpanded);
  root.innerHTML=items.length?visibleItems.map(x=>{const i=items.findIndex(item=>item.id===x.id);const ratePct=Math.max(0,Math.min(100,Number(x.rate)*100||0));return `<button type="button" class="algo-leader-row${selectedAlgoIds.has(x.id)?' is-active':''}" data-algo-id="${esc(x.id)}" aria-pressed="${selectedAlgoIds.has(x.id)?'true':'false'}" aria-label="打开${esc(x.name)}算法详情"><span class="algo-leader-rank r${i+1}">#${i+1}</span><span class="algo-leader-name"><b>${esc(x.name)}</b><small class="algo-leader-source">${esc(x.source||'内置算法')}</small><span class="algo-leader-sample">${x.hit}/${x.tested} 次避开杀组${x.hasKill?'': ' · 当前输出不足'}</span></span><span class="algo-leader-rate"><strong>${ratePct.toFixed(1)}%</strong><small>${!x.hasKill?'当前无有效输出':x.tested<15?'样本偏少':'历史命中率'}</small><span class="algo-leader-meter" aria-hidden="true"><i style="width:${ratePct.toFixed(1)}%"></i></span></span></button>`}).join(''):'<div class="tag">当前窗口没有可输出有效杀组的算法</div>';
  const rankActions=$('#algoRankActions'),rankToggle=$('#algoRankToggle'),rankCount=$('#algoRankCount');
  if(rankActions)rankActions.hidden=items.length<=3;
  if(rankToggle){rankToggle.setAttribute('aria-expanded',String(algoRankExpanded));rankToggle.innerHTML=algoRankExpanded?'收起列表 · 仅看前三 <span aria-hidden="true">↑</span>':`展开查看全部 ${items.length} 个公式 <span aria-hidden="true">↓</span>`;}
  if(rankCount)rankCount.textContent=`已显示 ${visibleItems.length} / ${items.length} 个公式`;
  const note=$('#algoRankNote');if(note)note.textContent=`共 ${items.length} 个公式，默认只显示当前历史窗口排名前三；点击“展开查看全部”可查看完整排行。排名按逐期历史避开杀组率计算，无有效当前输出的公式仍保留在列表末尾；样本少的算法可能因随机波动靠前，不代表下一期胜率。点击条目查看杀号、二门、三门、和值及回测明细。`;
  if(sheetMode==='algo'){if(selectedAlgoIds.size)renderAlgoSheet();else closeAlgoSheet(false)}
}
function setSheetState(state){
  const sheet=$('#algoSheet');if(!sheet)return;
  const next=['peek','half','full'].includes(state)?state:'half';
  sheet.classList.remove('is-dragging','sheet-peek','sheet-half','sheet-full','expanded');
  sheet.style.removeProperty('height');
  sheet.style.removeProperty('transform');
  if(next==='peek')sheet.classList.add('sheet-peek');
  else if(next==='full')sheet.classList.add('sheet-full','expanded');
  else sheet.classList.add('sheet-half');
  sheet.dataset.sheetState=next;
}
function renderAlgoSheet(){
  sheetMode='algo';
  const sheet=$('#algoSheet'),backdrop=$('#algoSheetBackdrop'),body=$('#algoSheetBody');if(!sheet||!backdrop||!body)return;
  sheet.dataset.sheetMode='algo';
  const chosen=currentAlgoRankings.filter(x=>selectedAlgoIds.has(x.id));
  const count=$('#sheetSelectionCount');if(count)count.textContent=`当前算法：${chosen[0]?.name||'—'}`;
  const kicker=$('#algoSheetKicker');if(kicker)kicker.textContent='ALGORITHM DETAILS';$('#algoSheetTitle').textContent='算法预测与公式';$('#algoSheetSubtitle').textContent='统一展示杀组、二门、三门、和值候选与历史回测';$('#clearAlgoSelection').textContent='关闭面板';
  if(!chosen.length){sheet.classList.remove('open');backdrop.classList.remove('open');document.body.classList.remove('algo-sheet-open');clearTimeout(sheetCloseTimer);sheetCloseTimer=setTimeout(()=>{if(!selectedAlgoIds.size){sheet.style.removeProperty('visibility');sheet.hidden=true;backdrop.hidden=true}},240);return}
  const newlyOpened=sheet.hidden;
  if(newlyOpened)sheetReturnFocus=document.activeElement;
  clearTimeout(sheetCloseTimer);sheet.hidden=false;sheet.style.visibility='visible';backdrop.hidden=false;document.body.classList.add('algo-sheet-open');
  body.innerHTML=chosen.map(x=>{
    const formulaBlock=x.formula?`<section class="sheet-formula"><div class="subhead"><span>公式 / 计算路线</span><span class="tag">可复核</span></div><pre>${esc(x.formula)}</pre></section>`:'';
    const detail=x.output?.sourceSummary;
    const sourceSummaryBlock=detail?`<section class="sheet-formula-result"><div class="subhead"><span>本期公式计算明细</span><span class="tag">${esc(detail.method||'来源模型')}</span></div><div class="sheet-formula-grid"><span>三期和值对应素数</span><b>${detail.primeSums.map(n=>String(n)).join(' × ')}</b><span>素数连乘</span><b>${detail.product}</b><span>数字折叠数根</span><b>${detail.foldedRoot}</b><span>0.618 共振值</span><b>${detail.resonance}</b><span>基础映射形态</span><b>${esc(detail.mapped)}</b><span>对角杀号</span><b>${esc(detail.kill)}</b></div><p class="sheet-note">计算明细来自内置的 forest3（三期共振法）规则。模型原生输出杀组和二门；三门、和值仅作为补充参考。</p></section>`:'';
    const sumValues=x.specialCodes.length?x.specialCodes.map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=27):Array.from(document.querySelectorAll('#sumFourCodes .sum-four-card strong')).map(el=>Number(el.textContent)).filter(n=>Number.isInteger(n)&&n>=0&&n<=27);
    const sumSource=x.specialCodes.length?'此算法原始输出的 0–27 特码/和值候选':'页面当前和值参考（由独立和值模型生成）';
    const sumBlock=`<div class="sheet-summary-block"><div class="subhead"><span>和值候选</span><span class="tag">${sumValues.length} 个</span></div><div class="sheet-sum-values">${sumValues.length?sumValues.map((n,i)=>`<span class="sheet-sum-value"><small>${String(i+1).padStart(2,'0')}</small><b>${String(n).padStart(2,'0')}</b></span>`).join(''):'<span class="tag">样本不足</span>'}</div><p class="sheet-note">${sumSource}。若显示的是独立和值参考，它并非该单个杀组公式直接产出。</p></div>`;
    return `<article class="sheet-algo-card"><div class="sheet-algo-top"><div><b>#${currentAlgoRankings.findIndex(v=>v.id===x.id)+1} · ${esc(x.name)}</b><br><small>${esc(x.source)} · 算法 ID ${esc(x.id)}</small></div><span class="tag">回测 ${x.hit}/${x.tested}</span></div>${formulaBlock}${sourceSummaryBlock}<div class="sheet-metrics"><div class="sheet-metric"><span>历史杀组避开率</span><b>${(x.rate*100).toFixed(1)}%</b></div><div class="sheet-metric"><span>当前预测杀组</span><b>${esc(x.kill)}</b></div><div class="sheet-metric"><span>回测样本</span><b>${x.tested}</b></div></div><div class="subhead" style="margin-top:12px"><span>杀号总结</span><span class="tag">1 组</span></div><div class="sheet-kill-summary"><b>${esc(x.kill)}</b><small>预测杀组 · 以所选历史窗口逐期回测</small></div><div class="subhead" style="margin-top:12px"><span>二门组合</span><span class="tag">2 组</span></div><div class="sheet-groups">${x.twoGroups.map(g=>`<div class="sheet-group">${esc(g)}</div>`).join('')}</div><div class="subhead" style="margin-top:10px"><span>三门组合</span><span class="tag">3 组</span></div><div class="sheet-groups">${x.threeGroups.map(g=>`<div class="sheet-group">${esc(g)}</div>`).join('')}</div>${sumBlock}<p class="sheet-note">${x.hasKill?'':'当前样本暂未产生有效杀组输出；二门、三门仅作该窗口的综合组合参考。'}历史命中率只反映真实开奖历史中的回测结果，不代表下一期概率或命中保证。二门/三门若不是该算法原生输出，会明确按其他组合参考逻辑生成。</p></article>`;
  }).join('')+renderRangeTuningControls();
  if(newlyOpened)setSheetState('half');
  requestAnimationFrame(()=>{sheet.classList.add('open');backdrop.classList.add('open');if(newlyOpened)$('#closeAlgoSheet')?.focus({preventScroll:true})});
}
function renderRangeTuningControls(){
  const hist=currentRecords();const model=rangeKillModel(hist);const r=model.range;
  return `<section class="sheet-algo-card range-tuning-card"><div class="sheet-algo-top"><div><b>📐 区间自动调节</b><br><small>按真实历史逐期回测，自动选择表现较好的参数区间</small></div><span class="tag">步长 0.1</span></div><div class="sheet-metrics"><div class="sheet-metric"><span>当前自动区间</span><b>${r?`${r.min.toFixed(2)} ~ ${r.max.toFixed(2)}`:'样本不足'}</b></div><div class="sheet-metric"><span>滚动回测命中率</span><b>${model.rate==null?'—':`${(model.rate*100).toFixed(1)}%`}</b></div><div class="sheet-metric"><span>有效测试期数</span><b>${model.tested||0} / ${rangeBacktestPeriod}</b></div></div><div class="range-tuning-controls"><label for="sheetRangeBacktest">回测期数</label><select id="sheetRangeBacktest" class="select"><option value="20" ${rangeBacktestPeriod===20?'selected':''}>近 20 期</option><option value="30" ${rangeBacktestPeriod===30?'selected':''}>近 30 期</option><option value="50" ${rangeBacktestPeriod===50?'selected':''}>近 50 期</option><option value="100" ${rangeBacktestPeriod===100?'selected':''}>近 100 期</option></select><button type="button" class="btn" id="sheetAutoRangeBtn">自动调节区间</button></div><p class="sheet-note">调整回测期数后会重新计算区间；按钮可立即强制重扫。历史命中率只代表所选样本，不保证下一期。</p></section>`;
}
function applyRangeTuning(force=true){
  const sel=$('#sheetRangeBacktest');if(sel){rangeBacktestPeriod=Number(sel.value)||30;safeSet('ka28.rangeBacktestPeriod',String(rangeBacktestPeriod));}
  rangeKillCacheKey='';rangeKillCache=null;killModelCacheKey='';killModelCache=null;threeDoorCacheKey='';threeDoorCache=null;
  const hist=currentRecords();rangeKillModel(hist,true);renderAnalytics();if(sheetMode==='algo'&&selectedAlgoIds.size)renderAlgoSheet();toast(`区间已自动调节 · 回测近 ${rangeBacktestPeriod} 期`);
}
function closeAlgoSheet(clear=true){
  if(clear){selectedAlgoIds.clear();document.querySelectorAll('#algoLeaderboard [data-algo-id]').forEach(x=>{x.classList.remove('is-active');x.setAttribute('aria-pressed','false')});sheetMode='algo';const sheetEl=$('#algoSheet');if(sheetEl)sheetEl.dataset.sheetMode='algo';}
  const sheet=$('#algoSheet'),backdrop=$('#algoSheetBackdrop');if(sheet){sheet.classList.remove('open','is-dragging');sheet.style.removeProperty('height');sheet.style.removeProperty('transform')}if(backdrop)backdrop.classList.remove('open');document.body.classList.remove('algo-sheet-open');
  clearTimeout(sheetCloseTimer);sheetCloseTimer=setTimeout(()=>{if(!selectedAlgoIds.size){if(sheet){sheet.style.removeProperty('visibility');sheet.hidden=true;}if(backdrop)backdrop.hidden=true;const target=sheetReturnFocus;sheetReturnFocus=null;if(target&&target.isConnected&&typeof target.focus==='function')target.focus({preventScroll:true})}},240);
  const count=$('#sheetSelectionCount');if(count)count.textContent=selectedAlgoIds.size?`当前算法：${[...selectedAlgoIds][0]}`:'当前未打开算法';
}
/* Goblin original algorithm port (adapted from 哥布林顶级预测_发布版.html).
   A draw passed to goblinPredictNext() is the previous completed draw; outputs apply to the next issue. */
const GOBLIN_COMBOS=['大双','大单','小双','小单'];
const GOBLIN_BUCKETS=[[0,4,6,9,12,15,18,21,24,27],[1,4,7,10,13,16,19,22,25],[2,5,8,11,14,17,20,23,26]];
const GOBLIN_SAME_SEQUENCE={'小双':['小双','大双','大单'],'小单':['小单','大单','大双'],'大双':['大双','小双','小单'],'大单':['大单','小单','小双']};
const GOBLIN_DIFF_SEQUENCE={'小双':['小双','小单','大单'],'小单':['小单','小双','大双'],'大双':['大双','大单','小单'],'大单':['大单','大双','小双']};
const GOBLIN_NO_MATCH={'小双':['小双','小单','大双'],'小单':['小单','小双','大单'],'大双':['大双','小双','大单'],'大单':['大单','大双','小双']};
function goblinGroupOf(sum){return (sum<14?'小':'大')+(sum%2===0?'双':'单')}
function goblinBucketIds(value){const out=[];GOBLIN_BUCKETS.forEach((set,index)=>{if(set.includes(value))out.push(index)});return out}
function goblinBucketsOverlap(a,b){const aa=goblinBucketIds(a),bb=goblinBucketIds(b);return aa.some(x=>bb.includes(x))}
function goblinSeededRandom(seed){let x=seed;return function(){x=(1831565813+(0|x))|0;let t=Math.imul(x^(x>>>15),1|x);t^=Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296}}
function goblinPredictNext(draw){
  if(!draw)return null;
  const nums=Array.isArray(draw.digits)&&draw.digits.length===3?draw.digits:(Array.isArray(draw.nums)&&draw.nums.length===3?draw.nums:null);
  const sum=Number(draw.sum),issue=String(draw.id??draw.expect??'');
  if(!nums||!nums.every(n=>Number.isInteger(n)&&n>=0&&n<=9)||!Number.isFinite(sum)||sum<0||sum>27)return null;
  const type=goblinGroupOf(sum);
  const seed=1000*parseInt(issue||'0',10)+(100*nums[0]+10*nums[1]+nums[2]);
  const random=goblinSeededRandom(Number.isFinite(seed)?seed:1);
  const warmup=Math.max(Math.max(...nums),1);let randomValue=0;
  for(let i=0;i<warmup;i++)randomValue=random();
  const fractionText=((Number((.5*randomValue+.05).toFixed(8))*(sum||0)).toFixed(10).split('.')[1]||'000').slice(0,3).padEnd(3,'0');
  const generatedDigits=fractionText.split('').map(Number);
  const generatedSum=generatedDigits.reduce((a,b)=>a+b,0);
  const hasDigitOverlap=generatedDigits.some(n=>nums.includes(n));
  const bucketsMatch=goblinBucketsOverlap(generatedSum,sum);
  const branch=!hasDigitOverlap?'no-match':(bucketsMatch?'same-sequence':'different-sequence');
  const sequence=branch==='same-sequence'?GOBLIN_SAME_SEQUENCE[type]:(branch==='different-sequence'?GOBLIN_DIFF_SEQUENCE[type]:GOBLIN_NO_MATCH[type]);
  let predicted=[...(sequence||[])].filter(g=>GOBLIN_COMBOS.includes(g)).slice(0,3);
  if(!predicted.length)predicted=[...(GOBLIN_NO_MATCH[type]||[])].slice(0,3);
  while(predicted.length<3){const next=GOBLIN_COMBOS.find(g=>!predicted.includes(g));if(!next)break;predicted.push(next)}
  predicted=[...new Set(predicted.slice(0,3))];
  const transformed=sum/10*109.446,decimal=transformed-Math.floor(transformed);
  const kill=GOBLIN_COMBOS[Math.floor(4*decimal)%4];
  let nonKill=predicted.filter(g=>g!==kill);
  while(nonKill.length<2){const next=GOBLIN_COMBOS.find(g=>g!==kill&&!nonKill.includes(g));if(!next)break;nonKill.push(next)}
  if(nonKill.length<2)nonKill=GOBLIN_COMBOS.filter(g=>g!==kill).slice(0,2);
  const main=nonKill[0],second=nonKill[1];
  const third=GOBLIN_COMBOS.find(g=>g!==main&&g!==second&&g!==kill);
  const threeDoor=[main,second,third].filter(Boolean);
  while(threeDoor.length<3){const next=GOBLIN_COMBOS.find(g=>!threeDoor.includes(g)&&g!==kill);if(next)threeDoor.push(next);else break}
  return {kill,doubleGroups:[main,second],threeDoor,main,second,third:third||null,type,inputIssue:issue,generatedDigits,generatedSum,branch};
}
function goblinIsSpecialProtected(sum){return sum===13||sum===14}
function goblinEvaluate(prediction,actualSum){
  if(!prediction||!Number.isFinite(actualSum))return {killHit:null,doubleHit:null,threeDoorHit:null,special:false};
  const actualGroup=comboOf(actualSum),special=goblinIsSpecialProtected(actualSum);
  // Preserve the original Goblin verifier's 13/14 special-case rule for kill and double-group scoring.
  return {killHit:special||actualGroup!==prediction.kill,doubleHit:special||prediction.doubleGroups.includes(actualGroup),threeDoorHit:prediction.threeDoor.includes(actualGroup),special,actualGroup};
}
function nextIssueLabel(issue){const text=String(issue??'');return /^\d+$/.test(text)?String(Number(text)+1).padStart(text.length,'0'):'下一期'}
/* 五方星序差集算法：基于用户提供的“五方位概率分析”HTML移植。
   计算路线：目标期种子随机数 → 五方位组 → 主候选三门 → 副候选差集杀号 → 双组 → 特码筛选。
   预测时只读 target draw 之前的历史，不读目标期开奖数据。 */
const SEQ_GROUP_MAP=[2,0,1,0,1,1,2,2,1,0,1,2,0,0,2,0,2,0,2,1,2,2,1,0,0,1,2,0];
const SEQ_TYPE_RANGE={'小单':[1,3,5,7,9,11,13],'小双':[0,2,4,6,8,10,12],'大单':[15,17,19,21,23,25,27],'大双':[14,16,18,20,22,24,26]};
const SEQ_TYPE_PRIORITY=['大单','大双','小单','小双'];
function seqTypeFromSum(sum){return (sum<14?'小':'大')+(sum%2===0?'双':'单')}
function seqGroupOf(sum){const val=SEQ_GROUP_MAP[sum];return val===0?'五':val===1?'方':'位'}
function seqCalcT1Value(p){let num=Math.abs(p),sum=0,intPart=Math.floor(num);while(intPart>0){sum+=intPart%10;intPart=Math.floor(intPart/10)}let decimalPart=num-Math.floor(num);for(let i=0;i<3;i++){decimalPart*=10;sum+=Math.floor(decimalPart)%10}return sum}
function seqPartners(t1){const s=t1[0],p=t1[1];return {sizePartner:s+(p==='单'?'双':'单'),parityPartner:(s==='大'?'小':'大')+p,oppositePartner:(s==='大'?'小':'大')+(p==='单'?'双':'单')}}
function seqGenerateCandidates(randomValue,a,b,useOppositeRule){const t1=seqTypeFromSum(seqCalcT1Value(b*randomValue)),same=seqGroupOf(a)===seqGroupOf(b),partners=seqPartners(t1);let candidates;if(!useOppositeRule)candidates=same?[t1,partners.parityPartner,partners.oppositePartner]:[t1,partners.sizePartner,partners.oppositePartner];else candidates=same?[t1,partners.sizePartner,partners.oppositePartner]:[t1,partners.parityPartner,partners.oppositePartner];return [...new Set(candidates)].sort((x,y)=>SEQ_TYPE_PRIORITY.indexOf(x)-SEQ_TYPE_PRIORITY.indexOf(y)).slice(0,3)}
function seqTimestamp(draw){const raw=draw?.opentime??draw?.timestamp;if(raw!==undefined&&raw!==null&&raw!==''){const n=Number(raw);if(Number.isFinite(n)&&n>0)return Math.floor(n>1e12?n/1000:n)}const t=Date.parse(String(draw?.time||''));return Number.isFinite(t)?Math.floor(t/1000):0}
function seqDynamicRandom(period,prevSums,timestamp){const seedStr=`${period}_${prevSums[0]}_${prevSums[1]}_${prevSums[2]}_${timestamp}`;let hash=0;for(let i=0;i<seedStr.length;i++){hash=Math.imul(hash,31)+seedStr.charCodeAt(i);hash=hash>>>0}const seedBig=BigInt(hash);let state0=(seedBig<<32n)&0xFFFFFFFFFFFFFFFFn;let state1=(0x9E3779B97F4A7C15n^(seedBig*0xBF58476D1CE4E5B9n))&0xFFFFFFFFFFFFFFFFn;function next(){let s1=state0;const s0=state1;state0=s0;s1^=s1<<23n;s1&=0xFFFFFFFFFFFFFFFFn;state1=s1^s0^(s1>>17n)^(s0>>26n);state1&=0xFFFFFFFFFFFFFFFFn;return(state1+s0)&0xFFFFFFFFFFFFFFFFn}for(let i=0;i<3;i++)next();const high53=Number(next()>>11n);return Math.max(0,Math.min(0.9999999999999999,high53*(1/9007199254740992)))}
function seqBuildForecast(hist){if(!Array.isArray(hist)||hist.length<5)return null;const prior=hist.slice(-Math.min(200,Math.max(5,windowN())));const latest=prior.at(-1),prev=prior.at(-2),prev3=prior.at(-3);if(!latest||!prev||!prev3)return null;const nextNum=parseInt(String(latest.id??latest.expect??''),10)+1;if(!Number.isFinite(nextNum))return null;const nextIssue=String(nextNum).padStart(7,'0'),a=Number(prev.sum),b=Number(latest.sum),timestamp=seqTimestamp(latest),prevSums=[b,a,Number(prev3.sum)];if(![...prevSums].every(n=>Number.isInteger(n)&&n>=0&&n<=27))return null;const mainRandom=seqDynamicRandom(nextNum,prevSums,timestamp),mainCandidates=seqGenerateCandidates(mainRandom,a,b,false);let kill=null,attempts=[];for(let i=1;i<=10;i++){const subRandom=seqDynamicRandom(nextNum+i,prevSums,timestamp),sub=seqGenerateCandidates(subRandom,a,b,true),diff=mainCandidates.filter(c=>!sub.includes(c));if(diff.length){kill=diff.sort((x,y)=>SEQ_TYPE_PRIORITY.indexOf(x)-SEQ_TYPE_PRIORITY.indexOf(y))[0];attempts.push(`副随机数 ${i} 差集 ${diff.join('、')} → 杀组 ${kill}`);break}attempts.push(`副随机数 ${i} 无差集`)}if(!kill){kill=[...mainCandidates].sort((x,y)=>SEQ_TYPE_PRIORITY.indexOf(y)-SEQ_TYPE_PRIORITY.indexOf(x))[0];attempts.push(`10 次无差集，按优先级回退至 ${kill}`)}const recommends=mainCandidates.filter(t=>t!==kill);const code=Math.floor(b*mainRandom)%28,targetGroup=((code%3)+1)%3,numbers=new Set();recommends.forEach(type=>(SEQ_TYPE_RANGE[type]||[]).forEach(n=>{if(n%3===targetGroup)numbers.add(n)}));const specialCodes=[...numbers].sort((x,y)=>x-y).slice(0,4);return {kill,recommends,mainCandidates,specialCodes,code,targetGroup,nextIssue,inputIssue:String(latest.id??latest.expect??''),inputSum:b,mainRandom,attempts,prevSums,timestamp}}
function seqEvaluate(prediction,actualSum){if(!prediction||!Number.isFinite(actualSum))return {killHit:null,doubleHit:null,threeDoorHit:null,codeHit:null};const actualGroup=comboOf(actualSum);return {killHit:actualGroup!==prediction.kill,doubleHit:prediction.recommends.includes(actualGroup),threeDoorHit:prediction.mainCandidates.includes(actualGroup),codeHit:prediction.specialCodes.includes(actualSum),actualGroup}}
function renderSequencePrediction(hist){const status=$('#sequenceStatus'),killEl=$('#sequenceKill'),poolEl=$('#sequencePool'),betsEl=$('#sequenceBets'),codesEl=$('#sequenceCodes'),codesNote=$('#sequenceCodesNote');const placeholders=(note='等待历史数据')=>{if(codesEl)codesEl.innerHTML=Array.from({length:4},(_,i)=>`<div class="sum-four-card"><span class="sum-four-kicker">序列 0${i+1}</span><strong>—</strong><small>${esc(note)}</small></div>`).join('');if(codesNote)codesNote.textContent=note};if(!hist||hist.length<5){status.textContent='样本不足';killEl.textContent=poolEl.textContent='—';betsEl.innerHTML='<span class="tag">至少需要 5 期有效历史</span>';$('#sequencePeriod').textContent='—';$('#sequenceKillNote').textContent='等待有效开奖';$('#sequencePoolNote').textContent='主候选尚未生成';$('#sequenceSteps').textContent='历史样本不足';$('#sequenceExplain').textContent='原算法要求至少 5 期开奖记录，样本不足时不输出预测。';placeholders('至少需要 5 期有效历史');return}const p=seqBuildForecast(hist);if(!p){status.textContent='数据格式待校验';killEl.textContent=poolEl.textContent='—';betsEl.innerHTML='<span class="tag">开奖记录格式待校验</span>';placeholders('当前记录格式待校验');return}status.textContent='序列规则 · 已计算';killEl.textContent=p.kill;$('#sequenceKillNote').textContent=`输入第 ${p.inputIssue} 期 · 和值 ${p.inputSum}`;poolEl.textContent=p.mainCandidates.join(' / ');$('#sequencePoolNote').textContent='主候选三门；杀号组可能与主池重叠前已剔除';$('#sequencePeriod').textContent=`预测第 ${p.nextIssue} 期`;betsEl.innerHTML=p.recommends.map((g,i)=>`<div class="combo-pill"><b>${esc(g)}</b><small>推荐双组 ${i+1}</small></div>`).join('');if(codesEl)codesEl.innerHTML=p.specialCodes.map((n,i)=>`<div class="sum-four-card"><span class="sum-four-kicker">序列 0${i+1}</span><strong>${String(n).padStart(2,'0')}</strong><small>${esc(seqTypeFromSum(n))} · 特码候选</small></div>`).join('');if(codesNote)codesNote.textContent=`第 ${p.nextIssue} 期 · 按目标余数 ${p.targetGroup} 从双组范围筛出 ${p.specialCodes.length} 个候选（原算法最多 4 个，不强行补齐）。`;$('#sequenceSteps').textContent=`主随机数 R = ${p.mainRandom.toFixed(10)}\n输入和值序列：${p.prevSums.join(' / ')} · 时间种子 ${p.timestamp}\n主候选三门：${p.mainCandidates.join('、')}\n${p.attempts.join('\n')}\n最终杀号组：${p.kill}\n推荐双组：${p.recommends.join('、')}\n特码 code=${p.code}，目标余数=${p.targetGroup} → ${p.specialCodes.join('、')||'无候选'}`;$('#sequenceExplain').textContent=`使用第 ${p.inputIssue} 期及之前数据，输出用于第 ${p.nextIssue} 期。杀组、双组、三门与特码分别核验；不把 13/14 直接记为命中。`;}
function setActiveForecastAlgorithm(mode,notify=false){const next=mode==='sequence'?'sequence':'goblin';activeForecastAlgorithm=next;const panel=$('#goblinPanel');if(panel){panel.dataset.activeAlgo=next;const goblinSlide=$('#goblinSlide'),sequenceSlide=$('#sequenceSlide');if(goblinSlide){goblinSlide.classList.toggle('is-active',next==='goblin');goblinSlide.setAttribute('aria-hidden',String(next!=='goblin'));goblinSlide.inert=next!=='goblin'}if(sequenceSlide){sequenceSlide.classList.toggle('is-active',next==='sequence');sequenceSlide.setAttribute('aria-hidden',String(next!=='sequence'));sequenceSlide.inert=next!=='sequence'}}const label=$('#algoModeLabel'),hint=$('#algoSwipeHint'),gdot=$('#algoDotGoblin'),sdot=$('#algoDotSequence');if(label)label.textContent=next==='sequence'?'2 / 2 · 五方星序差集算法':'1 / 2 · 哥布林星轨算法';if(hint)hint.textContent=next==='sequence'?'→ 右滑恢复哥布林星轨算法':'← 左滑查看五方星序差集算法';if(gdot)gdot.classList.toggle('is-active',next==='goblin');if(sdot)sdot.classList.toggle('is-active',next==='sequence');const prev=$('#algoPrevBtn'),nxt=$('#algoNextBtn');if(prev)prev.disabled=next==='goblin';if(nxt)nxt.disabled=next==='sequence';renderForecastRounds();if(notify)toast(next==='sequence'?'已切换：五方星序差集算法 · 预测记录同步切换':'已恢复：哥布林星轨算法 · 预测记录同步恢复')}
function initAlgorithmSwipe(){const panel=$('#goblinPanel');if(!panel)return;let pointerStart=null,touchStart=null;const finishSwipe=(dx,dy)=>{if(Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.25)return;if(dx<0)setActiveForecastAlgorithm('sequence',true);else setActiveForecastAlgorithm('goblin',true)};panel.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;if(e.target.closest('button,summary,select,input,a')){pointerStart=null;return}pointerStart={x:e.clientX,y:e.clientY,id:e.pointerId};try{panel.setPointerCapture(e.pointerId)}catch(_){}});panel.addEventListener('pointerup',e=>{if(!pointerStart||pointerStart.id!==e.pointerId)return;const dx=e.clientX-pointerStart.x,dy=e.clientY-pointerStart.y;pointerStart=null;finishSwipe(dx,dy)});panel.addEventListener('pointercancel',()=>{pointerStart=null});panel.addEventListener('touchstart',e=>{if(!e.touches||e.touches.length!==1){touchStart=null;return}const t=e.touches[0];if(e.target.closest('button,summary,select,input,a')){touchStart=null;return}touchStart={x:t.clientX,y:t.clientY}},{passive:true});panel.addEventListener('touchend',e=>{if(!touchStart||!e.changedTouches||!e.changedTouches.length)return;const t=e.changedTouches[0],dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;touchStart=null;finishSwipe(dx,dy)},{passive:true});panel.addEventListener('touchcancel',()=>{touchStart=null},{passive:true});$('#algoPrevBtn')?.addEventListener('click',()=>setActiveForecastAlgorithm('goblin',true));$('#algoNextBtn')?.addEventListener('click',()=>setActiveForecastAlgorithm('sequence',true));panel.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')setActiveForecastAlgorithm('sequence',true);else if(e.key==='ArrowRight')setActiveForecastAlgorithm('goblin',true)})}

function renderGoblinPrediction(hist){
  const status=$('#goblinStatus'),killEl=$('#goblinKill'),poolEl=$('#goblinPool'),betsEl=$('#goblinBets');
  const fourEl=$('#goblinFourCodes'),fourNote=$('#goblinFourNote');
  const showFourPlaceholders=(note='等待历史数据')=>{if(fourEl)fourEl.innerHTML=Array.from({length:4},(_,i)=>`<div class="sum-four-card"><span class="sum-four-kicker">星轨 0${i+1}</span><strong>—</strong><small>${esc(note)}</small></div>`).join('');if(fourNote)fourNote.textContent=note;};
  if(!hist||!hist.length){status.textContent='等待历史数据';killEl.textContent=poolEl.textContent='—';betsEl.innerHTML='<span class="tag">等待历史数据</span>';showFourPlaceholders();return}
  const latest=hist[hist.length-1],prediction=goblinPredictNext(latest);
  if(!prediction){status.textContent='数据格式待校验';killEl.textContent=poolEl.textContent='—';betsEl.innerHTML='<span class="tag">当前开奖记录缺少有效号码</span>';showFourPlaceholders('当前记录格式待校验');return}
  const nextIssue=nextIssueLabel(latest.id??latest.expect);
  status.textContent='星轨规则 · 已计算';
  killEl.textContent=prediction.kill;
  $('#goblinKillNote').textContent=`依据第 ${latest.id??latest.expect} 期 · 和值 ${latest.sum}`;
  poolEl.textContent=prediction.threeDoor.join(' / ');
  $('#goblinPoolNote').textContent='星轨三门输出，排除本模型杀号组';
  $('#goblinPeriod').textContent=`预测第 ${nextIssue} 期`;
  betsEl.innerHTML=prediction.doubleGroups.map((g,i)=>`<div class="combo-pill"><b>${esc(g)}</b><small>星轨双组 ${i+1}</small></div>`).join('');
  const fourCodes=goblinFourSumCandidates(hist,windowN());
  if(fourEl){fourEl.innerHTML=fourCodes.map((item,i)=>`<div class="sum-four-card"><span class="sum-four-kicker">星轨 0${i+1}</span><strong>${item.sum}</strong><small>${esc(item.group)} · ${esc(item.source)}</small></div>`).join('');if(!fourCodes.length)showFourPlaceholders('样本不足');}
  if(fourNote)fourNote.textContent=`用于预测第 ${nextIssue} 期；输入截至第 ${latest.id??latest.expect} 期。四码按星轨三门筛选并结合当前和值评分排序，属于扩展候选，不是原版直接输出。`;
  $('#goblinExplain').textContent=`星轨算法沿用原版哥布林种子、序列分支与 109.446 转换；输入为第 ${latest.id??latest.expect} 期已开奖数据，输出用于下一期。原版将实际和值 13/14 作为杀号与双组特殊保护命中。历史表现不保证未来结果。`;
}

function renderKillPrediction(hist){
  const modelWindow=hist.slice(-windowN());
  if(!modelWindow.length){
    $('#killGroupResult').textContent='—';$('#ownKillResult').textContent='—';$('#ownKillInfo').textContent='等待真实历史样本';$('#algoVotesTag').textContent='等待数据';
    $('#comboTwo').innerHTML='<span class="tag">等待历史数据</span>';$('#comboThree').innerHTML='<span class="tag">等待历史数据</span>';$('#threeDoorGroups').innerHTML='<span class="tag">等待历史数据</span>';$('#killVoteBars').innerHTML='<div class="vote-empty">等待有效历史样本</div>';renderAlgoLeaderboard([],null);return;
  }
  const models=sourceVoteModel(modelWindow);
  const triple=modelWindow.length>=2?threeDoorModel(modelWindow):{groups:[],range:null,rate:null,tested:0};
  $('#killGroupResult').textContent=models.winner;$('#ownKillResult').textContent=models.own.kill;
  $('#ownKillInfo').textContent=FOUR_GROUPS.map(g=>`${g} ${(models.own.scores[g]*100).toFixed(1)}%`).join(' · ');
  $('#algoVotesTag').textContent=`${models.algoCount} 个公式 + 2 个融合模型`;
  const picks=FOUR_GROUPS.filter(g=>g!==models.winner).sort((a,b)=>models.tally[b]-models.tally[a]);
  $('#comboTwo').innerHTML=picks.slice(0,2).map((g,i)=>`<div class="combo-pill"><b>${g}</b><small>二门 ${i+1} · ${models.tally[g].toFixed(1)} 票</small></div>`).join('');
  $('#comboThree').innerHTML=picks.map((g,i)=>`<div class="combo-pill"><b>${g}</b><small>组合 ${i+1} · ${models.tally[g].toFixed(1)} 票</small></div>`).join('');
  $('#threeDoorRange').textContent=triple.range?`${triple.range.min.toFixed(2)}–${triple.range.max.toFixed(2)}`:'样本不足';
  $('#threeDoorGroups').innerHTML=triple.groups.length?triple.groups.map((g,i)=>`<div class="combo-pill"><b>${g}</b><small>三门推荐 ${i+1}</small></div>`).join(''):'<span class="tag">至少需要 12 期有效历史</span>';
  $('#threeDoorInfo').textContent=(triple.rate===null?'历史样本不足，尚未选择区间。':`三门组近 ${triple.tested} 次覆盖 ${(triple.rate*100).toFixed(1)}%。 `)+(models.interval?.kill?`区间杀号模型：杀 ${models.interval.kill}，区间 ${models.interval.range?.min.toFixed(2)}–${models.interval.range?.max.toFixed(2)}，近 ${models.interval.tested} 次杀组命中 ${(models.interval.rate*100).toFixed(1)}%。 `:'')+'区间参数按历史样本选取，可能过拟合，不代表未来概率。';
  const max=Math.max(...Object.values(models.tally),1);
  $('#killVoteBars').innerHTML=FOUR_GROUPS.map(g=>`<div class="vote-row"><span>${g}</span><i style="width:${Math.max(2,models.tally[g]/max*100)}%"></i><b>${models.tally[g].toFixed(1)}</b></div>`).join('');
  renderAlgoLeaderboard(modelWindow,models);
}
function playTripleChime(){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
    audioContext=audioContext||new Ctx();
    if(!audioMasterGain){audioMasterGain=audioContext.createGain();audioMasterGain.gain.value=.92;audioMasterGain.connect(audioContext.destination)}
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
    // Stronger, brighter three-note chime. Keep the peak below full scale;
    // final loudness still follows the device/browser volume setting.
    [1046.5,1318.5,1568].forEach((f,i)=>{
      const start=audioContext.currentTime+.025+i*.205;
      const main=audioContext.createOscillator(),mainGain=audioContext.createGain();
      main.type='triangle';main.frequency.setValueAtTime(f,start);
      mainGain.gain.setValueAtTime(.0001,start);mainGain.gain.exponentialRampToValueAtTime(.34,start+.012);mainGain.gain.exponentialRampToValueAtTime(.0001,start+.235);
      main.connect(mainGain);mainGain.connect(audioMasterGain);main.start(start);main.stop(start+.245);
      const overtone=audioContext.createOscillator(),overGain=audioContext.createGain();
      overtone.type='sine';overtone.frequency.setValueAtTime(f*2,start);
      overGain.gain.setValueAtTime(.0001,start);overGain.gain.exponentialRampToValueAtTime(.075,start+.01);overGain.gain.exponentialRampToValueAtTime(.0001,start+.17);
      overtone.connect(overGain);overGain.connect(audioMasterGain);overtone.start(start);overtone.stop(start+.18);
    });
  }catch(e){console.warn('提示音不可用',e)}
}
function sizeScratchCanvas(){const canvas=$('#scratchCanvas'),zone=$('#scratchSurface');if(!canvas||!zone)return;const r=zone.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);if(r.width<2||r.height<2)return;canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);canvas.style.width=r.width+'px';canvas.style.height=r.height+'px';const ctx=canvas.getContext('2d');scratchContext=ctx;ctx.setTransform(dpr,0,0,dpr,0,0);const g=ctx.createLinearGradient(0,0,r.width,r.height);g.addColorStop(0,'#cdd7e0');g.addColorStop(.25,'#eef3f7');g.addColorStop(.5,'#9eacb8');g.addColorStop(.75,'#e3eaf0');g.addColorStop(1,'#a5b1bd');ctx.globalCompositeOperation='source-over';ctx.fillStyle=g;ctx.fillRect(0,0,r.width,r.height);ctx.strokeStyle='rgba(255,255,255,.34)';ctx.lineWidth=1;for(let x=-r.height;x<r.width;x+=18){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+r.height,r.height);ctx.stroke()}ctx.fillStyle='rgba(23,40,57,.88)';ctx.textAlign='center';ctx.font='800 17px system-ui,sans-serif';ctx.fillText('KA28开奖网',r.width/2,r.height/2-5);ctx.font='600 11px system-ui,sans-serif';ctx.fillText('刮开查看数字与和值',r.width/2,r.height/2+17)}
function captureScratchDetails(){return {combo:$('#drawCombo').innerHTML,shape:$('#drawShape').innerHTML,tags:$('#drawTags').innerHTML}}
function maskScratchDetails(){
  const combo=$('#drawCombo'),shape=$('#drawShape'),tags=$('#drawTags');
  if(!scratchPrivacySnapshot)scratchPrivacySnapshot=captureScratchDetails();
  combo.textContent='组合：—';shape.textContent='形态：—';
  const holder=document.createElement('div');holder.innerHTML=scratchPrivacySnapshot.tags||'';
  const count=Math.max(5,holder.children.length||0);
  tags.innerHTML=Array.from({length:count},()=>'<span class="chip">—</span>').join('');
}
function resetScratchForNewDraw(showToast=false){
  if(!scratchEnabled)return;
  scratchRevealedForDraw=false;scratchLastPoint=null;scratchMoved=0;
  scratchPrivacySnapshot=captureScratchDetails();maskScratchDetails();
  const canvas=$('#scratchCanvas'),btn=$('#scratchBtn');
  if(canvas)canvas.classList.add('active');
  if(btn){btn.textContent='收起咪牌';btn.setAttribute('aria-pressed','true')}
  requestAnimationFrame(sizeScratchCanvas);
  if(showToast)toast('新期开奖已更新，咪牌自动重新覆盖，可以继续刮奖');
}
function restoreScratchDetails(){if(!scratchPrivacySnapshot)return;$('#drawCombo').innerHTML=scratchPrivacySnapshot.combo;$('#drawShape').innerHTML=scratchPrivacySnapshot.shape;$('#drawTags').innerHTML=scratchPrivacySnapshot.tags;scratchPrivacySnapshot=null}
function openScratch(){
  if(scratchEnabled)return;
  scratchEnabled=true;scratchRevealedForDraw=false;
  resetScratchForNewDraw(false);
  const btn=$('#scratchBtn');if(btn){btn.textContent='收起咪牌';btn.setAttribute('aria-pressed','true')}
  toast('咪牌已开启；刮开后保持开启，下期开奖自动重新覆盖');
}
function closeScratch(){
  scratchEnabled=false;scratchRevealedForDraw=false;
  const canvas=$('#scratchCanvas'),btn=$('#scratchBtn');if(canvas)canvas.classList.remove('active');
  if(btn){btn.textContent='咪牌';btn.setAttribute('aria-pressed','false')}
  scratchLastPoint=null;scratchMoved=0;restoreScratchDetails();
}
function revealScratchForCurrentDraw(){
  scratchRevealedForDraw=true;scratchLastPoint=null;scratchMoved=0;
  const canvas=$('#scratchCanvas'),btn=$('#scratchBtn');if(canvas)canvas.classList.remove('active');
  restoreScratchDetails();
  if(btn){btn.textContent='收起咪牌';btn.setAttribute('aria-pressed','true')}
  toast('本期开奖已刮开并保持显示；咪牌仍开启，下期开奖会自动重新覆盖');
}
function scratchPoint(e){const r=$('#scratchCanvas').getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function eraseScratch(e){
  if(!scratchEnabled||!scratchContext)return;
  const canvas=$('#scratchCanvas'),p=scratchPoint(e);
  scratchContext.globalCompositeOperation='destination-out';scratchContext.lineWidth=44;scratchContext.lineCap='round';scratchContext.lineJoin='round';scratchContext.beginPath();
  if(scratchLastPoint){scratchContext.moveTo(scratchLastPoint.x,scratchLastPoint.y);scratchContext.lineTo(p.x,p.y)}else scratchContext.arc(p.x,p.y,22,0,Math.PI*2);
  scratchContext.stroke();scratchContext.globalCompositeOperation='source-over';scratchLastPoint=p;scratchMoved++;
  // Sample less frequently and skip oversized canvases to keep touch interaction smooth.
  if(scratchMoved%12===0&&canvas.width*canvas.height<8e6){
    const ctx=canvas.getContext('2d');const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let clear=0,total=0;
    for(let i=3;i<data.length;i+=4*160){total++;if(data[i]<30)clear++}
    if(total&&clear/total>.43){revealScratchForCurrentDraw()}
  }
}
let themeTransitionBusy=false;
let themeVisualTimer=0;
let themeButtonTimer=0;
function setTheme(mode,animateControl=false,transitionColors=false){
  const next=mode==='light'?'light':'dark';
  const root=document.documentElement;
  const body=document.body;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(transitionColors && !reduced){
    body.classList.add('ka28-theme-transitioning');
    if(themeVisualTimer)window.clearTimeout(themeVisualTimer);
    themeVisualTimer=window.setTimeout(()=>body.classList.remove('ka28-theme-transitioning'),190);
  }else{
    body.classList.remove('ka28-theme-transitioning');
    if(themeVisualTimer)window.clearTimeout(themeVisualTimer);
  }
  root.dataset.theme=next;
  body.dataset.theme=next;
  root.style.colorScheme=next;
  body.style.colorScheme=next;
  safeSet('ka28.lab.theme',next);
  const btn=$('#themeBtn');
  if(btn){
    const icon=next==='light'
      ? '<svg class="theme-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M20.5 15.1A8.6 8.6 0 0 1 8.9 3.5 8.8 8.8 0 1 0 20.5 15.1Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg class="theme-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    btn.innerHTML=icon;
    btn.title=next==='light'?'切换到暗色主题':'切换到亮色主题';
    btn.setAttribute('aria-label',btn.title);
    btn.setAttribute('aria-pressed',String(next==='dark'));
    if(animateControl && !reduced){
      btn.classList.remove('is-switching');
      // Force a style boundary so repeat taps replay only the small button animation.
      void btn.offsetWidth;
      btn.classList.add('is-switching');
      if(themeButtonTimer)window.clearTimeout(themeButtonTimer);
      themeButtonTimer=window.setTimeout(()=>btn.classList.remove('is-switching'),360);
    }else{
      btn.classList.remove('is-switching');
    }
  }
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=next==='light'?'#f3f4ec':'#101412';
}
function toggleThemeFromButton(){
  if(themeTransitionBusy)return;
  const btn=$('#themeBtn');
  const next=document.body.dataset.theme==='light'?'dark':'light';
  if(!btn){setTheme(next,true,true);return}
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const isMobile=window.matchMedia?.('(max-width: 760px), (hover: none)').matches;
  const saveData=!!navigator.connection?.saveData;
  const lowMemory=typeof navigator.deviceMemory==='number' && navigator.deviceMemory<4;
  const canViewTransition=!reduced&&!isMobile&&!saveData&&!lowMemory&&typeof document.startViewTransition==='function';
  // Mobile avoids a full-page snapshot and clip reveal, which was the source of stutter on phones.
  if(!canViewTransition){setTheme(next,true,!reduced);return}
  themeTransitionBusy=true;
  btn.disabled=true;
  let transitionGuard=0;
  const cleanup=()=>{
    if(transitionGuard)window.clearTimeout(transitionGuard);
    themeTransitionBusy=false;
    btn.disabled=false;
    // Let the one-shot icon animation finish on its own timer.
  };
  // If a browser drops/pauses a View Transition, never leave the control locked.
  transitionGuard=window.setTimeout(cleanup,420);
  try{
    const transition=document.startViewTransition(()=>setTheme(next,true,false));
    transition.finished.then(cleanup,cleanup);
  }catch(_){setTheme(next,true,true);cleanup()}
}

function initThemeControlBeforeAuth(){
  // The theme control is available on the MiYan gate too; authorization only gates forecast features.
  const saved=safeGet('ka28.lab.theme');
  setTheme(saved==='dark'?'dark':'light');
  const btn=document.getElementById('themeBtn');
  if(btn && btn.dataset.themeHandlerBound!=='true'){
    btn.dataset.themeHandlerBound='true';
    btn.addEventListener('click',toggleThemeFromButton);
  }
}
initThemeControlBeforeAuth();

function omissionOf(hist,fn){for(let i=hist.length-1,gap=0;i>=0;i--,gap++)if(fn(hist[i]))return gap;return hist.length}
function esc(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function omissionTile(label,gap){return `<div class="${gap>=12?'omit-tile hot':'omit-tile'}"><b>${esc(label)}</b><small>遗漏 ${gap} 期</small></div>`}
function renderOmissions(hist){$('#omissionSample').textContent=hist.length+' 期样本';$('#sumOmissions').innerHTML=Array.from({length:28},(_,n)=>({n,gap:omissionOf(hist,r=>r.sum===n)})).map(x=>omissionTile(x.n,x.gap)).join('');const simple=[['小',r=>r.sum<=13],['大',r=>r.sum>=14],['单',r=>r.sum%2===1],['双',r=>r.sum%2===0],['小单',r=>r.combo==='小单'],['小双',r=>r.combo==='小双'],['大单',r=>r.combo==='大单'],['大双',r=>r.combo==='大双']];$('#comboOmissions').innerHTML=simple.map(([name,fn])=>`<div class="cat-omit"><span>${name}</span><b>遗漏 ${omissionOf(hist,fn)} 期</b></div>`).join('');const traits=[['龙',r=>r.dragon==='龙'],['虎',r=>r.dragon==='虎'],['和',r=>r.dragon==='和'],['小边',r=>r.edge==='小边'],['中边',r=>r.edge==='中边'],['大边',r=>r.edge==='大边'],['极小',r=>r.sum<=5],['极大',r=>r.sum>=22],['对子',r=>r.shape==='对子'],['顺子',r=>r.shape==='顺子'],['杂六',r=>r.shape==='杂六'],['豹子',r=>r.shape==='豹子']];$('#traitOmissions').innerHTML=traits.map(([name,fn])=>`<div class="cat-omit"><span>${name}</span><b>遗漏 ${omissionOf(hist,fn)} 期</b></div>`).join('')}
function renderRecent(hist){
  const requested=Math.max(1,Math.min(200,Number($('#drawHistoryCountSelect')?.value)||20));
  const newest=hist.slice(-requested).reverse();
  $('#recentRows').innerHTML=newest.map(r=>`<tr><td>${esc(r.id)}</td><td>${esc(normalizeTime(r.time))}</td><td class="num">${r.digits.map(esc).join(' + ')}</td><td>${esc(r.sum)}</td><td>${esc(r.combo)}</td><td>${esc(r.edge)}</td><td>${esc(r.shape)}</td></tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:18px">API 尚未返回历史开奖</td></tr>';
  const count=$('#drawHistoryCount');if(count){count.textContent=`最近 ${newest.length}/${requested} 期${state.historyError?' · 历史同步异常':''}`;count.title=state.historyError?`历史接口暂不可用：${state.historyError}`:`显示最近 ${newest.length} 期有效开奖记录`;}
  const table=$('#drawHistorySection .table-wrap');if(table)table.setAttribute('aria-label',`最近 ${newest.length} 期真实开奖记录`);
  const sheet=$('#algoSheet');if(sheetMode==='records'&&sheet&&!sheet.hidden)renderRecentSheet(false);
}
function recentRecordMarkup(r){
  const digits=(r.digits||[]).map(n=>`<span class="recent-sheet-digit">${esc(n)}</span>`).join('<span class="recent-sheet-op" aria-hidden="true">+</span>');
  return `<article class="recent-sheet-record"><div class="recent-sheet-record-head"><div class="recent-sheet-period"><strong>第 ${esc(r.id)} 期</strong><time>${esc(normalizeTime(r.time))}</time></div><span class="recent-sheet-sum"><small>和值</small><b>${esc(r.sum)}</b></span></div><div class="recent-sheet-result">${digits}<span class="recent-sheet-equals">=</span><strong>${esc(r.sum)}</strong></div><div class="recent-sheet-tags"><span>${esc(r.combo)}</span><span>${esc(r.edge)}</span><span>${esc(r.shape)}</span></div></article>`;
}
function renderRecentSheet(openPanel=false){
  const sheet=$('#algoSheet'),backdrop=$('#algoSheetBackdrop'),body=$('#algoSheetBody');if(!sheet||!backdrop||!body)return;
  const rows=currentRecords().slice(-10).reverse();
  body.innerHTML=rows.length?`<div class="recent-sheet-caption"><span>最近 ${rows.length} 期 · 真实开奖</span><span>数据来自开奖 API</span></div><div class="recent-sheet-list">${rows.map(recentRecordMarkup).join('')}</div>`:`<div class="recent-sheet-empty"><strong>暂无真实开奖记录</strong><span>等待开奖 API 返回有效历史数据。</span></div>`;
  const kicker=$('#algoSheetKicker');if(kicker)kicker.textContent='REAL DRAW RECORDS';
  $('#algoSheetTitle').textContent='真实开奖记录';
  $('#algoSheetSubtitle').textContent='最近 10 期 · 按开奖期号从新到旧排列';
  $('#sheetSelectionCount').textContent=`显示 ${rows.length}/10 期真实开奖`;
  $('#clearAlgoSelection').textContent='关闭面板';
  if(!openPanel)return;
  sheetMode='records';sheet.dataset.sheetMode='records';selectedAlgoIds.clear();
  document.querySelectorAll('#algoLeaderboard [data-algo-id]').forEach(x=>{x.classList.remove('is-active');x.setAttribute('aria-pressed','false')});
  clearTimeout(sheetCloseTimer);sheet.classList.remove('is-dragging');sheet.style.removeProperty('height');sheet.style.removeProperty('transform');
  sheet.hidden=false;sheet.style.visibility='visible';backdrop.hidden=false;document.body.classList.add('algo-sheet-open');
  setSheetState('half');
  requestAnimationFrame(()=>{sheet.classList.add('open');backdrop.classList.add('open');if(wasHidden)$('#closeAlgoSheet')?.focus({preventScroll:true})});
  if(wasHidden){const grabber=$('.sheet-grabber');grabber?.setAttribute('aria-label','拖动调整真实开奖记录面板高度');}
}

let rollingForecastCacheKey='',rollingForecastCache=[];
let activeForecastAlgorithm='goblin';
const MIN_FORECAST_HISTORY=40;
function rollingForecasts(count){
  const all=currentRecords(),focus=windowN(),wanted=Math.max(1,Math.min(50,Number(count)||20));
  const relevant=all.slice(-Math.min(all.length,focus+wanted)).map(r=>`${r.id}:${r.sum}:${r.digits.join('')}:${r.opentime??''}:${r.time??''}`).join(';');
  const key=[focus,wanted,relevant].join('|');
  if(key===rollingForecastCacheKey)return rollingForecastCache;
  const out=[];
  // For each completed API draw, predict it from prior draws only. The target result never enters its own model.
  const start=Math.max(MIN_FORECAST_HISTORY,all.length-wanted);
  for(let i=start;i<all.length;i++){
    const target=all[i],earlier=all.slice(0,i);
    if(earlier.length<MIN_FORECAST_HISTORY)continue;
    const prior=earlier.slice(-focus);
    if(!prior.length)continue;
    let model,sums,three;
    try{
      model=sourceVoteModel(prior);
      sums=fourSumCandidates(prior,focus).items.map(x=>Number(x.sum)).filter(n=>Number.isInteger(n)&&n>=0&&n<=27).slice(0,4);
      three=threeDoorModel(prior);
    }catch(err){console.warn('逐期预测生成失败',target.id,err);continue;}
    const kill=model?.winner;
    if(!FOUR_GROUPS.includes(kill)||sums.length!==4)continue;
    const other=FOUR_GROUPS.filter(g=>g!==kill).sort((a,b)=>(model.tally[b]||0)-(model.tally[a]||0));
    const comboTwo=other.slice(0,2),comboThree=other.slice(0,3),threeGroups=Array.isArray(three?.groups)?three.groups.slice():[];
    const actualSum=Number(target.sum),actualCombo=comboOf(actualSum);
    // Goblin must be run against the preceding completed draw, never the target's own result.
    const goblin=goblinPredictNext(prior[prior.length-1]);
    if(!goblin)continue;
    const goblinEval=goblinEvaluate(goblin,actualSum);
    const goblinSums=goblinFourSumCandidates(prior,focus).map(x=>Number(x.sum)).filter(n=>Number.isInteger(n)&&n>=0&&n<=27).slice(0,4);
    const sequence=seqBuildForecast(prior);
    if(!sequence)continue;
    const sequenceEval=seqEvaluate(sequence,actualSum);
    out.push({
      id:String(target.id),time:String(target.time||''),digits:target.digits.slice(),actualCombo,actualSum,
      kill,comboTwo,comboThree,threeGroups,sums,
      killHit:actualCombo!==kill,
      comboHit:comboTwo.includes(actualCombo),
      comboThreeHit:comboThree.includes(actualCombo),
      threeHit:threeGroups.includes(actualCombo),
      sumHit:sums.includes(actualSum),goblinSums,goblinSumHit:goblinSums.includes(actualSum),
      goblin,goblinKillHit:goblinEval.killHit,goblinDoubleHit:goblinEval.doubleHit,goblinThreeDoorHit:goblinEval.threeDoorHit,goblinSpecial:goblinEval.special,
      sequence,sequenceCodes:sequence.specialCodes,sequenceKillHit:sequenceEval.killHit,sequenceDoubleHit:sequenceEval.doubleHit,sequenceThreeDoorHit:sequenceEval.threeDoorHit,sequenceCodeHit:sequenceEval.codeHit,
      source:'API',priorCount:prior.length
    });
  }
  rollingForecastCacheKey=key;rollingForecastCache=out;
  return out;
}
function hitBadge(hit,successLabel='中',missLabel='死'){
  return `<span class="forecast-hit ${hit?'good':'bad'}">${hit?'🀄 '+successLabel:'🍉 '+missLabel}</span>`;
}
function forecastCard(r,compact=false){
  const sequenceMode=activeForecastAlgorithm==='sequence';
  const model=sequenceMode?r.sequence:r.goblin;
  const modelCodes=sequenceMode?(r.sequenceCodes||[]):(r.goblinSums||[]);
  const modelKillHit=sequenceMode?r.sequenceKillHit:r.goblinKillHit;
  const modelDoubleHit=sequenceMode?r.sequenceDoubleHit:r.goblinDoubleHit;
  const modelThreeHit=sequenceMode?r.sequenceThreeDoorHit:r.goblinThreeDoorHit;
  const modelCodesHit=sequenceMode?r.sequenceCodeHit:r.goblinSumHit;
  const modelTitle=sequenceMode?'🧭 五方星序差集算法':'🐲 哥布林·星轨算法';
  const modelKillLabel=sequenceMode?'序列杀号组':'星轨杀号组';
  const modelDoubleLabel=sequenceMode?'序列双组':'星轨双组';
  const modelThreeLabel=sequenceMode?'主候选三门':'星轨三门';
  const modelCodesLabel=sequenceMode?'序列特码':'星轨和值四码';
  if(!model)return '<article class="forecast-round-card"><p>该期模型样本不足，未生成预测。</p></article>';
  if(compact){
    const status=(ok,yes='命中',no='未中')=>`<span class="latest-forecast-status ${ok?'is-good':'is-bad'}">${ok?yes:no}</span>`;
    const sumValues=(r.sums||[]).map(n=>esc(n)).join(' · ')||'—';
    const goblinSums=modelCodes.map(n=>esc(n)).join(' · ')||'—';
    const comboThreeText=(r.comboThree||[]).map(esc).join(' / ')||'—';
    const threeDoorText=(r.threeGroups||[]).map(esc).join(' / ')||'样本不足';
    return `<article class="forecast-round-card latest-forecast-summary">
      <div class="latest-forecast-top"><div class="forecast-period"><b>第 ${esc(r.id)} 期</b><small>${esc(normalizeTime(r.time))}</small></div><div class="latest-forecast-result"><span>真实开奖</span><b>${r.digits.map(n=>esc(n)).join(' + ')} = ${r.actualSum}</b><small>${esc(r.actualCombo)}</small></div></div>
      <div class="latest-forecast-section-label">KA28 预测回测</div>
      <div class="latest-forecast-metrics">
        <div class="latest-forecast-metric"><span>KA28 杀组</span><b>${esc(r.kill)}</b>${status(r.killHit,'避开成功','杀组出现')}</div>
        <div class="latest-forecast-metric"><span>KA28 二门</span><b>${r.comboTwo.map(esc).join(' / ')||'—'}</b>${status(r.comboHit)}</div>
        <div class="latest-forecast-metric"><span>融合和值四码</span><b>${sumValues}</b>${status(r.sumHit)}</div>
      </div>
      <section class="latest-forecast-goblin" aria-label="${esc(modelTitle)}回测">
        <div class="latest-forecast-goblin-head"><b>${esc(modelTitle)} · 回测</b><span>四项指标</span></div>
        <div class="latest-forecast-goblin-grid">
          <div><span>${esc(modelKillLabel)}</span><b>${esc(model.kill)}</b>${status(modelKillHit,'避开成功','杀组出现')}</div>
          <div><span>${esc(modelDoubleLabel)}</span><b>${(sequenceMode?model.recommends:model.doubleGroups).map(esc).join(' / ')||'—'}</b>${status(modelDoubleHit)}</div>
          <div><span>${esc(modelThreeLabel)}</span><b>${(sequenceMode?model.mainCandidates:model.threeDoor).map(esc).join(' / ')||'—'}</b>${status(modelThreeHit,'覆盖','未覆盖')}</div>
          <div><span>${esc(modelCodesLabel)}</span><b>${goblinSums}</b>${status(!!modelCodesHit,'四码命中','四码未中')}</div>
        </div>
        <small class="latest-forecast-detail-note">预测仅使用该期开奖前的历史数据；每项分别核验，回测结果不代表下一期保证。</small>
      </section>
      <div class="forecast-reference-line"><b>组合参考</b><span class="forecast-reference-item">三组：${comboThreeText} ${status(r.comboThreeHit,'中','未中')}</span><span class="forecast-reference-item">三门：${threeDoorText} ${status(r.threeHit,'中','未中')}</span></div>
    </article>`;
  }
  const sumPills=r.sums.map(n=>`<span class="forecast-sum-pill">${n}</span>`).join('');
  return `<article class="forecast-round-card live-forecast-card ${compact?'is-compact':''}">
    <div class="forecast-row-head"><div class="forecast-period"><b>第 ${esc(r.id)} 期</b><small>${esc(normalizeTime(r.time))}</small></div><div class="forecast-actual"><span>真实开奖</span><b>${r.digits.map(n=>esc(n)).join(' + ')} = ${r.actualSum}</b><small>${esc(r.actualCombo)}</small></div></div>
    <div class="forecast-prediction-grid">
      <div class="forecast-prediction-cell"><span class="forecast-cell-label">KA28 杀组预测</span><b class="forecast-kill-value">${esc(r.kill)}</b>${hitBadge(r.killHit,'杀中','未杀中')}</div>
      <div class="forecast-prediction-cell"><span class="forecast-cell-label">KA28 二门组合</span><div class="forecast-combo-values">${r.comboTwo.map(g=>`<span class="round-combo">${esc(g)}</span>`).join('')}</div>${hitBadge(r.comboHit,'命中','未中')}</div>
      <div class="forecast-prediction-cell"><span class="forecast-cell-label">KA28 融合和值四码</span><div class="forecast-sum-values">${sumPills}</div>${hitBadge(r.sumHit,'命中','未中')}</div>
    </div>
    <section class="forecast-goblin-record" aria-label="${esc(modelTitle)}真实开奖回测">
      <div class="forecast-goblin-head"><b>${esc(modelTitle)}</b><span>输入：第 ${esc(sequenceMode?model.inputIssue:model.inputIssue)} 期 · 预测：第 ${esc(r.id)} 期</span></div>
      <div class="forecast-goblin-grid">
        <div class="forecast-goblin-cell"><small>${esc(modelKillLabel)}</small><b class="goblin-kill-text">${esc(model.kill)}</b>${hitBadge(modelKillHit,'杀中','未杀中')}</div>
        <div class="forecast-goblin-cell"><small>${esc(modelDoubleLabel)}</small><b>${(sequenceMode?model.recommends:model.doubleGroups).map(esc).join(' / ')}</b>${hitBadge(modelDoubleHit,'命中','未中')}</div>
        <div class="forecast-goblin-cell"><small>${esc(modelThreeLabel)}</small><b>${(sequenceMode?model.mainCandidates:model.threeDoor).map(esc).join(' / ')}</b>${hitBadge(modelThreeHit,'覆盖','未覆盖')}</div>
        <div class="forecast-goblin-cell"><small>${esc(modelCodesLabel)}</small><div class="forecast-sum-values">${modelCodes.map(n=>`<span class="forecast-sum-pill">${esc(n)}</span>`).join('')}</div>${hitBadge(!!modelCodesHit,'候选命中','候选未中')}</div>
      </div>
      <small class="forecast-goblin-note">候选只依据第 ${esc(model.inputIssue)} 期及之前可用历史生成；每项按真实开奖分别核验，不使用目标期数据生成预测。</small>
    </section>
    ${compact?'':`<div class="forecast-reference-line"><b>组合参考</b><span class="forecast-reference-item">三组：${r.comboThree.map(esc).join(' / ')||'—'} ${hitBadge(r.comboThreeHit,'中','未中')}</span><span class="forecast-reference-item">三门：${r.threeGroups.length?r.threeGroups.map(esc).join(' / '):'样本不足'} ${hitBadge(r.threeHit,'中','未中')}</span><small>开奖来自 API；预测只使用当期开奖之前可用的数据。</small></div>`}
  </article>`;
}
function forecastStatsGrid(rows){
  const sample=Array.isArray(rows)?rows:[];
  const count=sample.length;
  const sequenceMode=activeForecastAlgorithm==='sequence';
  const metrics=[['KA28 杀组',r=>r.killHit],['KA28 二门',r=>r.comboHit],['KA28 三组',r=>r.comboThreeHit],['KA28 融合四码',r=>r.sumHit],
    [sequenceMode?'星序特码':'星轨四码',r=>sequenceMode?r.sequenceCodeHit:r.goblinSumHit],
    [sequenceMode?'五方星序杀组':'哥布林杀组',r=>sequenceMode?r.sequenceKillHit:r.goblinKillHit],
    [sequenceMode?'序列双组':'星轨双组',r=>sequenceMode?r.sequenceDoubleHit:r.goblinDoubleHit],
    [sequenceMode?'主候选三门':'星轨三门',r=>sequenceMode?r.sequenceThreeDoorHit:r.goblinThreeDoorHit]];
  return `<div class="forecast-stats-grid">${metrics.map(([name,fn])=>{const hit=sample.filter(fn).length;return `<div class="forecast-stat"><span>${name}命中</span><b>${hit}/${count||0}</b><small>${count?(hit/count*100).toFixed(1)+'%':'—'}</small></div>`}).join('')}</div>`;
}
function forecastStats(rows){
  const count=Array.isArray(rows)?rows.length:0;
  return `${forecastStatsGrid(rows)}<p class="forecast-stats-caption">统计样本 ${count} 期 · 每期只使用该期开奖前的历史数据，并与 API 实际结果核对。历史命中率仅描述所选样本，不代表下一期结果。</p>`;
}
function renderForecastSheet(rows){
  const body=$('#algoSheetBody');if(!body)return;
  const newestFirst=(Array.isArray(rows)?rows:[]).slice().reverse();
  const empty=`<div class="forecast-empty forecast-sheet-empty"><span>⌛</span><div><b>暂时没有可展示的逐期预测记录</b><small>至少需要 ${MIN_FORECAST_HISTORY} 期真实历史作为预测依据。样本不足时不会填充虚构命中率。</small></div></div>`;
  const list=newestFirst.length?`<div class="forecast-sheet-list">${newestFirst.map(r=>forecastCard(r,false)).join('')}</div>`:empty;
  body.innerHTML=`<div class="forecast-sheet-content">${forecastStats(newestFirst)}${list}</div>`;
  const kicker=$('#algoSheetKicker');if(kicker)kicker.textContent='FORECAST HISTORY';
  $('#algoSheetTitle').textContent='真实开奖预测记录';
  $('#algoSheetSubtitle').textContent=`最近 ${Number($('#forecastCountSelect')?.value)||20} 期 · API 实际开奖逐期核对`;
  $('#sheetSelectionCount').textContent=`统计 ${newestFirst.length} 期逐期回测`;
  $('#clearAlgoSelection').textContent='关闭面板';
  $('.sheet-grabber')?.setAttribute('aria-label','拖动调整预测历史面板高度');
}
function openForecastHistory(){
  const sheet=$('#algoSheet'),backdrop=$('#algoSheetBackdrop'),body=$('#algoSheetBody');
  if(!sheet||!backdrop||!body)return;
  const wasHidden=sheet.hidden;if(wasHidden)sheetReturnFocus=document.activeElement;
  const rows=rollingForecasts(Number($('#forecastCountSelect')?.value)||20);
  sheetMode='forecast';sheet.dataset.sheetMode='forecast';selectedAlgoIds.clear();
  document.querySelectorAll('#algoLeaderboard [data-algo-id]').forEach(x=>{x.classList.remove('is-active');x.setAttribute('aria-pressed','false')});
  clearTimeout(sheetCloseTimer);sheet.classList.remove('is-dragging');sheet.style.removeProperty('height');sheet.style.removeProperty('transform');
  renderForecastSheet(rows);
  sheet.hidden=false;sheet.style.visibility='visible';backdrop.hidden=false;document.body.classList.add('algo-sheet-open');
  setSheetState('half');
  requestAnimationFrame(()=>{sheet.classList.add('open');backdrop.classList.add('open');if(wasHidden)$('#closeAlgoSheet')?.focus({preventScroll:true})});
  const btn=$('#forecastMoreBtn');if(btn)btn.setAttribute('aria-haspopup','dialog');
}
function renderForecastRounds(){
  const root=$('#forecastLatest');if(!root)return;
  const count=Number($('#forecastCountSelect')?.value)||20;
  const rows=rollingForecasts(count),latest=rows.at(-1);
  const overview=$('#forecastHitRateOverview');if(overview)overview.innerHTML=forecastStatsGrid(rows);
  const overviewCaption=$('#forecastHitRateCaption');if(overviewCaption)overviewCaption.textContent=rows.length?`逐期回测 ${rows.length} 期 · 所有统计仅针对已开奖样本，不代表下一期结果。`:`当前有效回测样本不足；至少需要 ${MIN_FORECAST_HISTORY} 期先验开奖，不填充虚构命中率。`;
  const overviewRange=$('#hitRateRangeTag');if(overviewRange)overviewRange.textContent=`目标近 ${count} 期 · 有效 ${rows.length} 期`;
  const note=$('#forecastStatsNote');
  if(!latest){
    root.innerHTML=`<div class="forecast-empty"><span>⌛</span><div><b>等待足够的真实开奖历史</b><small>至少需要 ${MIN_FORECAST_HISTORY} 期既有开奖作为预测依据；不会使用手工样例填充。</small></div></div>`;
    if(note)note.textContent=`当前已载入 ${currentRecords().length} 期开奖记录；有效逐期预测需要至少 ${MIN_FORECAST_HISTORY} 期先验开奖。数据不足时不显示虚构命中率。`;
  }else{
    root.innerHTML=forecastCard(latest,true);
    if(note)note.textContent=`当前生成 ${rows.length} 期滚动记录。每一期都只用该期开奖之前的数据预测，结果与 API 实际开奖核对；不把预测号码自身当作开奖结果。`;
  }
  const btn=$('#forecastMoreBtn');if(btn)btn.disabled=false;
  const sheet=$('#algoSheet');
  if(sheetMode==='forecast'&&sheet&&!sheet.hidden)renderForecastSheet(rows);
}
function renderAnalytics(force=false){
  const hist=currentRecords();
  const signature=[windowN(),rangeBacktestPeriod,$('#forecastCountSelect')?.value||20,hist.map(r=>`${r.id}:${r.sum}:${r.digits.join('')}`).join(';')].join('|');
  if(!force&&signature===analyticsRenderSignature)return;
  analyticsRenderSignature=signature;
  renderPrediction(hist);renderKillPrediction(hist);renderGoblinPrediction(hist);renderSequencePrediction(hist);renderGoblinFourAndCompare(hist);renderOmissions(hist);renderRecent(hist);renderForecastRounds();
}
function renderTick(){renderCountdown()}
async function boot(){setDataReady(false);initAlgorithmSwipe();setActiveForecastAlgorithm('goblin',false);const savedTheme=safeGet('ka28.lab.theme')||'light';setTheme(savedTheme);restoreCache();if(state.records.length){state.latest=state.records[state.records.length-1];renderDraw();renderAnalytics();setDataReady(true);setStatus('显示缓存数据 · 正在联网校准','warn')}const tasks=await Promise.allSettled([fetchLatest({silent:true}),fetchHistory({quiet:true})]);if(!state.latest&&state.records.length)state.latest=state.records[state.records.length-1];renderDraw();renderAnalytics();renderCountdown();setDataReady(true);
  setInterval(()=>{if(!document.hidden)renderTick()},1000);
  setInterval(()=>{if(!document.hidden)fetchLatest({silent:true})},3000);
  setInterval(()=>{if(!document.hidden&&(!state.historyLoaded||state.records.length<30||state.historyError))fetchHistory({quiet:true})},30000);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)return;renderCountdown();fetchLatest({silent:true});if(!state.historyLoaded||state.records.length<30||state.historyError)fetchHistory({quiet:true})});
  $('#refreshBtn').addEventListener('click',async()=>{const btn=$('#refreshBtn');btn.classList.add('is-syncing');try{await fetchLatest();await fetchHistory({quiet:true});renderAnalytics(true)}finally{setTimeout(()=>btn.classList.remove('is-syncing'),180)}});$('#windowSelect').addEventListener('change',()=>{killModelCacheKey='';renderAnalytics()});$('#algoRankToggle').addEventListener('click',()=>{algoRankExpanded=!algoRankExpanded;const hist=currentRecords().slice(-windowN());renderAlgoLeaderboard(hist,sourceVoteModel(hist));if(!algoRankExpanded)$('#algoRankTitle')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})});$('#algoLeaderboard').addEventListener('click',e=>{const row=e.target.closest('button[data-algo-id]');if(!row)return;const id=row.dataset.algoId;selectedAlgoIds.clear();selectedAlgoIds.add(id);document.querySelectorAll('#algoLeaderboard [data-algo-id]').forEach(item=>{const active=item.dataset.algoId===id;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active))});renderAlgoSheet()});$('#algoSheetBody').addEventListener('change',e=>{if(e.target.id==='sheetRangeBacktest')applyRangeTuning(false)});$('#algoSheetBody').addEventListener('click',e=>{if(e.target.closest('#sheetAutoRangeBtn'))applyRangeTuning(true)});$('#closeAlgoSheet').addEventListener('click',()=>closeAlgoSheet(true));$('#clearAlgoSelection').addEventListener('click',()=>closeAlgoSheet(true));$('#algoSheetBackdrop').addEventListener('click',()=>closeAlgoSheet(true));$('#recentRecordsOpenBtn').addEventListener('click',()=>renderRecentSheet(true));$('#forecastMoreBtn').addEventListener('click',openForecastHistory);$('#forecastCountSelect').addEventListener('change',()=>{rollingForecastCacheKey='';renderForecastRounds()});$('#drawHistoryCountSelect').addEventListener('change',()=>renderRecent(currentRecords()));const sheetDragTargets=[$('.sheet-grabber'),$('.sheet-head')].filter(Boolean);
let sheetDrag=null,sheetDragFrame=0;
const getSheetSnapPoints=()=>{
  const viewport=window.visualViewport?.height||window.innerHeight;
  const mobile=window.matchMedia?.('(max-width: 640px)').matches||false;
  const peek=Math.max(220,Math.min(viewport*(mobile?.32:.34),mobile?330:360));
  const half=Math.max(peek+32,Math.min(viewport*.58,mobile?580:620));
  const full=Math.max(half+24,viewport-8);
  return [{state:'peek',height:peek},{state:'half',height:half},{state:'full',height:full}];
};
const nearestSheetSnap=height=>getSheetSnapPoints().reduce((best,item)=>Math.abs(item.height-height)<Math.abs(best.height-height)?item:best,getSheetSnapPoints()[0]);
function startSheetDrag(e,target){
  const sheet=$('#algoSheet');if(!sheet||sheet.hidden||e.button===2||e.target.closest('button'))return;
  if(e.pointerType==='mouse'&&e.button!==0)return;
  sheetDrag={pointerId:e.pointerId,startY:e.clientY,startTime:performance.now(),startHeight:sheet.getBoundingClientRect().height,startState:sheet.dataset.sheetState||nearestSheetSnap(sheet.getBoundingClientRect().height).state,target};
  sheet.classList.add('is-dragging');
  try{target.setPointerCapture?.(e.pointerId)}catch(_){}
  if(e.cancelable)e.preventDefault();
}
function moveSheetDrag(e){
  if(!sheetDrag||e.pointerId!==sheetDrag.pointerId)return;
  if(e.cancelable)e.preventDefault();
  sheetDrag.latestY=e.clientY;
  if(sheetDragFrame)return;
  sheetDragFrame=requestAnimationFrame(()=>{
    sheetDragFrame=0;
    const drag=sheetDrag,sheet=$('#algoSheet');if(!drag||!sheet)return;
    const delta=drag.latestY-drag.startY,snaps=getSheetSnapPoints();
    const lower=snaps[0].height,upper=snaps[2].height,raw=drag.startHeight-delta;
    let height=raw,translate=0;
    if(raw<lower){height=lower;translate=Math.min(132,(lower-raw)*.28)}
    else if(raw>upper){height=upper;translate=-Math.min(10,(raw-upper)*.08)}
    sheet.style.height=`${height}px`;
    sheet.style.transform=`translate3d(0,${translate.toFixed(2)}px,0)`;
  });
}
function endSheetDrag(e,cancelled=false){
  if(!sheetDrag||(!cancelled&&e.pointerId!==sheetDrag.pointerId))return;
  if(sheetDragFrame){cancelAnimationFrame(sheetDragFrame);sheetDragFrame=0;}
  const drag=sheetDrag;sheetDrag=null;
  const sheet=$('#algoSheet');if(!sheet)return;
  const delta=cancelled?0:e.clientY-drag.startY;
  const elapsed=Math.max(1,performance.now()-drag.startTime),velocity=cancelled?0:delta/elapsed;
  const desired=cancelled?drag.startHeight:drag.startHeight-delta;
  const snaps=getSheetSnapPoints();
  const nearest=snaps.reduce((best,item,i)=>Math.abs(item.height-desired)<Math.abs(best.item.height-desired)?{item,i}:best,{item:snaps[0],i:0});
  let idx=nearest.i;
  const startIdx=Math.max(0,snaps.findIndex(x=>x.state===drag.startState));
  if(!cancelled&&Math.abs(delta)>18&&velocity<-.42)idx=Math.max(idx,Math.min(2,startIdx+1));
  else if(!cancelled&&Math.abs(delta)>18&&velocity>.42)idx=Math.min(idx,Math.max(0,startIdx-1));
  if(!cancelled&&drag.startState==='peek'&&delta>118) {closeAlgoSheet(true);return}
  sheet.classList.remove('is-dragging');sheet.style.removeProperty('height');sheet.style.removeProperty('transform');
  setSheetState(snaps[idx].state);
}
sheetDragTargets.forEach(target=>{
  target.addEventListener('pointerdown',e=>startSheetDrag(e,target),{passive:false});
  target.addEventListener('pointermove',moveSheetDrag,{passive:false});
  target.addEventListener('pointerup',e=>endSheetDrag(e,false));
  target.addEventListener('pointercancel',e=>endSheetDrag(e,true));
  target.addEventListener('lostpointercapture',e=>{if(sheetDrag&&e.pointerId===sheetDrag.pointerId)endSheetDrag(e,true)});
});document.addEventListener('keydown',e=>{const sheet=$('#algoSheet');if(!sheet||sheet.hidden||!sheet.classList.contains('open')||e.key!=='Tab')return;const nodes=Array.from(sheet.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(el=>!el.hidden&&el.getAttribute('aria-hidden')!=='true'&&el.getClientRects().length);if(!nodes.length){e.preventDefault();sheet.focus({preventScroll:true});return}const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||!sheet.contains(document.activeElement))){e.preventDefault();last.focus()}else if(!e.shiftKey&&(document.activeElement===last||!sheet.contains(document.activeElement))){e.preventDefault();first.focus()}});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#algoSheet').hidden)closeAlgoSheet(true)});$('#soundBtn').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('#soundBtn').setAttribute('aria-pressed',String(soundEnabled));$('#soundBtn').textContent=soundEnabled?'🔔 强提示音：开':'🔔 强提示音：关';if(soundEnabled){playTripleChime();toast('已开启高音量叮叮叮提示音')}else toast('提示音已关闭')});$('#scratchBtn').addEventListener('click',()=>scratchEnabled?closeScratch():openScratch());const canvas=$('#scratchCanvas');canvas.addEventListener('pointerdown',e=>{if(!scratchEnabled)return;canvas.setPointerCapture?.(e.pointerId);scratchLastPoint=null;eraseScratch(e)});canvas.addEventListener('pointermove',e=>{if(!scratchEnabled||!e.buttons)return;eraseScratch(e)});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>canvas.addEventListener(ev,()=>{scratchLastPoint=null}));let scratchResizeFrame=0;window.addEventListener('resize',()=>{if(!scratchEnabled||scratchResizeFrame)return;scratchResizeFrame=requestAnimationFrame(()=>{scratchResizeFrame=0;if(scratchEnabled)sizeScratchCanvas()})});}
window.__KA28_START_AFTER_AUTH=boot;
})();
