/* ======= State ======= */
let transactions = JSON.parse(localStorage.getItem("ft.transactions") || "[]");
let budgets      = JSON.parse(localStorage.getItem("ft.budgets") || "[]");
let ui           = JSON.parse(localStorage.getItem("ft.ui") || "{}");
ui.darkMode = !!ui.darkMode;

function saveState(){
  localStorage.setItem("ft.transactions", JSON.stringify(transactions));
  localStorage.setItem("ft.budgets", JSON.stringify(budgets));
  localStorage.setItem("ft.ui", JSON.stringify(ui));
}

/* ======= Helpers ======= */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2,10);

/* ======= Tabs ======= */
function initTabs(){
  $$(".sidebar .nav button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      $$(".tab-content").forEach(el=>el.classList.add("hidden"));
      const id = btn.dataset.tab;
      const el = document.getElementById(id);
      if (el) el.classList.remove("hidden");
    });
  });
}

/* ======= Transactions ======= */
function initTransactions(){
  const form = $("#transactionForm");
  if(!form) return;

  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    const desc = $("#tDesc").value.trim();
    const amount = parseFloat($("#tAmount").value);
    const type = $("#tType").value;
    if(!desc || !Number.isFinite(amount)) return;

    transactions.push({
      id: uid(),
      date: new Date().toLocaleDateString(),
      desc, amount, type
    });
    saveState();
    renderTransactions();
    renderOverviewChart();
    renderReportChart();
    updateStats();
    renderBudgets();
    form.reset();
  });

  renderTransactions();
}

