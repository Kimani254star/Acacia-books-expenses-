/* Acacia Expenses — dashboard rebuilt to the suite design. Wraps renderDashboard() from script.js. */
(function(){
  var D = window.AcxDash, E = D.esc;
  var st = document.createElement('style');
  st.textContent = '#view-dashboard>.card-grid,#view-dashboard>.dash-row,#view-dashboard>.view-header .view-title,#view-dashboard>.view-header .view-sub{display:none!important}#view-dashboard>.view-header{justify-content:flex-end;margin-bottom:0}';
  document.head.appendChild(st);

  function sum(a,f){ return a.reduce(function(s,x){ return s+(Number(f(x))||0); },0); }
  function limitKey(){ return 'acx_exp_limit_' + ((typeof CURRENT_USER!=='undefined' && CURRENT_USER && CURRENT_USER.companyId) || 'x'); }
  function getLimit(){ try{ return Number(localStorage.getItem(limitKey()))||0; }catch(e){ return 0; } }
  window.acxSetExpenseLimit = function(){
    var cur = getLimit();
    var v = prompt('Monthly expense limit in KES (leave empty to remove it):', cur||'');
    if(v===null) return;
    v = Number(String(v).replace(/[^0-9.]/g,''))||0;
    try{ if(v>0) localStorage.setItem(limitKey(), String(v)); else localStorage.removeItem(limitKey()); }catch(e){}
    if(typeof toast==='function') toast(v>0 ? 'Monthly limit set to '+D.money(v) : 'Monthly limit removed');
    renderDashboard();
  };
  var ST = {'Paid':'g','Approved':'g','Posted':'b','Submitted':'o','Pending Approval':'o','Draft':'m','Rejected':'r'};

  function mount(){
    var host = document.getElementById('adExpMount');
    if(!host){ var v=document.getElementById('view-dashboard'); if(!v) return null; host=document.createElement('div'); host.id='adExpMount'; v.appendChild(host); }
    return host;
  }
  function paint(){
    var host = mount(); if(!host) return;
    var per = D.getPeriod('expenses','month'), cur = D.range(per,0), prv = D.range(per,1);
    var all = costRows(), inC = all.filter(function(e){return D.within(e.date,cur);}), inP = all.filter(function(e){return D.within(e.date,prv);});
    var total = sum(inC,function(e){return e.total;}), ptotal = sum(inP,function(e){return e.total;});
    var appr = inC.filter(function(e){return e.status==='Approved';}), pappr = inP.filter(function(e){return e.status==='Approved';});
    var pend = inC.filter(function(e){return e.status==='Pending Approval'||e.status==='Submitted';}), ppend = inP.filter(function(e){return e.status==='Pending Approval'||e.status==='Submitted';});
    var A = sum(appr,function(e){return e.total;}), PA = sum(pappr,function(e){return e.total;}), Pe = sum(pend,function(e){return e.total;}), PPe = sum(ppend,function(e){return e.total;});
    var vs = 'vs last ' + (per==='today'?'day':per);

    var limit = getLimit(), mk = D.range('month',0), monthSpend = sum(all.filter(function(e){return D.within(e.date,mk);}),function(e){return e.total;});
    var usage = limit>0 ? Math.round(monthSpend/limit*100) : null;
    var budgetKpi = D.kpi({icon:'target',color:'purple',label:'Budget Usage',value: usage==null ? 'No limit set' : usage+'%',
      delta: usage==null ? '<div class="ad-kd flat"><a class="ad-link" onclick="acxSetExpenseLimit()">Set a monthly limit</a></div>' : '<div class="ad-kd '+(usage>100?'dn':'')+'">'+D.money(monthSpend)+' of '+D.money(limit)+'</div>'});

    var byCat = {}; inC.forEach(function(e){ byCat[e.category||'Other'] = (byCat[e.category||'Other']||0) + (Number(e.total)||0); });
    var cats = Object.keys(byCat).map(function(k){return {k:k,v:byCat[k]};}).sort(function(a,b){return b.v-a.v;});
    var shown = cats.slice(0,4), rest = cats.slice(4); if(rest.length) shown.push({k:'Others',v:sum(rest,function(x){return x.v;})});
    var catTot = sum(shown,function(x){return x.v;});
    var donut = shown.length ? D.donut(shown.map(function(x,i){ return {l:x.k,v:x.v,t:D.pct(x.v,catTot)+'%',c:['#1b7a2f','#3b82f6','#f59e0b','#ec4899','#8b5cf6'][i]}; }),
        {center: usage==null ? D.num(inC.length) : usage+'%', sub: usage==null ? 'expenses' : 'of limit'}) : '<div class="ad-empty">No expenses in this period.</div>';

    var labels=[], vals=[], n=new Date();
    for(var k=5;k>=0;k--){ var d=new Date(n.getFullYear(),n.getMonth()-k,1), key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      labels.push(d.toLocaleDateString('en-GB',{month:'short'})); vals.push(sum(all.filter(function(e){return String(e.date).slice(0,7)===key;}),function(e){return e.total;})); }

    var recent = all.slice().sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); }).slice(0,5);
    var rec = recent.length ? '<div class="ad-scroll"><table class="ad-tbl"><tbody>'+recent.map(function(e){
        return '<tr><td>'+E(e.description||e.category||'')+'<span style="display:block;color:#6b7280;font-size:11.5px">'+E(e.category||'')+'</span></td><td class="r">'+D.money(e.total)+'</td><td>'+D.pill(e.status,ST[e.status])+'</td><td>'+E(D.dstr(e.date,{day:'numeric',month:'short'}))+'</td></tr>'; }).join('')+'</tbody></table></div>'
      : '<div class="ad-empty">No expenses yet. Record your first expense to see activity here.</div>';

    host.innerHTML = '<div class="ad">'
      + D.head({icon:'wallet',title:'Expenses Dashboard',sub:'Track Spending. Control Costs.',right:D.periodSelect('expenses',per)})
      + '<div class="ad-kpis">'
        + D.kpi({icon:'wallet',color:'green',label:'Total Expenses',value:D.money(total),delta:D.delta(total,ptotal,vs)})
        + D.kpi({icon:'check',color:'blue',label:'Approved',value:D.money(A),delta:D.delta(A,PA,vs)})
        + D.kpi({icon:'clock',color:'orange',label:'Pending',value:D.money(Pe),delta:D.delta(Pe,PPe,vs)})
        + budgetKpi
      + '</div>'
      + '<div class="ad-row ad-r-2">'
        + D.card('By Category', donut, {icon:'layers'})
        + D.card('Monthly Expenses', D.bars(labels,[{name:'Expenses',color:'#1b7a2f',values:vals}],{pad:78,tipFmt:function(v){return D.money(v);}}), {icon:'bar'})
      + '</div>'
      + '<div class="ad-row ad-r-32">'
        + D.card('Recent Expenses', rec, {icon:'receipt',right:'<button class="ad-link" onclick="document.querySelector(\'.nav-item[data-view=expenses]\').click()">View all</button>'})
        + D.promo({icon:'bulb',title:'Control Costs',text:'Set expense limits and get alerts.',btn:'Set Limits',on:'acxSetExpenseLimit()'})
      + '</div></div>';
  }
  var orig = window.renderDashboard;
  window.renderDashboard = function(){ try{ orig && orig(); }catch(e){} paint(); };
  D.onPeriod('expenses', function(){ window.renderDashboard(); });
  function tag(){ D.polishTopbar('Track Spending. Control Costs.', '.topbar'); }
  tag(); document.addEventListener('DOMContentLoaded', tag);
})();
