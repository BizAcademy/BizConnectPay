(function(){
  var f=document.querySelector('[data-admin-countries]');if(!f)return;
  var boxes=[].slice.call(f.querySelectorAll('input[name=countryCodes]')),items=[].slice.call(f.querySelectorAll('.ac-list li'));
  var cnt=f.querySelector('[data-ac-count]'),q=f.querySelector('[data-ac-q]'),empty=f.querySelector('[data-ac-empty]');
  function norm(s){s=String(s||'').toLowerCase();try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')}catch(e){}return s}
  items.forEach(function(li){li._k=norm(li.getAttribute('data-k'))});
  function upd(){cnt.textContent=boxes.filter(function(b){return b.checked}).length+' / '+boxes.length+' pays cochés'}
  function all(v){boxes.forEach(function(b){b.checked=v});upd()}
  f.querySelector('[data-ac-all]').addEventListener('click',function(){all(true)});
  f.querySelector('[data-ac-none]').addEventListener('click',function(){all(false)});
  f.addEventListener('change',upd);
  q.addEventListener('input',function(){var s=norm(q.value).trim(),n=0;items.forEach(function(li){li.hidden=!!s&&li._k.indexOf(s)<0;if(!li.hidden)n++});empty.hidden=n>0});
  q.addEventListener('keydown',function(e){if(e.key==='Enter')e.preventDefault()});
  upd();
})();
