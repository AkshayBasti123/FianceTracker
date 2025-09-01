// ==== Tabs ====
document.querySelectorAll(".sidebar button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// ==== Transactions ====
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let budget = parseFloat(localStorage.getItem("budget")) || 0;

const transactionForm = document.getElementById("transactionForm");
const transactionList = document.getElementById("transactionList");
const balanceDisplay = document.getElementById("balanceDisplay");
const transactionCount = document.getElementById("transactionCount");

// Render transactions
function renderTransactions() {
  transactionList.innerHTML = "";
  transactions.forEach((t, i) => {
    const li = document.createElement("li");
    li.textContent = `${t.month} - ${t.desc}: $${t.amount}`;
    const delBtn = document.createElement("button");
    delBtn.textContent = "❌";
    delBtn.onclick = () => {
      transactions.splice(i, 1);
      saveData();
    };
    li.appendChild(delBtn);
    transactionList.appendChild(li);
  });
  updateOverview();
  updateBudget();
}

// Save to storage
function saveData() {
  localStorage.setItem("transactions", JSON.stringify(transactions));
  localStorage.setItem("budget", budget);
  renderTransactions();
}

// Add new transaction
transactionForm?.addEventListener("submit", e => {
  e.preventDefault();
  const desc = document.getElementById("desc").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const month = document.getElementById("month").value;
  transactions.push({ desc, amount, month });
  transactionForm.reset();
  saveData();
});

// ==== Overview Trend Chart ====
const ctx = document.getElementById("trendChart");
let trendChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "Expenses",
      data: [],
      borderColor: "#36a2eb",
      fill: false
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true } }
  }
});

function updateOverview() {
  const balance = transactions.reduce((acc, t) => acc + t.amount, 0);
  balanceDisplay.textContent = `$${balance.toFixed(2)}`;
  transactionCount.textContent = transactions.length;

  // Trend data: group by month
  const monthTotals = {};
  transactions.forEach(t => {
    monthTotals[t.month] = (monthTotals[t.month] || 0) + t.amount;
  });
  const labels = Object.keys(monthTotals).slice(-12);
  const data = Object.values(monthTotals).slice(-12);

  trendChart.data.labels = labels;
  trendChart.data.datasets[0].data = data;
  trendChart.update();
}

// ==== Budget ====
const budgetForm = document.getElementById("budgetForm");
const budgetBar = document.getElementById("budgetBar");
const budgetStatus = document.getElementById("budgetStatus");

budgetForm?.addEventListener("submit", e => {
  e.preventDefault();
  budget = parseFloat(document.getElementById("budgetAmount").value);
  saveData();
});

function updateBudget() {
  if (!budget) {
    budgetStatus.textContent = "No budget set.";
    budgetBar.style.width = "0%";
    return;
  }
  const spent = transactions.reduce((acc, t) => acc + t.amount, 0);
  const percent = Math.min((spent / budget) * 100, 100);
  budgetBar.style.width = percent + "%";
  budgetStatus.textContent = `Spent $${spent.toFixed(2)} of $${budget}`;
}

// ==== Reports ====
const reportCtx = document.getElementById("reportChart");
let reportChart = new Chart(reportCtx, {
  type: "bar",
  data: {
    labels: [],
    datasets: [{ label: "Expenses", data: [], backgroundColor: "#4bc0c0" }]
  },
  options: { responsive: true, maintainAspectRatio: false }
});

function updateReports() {
  const monthTotals = {};
  transactions.forEach(t => {
    monthTotals[t.month] = (monthTotals[t.month] || 0) + t.amount;
  });
  reportChart.data.labels = Object.keys(monthTotals);
  reportChart.data.datasets[0].data = Object.values(monthTotals);
  reportChart.update();
}

// ==== News (using GNews API instead of NewsAPI) ====
async function loadNews() {
  try {
    const res = await fetch(`https://gnews.io/api/v4/top-headlines?token=${CONFIG.GNEWS_KEY}&lang=en&topic=business`);
    const data = await res.json();
    const newsList = document.getElementById("newsList");
    newsList.innerHTML = "";
    data.articles.slice(0, 5).forEach(n => {
      const li = document.createElement("li");
      li.innerHTML = `<a href="${n.url}" target="_blank">${n.title}</a>`;
      newsList.appendChild(li);
    });
  } catch (e) {
    console.error("News load failed", e);
  }
}

// ==== Markets ====
async function loadMarkets() {
  try {
    // Currency
    const fxRes = await fetch("https://api.exchangerate.host/latest?base=USD");
    const fxData = await fxRes.json();
    document.getElementById("usdToEur").textContent = fxData.rates.EUR.toFixed(2);

    // BTC
    const btcRes = await fetch("https://api.coindesk.com/v1/bpi/currentprice/BTC.json");
    const btcData = await btcRes.json();
    document.getElementById("btcPrice").textContent = `$${btcData.bpi.USD.rate}`;

    // AAPL stock
    const stockRes = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${CONFIG.ALPHA_VANTAGE_KEY}`);
    const stockData = await stockRes.json();
    document.getElementById("aaplPrice").textContent = `$${parseFloat(stockData["Global Quote"]["05. price"]).toFixed(2)}`;
  } catch (e) {
    console.error("Market load failed", e);
  }
}

// ==== AI Assistant ====
document.getElementById("askAI")?.addEventListener("click", async () => {
  const q = document.getElementById("aiQuestion").value;
  const ans = document.getElementById("aiAnswer");
  ans.textContent = "Thinking...";
  try {
    const res = await fetch("https://api-inference.huggingface.co/models/facebook/bart-large-cnn", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CONFIG.HF_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: q })
    });
    const data = await res.json();
    ans.textContent = data[0]?.summary_text || "No answer available.";
  } catch {
    ans.textContent = "AI request failed.";
  }
});

// ==== Settings ====
document.getElementById("logout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "index.html";
});
document.getElementById("clearData")?.addEventListener("click", () => {
  if (confirm("Are you sure you want to delete all data?")) {
    localStorage.clear();
    location.reload();
  }
});
document.getElementById("toggleDark")?.addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

// ==== Init ====
renderTransactions();
updateReports();
loadNews();
loadMarkets();
