/* Kraken wire-withdraw concept — everything here is a front-end facade. No data leaves the browser. */
(() => {
  const START_BALANCE = 172328.32;
  const state = {
    balance: START_BALANCE,
    range: '1M',
    step: 'asset',
    history: [],
    bank: { name: '', bank: '', account: '', routing: '', nickname: '' },
    amount: '',
    receipt: null,
  };

  const $ = (s, el = document) => el.querySelector(s);
  const fmtUSD = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Fixed for the demo so the arrival always reads as Thursday, October 1.
  const arrivalDate = () => 'Thursday, October 1';

  /* ---------------- Header numbers ---------------- */
  function renderBalance(series) {
    const [whole, cents] = state.balance.toFixed(2).split('.');
    $('#pvValue').innerHTML =
      `<span>$${Number(whole).toLocaleString('en-US')}</span><span class="cents" style="margin-left:-12px">.${cents}</span>` +
      `<svg class="eye" viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>`;
    $('#payAvail').textContent = fmtUSD(state.balance) + ' available';

    const first = series[0].v;
    const change = state.balance - first;
    const pct = first > 0 ? (change / first) * 100 : 0;
    const up = change >= 0;
    const el = $('#changeValue');
    el.className = 'stat-value ' + (up ? 'up' : 'down');
    el.textContent = `${up ? '+' : '−'}${fmtUSD(Math.abs(change))} (${up ? '↗' : '↘'}${Math.abs(pct).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)`;
    $('#changeLabel').textContent = 'Balance Change ' + state.range;
  }

  /* ---------------- Chart ---------------- */
  const RANGES = {
    '1W': { days: 7, pts: 84, start: 119500, vol: 0.004 },
    '1M': { days: 30, pts: 90, start: 107400, vol: 0.012 },
    '3M': { days: 90, pts: 90, start: 82200, vol: 0.02 },
    '6M': { days: 182, pts: 120, start: 54800, vol: 0.025 },
    '1Y': { days: 365, pts: 150, start: 34300, vol: 0.03 },
    'ALL': { days: 900, pts: 180, start: 9600, vol: 0.035 },
  };
  function rng(seed) {
    return () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  }
  function genSeries(range) {
    const cfg = RANGES[range];
    const r = rng(range.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const end = START_BALANCE;
    const now = Date.now();
    const out = [];
    let noise = 0;
    for (let i = 0; i < cfg.pts; i++) {
      const t = i / (cfg.pts - 1);
      noise = noise * 0.85 + (r() - 0.5) * cfg.vol * 2;
      const trend = cfg.start + (end - cfg.start) * Math.pow(t, 1.15);
      const damp = 1 - Math.pow(t, 6); // pin the final point to the real balance
      out.push({ t: now - (1 - t) * cfg.days * 864e5, v: Math.max(0, trend * (1 + noise * damp)) });
    }
    out[out.length - 1].v = end;
    if (state.balance !== START_BALANCE) out.push({ t: now + 1, v: state.balance });
    return out;
  }

  let current = [];
  function renderChart() {
    const series = genSeries(state.range);
    current = series;
    renderBalance(series);

    const svg = $('#chart');
    const W = svg.clientWidth, H = svg.clientHeight;
    if (!W || !H) return;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const pad = { l: 0, r: 72, t: 20, b: 56 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const vs = series.map((p) => p.v);
    let min = Math.min(...vs), max = Math.max(...vs);
    const span = max - min || 1;
    min = Math.max(0, min - span * 0.08); max = max + span * 0.08;
    const t0 = series[0].t, t1 = series[series.length - 1].t;
    const x = (t) => pad.l + ((t - t0) / (t1 - t0)) * iw;
    const y = (v) => pad.t + (1 - (v - min) / (max - min)) * ih;

    const pts = series.map((p) => [x(p.t), y(p.v)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = `${line} L${pts[pts.length - 1][0]} ${pad.t + ih} L${pts[0][0]} ${pad.t + ih} Z`;

    let grid = '';
    for (let i = 0; i < 4; i++) {
      const v = max - ((max - min) * i) / 3;
      const yy = y(v);
      grid += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${yy}" y2="${yy}" stroke="#141416" stroke-width="1"/>`;
      grid += `<text x="${W - 8}" y="${yy + 5}" text-anchor="end" fill="#6d6d72" font-size="14" font-family="IBM Plex Mono, monospace">${(v / 1000).toFixed(v >= 10000 ? 1 : 2)}k</text>`;
    }
    const fmtX = (t) => {
      const d = new Date(t);
      return state.range === '1W' || state.range === '1M' || state.range === '3M'
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
        : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).toUpperCase().replace(' ', " '");
    };
    const ticks = W < 600 ? 3 : 5;
    for (let i = 0; i < ticks; i++) {
      const t = t0 + ((t1 - t0) * (i + 0.5)) / ticks;
      const xx = x(t);
      grid += `<line x1="${xx}" x2="${xx}" y1="${pad.t}" y2="${pad.t + ih}" stroke="#141416" stroke-width="1"/>`;
      grid += `<text x="${xx}" y="${H - 16}" text-anchor="middle" fill="#6d6d72" font-size="14" letter-spacing="1" font-family="IBM Plex Mono, monospace">${fmtX(t)}</text>`;
    }
    const last = pts[pts.length - 1];
    svg.innerHTML = `
      <defs>
        <pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.1" fill="#3a3a3e"/></pattern>
        <linearGradient id="fadeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></linearGradient>
        <mask id="fadeM"><rect width="${W}" height="${H}" fill="url(#fadeG)"/></mask>
      </defs>
      ${grid}
      <line x1="${pad.l}" x2="${W - pad.r + 10}" y1="${pad.t + ih}" y2="${pad.t + ih}" stroke="#1d1d20"/>
      <path d="${area}" fill="url(#dots)" mask="url(#fadeM)"/>
      <path d="${line}" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" style="stroke-width:3;stroke:#fff"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="5" fill="#fff" stroke="#000" stroke-width="2"/>
      <g id="hover" style="display:none">
        <line id="hLine" y1="${pad.t}" y2="${pad.t + ih}" stroke="#555" stroke-dasharray="3 4"/>
        <circle id="hDot" r="6" fill="#fff" stroke="#000" stroke-width="2"/>
      </g>`;

    const tip = $('#chartTip');
    const hover = $('#hover'), hLine = $('#hLine'), hDot = $('#hDot');
    svg.onmousemove = (e) => {
      const rect = svg.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * W;
      let best = 0;
      for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i][0] - mx) < Math.abs(pts[best][0] - mx)) best = i;
      const [px, py] = pts[best];
      hover.style.display = '';
      hLine.setAttribute('x1', px); hLine.setAttribute('x2', px);
      hDot.setAttribute('cx', px); hDot.setAttribute('cy', py);
      const d = new Date(series[best].t);
      tip.innerHTML = `<b>${fmtUSD(series[best].v)}</b><span>${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>`;
      tip.style.left = Math.min(Math.max((px / W) * rect.width, 70), rect.width - 140) + 'px';
      tip.style.opacity = 1;
    };
    svg.onmouseleave = () => { hover.style.display = 'none'; tip.style.opacity = 0; };
  }

  $('#ranges').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    document.querySelectorAll('#ranges button').forEach((x) => x.classList.toggle('active', x === b));
    state.range = b.dataset.r;
    renderChart();
  });
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderChart, 80); });

  /* ---------------- Trade panel (cosmetic) ---------------- */
  const tradeAmt = $('#tradeAmt');
  const setTrade = (v) => {
    tradeAmt.value = '$' + v;
    tradeAmt.classList.toggle('zero', !Number(String(v).replace(/,/g, '')));
    $('#reviewBtn').disabled = !Number(String(v).replace(/,/g, ''));
  };
  setTrade('0');
  tradeAmt.addEventListener('input', () => {
    const raw = tradeAmt.value.replace(/[^0-9.]/g, '');
    setTrade(raw || '0');
  });
  $('#presets').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    setTrade(b.dataset.v === 'max' ? state.balance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : b.dataset.v);
  });
  $('#tradeTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    document.querySelectorAll('#tradeTabs button').forEach((x) => x.classList.toggle('active', x === b));
  });
  $('#repeatToggle').addEventListener('click', (e) => {
    const t = e.currentTarget;
    t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
  });
  $('#reviewBtn').addEventListener('click', () => toast('Trading is not part of this concept demo'));
  $('#fyNext').addEventListener('click', () => $('#fyCards').scrollBy({ left: 316 }));
  $('#fyPrev').addEventListener('click', () => $('#fyCards').scrollBy({ left: -316 }));

  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ---------------- Withdraw modal ---------------- */
  const overlay = $('#overlay'), body = $('#modalBody'), title = $('#modalTitle'), back = $('#modalBack');

  const ICONS = {
    bolt: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    bank: '<svg viewBox="0 0 24 24"><path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  };

  const CRYPTO = [
    { cls: 'baby', sym: 'BABY', name: 'Babylon', amt: '2.726 BABY', icon: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" stroke="#fff"/><path d="M6 12h12M12 6v12" stroke="#fff"/></svg>' },
    { cls: 'usdg', sym: 'USDG', name: 'USDG', amt: '0.009375 USDG', icon: '$' },
    { cls: 'usdt', sym: 'USDT', name: 'Tether USD', amt: '0.00294 USDT', icon: '₮' },
    { cls: 'eth', sym: 'ETH', name: 'Ethereum', amt: '0.00000104 ETH', icon: '<svg viewBox="0 0 24 24"><path d="M12 3 6.5 12 12 15l5.5-3zM6.5 13 12 21l5.5-8L12 16z" fill="#fff" stroke="none"/></svg>' },
    { cls: 'bnb', sym: 'BNB', name: 'BNB Chain', amt: '0.00000107 BNB', icon: '◆' },
    { cls: 'btc', sym: 'BTC', name: 'Bitcoin', amt: '0.00000003 BTC', icon: '₿' },
    { cls: 'sol', sym: 'SOL', name: 'Solana', amt: '0.0000215 SOL', icon: '≡' },
  ];

  const STEPS = {
    asset: {
      title: 'Withdraw',
      render() {
        return `
          <div class="m-search">${ICONS.search}<input id="assetSearch" placeholder="Search" autocomplete="off"/></div>
          <div class="m-tabs" id="assetTabs"><button class="active" data-f="all">All</button><button data-f="cash">Cash</button><button data-f="crypto">Crypto</button></div>
          <div id="assetList"></div>`;
      },
      mount() {
        let filter = 'all', q = '';
        const draw = () => {
          const match = (a, b) => (a + ' ' + b).toLowerCase().includes(q);
          let html = '';
          if (filter !== 'crypto' && match('US Dollar', 'USD')) {
            html += `<div class="m-section"><span>Cash</span><span>Available Balance</span></div>
              <button class="asset-row clickable" id="usdRow">
                <span class="flag lg"></span>
                <div class="names"><div class="n1">US Dollar</div><div class="n2">USD</div></div>
                <div class="bal"><div class="b1">${fmtUSD(state.balance)}</div></div>
              </button>`;
          }
          const cryptos = filter === 'cash' ? [] : CRYPTO.filter((c) => match(c.name, c.sym));
          if (cryptos.length) {
            html += `<div class="m-section"><span>Crypto</span><span>Available Balance</span></div>`;
            html += cryptos.map((c) => `
              <button class="asset-row clickable crypto-row">
                <span class="coin ${c.cls}">${c.icon}</span>
                <div class="names"><div class="n1">${c.name}</div><div class="n2">${c.sym}</div></div>
                <div class="bal"><div class="b1">${c.amt}</div><div class="b2">&lt;$0.01</div></div>
              </button>`).join('');
          }
          if (!html) html = `<div class="m-section" style="justify-content:center">No results</div>`;
          $('#assetList').innerHTML = html;
          const usd = $('#usdRow');
          if (usd) usd.onclick = () => go('speed');
          document.querySelectorAll('.crypto-row').forEach((r) => (r.onclick = () => toast('This concept demo covers USD wire withdrawals')));
        };
        $('#assetSearch').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
        $('#assetTabs').addEventListener('click', (e) => {
          const b = e.target.closest('button');
          if (!b) return;
          filter = b.dataset.f;
          document.querySelectorAll('#assetTabs button').forEach((x) => x.classList.toggle('active', x === b));
          draw();
        });
        draw();
      },
    },

    speed: {
      title: 'Select withdrawal speed',
      render() {
        return `
          <button class="option-card" id="std">
            <div class="oc-head"><span class="oc-icon">${ICONS.bank}</span>Up to 3 business days</div>
            <div class="oc-desc">Estimated arrival by ${arrivalDate()}.</div>
            <div class="oc-meta"><span>0-4 USD fee</span><span>Up to 250,000 USD daily</span></div>
          </button>`;
      },
      mount() { $('#std').onclick = () => go('method'); },
    },

    method: {
      title: 'Select a withdrawal method',
      render() {
        return `
          <button class="option-card" id="wire">
            <div class="badge-rec">Send to anyone</div>
            <div class="oc-head"><span class="oc-icon">${ICONS.bank}</span>Wire</div>
            <div class="oc-desc">To any US bank account — yours or someone else's.</div>
            <div class="oc-meta"><span>Up to 3 business days</span><span>No fee</span><span>20 USD minimum</span></div>
          </button>`;
      },
      mount() { $('#wire').onclick = () => go('bank'); },
    },

    bank: {
      title: 'Enter bank account details',
      render() {
        const f = (id, label, val, extra = '') => `
          <div class="field" data-f="${id}">
            
            <div class="fl-wrap">
              <input id="f_${id}" placeholder=" " value="${esc(val)}" autocomplete="off" spellcheck="false" ${extra}/>
              <label for="f_${id}">${label}</label>
            </div>
          </div>`;
        const b = state.bank;
        return `
          ${f('name', 'Recipient name on bank account', b.name)}
          ${f('bank', 'Bank name', b.bank)}
          ${f('account', 'Account number', b.account, 'inputmode="numeric" maxlength="17"')}
          ${f('routing', 'Routing number', b.routing, 'inputmode="numeric" maxlength="9"')}
          ${f('nickname', 'Account nickname', b.nickname)}
          <div class="hint">Add a unique nickname to help you identify this account. We'll use it to make withdrawing easier next time.</div>
          <div class="secure">${ICONS.lock}<div><b>Your information is secure</b><span>Sensitive data is fully encrypted at rest and in transit</span></div></div>
          <button class="primary" id="bankContinue" disabled>Continue</button>`;
      },
      mount() {
        const btn = $('#bankContinue');
        const check = () => {
          const b = state.bank;
          btn.disabled = !(b.name.trim() && b.bank.trim() && b.account.trim() && b.routing.trim() && b.nickname.trim());
        };
        ['name', 'bank', 'account', 'routing', 'nickname'].forEach((k) => {
          const inp = $('#f_' + k);
          inp.addEventListener('input', () => {
            if (k === 'account' || k === 'routing') inp.value = inp.value.replace(/\D/g, '');
            state.bank[k] = inp.value;
            check();
          });
          inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !btn.disabled) btn.click(); });
        });
        check();
        btn.onclick = () => go('amount');
        setTimeout(() => $('#f_name').focus(), 60);
      },
    },

    amount: {
      title: 'Withdraw USD',
      render() {
        const b = state.bank;
        return `
          <div class="amt-to">
            <span class="bank-ico">${ICONS.bank}</span>
            <div><div class="t1">${esc(b.nickname)}</div><div class="t2">${esc(b.name)} · ${esc(b.bank)} ••••${esc(b.account.slice(-4))}</div></div>
          </div>
          <div class="amt-big"><input id="amtInput" inputmode="decimal" autocomplete="off" value="${state.amount ? '$' + esc(state.amount) : '$0'}"/></div>
          <div class="amt-sub" id="amtSub"></div>
          <div class="amt-chips">
            <button data-v="1000">$1,000</button><button data-v="10000">$10,000</button><button data-v="100000">$100,000</button><button data-v="max">MAX</button>
          </div>
          <div class="summary">
            <div class="sr"><span>Available</span><b>${fmtUSD(state.balance)}</b></div>
            <div class="sr"><span>Wire fee</span><b>$0.00</b></div>
            <div class="sr"><span>Remaining balance</span><b id="remaining"></b></div>
            <div class="sr"><span>Estimated arrival</span><b>${arrivalDate()}</b></div>
          </div>
          <button class="primary" id="amtContinue" disabled>Continue</button>`;
      },
      mount() {
        const inp = $('#amtInput'), sub = $('#amtSub'), btn = $('#amtContinue');
        const fmtRaw = (raw) => {
          let [i, d] = raw.split('.');
          i = (i || '').replace(/^0+(?=\d)/, '');
          const withCommas = (i || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
          return d !== undefined ? withCommas + '.' + d.slice(0, 2) : withCommas;
        };
        const update = () => {
          const n = Number(state.amount.replace(/,/g, '')) || 0;
          inp.classList.toggle('zero', n === 0);
          const over = n > state.balance;
          inp.classList.toggle('over', over);
          $('#remaining').textContent = fmtUSD(Math.max(0, state.balance - n));
          sub.classList.toggle('err', over || (n > 0 && n < 20));
          sub.textContent = over ? 'Amount exceeds your available balance'
            : n > 0 && n < 20 ? 'Wire minimum is $20.00'
            : `${fmtUSD(state.balance)} available`;
          btn.disabled = !(n >= 20 && !over);
        };
        const setRaw = (raw) => {
          state.amount = raw ? fmtRaw(raw) : '';
          inp.value = '$' + (state.amount || '0');
          update();
        };
        inp.addEventListener('input', () => {
          let raw = inp.value.replace(/[^0-9.]/g, '');
          const firstDot = raw.indexOf('.');
          if (firstDot !== -1) raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, '');
          if (raw.replace(/\D/g, '') === '' && !raw.includes('.')) raw = '';
          setRaw(raw);
        });
        inp.addEventListener('focus', () => { if (!state.amount) inp.value = '$'; });
        inp.addEventListener('blur', () => {
          const n = Number(state.amount.replace(/,/g, ''));
          if (n) setRaw(n.toFixed(2)); else setRaw('');
        });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { inp.blur(); if (!btn.disabled) btn.click(); } });
        document.querySelectorAll('.amt-chips button').forEach((b) => (b.onclick = () => {
          setRaw(b.dataset.v === 'max' ? state.balance.toFixed(2) : Number(b.dataset.v).toFixed(2));
        }));
        btn.onclick = () => {
          const n = Number(state.amount.replace(/,/g, ''));
          state.receipt = {
            amount: n,
            ref: 'WD' + Math.random().toString(36).slice(2, 8).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
            arrival: arrivalDate(),
            bank: { ...state.bank },
          };
          go('processing');
        };
        update();
        setTimeout(() => inp.focus(), 60);
      },
    },

    processing: {
      title: 'Processing',
      noBack: true,
      render() {
        return `<div class="center"><div class="spinner"></div><div class="success-sub">Submitting your wire withdrawal…</div></div>`;
      },
      mount() {
        setTimeout(() => {
          state.balance = Math.round((state.balance - state.receipt.amount) * 100) / 100;
          renderChart();
          go('success', true);
        }, 1700);
      },
    },

    success: {
      title: 'Withdrawal submitted',
      noBack: true,
      render() {
        const r = state.receipt;
        return `
          <div class="center">
            <svg class="check-circle" viewBox="0 0 104 104"><circle cx="52" cy="52" r="52"/><path d="M32 53.5 45.5 67 73 39"/></svg>
            <h3 class="success-title">${fmtUSD(r.amount)} is on its way</h3>
            <p class="success-sub">Your wire to <b style="color:#fff">${esc(r.bank.name)}</b> will be deposited within 3 business days — on ${r.arrival}.</p>
          </div>
          <div class="receipt">
            <div class="sr"><span>Amount</span><b>${fmtUSD(r.amount)} USD</b></div>
            <div class="sr"><span>Recipient</span><b>${esc(r.bank.name)}</b></div>
            <div class="sr"><span>Bank</span><b>${esc(r.bank.bank)} ••••${esc(r.bank.account.slice(-4))}</b></div>
            <div class="sr"><span>Routing number</span><b>${esc(r.bank.routing)}</b></div>
            <div class="sr"><span>Nickname</span><b>${esc(r.bank.nickname)}</b></div>
            <div class="sr"><span>Method</span><b>Wire · Up to 3 business days</b></div>
            <div class="sr"><span>Fee</span><b>$0.00</b></div>
            <div class="sr"><span>Status</span><b class="green">Pending</b></div>
            <div class="sr"><span>Reference</span><b>${r.ref}</b></div>
          </div>
          <button class="primary" id="done">Done</button>`;
      },
      mount() { $('#done').onclick = () => { closeModal(); toast('Wire withdrawal initiated'); }; },
    },
  };

  function go(step, replace = false) {
    if (!replace) state.history.push(state.step);
    state.step = step;
    draw();
  }
  function draw() {
    const s = STEPS[state.step];
    title.textContent = s.title;
    back.hidden = state.step === 'asset' || !!s.noBack;
    body.classList.remove('step');
    void body.offsetWidth;
    body.classList.add('step');
    body.innerHTML = s.render();
    body.scrollTop = 0;
    s.mount();
  }
  function openModal() {
    state.step = 'asset';
    state.history = [];
    state.amount = '';
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    draw();
  }
  function closeModal() {
    if (state.step === 'processing') return;
    overlay.hidden = true;
    document.body.style.overflow = '';
  }

  back.addEventListener('click', () => {
    const prev = state.history.pop();
    if (prev) { state.step = prev; draw(); }
  });
  $('#modalClose').addEventListener('click', closeModal);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });
  $('#withdrawBtn').addEventListener('click', openModal);

  renderChart();
})();
