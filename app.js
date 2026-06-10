/* ============================================================
   WORLD CUP 2026 — Trung tâm giải đấu
   Dữ liệu: window.WC_MATCHES, WC_TEAMS, WC_NEWS (nhúng phía trên)
   ============================================================ */
(function(){
"use strict";

const STORE_KEY = "wc2026_results_v1";
const STORE_SCORERS = "wc2026_scorers_v1";
const STORE_SQUADS = "wc2026_squads_v1";
const NOW = new Date(); // thời điểm hiện tại để xác định "trận gần nhất"

// ---- dữ liệu gốc (mặc định = bản nhúng; sẽ bị ghi đè nếu fetch được file JSON trên server) ----
let TEAMS = WC_TEAMS.teams;
let ALL_MATCHES = WC_MATCHES.matches.slice();   // 72 vòng bảng
let KNOCKOUT = WC_MATCHES.knockout.slice();
let NEWS = WC_NEWS;
const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"];
const ROUND_LABEL = {group:"Vòng bảng",r32:"Vòng 1/16",r16:"Vòng 1/8",qf:"Tứ kết",sf:"Bán kết",third:"Tranh hạng 3",final:"Chung kết"};
let currentView = "home";

// ---- trạng thái (kết quả người dùng nhập, lưu localStorage-like qua window.storage nếu có) ----
let RESULTS = {};   // { matchId: {hs, as} }
let SCORERS = [];   // [{name, team, goals, assists}]
let SQUADS = {};    // { teamCode: {squad:{pos:[players]}, official:bool, updated:"YYYY-MM-DD"} }

/* ---------- Persistent storage ----------
   Ưu tiên window.storage (khi xem trong Claude), fallback localStorage (khi deploy web thật).
   Nếu cả hai đều không có -> chỉ lưu trong bộ nhớ phiên. */
const hasClaudeStorage = typeof window!=="undefined" && window.storage && typeof window.storage.get==="function";
const hasLocalStorage = (function(){
  try{ const k="__wc_test__"; window.localStorage.setItem(k,"1"); window.localStorage.removeItem(k); return true; }
  catch(e){ return false; }
})();
async function storeGet(key){
  if(hasClaudeStorage){ try{ const r=await window.storage.get(key); return r&&r.value!=null?r.value:null; }catch(e){ return null; } }
  if(hasLocalStorage){ try{ return window.localStorage.getItem(key); }catch(e){ return null; } }
  return null;
}
async function storeSet(key,val){
  if(hasClaudeStorage){ try{ await window.storage.set(key,val); }catch(e){} }
  if(hasLocalStorage){ try{ window.localStorage.setItem(key,val); }catch(e){} }
}
async function loadState(){
  try{ const r=await storeGet(STORE_KEY);     if(r) RESULTS = JSON.parse(r); }catch(e){}
  try{ const s=await storeGet(STORE_SCORERS); if(s) SCORERS = JSON.parse(s); }catch(e){}
  try{ const q=await storeGet(STORE_SQUADS);  if(q) SQUADS  = JSON.parse(q); }catch(e){}
}
async function saveResults(){ await storeSet(STORE_KEY, JSON.stringify(RESULTS)); }
async function saveScorers(){ await storeSet(STORE_SCORERS, JSON.stringify(SCORERS)); }
async function saveSquads(){  await storeSet(STORE_SQUADS, JSON.stringify(SQUADS)); }

/* ---------- Helpers ---------- */
function T(code){ return TEAMS[code] || {code,name:code,flag:"🏳️",nick:"",group:"?"}; }
// đội hình hiển thị: ưu tiên bản người dùng cập nhật, fallback dữ liệu gốc
function getSquad(code){
  const ov=SQUADS[code];
  if(ov && ov.squad && Object.keys(ov.squad).length) return ov.squad;
  return (TEAMS[code]||{}).squad || {};
}
function squadMeta(code){
  const ov=SQUADS[code];
  if(ov) return { official: !!ov.official, updated: ov.updated, edited: !!ov.squad };
  // chưa có override -> đọc cờ official từ dữ liệu gốc (đội đã công bố danh sách chính thức)
  const t=TEAMS[code]||{};
  return { official: !!t.official, updated: t.officialDate, edited: false };
}
function squadToText(sq){
  // chuyển object đội hình -> text dạng "Vị trí: ct1, ct2" để sửa
  return Object.keys(sq).map(pos=>`${pos}: ${sq[pos].join(", ")}`).join("\n");
}
function textToSquad(txt){
  // parse ngược: mỗi dòng "Vị trí: a, b, c"
  const out={};
  txt.split(/\n+/).forEach(line=>{
    const i=line.indexOf(":"); if(i<1) return;
    const pos=line.slice(0,i).trim();
    const players=line.slice(i+1).split(/[,;]/).map(s=>s.trim()).filter(Boolean);
    if(pos && players.length) out[pos]=players;
  });
  return out;
}
// tách "Tên (CLB)" -> {name, club}
function splitPlayer(p){
  const m=String(p).match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if(m) return { name:m[1].trim(), club:m[2].trim() };
  return { name:String(p).trim(), club:"" };
}
// icon cho từng nhóm vị trí
function posIcon(pos){
  const p=pos.toLowerCase();
  if(p.includes("thủ môn")||p.includes("gk")) return "🧤";
  if(p.includes("hậu vệ")||p.includes("def")) return "🛡️";
  if(p.includes("tiền vệ")||p.includes("mid")) return "⚙️";
  if(p.includes("tiền đạo")||p.includes("fw")||p.includes("forward")) return "⚽";
  return "•";
}
function matchById(id){ return ALL_MATCHES.concat(KNOCKOUT).find(m=>m.id===id); }
function getScore(m){ // ưu tiên kết quả user nhập, fallback dữ liệu gốc
  if(RESULTS[m.id]) return RESULTS[m.id];
  if(m.hs!=null && m.as!=null) return {hs:m.hs, as:m.as};
  return null;
}
function isPlayed(m){ return getScore(m)!=null; }
function matchDateTime(m){
  // m.date = YYYY-MM-DD, m.timeVN = HH:MM (giờ VN). Tạo Date theo UTC+7.
  const [Y,Mo,D] = m.date.split("-").map(Number);
  const [h,mi] = (m.timeVN||"00:00").split(":").map(Number);
  return new Date(Date.UTC(Y,Mo-1,D,h-7,mi)); // quy về UTC
}
const VN_DAYS = ["Chủ Nhật","Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7"];
function fmtDate(m){
  const d = matchDateTime(m);
  // hiển thị theo giờ VN
  const vn = new Date(d.getTime()+7*3600*1000);
  return `${VN_DAYS[vn.getUTCDay()]}, ${vn.getUTCDate()}/${vn.getUTCMonth()+1}`;
}
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg){
  const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),2200);
}

