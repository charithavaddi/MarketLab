
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

// ================================
// MARKET RENDERING
// ================================

// Displays current stock prices on dashboard
function renderMarket() {
  let html = "";
  stocks.forEach(s => {
    html += `
      <p>
        ${s.name}: $${s.price.toFixed(2)}
        <button onclick="buy(stocks.find(x => x.name === '${s.name}'))">
          Buy
        </button>
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

// Updates stock prices using Geometric Brownian Motion
function updatePrices() {
  stocks.forEach(s => {
    let Z = Math.random();
    s.price *= Math.exp((mu - 0.5*sigma*sigma) + sigma*Z);
  });

  //Update market display and chart

  renderMarket();
  priceChart.data.labels.push(new Date().toLocaleTimeString());
  priceChart.data.datasets[0].data.push(stocks[0].price);
  priceChart.update();
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
function buy(stock) {
  if (cash >= stock.price) {
    cash -= stock.price;
    holdings[stock.name] = (holdings[stock.name] || 0) + 1;
    renderPortfolio();   // update UI
  }
}


//Renders user's portfolio (not implemented in UI)
function renderPortfolio() {
  let html = `<h3>Portfolio</h3>`;
  html += `<p>Cash: $${cash.toFixed(2)}</p>`;

  for (let stock in holdings) {
    html += `<p>${stock}: ${holdings[stock]} shares</p>`;
  }

  document.getElementById("portfolio").innerHTML = html;
}
renderPortfolio();





