/* ============================================================================
   FinanceTracker - Dashboard Logic (verbose edition)
   ---------------------------------------------------------------------------
   This file powers all tabs:
   - Overview (line chart + quick stats)
   - Transactions (table + delete)
   - Budget (category limits with progress bars)
   - Reports (pie chart of expenses by category)
   - News (GNews.io)
   - Markets (AAPL, currency converter, crypto, commodities)
   - AI Assistant (HuggingFace DialoGPT)
   - Settings (dark mode, reset, logout)
   ---------------------------------------------------------------------------
   IMPORTANT: Ensure you include config.js BEFORE this file:

      <script src="config.js"></script>
      <script src="dashboard.js"></script>

   The CONFIG object must define:
     CONFIG = {
       ALPHA_VANTAGE_KEY: "...",
       GNEWS_KEY: "...",
       HF_API_KEY: "..."
     }
   ============================================================================ */

/* ------------------------------------------
   Module-level state (persisted in localStorage)
   ------------------------------------------ */
let transactions = [];   // [{ id, date, desc, amount, type }]
let budgets = [];        // [{ id, category, limit }]
let ui = {               // UI prefs (e.g., dark mode)
  darkMode: false
};

/* ------------------------------------------
   Utility: LocalStorage keys
   ------------------------------------------ */
const LS_KEYS = {
  TRANSACTIONS: "ft.transactions",
  BUDGETS: "ft.budgets",
  UI: "ft.ui"
};

/* ------------------------------------------
   Utility: guard for DOM queries
   ------------------------------------------ */
function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return Array.from(document.querySelectorAll(selector));
}

/* ------------------------------------------
   Utility: load & save localStorage
   ------------------------------------------ */
function saveState() {
  localStorage.setItem(LS_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  localStorage.setItem(LS_KEYS.BUDGETS, JSON.stringify(budgets));
  localStorage.setItem(LS_KEYS.UI, JSON.stringify(ui));
}

function loadState() {
  try {
    const t = JSON.parse(localStorage.getItem(LS_KEYS.TRANSACTIONS) || "[]");
    const b = JSON.parse(localStorage.getItem(LS_KEYS.BUDGETS) || "[]");
    const u = JSON.parse(localStorage.getItem(LS_KEYS.UI) || "{}");
    if (Array.isArray(t)) transactions = t;
    if (Array.isArray(b)) budgets = b;
    if (u && typeof u === "object") ui = { darkMode: !!u.darkMode };
  } catch (e) {
    console.warn("State load error:", e);
  }
}

/* ------------------------------------------
   Utility: simple ID generator (for rows)
   ------------------------------------------ */
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/* ------------------------------------------
   Charts (Chart.js instances)
   ------------------------------------------ */
let overviewChart = null;
let reportChart = null;

/* ------------------------------------------
   Canvas Sizing Control
   Prevent “growing chart” behavior by:
   - fixing parent container heights via CSS
   - AND locking canvas height once on init
   ------------------------------------------ */
function lockCanvasHeight(canvasId, fixedPx) {
  const cv = document.getElementById(canvasId);
  if (!cv) return;
  // Only set once; avoid recalculations that cause growth
  if (!cv.dataset.lockedHeight) {
    cv.height = fixedPx;         // explicitly set height in pixels
    cv.style.maxHeight = fixedPx + "px";
    cv.dataset.lockedHeight = "1";
  }
}

/* ============================================================================
   TAB HANDLING
   ============================================================================ */
function initTabs() {
  const buttons = $all(".sidebar button");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      // Hide all
      $all(".tab-content").forEach(el => el.classList.add("hidden"));
      // Show target
      const target = document.getElementById(tab);
      if (target) target.classList.remove("hidden");
      // If we switch to charts, force their resize/update
      if (tab === "overview") {
        // No-op: line chart updates when transactions change
      } else if (tab === "reports") {
        // No-op: pie chart updates when transactions change
      }
    });
  });
}

