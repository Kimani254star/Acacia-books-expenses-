/* Acacia Expenses — Purchase Hub-aligned operational submodules (tax-free). */
(function(){
  'use strict';
  const defs = [
    ['payments','Payments','Record supplier and expense payments'],
    ['purchaseorders','Purchase Orders','Create and track orders before bills are received'],
    ['debitnotes','Debit Notes','Record supplier debit adjustments'],
    ['returns','Returns','Track goods returned to suppliers'],
    ['statement','Supplier Statement','Review supplier balances and activity'],
    ['products','Products','Maintain the products and services used on expenses and purchasing'],
    ['drafts','Drafts','Continue unfinished expenses and purchasing records']
  ];
  const fields = {
    payments:[['date','Date','date'],['supplier','Supplier','text'],['reference','Reference','text'],['amount','Amount','number'],['method','Payment method','text'],['notes','Notes','text']],
    purchaseorders:[['date','Order date','date'],['supplier','Supplier','text'],['reference','Order number','text'],['description','Description','text'],['quantity','Quantity','number'],['amount','Total amount','number'],['status','Status','select:Draft,Sent,Partially Received,Received,Cancelled']],
    debitnotes:[['date','Date','date'],['supplier','Supplier','text'],['reference','Debit note number','text'],['bill','Related bill','text'],['reason','Reason','text'],['amount','Amount','number'],['status','Status','select:Draft,Issued,Applied']],
    returns:[['date','Return date','date'],['supplier','Supplier','text'],['reference','Return number','text'],['product','Product','text'],['quantity','Quantity','number'],['reason','Reason','text'],['status','Status','select:Draft,Sent,Accepted,Rejected']],
    products:[['name','Product / service name','text'],['sku','SKU / Code','text'],['category','Category','text'],['unit','Unit','text'],['price','Default unit price','number'],['description','Description','text']]
  };
  const labels = {payments:'Payment',purchaseorders:'Purchase Order',debitnotes:'Debit Note',returns:'Supplier Return',products:'Product'};
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function dbRef(){return window.db||null;}
  function ensure(){const d=dbRef(); if(!d)return; ['payments','purchaseOrders','debitNotes','supplierReturns','products'].forEach(k=>{if(!Array.isArray(d[k]))d[k]=[];});}
  function key(v){return ({payments:'payments',purchaseorders:'purchaseOrders',debitnotes:'debitNotes',returns:'supplierReturns',products:'products'})[v];}
  function addNavAndViews(){
    const groups=document.querySelectorAll('.sidebar .nav-group');
    const hub=Array.from(groups).find(g=>g.querySelector('.nav-label')?.textContent.trim()==='Purchase Hub');
    if(hub){hub.querySelector('.nav-label').textContent='Expenses Hub';}
    const reports=Array.from(groups).find(g=>g.querySelector('.nav-label')?.textContent.trim()==='Reports');
    const settings=Array.from(groups).find(g=>g.querySelector('.nav-label')?.textContent.trim()==='Settings');
    // Existing categories are operational configuration, not a Settings submodule.
    const categories=document.querySelector('.nav-item[data-view="categories"]');
    if(categories){categories.remove(); if(hub)hub.appendChild(categories);}
    const connect=document.querySelector('.nav-item[data-view="connect"]');
    if(connect)connect.remove();
    if(settings)settings.querySelectorAll('.nav-item').forEach(n=>{if(n.dataset.view!=='appearance')n.remove();});
    if(hub){
      defs.forEach(([id,title])=>{
        if(hub.querySelector(`[data-view="${id}"]`))return;
        const el=document.createElement('div');el.className='nav-item';el.dataset.view=id;el.innerHTML='<span class="nav-dot"></span>'+title;hub.appendChild(el);
      });
      // Put Products first among operational submodules.
      const product=hub.querySelector('[data-view="products"]'); const first=hub.querySelector('[data-view="bills"]');
      if(product&&first)hub.insertBefore(product,first);
    }
    const main=document.querySelector('.main');
    defs.forEach(([id,title,sub])=>{
      if(document.getElementById('view-'+id))return;
      const view=document.createElement('div');view.className='view';view.id='view-'+id;
      view.innerHTML=`<div class="view-header"><div><div class="view-title">${title}</div><div class="view-sub">${sub}</div></div>${id==='statement'||id==='drafts'?'':'<div class="toolbar"><button class="btn btn-primary" data-add="'+id+'">＋ New '+(labels[id]||title.replace(/s$/,''))+'</button></div>'}</div><div class="table-wrap"><div class="filter-bar"><input class="grow" data-filter="${id}" placeholder="Search ${title.toLowerCase()}..." /></div><div id="${id}Host"></div></div>`;
      const reportsView=document.getElementById('view-reports');main.insertBefore(view,reportsView||null);
    });
    document.getElementById('view-taxsettings')?.remove();
  }
  function renderTable(id){
    ensure();const d=dbRef();if(!d)return;const arr=d[key(id)]||[];const host=document.getElementById(id+'Host');if(!host)return;
    const q=(document.querySelector(`[data-filter="${id}"]`)?.value||'').toLowerCase();
    let rows=arr.filter(r=>Object.values(r).join(' ').toLowerCase().includes(q));
    if(id==='statement'){
      const suppliers=d.suppliers||[];const bills=Array.isArray(d.bills)?d.bills:[];
      const sums={};bills.forEach(b=>{const s=b.supplier||'Unassigned';sums[s]=(sums[s]||0)+Number(b.total||b.amount||0)-Number(b.paid||0);});
      host.innerHTML=`<table class="data-table"><thead><tr><th>Supplier</th><th>Outstanding balance</th><th>Currency</th></tr></thead><tbody>${suppliers.map(s=>`<tr><td>${esc(s.name||s.supplier||'')}</td><td>${esc(fmt(sums[s.name]||0))}</td><td>${esc(s.currency||'Company currency')}</td></tr>`).join('')||'<tr><td colspan="3">No supplier activity yet.</td></tr>'}</tbody></table>`;return;
    }
    if(id==='drafts'){
      const ex=(d.expenses||[]).filter(x=>x.status==='Draft').map(x=>({type:'Expense',reference:x.expNo||x.number||'',description:x.description||'',date:x.date||''}));
      const bs=(d.bills||[]).filter(x=>x.status==='Draft').map(x=>({type:'Bill',reference:x.billNo||x.number||'',description:x.description||x.supplier||'',date:x.date||''}));
      const all=ex.concat(bs);host.innerHTML=`<table class="data-table"><thead><tr><th>Type</th><th>Reference</th><th>Description</th><th>Date</th></tr></thead><tbody>${all.map(x=>`<tr><td>${esc(x.type)}</td><td>${esc(x.reference)}</td><td>${esc(x.description)}</td><td>${esc(x.date)}</td></tr>`).join('')||'<tr><td colspan="4">No draft records.</td></tr>'}</tbody></table>`;return;
    }
    const cols=(fields[id]||[]).map(f=>f[0]);
    host.innerHTML=`<table class="data-table"><thead><tr>${(fields[id]||[]).map(f=>`<th>${esc(f[1])}</th>`).join('')}<th>Actions</th></tr></thead><tbody>${rows.map((r)=>`<tr>${cols.map(c=>`<td>${esc(r[c])}</td>`).join('')}<td><button class="btn" data-edit="${id}" data-id="${esc(r.id)}">Edit</button> <button class="btn btn-danger-text" data-delete="${id}" data-id="${esc(r.id)}">Delete</button></td></tr>`).join('')||`<tr><td colspan="${cols.length+1}">No ${titleCase(id)} recorded yet.</td></tr>`}</tbody></table>`;
  }
  function titleCase(s){return s.replace(/([a-z])([A-Z])/g,'$1 $2');}
  function fmt(n){try{return new Intl.NumberFormat(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0)}catch(e){return String(n||0)}}
  function openForm(id,record){
    const fs=fields[id]||[];const overlay=document.createElement('div');overlay.className='overlay active';overlay.style.zIndex='10020';
    const panel=document.createElement('div');panel.className='side-panel open';panel.style.cssText='z-index:10021;width:min(520px,95vw);';
    panel.innerHTML=`<div class="side-head"><div><div class="det-title">${record?'Edit':'New'} ${esc(labels[id]||id)}</div><div class="det-sub">Enter the record details</div></div><button class="side-close" type="button">✕</button></div><div class="side-body"><form class="form-grid">${fs.map(([k,l,t])=>`<div class="field ${t==='text'&&k==='description'?'full':''}"><label>${esc(l)}</label>${t.startsWith('select:')?`<select name="${k}">${t.slice(7).split(',').map(v=>`<option ${record?.[k]===v?'selected':''}>${esc(v)}</option>`).join('')}</select>`:`<input name="${k}" type="${t}" ${t==='number'?'min="0" step="0.01"':''} value="${esc(record?.[k]??(t==='date'?new Date().toISOString().slice(0,10):''))}" ${k==='name'?'required':''}>`}</div>`).join('')}</form></div><div class="side-foot"><button class="btn" data-cancel>Cancel</button><button class="btn btn-primary" data-save>Save</button></div>`;
    document.body.append(overlay,panel);function close(){overlay.remove();panel.remove();}panel.querySelector('.side-close').onclick=close;panel.querySelector('[data-cancel]').onclick=close;overlay.onclick=close;
    panel.querySelector('[data-save]').onclick=()=>{ensure();const d=dbRef();const form=panel.querySelector('form');const obj={...(record||{}),id:record?.id||('rec-'+Math.random().toString(36).slice(2,10)),updatedAt:new Date().toISOString()};fs.forEach(([k,,t])=>{const v=form.elements[k].value;obj[k]=t==='number'?(Number(v)||0):v;});if(id==='products'&&!obj.name.trim()){alert('Enter a product or service name.');return;}const arr=d[key(id)];const ix=arr.findIndex(x=>x.id===obj.id);if(ix>=0)arr[ix]=obj;else arr.unshift(obj);saveDB();close();renderTable(id);};
  }
  function saveDB(){if(typeof window.saveDB==='function')window.saveDB();}
  document.addEventListener('click',e=>{
    const add=e.target.closest('[data-add]');if(add){openForm(add.dataset.add,null);return;}
    const edit=e.target.closest('[data-edit]');if(edit){const d=dbRef();const rec=(d[key(edit.dataset.edit)]||[]).find(x=>x.id===edit.dataset.id);if(rec)openForm(edit.dataset.edit,rec);return;}
    const del=e.target.closest('[data-delete]');if(del){if(!confirm('Delete this record?'))return;const d=dbRef();d[key(del.dataset.delete)]=(d[key(del.dataset.delete)]||[]).filter(x=>x.id!==del.dataset.id);saveDB();renderTable(del.dataset.delete);}
  });
  document.addEventListener('input',e=>{const f=e.target.closest('[data-filter]');if(f)renderTable(f.dataset.filter);});
  document.addEventListener('DOMContentLoaded',()=>{
    addNavAndViews();
    document.querySelectorAll('.nav-item[data-view]').forEach(item=>{
      if(item.dataset.expansionBound)return;item.dataset.expansionBound='1';
      const v=item.dataset.view;
      if(defs.some(d=>d[0]===v)||v==='statement'||v==='drafts')item.addEventListener('click',()=>{
        document.querySelectorAll('.nav-item[data-view]').forEach(n=>n.classList.remove('active'));
        item.classList.add('active');document.querySelectorAll('.view').forEach(n=>n.classList.remove('active'));
        document.getElementById('view-'+v)?.classList.add('active');renderTable(v);
      });
    });
    // Settings contains Appearance only; Company Connection and Taxes are excluded.
    const oldNav=document.querySelector('.nav-item[data-view="categories"]');
    if(oldNav)oldNav.textContent='Expense Categories';
  });
  // Add a compact table style that matches the Expenses/Purchase interface.
  const style=document.createElement('style');style.textContent='.data-table{width:100%;border-collapse:collapse;font-size:13px;background:var(--surface,#fff)}.data-table th,.data-table td{padding:10px 12px;border-bottom:1px solid var(--line,#e5e7eb);text-align:left;vertical-align:middle}.data-table th{font-weight:700;color:var(--ink-soft,#64748b);background:var(--surface-2,#f8fafc);white-space:nowrap}.data-table td .btn{padding:5px 9px;font-size:12px}.sidebar .nav-item{cursor:pointer}';document.head.appendChild(style);
})();
