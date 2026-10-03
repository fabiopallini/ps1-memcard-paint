'use strict';
// DOM test double for event/data integration. This does not replace a visual browser check.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
class Element {
  constructor(tag,document) {
    this.tagName=tag.toUpperCase();this.document=document;this.children=[];this.dataset={};this.style={};this.attrs={};this.className='';this._text='';this._value='';this.disabled=false;this.hidden=false;this.scrollTop=0;this.listeners={};
    this.classList={toggle:(name,on)=>{const s=new Set(this.className.split(/\s+/).filter(Boolean));if(on===undefined)on=!s.has(name);if(on)s.add(name);else s.delete(name);this.className=[...s].join(' ');},add:name=>this.classList.toggle(name,true)};
  }
  set value(v){this._value=String(v);} get value(){return this._value;}
  set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  append(...children){for(const c of children){c.parent=this;this.children.push(c);}}
  replaceChildren(...children){this.children=[];this._text='';this.append(...children);}
  setAttribute(name,value){this.attrs[name]=String(value);if(name==='id')this.id=value;if(name==='class')this.className=value;if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
  getAttribute(name){return this.attrs[name]??null;}
  matches(s){s=s.trim();if(s.startsWith('.'))return this.className.split(/\s+/).includes(s.slice(1));if(s.startsWith('#'))return this.id===s.slice(1);const m=s.match(/^(\w+)?\[([^\]]+)\]$/);if(m)return(!m[1]||this.tagName===m[1].toUpperCase())&&(m[2].startsWith('data-')?this.dataset[m[2].slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]!==undefined:this.attrs[m[2]]!==undefined);return this.tagName===s.toUpperCase();}
  querySelectorAll(selector){const matches=[];const visit=e=>{for(const c of e.children){if(selector.split(',').some(s=>c.matches(s)))matches.push(c);visit(c);}};visit(this);return matches;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  closest(s){for(let e=this;e;e=e.parent)if(e.matches(s))return e;return null;}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  focus(){this.document.activeElement=this;}
  blur(){this.document.activeElement=null;}
  click(){if(this.disabled)return;if(this.tagName==='A')this.document.downloads.push({filename:this.download,url:this.href});this.onclick?.({target:this});for(const fn of this.listeners.click||[])fn({target:this});}
  checkValidity(){if(this.type!=='number')return true;const n=Number(this.value);return this.value!==''&&Number.isInteger(n)&&n>=Number(this.min??0)&&n<=Number(this.max??Infinity);}
  reportValidity(){}
  get options(){return this.children.filter(c=>c.tagName==='OPTION');}
  get selectedIndex(){return this.options.findIndex(o=>o.value===this.value);}
  set selectedIndex(v){this.value=this.options[v].value;}
  getContext(){return {clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};}
  getBoundingClientRect(){return {left:0,top:0,width:384,height:384};}
  setPointerCapture(){}
}
function dom(html){
  const document={downloads:[],createElement(tag){return new Element(tag,this);},addEventListener(){}};
  const root=document.createElement('root'),stack=[root],voids=new Set(['meta','link','input','hr','br']);
  for(const token of html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)||[]){
    if(token.startsWith('<!'))continue;
    if(token.startsWith('</')){const tag=token.match(/^<\/([^\s>]+)/)[1].toUpperCase();while(stack.length>1){if(stack.pop().tagName===tag)break;}continue;}
    if(!token.startsWith('<')){stack.at(-1)._text+=token;continue;}
    const match=token.match(/^<([^\s/>]+)([\s\S]*?)\/?\s*>$/);if(!match)continue;
    const e=document.createElement(match[1]);
    for(const a of match[2].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)){const key=a[1],value=a[2]??a[3]??a[4]??'';e.setAttribute(key,value);if(['hidden','disabled','checked','open'].includes(key))e[key]=true;if(['value','type','width','height','min','max'].includes(key))e[key]=value;}
    stack.at(-1).append(e);if(!voids.has(match[1])&&!token.endsWith('/>'))stack.push(e);
  }
  for(const select of root.querySelectorAll('select')){const option=select.options.find(o=>o.attrs.selected!==undefined)||select.options[0];if(option)select.value=option.value;}
  document.querySelectorAll=s=>root.querySelectorAll(s);document.querySelector=s=>root.querySelector(s);document.getElementById=id=>document.querySelector('#'+id);return document;
}
(async()=>{
  const document=dom(fs.readFileSync(path.join(__dirname,'index.html'),'utf8')),alerts=[],blobs=new Map();
  let acceptConfirm=true;
  const context=vm.createContext({document,TextDecoder,Blob,setInterval(){},setTimeout(){},alert:m=>alerts.push(m),confirm:()=>acceptConfirm,URL:{createObjectURL(blob){const url='blob:'+blobs.size;blobs.set(url,blob);return url;},revokeObjectURL(){}},window:{addEventListener(){}}});
  for(const file of ['card.js','ff8.js','ff8-ui.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),context,{filename:file});
  const $=id=>document.getElementById(id),getBytes=()=>Buffer.from(vm.runInContext('card.bytes',context));
  const source=fs.readFileSync(path.join(__dirname,'../card1.mcd'));
  $('file').files=[{name:'card1.mcd',arrayBuffer:async()=>source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength)}];
  await $('file').onchange({target:$('file')});assert.deepEqual(alerts,[]);assert.equal($('gameMode').disabled,false);assert.deepEqual(getBytes(),source);
  assert.equal($('slots').children.length,15);assert.equal($('iconPane').hidden,false);$('gameMode').click();assert.equal($('ff8Pane').hidden,false);
  const pages=$('ff8Tabs').querySelectorAll('button');
  for(const page of pages){page.click();assert.ok($('ff8Body').children.length>0,page.dataset.page);assert.deepEqual(getBytes(),source,'browsing must never modify data');}
  const go=page=>pages.find(b=>b.dataset.page===page).click();
  const field=key=>$('ff8Body').querySelectorAll('[data-key]').find(e=>e.dataset.key===key);
  const edit=(key,value)=>{const e=field(key);assert.ok(e,key);e.value=value;e.onchange();};
  go('advanced');
  const applyStory=()=>$('ff8Body').querySelectorAll('button').find(b=>b.textContent==='Apply story reference');
  assert.equal(applyStory().disabled,true);
  edit('story-reference',4050);assert.deepEqual(getBytes(),source,'selecting a reference must not edit the save');
  assert.equal(applyStory().disabled,false);applyStory().click();
  assert.equal(vm.runInContext('new FF8.FF8Save(card,slot).get(0xfe0,2)',context),4050);
  assert.equal(vm.runInContext('new FF8.FF8Save(card,slot).get(0xfac)',context),4);
  assert.equal(vm.runInContext('new FF8.FF8Save(card,slot).get(0x1c8,4)',context),3);
  assert.equal(vm.runInContext('new FF8.FF8Save(card,slot).checksums().valid',context),true);
  const storyBytes=getBytes();$('undo').click();assert.deepEqual(getBytes(),source);$('redo').click();assert.deepEqual(getBytes(),storyBytes);$('undo').click();
  const originalDisc=vm.runInContext('new FF8.FF8Save(card,slot).get(0xfac)',context);
  const sync=field('story-update-disc');sync.checked=false;sync.onchange();edit('story-reference',420);applyStory().click();
  assert.equal(vm.runInContext('new FF8.FF8Save(card,slot).get(0xfac)',context),originalDisc);
  $('undo').click();assert.deepEqual(getBytes(),source);
  go('gfs');edit('gf-level',100);assert.equal(vm.runInContext('new FF8.FF8Save(card,slot).get(0x1dc,4)',context),49500);$('undo').click();assert.deepEqual(getBytes(),source);
  go('cards');edit('card-0',10);assert.equal(vm.runInContext('card.bytes[slot.base+0x1460]',context),138);$('undo').click();assert.deepEqual(getBytes(),source);
  go('limits');const limit=field('b-3220-0');limit.checked=false;limit.onchange();assert.equal(vm.runInContext('card.bytes[slot.base+0xc94]&1',context),0);$('undo').click();assert.deepEqual(getBytes(),source);
  go('config');edit('n-3168',2);assert.equal(vm.runInContext('card.bytes[slot.base+0xc60]',context),2);$('undo').click();assert.deepEqual(getBytes(),source);
  go('characters');edit('character-level',100);assert.equal(vm.runInContext('new FF8.FF8Save(card,slot).level(0)',context),100);
  edit('character-weapon',6);assert.equal(vm.runInContext('card.bytes[slot.base+0x619]',context),6);
  go('inventory');edit('item-0',19);edit('item-qty-0',100);assert.equal(vm.runInContext('card.bytes[slot.base+0xcc4]',context),19);
  go('magic');edit('magic-0',19);edit('magic-qty-0',100);
  assert.equal(vm.runInContext('new FF8.FF8Save(card,slot).checksums().valid',context),true);
  const edited=getBytes();$('undo').click();assert.notDeepEqual(getBytes(),edited);$('redo').click();assert.deepEqual(getBytes(),edited);
  go('advanced');edit('raw-offset','EE0');const textarea=$('ff8Body').querySelector('textarea');textarea.value='00';textarea.oninput();$('ff8Body').querySelectorAll('button').find(b=>b.textContent==='Apply bytes').click();
  assert.deepEqual(getBytes(),edited,'invalid advanced edit must roll back atomically');assert.match($('ff8Message').textContent,/signature/);
  $('download').click();assert.equal(document.downloads[0].filename,'card1-edited.mcd');assert.deepEqual(Buffer.from(await blobs.get(document.downloads[0].url).arrayBuffer()),edited);
  assert.equal(vm.runInContext('dirty()',context),false,'an exported card has no pending changes');
  $('slots').children[1].click();assert.equal(vm.runInContext('slot.block',context),2);assert.match($('ff8Checksum').textContent,/Block 2/);
  go('general');edit('n-3212',99999); // 0xc8c = normal gil
  assert.equal(vm.runInContext('new FF8.FF8Save(card,slot).get(0xc8c,4)',context),99999);
  assert.deepEqual(getBytes().subarray(8192,16384),edited.subarray(8192,16384),'editing block 2 must preserve block 1');
  $('iconMode').click();assert.equal($('iconPane').hidden,false);$('magnify').click();assert.equal($('paint').style.width,'512px');
  $('file').files=[{name:'bad.mcd',arrayBuffer:async()=>new ArrayBuffer(4)}];await $('file').onchange({target:$('file')});assert.equal(alerts.length,1);assert.equal(getBytes().length,131072);
  const beforeRepair=getBytes();vm.runInContext('card.bytes[slot.base+0x180]^=1;ff8Editor.refresh()',context);$('gameMode').click();
  assert.match($('ff8Checksum').textContent,/Expected/);$('ff8Body').querySelector('button').click();assert.deepEqual(getBytes(),beforeRepair);assert.match($('ff8Checksum').textContent,/OK/);
  // Save management uses the same history and copies survive loading another card.
  assert.equal($('slots').children.length,15);assert.equal($('deleteSave').disabled,false);
  $('copySave').click();assert.ok(vm.runInContext('copiedSave',context));
  const beforeDelete=getBytes(),copiedData=Buffer.from(vm.runInContext('copiedSave.data[0]',context));
  acceptConfirm=false;$('deleteSave').click();assert.deepEqual(getBytes(),beforeDelete,'cancelled deletion must preserve the card');acceptConfirm=true;
  $('deleteSave').click();assert.equal(vm.runInContext('card.slots()[1].state',context),0xa1);assert.equal($('gameMode').disabled,true);
  assert.deepEqual(getBytes().subarray(8192,16384),beforeDelete.subarray(8192,16384),'delete must preserve other saves');
  $('undo').click();assert.deepEqual(getBytes(),beforeDelete);assert.equal($('gameMode').disabled,false);
  $('redo').click();assert.equal(vm.runInContext('card.slots()[1].state',context),0xa1);$('undo').click();
  const destination=Buffer.alloc(131072);destination[0]=77;destination[1]=67;destination[127]=14;
  for(let b=1;b<=15;b++){destination.writeUInt32LE(0xa0,b*128);destination.writeUInt16LE(0xffff,b*128+8);destination[b*128+127]=0xa0;}
  $('file').files=[{name:'destination.mcd',arrayBuffer:async()=>destination.buffer.slice(destination.byteOffset,destination.byteOffset+destination.byteLength)}];await $('file').onchange({target:$('file')});
  assert.equal($('copySave').disabled,true);assert.equal($('controls').disabled,true);assert.equal($('gameMode').disabled,true);
  $('slots').children[14].click();assert.equal($('pasteSave').disabled,false);$('pasteSave').click();
  assert.deepEqual(getBytes().subarray(15*8192,16*8192),copiedData);assert.equal(vm.runInContext('card.chain(15).length',context),1);
  assert.equal($('gameMode').disabled,false);assert.equal(vm.runInContext('new FF8.FF8Save(card,slot).checksums().valid',context),true);
  const pasted=getBytes();$('undo').click();assert.deepEqual(getBytes(),destination);assert.equal($('controls').disabled,true);$('redo').click();assert.deepEqual(getBytes(),pasted);
  $('slots').children[2].click();assert.equal($('controls').disabled,true);$('pasteSave').click();assert.deepEqual(getBytes(),pasted);assert.match($('cardMessage').textContent,/same filename/);
  $('download').click();assert.equal(document.downloads[1].filename,'destination-edited.mcd');assert.deepEqual(Buffer.from(await blobs.get(document.downloads[1].url).arrayBuffer()),pasted);
  // Linked tiles select their owning save; UI operations include the whole chain.
  const multi=Buffer.from(destination),multiBlocks=[5,2,10];
  multiBlocks.forEach((b,i)=>{
    const dir=b*128;multi.writeUInt32LE(i===0?0x51:i===2?0x53:0x52,dir);multi.writeUInt16LE(i===2?0xffff:multiBlocks[i+1]-1,dir+8);
    if(i===0){multi.writeUInt32LE(24576,dir+4);multi.set(Buffer.from('BASLUS-12345MULTI'),dir+10);multi.set(copiedData,b*8192);}else multi.fill(70+i,b*8192,(b+1)*8192);
    let xor=0;for(let j=0;j<127;j++)xor^=multi[dir+j];multi[dir+127]=xor;
  });
  $('file').files=[{name:'multi.mcd',arrayBuffer:async()=>multi.buffer.slice(multi.byteOffset,multi.byteOffset+multi.byteLength)}];await $('file').onchange({target:$('file')});
  $('slots').children[1].click();assert.equal(vm.runInContext('slot.block',context),5);assert.equal($('copySave').disabled,false);$('copySave').click();assert.equal(vm.runInContext('copiedSave.data.length',context),3);
  $('deleteSave').click();assert.deepEqual(Array.from(vm.runInContext('[5,2,10].map(b=>card.slots()[b-1].state)',context)),[0xa1,0xa2,0xa3]);$('undo').click();assert.deepEqual(getBytes(),multi);
  $('file').files=[{name:'multi-target.mcd',arrayBuffer:async()=>destination.buffer.slice(destination.byteOffset,destination.byteOffset+destination.byteLength)}];await $('file').onchange({target:$('file')});
  $('slots').children[6].click();$('pasteSave').click();assert.deepEqual(Array.from(vm.runInContext('card.chain(7).map(s=>s.block)',context)),[7,1,2]);
  [7,1,2].forEach((b,i)=>assert.deepEqual(getBytes().subarray(b*8192,(b+1)*8192),multi.subarray(multiBlocks[i]*8192,(multiBlocks[i]+1)*8192)));
  $('undo').click();assert.deepEqual(getBytes(),destination);
  const unsupported=Buffer.from(source);unsupported[8192+0xee0]=0;unsupported[16384+0xee0]=0;
  $('file').files=[{name:'other.mcd',arrayBuffer:async()=>unsupported.buffer.slice(unsupported.byteOffset,unsupported.byteOffset+unsupported.byteLength)}];await $('file').onchange({target:$('file')});
  assert.equal($('gameMode').disabled,true);assert.equal($('iconPane').hidden,false);assert.equal($('controls').disabled,false);
  console.log('OK: simulated DOM integration, loading, 9 panels without writes, levels/weapons/inventory/magic, CRC, undo/redo, rollback, export, block switching, zoom and single/multi-block copy/delete.');
})().catch(e=>{console.error(e);process.exitCode=1;});