/* ============================================================================
   TRANSACTIONS
   ============================================================================ */
function initTransactions() {
  const form = document.getElementById("transactionForm");
  const tableBody = document.querySelector("#transactionTable tbody");

  if (!form || !tableBody) return;

  // Form submission handler
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    // Read fields
    const descEl = document.getElementById("tDesc");
    const amountEl = document.getElementById("tAmount");
    const typeEl = document.getElementById("tType");

    const desc = (descEl?.value || "").trim();
    const amount = parseFloat(amountEl?.value || "0");
    const type = typeEl?.value === "income" ? "income" : "expense";

    if (!desc || !Number.isFinite(amount)) return;

    // Create transaction
    const entry = {
      id: uid(),
      date: new Date().toLocaleDateString(), // keep it simple; could store ISO
      desc,
      amount,
      type
    };

    // Persist
    transactions.push(entry);
    saveState();

    // Re-render
    renderTransactionsTable();
    renderOverviewChart();
    renderReportChart();
    updateOverviewStats();

    // Reset form
    form.reset();
  });

  // Initial render from persisted state
  renderTransactionsTable();
}

/* Render the transactions table in a more "professional" style */
function renderTransactionsTable() {
  const tbody = document.querySelector("#transactionTable tbody");
  if (!tbody) return;

  // Clear
  tbody.innerHTML = "";

  if (!transactions.length) {
    const empty = document.createElement("tr");
    empty.innerHTML = `<td colspan="5" style="text-align:center;opacity:0.7;">No transactions yet.</td>`;
    tbody.appendChild(empty);
    return;
  }

  // Render rows
  transactions.forEach((t) => {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = t.date;

    const tdDesc = document.createElement("td");
    tdDesc.textContent = t.desc;

    const tdAmount = document.createElement("td");
    tdAmount.textContent = `$${Number(t.amount).toFixed(2)}`;

    const tdType = document.createElement("td");
    tdType.textContent = t.type === "income" ? "Income" : "Expense";
    tdType.style.fontWeight = "600";
    tdType.style.color = t.type === "income" ? "var(--green-600, #16a34a)" : "var(--red-600, #dc2626)";

    const tdAction = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "btn-danger";
    delBtn.addEventListener("click", () => {
      // Remove and update
      transactions = transactions.filter(x => x.id !== t.id);
      saveState();
      renderTransactionsTable();
      renderOverviewChart();
      renderReportChart();
      updateOverviewStats();
      renderBudgets(); // also refresh budgets, since spend may change
    });
    tdAction.appendChild(delBtn);

    tr.appendChild(tdDate);
    tr.appendChild(tdDesc);
    tr.appendChild(tdAmount);
    tr.appendChild(tdType);
    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });
}

/* ============================================================================
   OVERVIEW (Stats + Line Chart)
   ============================================================================ */
function updateOverviewStats() {
  const income = transactions.filter(t => t.type === "income").reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const expense = transactions.filter(t => t.type === "expense").reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const balance = income - expense;

  const incomeStat = document.getElementById("incomeStat");
  const expenseStat = document.getElementById("expenseStat");
  const balanceStat = document.getElementById("balanceStat");

  if (incomeStat) incomeStat.textContent = `Income: $${income.toFixed(2)}`;
  if (expenseStat) expenseStat.textContent = `Expenses: $${expense.toFixed(2)}`;
  if (balanceStat) balanceStat.textContent = `Balance: $${balance.toFixed(2)}`;
}

/* Prepare data for line chart => cumulative balance over time */
function getOverviewSeries() {
  // Sort by date (basic lexicographic for locale string is unreliable;
  // but since we only use "today" forward in small demo, keep as-is.)
  // If you want precise ordering, store ISO date strings in future.
  let running = 0;
  const labels = [];
  const series = [];

  transactions.forEach(t => {
    const amt = t.type === "income" ? Number(t.amount || 0) : -Number(t.amount || 0);
    running += amt;
    labels.push(t.date);
    series.push(running);
  });

  return { labels, series };
}

