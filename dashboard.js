/* ========= Helpers ========= */
const $ = (id)=>document.getElementById(id);
const els = {
  balance: $("balance"), income: $("income"), expenses: $("expenses"),
  txList: $("transactionList"), budgetProgress: $("budgetProgress"), budgetStatus: $("budgetStatus"),
  miniBudgetProgress: $("miniBudgetProgress"), miniBudgetLabel: $("miniBudgetLabel"),
};
function save(){ localStorage.setItem("transactions", JSON.stringify(transactions)); if (budget!=null) localStorage.setItem("budget", String(budget)); }
function fmt(n){ return "$" + Number(n||0).toFixed(2); }
async function fetchJSON(url, opts={}, timeout=15000){
  const ctl = new AbortController();
  const t = setTimeout(()=>ctl.abort(), timeout);
  try{
    const res = await fetch(url, { ...opts, signal: ctl.signal });
    if (!res.ok) throw new Error(res.status + " " + res.statusText);
    return await res.json();
  } finally { clearTimeout(t); }
}

/* ========= State ========= */
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let budget = localStorage.getItem("budget") ? parseFloat(localStorage.getItem("budget")) : null;

/* ========= Tabs (sidebar buttons) ========= */
document.querySelectorAll(".sidebar nav button").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    $(btn.dataset.tab).classList.add("active");
  });
});

/* ========= Dark Mode ========= */
const toggleDarkBtn = $("toggleDark");
if (toggleDarkBtn){
  toggleDarkBtn.addEventListener("click", ()=>{
    document.body.classList.toggle("dark");
    localStorage.setItem("darkMode", document.body.classList.contains("dark"));
  });
}
if (localStorage.getItem("darkMode")==="true"){ document.body.classList.add("dark"); }

/* ========= Account ========= */
$("logout").addEventListener("click", ()=>{
  localStorage.removeItem("currentUser");
  window.location.href = "index.html";
});
$("resetData").addEventListener("click", ()=>{
  if (confirm("Are you sure you want to delete ALL data?")){
    localStorage.removeItem("transactions");
    localStorage.removeItem("budget");
    transactions = [];
    budget = null;
    renderTransactions(); updateAll();
  }
});

/* ========= Transactions ========= */
$("transactionForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const desc = $("tDesc").value.trim();
  const amount = parseFloat($("tAmount").value);
  const type = $("tType").value;
  const month = $("tMonth").value;
  let category = $("tCategory").value;

  if (!category){
    try { category = await aiCategorize(desc); } catch { category = ruleCategorize(desc); }
    if (type === "income" && category !== "Income") category = "Income";
  }

  transactions.push({ desc, amount, type, category, month });
  save();
  e.target.reset();
  renderTransactions(); updateAll();
});

