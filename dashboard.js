/* ========= Utilities & State ========= */
const FT_KEYS = {
  TX: "ft_transactions",
  BUDGETS: "ft_budgets",        // { 'YYYY-MM': number }
  SETTINGS: "ft_settings"       // { name, currency, dark }
};

const defaultSettings = { name: "", currency: "USD", dark: false };

// Seed sample data on first load
function ensureSeed() {
  if (!localStorage.getItem(FT_KEYS.TX)) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const m = today.getMonth();
    // last 6 months sample
    const cats = ["Rent","Food","Transport","Utilities","Entertainment","Health","Shopping","Other"];
    const rand = (min, max) => Math.round((Math.random()*(max-min)+min)*100)/100;
    const tx = [];
    for (let i=0;i<180;i++) {
      const d = new Date(yyyy, m, 1);
      d.setDate(1 - rand(0,150));
      const type = Math.random() < 0.25 ? "income" : "expense";
      const amount = type==="income" ? rand(200, 450) : rand(5, 120);
      tx.push({
        id: crypto.randomUUID(),
        date: d.toISOString().slice(0,10),
        desc: type==="income" ? "Pay" : ["Groceries","Coffee","Uber","Rent","Electric","Pharmacy","Cinema","Amazon"][Math.floor(Math.random()*8)],
        category: type==="income" ? "Income" : cats[Math.floor(Math.random()*cats.length)],
        type, amount
      });
    }
    localStorage.setItem(FT_KEYS.TX, JSON.stringify(tx));
  }
  if (!localStorage.getItem(FT_KEYS.BUDGETS)) {
    const map = {};
    map[ymKey(new Date())] = 2000;
    localStorage.setItem(FT_KEYS.BUDGETS, JSON.stringify(map));
  }
  if (!localStorage.getItem(FT_KEYS.SETTINGS)) {
    localStorage.setItem(FT_KEYS.SETTINGS, JSON.stringify(defaultSettings));
  }
}
ensureSeed();

const getSettings = () => JSON.parse(localStorage.getItem(FT_KEYS.SETTINGS) || JSON.stringify(defaultSettings));
const setSettings = (s) => localStorage.setItem(FT_KEYS.SETTINGS, JSON.stringify(s));

const getTx = () => JSON.parse(localStorage.getItem(FT_KEYS.TX) || "[]");
const setTx = (t) => localStorage.setItem(FT_KEYS.TX, JSON.stringify(t));

const getBudgets = () => JSON.parse(localStorage.getItem(FT_KEYS.BUDGETS) || "{}");
const setBudgets = (b) => localStorage.setItem(FT_KEYS.BUDGETS, JSON.stringify(b));

const currencySymbol = (ccy) => ({USD:"$", CAD:"C$", EUR:"€", GBP:"£", INR:"₹"}[ccy] || "$");
const fmtMoney = (n) => {
  const { currency } = getSettings();
  return `${currencySymbol(currency)}${Number(n || 0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}`;
};
const ymKey = (d) => {
  if (!(d instanceof Date)) d = new Date(d);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
};
const monthName = (ym) => {
  const [y,m] = ym.split("-").map(Number);
  return new Date(y, m-1, 1).toLocaleString(undefined,{month:"long", year:"numeric"});
};

/* ========= Theme / Init ========= */
function applyTheme() {
  const { dark } = getSettings();
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

function initSettingsUI() {
  const s = getSettings();
  const nameEl = document.getElementById("settingsName");
  const currencyEl = document.getElementById("settingsCurrency");
  const darkToggle = document.getElementById("darkModeToggle");
  const welcome = document.getElementById("welcomeUser");

  if (nameEl) nameEl.value = s.name || "";
  if (currencyEl) currencyEl.value = s.currency || "USD";
  if (darkToggle) darkToggle.checked = !!s.dark;
  if (welcome) welcome.textContent = s.name ? `Welcome, ${s.name}` : "Welcome!";
}

applyTheme();

/* ========= Tabs & Sidebar ========= */
const tabs = document.querySelectorAll(".nav-item");
const contents = document.querySelectorAll(".tab-content");
const tabTitle = document.getElementById("tab-title");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    contents.forEach(c => c.classList.remove("active"));
    const el = document.getElementById(tab.dataset.tab);
    if (el) el.classList.add("active");
    tabTitle.textContent = tab.textContent.trim();

    // refresh charts/sections when switching
    if (tab.dataset.tab === "overview") renderOverview();
    if (tab.dataset.tab === "transactions") renderTransactions();
    if (tab.dataset.tab === "budget") renderBudget();
    if (tab.dataset.tab === "reports") renderReports();
  });
});

