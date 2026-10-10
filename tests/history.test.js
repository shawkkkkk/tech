const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require(require('node:fs').existsSync(require('node:path').join(__dirname,'../dist/engine.js'))?'../dist/engine.js':'../engine.js');
const {harness}=require('./dom-harness');

test('portfolio deposit and all historical funding entries have FT plus 17 digits',()=>{
 const s=E.initial();assert.equal(s.activity.length,21);assert.equal(s.cashCents,6500000);
 assert.equal(s.activity[0].description,'USD deposit');assert.equal(s.activity[0].quantity,65000);
 for(const t of s.activity.filter(t=>t.type!=='Trade'))assert.match(t.id,/^FT\d{17}$/);
 assert.equal(new Set(s.activity.map(t=>t.id)).size,21);
 assert.ok(s.activity.every(t=>t.publicAccountId===s.profile.publicId));
});
test('screenshot history preserves failures, dates, repeated deposits and unusual precision',()=>{
 const rows=E.initial().activity.filter(t=>t.sourceScreenshot);assert.equal(rows.length,20);
 assert.deepEqual(rows.filter(t=>t.status==='Failed').map(t=>t.displayAmount),['+$96.00','+$336.62','+$432.87','+$721.62']);
 assert.equal(rows.filter(t=>t.dateOnly==='2026-10-08').length,15);
 assert.equal(rows.filter(t=>t.dateOnly==='2026-10-07').length,3);
 assert.equal(rows.filter(t=>t.dateOnly==='2026-10-05').length,2);
 const deposits=rows.filter(t=>t.title==='Deposited USDC');assert.equal(deposits.length,2);
 assert.equal(deposits[0].displayQuantity,'+100.00 USDC');assert.notEqual(deposits[0].id,deposits[1].id);
 assert.equal(rows[3].displayAmount,'200.00 USDC');assert.equal(rows[3].displayQuantity,'+0.07904 ETH');
 assert.equal(rows[15].displayAmount,'$3,089.51');assert.equal(rows[15].displayQuantity,'-3,090.0075 USDC');
 assert.equal(rows[19].displayAmount,'$7.94');assert.equal(rows[19].displayQuantity,'-27.94 USDC');
});
test('existing saved opening record migrates once while preserving balances, FT withdrawals and chat links',()=>{
 const s=E.initial();s.activity=s.activity.filter(t=>t.initialFunding);delete s.historyRevision;
 s.activity[0].id='OPENING-BALANCE';s.activity[0].description='Opening USD balance';
 s.supportContextId='OPENING-BALANCE';s.supportChat=[{role:'assistant',transactionId:'OPENING-BALANCE',text:'Old opening record'}];
 const bank={name:'Recipient',bank:'Sample Bank',account:'000001043',routing:'021000021'};
 const w=E.wire(s,100000,bank),before=s.cashCents,oldDate=s.activity[1].date;
 const migrated=E.load(JSON.stringify(s));assert.equal(migrated.cashCents,before);assert.equal(migrated.activity[0].id,w.id);
 const deposit=migrated.activity.find(t=>t.initialFunding);assert.match(deposit.id,/^FT\d{17}$/);assert.equal(deposit.date,oldDate);
 assert.equal(migrated.supportContextId,deposit.id);assert.equal(migrated.supportChat[0].transactionId,deposit.id);
 const again=E.load(JSON.stringify(migrated));assert.equal(again.activity.filter(t=>t.sourceScreenshot).length,20);
 assert.equal(again.cashCents,before);assert.equal(again.activity.find(t=>t.initialFunding).id,deposit.id);
});
test('all historical rows are clickable with correct snapshot details and usable funding lookup',()=>{
 const h=harness();h.click('[data-route="activity"]');
 const initial=h.state().activity[0];h.click('[data-action="transaction"][data-id="'+initial.id+'"]');
 assert.match(h.$('#modalBody').textContent,/Funding transaction ID \(FT\)/);assert.ok(h.$('#modalBody').textContent.includes(initial.id));
 assert.doesNotMatch(h.$('#modalBody').textContent,/OPENING-BALANCE/);h.click('#modalClose');
 for(const t of h.state().activity.filter(t=>t.sourceScreenshot)){
  h.click('[data-action="clear-filters"]');let found=h.doc.querySelector('[data-action="transaction"][data-id="'+t.id+'"]');
  for(let i=0;!found&&i<2;i++){h.click('[data-action="next-page"]');found=h.doc.querySelector('[data-action="transaction"][data-id="'+t.id+'"]');}
  assert.ok(found,t.title);assert.ok(found.textContent.includes(t.displayAmount));
  if(t.displayQuantity)assert.ok(found.textContent.includes(t.displayQuantity));
  found.click();assert.ok(h.$('#modalBody').textContent.includes(t.title));assert.ok(h.$('#modalBody').textContent.includes(t.displayAmount));
  assert.doesNotMatch(h.$('#modalBody').textContent,/NaN|undefined/);h.click('#modalClose');
 }
});
test('pending wire amount label reads Processing and support still looks up its FT',()=>{
 const h=harness();h.click('#withdrawBtn');h.click('#fundAssets [data-symbol="USD"]');h.click('#standardSpeed');h.click('[data-method="Wire"]');h.click('[data-amount="1000"]');h.click('#withdrawReview');h.click('#confirmWithdraw');
 const t=h.state().activity[0];assert.match(t.id,/^FT\d{17}$/);h.click('#modalClose');h.click('[data-route="activity"]');
 const row=h.$('[data-action="transaction"][data-id="'+t.id+'"]');assert.match(row.textContent,/Pending/);assert.equal(row.querySelector('.transaction-amount small').textContent,'Processing');
 row.click();h.click('[data-action="ask-support"]');assert.ok(h.$('#supportLog').textContent.includes(t.id));assert.match(h.$('#supportLog').textContent,/Wednesday, October 14, 2026/);
});