/* Create/Update line chart */
function renderOverviewChart() {
  // Lock canvas height once to stop auto-growth
  lockCanvasHeight("overviewChart", 260);

  const canvas = document.getElementById("overviewChart");
  if (!canvas) return;

  // Destroy old instance if present (prevents size creep)
  if (overviewChart) {
    overviewChart.destroy();
  }

  const { labels, series } = getOverviewSeries();

  overviewChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Balance Over Time",
          data: series,
          borderColor: "#36a2eb",
          backgroundColor: "rgba(54,162,235,0.12)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // respect our locked pixel height
      plugins: {
        legend: { display: true, position: "top" },
        tooltip: { mode: "index", intersect: false }
      },
      scales: {
        x: {
          display: true,
          title: { display: true, text: "Date" },
          grid: { display: false }
        },
        y: {
          display: true,
          title: { display: true, text: "USD" },
          grid: { color: "rgba(0,0,0,0.05)" }
        }
      },
      interaction: { mode: "nearest", intersect: false }
    }
  });

  updateOverviewStats();
}

/* ============================================================================
   BUDGET (Category limits + filling bar)
   ============================================================================ */
function initBudget() {
  const form = document.getElementById("budgetForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const catEl = document.getElementById("bCategory");
    const limitEl = document.getElementById("bLimit");

    const category = (catEl?.value || "").trim();
    const limit = parseFloat(limitEl?.value || "0");

    if (!category || !Number.isFinite(limit) || limit <= 0) return;

    budgets.push({ id: uid(), category, limit });
    saveState();
    renderBudgets();
    form.reset();
  });

  renderBudgets();
}

/* Render budget cards with fill bars */
function renderBudgets() {
  const list = document.getElementById("budgetList");
  if (!list) return;

  list.innerHTML = "";

  if (!budgets.length) {
    list.innerHTML = `<p style="opacity:.7">No budgets yet. Add a category and limit above.</p>`;
    return;
  }

  // For each budget, compute spent = sum(expenses with desc === category)
  budgets.forEach((b) => {
    const spent = transactions
      .filter(t => t.type === "expense" && t.desc.toLowerCase() === b.category.toLowerCase())
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);

    const pct = b.limit > 0 ? Math.min(100, (spent / b.limit) * 100) : 0;

    // Card/container
    const card = document.createElement("div");
    card.className = "budget-item";

    const title = document.createElement("h4");
    title.textContent = `${b.category}: $${spent.toFixed(2)} / $${b.limit.toFixed(2)}`;

    const bar = document.createElement("div");
    bar.className = "bar";

    const fill = document.createElement("div");
    fill.className = "fill";
    fill.style.width = `${pct}%`;

    // Color alert when over 90%
    if (pct >= 90) fill.style.background = "var(--red-500, #ef4444)";
    else if (pct >= 70) fill.style.background = "var(--amber-500, #f59e0b)";
    else fill.style.background = "var(--green-500, #22c55e)";

    bar.appendChild(fill);

    // Optional: delete budget action
    const actions = document.createElement("div");
    actions.style.marginTop = "8px";
    const del = document.createElement("button");
    del.textContent = "Remove";
    del.className = "btn-ghost";
    del.addEventListener("click", () => {
      budgets = budgets.filter(x => x.id !== b.id);
      saveState();
      renderBudgets();
    });
    actions.appendChild(del);

    card.appendChild(title);
    card.appendChild(bar);
    card.appendChild(actions);
    list.appendChild(card);
  });
}

/* ============================================================================
   REPORTS (Pie chart of expenses by category/description)
   ============================================================================ */