function renderTransactions(){
  els.txList.innerHTML = "";
  transactions.forEach((t,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.desc}</td>
      <td>${fmt(t.amount)}</td>
      <td>${t.type}</td>
      <td>${t.category}</td>
      <td>${t.month}</td>
      <td><button class="danger" data-del="${i}">❌</button></td>
    `;
    els.txList.appendChild(tr);
  });
  els.txList.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click",(ev)=>{
      const idx = parseInt(ev.currentTarget.dataset.del,10);
      transactions.splice(idx,1); save(); renderTransactions(); updateAll();
    });
  });
}

/* ========= Budget ========= */
$("budgetForm").addEventListener("submit",(e)=>{
  e.preventDefault();
  budget = parseFloat($("budgetAmount").value);
  save(); updateBudget();
});
function updateBudget(){
  const spent = transactions.filter(t=>t.type==="expense").reduce((a,b)=>a+b.amount,0);
  if (!budget || budget<=0){
    $("budgetStatus").textContent = "No budget set";
    $("budgetProgress").style.width = "0%";
    els.miniBudgetProgress.style.width = "0%";
    els.miniBudgetLabel.textContent = "No budget set";
    return;
  }
  const pct = Math.min(100, (spent/budget)*100);
  $("budgetStatus").textContent = `Spent ${fmt(spent)} of ${fmt(budget)} (${pct.toFixed(0)}%)`;
  $("budgetProgress").style.width = pct + "%";
  els.miniBudgetProgress.style.width = pct + "%";
  els.miniBudgetLabel.textContent = `${pct.toFixed(0)}% used`;
}

/* ========= Overview & Reports ========= */
let lineChart, pieChart, reportPie;
function updateOverview(){
  const income  = transactions.filter(t=>t.type==="income").reduce((a,b)=>a+b.amount,0);
  const expense = transactions.filter(t=>t.type==="expense").reduce((a,b)=>a+b.amount,0);
  const balance = income - expense;
  els.balance.textContent  = fmt(balance);
  $("income").textContent   = fmt(income);
  $("expenses").textContent = fmt(expense);
}
function updateCharts(){
  const monthly = {};
  transactions.forEach(t=>{
    if (!monthly[t.month]) monthly[t.month]={income:0,expense:0};
    monthly[t.month][t.type]+=t.amount;
  });
  const labels = Object.keys(monthly).sort();
  const incomeData  = labels.map(m=>monthly[m].income);
  const expenseData = labels.map(m=>monthly[m].expense);

  if (lineChart) lineChart.destroy();
  lineChart = new Chart($("lineChart"), {
    type:"line",
    data:{ labels, datasets:[
      {label:"Income", data:incomeData, borderColor:"#10b981", fill:false, tension:.2},
      {label:"Expenses", data:expenseData, borderColor:"#ef4444", fill:false, tension:.2},
    ]},
    options:{ maintainAspectRatio:false, plugins:{legend:{display:true}} }
  });

  const byCat = {};
  transactions.filter(t=>t.type==="expense").forEach(t=>{
    byCat[t.category]=(byCat[t.category]||0)+t.amount;
  });
  if (pieChart) pieChart.destroy();
  pieChart = new Chart($("pieChart"), {
    type:"pie",
    data:{ labels:Object.keys(byCat), datasets:[{ data:Object.values(byCat) }] },
    options:{ plugins:{legend:{position:"bottom"}} }
  });

  if (reportPie) reportPie.destroy();
  reportPie = new Chart($("reportPie"), {
    type:"doughnut",
    data:{ labels:Object.keys(byCat), datasets:[{ data:Object.values(byCat) }] },
    options:{ plugins:{legend:{position:"bottom"}} }
  });
}
function updateReports(){
  const income  = transactions.filter(t=>t.type==="income").reduce((a,b)=>a+b.amount,0);
  const expense = transactions.filter(t=>t.type==="expense").reduce((a,b)=>a+b.amount,0);
  const savingsRate = income>0 ? ((income-expense)/income*100).toFixed(1) : 0;

  const catTotals={};
  transactions.filter(t=>t.type==="expense").forEach(t=>{ catTotals[t.category]=(catTotals[t.category]||0)+t.amount; });
  const topCat = Object.keys(catTotals).length
    ? Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0][0]
    : "N/A";

  $("reportIncome").textContent   = fmt(income);
  $("reportExpenses").textContent = fmt(expense);
  $("reportSavings").textContent  = `${savingsRate}%`;
  $("reportTopCat").textContent   = topCat;
}
function updateAll(){ updateOverview(); updateBudget(); updateCharts(); updateReports(); }

/* ========= Currency (open.er-api.com) + Converter ========= */
const ISO_CURRENCIES = ["USD","EUR","GBP","CAD","AUD","JPY","INR","CHF","CNY","SEK","NZD","MXN"];
let fxCache = null;

function populateFxSelects(){
  const from = $("fxFrom"), to = $("fxTo");
  from.innerHTML = ""; to.innerHTML = "";
  ISO_CURRENCIES.forEach(c=>{
    const o1=document.createElement("option"); o1.value=o1.textContent=c; from.appendChild(o1);
    const o2=document.createElement("option"); o2.value=o2.textContent=c; to.appendChild(o2);
  });
  from.value="USD"; to.value="EUR";
}
populateFxSelects();

async function getFxRates(base="USD"){
  try{
    const data = await fetchJSON(`https://open.er-api.com/v6/latest/${base}`);
    if (data?.result==="success") return data.rates;
    throw new Error("FX failed");
  }catch{
    // offline fallback: identity rates
    const rates = {}; ISO_CURRENCIES.forEach(c=>rates[c]= c===base ? 1 : NaN); return rates;
  }
}
$("fxForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const amt = parseFloat($("fxAmount").value)||0;
  const from = $("fxFrom").value, to = $("fxTo").value;
  fxCache = await getFxRates(from);
  const rate = fxCache[to];
  $("fxResult").textContent = isFinite(rate) ? `${amt} ${from} ≈ ${(amt*rate).toFixed(2)} ${to}` : "Conversion unavailable right now.";
});