/* ============================================================
   STANDINGS — tính bảng xếp hạng từ kết quả
   ============================================================ */
function computeStandings(group){
  const teams = GROUPS.includes(group) ? Object.values(TEAMS).filter(t=>t.group===group) : [];
  const rows = {};
  teams.forEach(t=>{ rows[t.code]={code:t.code,P:0,W:0,D:0,L:0,GF:0,GA:0,Pts:0}; });
  ALL_MATCHES.filter(m=>m.group===group).forEach(m=>{
    const sc=getScore(m); if(!sc) return;
    const h=rows[m.home], a=rows[m.away]; if(!h||!a) return;
    h.P++;a.P++; h.GF+=sc.hs;h.GA+=sc.as; a.GF+=sc.as;a.GA+=sc.hs;
    if(sc.hs>sc.as){h.W++;a.L++;h.Pts+=3;}
    else if(sc.hs<sc.as){a.W++;h.L++;a.Pts+=3;}
    else{h.D++;a.D++;h.Pts++;a.Pts++;}
  });
  const arr=Object.values(rows);
  arr.forEach(r=>r.GD=r.GF-r.GA);
  arr.sort((x,y)=> y.Pts-x.Pts || y.GD-x.GD || y.GF-x.GF || T(x.code).name.localeCompare(T(y.code).name));
  return arr;
}

/* ============================================================
   RENDER: NAV
   ============================================================ */
const VIEWS = [
  {id:"home",label:"Trang chủ"},
  {id:"schedule",label:"Lịch & Kết quả"},
  {id:"standings",label:"Bảng xếp hạng"},
  {id:"teams",label:"48 Đội bóng"},
  {id:"h2h",label:"Đối đầu"},
  {id:"scorers",label:"Vua phá lưới"},
  {id:"news",label:"Tin tức"},
];
function renderNav(){
  document.getElementById("nav").innerHTML = VIEWS.map(v=>
    `<button class="nav-btn" data-view="${v.id}">${v.label}</button>`).join("");
  document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
}
function switchView(id){
  currentView = id;
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById("view-"+id).classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
  RENDERERS[id] && RENDERERS[id]();
}

/* ============================================================
   RENDER: HOME
   ============================================================ */
function nextMatch(){
  // trận chưa đá, gần thời điểm hiện tại nhất (theo lịch)
  const upcoming = ALL_MATCHES.concat(KNOCKOUT)
    .filter(m=>m.home&&m.away&&!isPlayed(m))
    .map(m=>({m,t:matchDateTime(m)}))
    .sort((a,b)=>a.t-b.t);
  const future = upcoming.find(x=>x.t>=NOW);
  return (future||upcoming[0]||{}).m || ALL_MATCHES[0];
}
let countdownTimer;
function renderHome(){
  const el=document.getElementById("view-home");
  const nm=nextMatch();
  const h=T(nm.home), a=T(nm.away);
  const recent = ALL_MATCHES.concat(KNOCKOUT).filter(isPlayed)
    .sort((x,y)=>matchDateTime(y)-matchDateTime(x)).slice(0,5);
  const upcoming = ALL_MATCHES.concat(KNOCKOUT)
    .filter(m=>m.home&&m.away&&!isPlayed(m))
    .sort((x,y)=>matchDateTime(x)-matchDateTime(y)).slice(0,6);

  el.innerHTML = `
    <div class="hero">
      <div class="hero-label"><span class="pulse"></span> Trận sắp diễn ra · giờ Việt Nam</div>
      <div class="next-match">
        <div class="nm-team">
          <div class="nm-flag">${h.flag}</div>
          <div class="nm-name">${esc(h.name)}</div>
          <div class="nm-sub">Bảng ${h.group||"-"} · ${h.nick||""}</div>
        </div>
        <div class="nm-center">
          <div class="nm-vs">VS</div>
          <div class="nm-time">${fmtDate(nm)} · ${nm.timeVN}</div>
          <div class="nm-venue">${esc(nm.venue||"")}</div>
          <div class="countdown" id="countdown"></div>
        </div>
        <div class="nm-team">
          <div class="nm-flag">${a.flag}</div>
          <div class="nm-name">${esc(a.name)}</div>
          <div class="nm-sub">Bảng ${a.group||"-"} · ${a.nick||""}</div>
        </div>
      </div>
      <div class="hero-foot">
        <button class="btn btn-gold" data-go="schedule">📅 Xem toàn bộ lịch (104 trận)</button>
        <button class="btn" data-go="standings">📊 Bảng xếp hạng</button>
      </div>
    </div>

    <div class="home-grid">
      <div class="card">
        <div class="card-h"><h3><span class="ic">⏱</span> Lịch sắp tới</h3><a class="link-more" data-go="schedule">Tất cả →</a></div>
        <div>${upcoming.map(rowMatch).join("") || '<p class="muted tiny">Đã đá hết.</p>'}</div>
      </div>
      <div class="card">
        <div class="card-h"><h3><span class="ic">✅</span> Kết quả gần nhất</h3></div>
        <div>${recent.map(rowMatch).join("") || '<p class="muted tiny">Chưa có kết quả nào. Bấm vào một trận để nhập tỉ số.</p>'}</div>
      </div>
    </div>`;
  el.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>switchView(b.dataset.go));
  const omBtn=el.querySelector("[data-openmatch]");
  if(omBtn) omBtn.onclick=()=>openMatchModal(omBtn.dataset.openmatch);
  bindMatchRows(el);
  startCountdown(nm);
}
function startCountdown(m){
  clearInterval(countdownTimer);
  const box=document.getElementById("countdown"); if(!box) return;
  function tick(){
    const diff = matchDateTime(m)-new Date();
    if(diff<=0){ box.innerHTML=`<div class="cd-box" style="min-width:auto;padding:7px 14px"><b style="font-size:14px">ĐANG/ĐÃ DIỄN RA</b></div>`; clearInterval(countdownTimer); return; }
    const d=Math.floor(diff/864e5),hh=Math.floor(diff%864e5/36e5),mm=Math.floor(diff%36e5/6e4),ss=Math.floor(diff%6e4/1e3);
    box.innerHTML=[[d,"ngày"],[hh,"giờ"],[mm,"phút"],[ss,"giây"]].map(([v,l])=>`<div class="cd-box"><b>${String(v).padStart(2,"0")}</b><span>${l}</span></div>`).join("");
  }
  tick(); countdownTimer=setInterval(tick,1000);
}

