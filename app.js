
/* ============================================================
   CONFIG
   ============================================================ */
// Public CORS proxies (no signup needed). If one fails, next is tried.
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://cors.isomorphic-git.org/'
];

// Manual fallback rates (MMK) — updated manually if API fails
const FALLBACK_RATES = { USDT: 4600, BTC: 320000000, ETH: 15000000, BNB: 2800000 };

/* ============================================================
   Cyber background
   ============================================================ */
(function cyber() {
  const canvas = document.getElementById('cyber-bg');
  const ctx = canvas.getContext('2d');
  const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const fontSize = 14;
  let W, H, columns, drops;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    columns = Math.floor(W / fontSize);
    drops = Array(columns).fill(1);
  }
  resize();
  window.addEventListener('resize', resize);

  function draw() {
    ctx.fillStyle = 'rgba(6,8,13,0.08)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = fontSize + 'px monospace';
    for (let i = 0; i < drops.length; i++) {
      const text = chars[Math.floor(Math.random() * chars.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;
      const r = Math.random();
      ctx.fillStyle = r > 0.7 ? '#0ff' : r > 0.4 ? '#0f8' : '#06c';
      ctx.fillText(text, x, y);
      if (y > H && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ============================================================
   Helpers & state
   ============================================================ */
const $ = id => document.getElementById(id);
const state = {
  balances: { MMK: 0, USDT: 0, BTC: 0, ETH: 0, BNB: 0 },
  orders: [],
  history: [],
  user: null
};

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2200);
}
function logHistory(msg) {
  state.history.push({ t: new Date().toLocaleString(), msg });
  render();
}
function mockAddress(asset) {
  return 'rxt-' + asset.toLowerCase() + '-' + Math.random().toString(36).slice(2, 10);
}

/* ============================================================
   Binance P2P fetch with multiple CORS proxies + fallback
   ============================================================ */
async function fetchP2P(asset, tradeType = 'BUY') {
  const binanceUrl = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
  const body = {
    page: 1, rows: 1, payTypes: [], countries: [],
    publisherType: null, asset, fiat: 'MMK', tradeType
  };

  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(proxy + binanceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.data && json.data.length) {
        const ad = json.data[0];
        return {
          price: parseFloat(ad.adv.price),
          min: ad.adv.minSingleTransAmount,
          max: ad.adv.maxSingleTransAmount,
          nick: ad.advertiser.nickName,
          source: 'binance'
        };
      }
    } catch (e) { /* try next proxy */ }
  }

  // All proxies failed → fallback to manual rates
  return {
    price: FALLBACK_RATES[asset] || 4600,
    source: 'fallback',
    nick: 'Manual rate (API unavailable)'
  };
}

async function refreshTicker() {
  for (const a of ['USDT', 'BTC', 'ETH', 'BNB']) {
    try {
      const r = await fetchP2P(a, 'BUY');
      const txt = r.price.toLocaleString() + ' MMK';
      const el1 = $('tk-' + a.toLowerCase());
      const el2 = $('tk-' + a.toLowerCase() + '2');
      if (el1) el1.textContent = txt;
      if (el2) el2.textContent = txt;
    } catch (e) {
      const el1 = $('tk-' + a.toLowerCase());
      const el2 = $('tk-' + a.toLowerCase() + '2');
      if (el1) el1.textContent = '—';
      if (el2) el2.textContent = '—';
    }
  }
}

/* ============================================================
   Auth
   ============================================================ */
let isLoginMode = false;

$('authSwitch').onclick = () => {
  isLoginMode = !isLoginMode;
  $('authTitle').textContent = isLoginMode ? 'Log In' : 'Create Account';
  $('authBtn').textContent = isLoginMode ? 'Log In' : 'Sign Up';
  $('authSwitchText').textContent = isLoginMode ? "Don't have an account?" : 'Already have an account?';
  $('authSwitch').textContent = isLoginMode ? 'Sign up' : 'Log in';
};

$('authBtn').onclick = () => {
  const user = $('authUser').value.trim();
  const pass = $('authPass').value;
  if (user.length < 3) return toast('Username must be ≥ 3 chars');
  if (pass.length < 6) return toast('Password must be ≥ 6 chars');

  const users = JSON.parse(localStorage.getItem('rxt_users') || '[]');

  if (isLoginMode) {
    const found = users.find(u => u.username === user && u.password === pass);
    if (!found) return toast('Wrong username or password');
    state.user = user;
    enterApp(user);
  } else {
    if (users.find(u => u.username === user)) return toast('Username already taken');
    users.push({ username: user, password: pass });
    localStorage.setItem('rxt_users', JSON.stringify(users));
    state.user = user;
    enterApp(user);
  }
};

function enterApp(username) {
  $('auth').classList.remove('active');
  $('mainApp').classList.remove('hidden');
  $('settingsUser').textContent = username;
  document.querySelectorAll('#nav button').forEach(b => b.classList.remove('active'));
  document.querySelector('#nav button[data-tab="trade"]').classList.add('active');
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  $('trade').classList.add('active');
  logHistory(`Logged in as ${username}`);
  refreshTicker();
}

$('logoutBtn').onclick = () => {
  state.user = null;
  $('mainApp').classList.add('hidden');
  $('auth').classList.add('active');
  $('authUser').value = '';
  $('authPass').value = '';
  toast('Logged out');
};

/* ============================================================
   Tabs
   ============================================================ */
$('nav').addEventListener('click', e => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  document.querySelectorAll('#nav button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  $(btn.dataset.tab).classList.add('active');
});

/* ============================================================
   Trade
   ============================================================ */
$('getRate').onclick = async () => {
  const asset = $('asset').value;
  const side = $('side').value;
  $('p2pPrice').textContent = 'Loading…';
  $('p2pMeta').textContent = '';
  try {
    const r = await fetchP2P(asset, side);
    $('p2pPrice').textContent = r.price.toLocaleString() + ' MMK';
    const tag = r.source === 'binance' ? '🟢 Binance P2P' : '🟡 Fallback rate';
    $('p2pMeta').textContent = `${tag}${r.min ? ' · ' + r.min + '–' + r.max + ' MMK' : ''}`;
    const mmk = parseFloat($('amount').value) || 0;
    if (mmk > 0) {
      const recv = side === 'BUY' ? (mmk / r.price) : (mmk * r.price);
      $('receive').textContent = side === 'BUY'
        ? recv.toFixed(6) + ' ' + asset
        : recv.toLocaleString() + ' MMK';
    }
  } catch (err) {
    $('p2pPrice').textContent = '—';
    $('p2pMeta').innerHTML = '<span class="error">' + err.message + '</span>';
  }
};

$('placeOrder').onclick = () => {
  const asset = $('asset').value;
  const side = $('side').value;
  const mmk = parseFloat($('amount').value) || 0;
  const price = parseFloat($('p2pPrice').textContent.replace(/[^\d.]/g, '')) || 0;
  if (mmk <= 0) return toast('Enter an amount');
  if (!price) return toast('Fetch rate first');
  const order = {
    id: 'ORD' + Date.now().toString().slice(-6),
    type: side, asset, amount: mmk, price, status: 'Open'
  };
  state.orders.push(order);
  logHistory(`Order ${order.id} — ${side} ${asset} @ ${price} MMK`);
  toast('Order placed: ' + order.id);
};

/* ============================================================
   Deposit / Withdraw
   ============================================================ */
$('depAsset').onchange = e => $('depAddr').textContent = mockAddress(e.target.value);
$('depAddr').textContent = mockAddress('MMK');

$('doDeposit').onclick = () => {
  const asset = $('depAsset').value;
  const amt = parseFloat($('depAmount').value) || 0;
  if (amt <= 0) return toast('Enter amount');
  state.balances[asset] = (state.balances[asset] || 0) + amt;
  logHistory(`Deposited ${amt} ${asset} (mock)`);
  toast(`Deposited ${amt} ${asset}`);
};

$('doWithdraw').onclick = () => {
  const asset = $('wdAsset').value;
  const amt = parseFloat($('wdAmount').value) || 0;
  const addr = $('wdAddr').value.trim();
  if (amt <= 0) return toast('Enter amount');
  if (!addr) return toast('Enter address');
  if ((state.balances[asset] || 0) < amt) return toast('Insufficient balance');
  state.balances[asset] -= amt;
  logHistory(`Withdrew ${amt} ${asset} → ${addr}`);
  toast('Withdrawal requested');
};

/* ============================================================
   Render
   ============================================================ */
function render() {
  $('mmkBal').textContent = state.balances.MMK.toLocaleString();
  $('usdtBal').textContent = state.balances.USDT;
  $('btcBal').textContent = state.balances.BTC;
  $('ethBal').textContent = state.balances.ETH;
  $('bnbBal').textContent = state.balances.BNB;

  const ob = $('ordersBody');
  if (!state.orders.length) {
    ob.innerHTML = '<tr><td colspan="6" class="label">No orders yet.</td></tr>';
  } else {
    ob.innerHTML = state.orders.map(o => `<tr>
      <td>${o.id}</td>
      <td><span class="badge ${o.type.toLowerCase()}">${o.type}</span></td>
      <td>${o.asset}</td>
      <td>${o.amount.toLocaleString()}</td>
      <td>${o.price.toLocaleString()}</td>
      <td><span class="badge open">${o.status}</span></td>
    </tr>`).join('');
  }

  const hl = $('historyList');
  if (!state.history.length) {
    hl.innerHTML = '<li class="label">No transactions yet.</li>';
  } else {
    hl.innerHTML = state.history.slice().reverse().map(h =>
      `<li><small>${h.t}</small> — ${h.msg}</li>`).join('');
  }
}
render();

setInterval(() => { if (state.user) refreshTicker(); }, 60000);
