/* Game editor UI; all successful edits pass through the application's undo transaction. */
(function(root) {
  'use strict';
  const $=id=>document.getElementById(id), F=root.FF8;
  const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const options=(names)=>names.map((name,value)=>[value,`${String(value).padStart(3,'0')} · ${name}`]);
  class FF8Editor {
    constructor(context) {
      this.context=context; this.page='general'; this.characterIndex=0; this.gfIndex=0; this.itemPage=0; this.itemSearch=''; this.rawOffset=0x184; this.rawText=''; this.lastBlock=null; this.storyReference=-1; this.storyUpdateDisc=true;
      $('iconMode').onclick=()=>this.mode(false); $('gameMode').onclick=()=>this.mode(true);
      $('ff8Tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{this.page=b.dataset.page;this.render();});
    }
    mode(game) {
      if(game && $('gameMode').disabled) return;
      this.context.finish(); $('iconPane').hidden=game; $('ff8Pane').hidden=!game;
      $('iconMode').classList.toggle('active',!game); $('gameMode').classList.toggle('active',game);
      $('iconMode').setAttribute('aria-pressed',String(!game)); $('gameMode').setAttribute('aria-pressed',String(game));
      if(game) this.render();
    }
    refresh() {
      const card=this.context.card(),slot=this.context.slot();
      const info=card ? F.FF8Save.inspect(card,slot) : {supported:false,reason:'Open a memory card.'};
      $('gameMode').disabled=!info.supported; $('gameSupport').textContent=info.reason;
      if(!info.supported) { this.mode(false); return; }
      if(this.lastBlock!==slot.block || this.lastCard!==card) {
        this.lastBlock=slot.block; this.lastCard=card;this.itemPage=0;this.itemSearch='';this.rawText='';this.storyReference=-1;
      }
      if(!$('ff8Pane').hidden) this.render();
    }
    save() { return new F.FF8Save(this.context.card(),this.context.slot()); }
    change(fn,repair=false) {
      try {
        this.context.change(fn,repair); $('ff8Message').textContent='Change applied. Use File → Save copy .mcd to export.';
        $('ff8Message').className='ff8-message';
      } catch(error) {
        $('ff8Message').textContent=error.message; $('ff8Message').className='ff8-message error'; this.render();
      }
    }
    group(title) { const group=el('section',undefined,'save-group');group.append(el('h3',title));this.body.append(group);return group; }
    note(parent,text) { parent.append(el('p',text,'save-note')); }
    field(parent,label,value,callback,settings={}) {
      const wrap=el('label',undefined,'save-field'), title=el('span',label);
      let input;
      if(settings.options) {
        input=el('select'); const choices=[...settings.options];
        if(!choices.some(([v])=>String(v)===String(value))) choices.push([value,`Current value: ${value}`]);
        for(const [v,text] of choices){const o=el('option',text);o.value=v;input.append(o);} input.value=value;
      } else {
        input=el('input'); input.type=settings.text?'text':'number'; input.value=value;
        if(!settings.text){input.min=settings.min??0;input.max=settings.max??255;input.step=1;}
      }
      input.dataset.key=settings.key||label;
      input.onchange=()=> {
        if(!settings.text && !settings.options && (input.value.trim()==='' || !input.checkValidity())) {input.reportValidity();input.value=value;return;}
        const v=settings.text?input.value:Number(input.value);this.change(save=>callback(save,v));
      };
      wrap.append(title,input);parent.append(wrap);return input;
    }
    number(parent,label,offset,size=1,max=2**(size*8)-1,callback) {
      return this.field(parent,label,this.save().get(offset,size),(s,v)=>callback?callback(s,v):s.put(offset,size,v),{max,key:`n-${offset}`});
    }
    name(parent,label,offset) { this.field(parent,label,this.save().name(offset),(s,v)=>s.setName(offset,v),{text:true,key:`name-${offset}`}); }
    check(parent,label,offset,bit=0,size=1,callback) {
      const wrap=el('label',undefined,'save-check'),input=el('input');input.type='checkbox';input.checked=!!(this.save().get(offset,size)&2**bit);input.dataset.key=`b-${offset}-${bit}`;
      input.onchange=()=>this.change(s=>callback?callback(s,input.checked):s.bit(offset,bit,input.checked,size));wrap.append(input,el('span',label));parent.append(wrap);
    }
    button(parent,label,fn) { const b=el('button',label);b.type='button';b.onclick=()=>this.change(fn);parent.append(b);return b; }
    picker(parent,label,value,choices,fn,key) {
      const wrap=el('label',undefined,'save-field'),select=el('select');
      for(const [v,text] of choices){const o=el('option',text);o.value=v;select.append(o);}select.value=value;select.dataset.key=key;
      select.onchange=()=>{fn(Number(select.value));this.render();};wrap.append(el('span',label),select);parent.append(wrap);
    }
    render() {
      const info=F.FF8Save.inspect(this.context.card(),this.context.slot());if(!info.supported)return;
      const body=$('ff8Body'),scroll=body.scrollTop,active=document.activeElement?.dataset.key;
      body.replaceChildren();this.body=body;
      $('ff8Tabs').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.page===this.page);b.setAttribute('aria-pressed',String(b.dataset.page===this.page));});
      const c=info.checksum, h=n=>n.toString(16).padStart(4,'0').toUpperCase();
      $('ff8Checksum').textContent=`Block ${this.context.slot().block} · CRC ${h(c.first)} / ${h(c.second)} · ${c.valid?'OK':'Expected '+h(c.calculated)}`;
      if(!c.valid) {
        const g=this.group('Save integrity');this.note(g,'The two checksums do not match the data. Check the file’s source before editing.');
        const b=el('button','Recalculate both checksums');b.onclick=()=>this.change(()=>{},true);g.append(b);return;
      }
      this[this.page]();body.scrollTop=scroll;
      if(active) {const target=[...body.querySelectorAll('[data-key]')].find(e=>e.dataset.key===active);if(target)target.focus({preventScroll:true});}
    }
    general() {
      const s=this.save(),g=this.group('Game');
      this.number(g,'Gil',0xc8c,4,99999999,(f,v)=>f.setGil(v));this.number(g,'Laguna’s gil',0xc90,4,99999999,(f,v)=>f.setGil(v,true));
      this.number(g,'Play time (stored units)',0xe50,4,0xffffffff,(f,v)=>f.setTime(v));
      const freq=this.context.slot().filename[1]==='E'?50:60,t=s.get(0xe50,4);
      this.note(g,`Displayed time: ${Math.floor(t/(freq*60))} h ${Math.floor(t/freq)%60} min · version ${freq===50?'PAL':'NTSC'}.`);
      this.number(g,'Save count (preview)',0x18a,2);this.number(g,'SeeD experience',0xef0,2,3100);
      this.number(g,'Maximum HP in preview',0x188,2,9999);
      this.field(g,'Disc',s.get(0xfac),(f,v)=>{f.put(0xfac,1,v);f.put(0x1c8,4,v-1);},{options:[[1,'Disc 1'],[2,'Disc 2'],[3,'Disc 3'],[4,'Disc 4']]});
      const p=this.group('Party');
      for(let i=0;i<3;i++)this.field(p,`Slot ${i+1}`,s.get(0xc74+i),(f,v)=>f.setParty(i,v),{options:[...F.CHARACTERS.map((n,id)=>[id,n]),[255,'Empty']],key:`party-${i}`});
      this.note(p,'The menu party, field party and preview portraits are updated together. Characters must be available in the Characters section.');
      const names=this.group('Names');[[0x198,'Squall'],[0x1a4,'Rinoa'],[0x1b0,'Angelo'],[0x1bc,'Boko'],[0xc7c,'Griever']].forEach(([o,l])=>this.name(names,l,o));
      this.note(names,'FF8-encoded names: letters, numbers and spaces. Undecoded symbols appear as [XX] and can be preserved. Japanese editions display the original bytes.');
      const stats=this.group('Battles');this.number(stats,'Wins',0xe5c,4,0xffffffff,(f,v)=>{f.put(0xe5c,4,v);f.put(0xef4,4,v);});
      this.number(stats,'Escapes',0xe62,2,65535,(f,v)=>{f.put(0xe62,2,v);f.put(0xefa,2,v);});this.number(stats,'Steps',0xee4,4);this.number(stats,'Tonberries defeated',0xe68,4);
      const extra=this.group('Special GFs');this.check(extra,'Odin',0xea2,1);this.check(extra,'Phoenix',0xea2,2);this.check(extra,'Gilgamesh',0xea2,3);
    }
    characters() {
      const s=this.save(),n=this.characterIndex,p=s.character(n),top=this.group('Character');
      this.picker(top,'Select',n,F.CHARACTERS.map((v,i)=>[i,v]),v=>this.characterIndex=v,'character-picker');
      const g=this.group('Level, weapon and bonuses');
      this.field(g,'Level',s.level(n),(f,v)=>f.setLevel(n,v),{min:1,max:100,key:'character-level'});
      this.number(g,'Experience',p+4,4,0xffffffff,(f,v)=>f.setCharacter(n,4,4,v));
      this.number(g,'Current HP',p,2,9999,(f,v)=>f.setCharacter(n,0,2,v));this.number(g,'Bonus HP',p+2,2,65535);
      this.note(g,'Bonuses are added to the stats calculated by the game. Maximum HP also depends on level, junctions and abilities; the maximum HP preview is preserved.');
      const models=[...F.CHARACTERS,'Laguna','Kiros','Ward'];
      this.field(g,'Model',s.get(p+8),(f,v)=>f.setCharacter(n,8,1,v),{options:models.map((v,i)=>[i,v])});
      const ranges=[[0,6],[7,10],[11,14],[15,18],[19,23],[24,27],[28,28],[29,29],[30,30],[31,31],[32,32]],range=ranges[s.get(p+8)]||[0,32];
      this.field(g,'Equipped weapon',s.get(p+9),(f,v)=>f.setCharacter(n,9,1,v),{options:options(F.WEAPONS).filter(([id])=>id>=range[0]&&id<=range[1]),key:'character-weapon'});
      ['Strength','Vitality','Magic','Spirit','Speed','Luck'].forEach((name,i)=>this.number(g,`Bonus ${name}`,p+10+i));
      this.number(g,'Kills',p+0x90,2,65535,(f,v)=>f.setCharacter(n,0x90,2,v));this.number(g,'KO',p+0x92,2,65535,(f,v)=>f.setCharacter(n,0x92,2,v));
      const flags=this.group('Availability and status');this.check(flags,'Available',p+0x94);this.check(flags,'Junction lock',p+0x94,1);this.check(flags,'Party lock',p+0x94,2);this.check(flags,'Alternate costume',p+0x5b);
      ['KO','Poison','Petrify','Blind','Silence','Berserk','Zombie'].forEach((l,i)=>this.check(flags,l,p+0x96,i));
      const abilities=this.group('Commands and abilities');
      for(let i=0;i<3;i++)this.field(abilities,`Command ${i+1}`,s.get(p+0x50+i),(f,v)=>f.put(p+0x50+i,1,v),{options:options(F.ABILITIES).filter(([id])=>id===0||id>=20&&id<=38)});
      for(let i=0;i<4;i++)this.field(abilities,`Ability ${i+1}`,s.get(p+0x54+i),(f,v)=>f.put(p+0x54+i,1,v),{options:options(F.ABILITIES).filter(([id])=>id===0||id>=39&&id<=82)});
      const gf=this.group('Junctioned GFs');
      F.GFS.forEach((l,i)=>this.check(gf,l,p+0x58,i,2,(f,v)=>{
        if(v && !(f.get(f.gf(i)+0x11)&1))throw new Error('Make this GF available in the Guardian Forces section first.');
        if(v)for(let k=0;k<8;k++)if(k!==n)f.bit(f.character(k)+0x58,i,false,2);
        f.bit(p+0x58,i,v,2);
      }));
      const comp=this.group('GF compatibility (0–1200)');F.GFS.forEach((l,i)=>this.field(comp,l,Math.floor((6000-s.get(p+0x70+i*2,2))/5),(f,v)=>{F.integer(v,0,1200);f.put(p+0x70+i*2,2,6000-v*5);},{max:1200,key:`compat-${i}`}));
    }
    magic() {
      const s=this.save(),n=this.characterIndex,p=s.character(n),top=this.group('Magic and junctions');
      this.picker(top,'Character',n,F.CHARACTERS.map((v,i)=>[i,v]),v=>this.characterIndex=v,'magic-character');
      const buttons=el('div',undefined,'save-actions');top.append(buttons);this.button(buttons,'Existing magic ×100',f=>{for(let i=0;i<32;i++){const id=f.get(p+0x10+i*2);if(id&&id<=56)f.setMagic(n,i,id,100);}});
      const g=this.group('Magic stock · 32 slots'),table=el('table',undefined,'save-table');g.append(table);
      const head=el('tr');['Slot','Magic','Quantity'].forEach(t=>head.append(el('th',t)));table.append(head);
      for(let i=0;i<32;i++){
        const row=el('tr'),id=s.get(p+0x10+i*2),qty=s.get(p+0x11+i*2),a=el('td'),b=el('td');row.append(el('td',String(i+1)),a,b);table.append(row);
        this.field(a,'Magic',id,(f,v)=>f.setMagic(n,i,v,f.get(p+0x11+i*2)),{options:options(F.MAGIC),key:`magic-${i}`});
        this.field(b,'Quantity',qty,(f,v)=>f.setMagic(n,i,f.get(p+0x10+i*2),v),{max:100,key:`magic-qty-${i}`});
      }
      const junction=this.group('Magic junctions');
      const labels=['HP','Strength','Vitality','Magic','Spirit','Speed','Evasion','Hit','Luck','Elemental attack','Status attack','Elemental defense 1','Elemental defense 2','Elemental defense 3','Elemental defense 4','Status defense 1','Status defense 2','Status defense 3','Status defense 4'];
      const stock=new Set(Array.from({length:32},(_,i)=>s.get(p+0x10+i*2)).filter(v=>v>0));
      labels.forEach((l,i)=>this.field(junction,l,s.get(p+0x5c+i),(f,v)=>f.put(p+0x5c+i,1,v),{options:options(F.MAGIC).filter(([id])=>id===0||stock.has(id)),key:`junction-${i}`}));
      this.note(junction,'Junctioned magic must be in stock; the GF must have learned the corresponding junction ability.');
    }
    inventory() {
      const s=this.save(),top=this.group('Inventory · 198 slots');
      const search=el('input');search.type='search';search.placeholder='Search item or slot number';search.value=this.itemSearch;search.setAttribute('aria-label','Search inventory');search.dataset.key='item-search';search.oninput=()=>{this.itemSearch=search.value;this.itemPage=0;this.render();};top.append(search);
      const actions=el('div',undefined,'save-actions');top.append(actions);
      this.button(actions,'Existing items ×100',f=>{for(let i=0;i<198;i++){const id=f.get(0xcc4+i*2);if(id>0&&id<F.ITEMS.length)f.setItem(i,id,100);}});
      this.button(actions,'All items ×100',f=>{for(let i=0;i<198;i++)f.setItem(i,i+1,100);});
      const query=this.itemSearch.toLowerCase(),indexes=Array.from({length:198},(_,i)=>i).filter(i=>!query||String(i+1)===query||(F.ITEMS[s.get(0xcc4+i*2)]||'').toLowerCase().includes(query));
      const pages=Math.max(1,Math.ceil(indexes.length/16));this.itemPage=Math.min(this.itemPage,pages-1);
      const nav=el('div',undefined,'save-actions');top.append(nav);
      for(const [text,delta] of [['◀',-1],['▶',1]]){const b=el('button',text);b.setAttribute('aria-label',delta<0?'Previous page':'Next page');b.disabled=delta<0?this.itemPage===0:this.itemPage>=pages-1;b.onclick=()=>{this.itemPage+=delta;this.render();};nav.append(b);}
      nav.append(el('span',`Page ${this.itemPage+1} / ${pages} · ${indexes.length} slots`));
      const table=el('table',undefined,'save-table');top.append(table);const head=el('tr');['Slot','Item','Quantity'].forEach(t=>head.append(el('th',t)));table.append(head);
      for(const i of indexes.slice(this.itemPage*16,this.itemPage*16+16)) {
        const row=el('tr'),a=el('td'),b=el('td'),id=s.get(0xcc4+i*2);row.append(el('td',String(i+1)),a,b);table.append(row);
        this.field(a,'Item',id,(f,v)=>f.setItem(i,v,v===0?0:Math.max(1,f.get(0xcc5+i*2))),{options:options(F.ITEMS),key:`item-${i}`});
        this.field(b,'Quantity',s.get(0xcc5+i*2),(f,v)=>f.setItem(i,f.get(0xcc4+i*2),v),{max:100,key:`item-qty-${i}`});
      }
      const battle=this.group('Battle item order');this.note(battle,'Each value is an inventory slot index, starting at 0.');
      for(let i=0;i<32;i++)this.number(battle,`Slot ${i+1}`,0xca4+i,1,197);
    }
    gfs() {
      const s=this.save(),n=this.gfIndex,p=s.gf(n),top=this.group('Guardian Forces');
      this.picker(top,'GF',n,F.GFS.map((v,i)=>[i,v]),v=>this.gfIndex=v,'gf-picker');this.button(top,'Make all GFs available',f=>{for(let i=0;i<16;i++)f.bit(f.gf(i)+0x11,0,true);});
      const g=this.group('GF status');this.name(g,'Name',p);this.check(g,'Available',p+0x11);
      const step=n===15?1000:[3,6,9].includes(n)?400:500;
      this.field(g,'Level',Math.min(100,Math.floor(s.get(p+12,4)/step)+1),(f,v)=>{F.integer(v,1,100);f.put(p+12,4,(v-1)*step);},{min:1,max:100,key:'gf-level'});
      this.number(g,'Experience',p+12,4);this.number(g,'Current HP',p+0x12,2,9999);this.number(g,'Kills',p+0x3c,2);this.number(g,'KO',p+0x3e,2);
      this.field(g,'Ability being learned',s.get(p+0x40),(f,v)=>f.put(p+0x40,1,v),{options:options(F.ABILITIES)});
      const learned=this.group('Learned abilities');this.button(learned,'Learn all abilities',f=>{for(let i=1;i<F.ABILITIES.length;i++)f.bit(p+0x14+(i>>3),i%8,true);});
      F.ABILITIES.slice(1).forEach((l,k)=>{const i=k+1;this.check(learned,`${i} · ${l}`,p+0x14+(i>>3),i%8);});
      const ap=this.group('AP and forgotten abilities');this.note(ap,'These 22 slots follow the order of the GF’s innate abilities, rather than the IDs listed above.');
      for(let i=0;i<22;i++){this.number(ap,`AP slot ${i+1}`,p+0x24+i);this.check(ap,`Slot ${i+1} forgotten`,p+0x41+(i>>3),i%8);}
    }
    cards() {
      const s=this.save(),g=this.group('Triple Triad · common cards (ID 0–76)');
      for(let i=0;i<77;i++) {
        this.field(g,`${i} · ${F.CARDS[i]}`,s.get(0x1460+i)&127,(f,v)=>{F.integer(v,0,100);f.put(0x1460+i,1,(f.get(0x1460+i)&128)|v);},{max:100,key:`card-${i}`});
        this.check(g,`${F.CARDS[i]} discovered`,0x1460+i,7);
      }
      const rare=this.group('Rare cards (ID 77–109)');
      for(let i=0;i<33;i++){this.check(rare,`${F.CARDS[77+i]} owned`,0x14ce+(i>>3),i%8);this.number(rare,`${F.CARDS[77+i]} · holder / location ID`,0x14ad+i);}
      const stats=this.group('Results');this.number(stats,'Wins Triple Triad',0x14d4,2);this.number(stats,'Losses Triple Triad',0x14d6,2);this.number(stats,'Draws Triple Triad',0x14d8,2);
      const rules=this.group('Regional rules');for(let i=0;i<8;i++){this.number(rules,`Region rules ${i+1} (bitmask)`,0xff0+i);this.number(rules,`Region trade rule ${i+1}`,0xff8+i);}
    }
    limits() {
      const g=this.group('Limit Break');
      const lists=[['Quistis',0xc94,2,['Laser Eye','Ultra Waves','Electrocute','LV?Death','Degenerator','Aqua Breath','Micro Missiles','Acid','Gatling Gun','Fire Breath','Bad Breath','White Wind','Homing Laser','Mighty Guard','Ray-Bomb','Shockwave Pulsar']],['Zell',0xc96,2,['Punch Rush','Booya','Heel Drop','Mach Kick','Dolphin Blow','Meteor Strike','Burning Rave','Meteor Barret','Different Beat','My Final Heaven']],['Irvine',0xc98,1,['Normal Shot','Scatter Shot','Dark Shot','Flame Shot','Canister Shot','Quick Shot','Armor Shot','Hyper Shot']]];
      lists.forEach(([name,offset,size,names])=>{const group=this.group(name);names.forEach((l,i)=>this.check(group,l,offset,i,size));});
      this.number(g,'Selphie · special magic (bitmask)',0xc99);this.check(g,'Automatic Renzokuken',0xea0);this.check(g,'Automatic Duel',0xea0,1);this.number(g,'Renzokuken indicator (128 = disabled)',0xea1);
      const angelo=this.group('Angelo');['Rush','Recover','Reverse','Search','Cannon','Strike','Invincible Moon','Wishing Star'].forEach((l,i)=>{this.check(angelo,`${l} known`,0xc9b,i);this.check(angelo,`${l} completed`,0xc9a,i);this.number(angelo,`${l} · points remaining`,0xc9c+i);});
      this.check(angelo,'Angelo disabled',0xea2,4);this.check(angelo,'Angel Wing enabled',0xea2,5);
      const weapon=this.group('Weapons known by the shop');F.WEAPONS.slice(0,28).forEach((l,i)=>this.check(weapon,l,0xc78,i,4));
    }
    config() {
      const s=this.save(),g=this.group('Configuration');
      ['Battle speed','Battle message speed','Field message speed'].forEach((l,i)=>this.number(g,`${l} (0 fast – 4 slow)`,0xc60+i,1,4));
      this.number(g,'Analog volume / vibration (byte)',0xc63);this.check(g,'ATB Wait',0xc64);this.check(g,'Mono audio',0xc64,1);this.check(g,'Cursor memory',0xc64,2);this.check(g,'Custom controller',0xc64,5);
      this.number(g,'Scan (byte)',0xc65);this.number(g,'Camera movement (0–4)',0xc66,1,4);
      const shops=this.group('Visited shops');for(let i=0;i<20;i++)this.check(shops,`Shop ${i}`,0xad0+i*20+16);
      const ch=this.group('Chocobo World');['Enabled','In world','MiniMog found','Demon King defeated','Koko kidnapped','Hurry','Koko met','Event Wait off'].forEach((l,i)=>this.check(ch,l,0x14e0,i));
      [['Boko level',1,1,100],['Boko current HP',2,1,255],['Boko maximum HP',3,1,255],['Boko weapon (encoded value)',4,2,65535],['Rank',6,1,255],['Movement',7,1,255],['Chocobo saves',8,4,0xffffffff],['Class A items',0x14,1,255],['Class B items',0x15,1,255],['Class C items',0x16,1,255],['Class D items',0x17,1,255],['Boko attack (0–3)',0x2d,1,3]].forEach(([l,o,size,max])=>this.number(ch,l,0x14e0+o,size,max));
    }
    advanced() {
      const s=this.save(),refs=this.group('Story references · experimental');
      this.note(refs,'Choose a documented story reference, then click Apply. This changes story progression without moving the party. References cover all four discs; continuing from your current location may require experimentation.');
      refs.classList.add('story-references');
      const current=s.get(0xfe0,2),exact=F.STORY_REFERENCES.find(r=>r.progress===current);
      this.note(refs,`Current progress: ${current} · Disc ${s.get(0xfac)}${exact?' · '+exact.label:' · No exact match in the selected references.'}`);
      this.picker(refs,'Story reference',this.storyReference,[[-1,'Choose a reference…'],...F.STORY_REFERENCES.map(r=>[r.progress,`Disc ${r.disc} · ${r.progress} · ${r.label}`])],v=>this.storyReference=v,'story-reference');
      const chosen=F.STORY_REFERENCES.find(r=>r.progress===this.storyReference);
      const wrap=el('label',undefined,'save-check'),disc=el('input');disc.type='checkbox';disc.checked=this.storyUpdateDisc;disc.dataset.key='story-update-disc';
      disc.onchange=()=>{this.storyUpdateDisc=disc.checked;this.render();};wrap.append(disc,el('span','Also update disc and preview'));refs.append(wrap);
      if(chosen)this.note(refs,`Will set story progress to ${chosen.progress}${this.storyUpdateDisc?' and disc to '+chosen.disc:''}. Location and event data will stay unchanged.`);
      const actions=el('div',undefined,'save-actions');refs.append(actions);
      const apply=this.button(actions,'Apply story reference',f=>f.setStoryReference(this.storyReference,this.storyUpdateDisc));apply.disabled=!chosen;
      const source=el('a','Reference: Hyne progress/location table');source.href='https://github.com/myst6re/hyne/blob/master/src/Data.cpp#L853-L880';source.target='_blank';source.rel='noopener noreferrer';actions.append(source);
      const raw=this.group('Edit bytes · FF8 data');this.note(raw,'Offsets relative to the start of the PS1 block: 0x184 to 0x151F. Card headers, icons, the FF-8 signature and checksums are protected. Both checksums are recalculated after editing.');
      const label=el('label',undefined,'save-field'),offset=el('input');offset.type='text';offset.value=this.rawOffset.toString(16).toUpperCase();offset.dataset.key='raw-offset';label.append(el('span','Hexadecimal offset'),offset);raw.append(label);
      offset.onchange=()=>{const text=offset.value.trim().replace(/^0x/i,'');if(!/^[a-f\d]+$/i.test(text)){$('ff8Message').textContent='Invalid hexadecimal offset.';offset.value=this.rawOffset.toString(16);return;}const v=parseInt(text,16);if(v<0x184||v>0x151f){$('ff8Message').textContent='Offset outside FF8 data.';offset.value=this.rawOffset.toString(16);return;}this.rawOffset=v;this.render();};
      const textarea=el('textarea');textarea.value=this.rawText;textarea.rows=3;textarea.placeholder='Bytes to write: 01 FF 20';textarea.setAttribute('aria-label','Hexadecimal bytes');textarea.oninput=()=>this.rawText=textarea.value;raw.append(textarea);
      this.button(raw,'Apply bytes',f=>f.patch(this.rawOffset,this.rawText));
      const pre=el('pre',undefined,'hex-view');let text='';const start=Math.max(0x184,this.rawOffset),end=Math.min(start+256,0x1520);
      for(let p=start;p<end;p+=16){text+=p.toString(16).padStart(4,'0').toUpperCase()+'  ';for(let i=p;i<Math.min(p+16,end);i++)text+=s.get(i).toString(16).padStart(2,'0').toUpperCase()+' ';text+='\n';}pre.textContent=text;raw.append(pre);
    }
  }
  root.FF8Editor=FF8Editor;
})(globalThis);
