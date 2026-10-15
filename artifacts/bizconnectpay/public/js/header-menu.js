(function(){
  var h=document.querySelector('[data-site-header]');if(!h)return;
  var btn=h.querySelector('.sh-toggle'),panel=document.getElementById('sh-menu');
  var tr=function(s){return typeof window.bcpT==='function'?window.bcpT(s):s};
  function isOpen(){return btn&&btn.getAttribute('aria-expanded')==='true'}
  function setOpen(o,restore){
    if(!btn||!panel)return;
    btn.setAttribute('aria-expanded',o?'true':'false');
    btn.setAttribute('aria-label',o?(btn.getAttribute('data-label-close')||tr('Fermer le menu')):(btn.getAttribute('data-label-open')||tr('Ouvrir le menu')));
    panel.hidden=!o;
    if(o){var f=panel.querySelector('a,select,[tabindex]');if(f)f.focus()}else if(restore)btn.focus();
  }
  if(btn)btn.addEventListener('click',function(){setOpen(!isOpen(),false)});
  if(panel)panel.addEventListener('click',function(e){if(e.target.closest('a'))setOpen(false,false)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&isOpen()){setOpen(false,true)}});
  document.addEventListener('click',function(e){if(isOpen()&&!h.contains(e.target))setOpen(false,false)});
  var mq=matchMedia('(min-width:960px)');var onMq=function(){if(mq.matches&&isOpen())setOpen(false,false)};
  if(mq.addEventListener)mq.addEventListener('change',onMq);else if(mq.addListener)mq.addListener(onMq);
  function mark(target){
    var id=typeof target==='string'?target:(location.hash||'#accueil').slice(1);if(!document.getElementById(id))id='accueil';
    h.querySelectorAll('[data-nav-link]').forEach(function(a){
      if(a.getAttribute('href')==='#'+id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
    });
  }
  h.addEventListener('click',function(e){
    var link=e.target.closest('[data-nav-link]');
    if(link&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey)mark(link.getAttribute('href').slice(1));
  });
  addEventListener('hashchange',mark);mark();
  h.querySelectorAll('.is-off').forEach(function(el){el.addEventListener('click',function(e){e.preventDefault()})});
})();
