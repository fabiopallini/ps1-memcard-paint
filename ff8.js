/* PS1 FF8 save layout verified against card1.mcd, FF8/GameSaveFormat and
   Hyne's packed format documentation. Independent JavaScript implementation.
   Offsets below are relative to the start of the 8192-byte save block. */
(function(root) {
  'use strict';
  const CHARACTERS = ['Squall','Zell','Irvine','Quistis','Rinoa','Selphie','Seifer','Edea'];
  const GFS = ['Quetzalcoatl','Shiva','Ifrit','Siren','Brothers','Diablos','Carbuncle','Leviathan','Pandemona','Cerberus','Alexander','Doomtrain','Bahamut','Cactuar','Tonberry','Eden'];
  const CARDS = 'Geezard|Funguar|Bite Bug|Red Bat|Blobra|Gayla|Gesper|Fastitocalon|Blood Soul|Caterchipillar|Cockatrice|Grat|Buel|Mesmerize|Glacial Eye|Belhelmel|Thrustaevis|Anacondaur|Creeps|Grendel|Jelleye|Grand Mantis|Forbidden|Armadodo|Tri-Face|Fastitocalon-F|Snow Lion|Ochu|SAM08G|Death Claw|Cactuar|Tonberry|Abyss Worm|Turtapod|Vysage|T-Rexaur|Bomb|Blitz|Wendigo|Torama|Imp|Blue Dragon|Adamantoise|Hexadragon|Iron Giant|Behemoth|Chimera|PuPu|Elastoid|GIM47N|Malboro|Ruby Dragon|Elnoyle|Tonberry King|Wedge, Biggs|Fujin, Raijin|Elvoret|X-ATM092|Granaldo|Gerogero|Iguion|Abadon|Trauma|Oilboyle|Shumi|Krysta|Propagator|Jumbo Cactuar|Tri-Point|Gargantua|Mobile Type 8|Sphinxara|Tiamat|BGH251F2|Red Giant|Catoblepas|Ultima Weapon|Chubby Chocobo|Angelo|Gilgamesh|MiniMog|Chicobo|Quetzalcoatl|Shiva|Ifrit|Siren|Sacred|Minotaur|Carbuncle|Diablos|Leviathan|Odin|Pandemona|Cerberus|Alexander|Phoenix|Bahamut|Doomtrain|Eden|Ward|Kiros|Laguna|Selphie|Quistis|Irvine|Zell|Rinoa|Edea|Seifer|Squall'.split('|');
  const WEAPONS = 'Revolver|Shear Trigger|Cutting Trigger|Flame Saber|Twin Lance|Punishment|Lion Heart|Metal Knuckle|Maverick|Gauntlet|Ehrgeiz|Valiant|Ulysses|Bismarck|Exeter|Chain Whip|Slaying Tail|Red Scorpion|Save the Queen|Pinwheel|Valkyrie|Rising Sun|Cardinal|Shooting Star|Flail|Morning Star|Crescent Wish|Strange Vision|Hyperion|None|Machine Gun|Katal|Harpoon'.split('|');
  const MAGIC = 'None|Fire|Fira|Firaga|Blizzard|Blizzara|Blizzaga|Thunder|Thundara|Thundaga|Water|Aero|Bio|Demi|Holy|Flare|Meteor|Quake|Tornado|Ultima|Apocalypse|Cure|Cura|Curaga|Life|Full-life|Regen|Esuna|Dispel|Protect|Shell|Reflect|Aura|Double|Triple|Haste|Slow|Stop|Blind|Confuse|Sleep|Silence|Break|Death|Drain|Pain|Berserk|Float|Zombie|Meltdown|Scan|Full-cure|Wall|Rapture|Percent|Catastrophe|The End'.split('|');
  // Item IDs are game data, not inventory positions. All 198 inventory positions are editable.
  const ITEMS = 'Empty|Potion|Potion+|Hi-Potion|Hi-Potion+|X-Potion|Mega-Potion|Phoenix Down|Mega Phoenix|Elixir|Megalixir|Antidote|Soft|Eye Drops|Echo Screen|Holy Water|Remedy|Remedy+|Hero-trial|Hero|Holy War-trial|Holy War|Shell Stone|Protect Stone|Aura Stone|Death Stone|Holy Stone|Flare Stone|Meteor Stone|Ultima Stone|Gysahl Greens|Phoenix Pinion|Friendship|Tent|Pet House|Cottage|G-Potion|G-Hi-Potion|G-Mega-Potion|G-Returner|Rename Card|Amnesia Greens|HP-J Scroll|Str-J Scroll|Vit-J Scroll|Mag-J Scroll|Spr-J Scroll|Spd-J Scroll|Luck-J Scroll|Aegis Amulet|Elem Atk|Elem Guard|Status Atk|Status Guard|Rosetta Stone|Magic Scroll|GF Scroll|Draw Scroll|Item Scroll|Gambler Spirit|Healing Ring|Phoenix Spirit|Med Kit|Bomb Spirit|Hungry Cookpot|Mog’s Amulet|Steel Pipe|Star Fragment|Energy Crystal|Samantha Soul|Healing Mail|Silver Mail|Gold Armor|Diamond Armor|Regen Ring|Giant’s Ring|Gaea’s Ring|Strength Love|Power Wrist|Hyper Wrist|Turtle Shell|Orihalcon|Adamantine|Rune Armlet|Force Armlet|Magic Armlet|Circlet|Hypno Crown|Royal Crown|Jet Engine|Rocket Engine|Moon Curtain|Steel Curtain|Glow Curtain|Accelerator|Monk’s Code|Knight’s Code|Doc’s Code|Hundred Needles|Three Stars|Ribbon|Normal Ammo|Shotgun Ammo|Dark Ammo|Fire Ammo|Demolition Ammo|Fast Ammo|AP Ammo|Pulse Ammo|M-Stone Piece|Magic Stone|Wizard Stone|Ochu Tentacle|Healing Water|Cockatrice Pinion|Zombie Powder|Lightweight|Sharp Spike|Screw|Saw Blade|Mesmerize Blade|Vampire Fang|Fury Fragment|Betrayal Sword|Sleep Powder|Life Ring|Dragon Fang|Spider Web|Coral Fragment|Curse Spike|Black Hole|Water Crystal|Missile|Mystery Fluid|Running Fire|Inferno Fang|Malboro Tentacle|Whisper|Laser Cannon|Barrier|Power Generator|Dark Matter|Bomb Fragment|Red Fang|Arctic Wind|North Wind|Dynamo Stone|Shear Feather|Venom Fang|Steel Orb|Moon Stone|Dino Bone|Windmill|Dragon Skin|Fish Fin|Dragon Fin|Silence Powder|Poison Powder|Dead Spirit|Chef’s Knife|Cactus Thorn|Shaman Stone|Fuel|Girl Next Door|Sorceress’ Letter|Chocobo’s Tag|Pet Nametag|Solomon Ring|Magical Lamp|HP Up|Str Up|Vit Up|Mag Up|Spr Up|Spd Up|Luck Up|LuvLuv G|Weapons Mon 1st|Weapons Mon Mar|Weapons Mon Apr|Weapons Mon May|Weapons Mon Jun|Weapons Mon Jul|Weapons Mon Aug|Combat King 001|Combat King 002|Combat King 003|Combat King 004|Combat King 005|Pet Pals Vol.1|Pet Pals Vol.2|Pet Pals Vol.3|Pet Pals Vol.4|Pet Pals Vol.5|Pet Pals Vol.6|Occult Fan I|Occult Fan II|Occult Fan III|Occult Fan IV'.split('|');
  const ABILITIES = 'None|HP-J|Str-J|Vit-J|Mag-J|Spr-J|Spd-J|Eva-J|Hit-J|Luck-J|Elem-Atk-J|ST-Atk-J|Elem-Def-J|ST-Def-J|Elem-Defx2|Elem-Defx4|ST-Def-Jx2|ST-Def-Jx4|Abilityx3|Abilityx4|Magic|GF|Draw|Item|???|Card|Doom|Mad Rush|Treatment|Defend|Darkside|Recover|Absorb|Revive|LV Down|LV Up|Kamikaze|Devour|MiniMog|HP+20%|HP+40%|HP+80%|Str+20%|Str+40%|Str+60%|Vit+20%|Vit+40%|Vit+60%|Mag+20%|Mag+40%|Mag+60%|Spr+20%|Spr+40%|Spr+60%|Spd+20%|Spd+40%|Eva+30%|Luck+50%|Mug|Med Data|Counter|Return Damage|Cover|Initiative|Move-HP Up|HP Bonus|Str Bonus|Vit Bonus|Mag Bonus|Spr Bonus|Auto-Protect|Auto-Shell|Auto-Reflect|Auto-Haste|Auto-Potion|Expendx2-1|Expendx3-1|Ribbon|Alert|Move-Find|Enc-Half|Enc-None|Rare Item|SumMag+10%|SumMag+20%|SumMag+30%|SumMag+40%|GFHP+10%|GFHP+20%|GFHP+30%|GFHP+40%|Boost|Haggle|Sell-High|Familiar|Call Shop|Junk Shop|T Mag-RF|I Mag-RF|F Mag-RF|L Mag-RF|Time Mag-RF|ST Mag-RF|Supt Mag-RF|Forbid Mag-RF|Recov Med-RF|ST Med-RF|Ammo-RF|Tool-RF|Forbid Med-RF|GFRecov Med-RF|GFAbl Med-RF|Mid Mag-RF|High Mag-RF|Med LV Up|Card Mod'.split('|');
  const CRC_TABLE = new Uint16Array(256);
  for (let i=0;i<255;i++) {
    let word = i << 8;
    for (let bit=0;bit<8;bit++) word = ((word << 1) ^ (word & 0x8000 ? 0x1021 : 0)) & 65535;
    CRC_TABLE[i] = word;
  }
  function integer(value, min, max) {
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Enter an integer between ${min} and ${max}.`);
    return value;
  }
  class FF8Save {
    static inspect(card, slot) {
      if (!slot) return {supported:false,reason:'Select a save.'};
      const base = slot.base, b = card.bytes;
      if (b[base+0x182] !== 0xff || b[base+0x183] !== 8 || String.fromCharCode(...b.slice(base+0xee0,base+0xee4)) !== 'FF-8')
        return {supported:false,reason:'Game editing is available for Final Fantasy VIII PS1.'};
      const view = new DataView(b.buffer,b.byteOffset,b.byteLength), dir = slot.block*128;
      if (view.getUint32(dir,true) !== 0x51 || view.getUint32(dir+4,true) !== 8192 || view.getUint16(dir+8,true) !== 65535 || b[base] !== 83 || b[base+1] !== 67 || ![0x11,0x12].includes(b[base+2]) || b[base+3] !== 1)
        return {supported:false,reason:'FF8 detected, but the block is deleted or its structure is unsupported.'};
      const save = new FF8Save(card,slot), checksum = save.checksums();
      return {supported:true,checksum,reason:checksum.valid ? 'Final Fantasy VIII · valid checksums' : 'Final Fantasy VIII · invalid checksums'};
    }
    constructor(card,slot) { this.card=card; this.base=slot.base; this.block=slot.block; this.japanese=card.bytes[slot.block*128+11]===73; }
    view() { const b=this.card.bytes; return new DataView(b.buffer,b.byteOffset,b.byteLength); }
    get(offset,size=1) {
      integer(offset,0,8192-size);
      const v=this.view();
      if (size===1) return v.getUint8(this.base+offset);
      if (size===2) return v.getUint16(this.base+offset,true);
      if (size===4) return v.getUint32(this.base+offset,true);
      throw new Error('Invalid field size.');
    }
    put(offset,size,value) {
      integer(offset,0x184,0x1520-size); integer(value,0,size===4 ? 0xffffffff : 2**(size*8)-1);
      const v=this.view();
      if (size===1) v.setUint8(this.base+offset,value);
      else if (size===2) v.setUint16(this.base+offset,value,true);
      else if (size===4) v.setUint32(this.base+offset,value,true);
      else throw new Error('Invalid field size.');
    }
    bit(offset,bit,value,size=1) {
      integer(bit,0,size*8-1);
      const old=this.get(offset,size), mask=2**bit;
      this.put(offset,size,(value ? old | mask : old & ~mask) >>> 0);
    }
    crc() {
      let crc=65535;
      for (let i=0x1d0;i<0x1520;i++) crc=CRC_TABLE[(crc>>8)^this.get(i)] ^ ((crc<<8)&65535);
      return crc ^ 65535;
    }
    checksums() {
      const calculated=this.crc(), first=this.get(0x180,2), second=this.get(0x1520,2);
      return {calculated,first,second,valid:first===calculated && second===calculated};
    }
    finalize() {
      // Protect the format identity even when using the advanced editor.
      if (String.fromCharCode(...this.card.bytes.slice(this.base+0xee0,this.base+0xee4)) !== 'FF-8') throw new Error('The FF-8 signature cannot be changed.');
      const crc=this.crc(), v=this.view();
      v.setUint16(this.base+0x180,crc,true); v.setUint16(this.base+0x1520,crc,true);
    }
    character(index) { return 0x610+integer(index,0,7)*152; }
    gf(index) { return 0x1d0+integer(index,0,15)*68; }
    level(index) { return Math.min(100,Math.floor(this.get(this.character(index)+4,4)/1000)+1); }
    setLevel(index,level) { this.setCharacter(index,4,4,(integer(level,1,100)-1)*1000); }
    leader() { for(let i=0;i<3;i++) { const id=this.get(0xc74+i); if(id<8) return id; } return 0; }
    previewLeader() {
      const p=this.character(this.leader());
      this.put(0x186,2,this.get(p,2)); this.put(0x194,1,this.level(this.leader()));
      // Max HP is derived by the game from level, bonus, junction and abilities; preserve it.
    }
    setCharacter(index,offset,size,value) {
      this.put(this.character(index)+offset,size,value);
      if (offset===0 || offset===4) this.previewLeader();
      if(offset===0x90) this.put(0xefc+index*2,2,value);
      if(offset===0x92) this.put(0xf0c+index*2,2,value);
      if(offset===8) this.previewParty();
    }
    previewParty() {
      for(let i=0;i<3;i++) { const id=this.get(0xc74+i); this.put(0x195+i,1,id<8 ? this.get(this.character(id)+8) : id); }
      this.previewLeader();
    }
    setParty(index,value) {
      integer(index,0,2); if (value !== 255) integer(value,0,7);
      const others=[0,1,2].filter(i=>i!==index).map(i=>this.get(0xc74+i));
      if(value!==255 && others.includes(value)) throw new Error('This character is already in the party.');
      if(value===255 && others.every(id=>id===255)) throw new Error('The party must contain at least one character.');
      if(value!==255 && !(this.get(this.character(value)+0x94)&1)) throw new Error('Make the character available in the Characters section first.');
      this.put(0xc74+index,1,value); this.put(0xeb8+index,1,value); this.previewParty();
    }
    setGil(value,dream=false) {
      integer(value,0,99999999); this.put(dream?0xc90:0xc8c,4,value); this.put(dream?0xf2c:0xf28,4,value);
      if (!!(this.get(0xea2)&1)===dream) this.put(0x18c,4,value);
    }
    setTime(value) { this.put(0xe50,4,value); this.put(0x190,4,value); }
    setItem(index,id,quantity) {
      integer(index,0,197); integer(id,0,ITEMS.length-1); integer(quantity,0,100);
      this.put(0xcc4+index*2,1,id); this.put(0xcc5+index*2,1,id===0 ? 0 : quantity);
    }
    setMagic(index,position,id,quantity) {
      integer(position,0,31); integer(id,0,56); integer(quantity,0,100);
      const p=this.character(index)+0x10+position*2;
      if(id && this.get(p)!==id && Array.from({length:32},(_,i)=>i).some(i=>i!==position && this.get(this.character(index)+0x10+i*2)===id)) throw new Error('This magic is already in the character’s stock.');
      if(this.get(p)!==id && this.get(p)>0 && Array.from({length:19},(_,i)=>this.get(this.character(index)+0x5c+i)).includes(this.get(p))) throw new Error('Remove the junction for the magic you are replacing first.');
      this.put(p,1,id); this.put(p+1,1,id===0 ? 0 : quantity);
    }
    name(offset) {
      let result='';
      for(let i=0;i<12;i++) {
        const b=this.get(offset+i); if(!b) break;
        if(this.japanese) result+=`[${b.toString(16).padStart(2,'0').toUpperCase()}]`;
        else if(b===0x20) result+=' ';
        else if(b>=0x45&&b<=0x5e) result+=String.fromCharCode(65+b-0x45);
        else if(b>=0x5f&&b<=0x78) result+=String.fromCharCode(97+b-0x5f);
        else if(b>=0x21&&b<=0x2a) result+=String.fromCharCode(48+b-0x21);
        else result+=`[${b.toString(16).padStart(2,'0').toUpperCase()}]`;
      }
      return result;
    }
    setName(offset,text) {
      const bytes=[];
      for(let i=0;i<text.length;i++) {
        const token=text.slice(i).match(/^\[([a-f\d]{2})\]/i);
        if(token) { const b=parseInt(token[1],16); if(!b) throw new Error('Byte 00 terminates the name.'); bytes.push(b); i+=3; }
        else { const c=text.charCodeAt(i); if(this.japanese) throw new Error('For Japanese names, use the original bytes in [XX] format.'); if(c===32)bytes.push(0x20);else if(c>=65&&c<=90) bytes.push(c-65+0x45); else if(c>=97&&c<=122) bytes.push(c-97+0x5f); else if(c>=48&&c<=57) bytes.push(c-48+0x21); else throw new Error('Use letters A–Z/a–z, numbers, spaces or bytes in [XX] format.'); }
      }
      if(bytes.length>11) throw new Error('The name can contain at most 11 bytes.');
      for(let i=0;i<12;i++) this.put(offset+i,1,bytes[i]||0);
    }
    patch(offset,text) {
      const tokens=text.trim().split(/\s+/); if(!text.trim() || !tokens.every(t=>/^[a-f\d]{2}$/i.test(t))) throw new Error('Enter hexadecimal bytes separated by spaces, for example: 01 FF 20.');
      integer(offset,0x184,0x151f); if(offset+tokens.length>0x1520) throw new Error('The edit extends beyond the FF8 data.');
      for(let i=0;i<tokens.length;i++) this.put(offset+i,1,parseInt(tokens[i],16));
    }
  }
  const api={FF8Save,CHARACTERS,GFS,CARDS,WEAPONS,MAGIC,ITEMS,ABILITIES,integer};
  if(typeof module!=='undefined') module.exports=api; else root.FF8=api;
})(typeof globalThis!=='undefined'?globalThis:this);
