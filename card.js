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
        return {block, base, state, title, filename, frames: valid ? frames : 0, size: view.getUint32(dir + 4, true)};
      });
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
