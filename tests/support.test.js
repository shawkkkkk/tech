const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require(require('node:fs').existsSync(require('node:path').join(__dirname,'../dist/engine.js'))?'../dist/engine.js':'../engine.js');
const bank={name:'Recipient',bank:'Sample Bank',account:'000001043',routing:'021000021'};

test('new scenario starts at $65,000 with a stable generated AA account',()=>{
  const s=E.initial();assert.equal(E.totalCents(s),6500000);
  assert.match(s.profile.publicId,/^AA[A-Z0-9]{14}$/);
  assert.equal(E.load(JSON.stringify(s)).profile.publicId,s.profile.publicId);
});
test('funding references follow requested 19-character FT shape and remain unique',()=>{
  const s=E.initial(),ids=new Set();
  for(let i=0;i<100;i++){
    const t=E.deposit(s,'USD',1);assert.match(t.id,/^FT[A-Z0-9]{17}$/);
    assert.equal(t.publicAccountId,s.profile.publicId);ids.add(t.id);
  }
  assert.equal(ids.size,100);
});
test('wire quote, saved record and support share the three-day October 14 estimate',()=>{
  const s=E.initial(),q=E.withdrawQuote(s,100000,'Wire'),t=E.wire(s,100000,bank);
  assert.equal(s.cashCents,6399600);assert.equal(t.status,'Pending');
  assert.equal(q.arrival,t.arrival);assert.equal(t.processingDays,3);
  assert.equal(t.arrivalDate,'2026-10-14');assert.equal(t.arrival,'Wednesday, October 14, 2026');
  t.date='2026-10-10T02:05:00Z';
  const reply=E.supportAnswer(s,'When does '+t.id.toLowerCase()+' arrive?');
  assert.equal(reply.transactionId,t.id);assert.match(reply.text,/Friday, October 9, 2026/);
  assert.match(reply.text,/Wednesday, October 14, 2026/);assert.match(reply.text,/3-day wire/);
  assert.match(reply.text,/\$1,000\.00/);assert.match(reply.text,/Status: Pending/);
});
test('AA lookup supports grouped account IDs and selects the latest withdrawal',()=>{
  const s=E.initial();E.wire(s,10000,bank);const newest=E.wire(s,20000,bank);
  const grouped=s.profile.publicId.match(/.{4}/g).join(' ');
  assert.equal(E.supportAnswer(s,grouped).transactionId,newest.id);
  assert.equal(E.supportAnswer(s,'Check my account '+s.profile.publicId).transactionId,newest.id);
  assert.match(E.supportAnswer(s,grouped).text,/latest withdrawal/);
});
test('unknown, partial and multiple references never fall back to a different transfer',()=>{
  const s=E.initial(),a=E.wire(s,10000,bank),b=E.wire(s,20000,bank);
  for(const input of ['FT00000000000000000','AA00000000000000',a.id.slice(0,-1)])
    assert.equal(E.supportAnswer(s,input,a.id).kind,'not-found');
  assert.equal(E.supportAnswer(s,a.id+' '+b.id).kind,'ambiguous');
  assert.equal(E.supportAnswer(s,'x'+a.id+'x').kind,'not-found');
});
test('follow-up arrival questions use context and latest withdrawal skips deposits',()=>{
  const s=E.initial(),t=E.wire(s,10000,bank);E.deposit(s,'USD',1);
  assert.equal(E.supportAnswer(s,'When will it arrive?',t.id).transactionId,t.id);
  assert.equal(E.supportAnswer(s,'My latest withdrawal?').transactionId,t.id);
  assert.equal(E.supportAnswer(s,'hello',t.id).kind,'help');
});
test('canceled or manually completed wires are reported with current status',()=>{
  const s=E.initial(),t=E.wire(s,10000,bank);E.cancel(s,t.id);
  assert.match(E.supportAnswer(s,t.id).text,/Status: Canceled/);
  assert.match(E.supportAnswer(s,t.id).text,/no arrival is expected/);
  assert.doesNotMatch(E.supportAnswer(s,t.id).text,/Estimated arrival:/);
  const completed=E.wire(s,20000,bank);completed.status='Completed';
  assert.match(E.supportAnswer(s,completed.id).text,/manually marked completed/);
});
test('saved transaction estimates and chat survive reload without changing the balance',()=>{
  const s=E.initial(),t=E.wire(s,10000,bank),before=s.cashCents;
  s.supportChat.push({role:'assistant',...E.supportAnswer(s,t.id)});s.supportContextId=t.id;
  const loaded=E.load(JSON.stringify(s));
  assert.equal(loaded.cashCents,before);assert.equal(loaded.supportContextId,t.id);
  assert.equal(E.supportAnswer(loaded,'What is the arrival date?',loaded.supportContextId).transactionId,t.id);
});
test('hash lookup stays separate from funding reference and AA account ID',()=>{
  const s=E.initial(),t=E.deposit(s,'ETH',1);t.hash='0x'+'a1'.repeat(32);
  assert.equal(E.supportAnswer(s,t.hash).transactionId,t.id);
  assert.match(E.supportAnswer(s,t.id).text,/Funding transaction: FT/);
});
test('missing history or a new account returns a useful response without fabricating a wire',()=>{
  const s=E.initial();s.activity=[];
  assert.equal(E.supportAnswer(s,'latest withdrawal').kind,'not-found');
  assert.match(E.supportAnswer(s,s.profile.publicId).text,/no withdrawals yet/);
});
