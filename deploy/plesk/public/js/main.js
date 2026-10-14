function r(){var h=(location.hash||'#accueil').slice(1);var s=document.getElementById(h)||document.getElementById('accueil');document.querySelectorAll('.pg').forEach(function(e){e.classList.toggle('on',e===s)});window.scrollTo(0,0)}
addEventListener('hashchange',r);r();

(function(){
  var f=document.getElementById('news-form');if(!f)return;
  var base=document.body.getAttribute('data-base-path')||'';
  var msg=f.querySelector('.news-msg');var input=f.querySelector('input[name="email"]');var btn=f.querySelector('button');
  function say(t){msg.textContent=t}
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var email=(input.value||'').trim();
    if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){say('Veuillez saisir une adresse e-mail valide.');input.focus();return}
    btn.disabled=true;say('Envoi en cours…');
    fetch(base+'/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'same-origin',body:JSON.stringify({email:email})})
      .then(function(res){return res.json().catch(function(){return {}}).then(function(d){return {ok:res.ok,d:d}})})
      .then(function(o){
        if(o.ok){say(o.d.message||'Merci ! Votre inscription est confirmée.');f.reset()}
        else say(o.d.error||o.d.message||'Inscription impossible pour le moment. Réessayez plus tard.');
      })
      .catch(function(){say('Erreur réseau. Réessayez plus tard.')})
      .then(function(){btn.disabled=false});
  });
})();

/* motion layer (rev motion-1): progressive enhancement, content visible without JS/observer */
(function(){
  var root=document.documentElement;
  if(!('IntersectionObserver' in window)||!window.matchMedia)return;
  var mq=matchMedia('(prefers-reduced-motion: reduce)');
  var sel='.hero-txt>*,.hero-vis,.intro h2,.intro .sub,.st,.simple-vis,.prods .c>*,.prod-txt,.product-visual,.why,.cta,.news,main>h2,main>.sub,.sec>*,.grid>*,.chips>*,details,.doc,.stats>*,footer .cols>*,footer>div>img,footer>div>p';
  var io=null;
  function all(){return document.querySelectorAll('.rv')}
  function showAll(){all().forEach(function(e){e.classList.add('in')})}
  function enable(){
    root.classList.add('m-on');
    var groups=new Map();
    document.querySelectorAll(sel).forEach(function(e){
      if(e.closest('header')||e.closest('[data-car]'))return;
      e.classList.add('rv');
      if(e.classList.contains('hero-vis')||e.classList.contains('product-visual')){
        var box=e.getBoundingClientRect(),parent=e.parentNode.getBoundingClientRect();
        var side;
        if(matchMedia('(min-width:900px)').matches||(e.classList.contains('product-visual')&&matchMedia('(min-width:760px)').matches)){
          side=box.left+box.width/2<parent.left+parent.width/2?'left':'right';
        }else{
          side=e.classList.contains('hero-vis')||e.closest('.prod.rev')?'left':'right';
        }
        e.classList.remove('rv-left','rv-right');
        e.classList.add('rv-'+side);
        e.style.setProperty('--d','80ms');
      }
      var p=e.parentNode,i=groups.get(p)||0;groups.set(p,i+1);
      if(!e.classList.contains('hero-vis')&&!e.classList.contains('product-visual'))e.style.setProperty('--d',Math.min(i,6)*70+'ms');
    });
    io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{rootMargin:'0px 0px -8% 0px',threshold:0});
    all().forEach(function(e){if(!e.classList.contains('in'))io.observe(e)});
  }
  function disable(){root.classList.remove('m-on');if(io){io.disconnect();io=null}showAll()}
  function apply(){mq.matches?disable():enable()}
  apply();
  if(mq.addEventListener)mq.addEventListener('change',apply);else if(mq.addListener)mq.addListener(apply);
  addEventListener('hashchange',function(){
    var s=document.querySelector('.pg.on');if(!s||mq.matches)return;
    s.classList.remove('pg-in');void s.offsetWidth;s.classList.add('pg-in');
  });
  addEventListener('beforeprint',showAll);
  document.addEventListener('focusin',function(e){
    var el=e.target;
    while(el&&el!==document){if(el.classList&&el.classList.contains('rv'))el.classList.add('in');el=el.parentNode}
  });
})();
