'use strict';
const assert=require('node:assert/strict'),Card=require('./card.js');
function blank() {
  const bytes=new Uint8Array(131072);bytes[0]=77;bytes[1]=67;bytes[127]=14;
  const card=new Card(bytes),view=new DataView(card.bytes.buffer);
  for(let block=1;block<=15;block++) {
    view.setUint32(block*128,0xa0,true);view.setUint16(block*128+8,0xffff,true);
    card.bytes[block*128+127]=card.directoryChecksum(block);
  }
  return card;
}
function saveCard(blocks=[1,4,9]) {
  const card=blank(),view=new DataView(card.bytes.buffer);
  blocks.forEach((block,i)=>{
    const dir=block*128,base=block*8192;
    view.setUint32(dir,i===0?0x51:i===blocks.length-1?0x53:0x52,true);
    view.setUint16(dir+8,i===blocks.length-1?0xffff:blocks[i+1]-1,true);
    card.bytes.fill(30+i,base,base+8192);
    if(i===0) {
      view.setUint32(dir+4,blocks.length*8192,true);
      card.bytes.set(Buffer.from('BASLUS-12345TEST'),dir+10);
      card.bytes[base]=83;card.bytes[base+1]=67;card.bytes[base+2]=0x11;
      card.bytes.fill(0,base+4,base+68);card.bytes.set(Buffer.from('Test save'),base+4);
    }
    card.bytes[dir+127]=card.directoryChecksum(block);
  });
  return card;
}
const source=saveCard(),before=source.bytes.slice(),copy=source.copySave(1);
assert.deepEqual(source.bytes,before,'Copy must be read-only');
assert.deepEqual(source.chain(1).map(s=>s.block),[1,4,9]);assert.equal(source.owner(9).block,1);
source.bytes[8192+700]^=1;assert.equal(copy.data[0][700],before[8192+700],'Clipboard must be a snapshot');
const target=blank(),targetBefore=target.bytes.slice();
assert.equal(target.pasteSave(copy,7),7);
const chain=target.chain(7);assert.deepEqual(chain.map(s=>s.block),[7,1,2]);
assert.equal(chain[0].filename,copy.filename);assert.equal(chain[0].size,24576);
chain.forEach((s,i)=>{
  assert.deepEqual(target.bytes.slice(s.base,s.base+8192),copy.data[i]);
  assert.equal(target.bytes[s.block*128+127],target.directoryChecksum(s.block));
});
const affected=new Set(chain.map(s=>s.block));
for(let i=0;i<target.bytes.length;i++) {
  const directory=i>=128&&i<2048&&affected.has(Math.floor(i/128));
  const data=i>=8192&&affected.has(Math.floor(i/8192));
  if(!directory&&!data)assert.equal(target.bytes[i],targetBefore[i],`Unexpected write at ${i}`);
}
let snapshot=target.bytes.slice();assert.throws(()=>target.pasteSave(copy,3),/same filename/);assert.deepEqual(target.bytes,snapshot);
assert.equal(target.deleteSave(7),3);
assert.deepEqual([7,1,2].map(b=>target.slots()[b-1].state),[0xa1,0xa2,0xa3]);assert.equal(target.freeBlocks().length,15);
for(let i=2048;i<target.bytes.length;i++)assert.equal(target.bytes[i],snapshot[i],'Delete must preserve data and system sectors');
for(const block of [7,1,2])assert.equal(target.bytes[block*128+127],target.directoryChecksum(block));
assert.equal(target.pasteSave(copy,7),7,'Deleted blocks must be reusable');
const single=saveCard([5]),singleCopy=single.copySave(5),singleTarget=blank();singleTarget.pasteSave(singleCopy,15);
assert.deepEqual(singleTarget.chain(15).map(s=>s.block),[15]);singleTarget.deleteSave(15);assert.equal(singleTarget.slots()[14].state,0xa1);
for(const corrupt of [
  card=>{card.bytes[128+127]^=1;},
  card=>{new DataView(card.bytes.buffer).setUint16(4*128+8,0,true);card.bytes[4*128+127]=card.directoryChecksum(4);},
  card=>{new DataView(card.bytes.buffer).setUint16(9*128+8,10,true);card.bytes[9*128+127]=card.directoryChecksum(9);},
  card=>{new DataView(card.bytes.buffer).setUint32(128+4,8192,true);card.bytes[128+127]=card.directoryChecksum(1);}
]) {
  const bad=saveCard();corrupt(bad);snapshot=bad.bytes.slice();assert.throws(()=>bad.copySave(1));assert.throws(()=>bad.deleteSave(1));assert.deepEqual(bad.bytes,snapshot);
}
const full=blank(),fullView=new DataView(full.bytes.buffer);
for(let b=1;b<=14;b++){fullView.setUint32(b*128,0xdead,true);full.bytes[b*128+127]=full.directoryChecksum(b);}
snapshot=full.bytes.slice();assert.throws(()=>full.pasteSave(copy,15),/needs 3 free blocks/);assert.deepEqual(full.bytes,snapshot);
const occupied=saveCard([8]);snapshot=occupied.bytes.slice();assert.throws(()=>occupied.pasteSave(copy,8));assert.deepEqual(occupied.bytes,snapshot);
const orphan=blank();new DataView(orphan.bytes.buffer).setUint32(128,0x53,true);snapshot=orphan.bytes.slice();assert.throws(()=>orphan.pasteSave(copy,2),/orphaned/);assert.deepEqual(orphan.bytes,snapshot);
const shared=saveCard();new DataView(shared.bytes.buffer).setUint32(2*128,0x52,true);new DataView(shared.bytes.buffer).setUint16(2*128+8,3,true);shared.bytes[2*128+127]=shared.directoryChecksum(2);snapshot=shared.bytes.slice();assert.throws(()=>shared.deleteSave(1),/shared/);assert.deepEqual(shared.bytes,snapshot);
console.log('OK: single/multi-block copy, relocated chains, directory checksums, deletion, reuse, clipboard snapshots, preservation and atomic failures.');