function renderReportChart() {
  // Lock canvas height to prevent growth
  lockCanvasHeight("reportChart", 280);

  const cv = document.getElementById("reportChart");
  if (!cv) return;

  if (reportChart) reportChart.destroy();

  // Aggregate spend by description (treat desc like category label)
  const buckets = {};
  transactions
    .filter(t => t.type === "expense")
    .forEach(t => {
      const key = t.desc || "Other";
      buckets[key] = (buckets[key] || 0) + Number(t.amount || 0);
    });

  const labels = Object.keys(buckets);
  const values = Object.values(buckets);

  // If nothing to show, render a “blank” pie
  const dataVals = values.length ? values : [1];
  const dataLabs = labels.length ? labels : ["No expenses"];

  reportChart = new Chart(cv.getContext("2d"), {
    type: "pie",
    data: {
      labels: dataLabs,
      datasets: [{
        data: dataVals,
        backgroundColor: [
          "#36a2eb", "#ff6384", "#ffce56", "#4caf50", "#9c27b0",
          "#8bc34a", "#ff9800", "#03a9f4", "#e91e63", "#795548"
        ],
        borderWidth: 1,
        borderColor: "#fff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: "right" }
      }
    }
  });
}

/* ============================================================================
   NEWS (GNews.io) - requires CONFIG.GNEWS_KEY
   ============================================================================ */
async function loadNews() {
  const container = document.getElementById("newsList");
  if (!container) return;

  // Defensive: show loading text
  container.innerHTML = `<p>Loading news...</p>`;

  try {
    if (!window.CONFIG || !CONFIG.GNEWS_KEY) {
      throw new Error("Missing CONFIG.GNEWS_KEY");
    }

    // GNews endpoint: top headlines / business
    const endpoint =
      `https://gnews.io/api/v4/top-headlines?token=${encodeURIComponent(CONFIG.GNEWS_KEY)}&lang=en&topic=business`;

    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`News http ${res.status}`);

    const data = await res.json();
    const items = Array.isArray(data.articles) ? data.articles.slice(0, 8) : [];

    container.innerHTML = "";

    if (!items.length) {
      container.innerHTML = `<p>No news available right now.</p>`;
      return;
    }

    // Build cards in a grid
    items.forEach(a => {
      const card = document.createElement("div");
      card.className = "news-item";

      const title = document.createElement("h4");
      const link = document.createElement("a");
      link.href = a.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = a.title || "Untitled";
      title.appendChild(link);

      const desc = document.createElement("p");
      desc.textContent = a.description || "No description available.";

      card.appendChild(title);
      card.appendChild(desc);
      container.appendChild(card);
    });
  } catch (err) {
    console.error("News API error:", err);
    container.innerHTML = `<p>⚠️ Could not load news. Check your GNews key or try later.</p>`;
  }
}

/* ============================================================================
   MARKETS
   - AAPL stock (Alpha Vantage GLOBAL_QUOTE)
   - Currency converter (Alpha Vantage CURRENCY_EXCHANGE_RATE)
   - Extra widgets (crypto via AV; commodities demo)
   ============================================================================ */
async function loadAAPLQuote() {
  const box = document.getElementById("stockBox");
  if (!box) return;

  box.innerHTML = `Loading AAPL stock...`;

  try {
    if (!window.CONFIG || !CONFIG.ALPHA_VANTAGE_KEY) {
      throw new Error("Missing CONFIG.ALPHA_VANTAGE_KEY");
    }

    const url =
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${encodeURIComponent(CONFIG.ALPHA_VANTAGE_KEY)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`AAPL http ${res.status}`);

    const data = await res.json();
    const q = data && data["Global Quote"];

    if (!q) {
      box.innerHTML = `<p>⚠️ API limit reached or unavailable.</p>`;
      return;
    }

    const price = parseFloat(q["05. price"] || "0");
    const changePercent = (q["10. change percent"] || "").trim();

    box.innerHTML = `
      <h3 style="margin:0 0 6px;">AAPL Stock</h3>
      <p style="margin:4px 0;">Price: $${price.toFixed(2)}</p>
      <p style="margin:4px 0;">Change: ${changePercent}</p>
    `;
  } catch (err) {
    console.error("AAPL error:", err);
    box.innerHTML = `<p>⚠️ Could not load stock data.</p>`;
  }
}