// Collapsible sidebar on narrow screens
document.getElementById("sidebarToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("collapsed");
});

/* ========= Global Search ========= */
const globalSearch = document.getElementById("globalSearch");
globalSearch?.addEventListener("input", () => renderTransactions());

/* ========= Transactions ========= */
const txForm = document.getElementById("transactionForm");
const txMonthFilter = document.getElementById("txMonthFilter");
const txCategoryFilter = document.getElementById("txCategoryFilter");
const tbody = document.getElementById("transactionsTbody");
const txCount = document.getElementById("txCount");
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");
let pagination = { page: 1, perPage: 10, totalPages: 1 };

txForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const date = document.getElementById("txDate").value || new Date().toISOString().slice(0,10);
  const desc = document.getElementById("txDesc").value.trim();
  const amount = parseFloat(document.getElementById("txAmount").value);
  const type = document.getElementById("txType").value;
  const category = document.getElementById("txCategory").value;
  if (!desc || !amount || isNaN(amount)) return;

  const tx = getTx();
  tx.unshift({ id: crypto.randomUUID(), date, desc, amount, type, category });
  setTx(tx);

  txForm.reset();
  renderAll();
});

txMonthFilter?.addEventListener("change", () => { pagination.page = 1; renderTransactions(); });
txCategoryFilter?.addEventListener("change", () => { pagination.page = 1; renderTransactions(); });
prevPageBtn?.addEventListener("click", () => { if (pagination.page>1){ pagination.page--; renderTransactions(); }});
nextPageBtn?.addEventListener("click", () => { if (pagination.page<pagination.totalPages){ pagination.page++; renderTransactions(); }});

function filteredTx() {
  const q = (globalSearch?.value || "").toLowerCase();
  const ym = txMonthFilter?.value || "";
  const cat = txCategoryFilter?.value || "";
  return getTx().filter(t => {
    const matchQ = !q || t.desc.toLowerCase().includes(q);
    const matchM = !ym || ymKey(t.date) === ym;
    const matchC = !cat || t.category === cat;
    return matchQ && matchM && matchC;
  }).sort((a,b) => b.date.localeCompare(a.date));
}

function renderTransactions() {
  if (!tbody) return;
  const data = filteredTx();
  pagination.totalPages = Math.max(1, Math.ceil(data.length / pagination.perPage));
  pagination.page = Math.min(pagination.page, pagination.totalPages);
  const start = (pagination.page-1)*pagination.perPage;
  const pageItems = data.slice(start, start + pagination.perPage);

  tbody.innerHTML = pageItems.map(t => `
    <tr>
      <td>${t.date}</td>
      <td>${escapeHtml(t.desc)}</td>
      <td>${t.category}</td>
      <td>${t.type === "income" ? `<span class="badge good">Income</span>` : `<span class="badge bad">Expense</span>`}</td>
      <td class="right">${fmtMoney(t.amount)}</td>
      <td class="right">
        <button class="btn btn-ghost btn-sm" data-del="${t.id}" title="Delete"><i data-lucide="trash-2"></i></button>
      </td>
    </tr>
  `).join("");

  // update footer
  txCount.textContent = `${data.length} items`;
  pageInfo.textContent = `${pagination.page} / ${pagination.totalPages}`;

  // re-render icons for newly injected nodes
  if (window.lucide) lucide.createIcons();

  // delete handlers
  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      const tx = getTx().filter(x => x.id !== id);
      setTx(tx);
      renderAll();
    });
  });
}

function escapeHtml(s){ return s.replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;", ">":"&gt;", '"':"&quot;","'":"&#039;" }[m])); }

/* ========= Budget ========= */
const budgetForm = document.getElementById("budgetForm");
const budgetMonth = document.getElementById("budgetMonth");
const budgetAmount = document.getElementById("budgetAmount");
const budgetLabel = document.getElementById("budgetLabel");
const budgetMeta = document.getElementById("budgetMeta");
const budgetBar = document.getElementById("budgetBar");
const budgetSpent = document.getElementById("budgetSpent");
const budgetRemaining = document.getElementById("budgetRemaining");
const budgetUtilization = document.getElementById("budgetUtilization");
const budgetsTbody = document.getElementById("budgetsTbody");

budgetForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const ym = budgetMonth.value || ymKey(new Date());
  const amt = parseFloat(budgetAmount.value);
  if (!amt || amt <= 0) return;
  const b = getBudgets();
  b[ym] = amt;
  setBudgets(b);
  renderBudget();
  renderOverview();
  renderReports();
});