function renderTransactions(){
  const tb = $("#transactionTable tbody");
  tb.innerHTML = "";
  if(!transactions.length){
    tb.innerHTML = `<tr><td colspan="5" style="text-align:center;opacity:.7;">No transactions yet.</td></tr>`;
    return;
  }
  transactions.forEach((t)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.date}</td>
      <td>${t.desc}</td>
      <td>$${Number(t.amount).toFixed(2)}</td>
      <td style="font-weight:600;color:${t.type==='income'?'#16a34a':'#dc2626'}">${t.type}</td>
      <td><button class="btn-danger" data-del="${t.id}">Delete</button></td>
    `;
    tb.appendChild(tr);
  });

  // bind deletes
  $$("[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-del");
      transactions = transactions.filter(x=>x.id!==id);
      saveState();
      renderTransactions();
      renderOverviewChart();
      renderReportChart();
      updateStats();
      renderBudgets();
    });
  });
}

/* ======= Overview ======= */
let overviewChart;
function lockCanvasHeight(id, px){
  const cv = document.getElementById(id);
  if(cv && !cv.dataset.lock){
    cv.height = px;
    cv.style.height = px+"px";
    cv.dataset.lock = "1";
  }
}

function updateStats(){
  const income = transactions.filter(t=>t.type==="income").reduce((a,b)=>a+Number(b.amount||0),0);
  const expense = transactions.filter(t=>t.type==="expense").reduce((a,b)=>a+Number(b.amount||0),0);
  const balance = income - expense;
  $("#incomeStat").textContent  = `$${income.toFixed(2)}`;
  $("#expenseStat").textContent = `$${expense.toFixed(2)}`;
  $("#balanceStat").textContent = `$${balance.toFixed(2)}`;
}

function renderOverviewChart(){
  lockCanvasHeight("overviewChart", 260);
  const cv = $("#overviewChart");
  if(!cv) return;
  if(overviewChart) overviewChart.destroy();

  let running=0;
  const labels=[], series=[];
  transactions.forEach(t=>{
    running += (t.type==="income" ? 1 : -1) * Number(t.amount||0);
    labels.push(t.date);
    series.push(running);
  });

  overviewChart = new Chart(cv.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Balance Over Time",
        data: series,
        borderColor:"#36a2eb",
        backgroundColor:"rgba(54,162,235,.12)",
        borderWidth:2,
        fill:true,
        tension:.3,
        pointRadius:3,
        pointHoverRadius:4
      }]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{ display:true, position:"top" }
      },
      scales:{
        x:{ grid:{display:false}, title:{display:true, text:"Date"} },
        y:{ grid:{color:"rgba(0,0,0,.06)"}, title:{display:true, text:"USD"} }
      }
    }
  });

  updateStats();
}

/* ======= Budget ======= */
function initBudget(){
  const form = $("#budgetForm");
  if(!form) return;

  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    const category = $("#bCategory").value.trim();
    const limit = parseFloat($("#bLimit").value);
    if(!category || !Number.isFinite(limit) || limit<=0) return;

    budgets.push({ id: uid(), category, limit });
    saveState();
    renderBudgets();
    form.reset();
  });

  renderBudgets();
}

function renderBudgets(){
  const list = $("#budgetList");
  list.innerHTML = "";
  if(!budgets.length){
    list.innerHTML = `<div class="card">No budgets yet. Add a category and limit above.</div>`;
    return;
  }

  budgets.forEach(b=>{
    const spent = transactions
      .filter(t=>t.type==="expense" && t.desc.toLowerCase()===b.category.toLowerCase())
      .reduce((a,t)=>a+Number(t.amount||0),0);

    const pct = b.limit ? Math.min(100, (spent/b.limit)*100) : 0;

    const card = document.createElement("div");
    card.className = "card budget-item";
    card.innerHTML = `
      <h4 style="margin:0 0 6px;">${b.category}: $${spent.toFixed(2)} / $${b.limit.toFixed(2)}</h4>
      <div class="bar"><div class="fill" style="width:${pct}%;"></div></div>
      <div style="margin-top:8px;">
        <button class="btn-ghost" data-rm="${b.id}">Remove</button>
      </div>
    `;
    list.appendChild(card);
  });

  $$("[data-rm]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-rm");
      budgets = budgets.filter(x=>x.id!==id);
      saveState();
      renderBudgets();
    });
  });
}

/* ======= Reports ======= */
let reportChart;
function renderReportChart(){
  const cv = $("#reportChart");
  if(!cv) return;
  // lock height to prevent growth
  lockCanvasHeight("reportChart", 280);
  if(reportChart) reportChart.destroy();

  const agg = {};
  transactions.filter(t=>t.type==="expense").forEach(t=>{
    const k = t.desc || "Other";
    agg[k] = (agg[k]||0) + Number(t.amount||0);
  });
  const labels = Object.keys(agg).length ? Object.keys(agg) : ["No expenses"];
  const values = Object.keys(agg).length ? Object.values(agg) : [1];

  reportChart = new Chart(cv.getContext("2d"), {
    type:"pie",
    data:{
      labels,
      datasets:[{
        data: values,
        backgroundColor: ["#36a2eb","#ff6384","#ffce56","#4caf50","#9c27b0","#8bc34a","#ff9800","#03a9f4"],
        borderColor:"#fff", borderWidth:1
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:"right" } }
    }
  });
}

/* ======= News (GNews) ======= */
async function loadNews(){
  const container = $("#newsList");
  if(!container) return;
  container.innerHTML = `<div style="padding:14px;">Loading news…</div>`;

  try{
    if(!CONFIG || !CONFIG.GNEWS_KEY) throw new Error("Missing GNEWS key");
    const url = `https://gnews.io/api/v4/top-headlines?token=${encodeURIComponent(CONFIG.GNEWS_KEY)}&lang=en&topic=business`;
    const res = await fetch(url);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const articles = Array.isArray(data.articles) ? data.articles.slice(0,8) : [];
    container.innerHTML = "";
    if(!articles.length){
      container.innerHTML = `<div style="padding:14px;">No news available.</div>`;
      return;
    }

    articles.forEach(a=>{
      const item = document.createElement("div");
      item.className = "news-item";
      item.innerHTML = `
        <h4><a href="${a.url}" target="_blank" rel="noopener">${a.title || "Untitled"}</a></h4>
        <p>${a.description || "No description available."}</p>
      `;
      container.appendChild(item);
    });
  }catch(err){
    console.error("News API error:", err);
    container.innerHTML = `<div style="padding:14px;">⚠️ Could not load news. Check your GNews key or try later.</div>`;
  }
}

/* ======= Markets ======= */
async function loadAAPL(){
  const box = $("#stockBox");
  if(!box) return;
  box.textContent = "Loading AAPL stock…";
  try{
    if(!CONFIG || !CONFIG.ALPHA_VANTAGE_KEY) throw new Error("Missing AV key");
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${encodeURIComponent(CONFIG.ALPHA_VANTAGE_KEY)}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const q = data["Global Quote"];
    if(!q){ box.innerHTML = `<p>⚠️ API limit reached. Try again later.</p>`; return; }

    const price  = parseFloat(q["05. price"]||"0");
    const change = (q["10. change percent"]||"").trim();
    box.innerHTML = `
      <h3 style="margin:0 0 6px;">AAPL Stock</h3>
      <p style="margin:4px 0;">Price: $${price.toFixed(2)}</p>
      <p style="margin:4px 0;">Change: ${change}</p>
    `;
  }catch(err){
    console.error("AAPL error:", err);
    box.innerHTML = `<p>⚠️ Could not load stock data.</p>`;
  }
}

