/* Browser-local sandbox ledger. All prices, balances and transactions are simulated. */
(function(root) {
  'use strict';
  const ASSETS = [
    {symbol:'USD',name:'US Dollar',price:1,change:0,color:'#3b7564',glyph:'$',category:'Cash'},
    {symbol:'BTC',name:'Bitcoin',price:82594.80,change:0.95,color:'#f7931a',glyph:'₿',category:'Layer 1'},
    {symbol:'ETH',name:'Ethereum',price:2489.68,change:0.35,color:'#535dc6',glyph:'♦',category:'Layer 1'},
    {symbol:'SOL',name:'Solana',price:148.32,change:2.84,color:'#896ce0',glyph:'≡',category:'Layer 1'},
    {symbol:'BNB',name:'BNB Chain',price:615.14,change:-0.84,color:'#d9ac20',glyph:'◆',category:'Layer 1'},
    {symbol:'USDT',name:'Tether USD',price:1,change:0,color:'#26a17b',glyph:'₮',category:'Stablecoins'},
    {symbol:'USDC',name:'USD Coin',price:0.9997,change:-0.03,color:'#2775ca',glyph:'$',category:'Stablecoins'},
    {symbol:'USDG',name:'Global Dollar',price:1,change:0,color:'#2e856a',glyph:'$',category:'Stablecoins'},
    {symbol:'BABY',name:'Babylon',price:0.026,change:4.35,color:'#48716b',glyph:'✣',category:'DeFi'},
    {symbol:'BAT',name:'Basic Attention Token',price:0.1392,change:34.74,color:'#ff5000',glyph:'△',category:'Trending'},
    {symbol:'RLC',name:'iExec RLC',price:1.07,change:26.34,color:'#d8b620',glyph:'⠿',category:'Trending'},
    {symbol:'STRK',name:'Starknet Token',price:0.07479,change:25.93,color:'#434278',glyph:'✦',category:'Layer 2'},
    {symbol:'DEBIT',name:'Teller',price:1.92,change:8.04,color:'#c6cd00',glyph:'▦',category:'New'}
  ];
  const asset = symbol => ASSETS.find(a=>a.symbol===symbol);
  const clone = value => JSON.parse(JSON.stringify(value));
  const cents = value => Math.round(value * 100);
  const units = value => Math.round(value * 1e12) / 1e12;
  const id = prefix => prefix + '-' + (root.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));
  function formattedId(prefix,length) {
    const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',bytes=new Uint8Array(length-prefix.length);
    if(root.crypto?.getRandomValues)root.crypto.getRandomValues(bytes);else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
    return prefix+[...bytes].map((v,i)=>i===bytes.length-1?String(v%10):alphabet[v%alphabet.length]).join('');
  }
  function fundingId(s) {let value;do{value=formattedId('FT',19);}while(s.activity.some(t=>t.id===value));return value;}
  const START_CENTS = 6500000;
  // A dated sandbox scenario requested by the user, not a live bank ETA.
  const WIRE_SCENARIO = Object.freeze({days:3,arrivalDate:'2026-10-14'});
  const displayDate = value => new Date(value.length===10?value+'T12:00:00Z':value).toLocaleDateString('en-US',{timeZone:'America/Chicago',weekday:'long',month:'long',day:'numeric',year:'numeric'});
  function initial() {
    return {version:3,cashCents:START_CENTS,earnCents:0,loanCents:0,holdings:{},collateral:{},activity:[{id:'OPENING-BALANCE',type:'Deposit',date:new Date().toISOString(),status:'Completed',symbol:'USD',quantity:START_CENTS/100,grossCents:START_CENTS,description:'Opening USD balance'}],orders:[],watchlist:['BTC','ETH'],notifications:[{id:'welcome',text:'Your $65,000 sandbox is ready. The 3-day wire scenario estimates arrival on October 14, 2026.',read:false}],profile:{name:'MOHAMMAD HOQUE',currency:'USD',publicId:formattedId('AA',16)},settings:{hidden:false,collapsed:false,security:false,theme:'dark',plus:false,notify:true,signedOut:false},claims:[],tickets:[],supportChat:[],supportContextId:null,lastAccrual:Date.now(),rewardRemainder:0};
  }
  function load(raw) {
    try {
      const d=JSON.parse(raw);
      if(d.version!==3 || !Number.isSafeInteger(d.cashCents) || d.cashCents<0 || !Number.isSafeInteger(d.earnCents) || d.earnCents<0 || !Number.isSafeInteger(d.loanCents) || d.loanCents<0) return initial();
      if(!['holdings','collateral','profile','settings'].every(k=>d[k]&&typeof d[k]==='object') || !['activity','orders','watchlist','notifications','claims','tickets'].every(k=>Array.isArray(d[k]))) return initial();
      for(const group of [d.holdings,d.collateral]) for(const [sym,v] of Object.entries(group)) if(!asset(sym) || !Number.isFinite(v) || v<0) return initial();
      if(typeof d.profile.name!=='string'||!d.profile.name.trim())return initial();
      d.settings={...initial().settings,...d.settings};d.profile={...initial().profile,...d.profile};
      d.supportChat=Array.isArray(d.supportChat)?d.supportChat.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.text==='string').slice(-100):[];
      d.supportContextId=typeof d.supportContextId==='string'?d.supportContextId:null;
      return d;
    } catch { return initial(); }
  }
  function balance(s,sym) { return sym==='USD'?s.cashCents/100:s.holdings[sym]||0; }
  function totalCents(s) {
    return s.cashCents+s.earnCents-s.loanCents+cents(ASSETS.filter(a=>a.symbol!=='USD').reduce((v,a)=>v+((s.holdings[a.symbol]||0)+(s.collateral[a.symbol]||0))*a.price,0));
  }
  function amountCents(value,min=100,max=100000000000) {
    if(!Number.isFinite(value) || value<min || value>max || !Number.isSafeInteger(value)) throw Error('Enter a valid amount'+(min>=100?' of at least $'+(min/100).toFixed(2):'')+'.');
    return value;
  }
  function add(s,sym,quantity) {
    if(sym==='USD') s.cashCents+=cents(quantity); else s.holdings[sym]=units((s.holdings[sym]||0)+quantity);
  }
  function subtract(s,sym,quantity) {
    if(!Number.isFinite(quantity) || quantity<=0 || quantity>balance(s,sym)+1e-10) throw Error('Insufficient '+sym+' balance.');
    if(sym==='USD') s.cashCents-=cents(quantity); else s.holdings[sym]=Math.max(0,units(balance(s,sym)-quantity));
  }
  function record(s,type,fields={}) {
    const entry={id:id('LEDGER'),type,date:new Date().toISOString(),status:'Completed',...fields};
    s.activity.unshift(entry);
    if(s.settings.notify!==false)s.notifications.unshift({id:entry.id,text:(fields.description||type)+' · simulated',read:false});
    return entry;
  }
  function quote(s,source,target,grossCents) {
    amountCents(grossCents);
    if(!asset(source)||!asset(target)||source===target) throw Error('Choose two different assets.');
    const feeCents=Math.max(1,Math.round(grossCents*.0025));
    const sourceQuantity=grossCents/100/asset(source).price;
    const targetQuantity=(grossCents-feeCents)/100/asset(target).price;
    if(sourceQuantity>balance(s,source)+1e-10) throw Error('Amount exceeds your available '+source+' balance.');
    return {source,target,grossCents,feeCents,sourceQuantity,targetQuantity};
  }
  function trade(s,source,target,grossCents,description) {
    const q=quote(s,source,target,grossCents);
    subtract(s,source,q.sourceQuantity); add(s,target,q.targetQuantity);
    return record(s,'Trade',{...q,description:description||source+' → '+target});
  }
  function deposit(s,sym,quantity) {
    if(!asset(sym)||!Number.isFinite(quantity)||quantity<=0||quantity*asset(sym).price>1000000 || (sym==='USD' && cents(quantity)<100)) throw Error('Enter a positive deposit, up to $1,000,000.');
    add(s,sym,quantity); return record(s,'Deposit',{id:fundingId(s),publicAccountId:s.profile.publicId,symbol:sym,quantity,grossCents:cents(quantity*asset(sym).price),description:sym+' deposit'});
  }
  function routingValid(r) {
    if(!/^\d{9}$/.test(r)||/^0+$/.test(r)) return false;
    return [...r].reduce((sum,c,i)=>sum+Number(c)*[3,7,1][i%3],0)%10===0;
  }
  function bankValid(b) { return b&&typeof b.name==='string'&&typeof b.bank==='string'&&b.name.trim().length>=2&&b.bank.trim().length>=2&&/^\d{4,17}$/.test(b.account)&&routingValid(b.routing); }
  function arrival(now=new Date(),businessDays=2) {
    const d=new Date(now); let days=0;
    while(days<businessDays) {d.setDate(d.getDate()+1);if(![0,6].includes(d.getDay())) days++;}
    return d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  }
  function dailyWithdrawn(s) {
    const today=new Date().toDateString();
    return s.activity.filter(a=>['Wire withdrawal','Cash withdrawal'].includes(a.type)&&a.status!=='Canceled'&&new Date(a.date).toDateString()===today).reduce((v,a)=>v+a.grossCents,0);
  }
  const METHODS = {Wire:{min:2000,fee:400,days:3},ACH:{min:100,fee:0,days:2},Instant:{min:100,fee:null,days:0},'MoneyGram cash pickup':{min:500,fee:500,days:0}};
  function withdrawQuote(s,grossCents,method='Wire') {
    const cfg=METHODS[method];if(!cfg)throw Error('Choose a withdrawal method.');
    amountCents(grossCents,cfg.min,25000000);
    const feeCents=cfg.fee===null?Math.min(5000,Math.round(grossCents*.015)):cfg.fee;
    if(grossCents+feeCents>s.cashCents)throw Error('Amount plus fees exceeds your available USD balance.');
    if(grossCents+dailyWithdrawn(s)>25000000)throw Error('This exceeds the $250,000 daily withdrawal limit.');
    return {grossCents,feeCents,totalCents:grossCents+feeCents,method,processingDays:cfg.days,arrivalDate:method==='Wire'?WIRE_SCENARIO.arrivalDate:null,arrival:method==='Wire'?displayDate(WIRE_SCENARIO.arrivalDate):cfg.days?arrival(new Date(),cfg.days):'Within minutes (simulated)'};
  }
  function cashWithdraw(s,grossCents,b,method='Wire') {
    const q=withdrawQuote(s,grossCents,method);
    if(method==='MoneyGram cash pickup') {if(!b.name?.trim()||!b.location?.trim())throw Error('Enter the recipient and pickup location.');}
    else if(!bankValid(b))throw Error('Check the recipient, account number and routing checksum.');
    s.cashCents-=q.totalCents;
    return record(s,method==='Wire'?'Wire withdrawal':'Cash withdrawal',{id:fundingId(s),publicAccountId:s.profile.publicId,...q,description:method+' to '+b.name,recipient:b.name,bank:method==='MoneyGram cash pickup'?b.location:b.bank,last4:method==='MoneyGram cash pickup'?'':b.account?.slice(-4)||'',nickname:method==='MoneyGram cash pickup'?b.location:b.nickname||b.bank,status:'Pending'});
  }
  function wire(s,grossCents,b) { return cashWithdraw(s,grossCents,b,'Wire'); }
  function transactionSupport(s,transactionId) {
    const t=s.activity.find(t=>t.id===transactionId);
    if(!t)return {kind:'not-found',text:'That transaction is no longer in this browser’s history. Paste a reference from Activity.'};
    const usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
    const lines=['Funding transaction: '+t.id,'Transaction date: '+displayDate(t.date),'Type: '+t.type,'Status: '+t.status,'Amount: '+usd(t.grossCents||0)];
    if(t.publicAccountId)lines.push('Public Account ID: '+t.publicAccountId);
    if(t.type==='Wire withdrawal') {
      lines.push('Processing: '+t.processingDays+'-day wire');
      if(t.status==='Canceled')lines.push('This wire was canceled. The amount and fee were refunded; no arrival is expected.');
      else if(t.status==='Completed')lines.push('This wire was manually marked completed in the sandbox. Original estimated arrival: '+t.arrival+'.');
      else lines.push('Estimated arrival: '+t.arrival+'.');
    } else if(t.arrival)lines.push(t.status==='Canceled'?'No arrival expected: this withdrawal was canceled.':'Estimated arrival: '+t.arrival+'.');
    if(t.feeCents!==undefined)lines.push('Sample fee: '+usd(t.feeCents));
    if(t.bank)lines.push('Destination: '+t.bank+(t.last4?' •••• '+t.last4:''));
    if(t.hash)lines.push('blockchain hash: '+t.hash);
    lines.push('Sandbox record · simulated funds and arrival estimate.');
    return {kind:'transaction',transactionId:t.id,text:lines.join('\n')};
  }
  function supportAnswer(s,message,contextId=null) {
    const text=String(message||'').trim(),tokens=(text.match(/[A-Za-z0-9-]+/g)||[]).map(v=>v.toUpperCase());
    const accounts=(text.toUpperCase().match(/\bAA[A-Z0-9]{2}(?:\s?[A-Z0-9]{4}){3}\b/g)||[]).map(v=>v.replace(/\s/g,''));
    const matches=s.activity.filter(t=>[t.id,t.hash].filter(Boolean).some(ref=>tokens.includes(ref.toUpperCase())));
    if(matches.length===1)return transactionSupport(s,matches[0].id);
    if(matches.length>1)return {kind:'ambiguous',text:'I found multiple transactions. Ask about one reference at a time.'};
    if(accounts.includes(s.profile.publicId)) {
      const wireOnly=/\bwire\b/i.test(text);
      const t=s.activity.find(t=>/withdrawal$/i.test(t.type)&&(!wireOnly||t.type==='Wire withdrawal'));
      return t?{...transactionSupport(s,t.id),text:'Account matched. Showing the latest '+(wireOnly?'wire ':'')+'withdrawal; use its FT reference to select a specific transfer.\n'+transactionSupport(s,t.id).text}:{kind:'not-found',text:'Account matched. There are no withdrawals yet. Create one using Withdraw, then ask again.'};
    }
    const looksLikeRef=accounts.length||tokens.some(v=>/^(?:SANDBOX-|TX-|FT[A-Z0-9]|AA[A-Z0-9]|0X[0-9A-F])/.test(v)||(/^[A-Z0-9-]{12,}$/.test(v)&&/[0-9]/.test(v)));
    if(looksLikeRef)return {kind:'not-found',text:'I could not find that reference in this browser’s transactions. Copy the complete TX reference from Activity. I cannot look up real Kraken or bank transfers.'};
    if(/\b(latest|last|recent)\b/i.test(text)) {
      const withdrawals=/\b(withdrawal|withdraw|wire|transfer)\b/i.test(text),wireOnly=/\bwire\b/i.test(text);
      const t=s.activity.find(t=>t.id!=='OPENING-BALANCE'&&(!withdrawals||/withdrawal$/i.test(t.type))&&(!wireOnly||t.type==='Wire withdrawal'));
      return t?transactionSupport(s,t.id):{kind:'not-found',text:withdrawals?'There are no withdrawals yet. Create one using Withdraw, then paste its TX reference here.':'There are no new transactions yet. Make a deposit, trade or withdrawal first.'};
    }
    if(contextId&&/\b(date|when|arrival|arrive|status|pending|fee|amount|wire|transfer|transaction|it|that)\b/i.test(text))return transactionSupport(s,contextId);
    return {kind:'help',text:'Paste a transaction reference or blockchain hash to see its date, amount, status and available arrival estimate. You can also ask “When will my latest withdrawal arrive?”'};
  }
  function cryptoWithdraw(s,sym,quantity,address,network) {
    if(sym==='USD'||!asset(sym)||!Number.isFinite(quantity)||quantity<=0) throw Error('Enter a positive crypto amount.');
    const valid = ['ETH','BNB','USDT','USDG','USDC','BABY','BAT','RLC','STRK','DEBIT'].includes(sym)?/^0x[0-9a-fA-F]{40}$/.test(address):sym==='SOL'?/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address):/^(bc1[ac-hj-np-z02-9]{20,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(address);
    if(!valid) throw Error('Enter a valid-format '+network+' destination.');
    subtract(s,sym,quantity);
    return record(s,'Crypto withdrawal',{id:fundingId(s),publicAccountId:s.profile.publicId,symbol:sym,quantity,description:sym+' withdrawal',address,network,status:'Pending',grossCents:cents(quantity*asset(sym).price)});
  }
  function cancel(s,entryId) {
    const a=s.activity.find(a=>a.id===entryId);
    if(!a||a.status!=='Pending'||!['Wire withdrawal','Cash withdrawal','Crypto withdrawal'].includes(a.type)) throw Error('Only pending withdrawals can be canceled.');
    if(['Wire withdrawal','Cash withdrawal'].includes(a.type)) s.cashCents+=a.grossCents+(a.feeCents||0); else add(s,a.symbol,a.quantity);
    a.status='Canceled'; return record(s,'Cancellation',{description:'Canceled '+a.id,relatedId:a.id,grossCents:a.grossCents+(a.feeCents||0),symbol:a.symbol||'USD',quantity:a.quantity||null});
  }
  function earn(s,n,direction) {
    amountCents(n);
    if(direction==='in') { if(n>s.cashCents) throw Error('Insufficient USD balance.');s.cashCents-=n;s.earnCents+=n; }
    else {if(n>s.earnCents)throw Error('Amount exceeds your allocated rewards balance.');s.earnCents-=n;s.cashCents+=n;}
    return record(s,'Rewards allocation',{grossCents:n,description:direction==='in'?'USD allocated to rewards':'USD returned to cash'});
  }
  function borrow(s,n,sym) {
    amountCents(n,100,10000000);
    if(!asset(sym)||sym==='USD')throw Error('Select crypto collateral.');
    const quantity=units(n/100*2/asset(sym).price);
    if(quantity>balance(s,sym)+1e-10)throw Error('Buy enough '+sym+' first. This requires 200% collateral.');
    subtract(s,sym,quantity);s.collateral[sym]=units((s.collateral[sym]||0)+quantity);s.loanCents+=n;s.cashCents+=n;
    return record(s,'Loan',{grossCents:n,description:'USD loan · '+sym+' collateral',symbol:sym,quantity});
  }
  function repay(s,n) {
    amountCents(n,1);
    if(n>s.cashCents||n>s.loanCents)throw Error('Repayment exceeds available cash or the outstanding loan.');
    const ratio=n/s.loanCents;
    for(const [sym,v] of Object.entries(s.collateral)) {const release=units(v*ratio);add(s,sym,release);s.collateral[sym]=Math.max(0,units(v-release));}
    s.cashCents-=n;s.loanCents-=n;
    return record(s,'Loan repayment',{grossCents:n,description:'loan repayment; collateral released'});
  }
  const interval={daily:86400000,weekly:604800000,monthly:2592000000};
  function order(s,{source,target,grossCents,kind='limit',limitPrice,limitSymbol,frequency='weekly'}) {
    if(kind==='limit')quote(s,source,target,grossCents);else {amountCents(grossCents);if(!asset(source)||!asset(target)||source===target)throw Error('Choose two different assets.');}
    if(!['limit','recurring'].includes(kind))throw Error('Choose a valid order type.');
    limitSymbol=limitSymbol||(target==='USD'?source:target);
    if(!asset(limitSymbol))throw Error('Choose a valid limit asset.');
    if(kind==='limit'&&(!Number.isFinite(limitPrice)||limitPrice<=0))throw Error('Enter a positive target price.');
    if(kind==='recurring'&&!interval[frequency])throw Error('Choose a repeat frequency.');
    const o={id:id('ORDER'),source,target,grossCents,kind,limitSymbol,limitPrice:limitPrice||null,frequency,nextAt:Date.now()+interval[frequency],createdAt:Date.now(),status:'Active'};
    s.orders.unshift(o);return o;
  }
  function executeOrder(s,orderId) {
    const o=s.orders.find(o=>o.id===orderId);
    if(!o||o.status!=='Active') throw Error('This order is no longer active.');
    if(o.kind==='limit') {
      const basis=o.limitSymbol||(o.target==='USD'?o.source:o.target),market=asset(basis).price;
      if(basis===o.source?market<o.limitPrice:market>o.limitPrice)throw Error('The sample market price has not reached your limit yet.');
    }
    const a=trade(s,o.source,o.target,o.grossCents,''+o.kind+' order');
    if(o.kind==='limit')o.status='Filled';else o.nextAt=Date.now()+interval[o.frequency];
    return a;
  }
  function accrue(s,now=Date.now()) {
    const elapsed=Math.max(0,now-(s.lastAccrual||now));
    const reward=(s.rewardRemainder||0)+s.earnCents*.041*elapsed/(365*86400000);
    const payout=Math.floor(reward);s.earnCents+=payout;s.rewardRemainder=reward-payout;s.lastAccrual=now;
    return payout;
  }
  const api={ASSETS,START_CENTS,WIRE_SCENARIO,displayDate,formattedId,transactionSupport,supportAnswer,asset,initial,load,balance,totalCents,cents,units,id,quote,trade,deposit,wire,withdrawQuote,cashWithdraw,METHODS,cryptoWithdraw,cancel,earn,borrow,repay,routingValid,bankValid,arrival,dailyWithdrawn,order,executeOrder,accrue,record,clone};
  root.SandboxEngine=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