function spentForMonth(ym) {
  return getTx().filter(t => t.type==="expense" && ymKey(t.date)===ym)
    .reduce((s,t)=>s+t.amount, 0);
}

function renderBudget() {
  const ym = budgetMonth?.value || ymKey(new Date());
  const b = getBudgets();
  const limit = b[ym] || 0;
  const spent = spentForMonth(ym);
  const remaining = Math.max(0, limit - spent);
  const pct = limit ? Math.min(100, Math.round(spent/limit*100)) : 0;

  budgetLabel.textContent = `${monthName(ym)} Budget`;
  budgetMeta.textContent = limit ? `${fmtMoney(limit)} total` : "No budget set";
  budgetBar.style.width = pct + "%";
  budgetBar.style.background = pct >= 100 ? "linear-gradient(90deg, var(--bad), #f97316)" :
                                pct >= 80 ? "linear-gradient(90deg, var(--warn), #facc15)" :
                                            "linear-gradient(90deg, var(--brand), var(--brand-2))";
  budgetSpent.textContent = fmtMoney(spent);
  budgetRemaining.textContent = fmtMoney(remaining);
  budgetUtilization.textContent = limit ? `${pct}%` : "—";

  // table of budgets
  const rows = Object.keys(b).sort().map(key => {
    const s = spentForMonth(key);
    return `
      <tr>
        <td>${monthName(key)}</td>
        <td class="right">${fmtMoney(b[key])}</td>
        <td class="right">${fmtMoney(s)}</td>
        <td class="right">${fmtMoney(Math.max(0, b[key]-s))}</td>
      </tr>
    `;
  }).join("");
  budgetsTbody.innerHTML = rows || `<tr><td colspan="4" class="muted">No budgets yet</td></tr>`;
}

/* ========= Overview KPIs & Charts ========= */
let expenseByCategoryChart, incomeVsExpensesChart, topCategoriesChart;

function totalsForMonth(ym) {
  const tx = getTx().filter(t => ymKey(t.date)===ym);
  const income = tx.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense = tx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  return { income, expense, savingsRate: income ? Math.max(0, Math.round((1 - (expense/income))*100)) : 0 };
}

function renderOverview() {
  const nowYm = ymKey(new Date());
  const prevYm = ymKey(new Date(new Date().getFullYear(), new Date().getMonth()-1, 1));
  const { income, expense, savingsRate } = totalsForMonth(nowYm);
  const prev = totalsForMonth(prevYm);

  document.getElementById("kpi-balance").textContent = fmtMoney(totalBalance());
  document.getElementById("kpi-income").textContent = fmtMoney(income);
  document.getElementById("kpi-expenses").textContent = fmtMoney(expense);
  document.getElementById("kpi-savings-rate").textContent = savingsRate + "%";
  setDelta("kpi-income-delta", income - (prev.income||0));
  setDelta("kpi-expenses-delta", expense - (prev.expense||0));

  // Charts
  const byCat = groupByCategory(nowYm);
  drawPie("expenseByCategoryChart", byCat.labels, byCat.values, (c)=>expenseByCategoryChart=c);

  const last6 = lastNMonthsTotals(6);
  drawBar("incomeVsExpensesChart",
    last6.labels,
    [
      { label: "Income", data: last6.incomes },
      { label: "Expenses", data: last6.expenses }
    ],
    (c)=>incomeVsExpensesChart=c
  );
}

function totalBalance() {
  const tx = getTx();
  const inc = tx.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const exp = tx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  return inc - exp;
}
function setDelta(id, d) {
  const el = document.getElementById(id);
  if (!el) return;
  const sign = d>0 ? "+" : d<0 ? "−" : "";
  el.textContent = `${sign}${fmtMoney(Math.abs(d))}`;
  el.style.color = d>=0 ? "var(--good)" : "var(--bad)";
}
function groupByCategory(ym) {
  const map = {};
  getTx().filter(t=>t.type==="expense" && ymKey(t.date)===ym)
    .forEach(t=> map[t.category] = (map[t.category]||0) + t.amount);
  const labels = Object.keys(map);
  const values = labels.map(k=>Math.round(map[k]*100)/100);
  return { labels, values };
}
function lastNMonthsTotals(n) {
  const labels=[], incomes=[], expenses=[];
  const d=new Date();
  for(let i=n-1;i>=0;i--){
    const dt=new Date(d.getFullYear(), d.getMonth()-i, 1);
    const ym=ymKey(dt);
    const t=totalsForMonth(ym);
    labels.push(dt.toLocaleString(undefined,{month:"short"}));
    incomes.push(Math.round(t.income*100)/100);
    expenses.push(Math.round(t.expense*100)/100);
  }
  return { labels, incomes, expenses };
}

