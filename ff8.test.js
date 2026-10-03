'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Card=require('./card.js'),F=require('./ff8.js');
const source=fs.readFileSync(path.join(__dirname,'../card1.mcd'));
const fresh=()=>new Card(source);
assert.equal(F.ITEMS.length,199);assert.equal(F.MAGIC.length,57);assert.equal(F.ABILITIES.length,116);assert.equal(F.CARDS.length,110);
for(const [block,expected] of [[1,0xa784],[2,0xa024]]) {
  const card=fresh(),slot=card.slots()[block-1],save=new F.FF8Save(card,slot);
  assert.equal(F.FF8Save.inspect(card,slot).supported,true);
  assert.deepEqual(save.checksums(),{calculated:expected,first:expected,second:expected,valid:true});
  assert.equal(save.name(0x198),'Squall');assert.equal(save.level(0),7);assert.equal(save.get(0xc8c,4),5000);
  save.finalize();assert.deepEqual(card.bytes,new Uint8Array(source),'unchanged save must round-trip byte-for-byte');
  save.setLevel(0,100);save.setLevel(save.leader(),100);save.setCharacter(0,9,1,6);save.setCharacter(save.leader(),0,2,9999);
  save.setGil(123456);save.setGil(654321,true);save.setTime(1234);
  save.setItem(197,198,100);save.setMagic(0,31,19,100);save.setCharacter(0,0x90,2,123);
  save.bit(save.gf(15)+0x11,0,true);save.put(save.gf(15)+12,4,99000);save.bit(save.gf(15)+0x14+10,1,true);
  save.bit(0x14ce+4,0,true);save.bit(0xc78,31,true,4);
  save.finalize();assert.equal(save.checksums().valid,true);
  assert.equal(save.level(0),100);assert.equal(save.get(0x194),100);assert.equal(save.get(0x186,2),9999);
  assert.equal(save.get(0x18c,4),123456);assert.equal(save.get(0xf28,4),123456);assert.equal(save.get(0xf2c,4),654321);
  assert.equal(save.get(0x190,4),1234);assert.equal(save.get(0xefc,2),123);
  assert.equal(save.get(0xe4e),198);assert.equal(save.get(0xe4f),100);assert.equal(save.get(0x65f),100);
  const roundtrip=new Card(card.bytes),reopened=new F.FF8Save(roundtrip,roundtrip.slots()[block-1]);
  assert.equal(reopened.level(0),100);assert.equal(reopened.checksums().valid,true);
  assert.deepEqual(card.bytes.slice(0,block*8192),new Uint8Array(source.slice(0,block*8192)));
  assert.deepEqual(card.bytes.slice((block+1)*8192),new Uint8Array(source.slice((block+1)*8192)));
  assert.deepEqual(card.bytes.slice(slot.base,slot.base+0x180),new Uint8Array(source.slice(slot.base,slot.base+0x180)),'PS1 title, palette and icons must be preserved');
  assert.deepEqual(card.bytes.slice(slot.base+0x1522,slot.base+8192),new Uint8Array(source.slice(slot.base+0x1522,slot.base+8192)),'unused and unknown tail must be preserved');
}
const card=fresh(),slot=card.slots()[0],save=new F.FF8Save(card,slot);
assert.throws(()=>save.setLevel(0,101));assert.throws(()=>save.setItem(198,1,1));assert.throws(()=>save.setItem(0,199,1));assert.throws(()=>save.setMagic(0,0,57,1));
assert.throws(()=>save.put(0x180,2,1));assert.throws(()=>save.put(0x1520,2,1));assert.throws(()=>save.put(0x190,4,0x100000000));
assert.throws(()=>save.setParty(0,3));save.bit(save.character(3)+0x94,0,true);save.setParty(0,3);assert.equal(save.get(0xeb8),3);assert.equal(save.get(0x195),3);
assert.throws(()=>save.setParty(2,3));assert.throws(()=>save.setParty(1,3));
save.setMagic(0,0,1,100);assert.throws(()=>save.setMagic(0,1,1,100));save.put(save.character(0)+0x5c,1,1);assert.throws(()=>save.setMagic(0,0,2,100));
save.setName(0x198,'Squall 123');assert.equal(save.name(0x198),'Squall 123');assert.equal(save.get(0x198+8),0x23);
save.setName(0x198,'A[80]1');assert.equal(save.name(0x198),'A[80]1');assert.throws(()=>save.setName(0x198,'ABCDEFGHIJKL'));
save.patch(0xfe1,'12 34');assert.equal(save.get(0xfe1),0x12);assert.throws(()=>save.patch(0x184,'GG'));assert.throws(()=>save.patch(0x151f,'AA BB'));save.finalize();assert.equal(save.checksums().valid,true);
const deleted=fresh();deleted.bytes[128]=0xa1;assert.equal(F.FF8Save.inspect(deleted,deleted.slots()[0]).supported,false);
const multi=fresh();multi.bytes[128+8]=0;multi.bytes[128+9]=0;assert.equal(F.FF8Save.inspect(multi,multi.slots()[0]).supported,false);
const other=fresh();other.bytes[slot.base+0xee0]=0;assert.equal(F.FF8Save.inspect(other,other.slots()[0]).supported,false);
const bad=fresh();bad.bytes[slot.base+0x180]^=1;assert.equal(F.FF8Save.inspect(bad,bad.slots()[0]).checksum.valid,false);
const repaired=new F.FF8Save(bad,bad.slots()[0]);repaired.finalize();assert.equal(repaired.checksums().valid,true);assert.deepEqual(bad.bytes,new Uint8Array(source));
// Every reference edits only progress, optional disc/preview, and checksums.
assert.deepEqual([...new Set(F.STORY_REFERENCES.map(r=>r.disc))],[1,2,3,4]);
assert.equal(new Set(F.STORY_REFERENCES.map(r=>r.progress)).size,F.STORY_REFERENCES.length);
for(const block of [1,2])for(const reference of F.STORY_REFERENCES)for(const updateDisc of [false,true]) {
  const card=fresh(),slot=card.slots()[block-1],save=new F.FF8Save(card,slot),before=card.bytes.slice();
  const oldDisc=save.get(0xfac),oldPreview=save.get(0x1c8,4);
  save.setStoryReference(reference.progress,updateDisc);save.finalize();
  assert.equal(save.get(0xfe0,2),reference.progress);
  assert.equal(save.get(0xfac),updateDisc?reference.disc:oldDisc);
  assert.equal(save.get(0x1c8,4),updateDisc?reference.disc-1:oldPreview);
  assert.equal(save.checksums().valid,true);
  const allowed=new Set([0x180,0x181,0x1520,0x1521,0xfe0,0xfe1,...(updateDisc?[0xfac,0x1c8,0x1c9,0x1ca,0x1cb]:[])].map(o=>slot.base+o));
  for(let i=0;i<before.length;i++)if(!allowed.has(i))assert.equal(card.bytes[i],before[i],`unexpected edit at ${i.toString(16)}`);
}
{
  const card=fresh(),save=new F.FF8Save(card,card.slots()[0]),before=card.bytes.slice();
  assert.throws(()=>save.setStoryReference(65535));assert.deepEqual(card.bytes,before);
}
const corrupted=fresh(),f=new F.FF8Save(corrupted,corrupted.slots()[0]);f.patch(0xee0,'00');assert.throws(()=>f.finalize());
assert.deepEqual(fs.readFileSync(path.join(__dirname,'../card1.mcd')),source);
console.log('OK: real FF8 saves in both blocks, CRC, levels/EXP, weapons, magic, inventory, GFs, preview copies, limits, round-trip and data preservation.');
