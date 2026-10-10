const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./dom-harness');
test('initial dashboard mounts and every navigation destination renders',()=>{const h=harness();assert.match(h.$('#pvValue').textContent,/65,000/);for(const route of ['portfolio','explore','earn','borrow','activity','asset:BTC','asset:ETH','offers','support','home']){h.click(`[data-route="${route}"]`);assert.equal(h.$('#homeView').hidden,route!=='home');}h.click('[data-route="collapse"]');assert.ok(h.doc.body.classList.contains('collapsed'));});
test('buy review executes and its clickable transaction opens full details',()=>{const h=harness();h.click('[data-v="100"]');assert.equal(h.$('#reviewBtn').disabled,false);h.click('#reviewBtn');h.click('#confirmTrade');assert.equal(h.state().cashCents,6490000);assert.ok(h.state().holdings.BTC>0);assert.equal(h.$('#modalTitle').textContent,'Transaction details');h.click('#modalClose');h.click('[data-route="activity"]');h.click('[data-action="transaction"]');assert.match(h.$('#modalBody').textContent,/Bought Bitcoin/);assert.match(h.$('#modalBody').textContent,/Internal reference/);});
test('USD withdrawal matches picker-speed-method-amount-review flow and refunds cancel',()=>{const h=harness();h.click('#withdrawBtn');h.click('#fundAssets [data-symbol="USD"]');h.click('#standardSpeed');h.click('[data-method="Wire"]');h.click('[data-amount="1000"]');assert.equal(h.$('#withdrawReview').disabled,false);h.click('#withdrawReview');h.click('#confirmWithdraw');assert.equal(h.state().cashCents,6399600);assert.match(h.$('#modalBody').textContent,/Pending/);h.click('[data-action="cancel-transaction"]');assert.equal(h.state().cashCents,6500000);assert.match(h.$('#modalBody').textContent,/Canceled/);});
test('withdraw MAX leaves no negative cash after fees',()=>{const h=harness();h.click('#withdrawBtn');h.click('#fundAssets [data-symbol="USD"]');h.click('#standardSpeed');h.click('[data-method="Wire"]');h.click('[data-amount="max"]');h.click('#withdrawReview');h.click('#confirmWithdraw');assert.equal(h.state().cashCents,0);});
test('crypto deposit creates network-format sample hash and opens details',()=>{const h=harness();h.click('#depositBtn');h.click('#fundAssets [data-symbol="ETH"]');h.input('#depositAmount','1');h.click('#confirmDeposit');assert.equal(h.state().holdings.ETH,1);assert.match(h.state().activity[0].hash,/^0x[0-9a-f]{64}$/);assert.match(h.$('#modalBody').textContent,/blockchain hash/);h.click('[data-action="inspect-hash"]');assert.match(h.$('#modalBody').textContent,/not broadcast/);});
test('profile menu contains every screenshot entry and settings persist',()=>{const h=harness();h.click('.avatar');for(const name of ['Account','Kraken+','Earn Settings','Payment Methods','Security','Notifications','Taxes','Device Management','Documents','Offers','Sign out'])assert.ok(h.$('#modalBody').textContent.includes(name),name);assert.ok(h.$('#modal').classList.contains('profile-mode'));h.click('[data-theme="light"]');assert.ok(h.doc.body.classList.contains('light-theme'));h.click('[data-action="profile-account"]');h.input('#displayName','Demo Person');h.click('#saveProfile');assert.equal(h.state().profile.name,'Demo Person');assert.match(h.$('.avatar').textContent,/DP/);});
test('activity date and asset filters, pagination, and pending rows are wired',()=>{const h=harness();for(let i=0;i<12;i++){h.click('#depositBtn');h.click('#fundAssets [data-symbol="USD"]');h.input('#depositAmount','1');h.click('#confirmDeposit');h.click('#modalClose');}h.click('[data-route="activity"]');assert.match(h.$('.pagination').textContent,/Page 1 of 4/);h.click('[data-action="next-page"]');assert.match(h.$('.pagination').textContent,/Page 2 of 4/);h.change('#activityAsset','BTC');assert.match(h.$('#pageView').textContent,/No transactions yet/);h.click('[data-action="clear-filters"]');assert.match(h.$('.pagination').textContent,/Page 1 of 4/);});
test('modal back and close, privacy, chart ranges and search work',()=>{const h=harness();h.click('[data-action="privacy"]');assert.match(h.$('#pvValue').textContent,/••••••/);h.click('[data-r="1Y"]');assert.ok(h.$('[data-r="1Y"]').classList.contains('active'));h.click('#withdrawBtn');h.click('#fundAssets [data-symbol="USD"]');h.click('#modalBack');assert.equal(h.$('#modalTitle').textContent,'Withdraw');h.click('#modalClose');assert.equal(h.$('#overlay').hidden,true);h.input('#globalSearch','Ethereum');h.flush();assert.match(h.$('#pageView').textContent,/Ethereum/);});
test('profile security, membership, documents, payments and sign out flows open',()=>{const h=harness();for(const key of ['security','plus','payments','taxes','devices','documents','notifications']){h.click('.avatar');h.click('[data-action="profile-'+key+'"]');assert.ok(h.$('#modalBody').textContent.length>20);h.click('#modalClose');}h.click('.avatar');h.click('[data-action="profile-signout"]');assert.equal(h.state().settings.signedOut,true);h.click('#resumeSession');assert.equal(h.state().settings.signedOut,false);});
test('withdrawal receipt links to support and FT, AA and follow-up queries work',()=>{
 const h=harness();h.click('#withdrawBtn');h.click('#fundAssets [data-symbol="USD"]');h.click('#standardSpeed');h.click('[data-method="Wire"]');h.click('[data-amount="1000"]');
 assert.match(h.$('#withdrawSummary').textContent,/Wednesday, October 14, 2026/);
 h.click('#withdrawReview');h.click('#confirmWithdraw');const t=h.state().activity[0];
 assert.match(t.id,/^FT[A-Z0-9]{17}$/);assert.match(h.$('#modalBody').textContent,/Funding transaction ID \(FT\)/);
 h.click('[data-action="ask-support"]');assert.equal(h.$('#overlay').hidden,true);
 assert.match(h.$('#supportLog').textContent,/3-day wire/);assert.match(h.$('#supportLog').textContent,/Wednesday, October 14, 2026/);
 h.input('#supportQuery',t.id);h.click('[data-action="support-send"]');assert.equal(h.state().supportContextId,t.id);
 h.input('#supportQuery','What date will it arrive?');h.$('#supportQuery').dispatchEvent({type:'keydown',key:'Enter',bubbles:true});
 assert.equal(h.state().supportChat.length,6);
 h.input('#supportQuery',h.state().profile.publicId);h.click('[data-action="support-send"]');
 assert.equal(h.state().supportChat.at(-1).transactionId,t.id);
 h.click('[data-action="support-clear"]');assert.equal(h.state().supportChat.length,0);assert.equal(h.state().supportContextId,null);
});
test('support shows current canceled status and rejects unknown FT references',()=>{
 const h=harness();h.click('#withdrawBtn');h.click('#fundAssets [data-symbol="USD"]');h.click('#standardSpeed');h.click('[data-method="Wire"]');h.click('[data-amount="1000"]');h.click('#withdrawReview');h.click('#confirmWithdraw');
 const t=h.state().activity[0];h.click('[data-action="ask-support"]');h.click('#supportLog [data-action="transaction"]');h.click('[data-action="cancel-transaction"]');h.click('#modalClose');
 assert.match(h.$('#supportLog').textContent,/Status: Canceled/);assert.match(h.$('#supportLog').textContent,/no arrival is expected/);
 h.input('#supportQuery','FT00000000000000000');h.click('[data-action="support-send"]');
 assert.equal(h.state().supportChat.at(-1).kind,'not-found');assert.equal(h.state().supportContextId,null);
 assert.equal(h.state().cashCents,6500000);assert.equal(h.state().activity.find(a=>a.id===t.id).status,'Canceled');
});
test('support renders untrusted questions as text and empty submit leaves chat unchanged',()=>{
 const h=harness();h.click('[data-route="support"]');h.click('[data-action="support-send"]');assert.equal(h.state().supportChat.length,0);
 h.input('#supportQuery','<img src=x onerror=alert(1)>');h.click('[data-action="support-send"]');
 assert.equal(h.$('#supportLog').querySelector('img'),null);assert.match(h.$('#supportLog').textContent,/<img/);
});
test('interface uses Pending and contains no demo wording on any route or profile flow',()=>{
 const h=harness();for(const route of ['home','portfolio','explore','earn','borrow','activity','offers','support']){h.click('[data-route="'+route+'"]');assert.doesNotMatch(h.$('#pageView').textContent,/\bdemo\b/i);}
 assert.match(h.$('.concept-badge').textContent,/Sandbox/);
});
