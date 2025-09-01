// Sidebar tab switching
const tabs = document.querySelectorAll(".sidebar li");
const contents = document.querySelectorAll(".tab-content");
const tabTitle = document.getElementById("tab-title");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    // Highlight tab
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    // Show content
    contents.forEach(c => c.classList.remove("active"));
    document.getElementById(tab.dataset.tab).classList.add("active");

    // Update title
    tabTitle.textContent = tab.textContent;
  });
});

// Transaction form logic
const form = document.getElementById("add-transaction");
const list = document.getElementById("transaction-list");

form.addEventListener("submit", e => {
  e.preventDefault();
  const desc = document.getElementById("desc").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const type = document.getElementById("type").value;

  const li = document.createElement("li");
  li.textContent = `${desc} - $${amount} (${type})`;
  li.className = type;
  list.appendChild(li);

  form.reset();
});

// Charts
const expenseCtx = document.getElementById("expenseChart").getContext("2d");
new Chart(expenseCtx, {
  type: "pie",
  data: {
    labels: ["Rent", "Food", "Transport", "Entertainment", "Other"],
    datasets: [{
      data: [1000, 500, 200, 300, 600],
      backgroundColor: ["#f87171","#facc15","#34d399","#60a5fa","#a78bfa"]
    }]
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
  },
  options: { responsive: true }
});
