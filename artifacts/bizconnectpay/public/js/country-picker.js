(function(){
  var root=document.querySelector('[data-country-picker]');if(!root)return;
  var form=root.closest('form');
  var btn=root.querySelector('.cp-btn'),pop=root.querySelector('.cp-pop'),q=root.querySelector('.cp-q'),list=root.querySelector('.cp-list'),none=root.querySelector('.cp-none');
  var hidIso=document.getElementById('ct-iso'),hidCc=document.getElementById('ct-cc');
  var bFlag=btn.querySelector('.cp-flag'),bDial=btn.querySelector('.cp-dial'),bSr=btn.querySelector('.cp-btn-sr');
  var opts=[].slice.call(list.querySelectorAll('[role=option]'));
  var tpl=root.getAttribute('data-label-tpl')||'{country}';
  var defIso=root.getAttribute('data-default')||'';
  var active=-1;
  function norm(s){s=String(s||'').toLowerCase();try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')}catch(e){}return s}
  opts.forEach(function(o){o._k=norm(o.getAttribute('data-name')+' '+o.getAttribute('data-iso')+' '+o.getAttribute('data-dial')+' '+o.getAttribute('data-dial').replace('+',''))});
  function vis(){return opts.filter(function(o){return !o.hidden})}
  function find(iso){for(var i=0;i<opts.length;i++)if(opts[i].getAttribute('data-iso')===iso)return opts[i];return null}
  function select(o){
    if(!o||o.getAttribute('aria-disabled')==='true')return false;
    opts.forEach(function(x){x.setAttribute('aria-selected',x===o?'true':'false')});
    var iso=o.getAttribute('data-iso'),dial=o.getAttribute('data-dial'),name=o.getAttribute('data-name');
    hidIso.value=iso;hidCc.value=dial;hidCc.removeAttribute('aria-invalid');
    bFlag.src=o.querySelector('img').getAttribute('src');bDial.textContent=dial;
    bSr.textContent=tpl.replace('{country}',name+' '+dial);
    return true;
  }
  function setActive(i){
    var v=vis();opts.forEach(function(x){x.classList.remove('is-active')});
    if(!v.length){active=-1;q.removeAttribute('aria-activedescendant');return}
    active=Math.max(0,Math.min(i,v.length-1));var o=v[active];o.classList.add('is-active');
    q.setAttribute('aria-activedescendant',o.id);
    var top=o.offsetTop,b=top+o.offsetHeight;if(top<list.scrollTop)list.scrollTop=top;else if(b>list.scrollTop+list.clientHeight)list.scrollTop=b-list.clientHeight;
  }
  function filter(){
    var s=norm(q.value).trim();
    opts.forEach(function(o){o.hidden=!!s&&o._k.indexOf(s)<0});
    var n=vis().length;none.hidden=n>0;q.setAttribute('aria-expanded',n>0?'true':'false');
    setActive(0);
  }
  function open(){
    if(!pop.hidden)return;pop.hidden=false;btn.setAttribute('aria-expanded','true');
    q.value='';filter();var v=vis(),sel=list.querySelector('[aria-selected=true]');
    setActive(sel?v.indexOf(sel):0);q.focus();
  }
  function close(f){if(pop.hidden)return;pop.hidden=true;btn.setAttribute('aria-expanded','false');q.setAttribute('aria-expanded','false');if(f)btn.focus()}
  btn.addEventListener('click',function(){pop.hidden?open():close(true)});
  btn.addEventListener('keydown',function(e){if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();open()}});
  q.addEventListener('input',filter);
  q.addEventListener('keydown',function(e){
    var v=vis();
    if(e.key==='ArrowDown'){e.preventDefault();setActive(active+1)}
    else if(e.key==='ArrowUp'){e.preventDefault();setActive(active-1)}
    else if(e.key==='Home'){e.preventDefault();setActive(0)}
    else if(e.key==='End'){e.preventDefault();setActive(v.length-1)}
    else if(e.key==='Enter'){e.preventDefault();if(v[active]&&select(v[active]))close(true)}
    else if(e.key==='Escape'){e.preventDefault();close(true)}
    else if(e.key==='Tab'){close(false)}
  });
  list.addEventListener('mousedown',function(e){e.preventDefault()});
  list.addEventListener('click',function(e){var o=e.target.closest('[role=option]');if(o&&select(o))close(true)});
  document.addEventListener('click',function(e){if(!root.contains(e.target))close(false)});
  if(form)form.addEventListener('reset',function(){setTimeout(function(){close(false);select(find(defIso))},0)});
  select(find(defIso));
})();
