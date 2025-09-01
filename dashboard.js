/* ========= Quick DOM ========= */
const $ = (id)=>document.getElementById(id);

/* ========= State ========= */
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let budget = localStorage.getItem("budget") ? parseFloat(localStorage.getItem("budget")) : null;
let catBudgets = JSON.parse(localStorage.getItem("catBudgets")||"{}");

/* ========= Utilities ========= */
function save(){
  localStorage.setItem("transactions", JSON.stringify(transactions));
  if (budget!=null) localStorage.setItem("budget", String(budget));
  localStorage.setItem("catBudgets", JSON.stringify(catBudgets));
}
function fmt(n){ return "$" + Number(n||0).toFixed(2); }
async function fetchJSON(url, opts={}, timeout=15000){
  const ctl = new AbortController(); const t=setTimeout(()=>ctl.abort(), timeout);
  try{ const res = await fetch(url, {...opts, signal:ctl.signal}); if(!res.ok) throw new Error(res.status); return await res.json(); }
  finally{ clearTimeout(t); }
}

/* ========= Tabs ========= */
document.querySelectorAll(".sidebar nav button").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    $(btn.dataset.tab).classList.add("active");
  });
});

/* ========= Dark Mode ========= */
$("toggleDark")?.addEventListener("click", ()=>{
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
});
if (localStorage.getItem("darkMode")==="true"){ document.body.classList.add("dark"); }

/* ========= Account ========= */
$("logout")?.addEventListener("click", ()=>{
  localStorage.removeItem("currentUser");
  window.location.href="index.html";
});
$("resetData")?.addEventListener("click", ()=>{
  if (confirm("Delete ALL data? This cannot be undone.")){
    localStorage.removeItem("transactions");
    localStorage.removeItem("budget");
    localStorage.removeItem("catBudgets");
    transactions=[]; budget=null; catBudgets={};
    renderTransactions(); updateAll(); drawCatBudgetBars();
  }
});

/* ========= Transactions ========= */
$("transactionForm")?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const desc = $("tDesc").value.trim();
  const amount = parseFloat($("tAmount").value);
  const type = $("tType").value;
  const month = $("tMonth").value;
  let category = $("tCategory").value;

  if (!category){
    try{ category = await aiCategorize(desc); }catch{ category = ruleCategorize(desc); }
    if (type==="income") category = "Income";
  }
  transactions.push({ desc, amount, type, category, month });
  save(); e.target.reset();
  renderTransactions(); updateAll();
});

function renderTransactions(){
  const tbody = $("transactionList"); tbody.innerHTML="";
  if (!transactions.length){ tbody.innerHTML = `<tr><td colspan="6" class="muted">No transactions yet.</td></tr>`; return; }
  transactions.forEach((t,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.desc}</td>
      <td>${fmt(t.amount)}</td>
      <td>${t.type}</td>
      <td>${t.category}</td>
      <td>${t.month}</td>
      <td><button class="danger" data-del="${i}">Delete</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", (ev)=>{
      const idx = parseInt(ev.currentTarget.dataset.del,10);
      transactions.splice(idx,1); save(); renderTransactions(); updateAll();
    });
  });
}

/* ========= Budget (total + per category) ========= */
$("budgetForm")?.addEventListener("submit",(e)=>{
  e.preventDefault();
  budget = parseFloat($("budgetAmount").value);
  save(); updateBudget();
});
$("catBudgetForm")?.addEventListener("submit",(e)=>{
  e.preventDefault();
  catBudgets = {
    Food: parseFloat($("budFood").value)||0,
    Transport: parseFloat($("budTransport").value)||0,
    Entertainment: parseFloat($("budEntertainment").value)||0,
    Bills: parseFloat($("budBills").value)||0,
    Shopping: parseFloat($("budShopping").value)||0,
    Other: parseFloat($("budOther").value)||0
  };
  save(); drawCatBudgetBars();
});
function updateBudget(){
  const spent = transactions.filter(t=>t.type==="expense").reduce((a,b)=>a+b.amount,0);
  if (!budget || budget<=0){
    $("budgetStatus").textContent = "No budget set";
    $("budgetProgress").style.width = "0%";
    $("miniBudgetProgress").style.width = "0%";
    $("miniBudgetLabel").textContent = "No budget set";
    return;
  }
  const pct = Math.min(100, (spent/budget)*100);
  $("budgetStatus").textContent = `Spent ${fmt(spent)} of ${fmt(budget)} (${pct.toFixed(0)}%)`;
  $("budgetProgress").style.width = pct + "%";
  $("miniBudgetProgress").style.width = pct + "%";
  $("miniBudgetLabel").textContent = `${pct.toFixed(0)}% used`;
}
function drawCatBudgetBars(){
  const wrap = $("catBudgetBars"); wrap.innerHTML="";
  const totals = {};
  transactions.filter(t=>t.type==="expense").forEach(t=>{
    totals[t.category]=(totals[t.category]||0)+t.amount;
  });
  ["Food","Transport","Entertainment","Bills","Shopping","Other"].forEach(cat=>{
    const limit = catBudgets[cat]||0;
    const spent = totals[cat]||0;
    const pct = limit>0 ? Math.min(100, (spent/limit)*100) : 0;
    const box = document.createElement("div"); box.className="cat-bar";
    box.innerHTML = `
      <div><strong>${cat}</strong> — ${limit? `${fmt(spent)} / ${fmt(limit)} (${pct.toFixed(0)}%)` : "No budget set"}</div>
      <div class="progress-bar"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent-2));border-radius:999px;"></div></div>
    `;
    wrap.appendChild(box);
  });
}

