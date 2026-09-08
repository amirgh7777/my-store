/* ============================================================
   ژورنال معاملات — منطق برنامه
   داده‌ها فقط در localStorage همین مرورگر ذخیره می‌شن.
   حتماً هر چند وقت یک‌بار از دکمه «خروجی اکسل» بک‌آپ بگیر.
   ============================================================ */

const STORAGE_KEY   = 'tj_trades_v1';
const STRAT_KEY     = 'tj_strategies_v1';
const TIER_KEY      = 'tj_risktiers_v1';
const GNOTES_KEY    = 'tj_globalnotes_v1';
const CHECKLIST_KEY = 'tj_checklist_v1';
const SETTINGS_KEY  = 'tj_settings_v1';
const NAVCOL_KEY    = 'tj_navcollapsed_v1';

const DEFAULT_STRATEGIES = [
  {
    id: 'breakout', label: 'Breakout', color: '#4f9d7c',
    rules: [
      'در جهت روند 4 ساعته وارد شو',
      'تأیید با RSI، ADX، SMA7/25/99 و حجم معامله',
      'ورود بر اساس نواحی حمایت/مقاومت با فیلتر زمانی و سشن',
      'اندازه ریسک بر اساس تعداد ریجکشن‌ها پلکانی تعیین می‌شه',
      'خروج پله‌ای: 35% در RR2 — 45% در RR5 — 20% در RR10'
    ]
  },
  {
    id: 'fake', label: 'Fake Breakout', color: '#c9a227',
    rules: [
      'شکست کاذب سطح، در جهت روند 4 ساعته',
      'نیازمند تأیید حجم و بازگشت سریع قیمت به داخل رنج',
      'از رنج‌های بی‌روند و معاملات آخر هفته پرهیز کن',
      'خروج پله‌ای: 35% در RR2 — 45% در RR5 — 20% در RR10'
    ]
  },
  {
    id: 'candle', label: 'Candle-Setup', color: '#b1544a',
    rules: [
      'ست‌آپ بر پایه پرایس اکشن کندل در تایم‌فریم 1H/4H',
      'در حال بک‌تست — قبل از ورود واقعی مطمئن شو ست‌آپ تکرارپذیره',
      'تأیید نهایی با بسته‌شدن کامل کندل، نه قبل از آن',
      'خروج پله‌ای: 35% در RR2 — 45% در RR5 — 20% در RR10'
    ]
  }
];

const DEFAULT_TIERS = [
  { id: 'weak',   label: 'تأییدهای معمولی', amount: 25 },
  { id: 'strong', label: 'تأییدهای قوی (هم‌جهتی BTC، حجم خوب، RSI اشباع)', amount: 50 }
];

const DEFAULT_CHECKLIST = [
  { id: 'trendAlign',         label: 'هم‌جهت با روند 4 ساعته' },
  { id: 'btcConfirm',         label: 'تأیید BTC' },
  { id: 'btcPairConfirm',     label: 'تأیید هم‌جهتی با جفت BTC' },
  { id: 'hwcConfirm',         label: 'تأیید HWC' },
  { id: 'mwcConfirm',         label: 'تأیید MWC' },
  { id: 'lwcConfirm',         label: 'تأیید LWC' },
  { id: 'level4hBreak',       label: 'شکست سطح 4H/1D' },
  { id: 'volConfirm',         label: 'تأیید حجم' },
  { id: 'candleShapeConfirm', label: 'تأیید شکل کندل' },
  { id: 'rsiConfirm',         label: 'تأیید RSI' },
  { id: 'candleClosed',       label: 'بعد از بسته‌شدن کامل کندل وارد شدم' },
  { id: 'notWeekendRange',    label: 'بازار رنج یا نزدیک بسته‌شدن ماهانه نیست' }
];

const DEFAULT_SETTINGS = { riskUnit: 'dollar' }; // 'dollar' | 'percent'

// کلمات هشدار FOMO — طبق قانونی که خودت گذاشتی: اگر جمله توجیه شامل این‌ها باشه، معامله رو رد کن
const FOMO_WORDS = [
  'نمی‌خوام از دست بدم', 'نمیخوام از دست بدم', 'از دست ندم', 'باید', 'حتما باید',
  "don't want to miss", 'must', 'gotta', 'have to', 'fomo'
];

const OUTCOME_LABELS = { open: 'باز', tp: 'TP', sl: 'SL', riskfree: 'ریسک‌فری' };
const OUTCOME_TAG_CLASS = { tp: 'tp', sl: 'sl', riskfree: 'riskfree', open: '' };

// برای ورودی اکسل: نگاشت اسم‌های مختلف ستون‌ها (فارسی/انگلیسی) به فیلدهای داخلی
const FIELD_ALIASES = {
  date: ['تاریخ', 'date', 'entry date', 'day', 'date & time', 'datetime'],
  symbol: ['نماد', 'symbol', 'pair', 'ticker', 'asset', 'position #', 'position', 'coin'],
  strategy: ['استراتژی', 'strategy', 'setup', 'strategy name'],
  direction: ['جهت', 'direction', 'side'],
  timeframe: ['تایم\u200cفریم', 'timeframe'],
  session: ['سشن', 'session'],
  entry: ['قیمت ورود', 'entry', 'entry price'],
  stop: ['حد ضرر', 'stop', 'stop loss', 'sl price'],
  riskAmount: ['ریسک ($)', 'risk ($)', 'risk$', 'risk amount', 'درصد ریسک', 'risk%', 'risk percent', 'risk', 'risk pct', 'risk (%)'],
  outcome: ['وضعیت', 'outcome', 'result', 'status', 'trakings', 'trackings'],
  realizedR: ['r محقق\u200cشده', 'r', 'realized r', 'rr', 'r-multiple', 'r multiple', 'risk/riward', 'risk/reward', 'risk reward'],
  closedPct: ['درصد بسته\u200cشده', 'closed%', 'closed percent'],
  justification: ['توجیه ورود', 'justification', 'reason'],
  notes: ['یادداشت', 'notes', 'note', 'comment', 'discription', 'description'],
  btcConfirm: ['تأیید btc', 'btc confirm'],
  btcPairConfirm: ['تأیید هم\u200cجهتی جفت btc', 'btc pair confirm'],
  hwcConfirm: ['تأیید hwc', 'hwc confirm'],
  mwcConfirm: ['تأیید mwc', 'mwc confirm'],
  lwcConfirm: ['تأیید lwc', 'lwc confirm'],
  level4hBreak: ['شکست سطح 4h/1d', '4h/1d  level brake out', '4h/1d level brake out'],
  volConfirm: ['تأیید حجم', 'vol confirm'],
  candleShapeConfirm: ['تأیید شکل کندل', 'candle shape confirm'],
  rsiConfirm: ['تأیید rsi', 'rsi confirm'],
  positionType: ['نوع پوزیشن/خروج', 'posicion tipe', 'position type'],
  mentalStatus: ['حالت ذهنی', 'mental status'],
  exitType: ['نحوه بسته\u200cشدن معامله'],
  mistakes: ['اشتباهات', 'اشتباه', 'mistakes'],
  screenshot15m: ['اسکرین\u200cشات 15m', 'screen shot 15m'],
  screenshot1h: ['اسکرین\u200cشات 1h', 'screen shot 1h'],
  screenshot4h: ['اسکرین\u200cشات 4h', 'screen shot 4h'],
  riskFreeOpen: ['ریسک\u200cفری (پوزیشن باز)', 'risk free (open)']
};
const OUTCOME_SYNONYMS = {
  tp: ['tp', 'win', 'profit', 'won', 'برد', 'سود'],
  sl: ['sl', 'loss', 'lost', 'stoploss', 'stop loss', 'stopped', 'باخت', 'ضرر'],
  riskfree: ['riskfree', 'risk free', 'riskk free', 'breakeven', 'be', 'ریسک فری', 'ریسک\u200cفری', 'سربه سر', 'سربه\u200cسر'],
  open: ['open', 'running', 'active', 'باز']
};
const STRATEGY_PALETTE = ['#6aa6c9', '#9d7dc9', '#c97d9d', '#7dc9a0', '#c9a86a', '#7d9dc9'];

const DEFAULT_GNOTES = {
  dailyLossLimit: '', weeklyLossLimit: '', monthlyLossLimit: '',
  dailyProfitTarget: '', weeklyProfitTarget: '', monthlyProfitTarget: '',
  freeNotes: ''
};

let STATE = {
  trades: loadTrades(),
  strategies: loadStrategies(),
  tiers: loadTiers(),
  globalNotes: loadGlobalNotes(),
  checklist: loadChecklist(),
  settings: loadSettings(),
  navCollapsed: loadNavCollapsed(),
  view: 'dashboard',
  filters: { strategy: 'all', outcome: 'all' },
  dashFilter: { from: '', to: '' },
  editingId: null
};