/* ========= Reports ========= */
function renderReports() {
  // Auto summary bullets
  const tx = getTx();
  const y = new Date().getFullYear();
  const ytd = tx.filter(t => new Date(t.date).getFullYear() === y);
  const totalInc = ytd.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const totalExp = ytd.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const top = (() => {
    const map={};
    ytd.filter(t=>t.type==="expense").forEach(t=>map[t.category]=(map[t.category]||0)+t.amount);
    const arr = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5);
    return arr;
  })();

  const summary = [
    `YTD Income: <strong>${fmtMoney(totalInc)}</strong>`,
    `YTD Expenses: <strong>${fmtMoney(totalExp)}</strong>`,
    `Net Savings: <strong>${fmtMoney(totalInc-totalExp)}</strong>`,
    top[0] ? `Top spending category: <strong>${top[0][0]}</strong> (${fmtMoney(top[0][1])})` : `No expenses recorded yet`,
    `Average monthly expense: <strong>${fmtMoney(avgMonthly("expense"))}</strong>`,
    `Average monthly income: <strong>${fmtMoney(avgMonthly("income"))}</strong>`
  ];
  document.getElementById("reportsSummary").innerHTML = summary.map(s=>`<li>${s}</li>`).join("");

  // Top categories chart
  const catMap = {};
  ytd.filter(t=>t.type==="expense").forEach(t=>catMap[t.category]=(catMap[t.category]||0)+t.amount);
  const labels = Object.keys(catMap);
  const values = labels.map(k=>Math.round(catMap[k]*100)/100);
  drawBar("topCategoriesChart", labels, [{ label: "Expenses", data: values }], (c)=>topCategoriesChart=c);
}

function avgMonthly(type) {
  const tx = getTx().filter(t=>t.type===type);
  if (tx.length===0) return 0;
  const set = new Set(tx.map(t=>ymKey(t.date)));
  const months = set.size || 1;
  const total = tx.reduce((s,t)=>s+t.amount,0);
  return total/months;
}

