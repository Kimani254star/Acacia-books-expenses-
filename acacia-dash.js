/* Acacia suite dashboard kit — helpers. Exposes window.AcxDash.
   Amounts are always written out in full (KES 6,800,000), never shortened to 6.8M. */
(function(){
  var P = {
    users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    cart:'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    bag:'<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    check:'<polyline points="20 6 9 17 4 12"/>',
    clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    wallet:'<path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 1 0-4h14"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
    folder:'<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    layers:'<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    trend:'<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    percent:'<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    alert:'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    play:'<polygon points="5 3 19 12 5 21 5 3"/>',
    bar:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    bolt:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    spark:'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
    trophy:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    bulb:'<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
    box:'<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    receipt:'<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="14" y2="13"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    flag:'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    tag:'<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    arrow:'<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'
  };
  function icon(n, extra){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '+(extra||'')+'>'+(P[n]||P.grid)+'</svg>'; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  /* full amounts, no K/M shortening */
  function money(n, cur, dp){ n = Number(n)||0; dp = dp==null ? (Math.abs(n % 1) > 0.004 && dp!==0 ? 2 : 0) : dp; return (cur==null?'KES':cur) + ' ' + n.toLocaleString('en-KE',{minimumFractionDigits:dp,maximumFractionDigits:dp}); }
  function num(n){ return (Number(n)||0).toLocaleString('en-KE'); }
  function pct(a,b){ return b>0 ? Math.round(a/b*100) : 0; }

  /* percentage change vs previous period; returns HTML or '' when there is nothing honest to compare */
  function delta(cur, prev, suffix){
    if(prev==null || !isFinite(prev) || prev===0) return '';
    var p = (cur-prev)/Math.abs(prev)*100;
    if(Math.abs(p) < 0.5) return '<div class="ad-kd flat">No change'+(suffix?' '+esc(suffix):'')+'</div>';
    return '<div class="ad-kd '+(p<0?'dn':'')+'">'+(p<0?'▼':'▲')+' '+(p>0?'+':'')+Math.round(p)+'%'+(suffix?' '+esc(suffix):'')+'</div>';
  }
  function kpi(o){
    return '<div class="ad-card ad-kpi"><div class="ad-disc '+(o.color||'green')+'">'+icon(o.icon)+'</div><div class="ad-kb"><div class="ad-kl">'+esc(o.label)+'</div><div class="ad-kv" title="'+esc(o.value)+'">'+esc(o.value)+'</div>'+(o.delta||'')+'</div></div>';
  }
  function head(o){
    return '<div class="ad-head"><div><div class="ad-title">'+icon(o.icon||'grid')+'<h1>'+esc(o.title)+'</h1></div>'+(o.sub?'<div class="ad-sub">'+esc(o.sub)+'</div>':'')+'</div><div class="ad-chips">'+(o.right||'')+'</div></div>';
  }
  function card(title, body, o){ o=o||{};
    return '<div class="ad-card '+(o.cls||'')+'">'+(title?'<div class="ad-ch"><span class="l">'+(o.icon?icon(o.icon):'')+esc(title)+'</span>'+(o.right||'')+'</div>':'')+body+'</div>'; }

  var COL = ['#1b7a2f','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#ef4444','#84cc16'];
  function donut(segs, o){ o=o||{};
    var tot = segs.reduce(function(s,x){return s+(Number(x.v)||0);},0), R=42, C=2*Math.PI*R, off=0, arcs='';
    if(!tot){ arcs='<circle cx="50" cy="50" r="'+R+'" fill="none" stroke="#e9edf0" stroke-width="13"/>'; }
    else segs.forEach(function(x,i){ var v=Number(x.v)||0; if(!v) return; var len=v/tot*C;
      arcs+='<circle cx="50" cy="50" r="'+R+'" fill="none" stroke="'+(x.c||COL[i%COL.length])+'" stroke-width="13" stroke-dasharray="'+len.toFixed(2)+' '+(C-len).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'"/>'; off+=len; });
    var leg = segs.map(function(x,i){ return '<div class="ad-lg"><i style="background:'+(x.c||COL[i%COL.length])+'"></i>'+esc(x.l)+'<b>'+(x.t!=null?esc(x.t):esc(num(x.v)))+'</b></div>'; }).join('');
    return '<div class="ad-donutwrap"><div class="ad-donut"><svg viewBox="0 0 100 100">'+arcs+'</svg><div class="c"><div>'+esc(o.center==null?'':o.center)+(o.sub?'<small>'+esc(o.sub)+'</small>':'')+'</div></div></div><div class="ad-legend">'+leg+'</div></div>';
  }
  /* nice axis maximum + 4 gridlines labelled in full */
  function niceMax(m){ if(m<=0) return 4; var e=Math.pow(10,Math.floor(Math.log10(m))), f=m/e, n=f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10; return n*e; }
  function bars(labels, series, o){ o=o||{}; // series: [{name,color,values[]}] ; stacked or grouped
    var max=0, n=labels.length;
    if(o.stacked){ for(var i=0;i<n;i++){ var t=0; series.forEach(function(s){t+=Number(s.values[i])||0;}); max=Math.max(max,t); } }
    else series.forEach(function(s){ s.values.forEach(function(v){ max=Math.max(max,Number(v)||0); }); });
    var top=niceMax(max), grid='';
    for(var g=0; g<=4; g++){ var v=top*g/4; grid+='<div class="g" style="bottom:'+(g*25)+'%"><span>'+esc((o.axisFmt||num)(v))+'</span></div>'; }
    var cols = labels.map(function(l,i){
      var inner;
      if(o.stacked){ inner='<div class="ad-bstack" style="height:'+(100*(series.reduce(function(s,x){return s+(Number(x.values[i])||0);},0))/top).toFixed(1)+'%">'+series.slice().reverse().map(function(s){var v=Number(s.values[i])||0; var tt=series.reduce(function(a,x){return a+(Number(x.values[i])||0);},0)||1; return '<i title="'+esc(s.name)+': '+esc((o.tipFmt||num)(v))+'" style="height:'+(v/tt*100).toFixed(1)+'%;background:'+s.color+'"></i>';}).join('')+'</div>'; }
      else inner='<div class="ad-bgrp">'+series.map(function(s){var v=Number(s.values[i])||0; return '<i title="'+esc(s.name)+': '+esc((o.tipFmt||num)(v))+'" style="height:'+(v/top*100).toFixed(1)+'%;background:'+s.color+'"></i>';}).join('')+'</div>';
      return '<div class="ad-bcol"><div style="flex:1;display:flex;align-items:flex-end;width:100%;justify-content:center">'+inner+'</div><div class="ad-bl">'+esc(l)+'</div></div>';
    }).join('');
    return '<div class="ad-bars" style="height:'+(o.h||200)+'px;padding-bottom:22px;--p:'+(o.pad||34)+'px">'+grid+cols+'</div>';
  }
  function keys(items){ return '<div class="ad-keys">'+items.map(function(i){return '<span><i style="background:'+i.c+'"></i>'+esc(i.l)+'</span>';}).join('')+'</div>'; }
  function hbar(label, v, max, valueText, color){ return '<div class="ad-hbar"><span>'+esc(label)+'</span><div class="t"><i style="width:'+Math.min(100,max>0?v/max*100:0).toFixed(0)+'%;'+(color?'background:'+color:'')+'"></i></div><b>'+esc(valueText==null?num(v):valueText)+'</b></div>'; }
  function line(labels, values, o){ o=o||{};
    var W=560,H=210,L=(o.pad||44),Rr=14,T=14,B=26, max=niceMax(Math.max.apply(null,values.concat([0]))), n=values.length, fmtA=o.axisFmt||num;
    var X=function(i){return L+(n<2?(W-L-Rr)/2:i*(W-L-Rr)/(n-1));}, Y=function(v){return T+(H-T-B)*(1-v/max);};
    var g='',k; for(k=0;k<=4;k++){ var yy=T+(H-T-B)*k/4; g+='<line x1="'+L+'" x2="'+(W-Rr)+'" y1="'+yy+'" y2="'+yy+'" stroke="#e5e7eb" stroke-dasharray="3 3"/><text x="'+(L-6)+'" y="'+(yy+4)+'" text-anchor="end">'+esc(fmtA(max*(4-k)/4))+'</text>'; }
    var pts=values.map(function(v,i){return X(i).toFixed(1)+','+Y(v).toFixed(1);}), area='M'+X(0)+','+(H-B)+' L'+pts.join(' L')+' L'+X(n-1)+','+(H-B)+' Z';
    var xl=labels.map(function(l,i){return '<text x="'+X(i)+'" y="'+(H-8)+'" text-anchor="middle">'+esc(l)+'</text>';}).join('');
    var dots=values.map(function(v,i){return '<circle cx="'+X(i)+'" cy="'+Y(v)+'" r="3.5" fill="#fff" stroke="'+(o.color||'#1b7a2f')+'" stroke-width="2"><title>'+esc(labels[i])+': '+esc((o.tipFmt||num)(v))+'</title></circle>';}).join('');
    return '<svg class="ad-line" viewBox="0 0 '+W+' '+H+'">'+g+'<path d="'+area+'" fill="'+(o.color||'#1b7a2f')+'" opacity=".10"/><polyline points="'+pts.join(' ')+'" fill="none" stroke="'+(o.color||'#1b7a2f')+'" stroke-width="2.2" stroke-linejoin="round"/>'+dots+xl+'</svg>';
  }
  function qa(title, items){ return '<div class="ad-qa"><h3>'+esc(title)+'</h3>'+items.map(function(i){return '<button class="ad-qb" onclick="'+i.on+'">'+icon(i.icon||'plus')+esc(i.label)+'</button>';}).join('')+'</div>'; }
  function promo(o){ return '<div class="ad-promo '+(o.center?'center':'')+'"><div class="ic">'+icon(o.icon||'trophy')+'</div><div><b>'+esc(o.title)+'</b>'+(o.text?'<p>'+esc(o.text)+'</p>':'')+(o.btn?'<button class="ad-cta" onclick="'+o.on+'">'+esc(o.btn)+icon('arrow','style="width:14px;height:14px"')+'</button>':'')+'</div></div>'; }
  function ai(text, btn, on){ return '<div class="ad-aibox"><b>'+icon('spark')+'Acacia AI</b><p>'+esc(text)+'</p>'+(btn?'<button class="ad-cta" onclick="'+on+'">'+esc(btn)+icon('arrow','style="width:14px;height:14px"')+'</button>':'')+'</div>'; }
  function pill(t, cls){ return '<span class="ad-pill '+(cls||'m')+'">'+esc(t)+'</span>'; }
  function initials(s){ s=String(s||'?').trim().split(/\s+/); return ((s[0]||'?')[0]+((s[1]||'')[0]||'')).toUpperCase(); }
  function ago(ts){ var d=(Date.now()-new Date(ts).getTime())/1000; if(!isFinite(d)) return ''; if(d<90) return 'just now'; if(d<3600) return Math.round(d/60)+'m ago'; if(d<86400) return Math.round(d/3600)+' hours ago'; if(d<172800) return '1 day ago'; return Math.round(d/86400)+' days ago'; }
  function dstr(d,o){ var x=new Date(d); return isNaN(x)?'':x.toLocaleDateString('en-GB',o||{day:'2-digit',month:'short',year:'numeric'}); }

  /* periods: today | week | month | quarter | year (+ previous equivalent for deltas) */
  function iso(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function range(key, back){ back=back||0; var n=new Date(), a, b, y=n.getFullYear(), m=n.getMonth(), q=Math.floor(m/3);
    if(key==='today'){ a=new Date(y,m,n.getDate()-back); b=new Date(a); }
    else if(key==='week'){ var dow=(n.getDay()+6)%7; a=new Date(y,m,n.getDate()-dow-7*back); b=new Date(a.getFullYear(),a.getMonth(),a.getDate()+6); }
    else if(key==='quarter'){ a=new Date(y,(q-back)*3,1); b=new Date(a.getFullYear(),a.getMonth()+3,0); }
    else if(key==='year'){ a=new Date(y-back,0,1); b=new Date(y-back,11,31); }
    else { a=new Date(y,m-back,1); b=new Date(y,m-back+1,0); }
    return {from:iso(a), to:iso(b)}; }
  function within(dateStr, r){ var d=String(dateStr||'').slice(0,10); return !!d && d>=r.from && d<=r.to; }
  var LABEL={today:'Today',week:'This Week',month:'This Month',quarter:'This Quarter',year:'This Year'};
  function periodSelect(app, cur, keys){ keys=keys||['today','week','month','quarter','year'];
    return '<select class="ad-sel green" aria-label="Period" onchange="AcxDash.setPeriod(\''+app+'\',this.value)">'+keys.map(function(k){return '<option value="'+k+'"'+(k===cur?' selected':'')+'>'+LABEL[k]+'</option>';}).join('')+'</select>'; }
  var periods={};
  function getPeriod(app, dflt){ if(periods[app]) return periods[app]; try{ var s=localStorage.getItem('acx_dash_period_'+app); if(s&&LABEL[s]) return (periods[app]=s);}catch(e){} return dflt||'month'; }
  var rerender={};
  function setPeriod(app,v){ periods[app]=v; try{localStorage.setItem('acx_dash_period_'+app,v);}catch(e){} if(rerender[app]) rerender[app](); }
  function onPeriod(app, fn){ rerender[app]=fn; }

  /* topbar polish: serif tagline + unread badge, shared by all apps */
  function polishTopbar(tagline, sel){
    try{
      var bar = document.querySelector(sel || '#topbar, header.flex, .topbar, #top, header'); if(!bar || bar.querySelector('.ad-tagline')) return;
      var t=document.createElement('div'); t.className='ad-tagline'; t.textContent=tagline;
      var first=bar.firstElementChild; if(first && first.nextSibling) bar.insertBefore(t, first.nextSibling); else bar.appendChild(t);
    }catch(e){}
  }
  window.AcxDash = {icon:icon,esc:esc,money:money,num:num,pct:pct,delta:delta,kpi:kpi,head:head,card:card,donut:donut,bars:bars,keys:keys,hbar:hbar,line:line,qa:qa,promo:promo,ai:ai,pill:pill,initials:initials,ago:ago,dstr:dstr,
    range:range,within:within,periodSelect:periodSelect,getPeriod:getPeriod,setPeriod:setPeriod,onPeriod:onPeriod,LABEL:LABEL,COL:COL,polishTopbar:polishTopbar,iso:iso};
})();
