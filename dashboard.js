let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let budgets = JSON.parse(localStorage.getItem("budgets")) || [];

const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("income");
const expensesEl = document.getElementById("expenses");
const savingsEl = document.getElementById("savings");
const transactionList = document.getElementById("transactionList");
const budgetList = document.getElementById("budgetList");

let lineChart;

// -------- Sidebar Navigation --------
document.querySelectorAll(".tab-button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// -------- Transaction Handling --------
document.getElementById("transactionForm").addEventListener("submit", e => {
  e.preventDefault();
  const desc = document.getElementById("desc").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const type = document.getElementById("type").value;
  const category = document.getElementById("category").value;
  const month = document.getElementById("month").value;

  transactions.push({ desc, amount, type, category, month });
  localStorage.setItem("transactions", JSON.stringify(transactions));
  e.target.reset();
  renderTransactions();
  updateOverview();
  updateLineChart();
  updateReports();
});

function renderTransactions() {
  transactionList.innerHTML = "";
  transactions.forEach(t => {
    const row = `<tr>
      <td>${t.desc}</td>
      <td>${t.amount}</td>
      <td>${t.type}</td>
      <td>${t.category}</td>
      <td>${t.month}</td>
    </tr>`;
    transactionList.innerHTML += row;
  });
}

// -------- Budget Handling --------
document.getElementById("budgetForm").addEventListener("submit", e => {
  e.preventDefault();
  const category = document.getElementById("budgetCategory").value;
  const amount = parseFloat(document.getElementById("budgetAmount").value);
  budgets = budgets.filter(b => b.category !== category);
  budgets.push({ category, amount });
  localStorage.setItem("budgets", JSON.stringify(budgets));
  renderBudgets();
  e.target.reset();
});

function renderBudgets() {
  budgetList.innerHTML = "";
  budgets.forEach(b => {
    const spent = transactions.filter(t => t.type === "expense" && t.category === b.category)
                              .reduce((sum, t) => sum + t.amount, 0);
    const percent = Math.min(100, (spent / b.amount) * 100).toFixed(0);
    budgetList.innerHTML += `
      <div class="budget-item">
        <strong>${b.category}:</strong> $${spent} / $${b.amount}
        <div class="progress-bar"><div class="progress" style="width:${percent}%">${percent}%</div></div>
      </div>`;
  });
}

// -------- Overview --------
function updateOverview() {
  const income = transactions.filter(t => t.type === "income").reduce((a,b) => a + b.amount, 0);
  const expenses = transactions.filter(t => t.type === "expense").reduce((a,b) => a + b.amount, 0);
  const balance = income - expenses;
  balanceEl.textContent = `$${balance}`;
  incomeEl.textContent = `$${income}`;
  expensesEl.textContent = `$${expenses}`;
  savingsEl.textContent = `$${balance > 0 ? balance : 0}`;
}

// -------- Reports --------
function updateReports() {
  const income = transactions.filter(t => t.type === "income").reduce((a,b) => a + b.amount, 0);
  const expenses = transactions.filter(t => t.type === "expense").reduce((a,b) => a + b.amount, 0);
  const savingsRate = income > 0 ? ((income - expenses) / income * 100).toFixed(1) : 0;
  const topCategory = transactions.filter(t => t.type === "expense")
                                  .reduce((acc, t) => {
                                    acc[t.category] = (acc[t.category] || 0) + t.amount;
                                    return acc;
                                  }, {});
  const topCat = Object.keys(topCategory).length ? Object.entries(topCategory).sort((a,b)=>b[1]-a[1])[0][0] : "N/A";

  document.getElementById("reportIncome").textContent = `$${income}`;
  document.getElementById("reportExpenses").textContent = `$${expenses}`;
  document.getElementById("reportSavings").textContent = `${savingsRate}%`;
  document.getElementById("reportTopCat").textContent = topCat;
}

// -------- Chart --------
function updateLineChart() {
  const monthlyData = {};
  transactions.forEach(t => {
    if (!monthlyData[t.month]) monthlyData[t.month] = { income: 0, expense: 0 };
    monthlyData[t.month][t.type] += t.amount;
  });

  const labels = Object.keys(monthlyData).sort();
  const incomeData = labels.map(m => monthlyData[m].income);
  const expenseData = labels.map(m => monthlyData[m].expense);

  if (lineChart) lineChart.destroy();
  lineChart = new Chart(document.getElementById("lineChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Income", data: incomeData, borderColor: "green", fill: false },
        { label: "Expenses", data: expenseData, borderColor: "red", fill: false }
      ]
    }
  });
}

// -------- Reset & Logout --------
document.getElementById("resetBtn").addEventListener("click", () => {
  if (confirm("Are you sure you want to reset all data?")) {
    localStorage.removeItem("transactions");
    localStorage.removeItem("budgets");
    transactions = [];
    budgets = [];
    renderTransactions();
    renderBudgets();
    updateOverview();
    updateLineChart();
    updateReports();
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("currentUser");
  window.location.href = "index.html";
});

// -------- Init --------
renderTransactions();
renderBudgets();
updateOverview();
updateLineChart();
updateReports();