/* ---- một dòng trận đấu ---- */
function rowMatch(m){
  const h=T(m.home),a=T(m.away),sc=getScore(m);
  const hw=sc&&sc.hs>sc.as, aw=sc&&sc.as>sc.hs;
  return `<div class="match-row" data-mid="${m.id}">
    <div class="mr-time"><b>${m.timeVN||"--"}</b><span>${fmtDate(m)}</span></div>
    <div class="mr-teams">
      <div class="mr-team ${hw?"win":""}"><span class="fl">${h.flag}</span> ${esc(h.name)} <span class="mr-score">${sc?sc.hs:""}</span></div>
      <div class="mr-team ${aw?"win":""}"><span class="fl">${a.flag}</span> ${esc(a.name)} <span class="mr-score">${sc?sc.as:""}</span></div>
    </div>
    <div class="mr-meta">${m.group?`<span class="grp-badge">B.${m.group}</span>`:`<span class="grp-badge">${ROUND_LABEL[m.round]||""}</span>`}<br>${sc?'<span class="played-tag">● XONG</span>':""}</div>
  </div>`;
}
function bindMatchRows(scope){
  (scope||document).querySelectorAll(".match-row").forEach(r=>r.onclick=()=>openMatchModal(r.dataset.mid));
}

/* ============================================================
   RENDER: SCHEDULE
   ============================================================ */
let schedFilter={round:"group",group:"all"};
function renderSchedule(){
  const el=document.getElementById("view-schedule");
  const rounds=[["group","Vòng bảng"],["r32","1/16"],["r16","1/8"],["qf","Tứ kết"],["sf","Bán kết"],["final","CK & H3"]];
  el.innerHTML=`
    <div class="sec-title"><span class="bar"></span><h2>Lịch thi đấu & Kết quả</h2></div>
    <div class="filters" id="roundFilters">${rounds.map(([k,l])=>`<button class="chip ${schedFilter.round===k?"active":""}" data-r="${k}">${l}</button>`).join("")}</div>
    <div class="filters" id="groupFilters"></div>
    <div id="schedList"></div>`;
  el.querySelectorAll("#roundFilters .chip").forEach(c=>c.onclick=()=>{schedFilter.round=c.dataset.r;schedFilter.group="all";renderSchedule();});
  // group filter chỉ hiện khi xem vòng bảng
  const gf=el.querySelector("#groupFilters");
  if(schedFilter.round==="group"){
    gf.innerHTML=`<button class="chip ${schedFilter.group==="all"?"active":""}" data-g="all">Tất cả bảng</button>`+
      GROUPS.map(g=>`<button class="chip ${schedFilter.group===g?"active":""}" data-g="${g}">Bảng ${g}</button>`).join("");
    gf.querySelectorAll(".chip").forEach(c=>c.onclick=()=>{schedFilter.group=c.dataset.g;renderSchedule();});
  }
  // danh sách
  let list = schedFilter.round==="group" ? ALL_MATCHES.slice() :
    (schedFilter.round==="final" ? KNOCKOUT.filter(m=>["final","third"].includes(m.round)) : KNOCKOUT.filter(m=>m.round===schedFilter.round));
  if(schedFilter.round==="group" && schedFilter.group!=="all") list=list.filter(m=>m.group===schedFilter.group);
  // gom theo ngày
  const byDay={};
  list.forEach(m=>{ (byDay[m.date]=byDay[m.date]||[]).push(m); });
  const days=Object.keys(byDay).sort();
  document.getElementById("schedList").innerHTML = days.map(d=>{
    const ms=byDay[d].sort((a,b)=>(a.timeVN||"").localeCompare(b.timeVN||""));
    return `<div class="day-group"><div class="day-head">${fmtDate(ms[0])} <span>${ms.length} trận</span></div>${ms.map(rowMatch).join("")}</div>`;
  }).join("") || '<p class="muted">Chưa có lịch ở vòng này (phụ thuộc kết quả vòng trước).</p>';
  bindMatchRows(el);
}

/* ============================================================
   RENDER: STANDINGS
   ============================================================ */