/* ========= Overview & Reports (fixed-size charts) ========= */
let lineChart, pieChart, reportPie, reportBar;

function updateOverview(){
  const income  = transactions.filter(t=>t.type==="income").reduce((a,b)=>a+b.amount,0);
  const expense = transactions.filter(t=>t.type==="expense").reduce((a,b)=>a+b.amount,0);
  const balance = income - expense;
  $("balance").textContent  = fmt(balance);
  $("income").textContent   = fmt(income);
  $("expenses").textContent = fmt(expense);
}

function lastNMonths(labels, n=12){
  return labels.sort().slice(-n);
}
function updateCharts(){
  // Monthly line
  const monthly={};
  transactions.forEach(t=>{
    if (!monthly[t.month]) monthly[t.month]={income:0,expense:0};
    monthly[t.month][t.type]+=t.amount;
  });
  const labels = lastNMonths(Object.keys(monthly));
  const incomeData = labels.map(m=>monthly[m].income||0);
  const expenseData = labels.map(m=>monthly[m].expense||0);

  if (lineChart) lineChart.destroy();
  lineChart = new Chart($("lineChart"), {
    type:"line",
    data:{ labels, datasets:[
      {label:"Income", data:incomeData, borderColor:"#10b981", fill:false, tension:.2},
      {label:"Expenses", data:expenseData, borderColor:"#ef4444", fill:false, tension:.2},
    ]},
    options:{ responsive:true, maintainAspectRatio:false, animation:false, scales:{y:{beginAtZero:true}} }
  });

  // Pie (expense by category)
  const byCat={};
  transactions.filter(t=>t.type==="expense").forEach(t=>{ byCat[t.category]=(byCat[t.category]||0)+t.amount; });
  if (pieChart) pieChart.destroy();
  pieChart = new Chart($("pieChart"), {
    type:"pie",
    data:{ labels:Object.keys(byCat), datasets:[{ data:Object.values(byCat) }] },
    options:{ responsive:true, maintainAspectRatio:false, animation:false, plugins:{legend:{position:"bottom"}} }
  });

  // Reports
  if (reportPie) reportPie.destroy();
  reportPie = new Chart($("reportPie"), {
    type:"doughnut",
    data:{ labels:Object.keys(byCat), datasets:[{ data:Object.values(byCat) }] },
    options:{ responsive:true, maintainAspectRatio:false, animation:false, plugins:{legend:{position:"bottom"}} }
  });

  if (reportBar) reportBar.destroy();
  reportBar = new Chart($("reportBar"), {
    type:"bar",
    data:{ labels, datasets:[
      {label:"Income", data:incomeData, backgroundColor:"#10b981"},
      {label:"Expenses", data:expenseData, backgroundColor:"#ef4444"},
    ]},
    options:{ responsive:true, maintainAspectRatio:false, animation:false, scales:{y:{beginAtZero:true}} }
  });
}

function updateReports(){ /* computed inside updateCharts now */ }
function updateAll(){ updateOverview(); updateBudget(); drawCatBudgetBars(); updateCharts(); }