/* ============================== ذخیره/بارگذاری ============================== */
function loadTrades(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    // مهاجرت فرمت قدیمی win/loss/breakeven -> tp/sl/riskfree، riskPct(٪) -> riskAmount($)، و چک‌لیست تخت -> آبجکت checklist
    const map = { win: 'tp', loss: 'sl', breakeven: 'riskfree' };
    const flatChecklistIds = DEFAULT_CHECKLIST.map(i=>i.id);
    return data.map(t => {
      let checklist = t.checklist;
      if(!checklist){
        checklist = {};
        flatChecklistIds.forEach(id=>{ if(t[id] !== undefined) checklist[id] = !!t[id]; });
      }
      return {
        ...t,
        outcome: map[t.outcome] || t.outcome || 'open',
        riskAmount: t.riskAmount !== undefined ? t.riskAmount : (t.riskPct !== undefined ? t.riskPct : null),
        checklist
      };
    });
  }catch(e){ return []; }
}
function saveTrades(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE.trades)); }

function loadStrategies(){
  try{
    const raw = localStorage.getItem(STRAT_KEY);
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_STRATEGIES));
  }catch(e){ return JSON.parse(JSON.stringify(DEFAULT_STRATEGIES)); }
}
function saveStrategies(){ localStorage.setItem(STRAT_KEY, JSON.stringify(STATE.strategies)); }

function loadTiers(){
  try{
    const raw = localStorage.getItem(TIER_KEY);
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_TIERS));
  }catch(e){ return JSON.parse(JSON.stringify(DEFAULT_TIERS)); }
}
function saveTiers(){ localStorage.setItem(TIER_KEY, JSON.stringify(STATE.tiers)); }

function loadGlobalNotes(){
  try{
    const raw = localStorage.getItem(GNOTES_KEY);
    return raw ? { ...DEFAULT_GNOTES, ...JSON.parse(raw) } : { ...DEFAULT_GNOTES };
  }catch(e){ return { ...DEFAULT_GNOTES }; }
}
function saveGlobalNotes(){ localStorage.setItem(GNOTES_KEY, JSON.stringify(STATE.globalNotes)); }

function loadChecklist(){
  try{
    const raw = localStorage.getItem(CHECKLIST_KEY);
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_CHECKLIST));
  }catch(e){ return JSON.parse(JSON.stringify(DEFAULT_CHECKLIST)); }
}
function saveChecklist(){ localStorage.setItem(CHECKLIST_KEY, JSON.stringify(STATE.checklist)); }

function loadSettings(){
  try{
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  }catch(e){ return { ...DEFAULT_SETTINGS }; }
}
function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(STATE.settings)); }

function loadNavCollapsed(){
  try{ return localStorage.getItem(NAVCOL_KEY) === '1'; }catch(e){ return false; }
}
function saveNavCollapsed(){ localStorage.setItem(NAVCOL_KEY, STATE.navCollapsed ? '1' : '0'); }

function riskUnitSymbol(){ return STATE.settings.riskUnit === 'percent' ? '٪' : '$'; }
function riskUnitLabel(){ return STATE.settings.riskUnit === 'percent' ? 'درصد' : 'دلار'; }
function fmtRisk(v){
  if(v === null || v === undefined || isNaN(v)) return '—';
  return STATE.settings.riskUnit === 'percent' ? `${fmtNum(v,2)}٪` : `$${fmtNum(v,2)}`;
}

function findStrategy(id){ return STATE.strategies.find(s => s.id === id); }
function findTier(id){ return STATE.tiers.find(t => t.id === id); }
function strategyLabel(id){ const s = findStrategy(id); return s ? s.label : 'نامشخص'; }
function strategyColor(id){ const s = findStrategy(id); return s ? s.color : '#8b968f'; }

