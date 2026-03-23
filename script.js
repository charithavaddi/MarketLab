
// ================================
// MARKETLAB - FINANCIAL SIMULATOR
// ================================

let selectedStock = "AAPL";

// List of simulated stocks

let stocks = [
  { name: "AAPL", price: 150 },
  { name: "TSLA", price: 700 },
  { name: "GOOG", price: 2800 }
];

//Portfolio Labels

let portfolioHistory = [];
let portfolioLabels = [];

// Store historical prices for each stock
let priceHistory = {};
stocks.forEach(s => priceHistory[s.name] = []);

function selectStock(name) {
  selectedStock = name;

  // reset chart
  priceChart.data.labels = [];
  priceChart.data.datasets[0].data = [];

  priceChart.update();
}


// ================================
// CHART INITIALIZATION
// ================================

//canvas context for drawing chart
let ctx = document.getElementById("priceChart").getContext("2d");

// Line chart to visualize stock price over time
let priceChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "AAPL Price",
      data: [],
      borderColor: "lime",
      backgroundColor: "rgba(0,255,0,0.2)",
      fill: false,
      tension: 0.3
    }]
  }
});

//Context to draw portfolio graph
let portfolioCtx = document.getElementById("portfolioChart").getContext("2d");

//Portfolio line graph
let portfolioChart = new Chart(portfolioCtx, {
  type: "line",
  data: {
    labels: portfolioLabels,
    datasets: [{
      label: "Net Worth",
      data: portfolioHistory,
      borderColor: "cyan",
      tension: 0.3
    }]
  },
  options: {
    responsive: true,
    scales: {
      x: { display: false }
    }
  }
});

// ================================
// MARKET RENDERING
// ================================

// Displays current stock prices on dashboard
function renderMarket() {
  let html = "";

  stocks.forEach(s => {
    let style = s.name === selectedStock 
      ? "color:lime;font-weight:bold"
      : "";

    html += `
      <p style="${style}">
        <span onclick="selectStock('${s.name}')" style="cursor:pointer">
          ${s.name}: $${s.price.toFixed(2)}
        </span>
        <button onclick="buy('${s.name}')">Buy</button>
        <button onclick="sell('${s.name}')">Sell</button>
      </p>
    `;
  });

  document.getElementById("market").innerHTML = html;
}



renderMarket();

// ================================
// QUANT PRICE ENGINE
// ================================


//Drift(expected return) and volatility
let mu = 0.0005;
let sigma = 0.01;

// Box-Muller transform to generate standard normal variable
function randomNormal() {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}


// Updates stock prices using Geometric Brownian Motion
function updatePrices() {
  stocks.forEach(s => {
    let Z = randomNormal();
    let dt = 1/252; // 252 trading days
    s.price *= Math.exp((mu - 0.5*sigma*sigma)*dt + sigma*Math.sqrt(dt)*Z);
    priceHistory[s.name].push(s.price);
    // 1% chance of sudden crash
    if(Math.random() < 0.01){
      s.price *= 0.85;
    }

    // keep only last 100 prices
    if(priceHistory[s.name].length > 100){
      priceHistory[s.name].shift();
    }
  });

  //Update market display and chart

  renderMarket();
  let stock = stocks.find(s => s.name === selectedStock);

  priceChart.data.labels.push(new Date().toLocaleTimeString());
  priceChart.data.datasets[0].data.push(stock.price);
  priceChart.data.datasets[0].label = stock.name + " Price";
  priceChart.update();

  let currentNetWorth = netWorth();
  portfolioHistory.push(currentNetWorth);
  portfolioLabels.push(new Date().toLocaleTimeString());
  portfolioChart.update();
  calculateRiskMetrics();

}

//Run price update every second
setInterval(updatePrices, 1000);

// ================================
// PORTFOLIO SYSTEM
// ================================

//User's cash and stock holdings
let cash = 100000;
let holdings = {};