function initCurrencyConverter() {
  const btn = document.getElementById("convertBtn");
  const amountEl = document.getElementById("currencyAmount");
  const fromEl = document.getElementById("currencyFrom");
  const toEl = document.getElementById("currencyTo");
  const resultEl = document.getElementById("currencyResult");

  if (!btn || !amountEl || !fromEl || !toEl || !resultEl) return;

  btn.addEventListener("click", async () => {
    const amt = parseFloat(amountEl.value || "0");
    const from = fromEl.value || "USD";
    const to = toEl.value || "EUR";

    if (!Number.isFinite(amt) || amt <= 0) {
      resultEl.textContent = "Enter a valid amount.";
      return;
    }

    try {
      if (!CONFIG || !CONFIG.ALPHA_VANTAGE_KEY) {
        throw new Error("Missing CONFIG.ALPHA_VANTAGE_KEY");
      }

      const url =
        `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${encodeURIComponent(from)}&to_currency=${encodeURIComponent(to)}&apikey=${encodeURIComponent(CONFIG.ALPHA_VANTAGE_KEY)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`FX http ${res.status}`);

      const data = await res.json();
      const rateStr = data && data["Realtime Currency Exchange Rate"] && data["Realtime Currency Exchange Rate"]["5. Exchange Rate"];

      if (!rateStr) {
        resultEl.textContent = "Rate unavailable (API limit?). Try later.";
        return;
      }

      const rate = parseFloat(rateStr);
      const converted = (amt * rate).toFixed(2);
      resultEl.textContent = `${amt} ${from} = ${converted} ${to}`;
    } catch (err) {
      console.error("FX error:", err);
      resultEl.textContent = "⚠️ Conversion failed.";
    }
  });
}

async function loadExtraMarkets() {
  const cryptoBox = document.getElementById("cryptoBox");
  const commodityBox = document.getElementById("commodityBox");

  // Attempt BTC & ETH spot via AV (free plan can be rate limited)
  if (cryptoBox) {
    try {
      if (!CONFIG || !CONFIG.ALPHA_VANTAGE_KEY) throw new Error("Missing key");
      const btcURL =
        `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=BTC&to_currency=USD&apikey=${encodeURIComponent(CONFIG.ALPHA_VANTAGE_KEY)}`;
      const ethURL =
        `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=ETH&to_currency=USD&apikey=${encodeURIComponent(CONFIG.ALPHA_VANTAGE_KEY)}`;

      const [btcRes, ethRes] = await Promise.all([fetch(btcURL), fetch(ethURL)]);
      const [btcJson, ethJson] = await Promise.all([btcRes.json(), ethRes.json()]);

      const btc = parseFloat(btcJson?.["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"] || "0");
      const eth = parseFloat(ethJson?.["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"] || "0");

      if (btc && eth) {
        cryptoBox.innerHTML = `
          <h3 style="margin:0 0 6px;">Crypto</h3>
          <p style="margin:4px 0;">BTC: $${btc.toFixed(2)}</p>
          <p style="margin:4px 0;">ETH: $${eth.toFixed(2)}</p>
        `;
      } else {
        cryptoBox.innerHTML = `<p>⚠️ Crypto data rate-limited. Try later.</p>`;
      }
    } catch (e) {
      console.warn("Crypto error:", e);
      cryptoBox.innerHTML = `<p>⚠️ Could not load crypto data.</p>`;
    }
  }

  // Commodities (demo text placeholders; AV free tier doesn’t provide direct)
  if (commodityBox) {
    commodityBox.innerHTML = `
      <h3 style="margin:0 0 6px;">Commodities</h3>
      <p style="margin:4px 0;">Gold (XAU/USD): ~\$1,950</p>
      <p style="margin:4px 0;">Oil (WTI): ~\$75</p>
      <small style="opacity:.7;">(Demo values)</small>
    `;
  }
}

/* ============================================================================
   AI ASSISTANT (HuggingFace DialoGPT-medium)
   ============================================================================ */
function initAssistant() {
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const box = document.getElementById("chatbox");
  if (!form || !input || !box) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userText = (input.value || "").trim();
    if (!userText) return;

    // append user bubble
    appendChatBubble("user", userText);

    // call HF Dialog model
    try {
      if (!CONFIG || !CONFIG.HF_API_KEY) throw new Error("Missing CONFIG.HF_API_KEY");

      // Set a small placeholder while thinking
      appendChatBubble("ai", "Thinking...");

      const res = await fetch("https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CONFIG.HF_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: userText })
      });

      if (!res.ok) throw new Error(`AI http ${res.status}`);
      const data = await res.json();

      // Remove the "Thinking..." last ai bubble if present
      replaceLastAIBubble(extractDialoText(data));

    } catch (err) {
      console.error("AI error:", err);
      replaceLastAIBubble("⚠️ AI service unreachable. Check your HF key or try again later.");
    }

    // reset
    form.reset();
  });
}

/* Helper: Append chat bubble */
function appendChatBubble(role, text) {
  const box = document.getElementById("chatbox");
  if (!box) return;
  const div = document.createElement("div");
  div.className = role === "user" ? "user-msg" : "ai-msg";
  div.textContent = text;
  box.appendChild(div);
  // autoscroll
  box.scrollTop = box.scrollHeight;
}

/* Helper: Replace last AI bubble content */
function replaceLastAIBubble(text) {
  const box = document.getElementById("chatbox");
  if (!box) return;
  // Find last AI message
  const bubbles = $all("#chatbox .ai-msg");
  if (bubbles.length) {
    bubbles[bubbles.length - 1].textContent = text;
  } else {
    appendChatBubble("ai", text);
  }
}

/* Helper: Extract DialoGPT response */
function extractDialoText(apiJson) {
  try {
    // DialoGPT returns [{ generated_text: "..." }]
    const txt = apiJson?.[0]?.generated_text;
    return txt || "…";
  } catch {
    return "…";
  }
}

/* ============================================================================
   SETTINGS (Dark mode, reset, logout)
   ============================================================================ */
function initSettings() {
  const toggle = document.getElementById("toggleDark");
  const resetBtn = document.getElementById("resetData");
  const logoutBtn = document.getElementById("logout");

  if (toggle) {
    toggle.addEventListener("click", () => {
      ui.darkMode = !ui.darkMode;
      applyDarkMode();
      saveState();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const ok = confirm("This will delete all transactions and budgets. Continue?");
      if (!ok) return;

      // wipe state
      transactions = [];
      budgets = [];
      saveState();

      // re-render everything
      renderTransactionsTable();
      renderBudgets();
      renderOverviewChart();
      renderReportChart();
      updateOverviewStats();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // In this demo we simply redirect back to index.html
      window.location.href = "index.html";
    });
  }
}

/* Apply dark mode class to <body> */
function applyDarkMode() {
  if (ui.darkMode) {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}

/* ============================================================================
   INIT
   ============================================================================ */
function init() {
  // Load persisted state
  loadState();

  // Apply dark mode preference immediately (no flash)
  applyDarkMode();

  // Initialize sections
  initTabs();
  initTransactions();
  initBudget();
  initAssistant();
  initSettings();
  initCurrencyConverter();

  // Initial renders
  renderOverviewChart();
  renderReportChart();
  renderBudgets();
  updateOverviewStats();

  // External data fetches
  loadNews();
  loadAAPLQuote();
  loadExtraMarkets();

  // Fix: prevent charts from changing height on window resizes by locking once
  // (We already lock on first render; no need to handle resize events)
}

// Kick off
window.addEventListener("DOMContentLoaded", init);
