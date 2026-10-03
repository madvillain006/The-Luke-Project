'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ShadowLedger } = require('../lib/muggzone/ledger');
const contract = {underlying:'SPY',expiration_date:'2026-10-09',strike:600,option_side:'CALL'};
const open = (c=contract) => ({action:'OPEN',contract:c,symbol:c.underlying,premium:1.25,stop:.8,targets:[{target_number:1,premium:2}]});
const message = (id,instructions,extra={}) => ({message_id:id,channel_id:'channel',author_id:'analyst',raw_text:JSON.stringify(instructions),timestamp_utc:'2026-10-05T13:30:00Z',...extra});
const snapshot = (messages,extra={}) => ({channel_id:'channel',observed_at:'2026-10-05T13:34:00Z',at_tail:true,history_complete:true,messages,...extra});
const normalizer = msg => ({status:'normalized',instructions:JSON.parse(msg.raw_text)});
function ledger(dbPath=':memory:') { return new ShadowLedger({dbPath,channelId:'channel',authorIds:['analyst'],normalize:normalizer}); }
function initialized(dbPath) {const db=ledger(dbPath);db.ingestSnapshot(snapshot([]));return db;}

test('first visible history is baseline, duplicate snapshot cannot replay it',()=>{
 const db=ledger();
 const row=message('old',[open()]);
 assert.equal(db.ingestSnapshot(snapshot([row])).baseline,1);
 assert.equal(db.ingestSnapshot(snapshot([row])).duplicates,1);
 assert.equal(db.status().trades.length,0);db.close();
});
test('catch-up that overscrolls the baseline cannot replay unseen older entries',()=>{
 const db=ledger(); const anchor=message('100',[open()],{timestamp_utc:'2026-10-05T13:20:00Z'});
 db.ingestSnapshot(snapshot([anchor]));
 const older=message('99',[open()],{timestamp_utc:'2026-10-05T13:10:00Z'});
 const newer=message('101',[open()],{timestamp_utc:'2026-10-05T13:30:00Z'});
 const receipt=db.ingestSnapshot(snapshot([older,anchor,newer]));
 assert.equal(receipt.baseline,1);assert.equal(receipt.accepted,1);assert.equal(receipt.duplicates,1);assert.equal(db.status().trades[0].opening_message_id,'101');db.close();
});
test('open, compound management and close persist exactly once across restart',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mugg-ledger-'));const file=path.join(dir,'shadow.sqlite');
 let db=initialized(file);
 const entry=message('entry',[open()]);
 assert.equal(db.ingestSnapshot(snapshot([entry])).accepted,1);
 db.close(); db=ledger(file);
 assert.equal(db.ingestSnapshot(snapshot([entry])).duplicates,1);
 const update=message('update',[{action:'TARGET_HIT',contract:null,target_number:1},{action:'TRIM',contract:null,fraction:.5},{action:'BREAKEVEN',contract:null}],{reply_to_message_id:'entry',timestamp_utc:'2026-10-05T13:31:00Z'});
 const receipt=db.ingestSnapshot(snapshot([update])); assert.equal(receipt.instructions.length,3);
 let trade=db.status().trades[0]; assert.equal(trade.state,'PARTIAL');assert.deepEqual(trade.targets_hit,[1]);assert.equal(trade.stop_premium,1.25);assert.deepEqual(trade.fills,[]);assert.equal(trade.one_standard_contract_gross_usd,125);
 const close=message('close',[{action:'CLOSE',contract:null}],{reply_to_message_id:'update',timestamp_utc:'2026-10-05T13:32:00Z'});
 assert.equal(db.ingestSnapshot(snapshot([close])).accepted,1);assert.equal(db.status().trades[0].state,'CLOSED');
 db.close();db=ledger(file);assert.equal(db.status().instruction_count,5);db.close();fs.rmSync(dir,{recursive:true});
});
test('multiple active contracts require a selector or reply, never latest-trade guessing',()=>{
 const db=initialized(); const other={...contract,strike:601};
 db.ingestSnapshot(snapshot([message('a',[open()]),message('b',[open(other)])]));
 const partial=message('specific',[{action:'TRIM',contract:null,contract_hint:{strike:601,option_side:'CALL'},fraction:null}]);
 assert.equal(db.ingestSnapshot(snapshot([partial])).accepted,1);
 assert.equal(db.status().trades.find(t=>t.contract.strike===601).trims[0].fraction,null);
 assert.equal(db.ingestSnapshot(snapshot([message('ambiguous',[{action:'TRIM',contract:null,fraction:null}])])).review,1);
 assert.equal(db.status().review_required,true);db.close();
});
test('reply and identity conflict cannot mutate a trade',()=>{
 const db=initialized();db.ingestSnapshot(snapshot([message('a',[open()])]));
 const bad=message('bad',[{action:'CLOSE',contract:{...contract,strike:601}}],{reply_to_message_id:'a'});
 assert.equal(db.ingestSnapshot(snapshot([bad])).review,1);assert.equal(db.status().trades[0].state,'OPEN');db.close();
});
test('edited accepted messages freeze affected state and never apply a second entry',()=>{
 const db=initialized();db.ingestSnapshot(snapshot([message('a',[open()])]));
 const edit=message('a',[{...open(),premium:1.5}],{edited_at:'2026-10-05T13:33:00Z'});
 assert.equal(db.ingestSnapshot(snapshot([edit])).review,1);assert.equal(db.status().trades.length,1);assert.equal(db.status().trades[0].state,'REVIEW');assert.equal(db.status().instruction_count,1);
 assert.equal(db.ingestSnapshot(snapshot([edit])).duplicates,1);db.close();
});
test('missed continuity halts later state instead of silently treating tail as complete',()=>{
 const db=initialized();
 assert.equal(db.ingestSnapshot(snapshot([message('gap',[open()])],{history_complete:false})).health.status,'halted');
 assert.equal(db.ingestSnapshot(snapshot([message('later',[open()])])).review,1);assert.equal(db.status().trades.length,0);db.close();
});
test('wrong channel, unapproved author and future timestamp cannot open trades',()=>{
 const db=initialized();assert.throws(()=>db.ingestSnapshot(snapshot([],{channel_id:'other'})),/wrong_channel/);
 assert.equal(db.ingestSnapshot(snapshot([message('bad-author',[open()],{author_id:'someone'})])).ignored,1);
 assert.equal(db.ingestSnapshot(snapshot([message('future',[open()],{timestamp_utc:'2026-10-05T15:00:00Z'})])).review,1);assert.equal(db.status().trades.length,0);db.close();
});
test('invalid later action makes whole compound bundle review without partial mutation',()=>{
 const db=initialized();const row=message('compound',[open(),{action:'TARGET_HIT',contract:null,target_number:9}]);
 assert.equal(db.ingestSnapshot(snapshot([row])).review,1);assert.equal(db.status().trades.length,0);assert.equal(db.status().instruction_count,0);db.close();
});
test('normalizer exception rolls back snapshot and revision for clean retry',()=>{
 const db=initialized();db.normalize=()=>{throw new Error('parser failure');};const row=message('retry',[open()]);
 assert.throws(()=>db.ingestSnapshot(snapshot([row])),/parser failure/);db.normalize=normalizer;
 assert.equal(db.ingestSnapshot(snapshot([row])).accepted,1);assert.equal(db.status().instruction_count,1);db.close();
});
test('database cannot silently switch channel or source-author allowlist',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mugg-binding-'));const file=path.join(dir,'shadow.sqlite');const db=initialized(file);db.close();
 assert.throws(()=>new ShadowLedger({dbPath:file,channelId:'channel',authorIds:['other'],normalize:normalizer}),/binding differs/);fs.rmSync(dir,{recursive:true});
});
test('source revision with changed author still freezes the accepted trade',()=>{
 const db=initialized();db.ingestSnapshot(snapshot([message('a',[open()])]));
 const receipt=db.ingestSnapshot(snapshot([message('a',[{...open(),premium:2}],{author_id:'other'})]));
 assert.equal(receipt.review,1);assert.equal(db.status().trades[0].state,'REVIEW');db.close();
});
test('an invalid envelope halts the snapshot before a valid row can apply',()=>{
 const db=initialized();const receipt=db.ingestSnapshot(snapshot([message('good',[open()]),message('wrong',[open()],{channel_id:'wrong'})]));
 assert.equal(receipt.accepted,0);assert.equal(receipt.health.status,'halted');assert.equal(db.status().trades.length,0);db.close();
});
test('trim 100% records a full announced exit without inventing contract fills',()=>{
 const db=initialized();db.ingestSnapshot(snapshot([message('a',[open()])]));
 db.ingestSnapshot(snapshot([message('trim',[{action:'TRIM',contract:null,fraction:1}])]));
 assert.equal(db.status().trades[0].state,'CLOSED');assert.deepEqual(db.status().trades[0].fills,[]);db.close();
});
test('an unresolved source instruction stays held across restart instead of silently resuming',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mugg-review-'));const file=path.join(dir,'shadow.sqlite');let db=initialized(file);
 assert.equal(db.ingestSnapshot(snapshot([message('orphan',[{action:'CLOSE',contract:null}])])).review,1);
 db.close();db=ledger(file);assert.equal(db.status().review_required,true);
 assert.equal(db.ingestSnapshot(snapshot([message('later',[open()])])).accepted,0);assert.equal(db.status().trades.length,0);
 db.close();fs.rmSync(dir,{recursive:true});
});
