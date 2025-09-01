document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const tabs = document.querySelectorAll(".sidebar li");
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

  // Render Transactions + Cards + Reports + Budget
  function render() {
    // Cards
    const income = transactions.filter(t => t.type === "income").reduce((a, b) => a + b.amount, 0);
    const expenses = transactions.filter(t => t.type === "expense").reduce((a, b) => a + b.amount, 0);
    const balance = income - expenses;
    const savings = balance > 0 ? balance * 0.2 : 0; // demo savings

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
      const food = transactions.filter(t => /food/i.test(t.desc)).reduce((a, b) => a + b.amount, 0);
      reportSummary.textContent = `You spent $${expenses} total. About $${food} was on food.`;
    }

    // Save budget
    localStorage.setItem("budget", budget);
  }

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

  // Reset Data
  resetBtn.addEventListener("click", () => {
    localStorage.clear();
    transactions = [];
    budget = 0;
    render();
  });

  // Charts (static demo)
  const expenseCtx = document.getElementById("expenseChart").getContext("2d");
  new Chart(expenseCtx, {
    type: "pie",
    data: {
      labels: ["Rent", "Food", "Transport", "Other"],
      datasets: [{ data: [500, 200, 100, 150], backgroundColor: ["#f87171","#facc15","#34d399","#60a5fa"] }]
    }
  });

  const incomeExpenseCtx = document.getElementById("incomeExpenseChart").getContext("2d");
  new Chart(incomeExpenseCtx, {
    type: "bar",
    data: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May"],
      datasets: [
        { label: "Income", data: [2000, 2200, 2500, 2300, 2400], backgroundColor: "#34d399" },
        { label: "Expenses", data: [1200, 1300, 1400, 1350, 1500], backgroundColor: "#f87171" }
      ]
    }
  });

  // Initial Render
  render();
});
