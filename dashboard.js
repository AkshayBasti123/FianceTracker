let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let budget = parseFloat(localStorage.getItem("budget")) || 0;

const ctxLine = document.getElementById("lineChart").getContext("2d");
const ctxReport = document.getElementById("monthlyReport").getContext("2d");

let lineChart = new Chart(ctxLine, {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "Expenses Over Time",
      data: [],
      borderColor: "#36a2eb",
      fill: false
    }]
  }
});

let reportChart = new Chart(ctxReport, {
  type: "bar",
  data: {
    labels: [],
    datasets: [{
      label: "Monthly Spending",
      data: [],
      backgroundColor: "#4bc0c0"
    }]
  }
});

// Tabs
function openTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(tab => tab.style.display = "none");
  document.getElementById(tabId).style.display = "block";
}

// Transactions
document.getElementById("transactionForm").addEventListener("submit", e => {
  e.preventDefault();
  const desc = document.getElementById("desc").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const month = document.getElementById("month").value;

  const transaction = { desc, amount, month };
  transactions.push(transaction);
  localStorage.setItem("transactions", JSON.stringify(transactions));

  document.getElementById("transactionForm").reset();
  renderTransactions();
  updateCharts();
  updateBudget();
});

function renderTransactions() {
  const list = document.getElementById("transactionList");
  list.innerHTML = "";
  transactions.forEach((t, index) => {
    const li = document.createElement("li");
    li.innerHTML = `${t.desc} - $${t.amount} (${t.month}) 
      <button onclick="deleteTransaction(${index})">❌</button>`;
    list.appendChild(li);
  });
}
function deleteTransaction(index) {
  transactions.splice(index, 1);
  localStorage.setItem("transactions", JSON.stringify(transactions));
  renderTransactions();
  updateCharts();
  updateBudget();
}

// Budget
document.getElementById("budgetForm").addEventListener("submit", e => {
  e.preventDefault();
  budget = parseFloat(document.getElementById("budgetAmount").value);
  localStorage.setItem("budget", budget);
  updateBudget();
});
function updateBudget() {
  const spent = transactions.reduce((sum, t) => sum + t.amount, 0);
  document.getElementById("budgetValue").textContent = budget;
  document.getElementById("spentValue").textContent = spent;
  const percent = budget > 0 ? (spent / budget) * 100 : 0;
  document.getElementById("progressFill").style.width = Math.min(percent, 100) + "%";
}

// Charts
function updateCharts() {
  const months = [...new Set(transactions.map(t => t.month))];
  const totals = months.map(m => transactions.filter(t => t.month === m).reduce((s, t) => s + t.amount, 0));
  reportChart.data.labels = months;
  reportChart.data.datasets[0].data = totals;
  reportChart.update();

  lineChart.data.labels = transactions.map((_, i) => i + 1);
  lineChart.data.datasets[0].data = transactions.map(t => t.amount);
  lineChart.update();

  document.getElementById("totalBalance").textContent = "$" + (budget - transactions.reduce((s, t) => s + t.amount, 0));
  document.getElementById("totalTransactions").textContent = transactions.length;
}

// Finance News
async function loadNews() {
  const res = await fetch(`https://newsapi.org/v2/top-headlines?category=business&apiKey=${CONFIG.NEWS_API_KEY}`);
  const data = await res.json();
  const newsFeed = document.getElementById("newsFeed");
  newsFeed.innerHTML = data.articles.slice(0, 5).map(a =>
    `<div><a href="${a.url}" target="_blank">${a.title}</a></div>`
  ).join("");
}
loadNews();

// Markets
async function loadMarkets() {
  // USD to EUR
  const fx = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=EUR");
  const fxData = await fx.json();
  document.getElementById("usdEur").textContent = fxData.rates.EUR.toFixed(2);

  // Apple Stock
  const stock = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${CONFIG.ALPHA_VANTAGE_KEY}`);
  const stockData = await stock.json();
  document.getElementById("appleStock").textContent = "$" + parseFloat(stockData["Global Quote"]["05. price"]).toFixed(2);

  // Bitcoin
  const btc = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
  const btcData = await btc.json();
  document.getElementById("btcPrice").textContent = "$" + btcData.bitcoin.usd.toLocaleString();
}
loadMarkets();

// AI Assistant
async function askAssistant() {
  const q = document.getElementById("aiQuestion").value;
  const res = await fetch("https://api-inference.huggingface.co/models/facebook/bart-large-cnn", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CONFIG.HF_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: q })
  });
  const data = await res.json();
  document.getElementById("aiResponse").textContent = data[0]?.summary_text || "No response";
}

// Settings
function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
}
function logout() {
  localStorage.removeItem("user");
  window.location.href = "index.html";
}
function confirmReset() {
  if (confirm("Are you sure you want to delete all data?")) {
    localStorage.clear();
    location.reload();
  }
}

// Init
renderTransactions();
updateCharts();
updateBudget();