function renderStandings(){
  const el=document.getElementById("view-standings");
  el.innerHTML=`
    <div class="sec-title"><span class="bar"></span><h2>Bảng xếp hạng — Vòng bảng</h2></div>
    <div class="qual-legend">
      <span><i style="background:rgba(40,180,99,.6)"></i>Nhất/Nhì bảng — đi tiếp</span>
      <span><i style="background:rgba(58,160,255,.6)"></i>Hạng 3 (8 đội tốt nhất cũng đi tiếp)</span>
      <span class="tiny">Tự cập nhật khi bạn nhập tỉ số. Sắp theo: Điểm → Hiệu số → Bàn thắng.</span>
    </div>
    <div class="standings-grid">${GROUPS.map(stdCard).join("")}</div>`;
}
function stdCard(g){
  const rows=computeStandings(g);
  return `<div class="stand-card">
    <div class="stand-head"><span>Bảng <span class="gl">${g}</span></span><span class="tiny muted">${rows.reduce((s,r)=>s+r.P,0)/2|0}/6 trận</span></div>
    <div class="stand-scroll"><table class="stand">
      <thead><tr><th>#</th><th>Đội</th><th>Tr</th><th>T</th><th>H</th><th>B</th><th>HS</th><th>Đ</th></tr></thead>
      <tbody>${rows.map((r,i)=>{
        const cls=i<2?"q":(i===2?"q3":"");
        const t=T(r.code);
        return `<tr><td><span class="st-pos ${cls}">${i+1}</span></td>
          <td><span class="st-team"><span class="fl">${t.flag}</span>${esc(t.name)}</span></td>
          <td>${r.P}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td>
          <td>${r.GD>0?"+":""}${r.GD}</td><td class="st-pts">${r.Pts}</td></tr>`;
      }).join("")}</tbody>
    </table></div></div>`;
}

/* ============================================================
   RENDER: TEAMS
   ============================================================ */