// Buys one share of specified stock if enough cash is available
function buy(stockName) {
  let stock = stocks.find(s => s.name === stockName);

  if (cash >= stock.price) {
    cash -= stock.price;
    holdings[stockName] = (holdings[stockName] || 0) + 1;
    renderPortfolio();
  }
}


// Sells one share of specified stock if owned
function sell(stockName) {
  let stock = stocks.find(s => s.name === stockName);

  if (holdings[stockName] > 0) {
    holdings[stockName]--;
    cash += stock.price;

    if (holdings[stockName] === 0) {
      delete holdings[stockName];
    }

    renderPortfolio();
  }
}

// Calculates total net worth (cash + stock value)
function netWorth() {
  let total = cash;
  stocks.forEach(s => {
    total += (holdings[s.name] || 0) * s.price;
  });
  return total;
}


//Renders user's portfolio (not implemented in UI)
function renderPortfolio() {
  let html = `<h3>Portfolio</h3>`;
  html += `<p>Cash: $${cash.toFixed(2)}</p>`;
  html += `<p>Net Worth: $${netWorth().toFixed(2)}</p>`;
  

  html += `<hr>`;

  stocks.forEach(s => {
    let shares = holdings[s.name] || 0;
    let vol = calculateVolatility(priceHistory[s.name]);

    html += `
      <div class="stock-row">
        <strong>${s.name}</strong><br>
        Shares: ${shares} <br>
        Volatility: ${vol.toFixed(4)}
      </div>
    `;
  });

  let side = document.getElementById("sidePortfolio");
  if (side) {
    side.innerHTML = html;
  }
  document.getElementById("topCash").innerText = cash.toFixed(2);

  let totalShares = Object.values(holdings).reduce((a,b)=>a+b,0);
  document.getElementById("topShares").innerText = totalShares;

  document.getElementById("topNet").innerText = netWorth().toFixed(2);
}
renderPortfolio();


// ================================
// RISK METRICS
// ================================

function calculateVolatility(prices){
  if(prices.length < 2) return 0;
  let returns = [];
  for(let i=1;i<prices.length;i++){
    returns.push(Math.log(prices[i]/prices[i-1]));
  }

  let mean = returns.reduce((a,b)=>a+b,0)/returns.length;
  let variance = returns.reduce((a,b)=>a+(b-mean)**2,0)/returns.length;
  return Math.sqrt(variance)*Math.sqrt(252);
}

// Controls opening and closing of the side dashboard panel
function togglePanel() {
  document.getElementById("sidePanel").classList.toggle("open");
}

// ================================
// PORTFOLIO RISK METRICS
// ================================

// Calculates return, Sharpe ratio, and max drawdown
function calculateRiskMetrics() {

  if (portfolioHistory.length < 2) return;

  let returns = [];

  // Step 1: compute returns
  for (let i = 1; i < portfolioHistory.length; i++) {
    let r = (portfolioHistory[i] - portfolioHistory[i - 1]) / portfolioHistory[i - 1];
    returns.push(r);
  }

  // Step 2: average return
  let avg = returns.reduce((a, b) => a + b, 0) / returns.length;

  // Step 3: standard deviation
  let variance = returns.reduce((a, b) => a + (b - avg) ** 2, 0) / returns.length;
  let std = Math.sqrt(variance);

  // Step 4: Sharpe Ratio (annualized)
  let sharpe = std === 0 ? 0 : (avg / std) * Math.sqrt(252);

  // Step 5: Max Drawdown
  let peak = portfolioHistory[0];
  let maxDrawdown = 0;

  for (let value of portfolioHistory) {
    if (value > peak) peak = value;

    let drawdown = (value - peak) / peak;

    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Step 6: Total Return
  let initial = portfolioHistory[0];
  let current = portfolioHistory[portfolioHistory.length - 1];
  let totalReturn = ((current - initial) / initial) * 100;

  // Step 7: Update UI
  document.getElementById("returnMetric").innerText = totalReturn.toFixed(2) + "%";
  document.getElementById("sharpeMetric").innerText = sharpe.toFixed(2);
  document.getElementById("drawdownMetric").innerText = (maxDrawdown * 100).toFixed(2) + "%";
}