/* Interactive concept. No API keys, live accounts or financial network calls. */
(() => {
  'use strict';
  const E=window.SandboxEngine, KEY='kraken-sandbox-v3';
  const $=(q,el=document)=>el.querySelector(q), $$=(q,el=document)=>[...el.querySelectorAll(q)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtUSD=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
  const money=n=>fmtUSD(n/100), qty=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:10});
  const date=v=>new Date(v).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const isoDay=v=>{const d=new Date(v);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
  const dateTime=v=>new Date(v).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});
  const num=v=>Number(String(v).replace(/[$,]/g,'')), cash=v=>Math.round(num(v)*100);
  const icon=s=>{const a=E.asset(s);return s==='USD'?'<span class="flag"></span>':`<span class="coin" style="background:${a?.color||'#666'}">${esc(a?.glyph||s.slice(0,1))}</span>`;};
  const btn=(label,action,cls='secondary')=>`<button class="${cls}" data-action="${action}">${label}</button>`;
  const field=(id,label,value='',attrs='')=>`<div class="field"><label class="input-label" for="${id}">${label}</label><input id="${id}" value="${esc(value)}" ${attrs}/></div>`;
  const row=(label,value)=>`<div class="sr"><span>${label}</span><b>${value}</b></div>`;
  const notice='<p class="sandbox-note">Sandbox only · sample prices and simulated funds.</p>';
  let state;
  try {state=E.load(localStorage.getItem(KEY));}catch {state=E.initial();}
  E.accrue(state);
  const ui={page:'home',range:'1M',asset:'BTC',source:'USD',mode:'Buy',order:'market',frequency:'weekly',repeat:false,amount:0,unit:'USD',limit:0,marketFilter:'All',marketSort:'name',marketQuery:'',activity:{asset:'All',type:'All',start:'',end:'',page:0}};
  let storageWarning=false,toastTimer;
  function toast(message) {$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
  function save() {try {localStorage.setItem(KEY,JSON.stringify(state));}catch {if(!storageWarning){storageWarning=true;toast('Browser storage is unavailable; changes last for this session.');}}}
  function commit(action) {const next=E.clone(state);E.accrue(next);const result=action(next);state=next;save();refresh();return result;}
  function attempt(action) {try{return action();}catch(e){const error=$('#formError');if(error)error.textContent=e.message;else toast(e.message);return null;}}
  const error='<p class="form-error" id="formError" role="alert"></p>';
  function download(filename,content,type='text/plain') {const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function copy(value) {try {await navigator.clipboard.writeText(value);toast('Copied');}catch {show('Copy reference',field('copyValue','Select and copy',value,'readonly')+btn('Done','close','primary'),()=>$('#copyValue').select(),true);}}
  function visible(value){return state.settings.hidden?'••••••':value;}
  function renderBalance(series) {
    const total=E.totalCents(state), [whole,part]=(total/100).toFixed(2).split('.');
    $('#pvValue').innerHTML=`<span>${state.settings.hidden?'••••••':'$'+Number(whole).toLocaleString('en-US')}</span>${state.settings.hidden?'':`<span class="cents" style="margin-left:-12px">.${part}</span>`}<button class="eye" aria-label="${state.settings.hidden?'Show':'Hide'} balances" aria-pressed="${state.settings.hidden}" data-action="privacy"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg></button>`;
    const change=(total-E.START_CENTS)/100,up=change>=0,pct=change/(E.START_CENTS/100)*100;
    $('#changeValue').className='stat-value '+(up?'up':'down');
    $('#changeValue').textContent=visible(`${up?'+':'−'}${fmtUSD(Math.abs(change))} (${Math.abs(pct).toFixed(2)}%)`);
    $('#changeLabel').textContent='balance change';
    $('#cashValue').textContent=visible(money(state.cashCents));
  }
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
    const cfg=RANGES[range], now=Date.now(), base=Math.max(1,E.totalCents(state)/100);
    const out=[];
    for(let i=0;i<cfg.pts;i++) {
      const t=i/(cfg.pts-1), peak=Math.max(0,1-Math.abs(t-.185)/.035);
      const ripple=t>.45?Math.sin(t*61)*.00025:0;
      out.push({t:now-(1-t)*cfg.days*864e5,v:base*(.997+peak*.18+ripple)});
    }
    out[out.length-1].v=E.totalCents(state)/100;
    return out;
  }

  let current = [];
  function renderChart() {
    const series = genSeries(ui.range);
    current = series;
    renderBalance(series);

    const svg = $('#chart');
    const W = svg.clientWidth, H = svg.clientHeight;
    const light=document.body.classList.contains('light-theme'),ink=light?'#15151b':'#fff',gridColor=light?'#e5e5ed':'#141416';
    if (!W || !H) return;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const pad = { l: 12, r: W<500?72:84, t: 20, b: 56 };
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
      grid += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${yy}" y2="${yy}" stroke="${gridColor}" stroke-width="1"/>`;
      grid += `<text x="${W - 8}" y="${yy + 5}" text-anchor="end" fill="#566168" font-size="14" font-family="Inter, system-ui, sans-serif" font-weight="400">${state.settings.hidden?'••••':v.toLocaleString('en-US',{maximumFractionDigits:2})}</text>`;
    }
    const fmtX = (t) => {
      const d = new Date(t);
      return ui.range === '1W' || ui.range === '1M' || ui.range === '3M'
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
        : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).toUpperCase().replace(' ', " '");
    };
    const ticks = W < 600 ? 3 : 5;
    for (let i = 0; i < ticks; i++) {
      const t = t0 + ((t1 - t0) * i) / (ticks - 1);
      const xx = x(t);
      grid += `<line x1="${xx}" x2="${xx}" y1="${pad.t}" y2="${pad.t + ih}" stroke="${gridColor}" stroke-width="1"/>`;
      grid += `<text x="${xx}" y="${H - 16}" text-anchor="middle" fill="#566168" font-size="14" letter-spacing=".2" font-family="Inter, system-ui, sans-serif" font-weight="400">${fmtX(t)}</text>`;
    }
    const last = pts[pts.length - 1];
    svg.innerHTML = `
      <defs>
        <pattern id="dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.1" fill="#25292b"/></pattern>
        <linearGradient id="fadeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></linearGradient>
        <mask id="fadeM"><rect width="${W}" height="${H}" fill="url(#fadeG)"/></mask>
      </defs>
      ${grid}
      <line x1="${pad.l}" x2="${W - pad.r + 10}" y1="${pad.t + ih}" y2="${pad.t + ih}" stroke="#1d1d20"/>
      <path d="${area}" fill="url(#dots)" mask="url(#fadeM)"/>
      <path d="${line}" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" style="stroke-width:2.5;stroke:${ink}"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${ink}" stroke="${light?'#fff':'#000'}" stroke-width="2"/>
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
      tip.innerHTML = `<b>${visible(fmtUSD(series[best].v))}</b><span>${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>`;
      tip.style.left = Math.min(Math.max((px / W) * rect.width, 70), rect.width - 140) + 'px';
      tip.style.opacity = 1;
    };
    svg.onmouseleave = () => { hover.style.display = 'none'; tip.style.opacity = 0; };
  }

  $('#ranges').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    document.querySelectorAll('#ranges button').forEach((x) => x.classList.toggle('active', x === b));
    ui.range = b.dataset.r;
    renderChart();
  });
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderChart, 80); });

  /* Shared modal with history, focus restoration and a keyboard focus trap. */
  const overlay=$('#overlay'),modal=$('#modal'),body=$('#modalBody');
  let modalStack=[],modalCurrent=null,returnFocus=null;
  function show(title,html,mount=()=>{},push=false) {
    if(overlay.hidden){returnFocus=document.activeElement;modalStack=[];}else if(push&&modalCurrent)modalStack.push(modalCurrent);else if(!push)modalStack=[];
    modal.classList.toggle('profile-mode',title==='Profile');overlay.classList.toggle('profile-backdrop',title==='Profile');$('.modal-head').hidden=title==='Profile';modalCurrent={title,html,mount};overlay.hidden=false;document.body.style.overflow='hidden';
    $('#modalTitle').textContent=title;$('#modalBack').hidden=!modalStack.length;body.innerHTML=typeof html==='function'?html():html;body.scrollTop=0;
    mount();setTimeout(()=>{if(!overlay.hidden&&!body.contains(document.activeElement))(body.querySelector('input,button,select')||$('#modalClose')).focus();},0);
  }
  function close() {overlay.hidden=true;document.body.style.overflow='';modalStack=[];modalCurrent=null;returnFocus?.focus?.();}
  $('#modalClose').onclick=close;$('#modalBack').onclick=()=>{const previous=modalStack.pop();if(previous){const stack=modalStack.slice();show(previous.title,previous.html,previous.mount,true);modalStack=stack;$('#modalBack').hidden=!stack.length;}};
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  document.addEventListener('keydown',e=>{
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#globalSearch').focus();}
    if(e.key==='Escape'){close();$('#globalSearch').blur();}
    if(e.key==='Tab'&&!overlay.hidden){const f=$$('button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"]',modal).filter(el=>!el.hidden&&!el.closest('[hidden]'));const first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  function go(page){ui.page=page;$('#globalSearch').value='';renderPage();if(page==='home')renderChart();window.scrollTo?.({top:0,behavior:'smooth'});}
  const routes=['home','portfolio','explore','earn','borrow','activity','asset:BTC','asset:ETH','collapse','offers','support'];
  $$('.nav-item').forEach((a,i)=>{a.dataset.route=routes[i];a.href='#'+routes[i];a.title=a.textContent.trim();a.onclick=e=>{e.preventDefault();if(routes[i]==='collapse'){state.settings.collapsed=!state.settings.collapsed;save();refresh();}else go(routes[i]);};});
  function refresh(){document.body.classList.toggle('collapsed',state.settings.collapsed);$('.avatar').childNodes[0].textContent=initials(state.profile.name)+' ';renderChart();renderTrade();renderPage();renderHomeExtra();$('.notif i').hidden=!state.notifications.some(n=>!n.read);}
  function heading(title,subtitle,actions=''){return `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${actions}</div>`;}
  function empty(text,action=''){return `<div class="empty">${text}${action}</div>`;}
  function assetRows(list,mode='market') {return list.map(a=>`<div class="market-row"><button class="asset-info" data-action="asset" data-symbol="${a.symbol}">${icon(a.symbol)}<span><b>${a.name}</b><small>${a.symbol}</small></span></button><span class="market-price">${visible(fmtUSD(a.price))}</span><span class="${a.change>=0?'up':'down'}">${a.change>=0?'+':''}${a.change.toFixed(2)}%</span><button class="star" aria-label="${state.watchlist.includes(a.symbol)?'Remove':'Add'} ${a.name} ${state.watchlist.includes(a.symbol)?'from':'to'} watchlist" aria-pressed="${state.watchlist.includes(a.symbol)}" data-action="watch" data-symbol="${a.symbol}">${state.watchlist.includes(a.symbol)?'★':'☆'}</button>${mode==='portfolio'?`<span class="holding">${visible(qty(E.balance(state,a.symbol))+' '+a.symbol)}</span>`:''}</div>`).join('');}
  function renderHomeExtra(){let extra=$('#homeExtra');if(!extra){extra=document.createElement('div');extra.id='homeExtra';$('#homeView').append(extra);}const watch=state.watchlist.map(E.asset).filter(Boolean);extra.innerHTML=`<div class="section-heading"><h2>Watchlist</h2>${btn('Manage','explore','text-btn')}</div><div class="table-panel">${watch.length?assetRows(watch):empty('Add assets to your watchlist',btn('Explore assets','explore'))}</div><div class="section-heading"><h2>Recent transactions</h2>${btn('See all →','activity','text-btn')}</div><div class="table-panel">${transactionRows(state.activity.slice(0,4))}</div>`;}
  function renderPage(){
    $('#homeView').hidden=ui.page!=='home';$('#pageView').hidden=ui.page==='home';
    $$('.nav-item').forEach(a=>{a.classList.toggle('active',a.dataset.route===ui.page);if(a.dataset.route===ui.page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(ui.page==='home')return;
    if(ui.page==='activity'){renderActivity();return;}
    if(ui.page==='portfolio'){
      const owned=E.ASSETS.filter(a=>E.balance(state,a.symbol)>0);
      $('#pageView').innerHTML=heading('Portfolio','Your holdings, cash and allocations.',btn('Deposit','deposit'))+`<div class="metric-grid"><div class="metric"><small>Total value</small><h2>${visible(money(E.totalCents(state)))}</h2></div><div class="metric"><small>Available USD</small><h2>${visible(money(state.cashCents))}</h2></div><div class="metric"><small>Rewards allocation</small><h2>${visible(money(state.earnCents))}</h2></div><div class="metric"><small>Outstanding loan</small><h2>${visible(money(state.loanCents))}</h2></div></div><div class="section-heading"><h2>Your assets</h2></div><div class="table-panel">${assetRows(owned,'portfolio')}</div><div class="section-heading"><h2>Transactions</h2>${btn('View activity','activity','text-btn')}</div><div class="table-panel">${transactionRows(state.activity.slice(0,5))}</div>${notice}`;return;
    }
    if(ui.page==='explore') {renderExplore();return;}
    if(ui.page.startsWith('asset:')){renderAsset(ui.page.split(':')[1]);return;}
    if(ui.page==='earn'){
      $('#pageView').innerHTML=heading('Earn','Allocate USD to a rewards balance.')+`<div class="feature-panel"><span class="eyebrow">SAMPLE REWARDS</span><h2>4.1% illustrative annual rate</h2><p>Accrues in the sandbox while allocated. You can return funds to cash anytime. This rate is a assumption.</p><div class="metric-grid"><div class="metric"><small>Allocated</small><h2>${visible(money(state.earnCents))}</h2></div><div class="metric"><small>Illustrative yearly rewards</small><h2>${visible(money(Math.round(state.earnCents*.041)))}</h2></div></div><div class="inline-actions">${btn('Allocate USD','earn-in','primary')}${btn('Return to cash','earn-out')}</div></div>${notice}`;return;
    }
    if(ui.page==='borrow'){
      const collateral=Object.entries(state.collateral).filter(([,v])=>v>0).map(([s,v])=>`${qty(v)} ${s}`).join(', ')||'None';
      $('#pageView').innerHTML=heading('Borrow','Try a collateralized loan with simulated funds.')+`<div class="feature-panel"><span class="eyebrow">LOAN</span><h2>Borrow USD against crypto</h2><p>This sandbox uses 200% crypto collateral, no interest and fixed sample prices. It shows allocation and repayment.</p><div class="summary">${row('Outstanding',visible(money(state.loanCents)))}${row('Locked collateral',visible(esc(collateral)))}${row('Available cash',visible(money(state.cashCents)))}</div><div class="inline-actions">${btn('Borrow USD','borrow','primary')}${btn('Repay loan','repay')}</div></div>${notice}`;return;
    }
    if(ui.page==='offers') {$('#pageView').innerHTML=heading('Offers','Explore offers created for this sandbox.')+`<div class="card-grid">${[{id:'learn',title:'Explore and learn',text:'Receive $10 in cash for exploring the sandbox.'},{id:'trade',title:'Your first trade',text:'Complete a trade and receive $5 in cash.'}].map(o=>`<div class="feature-panel"><h2>${o.title}</h2><p>${o.text}</p><button class="secondary" data-action="claim" data-id="${o.id}" ${state.claims.includes(o.id)?'disabled':''}>${state.claims.includes(o.id)?'Claimed':'Claim reward'}</button></div>`).join('')}</div>${notice}`;return;}
    if(ui.page==='support') renderSupport();
  }
  function renderExplore(){
    let list=E.ASSETS.filter(a=>a.symbol!=='USD'&&(ui.marketFilter==='All'||(ui.marketFilter==='Watchlist'?state.watchlist.includes(a.symbol):a.category===ui.marketFilter))&&(a.name+' '+a.symbol).toLowerCase().includes(ui.marketQuery.toLowerCase()));
    list.sort((a,b)=>ui.marketSort==='change'?b.change-a.change:ui.marketSort==='price'?b.price-a.price:a.name.localeCompare(b.name));
    $('#pageView').innerHTML=heading('Explore','Discover assets at fixed sample prices.')+`<div class="filter-bar"><input id="marketQuery" aria-label="Filter assets" placeholder="Search assets" value="${esc(ui.marketQuery)}"/><select id="marketFilter" aria-label="Asset category">${['All','Watchlist','Layer 1','Layer 2','Stablecoins','DeFi','Trending','New'].map(v=>`<option ${v===ui.marketFilter?'selected':''}>${v}</option>`).join('')}</select><select id="marketSort" aria-label="Sort assets">${[['name','Name'],['change','24h change'],['price','Price']].map(([v,l])=>`<option value="${v}" ${v===ui.marketSort?'selected':''}>${l}</option>`).join('')}</select></div><div class="table-panel">${list.length?assetRows(list):empty('No assets match these filters.')}</div>${notice}`;
    $('#marketQuery').oninput=e=>{const pos=e.target.selectionStart;ui.marketQuery=e.target.value;renderExplore();$('#marketQuery').focus();$('#marketQuery').setSelectionRange(pos,pos);};
    $('#marketFilter').onchange=e=>{ui.marketFilter=e.target.value;renderExplore();};$('#marketSort').onchange=e=>{ui.marketSort=e.target.value;renderExplore();};
  }
  function renderAsset(sym){const a=E.asset(sym);if(!a){go('explore');return;}$('#pageView').innerHTML=heading(a.name,`${a.symbol} · ${a.category} · sample market`)+`<div class="feature-panel"><div class="asset-detail-icon">${icon(sym)}</div><h2 class="asset-price">${fmtUSD(a.price)}</h2><p class="${a.change>=0?'up':'down'}">${a.change>=0?'+':''}${a.change}% sample 24h change</p><div class="summary">${row('Available holdings',visible(qty(E.balance(state,sym))+' '+sym))}${row('Value',visible(fmtUSD(E.balance(state,sym)*a.price)))}${row('Locked collateral',visible(qty(state.collateral[sym]||0)+' '+sym))}</div><div class="inline-actions"><button class="primary" data-action="buy-asset" data-symbol="${sym}">Buy ${sym}</button><button class="secondary" data-action="sell-asset" data-symbol="${sym}">Sell ${sym}</button><button class="secondary" data-action="watch" data-symbol="${sym}">${state.watchlist.includes(sym)?'Remove from':'Add to'} watchlist</button></div></div><div class="section-heading"><h2>Asset transactions</h2></div><div class="table-panel">${transactionRows(state.activity.filter(t=>[t.symbol,t.source,t.target].includes(sym)))}</div>${notice}`;}
  function transactionName(t){if(t.title)return t.title;if(t.type==='Trade')return t.source==='USD'?'Bought '+E.asset(t.target).name:t.target==='USD'?'Sold '+E.asset(t.source).name:'Converted to '+E.asset(t.target).name;if(t.type==='Deposit')return 'Deposited '+E.asset(t.symbol).name;if(['Wire withdrawal','Cash withdrawal'].includes(t.type))return 'Withdraw US Dollar';if(t.type==='Crypto withdrawal')return 'Withdraw '+E.asset(t.symbol).name;return t.type;}
  function status(t){return `<span class="status ${t.status.toLowerCase()}">${esc(t.status)}</span>`;}
  function transactionRows(list){return list.length?list.map(t=>{const sym=t.symbol||t.target||'USD';const sign=['Wire withdrawal','Cash withdrawal','Crypto withdrawal'].includes(t.type)?'−':t.type==='Deposit'?'+':'';const amount=t.displayAmount??sign+money(t.grossCents||0),units=t.displayQuantity??(t.quantity?qty(t.quantity)+' '+sym:t.targetQuantity?'+'+qty(t.targetQuantity)+' '+t.target:(t.status==='Pending'?'Processing':t.status));return `<button class="transaction-row ${t.status==='Failed'?'failed':''}" data-action="transaction" data-id="${esc(t.id)}"><span class="transaction-asset">${icon(sym)}<span><b>${esc(transactionName(t))}</b>${t.status!=='Completed'?status(t):''}</span></span><span class="transaction-date">${t.dateOnly?E.displayDate(t.dateOnly).replace(/^\w+, /,''):date(t.date)}</span><span class="transaction-amount"><b>${visible(esc(amount))}</b>${units?`<small>${visible(esc(units))}</small>`:''}</span></button>`;}).join(''):empty('No transactions yet. Your next action will appear here.');}
  function filteredTransactions(){const f=ui.activity;return state.activity.filter(t=>(f.asset==='All'||[t.symbol,t.source,t.target].includes(f.asset))&&(f.type==='All'||t.type===f.type)&&(!f.start||isoDay(t.date)>=f.start)&&(!f.end||isoDay(t.date)<=f.end));}
  function renderActivity(){
    const f=ui.activity,list=filteredTransactions(),count=Math.max(1,Math.ceil(list.length/10));f.page=Math.min(f.page,count-1);
    const pending=state.activity.filter(t=>t.status==='Pending'),orders=state.orders;
    $('#pageView').innerHTML=heading('Activity','Orders, pending transactions and complete history.')+`<h2>Orders</h2><div class="card-grid order-cards"><div class="feature-panel"><span class="large-glyph">↻</span><h2>Recurring buy ›</h2><p>Schedule a buy for any asset.</p>${btn('New recurring buy','recurring')}</div><div class="feature-panel"><span class="large-glyph">⊙</span><h2>Custom orders ›</h2><p>Buy or sell at a sample target price.</p>${btn('New custom order','limit')}</div></div>${orders.length?`<div class="table-panel order-list">${orders.map(o=>`<button class="transaction-row" data-action="order-detail" data-id="${o.id}"><span><b>${esc(o.kind==='limit'?'Limit order':'Recurring '+o.frequency+' buy')}</b><small>${o.source} → ${o.target}</small></span><span class="transaction-date">${o.kind==='limit'?'Limit '+fmtUSD(o.limitPrice):'Next '+date(o.nextAt)}</span><span>${money(o.grossCents)}<small>${o.status}</small></span></button>`).join('')}</div>`:''}<div class="section-heading"><h2>Pending Transactions</h2></div><div class="table-panel"><div class="transaction-labels"><span>ASSET</span><span>DATE</span><span>AMOUNT</span></div>${pending.length?transactionRows(pending):empty('No pending transactions.')}</div><div class="section-heading"><h2>Transactions</h2></div><div class="filter-bar activity-filters"><select id="activityAsset" aria-label="Find asset"><option value="All">Find Asset</option>${E.ASSETS.map(a=>`<option value="${a.symbol}" ${f.asset===a.symbol?'selected':''}>${a.name}</option>`).join('')}</select><select id="activityType" aria-label="Transaction type"><option value="All">Types</option>${[...new Set(state.activity.map(t=>t.type))].map(t=>`<option ${f.type===t?'selected':''}>${esc(t)}</option>`).join('')}</select><label>Start Date<input type="date" id="activityStart" value="${f.start}"/></label><label>End Date<input type="date" id="activityEnd" value="${f.end}"/></label>${btn('Clear','clear-filters','text-btn')}${btn('Export History','export','secondary')}</div>${f.start&&f.end&&f.start>f.end?'<p class="form-error">Start date must be before the end date.</p>':''}<div class="table-panel"><div class="transaction-labels"><span>ASSET</span><span>DATE</span><span>AMOUNT</span></div>${transactionRows(list.slice(f.page*10,f.page*10+10))}<div class="pagination"><button class="text-btn" data-action="previous-page" ${f.page===0?'disabled':''}>‹ Previous Page</button><span>Page ${f.page+1} of ${count}</span><button class="text-btn" data-action="next-page" ${f.page+1===count?'disabled':''}>Next Page ›</button></div></div>${notice}`;
    [['activityAsset','asset'],['activityType','type'],['activityStart','start'],['activityEnd','end']].forEach(([id,key])=>$('#'+id).onchange=e=>{f[key]=e.target.value;f.page=0;renderActivity();});
  }
  function showTransaction(id,push=false){
    const t=state.activity.find(a=>a.id===id);if(!t){toast('Transaction not found');return;}
    const symbol=t.symbol||t.target||'USD';
    const total=t.sourceScreenshot?t.displayAmount:t.quantity?qty(t.quantity)+' '+symbol:money(t.grossCents||0);
    let details=row('Total',visible(esc(total)))+row('Status',status(t))+row('Date',t.dateOnly?E.displayDate(t.dateOnly)+' (time not supplied)':dateTime(t.date));
    if(t.displayQuantity)details+=row('Asset amount',visible(esc(t.displayQuantity)));
    if(t.type==='Trade'){
      if(t.sourceQuantity!==undefined)details+=row('Paid',visible(qty(t.sourceQuantity)+' '+t.source));
      if(t.targetQuantity!==undefined)details+=row('Received',visible(qty(t.targetQuantity)+' '+t.target));
      if(t.feeCents!==undefined)details+=row('Sample trading fee',visible(money(t.feeCents)));
      if(t.sourceScreenshot)details+=row('Conversion',esc(t.source+' → '+t.target));
    }
    if(t.recipient)details+=row('Recipient',esc(t.recipient))+row('Bank',esc(t.bank)+' ••••'+esc(t.last4))+row('Nickname',esc(t.nickname))+row('Estimated arrival',esc(t.arrival))+row('Method',esc(t.method||'Wire'))+row('Sample fee',money(t.feeCents||0));
    if(t.type==='Wire withdrawal')details+=row('Processing',esc(t.processingDays+'-day wire'));
    if(t.publicAccountId)details+=row('Public Account ID',`<button class="copy-value" data-action="copy-public">${esc(t.publicAccountId)} ⧉</button>`);
    if(t.relatedId)details+=row('Related transaction',`<button class="copy-value" data-action="transaction" data-id="${t.relatedId}">${esc(t.relatedId)}</button>`);
    if(t.network)details+=row('Network',esc(t.network));
    if(t.hash)details+=row('blockchain hash',`<button class="copy-value" data-action="copy-hash" data-id="${t.id}">${esc(t.hash)} ⧉</button>`);
    if(t.address)details+=row('destination',`<button class="copy-value" data-action="copy-address" data-id="${t.id}">${esc(t.address)} ⧉</button>`);
    details+=row(/^FT/.test(t.id)?'Funding transaction ID (FT)':'Internal reference',`<button class="copy-value" data-action="copy-id" data-id="${t.id}">${esc(t.id)} ⧉</button>`);
    show('Transaction details',`${icon(symbol)}<h3 class="transaction-title">${esc(transactionName(t))}<br/>${visible(esc(total))}</h3><div class="receipt">${details}</div>${t.sourceScreenshot?'<p class="hint">Historical screenshot values. Fees, exact times and network hashes were not supplied. FT references are generated for this sandbox.</p>':''}${notice}<div class="inline-actions"><button class="secondary" data-action="ask-support" data-id="${t.id}">Ask support about this transaction</button><button class="secondary" data-action="receipt" data-id="${t.id}">Download receipt</button>${t.hash?`<button class="secondary" data-action="inspect-hash" data-id="${t.id}">Inspect hash</button>`:''}${t.status==='Pending'?`<button class="secondary" data-action="confirm-transaction" data-id="${t.id}">Simulate confirmation</button><button class="danger" data-action="cancel-transaction" data-id="${t.id}">Cancel withdrawal</button>`:''}</div>`,()=>{},push);
  }
  function receipt(t){download('sandbox-receipt-'+t.id+'.txt',['KRAKEN-INSPIRED SANDBOX — SIMULATED TRANSACTION','Not a confirmation of an actual payment.','',...Object.entries(t).map(([k,v])=>k+': '+v)].join('\n'));}
  function exportHistory(list=filteredTransactions()){
    // Prefix spreadsheet formula metacharacters in untrusted text fields.
    const cell=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const cols=['id','publicAccountId','date','dateOnly','type','status','description','grossCents','symbol','quantity','displayAmount','displayQuantity','sourceScreenshot','source','target','feeCents','method','processingDays','arrival','arrivalDate','hash','network'];
    download('sandbox-transaction-history.csv',[cols.join(','),...list.map(t=>cols.map(k=>cell(t[k])).join(','))].join('\r\n'),'text/csv');toast('history exported');
  }
  function network(sym){return sym==='BTC'?'Bitcoin':sym==='SOL'?'Solana':sym==='BNB'?'BNB Smart Chain':'Ethereum';}
  function sampleHash(sym){const bytes=new Uint8Array(sym==='SOL'?88:32);crypto.getRandomValues(bytes);if(sym==='SOL'){const base='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';return [...bytes].map(v=>base[v%58]).join('');}const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return (sym==='BTC'?'':'0x')+hex;}
  /* Trade ticket and review. All orders are evaluated against fixed sample prices. */
  function sides(){return ui.mode==='Sell'?{source:ui.asset,target:ui.source}:ui.mode==='Convert'?{source:ui.source,target:ui.asset}:{source:ui.source,target:ui.asset};}
  function gross(){return ui.unit==='USD'?Math.round(ui.amount*100):Math.round(ui.amount*E.asset(ui.asset).price*100);}
  function renderTrade(){
    const {source,target}=sides();
    $$('#tradeTabs button').forEach(b=>b.classList.toggle('active',b.textContent===ui.mode));
    $('.asset-select').innerHTML=icon(ui.asset)+esc(E.asset(ui.asset).name)+'<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
    $('#orderType').innerHTML=(ui.order==='limit'?'Limit order':ui.mode==='Buy'?'Buy now':ui.mode==='Sell'?'Sell now':'Convert now')+'<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
    $('#unitToggle').innerHTML=(ui.unit==='USD'?ui.asset:'USD')+' <svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/></svg>';
    $('#tradeAmt').classList.toggle('zero',!ui.amount);
    if(document.activeElement!==$('#tradeAmt'))$('#tradeAmt').value=(ui.unit==='USD'?'$':'')+(ui.amount?qty(ui.amount):'0');
    $('#payLabel').textContent=ui.mode==='Sell'?'Receive in':ui.mode==='Convert'?'Convert from':'Pay with';
    const shown=ui.mode==='Sell'?target:source;$('.currency').innerHTML=icon(shown)+shown+'<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
    $('#payAvail').textContent=visible(qty(E.balance(state,source))+' '+source+' available');
    $('.repeat').hidden=ui.mode!=='Buy'||ui.order==='limit';$('#repeatToggle').setAttribute('aria-pressed',String(ui.repeat));
    const of=$('#orderFields');of.hidden=ui.order!=='limit'&&!ui.repeat;
    if(ui.order==='limit')of.innerHTML=field('limitPrice','Target price (USD)',ui.limit||E.asset(ui.asset).price,'type="number" step="any" min="0.000001"');
    else if(ui.repeat)of.innerHTML=`<label class="input-label" for="repeatFrequency">Frequency</label><select id="repeatFrequency">${['daily','weekly','monthly'].map(v=>`<option ${v===ui.frequency?'selected':''}>${v}</option>`).join('')}</select><p class="hint">Repeats only while this is open. You can also run it manually from Activity.</p>`;
    if($('#limitPrice'))$('#limitPrice').oninput=e=>{ui.limit=Number(e.target.value);checkTrade();};if($('#repeatFrequency'))$('#repeatFrequency').onchange=e=>ui.frequency=e.target.value;
    checkTrade();
  }
  function checkTrade(){const {source,target}=sides();let message='';try{E.quote(state,source,target,gross());if(ui.order==='limit'&&ui.limit<=0)throw Error('Enter a positive target price.');}catch(e){message=e.message;}$('#reviewBtn').disabled=!!message;let hint=$('#tradeHint');if(!hint){hint=document.createElement('p');hint.id='tradeHint';hint.className='trade-hint';$('#reviewBtn').after(hint);}hint.textContent=ui.amount&&message?message:'Sample prices · 0.25% trading fee';}
  $('#tradeAmt').oninput=e=>{let raw=e.target.value.replace(/[^0-9.]/g,'');const parts=raw.split('.');raw=parts.shift()+(parts.length?'.'+parts.join('').slice(0,ui.unit==='USD'?2:10):'');ui.amount=Number(raw)||0;e.target.value=(ui.unit==='USD'?'$':'')+raw;e.target.classList.toggle('zero',!ui.amount);checkTrade();};
  $('#tradeTabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;ui.mode=b.textContent;ui.source=ui.mode==='Convert'?'ETH':'USD';if(ui.source===ui.asset)ui.source='BTC';ui.amount=0;ui.repeat=false;renderTrade();};
  $('#presets').onclick=e=>{const b=e.target.closest('button');if(!b)return;const {source}=sides();const c=b.dataset.v==='max'?Math.floor(E.balance(state,source)*E.asset(source).price*100):Number(b.dataset.v)*100;ui.amount=ui.unit==='USD'?c/100:c/100/E.asset(ui.asset).price;renderTrade();};
  $('#unitToggle').onclick=()=>{ui.amount=ui.unit==='USD'?ui.amount/E.asset(ui.asset).price:ui.amount*E.asset(ui.asset).price;ui.unit=ui.unit==='USD'?'asset':'USD';renderTrade();};
  $('#repeatToggle').onclick=()=>{ui.repeat=!ui.repeat;renderTrade();};
  function assetPicker(title,onSelect,exclude=[],push=false){show(title,`<div class="m-search"><input id="pickerSearch" aria-label="Search assets" placeholder="Search"/></div><div id="pickerList"></div>`,()=>{const draw=()=>{const q=$('#pickerSearch').value.toLowerCase();$('#pickerList').innerHTML=E.ASSETS.filter(a=>!exclude.includes(a.symbol)&&(a.name+' '+a.symbol).toLowerCase().includes(q)).map(a=>`<button class="asset-row" data-symbol="${a.symbol}">${icon(a.symbol)}<span class="names"><span class="n1">${a.name}</span><span class="n2">${a.symbol}</span></span><span class="bal"><span class="b1">${visible(qty(E.balance(state,a.symbol)))}</span></span></button>`).join('')||empty('No matching assets.');$$('#pickerList button').forEach(b=>b.onclick=()=>onSelect(b.dataset.symbol));};$('#pickerSearch').oninput=draw;draw();},push);}
  $('.asset-select').onclick=()=>assetPicker('Select an asset',sym=>{ui.asset=sym;ui.amount=0;if(ui.source===sym)ui.source=ui.mode==='Convert'?(sym==='ETH'?'BTC':'ETH'):'USD';close();renderTrade();},['USD']);
  $('.currency').onclick=()=>assetPicker(ui.mode==='Sell'?'Receive in':ui.mode==='Convert'?'Convert from':'Pay with',sym=>{ui.source=sym;ui.amount=0;close();renderTrade();},[ui.asset,...(ui.mode==='Convert'?['USD']:[])]);
  $('#orderType').onclick=()=>show('Order type',`<button class="option-card" id="marketOrder"><div class="oc-head">${ui.mode} now</div><div class="oc-desc">Execute at the fixed sample price.</div></button><button class="option-card" id="limitOrder"><div class="oc-head">Limit order</div><div class="oc-desc">Place an order at your target price.</div></button>`,()=>{$('#marketOrder').onclick=()=>{ui.order='market';close();renderTrade();};$('#limitOrder').onclick=()=>{ui.order='limit';ui.repeat=false;ui.limit=E.asset(ui.asset).price;close();renderTrade();};});
  $('#reviewBtn').onclick=()=>attempt(()=>{
    const {source,target}=sides(),amount=gross(),q=E.quote(state,source,target,amount);let submitted=false;
    show('Review '+ui.mode.toLowerCase(),`<div class="summary">${row('Pay',qty(q.sourceQuantity)+' '+source)}${row('Receive',qty(q.targetQuantity)+' '+target)}${row('Sample fee',money(q.feeCents))}${row('Total paid',money(q.grossCents))}${row('Order',ui.order==='limit'?'Limit at '+fmtUSD(ui.limit):ui.repeat?'Recurring · '+ui.frequency:'Market')}</div>${notice}${error}<button class="primary" id="confirmTrade">${ui.order==='limit'?'Place order':'Confirm trade'}</button>`,()=>$('#confirmTrade').onclick=()=>attempt(()=>{
      if(submitted)return;let entry;
      if(ui.order==='limit'){entry=commit(s=>E.order(s,{source,target,grossCents:amount,kind:'limit',limitPrice:ui.limit,limitSymbol:ui.asset}));submitted=true;close();go('activity');toast('limit order placed');}
      else {entry=commit(s=>{const t=E.trade(s,source,target,amount);if(ui.repeat)E.order(s,{source,target,grossCents:amount,kind:'recurring',frequency:ui.frequency});return t;});submitted=true;ui.amount=0;renderTrade();showTransaction(entry.id);}
    }));
  });
  function showOrder(id){const o=state.orders.find(o=>o.id===id);if(!o)return;show('Order details',`<div class="receipt">${row('Order ID',esc(o.id))}${row('Type',o.kind)}${row('Pair',o.source+' → '+o.target)}${row('Amount',money(o.grossCents))}${row('Status',o.status)}${o.kind==='limit'?row('Target price',fmtUSD(o.limitPrice)):row('Next run',dateTime(o.nextAt))}</div><p class="hint">Orders use sample prices and available funds. Funds are checked again when an order runs.</p>${error}${o.status==='Active'?`<div class="inline-actions"><button class="primary" id="runOrder">Run order now</button><button class="danger" id="cancelOrder">Cancel order</button></div>`:''}`,()=>{if($('#runOrder'))$('#runOrder').onclick=()=>attempt(()=>{const t=commit(s=>E.executeOrder(s,id));showTransaction(t.id);});if($('#cancelOrder'))$('#cancelOrder').onclick=()=>{commit(s=>{s.orders.find(x=>x.id===id).status='Canceled';});showOrder(id);};});}
  /* Funding flow, with recipient details kept only in memory. */
  let funding={direction:'withdraw',symbol:'USD',speed:'standard',method:'Wire',bank:{name:'MOHAMMAD HOQUE',bank:'Bank',account:'000001043',routing:'021000021',nickname:'bank account'},amount:0};
  function startFunding(direction){funding.direction=direction;funding.amount=0;funding.symbol='USD';fundingAsset(false);}
  function fundingAsset(push=true){let tab='All',query='';show(funding.direction==='withdraw'?'Withdraw':'Deposit',`<div class="m-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="fundSearch" placeholder="Search" aria-label="Search funding assets"/></div><div class="m-tabs" id="fundTabs">${['All','Cash','Crypto'].map((v,i)=>`<button class="${i?'':'active'}" data-tab="${v}">${v}</button>`).join('')}</div><div id="fundAssets"></div>`,()=>{
    const draw=()=>{let html='';for(const kind of ['Cash','Crypto']){if(tab!=='All'&&tab!==kind)continue;const list=E.ASSETS.filter(a=>(kind==='Cash'?a.symbol==='USD':a.symbol!=='USD')&&(a.name+' '+a.symbol).toLowerCase().includes(query));if(list.length)html+=`<div class="m-section"><span>${kind}</span><span>Available Balance</span></div>`+list.map(a=>`<button class="asset-row" data-symbol="${a.symbol}">${icon(a.symbol)}<span class="names"><span class="n1">${a.name}</span><span class="n2">${a.symbol}</span></span><span class="bal"><span class="b1">${visible(a.symbol==='USD'?money(state.cashCents):qty(E.balance(state,a.symbol))+' '+a.symbol)}</span>${a.symbol!=='USD'?`<span class="b2">${visible(fmtUSD(E.balance(state,a.symbol)*a.price))}</span>`:''}</span></button>`).join('');}$('#fundAssets').innerHTML=html||empty('No matching assets.');$$('#fundAssets button').forEach(b=>b.onclick=()=>{funding.symbol=b.dataset.symbol;funding.amount=0;if(funding.direction==='deposit')depositForm();else if(funding.symbol==='USD')withdrawSpeed();else cryptoForm();});};$('#fundSearch').oninput=e=>{query=e.target.value.toLowerCase();draw();};$('#fundTabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;tab=b.dataset.tab;$$('#fundTabs button').forEach(x=>x.classList.toggle('active',x===b));draw();};draw();
  },push);}
  function withdrawSpeed(push=true){show('Select withdrawal speed',`<button class="option-card" id="instantSpeed"><div class="oc-head"><span class="oc-icon">ϟ</span>Instant</div><div class="oc-desc">Arrives in minutes in this sandbox, including weekends and holidays. Fee applies.</div><div class="oc-meta"><span>1.50% sample fee, 50 USD max</span><span>Up to 250,000 USD daily</span></div></button><button class="option-card" id="standardSpeed"><div class="oc-head"><span class="oc-icon">▥</span>Up to 3 business days</div><div class="oc-desc">Estimated arrival by ${E.displayDate(E.WIRE_SCENARIO.arrivalDate)} (October wire scenario).</div><div class="oc-meta"><span>0–5 USD sample fee</span><span>Up to 250,000 USD daily</span></div></button>`,()=>{$('#instantSpeed').onclick=()=>{funding.speed='instant';funding.method='Instant';withdrawAmount();};$('#standardSpeed').onclick=()=>{funding.speed='standard';withdrawMethod();};},push);}
  function withdrawMethod(push=true){const methods=[['ACH','Via a simulated bank transfer','0–2 business days','No fee','1 USD minimum'],['Wire','Via a simulated domestic wire','3-day wire','4 USD sample fee','20 USD minimum'],['MoneyGram cash pickup','Collect USD at a sample pickup location.','In minutes','5 USD sample fee','5 USD minimum']];show('Select a withdrawal method',methods.map(([name,desc,time,fee,min],i)=>`<button class="option-card" data-method="${name}">${i===0?'<div class="badge-rec">Recommended</div>':''}<div class="oc-head"><span class="oc-icon">${i===2?'↪':'▥'}</span>${name}</div><div class="oc-desc">${desc}</div><div class="oc-meta"><span>${time}</span><span>${fee}</span><span>${min}</span></div></button>`).join(''),()=>{$$('[data-method]',body).forEach(b=>b.onclick=()=>{funding.method=b.dataset.method;if(funding.method==='MoneyGram cash pickup')bankForm();else withdrawAmount();});},push);}
  function bankForm(push=true){const b=funding.bank, pickup=funding.method==='MoneyGram cash pickup';show(pickup?'Enter pickup details':'Enter bank account details',()=>field('f_name','Recipient name',b.name,'autocomplete="off" maxlength="100"')+(pickup?field('f_location','pickup location',b.location||'','maxlength="150"'):field('f_bank','Bank name',b.bank,'maxlength="100"')+field('f_account','Account number',b.account,'inputmode="numeric" maxlength="17" autocomplete="off"')+field('f_routing','Routing number',b.routing,'inputmode="numeric" maxlength="9" autocomplete="off"')+field('f_nickname','Account nickname (optional)',b.nickname,'maxlength="100"'))+'<p class="hint">Use sample details. Only the recipient name and masked account ending are saved in history.</p>'+error+'<button class="primary" id="bankContinue">Continue</button>',()=>{
    const fields=pickup?['name','location']:['name','bank','account','routing','nickname'];fields.forEach(k=>$('#f_'+k).oninput=e=>{if(['account','routing'].includes(k))e.target.value=e.target.value.replace(/\D/g,'');b[k]=e.target.value;$('#formError').textContent='';});$('#bankContinue').onclick=()=>attempt(()=>{if(pickup?!(b.name.trim()&&b.location?.trim()):!E.bankValid(b))throw Error(pickup?'Enter the recipient and pickup location.':'Enter a recipient and bank name, a 4–17 digit account, and a valid 9-digit routing number.');withdrawAmount();});
  },push);}
  function maxWithdrawal(){let max=Math.min(state.cashCents,25000000-E.dailyWithdrawn(state));const cfg=E.METHODS[funding.method];if(cfg.fee===null){let low=0,high=max;while(low<high){const middle=Math.ceil((low+high)/2);if(middle+Math.min(5000,Math.round(middle*.015))<=state.cashCents)low=middle;else high=middle-1;}return low;}return Math.max(0,Math.min(max,state.cashCents-cfg.fee));}
  function withdrawAmount(push=true){show('Withdraw USD',()=>`<div class="amt-big"><input id="withdrawAmount" aria-label="Withdrawal amount in USD" inputmode="decimal" value="$${funding.amount?qty(funding.amount):'0'}"/></div><div class="amt-sub" id="withdrawHint"></div><div class="amt-chips"><button data-amount="1000">$1,000</button><button data-amount="10000">$10,000</button><button data-amount="100000">$100,000</button><button data-amount="max">MAX</button></div><label class="input-label">Method</label><div class="withdraw-choice"><span class="choice-icon">▥</span><b>${funding.method}</b><button class="secondary" id="changeMethod">Change</button></div><label class="input-label">To</label><div class="withdraw-choice"><span class="choice-icon">▥</span><span><b>${esc(funding.method==='MoneyGram cash pickup'?funding.bank.location||'Choose pickup location':funding.bank.nickname||funding.bank.bank)}</b><small>${funding.method==='MoneyGram cash pickup'?esc(funding.bank.name):'•••• '+esc(funding.bank.account.slice(-4))}</small></span><button class="secondary" id="changeBank">Change</button></div><div class="summary" id="withdrawSummary"></div>${error}<button class="primary" id="withdrawReview" disabled>Review</button>`,()=>{
    const check=()=>{let q;try{q=E.withdrawQuote(state,Math.round(funding.amount*100),funding.method);$('#withdrawHint').textContent=money(state.cashCents)+' available';$('#withdrawHint').classList.remove('err');}catch(e){$('#withdrawHint').textContent=e.message;$('#withdrawHint').classList.add('err');}$('#withdrawReview').disabled=!q;$('#withdrawAmount').classList.toggle('zero',!funding.amount);$('#withdrawSummary').innerHTML=row('Available',money(state.cashCents))+row('Sample fee',q?money(q.feeCents):funding.method==='Instant'?'1.5%, capped at $50':money(E.METHODS[funding.method].fee))+row('Remaining balance',q?money(state.cashCents-q.totalCents):'—')+(funding.method==='Wire'?row('estimated arrival',E.displayDate(E.WIRE_SCENARIO.arrivalDate)):'');};
    $('#withdrawAmount').oninput=e=>{let raw=e.target.value.replace(/[^0-9.]/g,'');const parts=raw.split('.');raw=parts.shift()+(parts.length?'.'+parts.join('').slice(0,2):'');funding.amount=Number(raw)||0;e.target.value='$'+raw;check();};$$('[data-amount]',body).forEach(b=>b.onclick=()=>{funding.amount=(b.dataset.amount==='max'?maxWithdrawal():Number(b.dataset.amount)*100)/100;$('#withdrawAmount').value='$'+qty(funding.amount);check();});$('#changeMethod').onclick=()=>withdrawSpeed();$('#changeBank').onclick=()=>bankForm();$('#withdrawReview').onclick=()=>attempt(()=>{const q=E.withdrawQuote(state,Math.round(funding.amount*100),funding.method);if(funding.method==='MoneyGram cash pickup'?!(funding.bank.name&&funding.bank.location):!E.bankValid(funding.bank)){bankForm();return;}withdrawReview(q);});check();
  },push);}
  function withdrawReview(q){let submitted=false;show('Review withdrawal',`<div class="summary">${row('Amount',money(q.grossCents))}${row('Method',q.method)}${q.method==='Wire'?row('Processing','3-day wire'):''}${row('Recipient',esc(funding.bank.name))}${row('Destination',esc(funding.method==='MoneyGram cash pickup'?funding.bank.location:funding.bank.bank))}${row('Sample fee',money(q.feeCents))}${row('Total debit',money(q.totalCents))}${row('Estimated arrival',esc(q.arrival))}</div>${notice}${error}<button class="primary" id="confirmWithdraw">Confirm withdrawal</button>`,()=>$('#confirmWithdraw').onclick=()=>attempt(()=>{if(submitted)return;const t=commit(s=>E.cashWithdraw(s,q.grossCents,funding.bank,q.method));submitted=true;funding.amount=0;showTransaction(t.id);toast('Simulated withdrawal submitted');}),true);}
  function depositForm(){const sym=funding.symbol;let value='';show('Deposit '+sym,()=>`<div class="center">${icon(sym)}<h3>Add ${sym}</h3><p class="hint">This credits simulated funds. Do not send a bank payment or crypto.</p></div>${sym!=='USD'?`<div class="summary">${row('Network',network(sym))}</div>`:''}${field('depositAmount','Amount ('+sym+')',value,'type="number" step="any" min="0"')}${error}<button class="primary" id="confirmDeposit">Add funds</button>`,()=>{$('#depositAmount').oninput=e=>value=e.target.value;$('#confirmDeposit').onclick=()=>attempt(()=>{const t=commit(s=>{const entry=E.deposit(s,sym,num($('#depositAmount').value));if(sym!=='USD'){entry.network=network(sym);entry.hash=sampleHash(sym);}return entry;});showTransaction(t.id);});},true);}
  function cryptoForm(){const sym=funding.symbol;let destination='',amount='';show('Withdraw '+sym,()=>`${icon(sym)}<div class="summary">${row('Available',qty(E.balance(state,sym))+' '+sym)}${row('Network',network(sym))}${row('network fee','0 '+sym)}</div>${field('cryptoAddress','destination address',destination,'autocomplete="off" maxlength="120"')}${field('cryptoAmount','Amount ('+sym+')',amount,'type="number" step="any" min="0"')}<button class="text-btn" id="cryptoMax">MAX</button>${error}${notice}<button class="primary" id="cryptoReview">Review</button>`,()=>{$('#cryptoAddress').oninput=e=>destination=e.target.value;$('#cryptoAmount').oninput=e=>amount=e.target.value;$('#cryptoMax').onclick=()=>{$('#cryptoAmount').value=amount=E.balance(state,sym);};$('#cryptoReview').onclick=()=>attempt(()=>{const preview=E.clone(state);E.cryptoWithdraw(preview,sym,num(amount),destination.trim(),network(sym));let submitted=false;show('Review '+sym+' withdrawal',`<div class="summary">${row('Amount',qty(num(amount))+' '+sym)}${row('Network',network(sym))}${row('destination',esc(destination))}${row('Network fee','0 '+sym)}</div>${notice}${error}<button class="primary" id="cryptoConfirm">Confirm withdrawal</button>`,()=>$('#cryptoConfirm').onclick=()=>attempt(()=>{if(submitted)return;const t=commit(s=>E.cryptoWithdraw(s,sym,num(amount),destination.trim(),network(sym)));submitted=true;showTransaction(t.id);}),true);});},true);}
  /* Profile menu mirrors the reference, with working local settings. */
  const initials=name=>name.split(/\s+/).filter(Boolean).map(v=>v[0]).slice(0,2).join('').toUpperCase()||'MH';
  const menuIcons={account:'<circle cx="12" cy="7" r="4"/><path d="M5 21v-3a7 7 0 0 1 14 0v3z"/>',plus:'<path d="m12 2 9 5v10l-9 5-9-5V7zM8 12h8M12 8v8"/>',earn:'<circle cx="12" cy="12" r="9"/><path d="m8 16 8-8M8 8h.01M16 16h.01"/>',payments:'<path d="m3 9 9-6 9 6H3M5 10v9M10 10v9M15 10v9M20 10v9M3 21h18"/>',security:'<path d="m12 3 8 3v6c0 5-8 10-8 10S4 17 4 12V6z"/>',notifications:'<path d="M6 17V9a6 6 0 0 1 12 0v8l2 2H4zM10 22h4"/>',taxes:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h1M12 11h1M16 11h.01M8 15h1M12 15h1M16 15h.01M8 19h1M12 19h1"/>',devices:'<rect x="2" y="4" width="15" height="13" rx="2"/><rect x="14" y="11" width="8" height="11" rx="1"/><path d="M6 21h5M8 17v4"/>',documents:'<path d="M5 2h9l5 5v15H5zM14 2v6h5M8 12h8M8 16h8"/>',offers:'<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10 3 7.5 4 9 8 12 8Zm0 0s2-5 4.5-4S15 8 12 8Z"/>',signout:'<path d="M9 3H3v18h6M9 12h12m-5-5 5 5-5 5"/>'};
  function profileMenu(){show('Profile',`<button class="profile-close" data-action="close" aria-label="Close profile">×</button><div class="profile-heading"><span class="profile-avatar">${initials(state.profile.name)}</span><b>${esc(state.profile.name)}</b></div><div class="theme-switch" aria-label="Theme">${[['auto','◐ Auto'],['light','☼'],['dark','☾']].map(([v,label])=>`<button class="${state.settings.theme===v?'active':''}" data-action="theme" data-theme="${v}" aria-label="${v} theme">${label}</button>`).join('')}</div><div class="profile-links">${[['account','Account'],['plus','Kraken+'],['earn','Earn Settings'],['payments','Payment Methods'],['security','Security'],['notifications','Notifications'],['taxes','Taxes'],['devices','Device Management'],['documents','Documents'],['offers','Offers'],['signout','Sign out']].map(([key,label])=>`<button class="profile-link ${key==='signout'?'signout':''}" data-action="profile-${key}"><svg viewBox="0 0 24 24">${menuIcons[key]}</svg>${label}</button>`).join('')}</div>`,()=>{});modal.classList.add('profile-mode');overlay.classList.add('profile-backdrop');}
  function applyTheme(){const theme=state.settings.theme||'dark';document.body.classList.toggle('light-theme',theme==='light'||theme==='auto'&&matchMedia('(prefers-color-scheme: light)').matches);}
  function account(){show('Account',`<div class="profile-heading"><span class="profile-avatar">${initials(state.profile.name)}</span><b>Sandbox account</b></div>${field('displayName','Display name',state.profile.name,'maxlength="80"')}<div class="summary">${row('Public Account ID',`<button class="copy-value" data-action="copy-public">${state.profile.publicId||'AA00000000000000'} ⧉</button>`)}${row('Account status','Sandbox')}</div><p class="hint">The sample account ID is separate from internal transaction references and blockchain hashes.</p>${error}<div class="inline-actions"><button class="primary" id="saveProfile">Save settings</button>${btn('Reset','reset','danger')}</div>`,()=>$('#saveProfile').onclick=()=>attempt(()=>{const name=$('#displayName').value.trim();if(!name)throw Error('Enter a display name.');state.profile.name=name;save();refresh();close();toast('Profile saved');}),true);}
  function notifications(push=false){show('Notifications',`<div class="inline-actions">${btn('Mark all read','read-notifications')}${btn('Clear notifications','clear-notifications','text-btn')}</div><div class="notification-list">${state.notifications.length?state.notifications.map(n=>`<div class="notification-item ${n.read?'read':''}"><span class="notification-dot"></span><p>${esc(n.text)}</p></div>`).join(''):empty('No notifications.')}</div><label class="checkbox-row"><input type="checkbox" id="notifySetting" ${state.settings.notify!==false?'checked':''}/> Show new notifications</label>`,()=>$('#notifySetting').onchange=e=>{state.settings.notify=e.target.checked;save();},push);}
  function paymentMethods(){const recipients=[...new Map(state.activity.filter(t=>t.recipient&&t.last4).map(t=>[t.bank+t.last4,t])).values()];show('Payment Methods',`<p class="hint">bank destinations. Full account and routing numbers are kept only in memory.</p><div class="table-panel">${recipients.length?recipients.map(t=>`<div class="payment-item"><b>${esc(t.nickname)}</b><small>${esc(t.bank)} •••• ${esc(t.last4)}</small></div>`).join(''):empty('No saved destinations yet.')}</div><div class="inline-actions">${btn('Edit bank','edit-bank','primary')}${btn('Withdraw USD','withdraw')}</div>`,()=>{},true);}
  function security(){show('Security',`<div class="feature-panel"><h3>Security walkthrough</h3><p>Change the sandbox security preference. This walkthrough does not create a real passkey or protect a Kraken account.</p><label class="checkbox-row"><input id="securitySetting" type="checkbox" ${state.settings.security?'checked':''}/> Enable passkey preference</label></div><label class="checkbox-row"><input id="hideSetting" type="checkbox" ${state.settings.hidden?'checked':''}/> Hide balances on the dashboard</label>`,()=>{$('#securitySetting').onchange=e=>{state.settings.security=e.target.checked;save();};$('#hideSetting').onchange=e=>{state.settings.hidden=e.target.checked;save();refresh();};},true);}
  function plus(){show('Kraken+',`<div class="feature-panel"><h3>Explore a membership</h3><p>Toggle the membership state to preview account preferences. There is no charge or subscription.</p><div class="summary">${row('membership',state.settings.plus?'Enabled':'Disabled')}${row('Payment','None')}</div></div><button class="primary" id="plusToggle">${state.settings.plus?'Disable':'Enable'} membership</button>`,()=>$('#plusToggle').onclick=()=>{state.settings.plus=!state.settings.plus;save();plus();},true);}
  function documents(){show('Documents',`<p class="hint">Download documents generated from your sandbox history.</p><div class="menu-options">${btn('Download account statement','statement')}${btn('Download transaction CSV','export-all')}${btn('Download backup (JSON)','backup')}</div>`,()=>{},true);}
  function taxes(){show('Taxes',`<h3>transaction report</h3><p class="hint">Export your sandbox ledger. This prototype does not calculate tax liability or produce a filed tax form.</p><div class="summary">${row('trades',state.activity.filter(t=>t.type==='Trade').length)}${row('Sample trading fees',money(state.activity.reduce((v,t)=>v+(t.feeCents||0),0)))}</div>${btn('Export report','export-all','primary')}`,()=>{},true);}
  function devices(){show('Device Management',`<h3>Current browser</h3><p class="device-info">${esc(navigator.userAgent)}</p><div class="summary">${row('Storage','This browser only')}${row('Account connection','Sandbox')}</div>${btn('End session','signout','danger')}`,()=>{},true);}
  function signout(){state.settings.signedOut=true;save();close();lockScreen();}
  function lockScreen(){let lock=$('#sessionLock');if(!lock){lock=document.createElement('div');lock.id='sessionLock';lock.className='session-lock';document.body.append(lock);}lock.innerHTML=`<div class="feature-panel"><div class="logo">${$('.logo').innerHTML}</div><h1>session ended</h1><p>Your balances and history remain saved in this browser.</p><button class="primary" id="resumeSession">Resume sandbox</button></div>`;$('#resumeSession').onclick=()=>{state.settings.signedOut=false;save();lock.remove();refresh();};$('#resumeSession').focus();}
  function allocation(direction){let value='';const available=direction==='in'?state.cashCents:state.earnCents;show(direction==='in'?'Allocate USD':'Return rewards to cash',()=>field('allocationAmount','Amount (USD)',value,'type="number" step="0.01" min="1"')+`<p class="hint">${money(available)} available</p><button class="text-btn" id="allocationMax">MAX</button>${error}<button class="primary" id="allocationConfirm">Confirm</button>`,()=>{$('#allocationAmount').oninput=e=>value=e.target.value;$('#allocationMax').onclick=()=>$('#allocationAmount').value=value=available/100;$('#allocationConfirm').onclick=()=>attempt(()=>{const t=commit(s=>E.earn(s,cash($('#allocationAmount').value),direction));showTransaction(t.id);});});}
  function loan(repay=false){show(repay?'Repay loan':'Borrow USD',`${repay?'':`<label class="input-label" for="loanAsset">Collateral asset</label><select id="loanAsset">${E.ASSETS.filter(a=>a.symbol!=='USD'&&a.category!=='Stablecoins').map(a=>`<option value="${a.symbol}">${a.name} (${qty(E.balance(state,a.symbol))} available)</option>`).join('')}</select>`}${field('loanAmount','Amount (USD)','','type="number" min="0.01" step="0.01"')}${repay?`<p class="hint">Outstanding: ${money(state.loanCents)}</p><button class="text-btn" id="repayMax">MAX</button>`:'<p class="hint">200% collateral. Buy crypto first to borrow against it.</p>'}${error}<button class="primary" id="loanConfirm">${repay?'Repay':'Borrow'} funds</button>`,()=>{if($('#repayMax'))$('#repayMax').onclick=()=>$('#loanAmount').value=Math.min(state.cashCents,state.loanCents)/100;$('#loanConfirm').onclick=()=>attempt(()=>{const t=commit(s=>repay?E.repay(s,cash($('#loanAmount').value)):E.borrow(s,cash($('#loanAmount').value),$('#loanAsset').value));showTransaction(t.id);});});}
  const faqs=[['Are these real funds?','All balances, trades and withdrawals in this prototype are simulated. Nothing is sent to Kraken, a bank or a blockchain.'],['Where is my history saved?','In this browser. Reloading preserves the history when browser storage is available.'],['Why is my wire amount rejected?','Wire has a $20 minimum and a $4 sample fee. The amount plus fee must fit within the available USD balance.'],['How do orders work?','Limit orders use the fixed sample price. Recurring orders run only while the is open, or manually from Activity.'],['What is the blockchain hash?','Crypto deposit confirmations use a clearly labeled sample blockchain hash. Internal ledger references and the sample Public Account ID are separate.'],['Can I cancel a withdrawal?','Open a pending withdrawal in Activity and choose Cancel. Its amount and any sample fee return to your available balance.']];
  function sendSupport(message) {
    const text=String(message||'').trim().slice(0,2000);
    if(!text){toast('Enter a question or paste a FT reference or AA account ID');return;}
    const reply=E.supportAnswer(state,text,state.supportContextId);
    const date=new Date().toISOString();
    state.supportChat.push({id:E.id('CHAT'),role:'user',text,date},{id:E.id('CHAT'),role:'assistant',...reply,date});
    state.supportChat=state.supportChat.slice(-100);
    if(reply.transactionId)state.supportContextId=reply.transactionId;
    else state.supportContextId=null;
    save();renderSupport();$('#supportQuery').focus();
  }
  function renderSupport(){
    const tickets=state.tickets;
    const messages=state.supportChat.length?state.supportChat.map(m=>{
      const reply=m.role==='assistant'&&m.transactionId?E.transactionSupport(state,m.transactionId):m;
      return `<div class="support-message ${m.role}"><small>${m.role==='user'?'You':'Support assistant'}</small><p>${esc(reply.text)}</p>${reply.transactionId?`<button class="text-btn" data-action="transaction" data-id="${esc(reply.transactionId)}">View transaction details →</button>`:''}</div>`;
    }).join(''):'<div class="support-message assistant"><small>Support assistant</small><p>Paste a FT reference, AA account ID, or ask about your latest withdrawal. I can show the transaction date, current status and saved arrival estimate.</p></div>';
    $('#pageView').innerHTML=heading('Priority Support','Instant answers from your saved transactions.')+`<div class="feature-panel support-panel"><div class="support-heading"><div><span class="eyebrow">TRANSACTION ASSISTANT</span><h2>How can we help?</h2></div><button class="text-btn" data-action="support-clear">Clear chat</button></div><p class="hint">October wire scenario · 3-day wire · estimated arrival ${E.displayDate(E.WIRE_SCENARIO.arrivalDate)}. All funds and replies are simulated.</p><div class="support-log" id="supportLog" role="log" aria-live="polite" aria-label="Support conversation">${messages}</div><div class="support-prompts"><button class="secondary" data-action="support-latest">Latest withdrawal</button><button class="secondary" data-action="support-arrival">When will it arrive?</button></div><form id="supportForm"><label class="input-label" for="supportQuery">Ask about a transaction</label><textarea id="supportQuery" rows="3" maxlength="2000" placeholder="Paste your FT reference, AA account ID, or ask a question..."></textarea><div class="support-compose-footer"><small>Enter to send · Shift + Enter for a new line</small><button class="primary" type="button" data-action="support-send">Send message ↑</button></div></form></div><h2>Help topics</h2><input class="support-search" id="faqSearch" placeholder="Search help topics" aria-label="Search help topics"/><div id="faqList"></div><div class="feature-panel"><h2>Save a support request</h2><p>This request stays in your browser.</p><textarea id="supportMessage" aria-label="Support request" rows="4" maxlength="2000" placeholder="Describe the issue..."></textarea>${btn('Save request','support-save','primary')}</div>${tickets.length?`<h2>Saved requests</h2>${tickets.map(t=>`<div class="feature-panel"><small>${dateTime(t.date)} · ${esc(t.id)}</small><p>${esc(t.message)}</p></div>`).join('')}` :''}`;
    const draw=()=>{const q=$('#faqSearch').value.toLowerCase();$('#faqList').innerHTML=faqs.filter(a=>a.join(' ').toLowerCase().includes(q)).map(([question,answer])=>`<details><summary>${question}</summary><p>${answer}</p></details>`).join('')||empty('No matching help topics.');};
    $('#faqSearch').oninput=draw;draw();
    $('#supportForm').onsubmit=e=>{e.preventDefault();sendSupport($('#supportQuery').value);};
    $('#supportQuery').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();sendSupport(e.target.value);}};
    $('#supportLog').scrollTop=$('#supportLog').scrollHeight;
  }
  /* One delegated handler covers every dynamic control. */
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]');if(!b||b.disabled)return;
    const action=b.dataset.action,id=b.dataset.id,symbol=b.dataset.symbol;
    attempt(()=>{
      if(['home','portfolio','explore','earn','activity','offers','support'].includes(action)){close();go(action);return;}
      if(action.startsWith('profile-')){const route=action.slice(8);({account,plus,payments:paymentMethods,security,notifications:()=>notifications(true),taxes,devices,documents,earn:()=>{close();go('earn');},offers:()=>{close();go('offers');},signout})[route]?.();return;}
      switch(action){
        case 'close':close();break;
        case 'privacy':state.settings.hidden=!state.settings.hidden;save();refresh();break;
        case 'asset':go('asset:'+symbol);break;
        case 'watch':state.watchlist=state.watchlist.includes(symbol)?state.watchlist.filter(v=>v!==symbol):[...state.watchlist,symbol];save();refresh();break;
        case 'buy-asset':case 'sell-asset':if(symbol==='USD'){startFunding('deposit');break;}ui.asset=symbol;ui.mode=action==='buy-asset'?'Buy':'Sell';ui.source='USD';ui.amount=0;renderTrade();$('#tradeAmt').focus();break;
        case 'deposit':startFunding('deposit');break;
        case 'withdraw':startFunding('withdraw');break;
        case 'edit-bank':funding.direction='withdraw';funding.method='Wire';bankForm();break;
        case 'transaction':showTransaction(id);break;
        case 'order-detail':showOrder(id);break;
        case 'receipt':receipt(state.activity.find(t=>t.id===id));break;
        case 'copy-id':copy(id);break;
        case 'copy-hash':copy(state.activity.find(t=>t.id===id).hash);break;
        case 'copy-address':copy(state.activity.find(t=>t.id===id).address);break;
        case 'copy-public':copy(state.profile.publicId||'AA00000000000000');break;
        case 'cancel-transaction':commit(s=>E.cancel(s,id));showTransaction(id);toast('funds returned to balance');break;
        case 'confirm-transaction':commit(s=>{const t=s.activity.find(t=>t.id===id);if(t.status!=='Pending')throw Error('This transaction is no longer pending.');t.status='Completed';if(t.type==='Crypto withdrawal')t.hash=sampleHash(t.symbol);});showTransaction(id);break;
        case 'inspect-hash':{const t=state.activity.find(t=>t.id===id);show('blockchain record',`<p class="hint">This generated hash illustrates the ${t.network} transaction format. It is not broadcast and does not identify a real blockchain payment.</p><div class="receipt">${row('Network',t.network)}${row('Sample hash',`<span class="hash-value">${t.hash}</span>`)}</div>${btn('Copy sample hash','copy-hash').replace('data-action="copy-hash"',`data-action="copy-hash" data-id="${id}"`)}`,()=>{},true);break;}
        case 'export':exportHistory();break;
        case 'export-all':exportHistory(state.activity);break;
        case 'clear-filters':ui.activity={asset:'All',type:'All',start:'',end:'',page:0};renderActivity();break;
        case 'previous-page':ui.activity.page=Math.max(0,ui.activity.page-1);renderActivity();break;
        case 'next-page':ui.activity.page++;renderActivity();break;
        case 'recurring':case 'limit':close();ui.mode='Buy';ui.source='USD';ui.order=action==='limit'?'limit':'market';ui.repeat=action==='recurring';ui.limit=E.asset(ui.asset).price;ui.amount=20;renderTrade();$('#tradeAmt').focus();toast('Configure your order, then Review');break;
        case 'earn-in':allocation('in');break;
        case 'earn-out':allocation('out');break;
        case 'borrow':loan(false);break;
        case 'borrow-page':close();go('borrow');break;
        case 'repay':loan(true);break;
        case 'theme':state.settings.theme=b.dataset.theme;save();applyTheme();profileMenu();refresh();break;
        case 'read-notifications':state.notifications.forEach(n=>n.read=true);save();refresh();notifications();break;
        case 'clear-notifications':state.notifications=[];save();refresh();notifications();break;
        case 'claim':if(state.claims.includes(id))break;if(id==='trade'&&!state.activity.some(t=>t.type==='Trade')){toast('Complete a trade to claim this reward');break;}commit(s=>{s.claims.push(id);E.deposit(s,'USD',id==='learn'?10:5);});toast('reward credited');break;
        case 'ask-support':close();go('support');sendSupport('When will transaction '+id+' arrive?');break;
        case 'support-send':sendSupport($('#supportQuery').value);break;
        case 'support-latest':sendSupport('When will my latest withdrawal arrive?');break;
        case 'support-arrival':sendSupport(state.supportContextId?'When will it arrive?':'When will my latest withdrawal arrive?');break;
        case 'support-clear':state.supportChat=[];state.supportContextId=null;save();renderSupport();break;
        case 'support-save':{const message=$('#supportMessage').value.trim();if(!message){toast('Describe the issue first');break;}state.tickets.unshift({id:E.id('SUPPORT'),date:new Date().toISOString(),message});save();renderSupport();toast('Request saved in this browser');break;}
        case 'statement':download('sandbox-account-statement.txt',['KRAKEN-INSPIRED SANDBOX — STATEMENT',dateTime(Date.now()),'Name: '+state.profile.name,'Portfolio value: '+money(E.totalCents(state)),'Available cash: '+money(state.cashCents),'Rewards allocation: '+money(state.earnCents),'loan: '+money(state.loanCents),'','Transactions:',...state.activity.map(t=>`${dateTime(t.date)} | ${transactionName(t)} | ${money(t.grossCents||0)} | ${t.status} | ${t.id}`),'','Simulated funds. Not an official Kraken statement.'].join('\n'));break;
        case 'backup':download('kraken-sandbox-backup.json',JSON.stringify(state,null,2),'application/json');break;
        case 'reset':show('Reset',`<p>Reset this browser’s balance, trades, orders and settings to their starting values?</p><button class="danger" id="confirmReset">Reset data</button>`,()=>$('#confirmReset').onclick=()=>{state=E.initial();ui.amount=0;ui.page='home';save();applyTheme();refresh();close();toast('reset');},true);break;
        case 'signout':signout();break;
      }
    });
  });
  $('#depositBtn').onclick=()=>startFunding('deposit');$('#withdrawBtn').onclick=()=>startFunding('withdraw');
  $('.pill-btn').onclick=()=>show('Transfer',`<div class="menu-options">${btn('Deposit funds','deposit','option-card')}${btn('Withdraw funds','withdraw','option-card')}${btn('View transactions','activity','option-card')}</div>`);
  $('.avatar').onclick=profileMenu;$('.notif').onclick=()=>notifications();
  $('[aria-label="Apps"]').onclick=()=>show('Apps',`<div class="app-grid">${[['home','Home'],['portfolio','Portfolio'],['explore','Markets'],['earn','Rewards'],['borrow-page','Borrow'],['activity','Activity'],['support','Support'],['offers','Offers']].map(([action,name])=>btn(name,action,'app-tile')).join('')}</div>`);
  $('#fyNext').onclick=()=>$('#fyCards').scrollBy?.({left:316,behavior:'smooth'});$('#fyPrev').onclick=()=>$('#fyCards').scrollBy?.({left:-316,behavior:'smooth'});
  $$('.fy-card').forEach((card,i)=>{card.tabIndex=0;card.setAttribute('role','button');const action=[()=>go('earn'),security,()=>startFunding('withdraw'),()=>{ui.mode='Buy';ui.source='USD';ui.repeat=true;ui.amount=20;renderTrade();$('#tradeAmt').focus();}][i];card.onclick=action;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action();}};});
  let searchTimeout;$('#globalSearch').oninput=e=>{const query=e.target.value;clearTimeout(searchTimeout);searchTimeout=setTimeout(()=>{ui.page='explore';ui.marketQuery=query;ui.marketFilter='All';renderPage();},120);};$('#globalSearch').onkeydown=e=>{if(e.key==='Enter'){clearTimeout(searchTimeout);ui.page='explore';ui.marketQuery=e.target.value;ui.marketFilter='All';renderPage();$('#marketQuery')?.focus();}};
  window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){state=E.load(e.newValue);applyTheme();refresh();if(state.settings.signedOut)lockScreen();else $('#sessionLock')?.remove();}});
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change',()=>{applyTheme();renderChart();});
  setInterval(()=>{
    if(state.settings.signedOut)return;
    const reward=E.accrue(state);let changed=reward>0;
    for(const o of state.orders.filter(o=>o.status==='Active'&&o.kind==='recurring'&&o.nextAt<=Date.now())){
      try {E.executeOrder(state,o.id);changed=true;}catch(e){o.status='Paused';if(state.settings.notify!==false)state.notifications.unshift({id:E.id('NOTICE'),text:'Recurring order paused: '+e.message,read:false});changed=true;}
    }
    save();if(changed)refresh();
  },30000);
  save();applyTheme();refresh();if(state.settings.signedOut)lockScreen();
})();