/* ========= Markets ========= */
// Crypto via CoinGecko
async function loadCrypto(){
  try{
    const data = await fetchJSON("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd");
    $("btcPrice").textContent = "$" + data.bitcoin.usd.toLocaleString();
    $("ethPrice").textContent = "$" + data.ethereum.usd.toLocaleString();
  }catch{ $("btcPrice").textContent="—"; $("ethPrice").textContent="—"; }
}
// Stock via Alpha Vantage
async function loadStock(sym="AAPL"){
  if (!CONFIG.ALPHA_VANTAGE_KEY){ $("stockPrice").textContent="Set API key"; return; }
  try{
    const data = await fetchJSON(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(sym)}&apikey=${CONFIG.ALPHA_VANTAGE_KEY}`);
    const q = data["Global Quote"];
    const price = q ? parseFloat(q["05. price"]) : NaN;
    $("stockPrice").textContent = isFinite(price) ? "$"+price.toFixed(2) : "—";
    $("stockSymbolLabel").textContent = sym.toUpperCase();
  }catch{ $("stockPrice").textContent="—"; }
}
$("stockForm").addEventListener("submit",(e)=>{
  e.preventDefault();
  const sym = $("stockSymbol").value.trim() || "AAPL";
  loadStock(sym);
});

/* ========= News (Financial Modeling Prep) ========= */
async function loadNews(query="finance"){
  const list = $("newsList");
  list.innerHTML = "";
  try{
    // FMP doesn't support arbitrary queries in stock_news; we'll filter on the client
    const url = `https://financialmodelingprep.com/api/v3/stock_news?limit=50&apikey=${CONFIG.FMP_API_KEY || "demo"}`;
    const data = await fetchJSON(url);
    const items = (data || []).filter(a=>{
      if (!query) return true;
      const s = (a.title+" "+(a.text||"") ).toLowerCase();
      return s.includes(query.toLowerCase());
    }).slice(0,12);

    if (!items.length){ list.innerHTML = "<p class='muted'>No stories found.</p>"; return; }

    items.forEach(a=>{
      const card = document.createElement("div");
      card.className = "news-card";
      card.innerHTML = `
        <img src="${a.image || 'https://via.placeholder.com/80'}" alt="" />
        <div>
          <a href="${a.url}" target="_blank"><strong>${a.title || "Untitled"}</strong></a>
          <p class="muted">${a.site || "Source"} · ${new Date(a.publishedDate).toLocaleString()}</p>
        </div>`;
      list.appendChild(card);
    });
  }catch(err){
    list.innerHTML = "<p class='muted'>Failed to load news.</p>";
  }
}
$("newsForm").addEventListener("submit",(e)=>{
  e.preventDefault();
  const q = $("newsQuery").value.trim();
  loadNews(q || "finance");
});

/* ========= AI: Categorizer (HF) with local fallback ========= */
function ruleCategorize(d){
  const s=d.toLowerCase();
  if (/(salary|paycheck|pay|income|refund)/.test(s)) return "Income";
  if (/(uber|bus|train|gas|fuel|lyft|taxi)/.test(s)) return "Transport";
  if (/(netflix|movie|game|spotify|cinema|concert)/.test(s)) return "Entertainment";
  if (/(rent|electric|water|internet|bill)/.test(s)) return "Bills";
  if (/(amazon|mall|store|clothes|shoe|buy)/.test(s)) return "Shopping";
  if (/(food|pizza|burger|restaurant|grocer|coffee|cafe)/.test(s)) return "Food";
  return "Other";
}
async function aiCategorize(text){
  if (!CONFIG.HF_API_KEY) throw new Error("No HF key");
  const labels = ["Food","Transport","Entertainment","Bills","Shopping","Other","Income"];
  const res = await fetch("https://api-inference.huggingface.co/models/facebook/bart-large-mnli",{
    method:"POST",
    headers:{ "Authorization":`Bearer ${CONFIG.HF_API_KEY}`,"Content-Type":"application/json"},
    body: JSON.stringify({ inputs: text, parameters:{ candidate_labels: labels.join(", "), multi_label:false }})
  });
  if (res.status===401) throw new Error("HF unauthorized");
  const data = await res.json();
  if (data?.labels?.length) return data.labels[0]==="Income"?"Income":data.labels[0];
  throw new Error("HF classify failed");
}

