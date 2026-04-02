Chart.register(ChartZoom);

// ── STATE ──────────────────────────────────────────────────────────────────
let selectedStock = "AAPL";
let cash = 100_000;
let holdings = {};
let portfolioHistory = [];
let portfolioLabels  = [];
let totalTrades = 0;
let startingNW  = 100_000;
let investorData = { name:'', id:'', tax:'', risk:'', role:'Quant Trader', target:15, goal:200000 };

let stocks = [
  { name:"AAPL", fullName:"Apple Inc.",      price:175.00, prevPrice:175.00, open:175.00 },
  { name:"TSLA", fullName:"Tesla Inc.",      price:248.00, prevPrice:248.00, open:248.00 },
  { name:"GOOG", fullName:"Alphabet Inc.",   price:165.00, prevPrice:165.00, open:165.00 },
  { name:"MSFT", fullName:"Microsoft Corp.", price:415.00, prevPrice:415.00, open:415.00 },
  { name:"NVDA", fullName:"NVIDIA Corp.",    price:880.00, prevPrice:880.00, open:880.00 },
];

let priceHistory = {};
stocks.forEach(s => priceHistory[s.name] = [s.price]);

// ── YAHOO PRICE FETCH ──────────────────────────────────────────────────────
async function fetchYahooPrice(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`;
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res  = await fetch(proxy, { signal: AbortSignal.timeout(4000) });
    const json = await res.json();
    const data = JSON.parse(json.contents);
    const closes = data.chart.result[0].indicators.quote[0].close;
    return closes.filter(Boolean).pop() ?? null;
  } catch { return null; }
}

async function syncYahooPrices() {
  for (const s of stocks) {
    const live = await fetchYahooPrice(s.name);
    if (live && live > 0) {
      s.prevPrice = s.price; s.price = live;
      priceHistory[s.name].push(s.price);
      if (priceHistory[s.name].length > 120) priceHistory[s.name].shift();
    }
  }
  renderMarket(); updateSelectedChart();
}
syncYahooPrices();
setInterval(syncYahooPrices, 60_000);

// ── GBM SIMULATION ─────────────────────────────────────────────────────────
const mu = 0.0003, sigma = 0.012;

function rng() {
  let u=0, v=0;
  while(!u) u=Math.random();
  while(!v) v=Math.random();
  return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v);
}

function updatePrices() {
  const dt = 1/252;
  stocks.forEach(s => {
    s.prevPrice = s.price;
    s.price *= Math.exp((mu - 0.5*sigma*sigma)*dt + sigma*Math.sqrt(dt)*rng());
    if (Math.random() < 0.005) s.price *= 0.92;
    priceHistory[s.name].push(s.price);
    if (priceHistory[s.name].length > 120) priceHistory[s.name].shift();
  });

  renderMarket(); updateSelectedChart();

  const nw = netWorth();
  portfolioHistory.push(nw);
  portfolioLabels.push(new Date().toLocaleTimeString());
  if (portfolioHistory.length > 200) { portfolioHistory.shift(); portfolioLabels.shift(); }

  portfolioChart.data.labels = portfolioLabels;
  portfolioChart.data.datasets[0].data = portfolioHistory;
  portfolioChart.update('none');

  analyticsPortChart.data.labels = portfolioLabels;
  analyticsPortChart.data.datasets[0].data = portfolioHistory;
  analyticsPortChart.update('none');

  calculateRiskMetrics();
  renderHoldings();
  updateTopBar();
  updateAllocationChart();
  updateMiniStats();
  updateInvestorPage();
  updatePerfCards();
}
setInterval(updatePrices, 1000);

// ── CHARTS ─────────────────────────────────────────────────────────────────
const zoomOpts = {
  zoom: { wheel:{enabled:true}, pinch:{enabled:true}, mode:'x' },
  pan:  { enabled:true, mode:'x' }
};

const cDefaults = {
  responsive: true,
  animation: false,
  plugins: {
    legend: { display:false },
    zoom: zoomOpts,
    tooltip: {
      mode:'index', intersect:false,
      backgroundColor:'#0c1225', borderColor:'#1a2d4a', borderWidth:1,
      titleColor:'#7b93b8', bodyColor:'#e4edf8',
      bodyFont: { family:'Space Mono' },
      callbacks: { label: ctx => ` $${ctx.parsed.y.toFixed(2)}` }
    }
  }
};

const priceChart = new Chart(document.getElementById("priceChart").getContext("2d"), {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "Price", data: [],
      borderColor: "#00d4ff", backgroundColor: "rgba(0,212,255,0.07)",
      fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2
    }]
  },
  options: {
    ...cDefaults,
    scales: {
      x: { display:true, ticks:{color:'#3a5070',font:{size:10}}, grid:{color:'rgba(26,45,74,0.5)'} },
      y: { display:true, ticks:{color:'#3a5070',font:{family:'Space Mono',size:10},callback:v=>'$'+v.toFixed(0)}, grid:{color:'rgba(26,45,74,0.5)'} }
    }
  }
});

const portfolioChart = new Chart(document.getElementById("portfolioChart").getContext("2d"), {
  type: "line",
  data: {
    labels: portfolioLabels,
    datasets: [{
      label: "Net Worth", data: portfolioHistory,
      borderColor: "#05d98a", backgroundColor: "rgba(5,217,138,0.07)",
      fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2
    }]
  },
  options: {
    ...cDefaults,
    scales: {
      x: { display:false },
      y: { display:true, ticks:{color:'#3a5070',font:{family:'Space Mono',size:10},callback:v=>'$'+v.toFixed(0)}, grid:{color:'rgba(26,45,74,0.5)'} }
    }
  }
});

const analyticsPortChart = new Chart(document.getElementById("analyticsPortChart").getContext("2d"), {
  type: "line",
  data: {
    labels: portfolioLabels,
    datasets: [{
      label: "Net Worth", data: portfolioHistory,
      borderColor: "#4f8ef7", backgroundColor: "rgba(79,142,247,0.08)",
      fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2
    }]
  },
  options: {
    ...cDefaults,
    scales: {
      x: { display:false },
      y: { display:true, ticks:{color:'#3a5070',font:{family:'Space Mono',size:10},callback:v=>'$'+v.toFixed(0)}, grid:{color:'rgba(26,45,74,0.5)'} }
    }
  }
});

const allocationChart = new Chart(document.getElementById("allocationChart").getContext("2d"), {
  type: "doughnut",
  data: {
    labels: ["Cash"],
    datasets: [{ data:[100], backgroundColor:["#1a2d4a"], borderColor:"#070b18", borderWidth:2 }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { display:true, position:'bottom', labels:{color:'#7b93b8',font:{family:'Plus Jakarta Sans',size:10},boxWidth:10,padding:8} },
      zoom: { zoom:{ wheel:{enabled:false} } }
    }
  }
});

const allocColors = ["#4f8ef7","#05d98a","#fbbf24","#f0506e","#a78bfa","#fb923c"];

function updateAllocationChart() {
  const labels = ["Cash"], data = [cash];
  stocks.forEach(s => {
    const sh = holdings[s.name] || 0;
    if (sh > 0) { labels.push(s.name); data.push(sh * s.price); }
  });
  allocationChart.data.labels = labels;
  allocationChart.data.datasets[0].data = data;
  allocationChart.data.datasets[0].backgroundColor = labels.map((_,i) => i===0 ? "#1a2d4a" : allocColors[(i-1) % allocColors.length]);
  allocationChart.update('none');
}

// ── MARKET RENDER ──────────────────────────────────────────────────────────
let marketBuilt = false;
const stockColors = { AAPL:"#4f8ef7", TSLA:"#f0506e", GOOG:"#05d98a", MSFT:"#fbbf24", NVDA:"#a78bfa" };

function renderMarket() {
  const container = document.getElementById("market");
  if (!marketBuilt) {
    container.innerHTML = stocks.map((s, i) => {
      const cls = s.name === selectedStock ? "stock-card animate-in active" : "stock-card animate-in";
      const col = stockColors[s.name] || "#4f8ef7";
      return `<div class="${cls}" id="sc-${s.name}" style="animation-delay:${i*0.07}s" onclick="selectStock('${s.name}')">
        <div class="sc-row">
          <div><div class="sc-ticker">${s.name}</div><div class="sc-name">${s.fullName}</div></div>
          <div style="text-align:right">
            <div class="sc-price" id="sc-price-${s.name}">$${s.price.toFixed(2)}</div>
            <div class="sc-chg up" id="sc-chg-${s.name}">▲ 0.00%</div>
          </div>
        </div>
        <div class="sc-bar"><div class="sc-bar-fill" id="sc-bar-${s.name}" style="width:50%;background:${col}"></div></div>
        <div class="sc-actions">
          <button class="btn-buy"  onclick="event.stopPropagation();buy('${s.name}')">BUY</button>
          <button class="btn-sell" onclick="event.stopPropagation();sell('${s.name}')">SELL</button>
        </div>
      </div>`;
    }).join("");
    marketBuilt = true;
    return;
  }

  stocks.forEach(s => {
    const card = document.getElementById(`sc-${s.name}`);
    const pEl  = document.getElementById(`sc-price-${s.name}`);
    const cEl  = document.getElementById(`sc-chg-${s.name}`);
    const bEl  = document.getElementById(`sc-bar-${s.name}`);
    if (!card || !pEl || !cEl) return;
    const chg = (s.price - s.prevPrice), pct = (chg / s.prevPrice) * 100, up = chg >= 0;
    pEl.textContent = `$${s.price.toFixed(2)}`;
    cEl.textContent = `${up?'▲':'▼'} ${Math.abs(pct).toFixed(2)}%`;
    cEl.className   = `sc-chg ${up?'up':'dn'}`;
    const dayChg = ((s.price - s.open) / s.open) * 100;
    if (bEl) bEl.style.width = Math.min(100, Math.max(0, 50 + dayChg * 5)) + '%';
    card.classList.toggle('active', s.name === selectedStock);
  });
}

function selectStock(name) {
  selectedStock = name;
  priceChart.data.labels = priceHistory[name].map((_,i) => i);
  priceChart.data.datasets[0].data = [...priceHistory[name]];
  priceChart.resetZoom();
  priceChart.update();
  document.getElementById("priceChartTitle").textContent = `${name} — Price`;
  renderMarket();
}

function updateSelectedChart() {
  const h = priceHistory[selectedStock];
  priceChart.data.labels = h.map((_,i) => i);
  priceChart.data.datasets[0].data = [...h];
  priceChart.update('none');
}

// ── PERFORMANCE CARDS ──────────────────────────────────────────────────────
function updatePerfCards() {
  const c = document.getElementById("perfCards");
  if (!c) return;
  c.innerHTML = stocks.map((s, i) => {
    const chg = ((s.price - s.open) / s.open) * 100, up = chg >= 0, sh = holdings[s.name] || 0;
    const col = stockColors[s.name] || "#4f8ef7";
    return `<div class="metric-box" style="animation-delay:${i*0.05}s">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-family:var(--mono);font-size:0.88rem;color:${col};font-weight:700;">${s.name}</span>
        <span style="font-size:0.66rem;padding:2px 7px;border-radius:20px;
          background:${up?'rgba(5,217,138,0.1)':'rgba(240,80,110,0.1)'};
          color:${up?'var(--green)':'var(--red)'};
          border:1px solid ${up?'rgba(5,217,138,0.25)':'rgba(240,80,110,0.25)'};">
          ${up?'▲':'▼'} ${Math.abs(chg).toFixed(2)}%
        </span>
      </div>
      <div style="font-family:var(--mono);font-size:1.15rem;color:var(--text);font-weight:700;">$${s.price.toFixed(2)}</div>
      <div style="font-size:0.7rem;color:var(--sub);margin-top:4px;">${sh} shares · $${(sh*s.price).toFixed(0)} value</div>
      <div class="sc-bar" style="margin-top:10px;">
        <div style="height:100%;border-radius:2px;background:${col};width:${Math.min(100,Math.max(5,50+chg*5))}%;transition:width 0.5s;"></div>
      </div>
    </div>`;
  }).join("");
}

// ── PORTFOLIO ──────────────────────────────────────────────────────────────
function netWorth()      { return cash + stocks.reduce((t,s) => t + (holdings[s.name]||0) * s.price, 0); }
function investedValue() { return stocks.reduce((t,s) => t + (holdings[s.name]||0) * s.price, 0); }

function buy(name) {
  const s = stocks.find(s => s.name === name);
  if (cash >= s.price) {
    cash -= s.price;
    holdings[name] = (holdings[name] || 0) + 1;
    totalTrades++;
    showToast(`✅ Bought 1 × ${name} @ $${s.price.toFixed(2)}`);
    pushNotif(`Bought 1 share of ${name} @ $${s.price.toFixed(2)}`, 'buy');
    renderHoldings(); updateTopBar(); updateAllocationChart(); updateMiniStats(); updateInvestorPage();
  } else {
    showToast("❌ Insufficient cash!", true);
  }
}

function sell(name) {
  const s = stocks.find(s => s.name === name);
  if ((holdings[name] || 0) > 0) {
    holdings[name]--;
    cash += s.price;
    if (holdings[name] === 0) delete holdings[name];
    totalTrades++;
    showToast(`💰 Sold 1 × ${name} @ $${s.price.toFixed(2)}`);
    pushNotif(`Sold 1 share of ${name} @ $${s.price.toFixed(2)}`, 'sell');
    renderHoldings(); updateTopBar(); updateAllocationChart(); updateMiniStats(); updateInvestorPage();
  } else {
    showToast("❌ No shares to sell!", true);
  }
}

// ── NOTIFICATIONS ──────────────────────────────────────────────────────────
const notifLog = [];

function pushNotif(msg, type) {
  notifLog.unshift({ msg, type, time: new Date().toLocaleTimeString() });
  if (notifLog.length > 5) notifLog.pop();
  const area = document.getElementById("notifArea");
  if (!area) return;
  area.innerHTML = notifLog.map(n => `
    <div class="notif" style="border-color:${n.type==='buy'?'rgba(5,217,138,0.3)':n.type==='sell'?'rgba(240,80,110,0.3)':'rgba(251,146,60,0.25)'}">
      <div class="notif-icon">${n.type==='buy'?'📥':'📤'}</div>
      <div>
        <div style="font-size:0.78rem">${n.msg}</div>
        <div style="font-size:0.66rem;color:var(--muted);margin-top:2px">${n.time}</div>
      </div>
    </div>`).join("");
}

// ── HOLDINGS ───────────────────────────────────────────────────────────────
function renderHoldings() {
  const keys = Object.keys(holdings).filter(k => holdings[k] > 0);
  document.getElementById("holdCount").textContent = keys.length;
  ["holdingsList","invHoldingsList"].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    if (!keys.length) { el.innerHTML = '<div class="empty-state">No positions yet</div>'; return; }
    el.innerHTML = keys.map(k => {
      const s   = stocks.find(s => s.name === k);
      const val = (holdings[k] * s.price).toFixed(2);
      const pnl = (holdings[k] * (s.price - s.open)).toFixed(2);
      const pnlC = parseFloat(pnl) >= 0 ? "var(--green)" : "var(--red)";
      return `<div class="holding-row">
        <div>
          <div class="h-ticker">${k}</div>
          <div class="h-shares">${holdings[k]} shares · P&L <span style="color:${pnlC}">$${pnl}</span></div>
        </div>
        <div class="h-value">$${val}</div>
      </div>`;
    }).join("");
  });
}

// ── TOP BAR ────────────────────────────────────────────────────────────────
function updateTopBar() {
  const ts  = Object.values(holdings).reduce((a,b) => a+b, 0);
  const fmt = v => v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  document.getElementById("topCash").textContent   = fmt(cash);
  document.getElementById("topShares").textContent = ts;
  document.getElementById("topNet").textContent    = fmt(netWorth());
}

// ── MINI STATS ─────────────────────────────────────────────────────────────
function updateMiniStats() {
  const nw  = netWorth(), inv = investedValue(), pnl = nw - startingNW;
  const goal = investorData.goal || 200000, pct = Math.min(100, (nw / goal) * 100);
  const fmt  = v => v >= 1000 ? (v/1000).toFixed(1) + 'K' : v.toFixed(0);
  const retPct = ((nw - startingNW) / startingNW) * 100;
  document.getElementById("heroNet").textContent      = fmt(nw);
  document.getElementById("cashMini").textContent     = fmt(cash);
  document.getElementById("investedMini").textContent = fmt(inv);
  document.getElementById("posMini").textContent      = Object.keys(holdings).filter(k => holdings[k] > 0).length;
  document.getElementById("tradesMini").textContent   = totalTrades;
  const pnlEl = document.getElementById("pnlMini");
  pnlEl.textContent  = `$${Math.abs(pnl).toFixed(0)}`;
  pnlEl.style.color  = pnl >= 0 ? "var(--green)" : "var(--red)";
  document.getElementById("investedChg").textContent = `${retPct>=0?'+':''}${retPct.toFixed(2)}%`;
  document.getElementById("investedChg").className   = `sm-chg ${retPct>=0?'up':'dn'}`;
  document.getElementById("goalBar").style.width     = pct + '%';
  document.getElementById("goalPct").textContent     = pct.toFixed(1) + '%';
  document.getElementById("goalTarget").textContent  = `$${(goal/1000).toFixed(0)}K goal`;
}

// ── RISK METRICS ───────────────────────────────────────────────────────────
function calcVol(prices) {
  if (prices.length < 2) return 0;
  const r = [];
  for (let i=1; i<prices.length; i++) r.push(Math.log(prices[i] / prices[i-1]));
  const m = r.reduce((a,b) => a+b, 0) / r.length;
  return Math.sqrt(r.reduce((a,b) => a + (b-m)**2, 0) / r.length) * Math.sqrt(252);
}

function calculateRiskMetrics() {
  if (portfolioHistory.length < 2) return;
  const r = [];
  for (let i=1; i<portfolioHistory.length; i++)
    r.push((portfolioHistory[i] - portfolioHistory[i-1]) / portfolioHistory[i-1]);
  const avg = r.reduce((a,b) => a+b, 0) / r.length;
  const std = Math.sqrt(r.reduce((a,b) => a + (b-avg)**2, 0) / r.length);
  const sharpe = std === 0 ? 0 : (avg / std) * Math.sqrt(252);
  let peak = portfolioHistory[0], maxDD = 0;
  for (const v of portfolioHistory) {
    if (v > peak) peak = v;
    const dd = (v - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  const init = portfolioHistory[0], cur = portfolioHistory[portfolioHistory.length-1];
  const tr = ((cur - init) / init) * 100;
  const retEl = document.getElementById("returnMetric");
  retEl.textContent = tr.toFixed(2) + "%";
  retEl.className   = "m-val " + (tr >= 0 ? "green" : "red");
  document.getElementById("sharpeMetric").textContent   = sharpe.toFixed(2);
  document.getElementById("drawdownMetric").textContent = (maxDD * 100).toFixed(2) + "%";
  document.getElementById("volMetric").textContent      = calcVol(priceHistory[selectedStock]).toFixed(4);
}

// ── INVESTOR PROFILE ───────────────────────────────────────────────────────
function saveInvestor() {
  investorData.name   = document.getElementById("invName").value.trim()   || "Investor";
  investorData.id     = document.getElementById("invId").value.trim();
  investorData.tax    = document.getElementById("invTax").value.trim();
  investorData.risk   = document.getElementById("invRisk").value.trim()   || "Moderate";
  investorData.role   = document.getElementById("invRole").value.trim()   || "Quant Trader";
  investorData.target = parseFloat(document.getElementById("invTarget").value) || 15;
  investorData.goal   = parseFloat(document.getElementById("invGoal").value)   || 200000;
  const initials = investorData.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById("headerAvatar").textContent = initials || "?";
  document.getElementById("headerName").textContent   = investorData.name;
  document.getElementById("headerRole").textContent   = investorData.role;
  showToast("✅ Profile saved!");
  updateInvestorPage(); updateMiniStats();
}

function updateInvestorPage() {
  const nw   = netWorth(), inv = investedValue(), pnl = nw - startingNW, ret = ((nw - startingNW) / startingNW) * 100;
  const goal = investorData.goal || 200000, gpct = Math.min(100, (nw / goal) * 100);
  const fmt  = v => v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const initials = investorData.name ? investorData.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
  document.getElementById("invAvatar").textContent      = initials;
  document.getElementById("invDisplayName").textContent = investorData.name || "—";
  document.getElementById("invNetWorth").textContent    = fmt(nw);
  document.getElementById("invInvested").textContent    = fmt(inv);
  document.getElementById("invCash").textContent        = fmt(cash);
  document.getElementById("invPositions").textContent   = Object.keys(holdings).filter(k => holdings[k] > 0).length;
  document.getElementById("invTrades").textContent      = totalTrades;
  document.getElementById("invRiskDisp").textContent    = investorData.risk || "—";
  document.getElementById("invGoalPct").textContent     = gpct.toFixed(1) + "%";
  document.getElementById("invGoalBar").style.width     = gpct + "%";
  const pnlEl = document.getElementById("invPnl");
  pnlEl.textContent = `${pnl>=0?'+':'-'}$${fmt(Math.abs(pnl))}`;
  pnlEl.style.color = pnl >= 0 ? "var(--green)" : "var(--red)";
  const retEl = document.getElementById("invReturn");
  retEl.textContent = `${ret>=0?'+':''}${ret.toFixed(2)}%`;
  retEl.style.color = ret >= 0 ? "var(--green)" : "var(--red)";
  const badges = [];
  if (investorData.id)  badges.push(`<span class="inv-badge">🪪 ${investorData.id}</span>`);
  if (investorData.tax) badges.push(`<span class="inv-badge">📄 ${investorData.tax}</span>`);
  if (!badges.length)   badges.push(`<span class="inv-badge">📋 No ID set</span>`);
  document.getElementById("invBadges").innerHTML = badges.join('');
}

// ── PAGE SWITCHING ─────────────────────────────────────────────────────────
const pageTitles = { dashboard:"Dashboard", analytics:"Analytics", investor:"Investor Profile" };

function switchPage(name) {
  document.querySelectorAll('.page').forEach(p  => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');
  document.querySelector(`[data-page="${name}"]`).classList.add('active');
  document.getElementById("pageTitle").textContent = pageTitles[name];
  if (name === 'analytics') { updateAllocationChart(); updatePerfCards(); }
  if (name === 'investor')  updateInvestorPage();
}

// ── DATE ───────────────────────────────────────────────────────────────────
function updateDate() {
  document.getElementById("pageDate").textContent =
    new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}
updateDate();
setInterval(updateDate, 60_000);

// ── TOAST ──────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, isError = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.borderColor = isError ? "var(--red)" : "var(--cyan)";
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

// ── INIT ───────────────────────────────────────────────────────────────────
renderMarket();
renderHoldings();
updateTopBar();
selectStock("AAPL");
updateAllocationChart();
updateMiniStats();
updatePerfCards();
updateInvestorPage();