function initConverter(){
  const btn = $("#convertBtn");
  if(!btn) return;
  btn.addEventListener("click", async ()=>{
    const amt  = parseFloat($("#currencyAmount").value||"0");
    const from = $("#currencyFrom").value;
    const to   = $("#currencyTo").value;
    const out  = $("#currencyResult");
    if(!Number.isFinite(amt) || amt<=0){ out.textContent = "Enter a valid amount."; return; }
    try{
      if(!CONFIG || !CONFIG.ALPHA_VANTAGE_KEY) throw new Error("Missing AV key");
      const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${encodeURIComponent(from)}&to_currency=${encodeURIComponent(to)}&apikey=${encodeURIComponent(CONFIG.ALPHA_VANTAGE_KEY)}`;
      const res = await fetch(url);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rate = parseFloat(data?.["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"]||"0");
      if(!rate){ out.textContent = "Rate unavailable (limit?). Try later."; return; }
      out.textContent = `${amt} ${from} = ${(amt*rate).toFixed(2)} ${to}`;
    }catch(err){
      console.error("FX error:", err);
      out.textContent = "⚠️ Conversion failed.";
    }
  });
}

async function loadExtraMarkets(){
  const crypto = $("#cryptoBox");
  const comm   = $("#commodityBox");

  // Crypto (best-effort; may hit rate limits)
  if(crypto){
    try{
      if(!CONFIG || !CONFIG.ALPHA_VANTAGE_KEY) throw new Error("Missing AV key");
      const [b,e] = await Promise.all([
        fetch(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=BTC&to_currency=USD&apikey=${encodeURIComponent(CONFIG.ALPHA_VANTAGE_KEY)}`),
        fetch(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=ETH&to_currency=USD&apikey=${encodeURIComponent(CONFIG.ALPHA_VANTAGE_KEY)}`)
      ]);
      const bj = await b.json(), ej = await e.json();
      const btc = parseFloat(bj?.["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"]||"0");
      const eth = parseFloat(ej?.["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"]||"0");
      if(btc && eth){
        crypto.innerHTML = `<h3 style="margin:0 0 6px;">Crypto</h3>
          <p style="margin:4px 0;">BTC: $${btc.toFixed(2)}</p>
          <p style="margin:4px 0;">ETH: $${eth.toFixed(2)}</p>`;
      }else{
        crypto.innerHTML = `<p>⚠️ Crypto data rate-limited. Try later.</p>`;
      }
    }catch(e){
      crypto.innerHTML = `<p>⚠️ Could not load crypto data.</p>`;
    }
  }

  // Commodities (demo placeholders)
  if(comm){
    comm.innerHTML = `<h3 style="margin:0 0 6px;">Commodities</h3>
      <p style="margin:4px 0;">Gold (XAU/USD): ~\$1,950</p>
      <p style="margin:4px 0;">Oil (WTI): ~\$75</p>
      <small style="opacity:.7;">(Demo values)</small>`;
  }
}

/* ======= Assistant (HuggingFace DialoGPT) ======= */
function initAssistant(){
  const form = $("#chatForm");
  if(!form) return;
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const input = $("#chatInput");
    const text = (input.value||"").trim();
    if(!text) return;

    appendMsg("user", text);
    appendMsg("ai", "Thinking…");

    try{
      if(!CONFIG || !CONFIG.HF_API_KEY) throw new Error("Missing HF key");
      const res = await fetch("https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium",{
        method:"POST",
        headers:{
          "Authorization":`Bearer ${CONFIG.HF_API_KEY}`,
          "Content-Type":"application/json"
        },
        body: JSON.stringify({ inputs: text })
      });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply = data?.[0]?.generated_text || "…";
      replaceLastAI(reply);
    }catch(err){
      console.error("AI error:", err);
      replaceLastAI("⚠️ AI service unreachable. Check your key or try again later.");
    }
    form.reset();
  });
}

function appendMsg(role, text){
  const box = $("#chatbox");
  const div = document.createElement("div");
  div.className = role==="user" ? "user-msg" : "ai-msg";
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}
function replaceLastAI(text){
  const box = $("#chatbox");
  const list = $$("#chatbox .ai-msg");
  if(list.length){ list[list.length-1].textContent = text; } else { appendMsg("ai", text); }
}

/* ======= Settings ======= */
function initSettings(){
  $("#toggleDark")?.addEventListener("click", ()=>{
    ui.darkMode = !ui.darkMode;
    document.body.classList.toggle("dark", ui.darkMode);
    saveState();
  });
  $("#resetData")?.addEventListener("click", ()=>{
    if(!confirm("Delete all transactions and budgets?")) return;
    transactions=[]; budgets=[];
    saveState();
    renderTransactions(); renderBudgets();
    renderOverviewChart(); renderReportChart(); updateStats();
  });
  $("#logout")?.addEventListener("click", ()=>{ window.location.href = "index.html"; });
}

/* ======= Init ======= */
function init(){
  document.body.classList.toggle("dark", ui.darkMode);
  initTabs();
  initTransactions();
  initBudget();
  renderOverviewChart();
  renderReportChart();
  updateStats();

  loadNews();
  loadAAPL();
  initConverter();
  loadExtraMarkets();

  initAssistant();
  initSettings();
}

document.addEventListener("DOMContentLoaded", init);
