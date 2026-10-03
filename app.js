'use strict';
const $ = id => document.getElementById(id);
let card, original, exported, name, slot, frame = 0, ink = 1, history = [], future = [], stroke = false, last;
let ff8Editor;
let selectedBlock=null, copiedSave=null, slotPreviews=[];
const hex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
function dirty() { const baseline = exported || original; return card && card.bytes.some((v, i) => v !== baseline[i]); }
function status() { $('status').textContent = `${name} · 128 KiB · ${dirty() ? 'Changes to export' : 'No changes'}`; }
function remember() { history.push(card.bytes.slice()); if (history.length > 100) history.shift(); future = []; }
function finish() {
  if (!stroke) return;
  stroke = false; last = null;
  if (history.length && card.bytes.every((v, i) => v === history.at(-1)[i])) history.pop();
  refresh();
}
function draw(canvas, s, f, grid = false) {
  const ctx = canvas.getContext('2d'), scale = canvas.width / 16;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const index = card.pixel(s, f, x, y);
    if (card.word(s, index) === 0) continue;
    ctx.fillStyle = hex(card.color(s, index)); ctx.fillRect(x * scale, y * scale, scale, scale);
  }
  if (grid) {
    ctx.strokeStyle = '#0005'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i <= 16; i++) { ctx.moveTo(i * scale, 0); ctx.lineTo(i * scale, canvas.height); ctx.moveTo(0, i * scale); ctx.lineTo(canvas.width, i * scale); }
    ctx.stroke();
  }
}
function blockState(s) {
  return s.state===0x51?'Save':[0x52,0x53].includes(s.state)?'Linked block':s.state===0xa1?'Deleted save':[0xa0,0xa2,0xa3].includes(s.state)?'Free block':'Unknown block';
}
function renderSlots() {
  $('slots').replaceChildren();slotPreviews=[];
  const free=card.freeBlocks();$('cardCapacity').textContent=`${free.length} / 15 free`;
  for(const s of card.slots()) {
    const owner=card.owner(s.block),b=document.createElement('button');b.className='slot';
    b.classList.toggle('active',selectedBlock===s.block);b.classList.toggle('deleted',[0xa1,0xa2,0xa3].includes(s.state));b.classList.toggle('free',free.includes(s.block));
    b.setAttribute('aria-pressed',String(selectedBlock===s.block));
    const description=`Block ${s.block} · ${blockState(s)}${owner?.title?' · '+owner.title:''}`;
    b.title=description;b.setAttribute('aria-label',description);
    const number=document.createElement('span');number.className='block-number';number.textContent=String(s.block).padStart(2,'0');b.append(number);
    if(owner?.frames) {
      const icon=document.createElement('canvas');icon.width=icon.height=48;draw(icon,owner,0);b.append(icon);slotPreviews.push({canvas:icon,slot:owner});
    } else {
      const blank=document.createElement('span');blank.className='block-placeholder';blank.textContent=free.includes(s.block)?'':s.state===0x51?'?':'·';b.append(blank);
    }
    if([0x52,0x53].includes(s.state)) {const link=document.createElement('span');link.className='block-link';link.textContent='↔';b.append(link);}
    b.onclick=()=>{finish();select(s);};$('slots').append(b);
  }
}
function select(s) { selectedBlock=s.block;frame=0;refresh(); }
function refresh() {
  if(!card)return;
  const physical=card.slots().find(s=>s.block===selectedBlock),owner=physical?card.owner(physical.block):null;
  slot=owner?.frames?owner:null;
  $('controls').disabled=!slot;
  $('title').textContent=owner?.title||owner?.filename||'Memory Card Paint';
  $('saveTitle').textContent=owner?.title||owner?.filename||(physical?blockState(physical):'Select a block');
  $('saveMeta').textContent=physical?`Block ${physical.block} · ${blockState(physical)}${owner?.filename?' · '+owner.filename:''}`:'Select one of the 15 blocks.';
  let chain=null;try { if(owner?.state===0x51)chain=card.chain(owner.block); } catch {}
  $('copySave').disabled=!chain;$('deleteSave').disabled=!chain;
  $('pasteSave').disabled=!copiedSave||!physical||!card.freeBlocks().includes(physical.block);
  $('details').textContent=owner?`Save starts at block ${owner.block} · ${owner.size} bytes${chain?' · '+chain.length+' block'+(chain.length===1?'':'s'):''}${owner.state===0xa1?' · Deleted, residual data':''}`:'Select an occupied block to edit its icon, or a free block to paste a copied save.';
  renderSlots();status();ff8Editor?.refresh();
  $('undo').disabled=!history.length;$('redo').disabled=!future.length;
  $('frames').replaceChildren();
  if(!slot) {
    $('paint').getContext('2d').clearRect(0,0,384,384);$('preview').getContext('2d').clearRect(0,0,96,96);$('palette').replaceChildren();return;
  }
  frame=Math.min(frame,slot.frames-1);
  for(let i=0;i<slot.frames;i++) {
    const b=document.createElement('button');b.textContent=i+1;b.classList.toggle('active',i===frame);
    b.onclick=()=>{finish();frame=i;refresh();};$('frames').append(b);
  }
  draw($('paint'),slot,frame,$('grid').checked);draw($('preview'),slot,frame);
  $('palette').replaceChildren();
  for(let i=0;i<16;i++) {
    const b=document.createElement('button');b.textContent=i.toString(16).toUpperCase();
    b.style.background=card.word(slot,i)===0?'repeating-conic-gradient(#777 0% 25%,#444 0% 50%) 0/12px 12px':hex(card.color(slot,i));
    b.classList.toggle('active',i===ink);b.title=`Color ${i}`;b.onclick=()=>{ink=i;refresh();};$('palette').append(b);
  }
  $('color').value=hex(card.color(slot,ink));$('transparent').checked=card.word(slot,ink)===0;
  $('stp').checked=!!(card.word(slot,ink)&0x8000);$('colorLabel').textContent=`Color ${ink.toString(16).toUpperCase()}`;
}
function cardMessage(text,error=false) { $('cardMessage').textContent=text;$('cardMessage').className='card-message'+(error?' error':''); }
function changeCard(action) {
  finish();const candidate=new MemoryCard(card.bytes),result=action(candidate);
  remember();card.bytes=candidate.bytes;refresh();return result;
}
$('copySave').onclick=()=>{
  try {
    finish();const owner=card.owner(selectedBlock);copiedSave=card.copySave(owner?.block);
    refresh();cardMessage(`Copied ${copiedSave.title||copiedSave.filename} (${copiedSave.data.length} blocks). Open a destination card, select a free block and Paste.`);
  } catch(error) {cardMessage(error.message,true);}
};
$('pasteSave').onclick=()=>{
  try {
    if(!copiedSave)return;
    changeCard(candidate=>candidate.pasteSave(copiedSave,selectedBlock));frame=0;refresh();
    cardMessage('Save pasted. Use File → Save copy .mcd to export. Undo restores the previous card.');
  } catch(error) {cardMessage(error.message,true);}
};
$('deleteSave').onclick=()=>{
  try {
    finish();const owner=card.owner(selectedBlock),chain=card.chain(owner?.block);
    if(!confirm(`Delete ${owner.title||owner.filename}? All ${chain.length} blocks of this save will be freed. You can Undo before closing the card.`))return;
    changeCard(candidate=>candidate.deleteSave(owner.block));
    cardMessage('Save deleted. Use Undo to restore it, or File → Save copy .mcd to export.');
  } catch(error) {cardMessage(error.message,true);}
};
$('file').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    const next = new MemoryCard(new Uint8Array(await file.arrayBuffer()));
    if (dirty() && !confirm('Unexported changes will be lost. Open the new card?')) return;
    finish(); card = next; original = next.bytes.slice(); exported = null; name = file.name; history = []; future = []; slot = null; selectedBlock=null;
    ff8Editor.mode(false); $('ff8Message').textContent = 'Changes are applied to the card in memory. Use File → Save copy .mcd to export.';
    $('controls').disabled = true; $('download').disabled = false;
    $('paint').getContext('2d').clearRect(0,0,384,384); $('preview').getContext('2d').clearRect(0,0,96,96);
    $('title').textContent = 'Icon Editor'; $('details').textContent = 'No save has a valid icon.';
    const first = card.slots().find(s => s.state===0x51) || card.slots()[0];select(first);
    cardMessage(copiedSave?`Copied save ready: ${copiedSave.title||copiedSave.filename}. Select a free block and Paste.`:'Copy a save, open a destination card, select a free block and Paste. Save copy .mcd exports your changes.');
  } catch (error) { alert(error.message); }
  finally { event.target.value = ''; }
};
function paletteChange() {
  if (!slot) return;
  remember(); const rgb = $('color').value.match(/[a-f\d]{2}/gi).map(v => parseInt(v, 16));
  card.setColor(slot, ink, rgb, $('transparent').checked, $('stp').checked); refresh();
}
$('color').onchange = () => { $('transparent').checked = false; paletteChange(); };
$('transparent').onchange = paletteChange; $('stp').onchange = () => { $('transparent').checked = false; paletteChange(); };
$('grid').onchange = refresh;
document.querySelectorAll('[data-tool]').forEach(button => {
  button.onclick = () => {
    finish(); $('tool').value = button.dataset.tool;
    document.querySelectorAll('[data-tool]').forEach(b => {
      const active = b === button;
      b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active));
    });
    $('paint').style.cursor = button.dataset.tool === 'pick' ? 'copy' : 'crosshair';
    $('toolName').textContent = button.getAttribute('aria-label');
  };
});
$('zoom').onchange = () => {
  const size = Number($('zoom').value);
  $('paint').style.width = $('paint').style.height = `${size}px`;
  $('zoomStatus').textContent = `${size / 16 * 100}%`;
};
$('magnify').onclick = () => {
  const zoom = $('zoom'); zoom.selectedIndex = (zoom.selectedIndex + 1) % zoom.options.length; zoom.onchange();
};
document.querySelectorAll('.menu').forEach(menu => {
  menu.addEventListener('toggle', () => {
    if (menu.open) document.querySelectorAll('.menu').forEach(other => { if (other !== menu) other.open = false; });
  });
  menu.querySelectorAll('button, label[tabindex]').forEach(item => item.addEventListener('click', () => { menu.open = false; }));
});
document.addEventListener('click', e => { if (!e.target.closest('.menu')) document.querySelectorAll('.menu').forEach(menu => { menu.open = false; }); });
document.querySelector('label[tabindex]').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.menu').forEach(menu => { menu.open = false; });
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key.toLowerCase() === 'o') { e.preventDefault(); $('file').click(); }
  if (e.key.toLowerCase() === 's') { e.preventDefault(); if (card) $('download').click(); }
});
function flood(x, y) {
  const target = card.pixel(slot, frame, x, y); if (target === ink) return;
  const queue = [[x,y]];
  while (queue.length) {
    const [px,py] = queue.pop();
    if (px < 0 || px > 15 || py < 0 || py > 15 || card.pixel(slot,frame,px,py) !== target) continue;
    card.pixel(slot,frame,px,py,ink); queue.push([px-1,py],[px+1,py],[px,py-1],[px,py+1]);
  }
}
function point(e) {
  const r = $('paint').getBoundingClientRect();
  return [Math.max(0,Math.min(15,Math.floor((e.clientX-r.left)*16/r.width))), Math.max(0,Math.min(15,Math.floor((e.clientY-r.top)*16/r.height)))];
}
function paint(x,y) {
  const [sx,sy] = last || [x,y], steps = Math.max(Math.abs(x-sx),Math.abs(y-sy));
  for (let i = 0; i <= steps; i++) card.pixel(slot,frame,Math.round(sx+(x-sx)*(steps ? i/steps : 0)),Math.round(sy+(y-sy)*(steps ? i/steps : 0)),ink);
  last = [x,y]; draw($('paint'),slot,frame,$('grid').checked);
}
$('paint').oncontextmenu = e => e.preventDefault();
$('paint').onpointerdown = e => {
  if (!slot || (e.button !== 0 && e.button !== 2)) return;
  e.preventDefault(); const [x,y] = point(e);
  if (e.button === 2 || $('tool').value === 'pick') { ink = card.pixel(slot,frame,x,y); refresh(); return; }
  remember(); stroke = true; last = null; $('paint').setPointerCapture(e.pointerId);
  if ($('tool').value === 'fill') { flood(x,y); finish(); } else paint(x,y);
};
$('paint').onpointermove = e => {
  const [x, y] = point(e); $('coordinates').textContent = `${x}, ${y} px`;
  if (stroke) paint(x, y);
};
$('paint').onpointerleave = () => { $('coordinates').textContent = '—, — px'; };
$('paint').onpointerup = finish; $('paint').onpointercancel = finish; $('paint').onlostpointercapture = finish;
function travel(from,to) { finish(); if (!from.length) return; to.push(card.bytes.slice()); card.bytes = from.pop(); refresh(); }
$('undo').onclick = () => travel(history,future); $('redo').onclick = () => travel(future,history);
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  e.preventDefault(); if (e.shiftKey) travel(future,history); else travel(history,future);
});
$('download').onclick = () => {
  document.activeElement?.blur();
  finish(); const url = URL.createObjectURL(new Blob([card.bytes],{type:'application/octet-stream'}));
  const a = document.createElement('a'); a.href = url; a.download = name.replace(/\.[^.]+$/, '') + '-edited.mcd'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  exported = card.bytes.slice(); status();
};
let tick = 0;
setInterval(() => {
  tick++;if(slot)draw($('preview'),slot,tick%slot.frames);
  for(const entry of slotPreviews)draw(entry.canvas,entry.slot,tick%entry.slot.frames);
},250);
window.addEventListener('beforeunload', e => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });
ff8Editor = new FF8Editor({
  card: () => card,
  slot: () => slot,
  finish,
  change: (action, repair = false) => {
    finish();
    const info = FF8.FF8Save.inspect(card, slot);
    if (!info.supported) throw new Error(info.reason);
    if (!repair && !info.checksum.valid) throw new Error('Recalculate the checksums before editing this save.');
    const candidate = new MemoryCard(card.bytes);
    const save = new FF8.FF8Save(candidate, slot);
    action(save);
    if (!repair && candidate.bytes.every((value, i) => value === card.bytes[i])) return;
    save.finalize();
    if (candidate.bytes.every((value, i) => value === card.bytes[i])) return;
    remember(); card.bytes = candidate.bytes; refresh();
  }
});