let teamFilter="all";
function isOfficial(t){ return t.official || (SQUADS[t.code]&&SQUADS[t.code].official); }
function renderTeams(){
  const el=document.getElementById("view-teams");
  const confs=["all","official","CONMEBOL","UEFA","CONCACAF","CAF","AFC","OFC"];
  const confLabel={all:"Tất cả",official:"✓ Đã công bố chính thức"};
  let list=Object.values(TEAMS);
  if(teamFilter==="official") list=list.filter(isOfficial);
  else if(teamFilter!=="all") list=list.filter(t=>t.conf===teamFilter);
  list=list.sort((a,b)=> a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  const offCount=Object.values(TEAMS).filter(isOfficial).length;
  el.innerHTML=`
    <div class="sec-title"><span class="bar"></span><h2>48 Đội tuyển</h2></div>
    <div class="filters">${confs.map(c=>`<button class="chip ${teamFilter===c?"active":""}" data-c="${c}">${confLabel[c]||c}${c==="official"?` (${offCount})`:""}</button>`).join("")}</div>
    <p class="muted tiny" style="margin-bottom:16px">● chấm xanh = có hồ sơ chi tiết · <span style="color:var(--green);font-weight:700">✓ Chính thức</span> = đã công bố danh sách 26. Bấm vào đội để xem chi tiết & lịch riêng.</p>
    <div class="team-grid">${list.map(teamCard).join("")}</div>`;
  el.querySelectorAll(".chip").forEach(c=>c.onclick=()=>{teamFilter=c.dataset.c;renderTeams();});
  el.querySelectorAll(".team-card").forEach(c=>c.onclick=()=>openTeamModal(c.dataset.code));
}
function teamCard(t){
  const off = t.official || (SQUADS[t.code]&&SQUADS[t.code].official);
  return `<div class="team-card" data-code="${t.code}">
    ${t.detail?'<span class="detail-dot" title="Có hồ sơ chi tiết"></span>':""}
    <span class="tc-flag">${t.flag}</span>
    <div class="tc-name">${esc(t.name)}</div>
    <div class="tc-nick">${esc(t.nick||"")}</div>
    <div class="tc-tags">
      <span class="tc-tag grp">Bảng ${t.group}</span>
      ${t.fifa?`<span class="tc-tag fifa">FIFA #${t.fifa}</span>`:""}
      ${off?'<span class="tc-tag off">✓ Chính thức</span>':""}
    </div>
  </div>`;
}

/* ============================================================
   MODAL: TEAM DETAIL
   ============================================================ */
function teamMatches(code){
  return ALL_MATCHES.concat(KNOCKOUT).filter(m=>m.home===code||m.away===code)
    .sort((a,b)=>matchDateTime(a)-matchDateTime(b));
}
function openTeamModal(code){
  const t=T(code);
  const ms=teamMatches(code);
  const off = t.official || (SQUADS[code]&&SQUADS[code].official);
  let html=`<div class="modal-head team-head">
    <button class="modal-close" onclick="WC.closeModal()">×</button>
    <div class="mh-top"><span class="mh-flag">${t.flag}</span>
    <div class="mh-info"><h2>${esc(t.name)}</h2>
    <div class="mh-sub">${esc(t.nick||"")}</div>
    <div class="mh-chips">
      <span class="mh-chip grp">Bảng ${t.group}</span>
      ${t.fifa?`<span class="mh-chip fifa">FIFA #${t.fifa}</span>`:""}
      <span class="mh-chip">${t.conf}</span>
      ${t.host?'<span class="mh-chip host">🏟️ Chủ nhà</span>':""}
      ${off?'<span class="mh-chip off">✓ Chính thức</span>':""}
    </div></div></div>
  </div><div class="modal-body">`;

  if(t.detail){
    if(t.summary) html+=`<div class="team-summary">${esc(t.summary)}</div>`;
    // stat cards: HLV / đội trưởng / sân
    const stats=[];
    if(t.coach) stats.push(["HLV", t.coach]);
    if(t.captain) stats.push(["Đội trưởng", t.captain]);
    if(t.stadium) stats.push(["Sân nhà", t.stadium]);
    if(stats.length){
      html+=`<div class="stat-cards">${stats.map(([k,v])=>`<div class="stat-card"><div class="sc-k">${k}</div><div class="sc-v">${esc(v)}</div></div>`).join("")}</div>`;
    }
    // info dạng hàng cho nội dung dài
    if(t.qualification||t.wcHistory){
      html+=`<div class="info-list">`;
      if(t.qualification) html+=infoRow("Vòng loại",t.qualification);
      if(t.wcHistory) html+=infoRow("Thành tích WC",t.wcHistory);
      html+=`</div>`;
    }
  } else {
    html+=`<div class="no-detail">Hồ sơ giới thiệu của đội này đang được bổ sung dần.<br>Bạn vẫn có thể nhập <b>danh sách chính thức</b> bên dưới khi đội công bố.</div>`;
  }

  // ----- Đội hình (dùng override nếu có) -----
  const sq=getSquad(code), meta=squadMeta(code);
  let badge="";
  if(meta.official) badge=`<span class="squad-badge official">✓ Chính thức${meta.updated?" · "+esc(meta.updated):""}</span>`;
  else if(meta.edited) badge=`<span class="squad-badge edited">✎ Đã cập nhật${meta.updated?" · "+esc(meta.updated):""}</span>`;
  else if(Object.keys(sq).length) badge=`<span class="squad-badge">Dự kiến</span>`;
  html+=`<div class="mb-block"><h4>Đội hình ${badge} <button class="btn squad-edit-btn" data-editsquad="${code}" style="margin-left:auto;padding:5px 10px;font-size:11px">✏️ Cập nhật</button></h4>`;
  if(Object.keys(sq).length){
    html+=`<div class="squad-wrap">`;
    for(const pos in sq){
      html+=`<div class="pos-group">
        <div class="pos-head"><span class="pos-ic">${posIcon(pos)}</span> ${esc(pos)} <span class="pos-count">${sq[pos].length}</span></div>
        <div class="player-rows">${sq[pos].map(p=>{
          const {name,club}=splitPlayer(p);
          return `<div class="player-row"><span class="pl-name">${esc(name)}</span>${club?`<span class="pl-club">${esc(club)}</span>`:""}</div>`;
        }).join("")}</div>
      </div>`;
    }
    html+=`</div>`;
  } else {
    html+=`<p class="muted tiny" style="padding:8px 0">Chưa có đội hình. Bấm "Cập nhật" để nhập danh sách khi đội công bố.</p>`;
  }
  html+=`</div>`;

  if(t.detail){
    if(t.keyPlayers&&t.keyPlayers.length){
      html+=`<div class="mb-block"><h4>Cầu thủ nổi bật</h4><ul class="key-list">${t.keyPlayers.map(p=>`<li>${esc(p)}</li>`).join("")}</ul></div>`;
    }
    if(t.prediction){
      html+=`<div class="mb-block"><h4>Dự đoán</h4><div class="pred-box">${esc(t.prediction)}</div></div>`;
    }
  }
  // lịch của đội
  html+=`<div class="mb-block"><h4>Lịch thi đấu</h4>${ms.map(rowMatch).join("")}</div>`;
  html+=`</div>`;
  showModal(html);
  bindMatchRows(document.getElementById("modalContent"));
  const editBtn=document.querySelector("[data-editsquad]");
  if(editBtn) editBtn.onclick=()=>openSquadEditor(code);
}

/* ============================================================
   MODAL: SQUAD EDITOR — cập nhật đội hình / danh sách chính thức
   ============================================================ */
function openSquadEditor(code){
  const t=T(code), sq=getSquad(code), meta=squadMeta(code);
  const text=Object.keys(sq).length?squadToText(sq):"Thủ môn: \nHậu vệ: \nTiền vệ: \nTiền đạo: ";
  const total=Object.values(sq).reduce((s,a)=>s+a.length,0);
  let html=`<div class="modal-head">
    <button class="modal-close" onclick="WC.closeModal()">×</button>
    <div class="mh-top"><span class="mh-flag">${t.flag}</span>
    <div><h2>Cập nhật đội hình</h2><div class="mh-sub">${esc(t.name)} · hiện có ${total} cầu thủ</div></div></div>
  </div><div class="modal-body">
    <p class="muted tiny" style="margin-bottom:10px">Mỗi dòng một vị trí, theo mẫu <span class="kbd">Vị trí: Cầu thủ A, Cầu thủ B</span>. Cách nhau bằng dấu phẩy. Khi đội công bố danh sách chính thức, tick ô bên dưới.</p>
    <textarea id="squadText" class="squad-textarea" spellcheck="false">${esc(text)}</textarea>
    <label class="official-check"><input type="checkbox" id="squadOfficial" ${meta.official?"checked":""}> Đây là <b>danh sách chính thức</b> đã công bố</label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
      <button class="btn btn-gold" id="saveSquad">💾 Lưu đội hình</button>
      ${meta.edited?'<button class="btn" id="resetSquad">↺ Khôi phục bản gốc</button>':""}
      <button class="btn" id="backTeam">← Quay lại</button>
    </div>
    <p class="muted tiny" style="margin-top:12px">Thay đổi được lưu tạm trên trình duyệt của bạn. Để cập nhật cho mọi người, sửa file dữ liệu trên kho lưu trữ.</p>
  </div>`;
  showModal(html);
  document.getElementById("saveSquad").onclick=async()=>{
    const parsed=textToSquad(document.getElementById("squadText").value);
    if(!Object.keys(parsed).length){ toast("⚠️ Chưa có dữ liệu hợp lệ"); return; }
    SQUADS[code]={ squad:parsed, official:document.getElementById("squadOfficial").checked, updated:todayStr() };
    await saveSquads(); toast("✅ Đã lưu đội hình"); openTeamModal(code);
  };
  const rb=document.getElementById("resetSquad");
  if(rb) rb.onclick=async()=>{ delete SQUADS[code]; await saveSquads(); toast("↺ Đã khôi phục bản gốc"); openTeamModal(code); };
  document.getElementById("backTeam").onclick=()=>openTeamModal(code);
}
function todayStr(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function infoRow(k,v){ return `<div class="info-row"><span class="k">${esc(k)}</span><span>${esc(v)}</span></div>`; }

/* ============================================================
   MODAL: MATCH (nhập tỉ số)
   ============================================================ */
function openMatchModal(id){
  const m=matchById(id); if(!m) return;
  const h=T(m.home),a=T(m.away),sc=getScore(m);
  const known = m.home && m.away;
  let html=`<div class="modal-head">
    <button class="modal-close" onclick="WC.closeModal()">×</button>
    <div class="mh-sub" style="margin-bottom:6px">${ROUND_LABEL[m.round]||""}${m.group?` · Bảng ${m.group}`:""} · ${fmtDate(m)} · ${m.timeVN} (giờ VN)</div>
    <div class="mh-sub">${esc(m.venue||"")}${m.note?` · ${esc(m.note)}`:""}</div>
  </div><div class="modal-body">`;
  if(known){
    const scoreHtml = currentView === "home" ? `
      <div class="score-edit">
        <input type="number" min="0" max="99" id="scoreH" value="${sc?sc.hs:""}" placeholder="-">
        <span class="sc-vs">:</span>
        <input type="number" min="0" max="99" id="scoreA" value="${sc?sc.as:""}" placeholder="-">
      </div>` : `<div class="score-edit"><span style="font-family:'Anton',sans-serif;font-size:22px">${sc?`${sc.hs} : ${sc.as}`:"- : -"}</span></div>`;
    html+=`<div class="match-modal-teams">
      <div class="mmt-side"><span class="fl">${h.flag}</span><div class="nm">${esc(h.name)}</div></div>
      ${scoreHtml}
      <div class="mmt-side"><span class="fl">${a.flag}</span><div class="nm">${esc(a.name)}</div></div>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      ${currentView === "home" ? `<button class="btn btn-gold" id="saveScore">💾 Lưu kết quả</button>${sc?'<button class="btn" id="clearScore">🗑 Xóa kết quả</button>':""}` : ""}
      <button class="btn" data-h2h="${m.home}|${m.away}">⚔️ So sánh đội hình</button>
    </div>
    ${currentView === "home" ? `<p class="muted tiny" style="text-align:center;margin-top:12px">Lưu xong, Bảng xếp hạng sẽ tự cập nhật (chỉ trên trình duyệt của bạn).</p>` : ""}`;
  } else {
    html+=`<div class="no-detail">Cặp đấu vòng knockout này phụ thuộc kết quả vòng trước.<br>${esc(m.homeRef||"")} vs ${esc(m.awayRef||"")}</div>`;
  }
  html+=`</div>`;
  showModal(html);
  if(known){
    if(currentView === "home"){
      document.getElementById("saveScore").onclick=async()=>{
        const hs=parseInt(document.getElementById("scoreH").value,10);
        const as=parseInt(document.getElementById("scoreA").value,10);
        if(isNaN(hs)||isNaN(as)||hs<0||as<0){ toast("⚠️ Nhập tỉ số hợp lệ"); return; }
        RESULTS[m.id]={hs,as}; await saveResults(); closeModal(); toast("✅ Đã lưu kết quả");
        refreshAll();
      };
      const cs=document.getElementById("clearScore");
      if(cs) cs.onclick=async()=>{ delete RESULTS[m.id]; await saveResults(); closeModal(); toast("🗑 Đã xóa"); refreshAll(); };
    }
    const h2hBtn=document.querySelector("[data-h2h]");
    if(h2hBtn) h2hBtn.onclick=()=>{ closeModal(); const[x,y]=h2hBtn.dataset.h2h.split("|"); switchView("h2h"); setTimeout(()=>doH2H(x,y),50); };
  }
}

/* ============================================================
   RENDER: H2H
   ============================================================ */
function renderH2H(){
  const el=document.getElementById("view-h2h");
  const opts=Object.values(TEAMS).sort((a,b)=>a.name.localeCompare(b.name))
    .map(t=>`<option value="${t.code}">${t.flag} ${esc(t.name)}</option>`).join("");
  el.innerHTML=`
    <div class="sec-title"><span class="bar"></span><h2>So sánh & Đối đầu</h2></div>
    <div class="h2h-pick">
      <select class="h2h-select" id="h2hA"><option value="">— Chọn đội 1 —</option>${opts}</select>
      <span class="vs-mid">VS</span>
      <select class="h2h-select" id="h2hB"><option value="">— Chọn đội 2 —</option>${opts}</select>
    </div>
    <div class="h2h-result" id="h2hResult"></div>`;
  const A=document.getElementById("h2hA"),B=document.getElementById("h2hB");
  A.onchange=B.onchange=()=>{ if(A.value&&B.value&&A.value!==B.value) doH2H(A.value,B.value); };
}
function doH2H(ca,cb){
  document.getElementById("h2hA").value=ca; document.getElementById("h2hB").value=cb;
  const a=T(ca),b=T(cb);
  const box=document.getElementById("h2hResult"); box.classList.add("show");
  // có cùng bảng không + có trận chung không
  const common = ALL_MATCHES.concat(KNOCKOUT).filter(m=>(m.home===ca&&m.away===cb)||(m.home===cb&&m.away===ca));
  let banner=`<div class="h2h-banner">
    <div class="h2h-side"><span class="fl">${a.flag}</span><div class="nm">${esc(a.name)}</div><div class="meta">Bảng ${a.group} · ${a.conf}${a.fifa?` · #${a.fifa}`:""}</div></div>
    <div class="h2h-mid">VS</div>
    <div class="h2h-side"><span class="fl">${b.flag}</span><div class="nm">${esc(b.name)}</div><div class="meta">Bảng ${b.group} · ${b.conf}${b.fifa?` · #${b.fifa}`:""}</div></div>
  </div>`;
  if(common.length){
    banner+=`<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>📅 Chạm trán tại WC 2026</h3></div>${common.map(rowMatch).join("")}</div>`;
  } else {
    banner+=`<p class="muted tiny" style="text-align:center;margin-bottom:16px">Hai đội không cùng bảng — chỉ có thể gặp nhau ở vòng knockout.</p>`;
  }
  // hai cột thông tin / đội hình
  banner+=`<div class="h2h-cols">${[a,b].map(t=>{
    let c=`<div class="card"><div class="card-h"><h3>${t.flag} ${esc(t.name)}</h3></div>`;
    if(t.detail){
      if(t.coach)c+=`<div class="info-row"><span class="k">HLV</span><span>${esc(t.coach)}</span></div>`;
      if(t.captain)c+=`<div class="info-row"><span class="k">Đội trưởng</span><span>${esc(t.captain)}</span></div>`;
      if(t.keyPlayers)c+=`<div class="mb-block"><h4>Cầu thủ nổi bật</h4><ul class="key-list">${t.keyPlayers.slice(0,4).map(p=>`<li>${esc(p)}</li>`).join("")}</ul></div>`;
    } else { c+=`<p class="muted tiny" style="padding:10px 0">Hồ sơ giới thiệu đang bổ sung.</p>`; }
    const sq=getSquad(t.code), meta=squadMeta(t.code);
    if(Object.keys(sq).length){
      const tag=meta.official?' <span class="squad-badge official">✓ Chính thức</span>':(meta.edited?' <span class="squad-badge edited">✎</span>':"");
      c+=`<div class="mb-block"><h4>Đội hình${tag}</h4><div class="squad-wrap">`;
      for(const pos in sq){
        c+=`<div class="pos-group"><div class="pos-head"><span class="pos-ic">${posIcon(pos)}</span> ${esc(pos)} <span class="pos-count">${sq[pos].length}</span></div><div class="player-rows">${sq[pos].map(p=>{const {name,club}=splitPlayer(p);return `<div class="player-row"><span class="pl-name">${esc(name)}</span>${club?`<span class="pl-club">${esc(club)}</span>`:""}</div>`;}).join("")}</div></div>`;
      }
      c+=`</div></div>`;
    }
    c+=`<button class="btn" style="margin-top:10px;width:100%;justify-content:center" onclick="WC.openTeam('${t.code}')">Xem hồ sơ đầy đủ →</button></div>`;
    return c;
  }).join("")}</div>`;
  box.innerHTML=banner;
}

/* ============================================================
   RENDER: SCORERS / ASSISTS
   ============================================================ */
let scorerTab="goals";
function renderScorers(){
  const el=document.getElementById("view-scorers");
  el.innerHTML=`
    <div class="sec-title"><span class="bar"></span><h2>Vua phá lưới & Kiến tạo</h2></div>
    <div class="filters">
      <button class="chip ${scorerTab==="goals"?"active":""}" data-t="goals">⚽ Ghi bàn</button>
      <button class="chip ${scorerTab==="assists"?"active":""}" data-t="assists">🅰️ Kiến tạo</button>
    </div>
    <div class="add-form">
      <input id="sfName" placeholder="Tên cầu thủ">
      <select id="sfTeam">${Object.values(TEAMS).sort((a,b)=>a.name.localeCompare(b.name)).map(t=>`<option value="${t.code}">${t.flag} ${esc(t.name)}</option>`).join("")}</select>
      <input id="sfVal" type="number" min="0" value="1" title="Số bàn/kiến tạo">
      <button class="btn btn-gold" id="sfAdd">+ Thêm</button>
    </div>
    <div id="rankList"></div>`;
  el.querySelectorAll(".chip").forEach(c=>c.onclick=()=>{scorerTab=c.dataset.t;renderScorers();});
  document.getElementById("sfAdd").onclick=addScorer;
  drawRank();
}
function drawRank(){
  const key=scorerTab==="goals"?"goals":"assists";
  const list=SCORERS.filter(s=>(s[key]||0)>0).sort((a,b)=>b[key]-a[key]);
  const box=document.getElementById("rankList");
  if(!list.length){ box.innerHTML=`<div class="empty-state"><div class="es-ic">${scorerTab==="goals"?"⚽":"🅰️"}</div>Chưa có dữ liệu. Thêm cầu thủ ở trên — dữ liệu lưu trong trình duyệt và xuất được ra JSON.</div>`; return; }
  box.innerHTML=`<div class="rank-list">${list.map((s,i)=>{
    const t=T(s.team);
    return `<div class="rank-item"><div class="rank-num">${i+1}</div>
      <div class="rank-info"><b>${esc(s.name)}</b><span>${t.flag} ${esc(t.name)}</span></div>
      <div style="display:flex;align-items:center;gap:14px"><span class="rank-val">${s[key]}</span>
      <button class="btn" style="padding:5px 9px" onclick="WC.delScorer(${SCORERS.indexOf(s)})">✕</button></div></div>`;
  }).join("")}</div>`;
}
async function addScorer(){
  const name=document.getElementById("sfName").value.trim();
  const team=document.getElementById("sfTeam").value;
  const val=parseInt(document.getElementById("sfVal").value,10)||0;
  if(!name){ toast("⚠️ Nhập tên cầu thủ"); return; }
  const key=scorerTab==="goals"?"goals":"assists";
  let ex=SCORERS.find(s=>s.name.toLowerCase()===name.toLowerCase()&&s.team===team);
  if(ex){ ex[key]=val; } else { const o={name,team,goals:0,assists:0}; o[key]=val; SCORERS.push(o); }
  await saveScorers(); document.getElementById("sfName").value=""; drawRank(); toast("✅ Đã cập nhật");
}

/* ============================================================
   RENDER: NEWS
   ============================================================ */
function renderNews(){
  const el=document.getElementById("view-news");
  const news=(NEWS.news||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  el.innerHTML=`
    <div class="sec-title"><span class="bar"></span><h2>Tin tức giải đấu</h2></div>
    <div class="news-list">${news.map(n=>`
      <div class="news-item">
        <div class="news-meta"><span class="news-tag">${esc(n.tag)}</span><span class="news-date">${esc(n.date)}</span></div>
        <h3>${esc(n.title)}</h3><p>${esc(n.body)}</p>
      </div>`).join("")}</div>`;
}

/* ============================================================
   MODAL helpers
   ============================================================ */
function showModal(html){ document.getElementById("modalContent").innerHTML=html; document.getElementById("modalBg").classList.add("open"); }
function closeModal(){ document.getElementById("modalBg").classList.remove("open"); }
document.getElementById("modalBg").onclick=e=>{ if(e.target.id==="modalBg") closeModal(); };
document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeModal(); });

/* ============================================================
   IMPORT / EXPORT JSON
   ============================================================ */
function exportJSON(){
  const out={
    _meta:{tournament:"FIFA World Cup 2026",exported:new Date().toISOString(),note:"File cập nhật — gồm kết quả, vua phá lưới, đội hình. Nhập lại bằng nút Nhập."},
    results:RESULTS, scorers:SCORERS, squads:SQUADS
  };
  const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download="wc2026-ket-qua.json"; a.click();
  URL.revokeObjectURL(url); toast("⬇ Đã xuất file kết quả");
}
function importJSON(file){
  const r=new FileReader();
  r.onload=async()=>{
    try{
      const d=JSON.parse(r.result);
      if(d.results) RESULTS=d.results;
      if(d.scorers) SCORERS=d.scorers;
      if(d.squads) SQUADS=d.squads;
      await saveResults(); await saveScorers(); await saveSquads();
      refreshAll(); toast("⬆ Đã nhập dữ liệu");
    }catch(e){ toast("⚠️ File không hợp lệ"); }
  };
  r.readAsText(file);
}

/* ============================================================
   GLOBAL refresh
   ============================================================ */
const RENDERERS={home:renderHome,schedule:renderSchedule,standings:renderStandings,teams:renderTeams,h2h:renderH2H,scorers:renderScorers,news:renderNews};
function refreshAll(){
  const active=document.querySelector(".view.active");
  if(active){ const id=active.id.replace("view-",""); RENDERERS[id]&&RENDERERS[id](); }
}

// API công khai cho onclick inline
window.WC={ closeModal, openTeam:openTeamModal, delScorer:async(i)=>{ SCORERS.splice(i,1); await saveScorers(); drawRank(); } };

/* ============================================================
   FETCH DỮ LIỆU TỪ SERVER (cách B)
   - Khi deploy: app đọc data/*.json cùng thư mục → mọi người xem chung.
   - Nếu fetch lỗi (mở file offline, hoặc xem trong Claude): dùng bản nhúng.
   - data/results.json (tùy chọn) chứa kết quả + đội hình cập nhật → ưu tiên hiển thị chung.
   ============================================================ */
let SERVER_RESULTS = null; // kết quả lấy từ server (chung cho mọi người)
async function fetchData(){
  // chỉ fetch khi chạy qua http(s); mở file:// trực tiếp sẽ bị chặn → bỏ qua, dùng bản nhúng
  if(typeof location==="undefined" || !/^https?:$/.test(location.protocol)) return;
  async function tryJSON(path){
    try{ const r=await fetch(path,{cache:"no-store"}); if(!r.ok) return null; return await r.json(); }
    catch(e){ return null; }
  }
  const [teams,matches,news,results] = await Promise.all([
    tryJSON("data/teams.json"),
    tryJSON("data/matches.json"),
    tryJSON("data/news.json"),
    tryJSON("data/results.json")
  ]);
  if(teams && teams.teams) TEAMS = teams.teams;
  if(matches && matches.matches){ ALL_MATCHES = matches.matches.slice(); KNOCKOUT = (matches.knockout||[]).slice(); }
  if(news && news.news) NEWS = news;
  // results.json: kết quả + đội hình do bạn cập nhật, áp cho mọi người
  if(results){
    SERVER_RESULTS = results;
    if(results.results) RESULTS = Object.assign({}, results.results);
    if(results.scorers) SCORERS = results.scorers.slice();
    if(results.squads)  SQUADS  = Object.assign({}, results.squads);
  }
}

/* ============================================================
   THEME (Sáng/Tối)
   ============================================================ */
const THEME_KEY="wc2026_theme";
function applyTheme(t){
  if(t==="light") document.documentElement.setAttribute("data-theme","light");
  else document.documentElement.removeAttribute("data-theme");
  const btn=document.getElementById("btnTheme");
  if(btn) btn.textContent = (t==="light") ? "☀️" : "🌙";
}
function getSavedTheme(){
  try{ return localStorage.getItem(THEME_KEY); }catch(e){ return null; }
}
function saveTheme(t){ try{ localStorage.setItem(THEME_KEY,t); }catch(e){} }
function initTheme(){
  // ưu tiên lựa chọn đã lưu của người dùng; nếu chưa có thì MẶC ĐỊNH giao diện SÁNG
  let t=getSavedTheme();
  if(!t) t="light";
  applyTheme(t);
  const btn=document.getElementById("btnTheme");
  if(btn) btn.onclick=()=>{
    const cur=document.documentElement.getAttribute("data-theme")==="light"?"light":"dark";
    const next=cur==="light"?"dark":"light";
    applyTheme(next); saveTheme(next);
  };
}

/* ============================================================
   INIT
   ============================================================ */
async function init(){
  initTheme();         // 0) áp theme trước để tránh nhấp nháy
  await fetchData();   // 1) lấy dữ liệu chung từ server (nếu deploy)
  // 2) Nếu server CÓ results.json → đó là bản chung chính thức, không để localStorage cá nhân ghi đè.
  //    Nếu KHÔNG có → quay về chế độ cá nhân (mỗi người tự nhập, lưu localStorage).
  if(!SERVER_RESULTS) await loadState();
  renderNav();
  document.querySelector('.nav-btn[data-view="home"]').classList.add("active");
  renderHome();
  document.getElementById("btnExport").onclick=exportJSON;
  document.getElementById("btnImport").onclick=()=>document.getElementById("fileInput").click();
  document.getElementById("fileInput").onchange=e=>{ if(e.target.files[0]) importJSON(e.target.files[0]); e.target.value=""; };
}
init();
})();
