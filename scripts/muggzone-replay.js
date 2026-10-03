'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {ShadowLedger}=require('../lib/muggzone/ledger');
function replay(input) {
 const ledger=new ShadowLedger({dbPath:':memory:',channelId:input.channel_id,authorIds:input.author_ids,accountConcept:input.account_concept_usd ?? 300});
 try {return {evidence:input.evidence || 'offline_supplied_snapshots',receipts:input.snapshots.map(row=>ledger.ingestSnapshot(row)),final:ledger.status()};}
 finally {ledger.close();}
}
if(require.main===module) {
 const file=process.argv[2] || path.join(__dirname,'../fixtures/muggzone.synthetic.json');
 console.log(JSON.stringify(replay(JSON.parse(fs.readFileSync(file,'utf8'))),null,2));
}
module.exports={replay};
