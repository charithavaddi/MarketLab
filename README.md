# MarketLab – Financial Market Simulator

MarketLab is a web-based quantitative trading simulator that models stock price 
movements using stochastic processes and allows users to trade virtual assets 
in a risk-free environment.

The project aims to demonstrate core concepts of financial markets, 
data visualization, and basic quantitative analysis using only frontend web technologies.

## Features
- Real-time stock price simulation
- Line charts using Chart.js
- Virtual trading system (buy/sell)
- Portfolio tracking
- Stochastic price modeling
- Dark-mode financial dashboard UI

## Technologies Used
- HTML – User interface structure  
- CSS – Styling and layout  
- JavaScript – Simulation logic  
- Chart.js – Data visualization  

## Mathematical Model
Stock prices are simulated using a simplified Geometric Brownian Motion model:

S(t+1) = S(t) × exp((μ − ½σ²) + σZ)

Where:
- μ = expected return (drift)
- σ = volatility
- Z = random variable

## How to Run
1. Open the folder.
2. Double-click index.html.
3. The dashboard runs in the browser.

No backend or installation required.

## Limitations
- Prices are simulated, not real market data.
- No order book or liquidity modeling.
- Simplified risk metrics.

## Future Improvements
- Candlestick charts
- Strategy backtesting
- Risk analysis (Sharpe, drawdown)
- Real API integration
