// === Sidebar Tabs ===
document.querySelectorAll(".sidebar nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// === Transactions ===
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let budget = localStorage.getItem("budget") || null;

const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("income");
const expensesEl = document.getElementById("expenses");
const transactionList = document.getElementById("transactionList");
const budgetProgress = document.getElementById("budgetProgress");
const budgetStatus = document.getElementById("budgetStatus");

function renderTransactions() {
  transactionList.innerHTML = "";
  transactions.forEach((t, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${t.desc} - $${t.amount} (${t.type}, ${t.month})
      <button onclick="deleteTransaction(${index})">❌</button>
    `;
    transactionList.appendChild(li);
  });
  updateSummary();
}

function deleteTransaction(index) {
  transactions.splice(index, 1);
  saveData();
  renderTransactions();
}

document.getElementById("transactionForm").addEventListener("submit", e => {
  e.preventDefault();
  const desc = document.getElementById("tDesc").value;
  const amount = parseFloat(document.getElementById("tAmount").value);
  const type = document.getElementById("tType").value;
  const month = document.getElementById("tMonth").value;

  transactions.push({ desc, amount, type, month });
  saveData();
  renderTransactions();
  e.target.reset();
});

function updateSummary() {
  let income = transactions.filter(t => t.type === "income").reduce((a, b) => a + b.amount, 0);
  let expense = transactions.filter(t => t.type === "expense").reduce((a, b) => a + b.amount, 0);
  let balance = income - expense;

  balanceEl.textContent = `$${balance}`;
  incomeEl.textContent = `$${income}`;
  expensesEl.textContent = `$${expense}`;

  updateCharts();
  updateBudget(expense);
}

function saveData() {
  localStorage.setItem("transactions", JSON.stringify(transactions));
  if (budget) localStorage.setItem("budget", budget);
}

// === Budget ===
document.getElementById("budgetForm").addEventListener("submit", e => {
  e.preventDefault();
  budget = parseFloat(document.getElementById("budgetAmount").value);
  saveData();
  updateBudget();
});

function updateBudget(expense = null) {
  if (!budget) {
    budgetStatus.textContent = "No budget set";
    budgetProgress.style.width = "0%";
    return;
  }
  let spent = expense !== null ? expense : transactions.filter(t => t.type === "expense").reduce((a, b) => a + b.amount, 0);
  let percent = Math.min((spent / budget) * 100, 100);
  budgetProgress.style.width = percent + "%";
  budgetStatus.textContent = `Spent $${spent} of $${budget}`;
}

// === Reports Chart ===
const reportCtx = document.getElementById("reportChart").getContext("2d");
let reportChart = new Chart(reportCtx, {
  type: "pie",
  data: {
    labels: ["Income", "Expenses"],
    datasets: [{ data: [0, 0], backgroundColor: ["#4bc0c0", "#ff6384"] }]
  }
});

// === Line Chart ===
const lineCtx = document.getElementById("lineChart").getContext("2d");
let lineChart = new Chart(lineCtx, {
  type: "line",
  data: { labels: [], datasets: [{ label: "Balance", data: [], borderColor: "#36a2eb" }] }
});

function updateCharts() {
  let income = transactions.filter(t => t.type === "income").reduce((a, b) => a + b.amount, 0);
  let expense = transactions.filter(t => t.type === "expense").reduce((a, b) => a + b.amount, 0);

  reportChart.data.datasets[0].data = [income, expense];
  reportChart.update();

  lineChart.data.labels = transactions.map(t => t.month);
  lineChart.data.datasets[0].data = transactions.map((t, i) => {
    let incomeSoFar = transactions.slice(0, i + 1).filter(t => t.type === "income").reduce((a, b) => a + b.amount, 0);
    let expenseSoFar = transactions.slice(0, i + 1).filter(t => t.type === "expense").reduce((a, b) => a + b.amount, 0);
    return incomeSoFar - expenseSoFar;
  });
  lineChart.update();
}

// === Settings ===
document.getElementById("logout").addEventListener("click", () => {
  window.location.href = "index.html";
});

document.getElementById("resetData").addEventListener("click", () => {
  if (confirm("Are you sure you want to delete all data?")) {
    localStorage.removeItem("transactions");
    localStorage.removeItem("budget");
    transactions = [];
    budget = null;
    renderTransactions();
  }
});

// Dark Mode
document.getElementById("toggleDark").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
});

// Load Dark Mode preference
if (localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark");
}

// === Init ===
renderTransactions();
updateBudget();
