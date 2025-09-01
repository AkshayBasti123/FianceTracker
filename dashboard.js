document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const tabs = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");
  const tabTitle = document.getElementById("tab-title");

  const balanceEl = document.getElementById("balance");
  const incomeEl = document.getElementById("income");
  const expensesEl = document.getElementById("expenses");
  const savingsEl = document.getElementById("savings");
  const form = document.getElementById("add-transaction");
  const list = document.getElementById("transaction-list");

  const budgetForm = document.getElementById("set-budget-form");
  const budgetInput = document.getElementById("budget-input");
  const budgetAmountEl = document.getElementById("budget-amount");
  const spentAmountEl = document.getElementById("spent-amount");
  const budgetProgress = document.getElementById("budget-progress");

  const reportSummary = document.getElementById("report-summary");
  const darkToggle = document.getElementById("dark-mode-toggle");
  const resetBtn = document.getElementById("reset-data");

  // State
  let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
  let budget = parseFloat(localStorage.getItem("budget")) || 0;

  // Navigation
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      contents.forEach(c => c.classList.remove("active"));
      document.getElementById(tab.dataset.tab).classList.add("active");

      tabTitle.textContent = tab.textContent;
    });
  });

  // Add Transaction
  form.addEventListener("submit", e => {
    e.preventDefault();
    const desc = document.getElementById("desc").value;
    const amount = parseFloat(document.getElementById("amount").value);
    const type = document.getElementById("type").value;

    const transaction = { id: Date.now(), desc, amount, type };
    transactions.push(transaction);
    localStorage.setItem("transactions", JSON.stringify(transactions));

    form.reset();
    render();
  });

  // Budget Form
  budgetForm.addEventListener("submit", e => {
    e.preventDefault();
    budget = parseFloat(budgetInput.value);
    budgetInput.value = "";
    render();
  });

  // Dark Mode
  darkToggle.addEventListener("change", () => {
    document.body.classList.toggle("dark", darkToggle.checked);
  });

  // Reset Data with Confirmation
  resetBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to reset all data? This cannot be undone.")) {
      localStorage.clear();
      transactions = [];
      budget = 0;
      render();
    }
  });

  // Charts
  const expenseCtx = document.getElementById("expenseChart").getContext("2d");
  const incomeExpenseCtx = document.getElementById("incomeExpenseChart").getContext("2d");

  let expenseChart = new Chart(expenseCtx, {
    type: "pie",
    data: {
      labels: [],
      datasets: [{ data: [], backgroundColor: ["#f87171","#facc15","#34d399","#60a5fa","#a78bfa","#fb923c"] }]
    }
  });

  let incomeExpenseChart = new Chart(incomeExpenseCtx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        { label: "Income", data: [], backgroundColor: "#34d399" },
        { label: "Expenses", data: [], backgroundColor: "#f87171" }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });

  // Render Everything
  function render() {
    // Cards
    const income = transactions.filter(t => t.type === "income").reduce((a, b) => a + b.amount, 0);
    const expenses = transactions.filter(t => t.type === "expense").reduce((a, b) => a + b.amount, 0);
    const balance = income - expenses;
    const savings = balance > 0 ? balance * 0.2 : 0;

    balanceEl.textContent = `$${balance}`;
    incomeEl.textContent = `$${income}`;
    expensesEl.textContent = `$${expenses}`;
    savingsEl.textContent = `$${savings}`;

    // Transaction List
    list.innerHTML = "";
    transactions.forEach(t => {
      const li = document.createElement("li");
      li.textContent = `${t.desc} - $${t.amount} (${t.type})`;
      list.appendChild(li);
    });

    // Budget
    budgetAmountEl.textContent = budget;
    spentAmountEl.textContent = expenses;
    if (budget > 0) {
      budgetProgress.value = Math.min((expenses / budget) * 100, 100);
    }

    // Report Summary
    if (transactions.length > 0) {
      const categories = {};
      transactions.forEach(t => {
        const key = t.desc.toLowerCase().includes("food") ? "Food" : t.type;
        categories[key] = (categories[key] || 0) + t.amount;
      });
      reportSummary.textContent = `You spent $${expenses} total. Breakdown: ${Object.entries(categories).map(([k,v]) => `${k}: $${v}`).join(", ")}`;
    }

    // Update Charts
    const categories = {};
    transactions.forEach(t => {
      if (t.type === "expense") {
        categories[t.desc] = (categories[t.desc] || 0) + t.amount;
      }
    });

    expenseChart.data.labels = Object.keys(categories);
    expenseChart.data.datasets[0].data = Object.values(categories);
    expenseChart.update();

    const months = {};
    transactions.forEach(t => {
      const d = new Date(t.id);
      const m = d.toLocaleString("default", { month: "short" });
      if (!months[m]) months[m] = { income: 0, expense: 0 };
      months[m][t.type] += t.amount;
    });

    incomeExpenseChart.data.labels = Object.keys(months);
    incomeExpenseChart.data.datasets[0].data = Object.values(months).map(m => m.income);
    incomeExpenseChart.data.datasets[1].data = Object.values(months).map(m => m.expense);
    incomeExpenseChart.update();

    // Save budget
    localStorage.setItem("budget", budget);
  }

  // Initial Render
  render();
});
