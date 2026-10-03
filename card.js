(function (root) {
  'use strict';
  class MemoryCard {
    constructor(bytes) {
      if (bytes.length !== 131072 || bytes[0] !== 77 || bytes[1] !== 67)
        throw new Error('A raw 128 KiB memory card with the MC signature is required (.mcd/.mcr).');
      this.bytes = new Uint8Array(bytes);
    }
    slots() {
      const view = new DataView(this.bytes.buffer);
      return Array.from({length: 15}, (_, n) => {
        const block = n + 1, dir = block * 128, base = block * 8192;
        const state = view.getUint32(dir, true);
        const first = state === 0x51 || state === 0xa1;
        const frames = this.bytes[base + 2] - 0x10;
        const valid = first && this.bytes[base] === 83 && this.bytes[base + 1] === 67 && frames >= 1 && frames <= 3;
        const raw = this.bytes.slice(base + 4, base + 68);
        let title = '';
        if (first) {
          try { title = new TextDecoder('shift_jis').decode(raw).split('\0')[0]; }
          catch { title = 'Unable to decode title'; }
        }
        const filename = String.fromCharCode(...this.bytes.slice(dir + 10, dir + 30)).split('\0')[0];
        return {block, base, state, title, filename, frames: valid ? frames : 0, size: view.getUint32(dir + 4, true), next: view.getUint16(dir + 8, true)};
      });
    }
    freeBlocks() { return this.slots().filter(s => [0xa0,0xa1,0xa2,0xa3].includes(s.state)).map(s => s.block); }
    directoryChecksum(block) {
      const start=block*128; let checksum=0;
      for(let i=0;i<127;i++) checksum^=this.bytes[start+i];
      return checksum;
    }
    chain(block) {
      const slots=this.slots(),first=slots[block-1];
      if(!first || first.state!==0x51) throw new Error('Select an active save to copy or delete.');
      const count=first.size/8192;
      if(!Number.isInteger(count) || count<1 || count>15) throw new Error('Invalid save size.');
      const chain=[],seen=new Set(); let current=first;
      for(let i=0;i<count;i++) {
        const state=i===0?0x51:i===count-1?0x53:0x52;
        if(!current || seen.has(current.block) || current.state!==state) throw new Error('Invalid or broken save block chain.');
        if(this.directoryChecksum(current.block)!==this.bytes[current.block*128+127]) throw new Error('Invalid memory card directory checksum.');
        chain.push(current);seen.add(current.block);
        if(i===count-1) {
          if(current.next!==0xffff) throw new Error('Save block chain does not end correctly.');
        } else current=slots[current.next];
      }
      if(slots.some(s=>[0x51,0x52,0x53].includes(s.state) && !seen.has(s.block) && seen.has(s.next+1))) throw new Error('Save blocks are shared by another directory entry.');
      return chain;
    }
    owner(block) {
      const slots=this.slots(),selected=slots[block-1];
      if(!selected) return null;
      if([0x51,0xa1].includes(selected.state)) return selected;
      for(const first of slots.filter(s=>s.state===0x51)) {
        try { if(this.chain(first.block).some(s=>s.block===block)) return first; } catch {}
      }
      return null;
    }
    copySave(block) {
      const chain=this.chain(block),first=chain[0];
      if(!first.filename) throw new Error('The save has no filename.');
      return {filename:first.filename,title:first.title,entries:chain.map(s=>this.bytes.slice(s.block*128,s.block*128+128)),data:chain.map(s=>this.bytes.slice(s.base,s.base+8192))};
    }
    pasteSave(save,startBlock) {
      const count=save?.data?.length;
      if(!Number.isInteger(count) || count<1 || count>15 || save.entries?.length!==count || !save.filename || save.data.some(b=>!(b instanceof Uint8Array)||b.length!==8192) || save.entries.some(b=>!(b instanceof Uint8Array)||b.length!==128)) throw new Error('Invalid copied save.');
      const slots=this.slots();
      // Validate the live directory before allocating any space.
      const used=new Set();
      for(const first of slots.filter(s=>s.state===0x51)) for(const s of this.chain(first.block)) used.add(s.block);
      if(slots.some(s=>[0x52,0x53].includes(s.state)&&!used.has(s.block))) throw new Error('The card contains an orphaned save block.');
      if(slots.some(s=>s.state===0x51&&s.filename===save.filename)) throw new Error('This card already contains a save with the same filename. Paste into another card, or delete the existing save first.');
      const free=this.freeBlocks();
      if(!free.includes(startBlock)) throw new Error('Select a free block as the copy destination.');
      if(free.length<count) throw new Error(`This save needs ${count} free blocks; only ${free.length} are available.`);
      const blocks=[startBlock,...free.filter(b=>b!==startBlock)].slice(0,count),next=this.bytes.slice(),view=new DataView(next.buffer);
      blocks.forEach((block,i)=>{
        const dir=block*128;
        next.set(save.data[i],block*8192);next.set(save.entries[i],dir);
        view.setUint32(dir,i===0?0x51:i===count-1?0x53:0x52,true);
        if(i>0) next.fill(0,dir+4,dir+32);
        view.setUint16(dir+8,i===count-1?0xffff:blocks[i+1]-1,true);
        let checksum=0;for(let j=0;j<127;j++)checksum^=next[dir+j];next[dir+127]=checksum;
      });
      this.bytes=next;return blocks[0];
    }
    deleteSave(block) {
      const chain=this.chain(block);
      for(const s of chain) {
        new DataView(this.bytes.buffer).setUint32(s.block*128,s.state+0x50,true);
        this.bytes[s.block*128+127]=this.directoryChecksum(s.block);
      }
      return chain.length;
    }
    word(slot, index) {
      const offset = slot.base + 96 + index * 2;
      return this.bytes[offset] | this.bytes[offset + 1] << 8;
    }
    color(slot, index) {
      const w = this.word(slot, index);
      return [w & 31, w >> 5 & 31, w >> 10 & 31].map(v => Math.round(v * 255 / 31));
    }
    setColor(slot, index, rgb, transparent, stp) {
      const values = rgb.map(v => Math.round(v * 31 / 255));
      const word = transparent ? 0 : values[0] | values[1] << 5 | values[2] << 10 | (stp ? 0x8000 : 0);
      const offset = slot.base + 96 + index * 2;
      this.bytes[offset] = word & 255; this.bytes[offset + 1] = word >> 8;
    }
    pixel(slot, frame, x, y, value) {
      const offset = slot.base + 128 + frame * 128 + y * 8 + (x >> 1), shift = (x & 1) * 4;
      if (value !== undefined) this.bytes[offset] = (this.bytes[offset] & ~(15 << shift)) | ((value & 15) << shift);
      return this.bytes[offset] >> shift & 15;
    }
  }
  if (typeof module !== 'undefined') module.exports = MemoryCard;
  else root.MemoryCard = MemoryCard;
})(typeof globalThis !== 'undefined' ? globalThis : this);