/* ========= Charts Helpers ========= */
function destroyIfExists(chartRef) {
  if (chartRef && chartRef.destroy) chartRef.destroy();
}
function drawPie(canvasId, labels, data, setRef) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  destroyIfExists(window[canvasId]);
  const c = new Chart(ctx, {
    type: "pie",
    data: { labels, datasets: [{ data }]},
    options: {
      plugins: { legend: { position: "bottom", labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text') } } }
    }
  });
  setRef(c); window[canvasId]=c;
}
function drawBar(canvasId, labels, datasets, setRef) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  destroyIfExists(window[canvasId]);
  const c = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: datasets.map((d,i)=>({
        ...d,
        borderWidth: 1
      }))
    },
    options: {
      responsive: true,
      scales: {
        x: { ticks: { color: getCss('--text') }, grid: { color: getCss('--border') } },
        y: { ticks: { color: getCss('--text') }, grid: { color: getCss('--border') } }
      },
      plugins: {
        legend: { labels: { color: getCss('--text') } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)}` } }
      }
    }
  });
  setRef(c); window[canvasId]=c;
}
function getCss(varName){ return getComputedStyle(document.documentElement).getPropertyValue(varName).trim(); }

/* ========= Assistant (rule-based placeholder) ========= */
const assistantForm = document.getElementById("assistantForm");
const assistantPrompt = document.getElementById("assistantPrompt");
const assistantLog = document.getElementById("assistantLog");

assistantForm?.addEventListener("submit", (e)=>{
  e.preventDefault();
  const q = assistantPrompt.value.trim();
  if (!q) return;
  pushAssistantMsg("user", q);
  const a = answerLocally(q);
  pushAssistantMsg("bot", a);
  assistantPrompt.value = "";
  assistantLog.scrollTop = assistantLog.scrollHeight;
});

function pushAssistantMsg(role, text){
  const div = document.createElement("div");
  div.className = `assistant-msg ${role}`;
  div.innerHTML = role==="user" ? `<strong>You:</strong> ${escapeHtml(text)}` : `<strong>Assistant:</strong> ${text}`;
  assistantLog.appendChild(div);
}
function answerLocally(q){
  // Very naive rules to demo UX
  const lower = q.toLowerCase();
  const now = ymKey(new Date());
  if (lower.includes("food")) {
    const total = getTx().filter(t=>t.type==="expense" && t.category==="Food").reduce((s,t)=>s+t.amount,0);
    const month = getTx().filter(t=>t.type==="expense" && t.category==="Food" && ymKey(t.date)===now).reduce((s,t)=>s+t.amount,0);
    return `You’ve spent ${fmtMoney(month)} on Food this month, ${fmtMoney(total)} total YTD.`;
  }
  if (lower.includes("this month")) {
    const t = totalsForMonth(now);
    return `This month: Income ${fmtMoney(t.income)}, Expenses ${fmtMoney(t.expense)}, Savings rate ${t.savingsRate}%.`;
  }
  if (lower.includes("largest") || lower.includes("biggest")) {
    const exp = getTx().filter(t=>t.type==="expense").sort((a,b)=>b.amount-a.amount)[0];
    return exp ? `Your largest expense is ${fmtMoney(exp.amount)} for ${escapeHtml(exp.desc)} on ${exp.date}.` : "No expenses yet.";
  }
  if (lower.includes("balance")) {
    return `Your current total balance is ${fmtMoney(totalBalance())}.`;
  }
  return "I can answer basic questions about your spending (e.g., “Food this month”, “largest expense”, “balance”, “this month”). We’ll upgrade this to real AI next.";
}

/* ========= Settings, Export, Reset ========= */
document.getElementById("saveSettings")?.addEventListener("click", ()=>{
  const name = document.getElementById("settingsName").value.trim();
  const currency = document.getElementById("settingsCurrency").value;
  const dark = document.getElementById("darkModeToggle").checked;
  setSettings({ name, currency, dark });
  applyTheme();
  initSettingsUI();
  renderAll();
});

document.getElementById("darkModeToggle")?.addEventListener("change", (e)=>{
  const s = getSettings(); s.dark = e.target.checked; setSettings(s); applyTheme();
  // Repaint charts for theme contrast
  renderOverview(); renderReports();
});

document.getElementById("exportData")?.addEventListener("click", ()=>{
  const data = {
    transactions: getTx(),
    budgets: getBudgets(),
    settings: getSettings()
  };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "finance-tracker-backup.json"; a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("resetData")?.addEventListener("click", ()=>{
  if (!confirm("Reset all data? This cannot be undone.")) return;
  localStorage.removeItem(FT_KEYS.TX);
  localStorage.removeItem(FT_KEYS.BUDGETS);
  localStorage.removeItem(FT_KEYS.SETTINGS);
  ensureSeed();
  applyTheme();
  initSettingsUI();
  renderAll();
});

/* ========= Reports Charts Hook ========= */
function renderTopCategoriesChart() {
  // handled inside renderReports()
}

/* ========= Table badges small style ========= */
const style = document.createElement("style");
style.textContent = `
.badge { padding: 4px 8px; border-radius: 999px; font-size: 12px; }
.badge.good { background: rgba(31,191,117,.16); color: var(--good); border:1px solid rgba(31,191,117,.35); }
.badge.bad { background: rgba(255,92,92,.16); color: var(--bad); border:1px solid rgba(255,92,92,.35); }
.btn-sm { padding: 6px 8px; }
`;
document.head.appendChild(style);

/* ========= Initial boot ========= */
function renderAll(){
  initSettingsUI();
  renderOverview();
  renderTransactions();
  renderBudget();
  renderReports();
  if (window.lucide) lucide.createIcons();
}
(function boot(){
  // set default inputs
  const today = new Date().toISOString().slice(0,10);
  const ym = ymKey(new Date());
  const txDate = document.getElementById("txDate");
  const monthFilter = document.getElementById("txMonthFilter");
  const budgetMonth = document.getElementById("budgetMonth");
  if (txDate) txDate.value = today;
  if (monthFilter) monthFilter.value = ym;
  if (budgetMonth) budgetMonth.value = ym;

  renderAll();
})();

/* ========= Logout (placeholder) ========= */
document.getElementById("logout")?.addEventListener("click", ()=>{
  // If you have auth.js managing sessions, call its logout here.
  // For now, just redirect to index.html
  window.location.href = "index.html";
});