/* ========= AI Assistant (HF) with local fallback ========= */
$("aiAsk").addEventListener("click", async ()=>{
  const q = $("aiInput").value.trim();
  const out = $("aiAnswer");
  if (!q){ out.textContent="Ask me something about your finances."; return; }
  out.textContent = "Thinking...";
  try{
    const answer = await aiAssistantAnswer(q);
    out.textContent = answer;
  }catch{
    out.textContent = localAssistant(q);
  }
});
function localAssistant(question){
  // Simple on-device “AI” using your data
  const byCat={}; const byMonth={};
  transactions.forEach(t=>{
    if (t.type==="expense"){ byCat[t.category]=(byCat[t.category]||0)+t.amount; }
    byMonth[t.month]=(byMonth[t.month]||0)+(t.type==="expense"?t.amount:-t.amount);
  });
  const topCat = Object.keys(byCat).length ? Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0][0] : "N/A";
  const totalIncome = transactions.filter(t=>t.type==="income").reduce((a,b)=>a+b.amount,0);
  const totalExpense= transactions.filter(t=>t.type==="expense").reduce((a,b)=>a+b.amount,0);
  const balance = totalIncome-totalExpense;

  return [
    "AI service unreachable, here’s a quick local analysis:",
    `• Balance: ${fmt(balance)}  • Income: ${fmt(totalIncome)}  • Expenses: ${fmt(totalExpense)}`,
    `• Top expense category: ${topCat}`,
    `• Monthly net: ${Object.entries(byMonth).map(([m,v])=>`${m||"—"}=${fmt(v)}`).join(", ")}`
  ].join("\n");
}
async function aiAssistantAnswer(question){
  if (!CONFIG.HF_API_KEY) throw new Error("No HF key");
  const income  = transactions.filter(t=>t.type==="income").reduce((a,b)=>a+b.amount,0).toFixed(2);
  const expense = transactions.filter(t=>t.type==="expense").reduce((a,b)=>a+b.amount,0).toFixed(2);
  const byCat = {};
  transactions.filter(t=>t.type==="expense").forEach(t=>{ byCat[t.category]=(byCat[t.category]||0)+t.amount; });
  const context = `
You are a helpful personal finance assistant. Use the user's ledger to answer briefly with numbers and tips.
Ledger summary:
- Total income: $${income}
- Total expenses: $${expense}
- By category: ${JSON.stringify(byCat)}
- Monthly breakdown: ${JSON.stringify(groupByMonth(transactions))}
Question: ${question}
  `.trim();

  const res = await fetch("https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",{
    method:"POST",
    headers:{ "Authorization":`Bearer ${CONFIG.HF_API_KEY}`,"Content-Type":"application/json"},
    body: JSON.stringify({ inputs: context, parameters:{ max_new_tokens: 220, temperature: 0.4 } })
  });
  if (res.status===401) throw new Error("HF unauthorized");
  const data = await res.json();
  const text = Array.isArray(data) ? data[0]?.generated_text : data.generated_text || "";
  return text ? text.split("Question:").pop().trim() : "No answer.";
}
function groupByMonth(tx){
  const out={}; tx.forEach(t=>{ if (!out[t.month]) out[t.month]={income:0,expense:0}; out[t.month][t.type]+=t.amount; }); return out;
}

/* ========= Init ========= */
function guardLoggedIn(){
  // Optional gate: if you want to require login
  // const u = JSON.parse(localStorage.getItem("currentUser")||"null");
  // if (!u) window.location.href="index.html";
}
guardLoggedIn();

renderTransactions(); updateAll();
loadCrypto(); loadStock("AAPL"); loadNews(); // defaults
setInterval(loadCrypto, 60_000);