/* ========= Currency (open.er-api.com) ========= */
const ISO = ["USD","EUR","GBP","CAD","AUD","JPY","INR","CHF","CNY","SEK","NZD","MXN"];
function populateFx(){
  const from=$("fxFrom"), to=$("fxTo"); from.innerHTML=""; to.innerHTML="";
  ISO.forEach(c=>{
    const o1=document.createElement("option"); o1.value=o1.textContent=c; from.appendChild(o1);
    const o2=document.createElement("option"); o2.value=o2.textContent=c; to.appendChild(o2);
  });
  from.value="USD"; to.value="EUR";
}
populateFx();

async function getFxRates(base="USD"){
  try{
    const data = await fetchJSON(`https://open.er-api.com/v6/latest/${base}`);
    if (data?.result==="success") return data.rates;
    throw 0;
  }catch{ const r={}; ISO.forEach(c=>r[c]= c===base?1:NaN); return r; }
}
$("fxForm")?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const amt = parseFloat($("fxAmount").value)||0;
  const from = $("fxFrom").value, to=$("fxTo").value;
  const rates = await getFxRates(from);
  const rate = rates[to];
  $("fxResult").textContent = isFinite(rate) ? `${amt} ${from} ≈ ${(amt*rate).toFixed(2)} ${to}` : "Conversion unavailable right now.";
});

/* ========= Markets ========= */
async function loadCrypto(){
  try{
    const d = await fetchJSON("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd");
    $("m_btc").textContent = "$"+d.bitcoin.usd.toLocaleString();
    $("m_eth").textContent = "$"+d.ethereum.usd.toLocaleString();
    $("btcPrice")?.textContent && ($("btcPrice").textContent="$"+d.bitcoin.usd.toLocaleString());
    $("ethPrice")?.textContent && ($("ethPrice").textContent="$"+d.ethereum.usd.toLocaleString());
  }catch{ $("m_btc").textContent="—"; $("m_eth").textContent="—"; }
}
async function loadStock(sym="AAPL"){
  if (!CONFIG.ALPHA_VANTAGE_KEY){ $("m_stock").textContent="Set API key"; return; }
  try{
    const data = await fetchJSON(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(sym)}&apikey=${CONFIG.ALPHA_VANTAGE_KEY}`);
    const q = data["Global Quote"];
    const price = q ? parseFloat(q["05. price"]) : NaN;
    $("m_stock").textContent = isFinite(price) ? "$"+price.toFixed(2) : "—";
    $("stockPrice") && ( $("stockPrice").textContent = $("m_stock").textContent );
    $("m_symbol_label").textContent = sym.toUpperCase();
    $("stockSymbolLabel") && ( $("stockSymbolLabel").textContent = sym.toUpperCase() );
  }catch{ $("m_stock").textContent="—"; }
}
$("m_stock_form")?.addEventListener("submit",(e)=>{
  e.preventDefault();
  const sym = $("m_symbol").value.trim() || "AAPL";
  loadStock(sym);
});
$("stockForm")?.addEventListener("submit",(e)=>{
  e.preventDefault();
  const sym = $("stockSymbol").value.trim() || "AAPL";
  loadStock(sym);
});
async function loadFxPair(){
  try{
    const data = await fetchJSON("https://open.er-api.com/v6/latest/USD");
    $("m_fx").textContent = isFinite(data.rates?.EUR) ? data.rates.EUR.toFixed(3) : "—";
  }catch{ $("m_fx").textContent = "—"; }
}

/* ========= News (Financial Modeling Prep) ========= */
async function loadNews(query=""){
  const container = $("newsList"); container.innerHTML="";
  try{
    const data = await fetchJSON(`https://financialmodelingprep.com/api/v3/stock_news?limit=50&apikey=${CONFIG.FMP_API_KEY||"demo"}`);
    const items = (data||[]).filter(a=>{
      if (!query) return true;
      const s=(a.title+" "+(a.text||"")).toLowerCase();
      return s.includes(query.toLowerCase());
    }).slice(0,12);

    if (!items.length){ container.innerHTML = `<p class="muted">No stories found.</p>`; return; }

    items.forEach(a=>{
      const card = document.createElement("div");
      card.className="news-card";
      card.innerHTML = `
        <img src="${a.image || 'https://via.placeholder.com/100'}" alt=""/>
        <div>
          <a href="${a.url}" target="_blank"><strong>${a.title || "Untitled"}</strong></a>
          <p class="muted">${a.site || "Source"} · ${new Date(a.publishedDate).toLocaleString()}</p>
          <p>${(a.text||"").slice(0,160)}...</p>
        </div>
      `;
      container.appendChild(card);
    });
  }catch{ container.innerHTML = `<p class="muted">Failed to load news.</p>`; }
}
$("newsForm")?.addEventListener("submit",(e)=>{
  e.preventDefault();
  loadNews($("newsQuery").value.trim());
});