function uid(prefix){ return (prefix||'t') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function slugify(str){
  return 'st_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
}

function toast(msg){
  const host = document.getElementById('toast-host');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(()=> el.remove(), 3200);
}

function isWeekend(dateStr){
  if(!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}
function hasFomoLanguage(text){
  if(!text) return false;
  const t = text.toLowerCase();
  return FOMO_WORDS.some(w => t.includes(w.toLowerCase()));
}
function fmtNum(n, d=2){
  if(n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

/* ============================== آمار ============================== */
function dashboardTrades(){
  const { from, to } = STATE.dashFilter;
  return STATE.trades.filter(t=>{
    if(from && t.date < from) return false;
    if(to && t.date > to) return false;
    return true;
  });
}

function computeStats(trades){
  const closed = trades.filter(t => t.outcome !== 'open');
  const sorted = closed.slice().sort((a,b)=> new Date(a.date) - new Date(b.date));
  const wins = closed.filter(t => t.outcome === 'tp');
  const losses = closed.filter(t => t.outcome === 'sl');
  const totalR = closed.reduce((s,t)=> s + (Number(t.realizedR)||0), 0);
  const winRate = closed.length ? (wins.length / closed.length * 100) : 0;
  const avgR = closed.length ? totalR / closed.length : 0;

  const grossWin = wins.reduce((s,t)=> s + Math.max(0, Number(t.realizedR)||0), 0);
  const grossLoss = losses.reduce((s,t)=> s + Math.abs(Math.min(0, Number(t.realizedR)||0)), 0);
  const profitFactor = grossLoss > 0 ? (grossWin / grossLoss) : (grossWin > 0 ? Infinity : 0);
  const avgWinR = wins.length ? grossWin / wins.length : 0;
  const avgLossR = losses.length ? grossLoss / losses.length : 0;

  let bestStreak = 0, worstStreak = 0, curWin = 0, curLoss = 0;
  sorted.forEach(t=>{
    if(t.outcome === 'tp'){ curWin++; curLoss = 0; bestStreak = Math.max(bestStreak, curWin); }
    else if(t.outcome === 'sl'){ curLoss++; curWin = 0; worstStreak = Math.max(worstStreak, curLoss); }
    else { curWin = 0; curLoss = 0; }
  });

  const weekendFlags = trades.filter(t => t.flagWeekend).length;
  const fomoFlags = trades.filter(t => t.flagFomo).length;
  const earlyFlags = trades.filter(t => t.flagEarlyEntry).length;

  const byStrategy = {};
  STATE.strategies.forEach(s => byStrategy[s.id] = { count:0, wins:0, totalR:0 });
  closed.forEach(t=>{
    if(!byStrategy[t.strategy]) byStrategy[t.strategy] = { count:0, wins:0, totalR:0 };
    byStrategy[t.strategy].count++;
    if(t.outcome==='tp') byStrategy[t.strategy].wins++;
    byStrategy[t.strategy].totalR += Number(t.realizedR)||0;
  });

  const bySession = {};
  const byDirection = {};
  closed.forEach(t=>{
    const sk = t.session || '—';
    const dk = t.direction || '—';
    bySession[sk] = bySession[sk] || { count:0, wins:0, totalR:0 };
    bySession[sk].count++; if(t.outcome==='tp') bySession[sk].wins++; bySession[sk].totalR += Number(t.realizedR)||0;
    byDirection[dk] = byDirection[dk] || { count:0, wins:0, totalR:0 };
    byDirection[dk].count++; if(t.outcome==='tp') byDirection[dk].wins++; byDirection[dk].totalR += Number(t.realizedR)||0;
  });

  const rBuckets = [
    { label: '< -2R', min: -Infinity, max: -2, count: 0 },
    { label: '-2 تا -1R', min: -2, max: -1, count: 0 },
    { label: '-1 تا 0R', min: -1, max: 0, count: 0 },
    { label: '0 تا 1R', min: 0, max: 1, count: 0 },
    { label: '1 تا 2R', min: 1, max: 2, count: 0 },
    { label: '2 تا 5R', min: 2, max: 5, count: 0 },
    { label: '> 5R', min: 5, max: Infinity, count: 0 }
  ];
  closed.forEach(t=>{
    const r = Number(t.realizedR);
    if(isNaN(r)) return;
    const b = rBuckets.find(b => r > b.min && r <= b.max) || rBuckets.find(b => r === b.min);
    if(b) b.count++;
  });

  return { total: trades.length, closedCount: closed.length, wins: wins.length, losses: losses.length,
    winRate, totalR, avgR, weekendFlags, fomoFlags, earlyFlags, byStrategy, bySession, byDirection,
    profitFactor, avgWinR, avgLossR, bestStreak, worstStreak, rBuckets };
}

/* ============================== رندر اصلی ============================== */
function render(){
  document.querySelectorAll('.nav-item').forEach(b=>{
    b.classList.toggle('active', b.dataset.view === STATE.view);
  });
  const c = document.getElementById('content');
  if(STATE.view === 'dashboard') c.innerHTML = viewDashboard();
  if(STATE.view === 'new') c.innerHTML = viewNewTrade();
  if(STATE.view === 'trades') c.innerHTML = viewTradesList();
  if(STATE.view === 'rules') c.innerHTML = viewRules();
  if(STATE.view === 'checklist') c.innerHTML = viewChecklist();
  if(STATE.view === 'pnl') c.innerHTML = viewPnL();
  if(STATE.view === 'freenotes') c.innerHTML = viewFreeNotes();

  attachViewHandlers();

  if(STATE.view === 'dashboard'){
    const trades = dashboardTrades();
    drawEquityCurve(trades);
    drawStrategyChart(trades);
    drawRDistribution(trades);
  }
}

/* ============================== داشبورد ============================== */
function viewDashboard(){
  const trades = dashboardTrades();
  const s = computeStats(trades);

  if(STATE.trades.length === 0){
    return `
      <h2 class="section-title">داشبورد</h2>
      <p class="section-sub">هنوز معامله‌ای ثبت نشده.</p>
      <div class="empty">اولین معامله‌ت رو از تب «ثبت معامله» وارد کن تا آمار اینجا نمایش داده بشه.</div>
    `;
  }

  const pf = s.profitFactor === Infinity ? '∞' : fmtNum(s.profitFactor, 2);

  return `
    <h2 class="section-title">داشبورد</h2>
    <p class="section-sub">${s.total} معامله در بازه انتخاب‌شده · ${s.closedCount} بسته‌شده</p>

    <div class="filters">
      <div class="field">
        <label>از تاریخ</label>
        <input type="date" id="dash-from" value="${STATE.dashFilter.from}">
      </div>
      <div class="field">
        <label>تا تاریخ</label>
        <input type="date" id="dash-to" value="${STATE.dashFilter.to}">
      </div>
      <button class="btn ghost small" id="dash-clear">پاک‌کردن بازه</button>
    </div>

    <div class="stat-grid">
      <div class="stat"><div class="label">نرخ برد</div><div class="value">${fmtNum(s.winRate,1)}٪</div></div>
      <div class="stat"><div class="label">مجموع R</div><div class="value ${s.totalR>=0?'pos':'neg'}">${s.totalR>=0?'+':''}${fmtNum(s.totalR,2)}R</div></div>
      <div class="stat"><div class="label">اکسپکتنسی (میانگین R)</div><div class="value ${s.avgR>=0?'pos':'neg'}">${s.avgR>=0?'+':''}${fmtNum(s.avgR,2)}R</div></div>
      <div class="stat"><div class="label">Profit Factor</div><div class="value ${s.profitFactor>=1?'pos':'neg'}">${pf}</div></div>
    </div>
    <div class="stat-grid" style="margin-top:12px;">
      <div class="stat"><div class="label">میانگین R برد</div><div class="value pos">+${fmtNum(s.avgWinR,2)}R</div></div>
      <div class="stat"><div class="label">میانگین R باخت</div><div class="value neg">-${fmtNum(s.avgLossR,2)}R</div></div>
      <div class="stat"><div class="label">بهترین استریک برد</div><div class="value pos">${s.bestStreak}</div></div>
      <div class="stat"><div class="label">بدترین استریک باخت</div><div class="value neg">${s.worstStreak}</div></div>
    </div>

    <div class="chart-row" style="margin-top:16px;">
      <div class="card">
        <h3>منحنی سرمایه (R تجمعی)</h3>
        <canvas id="chart-equity" height="220"></canvas>
      </div>
      <div class="card">
        <h3>عملکرد به‌تفکیک استراتژی</h3>
        <canvas id="chart-strategy" height="220"></canvas>
        <div class="legend" id="strategy-legend"></div>
      </div>
    </div>

    <div class="card">
      <h3>توزیع R (هیستوگرام)</h3>
      <canvas id="chart-rdist" height="200"></canvas>
    </div>

    <div class="mini-table-grid">
      <div class="card">
        <h3>عملکرد بر اساس سشن</h3>
        ${miniTable(s.bySession)}
      </div>
      <div class="card">
        <h3>عملکرد بر اساس جهت</h3>
        ${miniTable(s.byDirection, { long: 'لانگ', short: 'شورت' })}
      </div>
    </div>

    <div class="card">
      <h3>هشدارهای انضباطی</h3>
      <div class="stat-grid">
        <div class="stat"><div class="label">معامله در آخر هفته</div><div class="value ${s.weekendFlags?'neg':''}">${s.weekendFlags}</div></div>
        <div class="stat"><div class="label">توجیه با لحن FOMO</div><div class="value ${s.fomoFlags?'neg':''}">${s.fomoFlags}</div></div>
        <div class="stat"><div class="label">ورود قبل از بسته‌شدن کندل</div><div class="value ${s.earlyFlags?'neg':''}">${s.earlyFlags}</div></div>
      </div>
    </div>
  `;
}

function miniTable(map, relabel){
  const keys = Object.keys(map);
  if(keys.length === 0) return '<div class="hint">داده‌ای نیست</div>';
  const rows = keys.map(k=>{
    const v = map[k];
    const wr = v.count ? (v.wins/v.count*100).toFixed(0) : '0';
    const label = relabel && relabel[k] ? relabel[k] : k;
    return `<tr>
      <td>${label}</td>
      <td class="num">${v.count}</td>
      <td class="num">${wr}٪</td>
      <td class="num ${v.totalR>=0?'':''}" style="color:${v.totalR>=0?'#4f9d7c':'#b1544a'}">${v.totalR>=0?'+':''}${fmtNum(v.totalR,2)}R</td>
    </tr>`;
  }).join('');
  return `<table class="mini"><thead><tr><th>دسته</th><th>تعداد</th><th>برد٪</th><th>مجموع R</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function drawEquityCurve(trades){
  const canvas = document.getElementById('chart-equity');
  if(!canvas) return;
  const ctx = setupCanvas(canvas);
  const w = canvas.clientWidth, h = 220;

  const closed = trades.filter(t=>t.outcome!=='open').sort((a,b)=> new Date(a.date) - new Date(b.date));
  ctx.clearRect(0,0,w,h);
  if(closed.length === 0){
    ctx.fillStyle = '#8b968f'; ctx.font = '13px Vazirmatn';
    ctx.fillText('داده‌ای برای نمایش نیست', w/2-70, h/2);
    return;
  }

  let cum = 0;
  const points = closed.map(t => { cum += Number(t.realizedR)||0; return cum; });
  const min = Math.min(0, ...points), max = Math.max(0, ...points);
  const pad = 24;
  const range = (max - min) || 1;
  const stepX = points.length > 1 ? (w - pad*2) / (points.length - 1) : 0;

  const yOf = v => h - pad - ((v - min) / range) * (h - pad*2);
  const xOf = i => pad + i * stepX;

  ctx.strokeStyle = '#262f2b'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, yOf(0)); ctx.lineTo(w-pad, yOf(0)); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(0));
  points.forEach((p,i)=> ctx.lineTo(xOf(i), yOf(p)));
  ctx.lineTo(xOf(points.length-1), yOf(0));
  ctx.closePath();
  ctx.fillStyle = cum>=0 ? 'rgba(79,157,124,0.14)' : 'rgba(177,84,74,0.14)';
  ctx.fill();

  ctx.beginPath();
  points.forEach((p,i)=> i===0 ? ctx.moveTo(xOf(i), yOf(p)) : ctx.lineTo(xOf(i), yOf(p)));
  ctx.strokeStyle = cum>=0 ? '#4f9d7c' : '#b1544a';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(xOf(points.length-1), yOf(points[points.length-1]), 3.5, 0, Math.PI*2);
  ctx.fillStyle = cum>=0 ? '#4f9d7c' : '#b1544a';
  ctx.fill();
}

function drawStrategyChart(trades){
  const canvas = document.getElementById('chart-strategy');
  if(!canvas) return;
  const ctx = setupCanvas(canvas);
  const w = canvas.clientWidth, h = 220;
  ctx.clearRect(0,0,w,h);

  const s = computeStats(trades);
  const keys = STATE.strategies.map(st=>st.id);
  const vals = keys.map(k => (s.byStrategy[k]||{totalR:0}).totalR);
  const maxAbs = Math.max(1, ...vals.map(v=>Math.abs(v)));
  const barGap = 26;
  const barW = Math.min(56, (w - barGap*(keys.length+1)) / Math.max(1,keys.length));
  const zeroY = h/2;

  keys.forEach((k,i)=>{
    const v = vals[i];
    const x = barGap + i*(barW+barGap);
    const barH = (Math.abs(v)/maxAbs) * (h/2 - 22);
    const y = v>=0 ? zeroY - barH : zeroY;
    ctx.fillStyle = strategyColor(k);
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, y, barW, barH || 1);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#e8ece9';
    ctx.font = '11px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText((v>=0?'+':'')+v.toFixed(1)+'R', x+barW/2, v>=0 ? y-6 : y+barH+14);
    ctx.fillStyle = '#8b968f';
    ctx.font = '11px Vazirmatn';
    ctx.fillText(strategyLabel(k), x+barW/2, h-10);
  });

  ctx.strokeStyle = '#262f2b';
  ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(w, zeroY); ctx.stroke();
  ctx.textAlign = 'start';

  const legend = document.getElementById('strategy-legend');
  if(legend){
    legend.innerHTML = keys.map(k=>{
      const st = s.byStrategy[k] || {count:0,wins:0};
      const wr = st.count ? (st.wins/st.count*100).toFixed(0) : '—';
      return `<span><i style="background:${strategyColor(k)}"></i>${strategyLabel(k)}: ${st.count} معامله، ${wr}٪ برد</span>`;
    }).join('');
  }
}

function drawRDistribution(trades){
  const canvas = document.getElementById('chart-rdist');
  if(!canvas) return;
  const ctx = setupCanvas(canvas, 200);
  const w = canvas.clientWidth, h = 200;
  ctx.clearRect(0,0,w,h);

  const s = computeStats(trades);
  const buckets = s.rBuckets;
  const maxCount = Math.max(1, ...buckets.map(b=>b.count));
  const padBottom = 34, padTop = 14;
  const gap = 10;
  const barW = (w - gap*(buckets.length+1)) / buckets.length;

  buckets.forEach((b,i)=>{
    const x = gap + i*(barW+gap);
    const barH = (b.count / maxCount) * (h - padTop - padBottom);
    const y = h - padBottom - barH;
    const isNeg = b.max <= 0;
    ctx.fillStyle = isNeg ? '#b1544a' : '#4f9d7c';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, y, barW, barH || 0);
    ctx.globalAlpha = 1;
    if(b.count > 0){
      ctx.fillStyle = '#e8ece9'; ctx.font = '11px JetBrains Mono'; ctx.textAlign='center';
      ctx.fillText(b.count, x+barW/2, y-6);
    }
    ctx.fillStyle = '#8b968f'; ctx.font = '10.5px Vazirmatn'; ctx.textAlign='center';
    ctx.fillText(b.label, x+barW/2, h-14);
  });
  ctx.textAlign = 'start';
}

function setupCanvas(canvas, cssHOverride){
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.parentElement.clientWidth;
  const cssH = cssHOverride || parseInt(canvas.getAttribute('height')) || 220;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return ctx;
}

/* ============================== ثبت معامله ============================== */
function viewNewTrade(){
  const editing = STATE.editingId ? STATE.trades.find(t=>t.id === STATE.editingId) : null;
  const today = new Date().toISOString().slice(0,10);
  const strategyOptions = STATE.strategies.map(s=>`<option value="${s.id}">${s.label}</option>`).join('');
  const tierOptions = STATE.tiers.map(t=>`<option value="${t.id}">${t.label} — ریسک ${fmtRisk(t.amount)}</option>`).join('');

  return `
    <h2 class="section-title">${editing ? 'ویرایش معامله' : 'ثبت معامله جدید'}</h2>
    <p class="section-sub">قبل از ثبت، جمله توجیه ورود رو بنویس — اگر لحنش FOMO باشه بهت هشدار داده می‌شه.</p>

    <form id="form-new-trade">
      <div class="card">
        <h3>مشخصات معامله</h3>
        <div class="grid cols-3">
          <div class="field"><label>تاریخ ورود</label><input type="date" name="date" value="${today}" required></div>
          <div class="field"><label>ساعت ورود</label><input type="time" name="time"></div>
          <div class="field"><label>نماد</label><input type="text" name="symbol" placeholder="مثلاً BTCUSDT" required></div>
        </div>
        <div class="grid cols-3">
          <div class="field">
            <label>جهت</label>
            <select name="direction"><option value="long">لانگ</option><option value="short">شورت</option></select>
          </div>
          <div class="field"><label>تایم‌فریم</label><input type="text" name="timeframe" placeholder="مثلاً 15m، 1H، 4H"></div>
          <div class="field">
            <label>سشن معاملاتی</label>
            <select name="session"><option value="asia">آسیا</option><option value="london">لندن</option><option value="ny">نیویورک</option></select>
          </div>
        </div>
        <div class="grid cols-3">
          <div class="field">
            <label>استراتژی</label>
            <select name="strategy">${strategyOptions || '<option value="">— استراتژی‌ای ثبت نشده —</option>'}</select>
          </div>
          <div class="field">
            <label>سطح تأیید (ریسک)</label>
            <select name="riskTier">${tierOptions || '<option value="">— سطحی ثبت نشده —</option>'}</select>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>چک‌لیست تأییدها</h3>
        <div class="grid cols-2">
          ${STATE.checklist.map(item=>`
            <div class="checkline"><input type="checkbox" name="chk__${item.id}" id="chk__${item.id}"><label for="chk__${item.id}">${escapeHtml(item.label)}</label></div>
          `).join('') || '<div class="hint">هنوز آیتمی توی چک‌لیست نیست — از تب «چک‌لیست» اضافه کن.</div>'}
        </div>
        <div class="field" style="margin-top:14px;">
          <label>جمله توجیه ورود (یک جمله)</label>
          <textarea name="justification" placeholder="چرا این معامله رو گرفتم؟"></textarea>
          <div class="hint" id="fomo-hint"></div>
        </div>
      </div>

      <div class="card">
        <h3>قیمت و مدیریت ریسک</h3>
        <div class="grid cols-3">
          <div class="field"><label>قیمت ورود</label><input type="number" step="any" name="entry" required></div>
          <div class="field"><label>حد ضرر</label><input type="number" step="any" name="stop" required></div>
          <div class="field"><label>ریسک این معامله (${riskUnitLabel()})</label><input type="number" step="any" name="riskAmount" placeholder="خودکار از سطح تأیید"></div>
        </div>
      </div>

      <div class="card">
        <h3>جزئیات تکمیلی</h3>
        <div class="grid cols-2">
          <div class="field">
            <label>نوع پوزیشن / خروج</label>
            <input type="text" name="positionType" list="position-type-options" placeholder="مثلاً trigger stop، candle close">
            <datalist id="position-type-options">
              <option value="trigger stop"><option value="candle close">
            </datalist>
          </div>
          <div class="field">
            <label>حالت ذهنی</label>
            <input type="text" name="mentalStatus" list="mental-status-options" placeholder="مثلاً focused، tired، fomo">
            <datalist id="mental-status-options">
              <option value="focused"><option value="not focused"><option value="tired"><option value="fomo">
            </datalist>
          </div>
          <div class="field">
            <label>نحوه بسته‌شدن معامله</label>
            <input type="text" name="exitType" list="exit-type-options" placeholder="مثلاً stopped، close by myself، risk free">
            <datalist id="exit-type-options">
              <option value="stopped"><option value="close by myself"><option value="risk free">
            </datalist>
          </div>
          <div class="field"><label>اشتباهات</label><textarea name="mistakes" placeholder="اگه اشتباهی توی این معامله بود بنویس"></textarea></div>
        </div>
      </div>

      <div class="card">
        <h3>اسکرین‌شات‌ها</h3>
        <div class="grid cols-3">
          <div class="field"><label>اسکرین‌شات 15M</label><input type="text" name="screenshot15m" placeholder="لینک تصویر"></div>
          <div class="field"><label>اسکرین‌شات 1H</label><input type="text" name="screenshot1h" placeholder="لینک تصویر"></div>
          <div class="field"><label>اسکرین‌شات 4H</label><input type="text" name="screenshot4h" placeholder="لینک تصویر"></div>
        </div>
      </div>

      <div class="card">
        <h3>نتیجه (اختیاری — بعداً هم قابل ویرایشه)</h3>
        <div class="grid cols-3">
          <div class="field">
            <label>وضعیت</label>
            <select name="outcome" id="outcome-select">
              <option value="open">باز</option>
              <option value="tp">TP</option>
              <option value="sl">SL</option>
              <option value="riskfree">ریسک‌فری</option>
            </select>
          </div>
          <div class="field"><label>R محقق‌شده</label><input type="number" step="any" name="realizedR" id="realizedR-input" placeholder="مثلاً 2.5 یا -1"></div>
          <div class="field"><label>درصد بسته‌شده تا الان</label><input type="number" step="any" name="closedPct" placeholder="0 تا 100"></div>
        </div>
        <div class="checkline" style="margin-top:4px;">
          <input type="checkbox" name="riskFreeOpen" id="riskFreeOpen">
          <label for="riskFreeOpen">ریسک‌فری شده (استاپ رو به نقطه ورود بردم) — این معامله رو از «ریسک درگیر» کنار بذار</label>
        </div>
        <div class="hint">برای اینکه این معامله توی «حد سود/ضرر» حساب بشه، هم «وضعیت» (غیر از باز) هم «R محقق‌شده» باید پر باشن — وگرنه صفر در نظر گرفته می‌شه. پوزیشن‌های باز هم خودکار توی «ریسک درگیر» همون صفحه نشون داده می‌شن، مگر اینکه تیک بالا زده باشه.</div>
        <div class="field" style="margin-top:10px;"><label>یادداشت / درس گرفته‌شده</label><textarea name="notes" placeholder="چی خوب پیش رفت، چی نه؟"></textarea></div>
      </div>

      <div style="display:flex; gap:10px;">
        <button type="submit" class="btn primary">${editing ? 'ذخیره تغییرات' : 'ثبت معامله'}</button>
        ${editing ? '<button type="button" class="btn ghost" id="btn-cancel-edit">انصراف</button>' : ''}
      </div>
    </form>
  `;
}

function populateEditForm(trade){
  const form = document.getElementById('form-new-trade');
  if(!form || !trade) return;
  Object.entries(trade).forEach(([key, val])=>{
    if(key === 'checklist') return;
    const el = form.elements[key];
    if(!el) return;
    if(el.type === 'checkbox') el.checked = !!val;
    else if(val !== null && val !== undefined) el.value = val;
  });
  if(trade.checklist){
    STATE.checklist.forEach(item=>{
      const el = form.elements['chk__'+item.id];
      if(el) el.checked = !!trade.checklist[item.id];
    });
  }
}

function attachFomoWatcher(){
  const ta = document.querySelector('textarea[name="justification"]');
  if(!ta) return;
  ta.addEventListener('input', ()=>{
    const hint = document.getElementById('fomo-hint');
    hint.innerHTML = hasFomoLanguage(ta.value)
      ? '<div class="warn-box">⚠ این جمله لحن FOMO داره — طبق قانون خودت بهتره از این معامله بگذری.</div>'
      : '';
  });
}

function attachOutcomeAutofill(){
  const outcomeSelect = document.getElementById('outcome-select');
  const rInput = document.getElementById('realizedR-input');
  if(!outcomeSelect || !rInput) return;
  outcomeSelect.addEventListener('change', ()=>{
    if(rInput.value !== '') return; // اگه خودش عددی زده، دست نمی‌زنیم
    if(outcomeSelect.value === 'sl') rInput.value = '-1';
    else if(outcomeSelect.value === 'riskfree') rInput.value = '0';
  });
}

function handleNewTradeSubmit(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const strategy = f.get('strategy');
  const riskTierId = f.get('riskTier');
  const tier = findTier(riskTierId);
  const justification = f.get('justification') || '';
  const date = f.get('date');

  const checklist = {};
  STATE.checklist.forEach(item=>{ checklist[item.id] = !!f.get('chk__'+item.id); });

  const fields = {
    date,
    time: f.get('time') || '',
    symbol: (f.get('symbol')||'').toUpperCase().trim(),
    direction: f.get('direction'),
    timeframe: f.get('timeframe') || '',
    strategy,
    riskTier: riskTierId,
    session: f.get('session'),
    checklist,
    justification,
    entry: parseFloat(f.get('entry')),
    stop: parseFloat(f.get('stop')),
    riskAmount: f.get('riskAmount') ? parseFloat(f.get('riskAmount')) : (tier ? tier.amount : null),
    positionType: f.get('positionType') || '',
    mentalStatus: f.get('mentalStatus') || '',
    exitType: f.get('exitType') || '',
    mistakes: f.get('mistakes') || '',
    screenshot15m: f.get('screenshot15m') || '',
    screenshot1h: f.get('screenshot1h') || '',
    screenshot4h: f.get('screenshot4h') || '',
    outcome: f.get('outcome'),
    realizedR: f.get('realizedR') ? parseFloat(f.get('realizedR')) : null,
    closedPct: f.get('closedPct') ? parseFloat(f.get('closedPct')) : null,
    riskFreeOpen: !!f.get('riskFreeOpen'),
    notes: f.get('notes') || '',
    flagWeekend: isWeekend(date),
    flagFomo: hasFomoLanguage(justification) || String(f.get('mentalStatus')||'').toLowerCase().includes('fomo'),
    flagEarlyEntry: STATE.checklist.some(i=>i.id==='candleClosed') ? !checklist.candleClosed : false
  };

  if(STATE.editingId){
    const idx = STATE.trades.findIndex(t=>t.id === STATE.editingId);
    if(idx > -1) STATE.trades[idx] = { ...STATE.trades[idx], ...fields };
    STATE.editingId = null;
    toast('معامله ویرایش شد');
  } else {
    STATE.trades.push({ id: uid('t'), ...fields, createdAt: Date.now() });
    toast('معامله ثبت شد');
  }

  saveTrades();
  STATE.view = 'trades';
  render();
}

/* ============================== لیست معاملات ============================== */
function viewTradesList(){
  const trades = filteredTrades();
  const rows = trades.slice().reverse().map(t => tradeRow(t)).join('');
  const strategyFilterOptions = STATE.strategies.map(s=>`<option value="${s.id}">${s.label}</option>`).join('');
  return `
    <h2 class="section-title">لیست معاملات</h2>
    <p class="section-sub">${trades.length} از ${STATE.trades.length} معامله نمایش داده می‌شه</p>

    <div class="filters">
      <div class="field">
        <label>استراتژی</label>
        <select id="filter-strategy"><option value="all">همه</option>${strategyFilterOptions}</select>
      </div>
      <div class="field">
        <label>وضعیت</label>
        <select id="filter-outcome">
          <option value="all">همه</option>
          <option value="open">باز</option>
          <option value="tp">TP</option>
          <option value="sl">SL</option>
          <option value="riskfree">ریسک‌فری</option>
        </select>
      </div>
    </div>

    ${trades.length === 0 ? '<div class="empty">معامله‌ای با این فیلتر پیدا نشد.</div>' : `
    <div class="card" style="padding:0; overflow-x:auto;">
      <table>
        <thead><tr>
          <th>تاریخ</th><th>نماد</th><th>استراتژی</th><th>جهت</th>
          <th>ریسک (${riskUnitSymbol()})</th><th>R</th><th>وضعیت</th><th>هشدارها</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`}
  `;
}

function filteredTrades(){
  return STATE.trades.filter(t=>{
    if(STATE.filters.strategy !== 'all' && t.strategy !== STATE.filters.strategy) return false;
    if(STATE.filters.outcome !== 'all' && t.outcome !== STATE.filters.outcome) return false;
    return true;
  });
}

function tradeRow(t){
  const cls = OUTCOME_TAG_CLASS[t.outcome] || '';
  const outcomeTag = t.outcome === 'open'
    ? '<span class="tag">باز</span>'
    : `<span class="tag ${cls}">${OUTCOME_LABELS[t.outcome] || t.outcome}</span>`;
  const flags = [
    t.flagWeekend ? '<span class="flag">آخر هفته</span>' : '',
    t.flagFomo ? '<span class="flag">FOMO</span>' : '',
    t.flagEarlyEntry ? '<span class="flag">ورود زودهنگام</span>' : '',
    (t.outcome === 'open' && t.riskFreeOpen) ? '<span class="flag">ریسک‌فری</span>' : ''
  ].join('');
  return `
    <tr>
      <td class="num">${t.date}</td>
      <td>${t.symbol || '—'}</td>
      <td><span style="color:${strategyColor(t.strategy)}">${strategyLabel(t.strategy)}</span></td>
      <td>${t.direction==='long'?'لانگ':'شورت'}</td>
      <td class="num">${fmtRisk(t.riskAmount)}</td>
      <td class="num">${t.realizedR!=null ? (t.realizedR>=0?'+':'')+fmtNum(t.realizedR,2)+'R' : '—'}</td>
      <td>${outcomeTag}</td>
      <td>${flags || '—'}</td>
      <td class="row-actions">
        <button class="btn small ghost" data-edit="${t.id}">ادیت</button>
        <button class="btn small ghost" data-del="${t.id}">حذف</button>
      </td>
    </tr>
  `;
}

/* ============================== استراتژی‌ها و قوانین (قابل ویرایش) ============================== */
function viewRules(){
  const cards = STATE.strategies.map((s, sIdx) => `
    <div class="card rule-card" style="border-inline-start-color:${s.color}">
      <div class="strategy-head">
        <div class="strategy-head-left">
          <input type="color" class="color-swatch" data-strat-color="${s.id}" value="${s.color}">
          <input type="text" class="label-input" data-strat-label="${s.id}" value="${escapeHtml(s.label)}">
        </div>
        <button class="btn small danger" data-strat-delete="${s.id}">حذف استراتژی</button>
      </div>
      <div data-rules-list="${s.id}">
        ${s.rules.map((r, rIdx)=>`
          <div class="rule-row">
            <input type="text" data-rule-edit="${s.id}|${rIdx}" value="${escapeHtml(r)}">
            <button class="btn small ghost" data-rule-delete="${s.id}|${rIdx}">حذف</button>
          </div>
        `).join('')}
      </div>
      <button class="btn small ghost" data-rule-add="${s.id}" style="margin-top:4px;">+ افزودن قانون</button>
    </div>
  `).join('');

  const tierRows = STATE.tiers.map((t, i)=>`
    <div class="tier-row">
      <input type="text" data-tier-label="${t.id}" value="${escapeHtml(t.label)}" style="font-size:13.5px;">
      <input type="number" step="any" data-tier-amount="${t.id}" value="${t.amount}" placeholder="مبلغ به ${riskUnitLabel()}">
      <button class="btn small danger" data-tier-delete="${t.id}">حذف</button>
    </div>
  `).join('');

  return `
    <h2 class="section-title">استراتژی‌ها و قوانین</h2>
    <p class="section-sub">همه‌چیز اینجا قابل ویرایشه — می‌تونی استراتژی جدید اضافه کنی، قوانین رو تغییر بدی، یا سطوح ریسک رو دوباره تنظیم کنی.</p>

    ${cards || '<div class="empty">هنوز استراتژی‌ای ثبت نشده.</div>'}

    <div class="card">
      <h3>افزودن استراتژی جدید</h3>
      <form id="form-add-strategy" class="add-strategy-form">
        <div class="field"><label>نام استراتژی</label><input type="text" name="newLabel" placeholder="مثلاً Range Reversal" required></div>
        <div class="field"><label>رنگ</label><input type="color" name="newColor" value="#6aa6c9"></div>
        <button type="submit" class="btn primary">افزودن</button>
      </form>
    </div>

    <div class="card">
      <h3>واحد ریسک</h3>
      <div class="field" style="max-width:260px;">
        <label>ریسک توی کل ژورنال به چه واحدی حساب بشه؟</label>
        <select id="risk-unit-select">
          <option value="dollar" ${STATE.settings.riskUnit==='dollar'?'selected':''}>دلار ($)</option>
          <option value="percent" ${STATE.settings.riskUnit==='percent'?'selected':''}>درصد (٪)</option>
        </select>
      </div>
      <div class="hint">این فقط واحد نمایش رو عوض می‌کنه — عددی که برای هر معامله وارد کردی همون‌طور می‌مونه.</div>
    </div>

    <div class="card">
      <h3>سطوح ریسک</h3>
      ${tierRows}
      <button class="btn small ghost" id="btn-add-tier" style="margin-top:4px;">+ افزودن سطح ریسک</button>
    </div>
  `;
}

function escapeHtml(str){
  return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ============================== چک‌لیست (قابل ویرایش) ============================== */
function viewChecklist(){
  const rows = STATE.checklist.map((item, idx)=>`
    <div class="rule-row">
      <input type="text" data-checklist-edit="${item.id}" value="${escapeHtml(item.label)}">
      <button class="btn small ghost" data-checklist-delete="${item.id}">حذف</button>
    </div>
  `).join('');

  return `
    <h2 class="section-title">چک‌لیست</h2>
    <p class="section-sub">همین آیتم‌ها توی فرم «ثبت معامله» به‌عنوان چک‌باکس نشون داده می‌شن. هر چقدر خواستی اضافه یا حذف کن.</p>

    <div class="card">
      ${rows || '<div class="empty">هنوز آیتمی نیست.</div>'}
      <form id="form-add-checklist" style="display:flex; gap:10px; margin-top:10px;">
        <input type="text" name="newItem" placeholder="مثلاً تأیید حجم بالای میانگین" style="flex:1;" required>
        <button type="submit" class="btn primary">افزودن</button>
      </form>
    </div>
  `;
}

/* ============================== یادداشت‌ها (کلی) ============================== */
function todayStr(){ return new Date().toISOString().slice(0,10); }

function weekStartStr(){
  const d = new Date();
  const day = d.getDay(); // 0=Sun..6=Sat
  const sinceSaturday = (day + 1) % 7; // فاصله از آخرین شنبه (هفته فارسی)
  d.setDate(d.getDate() - sinceSaturday);
  return d.toISOString().slice(0,10);
}

function monthStartStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

function dollarPL(t){
  if(t.outcome === 'open') return 0;
  const r = Number(t.realizedR);
  const amt = Number(t.riskAmount);
  if(isNaN(r) || isNaN(amt)) return 0;
  return r * amt;
}

function periodPL(trades, fromStr){
  const today = todayStr();
  let loss = 0, profit = 0;
  trades.forEach(t=>{
    if(t.date >= fromStr && t.date <= today){
      const pl = dollarPL(t);
      if(pl < 0) loss += Math.abs(pl);
      else profit += pl;
    }
  });
  return { loss, profit };
}

function renderLimitRow(key, label, usedAmount, limitRaw){
  const limit = parseFloat(limitRaw);
  const hasLimit = !isNaN(limit) && limit > 0;
  let bar = '';
  if(hasLimit){
    const pct = Math.min(100, (usedAmount / limit) * 100);
    const cls = pct >= 100 ? 'danger' : pct >= 70 ? 'warn' : 'ok';
    const remaining = Math.max(0, limit - usedAmount);
    bar = `
      <div class="limit-bar-track"><div class="limit-bar-fill ${cls}" style="width:${pct}%"></div></div>
      <div class="limit-meta">استفاده‌شده: ${fmtRisk(usedAmount)} از ${fmtRisk(limit)} · باقیمانده: ${fmtRisk(remaining)}</div>
    `;
  } else if(usedAmount > 0){
    bar = `<div class="limit-meta">تا الان: ${fmtRisk(usedAmount)} — برای دیدن باقیمانده، یه سقف تعیین کن</div>`;
  }
  return `
    <div class="field">
      <label>${label}</label>
      <input type="number" step="any" data-gnote="${key}" value="${escapeHtml(String(limitRaw||''))}" placeholder="مبلغ به ${riskUnitLabel()}">
      ${bar}
    </div>
  `;
}

function viewPnL(){
  const n = STATE.globalNotes;
  const today = periodPL(STATE.trades, todayStr());
  const week = periodPL(STATE.trades, weekStartStr());
  const month = periodPL(STATE.trades, monthStartStr());
  const openTrades = STATE.trades.filter(t=>t.outcome==='open');
  const atRiskTrades = openTrades.filter(t=>!t.riskFreeOpen);
  const riskFreeTrades = openTrades.filter(t=>t.riskFreeOpen);
  const openRisk = atRiskTrades.reduce((s,t)=> s + (Number(t.riskAmount)||0), 0);

  return `
    <h2 class="section-title">حد سود/ضرر</h2>
    <p class="section-sub">حد ضرر و حد سود روزانه/هفتگی/ماهانه — بر اساس ریسک هر معامله و R محقق‌شده، خودش حساب می‌کنه چقدر مصرف شده و چقدر مونده.</p>

    <div class="card">
      <h3>ریسک درگیر (پوزیشن‌های باز)</h3>
      <div class="stat-grid" style="grid-template-columns: 1fr 1fr 1fr;">
        <div class="stat">
          <div class="label">مجموع ریسک درگیر</div>
          <div class="value">${fmtRisk(openRisk)}</div>
        </div>
        <div class="stat">
          <div class="label">پوزیشن باز با ریسک</div>
          <div class="value">${atRiskTrades.length}</div>
        </div>
        <div class="stat">
          <div class="label">پوزیشن باز ریسک‌فری</div>
          <div class="value">${riskFreeTrades.length}</div>
        </div>
      </div>
      ${riskFreeTrades.length ? '<div class="hint">پوزیشن‌های ریسک‌فری‌شده توی مجموع ریسک درگیر حساب نمی‌شن.</div>' : ''}
    </div>

    <div class="card">
      <h3>روزانه</h3>
      <div class="grid cols-2">
        ${renderLimitRow('dailyLossLimit', 'حد ضرر روزانه', today.loss, n.dailyLossLimit)}
        ${renderLimitRow('dailyProfitTarget', 'حد سود روزانه', today.profit, n.dailyProfitTarget)}
      </div>
    </div>

    <div class="card">
      <h3>هفتگی <span class="hint" style="display:inline;">(از شنبه)</span></h3>
      <div class="grid cols-2">
        ${renderLimitRow('weeklyLossLimit', 'حد ضرر هفتگی', week.loss, n.weeklyLossLimit)}
        ${renderLimitRow('weeklyProfitTarget', 'حد سود هفتگی', week.profit, n.weeklyProfitTarget)}
      </div>
    </div>

    <div class="card">
      <h3>ماهانه <span class="hint" style="display:inline;">(اول ماه میلادی)</span></h3>
      <div class="grid cols-2">
        ${renderLimitRow('monthlyLossLimit', 'حد ضرر ماهانه', month.loss, n.monthlyLossLimit)}
        ${renderLimitRow('monthlyProfitTarget', 'حد سود ماهانه', month.profit, n.monthlyProfitTarget)}
      </div>
      <div class="hint">این حساب‌ها از روی ریسک هر معامله (ضربدر R محقق‌شده) به‌دست میان — برای دقیق‌بودنشون، فیلد «ریسک این معامله» رو توی ثبت معامله پر کن.</div>
    </div>

    <div class="card" style="border-color:#4a2e2a;">
      <h3 style="color:var(--red);">منطقهٔ خطر</h3>
      <p class="hint" style="margin-bottom:10px;">همهٔ معاملات ثبت‌شده برای همیشه پاک می‌شن. استراتژی‌ها، قوانین، چک‌لیست و یادداشت‌ها دست‌نخورده می‌مونن.</p>
      <button class="btn danger" id="btn-wipe">پاک‌کردن همهٔ معاملات</button>
    </div>
  `;
}

function viewFreeNotes(){
  const n = STATE.globalNotes;
  return `
    <h2 class="section-title">یادداشت</h2>
    <p class="section-sub">هر نکته یا یادآوری کلی که می‌خوای همیشه در دسترس باشه.</p>
    <div class="card">
      <textarea data-gnote="freeNotes" style="min-height:320px;" placeholder="هر نکته یا یادآوری کلی دیگه‌ای که می‌خوای همیشه در دسترس باشه...">${escapeHtml(n.freeNotes)}</textarea>
    </div>
  `;
}

/* ============================== اتصال رویدادها ============================== */
function attachViewHandlers(){
  if(STATE.view === 'new'){
    document.getElementById('form-new-trade').addEventListener('submit', handleNewTradeSubmit);
    attachFomoWatcher();
    attachOutcomeAutofill();
    if(STATE.editingId){
      const editing = STATE.trades.find(t=>t.id === STATE.editingId);
      populateEditForm(editing);
      document.getElementById('fomo-hint').innerHTML = hasFomoLanguage(editing && editing.justification)
        ? '<div class="warn-box">⚠ این جمله لحن FOMO داره — طبق قانون خودت بهتره از این معامله بگذری.</div>'
        : '';
      const cancelBtn = document.getElementById('btn-cancel-edit');
      cancelBtn && cancelBtn.addEventListener('click', ()=>{ STATE.editingId = null; STATE.view = 'trades'; render(); });
    }
  }

  if(STATE.view === 'trades'){
    const fs = document.getElementById('filter-strategy');
    const fo = document.getElementById('filter-outcome');
    if(fs) fs.value = STATE.filters.strategy;
    if(fo) fo.value = STATE.filters.outcome;
    fs && fs.addEventListener('change', e=>{ STATE.filters.strategy = e.target.value; render(); });
    fo && fo.addEventListener('change', e=>{ STATE.filters.outcome = e.target.value; render(); });
    document.querySelectorAll('[data-edit]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        STATE.editingId = btn.dataset.edit;
        STATE.view = 'new';
        render();
      });
    });
    document.querySelectorAll('[data-del]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(!confirm('این معامله حذف بشه؟')) return;
        STATE.trades = STATE.trades.filter(t=>t.id !== btn.dataset.del);
        saveTrades();
        render();
      });
    });
  }

  if(STATE.view === 'dashboard'){
    const from = document.getElementById('dash-from');
    const to = document.getElementById('dash-to');
    const clear = document.getElementById('dash-clear');
    from && from.addEventListener('change', e=>{ STATE.dashFilter.from = e.target.value; render(); });
    to && to.addEventListener('change', e=>{ STATE.dashFilter.to = e.target.value; render(); });
    clear && clear.addEventListener('click', ()=>{ STATE.dashFilter = { from:'', to:'' }; render(); });
  }

  if(STATE.view === 'pnl'){
    document.querySelectorAll('[data-gnote]').forEach(el=>{
      el.addEventListener('change', ()=>{
        STATE.globalNotes[el.dataset.gnote] = el.value;
        saveGlobalNotes();
      });
    });
    const wipeBtn = document.getElementById('btn-wipe');
    wipeBtn && wipeBtn.addEventListener('click', ()=>{
      if(!confirm('همهٔ معاملات پاک بشه؟ این عمل قابل بازگشت نیست.')) return;
      STATE.trades = [];
      saveTrades();
      toast('همهٔ معاملات پاک شد');
      render();
    });
  }

  if(STATE.view === 'freenotes'){
    document.querySelectorAll('[data-gnote]').forEach(el=>{
      el.addEventListener('change', ()=>{
        STATE.globalNotes[el.dataset.gnote] = el.value;
        saveGlobalNotes();
      });
    });
  }

  if(STATE.view === 'checklist'){
    document.querySelectorAll('[data-checklist-edit]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const item = STATE.checklist.find(i=>i.id === inp.dataset.checklistEdit);
        if(item){ item.label = inp.value.trim() || item.label; saveChecklist(); }
      });
    });
    document.querySelectorAll('[data-checklist-delete]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(!confirm('این آیتم از چک‌لیست حذف بشه؟')) return;
        STATE.checklist = STATE.checklist.filter(i=>i.id !== btn.dataset.checklistDelete);
        saveChecklist();
        render();
      });
    });
    const addChecklistForm = document.getElementById('form-add-checklist');
    addChecklistForm && addChecklistForm.addEventListener('submit', e=>{
      e.preventDefault();
      const f = new FormData(e.target);
      const label = (f.get('newItem')||'').trim();
      if(!label) return;
      STATE.checklist.push({ id: slugify(label), label });
      saveChecklist();
      render();
    });
  }

  if(STATE.view === 'rules'){
    document.querySelectorAll('[data-strat-label]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const s = findStrategy(inp.dataset.stratLabel);
        if(s){ s.label = inp.value.trim() || s.label; saveStrategies(); render(); }
      });
    });
    document.querySelectorAll('[data-strat-color]').forEach(inp=>{
      inp.addEventListener('input', ()=>{
        const s = findStrategy(inp.dataset.stratColor);
        if(s){ s.color = inp.value; saveStrategies(); }
      });
      inp.addEventListener('change', ()=> render());
    });
    document.querySelectorAll('[data-strat-delete]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(!confirm('این استراتژی حذف بشه؟ معاملات ثبت‌شده باقی می‌مونن ولی به این استراتژی اشاره می‌کنن.')) return;
        STATE.strategies = STATE.strategies.filter(s=>s.id !== btn.dataset.stratDelete);
        saveStrategies();
        render();
      });
    });
    document.querySelectorAll('[data-rule-edit]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const [sid, idx] = inp.dataset.ruleEdit.split('|');
        const s = findStrategy(sid);
        if(s){ s.rules[Number(idx)] = inp.value; saveStrategies(); }
      });
    });
    document.querySelectorAll('[data-rule-delete]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const [sid, idx] = btn.dataset.ruleDelete.split('|');
        const s = findStrategy(sid);
        if(s){ s.rules.splice(Number(idx),1); saveStrategies(); render(); }
      });
    });
    document.querySelectorAll('[data-rule-add]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const s = findStrategy(btn.dataset.ruleAdd);
        if(s){ s.rules.push(''); saveStrategies(); render(); }
      });
    });
    const addForm = document.getElementById('form-add-strategy');
    addForm && addForm.addEventListener('submit', e=>{
      e.preventDefault();
      const f = new FormData(e.target);
      const label = (f.get('newLabel')||'').trim();
      if(!label) return;
      STATE.strategies.push({ id: slugify(label), label, color: f.get('newColor') || '#6aa6c9', rules: [] });
      saveStrategies();
      toast('استراتژی اضافه شد');
      render();
    });

    document.querySelectorAll('[data-tier-label]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const t = findTier(inp.dataset.tierLabel);
        if(t){ t.label = inp.value.trim() || t.label; saveTiers(); }
      });
    });
    document.querySelectorAll('[data-tier-amount]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const t = findTier(inp.dataset.tierAmount);
        if(t){ t.amount = parseFloat(inp.value) || 0; saveTiers(); }
      });
    });
    document.querySelectorAll('[data-tier-delete]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(!confirm('این سطح ریسک حذف بشه؟')) return;
        STATE.tiers = STATE.tiers.filter(t=>t.id !== btn.dataset.tierDelete);
        saveTiers();
        render();
      });
    });
    const addTierBtn = document.getElementById('btn-add-tier');
    addTierBtn && addTierBtn.addEventListener('click', ()=>{
      STATE.tiers.push({ id: slugify('tier'), label: 'سطح جدید', amount: 25 });
      saveTiers();
      render();
    });
    const riskUnitSelect = document.getElementById('risk-unit-select');
    riskUnitSelect && riskUnitSelect.addEventListener('change', ()=>{
      STATE.settings.riskUnit = riskUnitSelect.value;
      saveSettings();
      render();
    });
  }
}

document.querySelectorAll('.nav-item').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(btn.dataset.view === 'new') STATE.editingId = null;
    STATE.view = btn.dataset.view;
    render();
  });
});

/* ---------- منوی جمع‌شونده ---------- */
const sidenavEl = document.getElementById('sidenav');
if(sidenavEl && STATE.navCollapsed) sidenavEl.classList.add('collapsed');
const navToggleBtn = document.getElementById('nav-toggle');
navToggleBtn && navToggleBtn.addEventListener('click', ()=>{
  STATE.navCollapsed = !STATE.navCollapsed;
  sidenavEl.classList.toggle('collapsed', STATE.navCollapsed);
  saveNavCollapsed();
});

/* ---------- خروجی اکسل ---------- */
document.getElementById('btn-export-xlsx').addEventListener('click', ()=>{
  if(typeof XLSX === 'undefined'){ toast('کتابخانه اکسل بارگذاری نشد — اتصال اینترنت رو چک کن'); return; }
  if(STATE.trades.length === 0){ toast('هنوز معامله‌ای ثبت نشده'); return; }

  const rows = STATE.trades.map(t=>{
    const row = {
      'تاریخ': t.date,
      'ساعت': t.time || '',
      'نماد': t.symbol,
      'استراتژی': strategyLabel(t.strategy),
      'جهت': t.direction === 'long' ? 'لانگ' : 'شورت',
      'تایم‌فریم': t.timeframe || '',
      'سشن': t.session,
      'قیمت ورود': t.entry,
      'حد ضرر': t.stop,
      [`ریسک (${riskUnitSymbol()})`]: t.riskAmount,
      'وضعیت': OUTCOME_LABELS[t.outcome] || t.outcome,
      'R محقق‌شده': t.realizedR,
      'درصد بسته‌شده': t.closedPct
    };
    STATE.checklist.forEach(item=>{
      row[item.label] = (t.checklist && t.checklist[item.id]) ? 'بله' : 'خیر';
    });
    Object.assign(row, {
      'آخر هفته': t.flagWeekend ? 'بله' : 'خیر',
      'ریسک‌فری (پوزیشن باز)': t.riskFreeOpen ? 'بله' : 'خیر',
      'FOMO': t.flagFomo ? 'بله' : 'خیر',
      'نوع پوزیشن/خروج': t.positionType || '',
      'حالت ذهنی': t.mentalStatus || '',
      'نحوه بسته‌شدن معامله': t.exitType || '',
      'اشتباهات': t.mistakes || '',
      'اسکرین‌شات 15M': t.screenshot15m || '',
      'اسکرین‌شات 1H': t.screenshot1h || '',
      'اسکرین‌شات 4H': t.screenshot4h || '',
      'توجیه ورود': t.justification,
      'یادداشت': t.notes
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'معاملات');
  XLSX.writeFile(wb, `trade-journal-${new Date().toISOString().slice(0,10)}.xlsx`);
});

/* ---------- ورودی اکسل (فرمت آزاد — ستون‌ها با چند اسم رایج شناسایی می‌شن) ---------- */
function normalizeHeader(h){ return String(h||'').trim().toLowerCase().replace(/\s+/g,' '); }

function buildRowMap(row){
  const norm = {};
  Object.keys(row).forEach(k => { norm[normalizeHeader(k)] = row[k]; });
  const out = {};
  Object.entries(FIELD_ALIASES).forEach(([field, aliases])=>{
    for(const alias of aliases){
      const key = normalizeHeader(alias);
      if(Object.prototype.hasOwnProperty.call(norm, key) && norm[key] !== ''){
        out[field] = norm[key];
        break;
      }
    }
  });
  return { out, norm };
}

function excelDateToStr(v){
  if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
  if(typeof v === 'number' && window.XLSX && XLSX.SSF){
    const d = XLSX.SSF.parse_date_code(v);
    if(d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  if(typeof v === 'string' && v.trim()){
    const parsed = new Date(v);
    if(!isNaN(parsed)) return parsed.toISOString().slice(0,10);
    return v.trim();
  }
  return '';
}

function excelTimeStr(v){
  if(v instanceof Date && !isNaN(v)){
    const hh = String(v.getHours()).padStart(2,'0');
    const mm = String(v.getMinutes()).padStart(2,'0');
    if(hh === '00' && mm === '00') return '';
    return `${hh}:${mm}`;
  }
  return '';
}

function parseYesNo(v){
  const t = String(v||'').trim().toLowerCase();
  return ['yes','y','true','1','بله'].includes(t);
}

function normalizeOutcome(raw, realizedR){
  if(raw !== undefined && raw !== null && raw !== ''){
    const t = String(raw).trim().toLowerCase();
    for(const [key, list] of Object.entries(OUTCOME_SYNONYMS)){
      if(list.includes(t)) return key;
    }
  }
  if(realizedR !== null && !isNaN(realizedR)){
    if(realizedR > 0) return 'tp';
    if(realizedR < 0) return 'sl';
    return 'riskfree';
  }
  return 'open';
}

function normalizeDirection(raw){
  const t = String(raw||'').trim().toLowerCase();
  if(['short','sell','شورت'].includes(t)) return 'short';
  return 'long';
}

function resolveOrCreateStrategy(raw){
  if(!raw || !String(raw).trim()) return null;
  const label = String(raw).trim();
  const existing = STATE.strategies.find(s => s.label.toLowerCase() === label.toLowerCase() || s.id === label);
  if(existing) return existing.id;
  const color = STRATEGY_PALETTE[STATE.strategies.length % STRATEGY_PALETTE.length];
  const s = { id: slugify(label), label, color, rules: [] };
  STATE.strategies.push(s);
  return s.id;
}

function parseNum(v){
  if(v === undefined || v === null || v === '') return null;
  const n = parseFloat(String(v).toString().replace('%','').trim());
  return isNaN(n) ? null : n;
}

function handleExcelImport(file){
  if(typeof XLSX === 'undefined'){ toast('کتابخانه اکسل بارگذاری نشد — اتصال اینترنت رو چک کن'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    try{
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      let imported = 0, skipped = 0;

      rows.forEach(row=>{
        const { out: m } = buildRowMap(row);
        const date = excelDateToStr(m.date);
        const symbol = String(m.symbol||'').toUpperCase().trim();
        if(!date || !symbol){ skipped++; return; }

        const realizedR = parseNum(m.realizedR);
        const strategyId = resolveOrCreateStrategy(m.strategy);
        const justification = String(m.justification||'');
        const mentalStatus = String(m.mentalStatus||'');
        const mistakesText = String(m.mistakes||'').toLowerCase();

        const checklist = {};
        STATE.checklist.forEach(item=>{
          if(m[item.id] !== undefined) checklist[item.id] = parseYesNo(m[item.id]);
          else if(item.id === 'candleClosed' || item.id === 'notWeekendRange') checklist[item.id] = true;
          else checklist[item.id] = false;
        });

        STATE.trades.push({
          id: uid('t'),
          date,
          time: excelTimeStr(m.date),
          symbol,
          direction: normalizeDirection(m.direction),
          timeframe: String(m.timeframe||''),
          strategy: strategyId,
          riskTier: null,
          session: m.session ? String(m.session).trim().toLowerCase() : '',
          checklist,
          justification,
          entry: parseNum(m.entry),
          stop: parseNum(m.stop),
          riskAmount: parseNum(m.riskAmount),
          positionType: String(m.positionType||''),
          mentalStatus,
          exitType: String(m.exitType||''),
          mistakes: String(m.mistakes||''),
          screenshot15m: String(m.screenshot15m||''),
          screenshot1h: String(m.screenshot1h||''),
          screenshot4h: String(m.screenshot4h||''),
          riskFreeOpen: parseYesNo(m.riskFreeOpen),
          outcome: normalizeOutcome(m.outcome, realizedR),
          realizedR,
          closedPct: parseNum(m.closedPct),
          notes: String(m.notes||''),
          flagWeekend: isWeekend(date),
          flagFomo: hasFomoLanguage(justification) || mentalStatus.toLowerCase().includes('fomo'),
          flagEarlyEntry: mistakesText.includes('before candle close') || mistakesText.includes('کلوز زودهنگام') || mistakesText.includes('زودهنگام'),
          createdAt: Date.now()
        });
        imported++;
      });

      saveTrades();
      saveStrategies();
      toast(`${imported} معامله وارد شد${skipped ? ` — ${skipped} ردیف بدون تاریخ/نماد رد شد` : ''}`);
      STATE.view = 'trades';
      render();
    }catch(err){
      toast('خوندن فایل اکسل ممکن نشد — ساختار فایل رو چک کن');
    }
  };
  reader.readAsArrayBuffer(file);
}

document.getElementById('file-import-xlsx').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  handleExcelImport(file);
  e.target.value = '';
});

window.addEventListener('resize', ()=>{
  if(STATE.view === 'dashboard'){
    const trades = dashboardTrades();
    drawEquityCurve(trades);
    drawStrategyChart(trades);
    drawRDistribution(trades);
  }
});

render();