/* ========= AI: Categorizer + Assistant (HF with fallback) ========= */
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
    headers:{ "Authorization":`Bearer ${CONFIG.HF_API_KEY}`, "Content-Type":"application/json"},
    body: JSON.stringify({ inputs: text, parameters:{ candidate_labels: labels.join(", "), multi_label:false }})
  });
  if (res.status===401) throw new Error("HF unauthorized");
  const data = await res.json();
  if (data?.labels?.length) return data.labels[0]==="Income"?"Income":data.labels[0];
  throw new Error("HF classify failed");
}

$("aiAsk")?.addEventListener("click", async ()=>{
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
  const byCat={}; const byMonth={};
  transactions.forEach(t=>{
    if (t.type==="expense"){ byCat[t.category]=(byCat[t.category]||0)+t.amount; }
    byMonth[t.month]=(byMonth[t.month]||0)+(t.type==="expense"?t.amount:-t.amount);
  });
  const topCat = Object.keys(byCat).length ? Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0][0] : "N/A";
  const inc=transactions.filter(t=>t.type==="income").reduce((a,b)=>a+b.amount,0);
  const exp=transactions.filter(t=>t.type==="expense").reduce((a,b)=>a+b.amount,0);
  const balance=inc-exp;
  return [
    "AI service unreachable, here’s a quick local analysis:",
    `• Balance: ${fmt(balance)}  • Income: ${fmt(inc)}  • Expenses: ${fmt(exp)}`,
    `• Top expense category: ${topCat}`,
    `• Monthly net: ${Object.entries(byMonth).map(([m,v])=>`${m||"—"}=${fmt(v)}`).join(", ")}`
  ].join("\n");
}
async function aiAssistantAnswer(question){
  if (!CONFIG.HF_API_KEY) throw new Error("No HF key");
  const income  = transactions.filter(t=>t.type==="income").reduce((a,b)=>a+b.amount,0).toFixed(2);
  const expense = transactions.filter(t=>t.type==="expense").reduce((a,b)=>a+b.amount,0).toFixed(2);
  const byCat={}; transactions.filter(t=>t.type==="expense").forEach(t=>{byCat[t.category]=(byCat[t.category]||0)+t.amount;});
  const context = `
You are a concise finance assistant. Use these facts to answer clearly with numbers and 1-2 tips.
Total income: $${income}
Total expenses: $${expense}
By category: ${JSON.stringify(byCat)}
By month: ${JSON.stringify(groupByMonth(transactions))}
Question: ${question}
`.trim();

  const res = await fetch("https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",{
    method:"POST",
    headers:{ "Authorization":`Bearer ${CONFIG.HF_API_KEY}`, "Content-Type":"application/json"},
    body: JSON.stringify({ inputs: context, parameters:{ max_new_tokens: 220, temperature: 0.4 }})
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
  // Optionally enforce login:
  // const u = JSON.parse(localStorage.getItem("currentUser")||"null");
  // if (!u) window.location.href="index.html";
}
guardLoggedIn();

renderTransactions(); updateAll();
loadCrypto(); loadStock("AAPL"); loadFxPair(); loadNews();
setInterval(loadCrypto, 60_000);

// ======================
// NEWS (via GNews.io)
// ======================
async function loadNews() {
  try {
    const url = `https://gnews.io/api/v4/top-headlines?token=${CONFIG.GNEWS_KEY}&lang=en&topic=business`;
    const res = await fetch(url);
    const data = await res.json();

    const newsContainer = document.getElementById("newsList");
    newsContainer.innerHTML = "";

    if (!data.articles || data.articles.length === 0) {
      newsContainer.innerHTML = "<p>No news available right now.</p>";
      return;
    }

    data.articles.slice(0, 6).forEach(article => {
      const div = document.createElement("div");
      div.className = "news-item";
      div.innerHTML = `
        <h3><a href="${article.url}" target="_blank">${article.title}</a></h3>
        <p>${article.description || ""}</p>
      `;
      newsContainer.appendChild(div);
    });
  } catch (err) {
    console.error("News API error:", err);
    document.getElementById("newsList").innerHTML = "<p>⚠️ Could not load news.</p>";
  }
}
