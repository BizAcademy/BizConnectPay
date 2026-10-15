/* Generic carousel controller (rev car-3; [data-car-cards] = multi-card step mode): every [data-car] gets independent state; slides stacked without JS. */
(function(){
function initCar(car,ci){
  var t=window.bcpT||function(value){return value};
  var track=car.querySelector('.car-track'),slides=[].slice.call(car.querySelectorAll('.car-slide'));
  var bar=car.querySelector('.car-bar'),prev=car.querySelector('.car-prev'),next=car.querySelector('.car-next');
  var dots=[].slice.call(car.querySelectorAll('.car-dot')),play=car.querySelector('.car-play'),status=car.querySelector('.car-status');
  if(!track||slides.length<2||!bar)return;
  if(!track.id)track.id='car-track-'+ci;
  var noun=car.getAttribute('data-car-noun')||'Solution',view=car.querySelector('.car-view');
  var cards=car.hasAttribute('data-car-cards'),vis=1;
  var DELAY=parseInt(car.getAttribute('data-car-delay'),10)||5000,n=slides.length,i=0,timer=null;
  var mq=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
  var userPaused=mq.matches,hover=false,focus=false,visible=true;
  var root=document.documentElement,page=car.closest('.pg');
  var FOC='a[href],button,input,select,textarea,video[controls],[tabindex]';

  car.classList.add('car-on');bar.hidden=false;

  function revealItems(s){return s.querySelectorAll('.prod-txt,.product-visual')}
  function prepReveal(){
    slides.forEach(function(s){
      [].forEach.call(revealItems(s),function(e){
        e.classList.add('rv');
        if(e.classList.contains('product-visual')){e.classList.add(s.classList.contains('rev')?'rv-left':'rv-right');e.style.setProperty('--d','80ms')}
        else e.style.setProperty('--d','0ms');
      });
    });
  }
  function reveal(s){
    if(!root.classList.contains('m-on')||!visible){[].forEach.call(revealItems(s),function(e){if(!root.classList.contains('m-on'))e.classList.add('in')});return}
    var items=revealItems(s);
    [].forEach.call(items,function(e){e.classList.remove('in')});
    void s.offsetWidth;
    requestAnimationFrame(function(){[].forEach.call(items,function(e){e.classList.add('in')})});
  }
  function setInert(s,off){
    if(off){s.setAttribute('aria-hidden','true');s.inert=true;s.setAttribute('inert','')}
    else{s.removeAttribute('aria-hidden');s.inert=false;s.removeAttribute('inert')}
    [].forEach.call(s.querySelectorAll(FOC),function(el){
      if(off){if(!el.hasAttribute('data-car-ti'))el.setAttribute('data-car-ti',el.getAttribute('tabindex')||'');el.setAttribute('tabindex','-1')}
      else if(el.hasAttribute('data-car-ti')){var t=el.getAttribute('data-car-ti');t?el.setAttribute('tabindex',t):el.removeAttribute('tabindex');el.removeAttribute('data-car-ti')}
    });
    if(off)[].forEach.call(s.querySelectorAll('video'),function(v){try{v.pause()}catch(e){}});
  }
  function go(k,announce){
    var focusInside=car.contains(document.activeElement)&&slides[i].contains(document.activeElement);
    if(cards){measure();var m=n-vis+1;i=(k%m+m)%m}else i=(k%n+n)%n;
    track.style.setProperty('--i',i);
    if(cards)track.style.setProperty('--x',slides[i].offsetLeft-slides[0].offsetLeft);
    slides.forEach(function(s,j){setInert(s,cards?(j<i||j>=i+vis):j!==i)});
    dots.forEach(function(d,j){j===i?d.setAttribute('aria-current','true'):d.removeAttribute('aria-current')});
    if(announce&&status){var title=slides[i].getAttribute('data-car-title')||((slides[i].querySelector('h2,h3')||{}).textContent)||'';status.textContent=t('{noun} {index} sur {total} : {title}',{noun:t(noun),index:i+1,total:n,title:title.trim()})}
    fit();
    if(focusInside&&dots[i])dots[i].focus();
    reveal(slides[i]);
  }
  function measure(){
    var st=slides.length>1?slides[1].offsetLeft-slides[0].offsetLeft:0;
    vis=st>0?Math.max(1,Math.min(n,1+Math.floor((view.clientWidth-slides[0].offsetWidth+2)/st))):1;
  }
  function fit(){
    if(cards)return;
    var h=slides[i].offsetHeight;
    if(h)view.style.height=h+'px';
  }
  addEventListener('resize',function(){cards?go(i,false):fit()});
  if(window.ResizeObserver)slides.forEach(function(s){new ResizeObserver(function(){if(s===slides[i])fit()}).observe(s)});
  function running(){return !userPaused&&!hover&&!focus&&visible&&!document.hidden&&(!page||page.classList.contains('on'))}
  function schedule(){
    clearTimeout(timer);timer=null;
    if(running())timer=setTimeout(function(){go(i+1,false);schedule()},DELAY);
  }
  function syncPlay(){if(!play)return;play.textContent=t(userPaused?'Lecture':'Pause');play.setAttribute('aria-pressed',userPaused?'true':'false');play.setAttribute('aria-label',t(userPaused?'Reprendre le défilement automatique':'Mettre en pause le défilement automatique'))}
  function manual(k){go(k,true);schedule()}

  if(prev)prev.addEventListener('click',function(){manual(i-1)});
  if(next)next.addEventListener('click',function(){manual(i+1)});
  dots.forEach(function(d,j){d.addEventListener('click',function(){manual(j)})});
  if(play)play.addEventListener('click',function(){userPaused=!userPaused;syncPlay();schedule()});
  car.addEventListener('keydown',function(e){
    if(e.target.closest&&e.target.closest('input,textarea,video'))return;
    if(e.key==='ArrowLeft'){e.preventDefault();manual(i-1)}else if(e.key==='ArrowRight'){e.preventDefault();manual(i+1)}
  });
  car.addEventListener('mouseenter',function(){hover=true;schedule()});
  car.addEventListener('mouseleave',function(){hover=false;schedule()});
  car.addEventListener('focusin',function(){focus=true;schedule()});
  car.addEventListener('focusout',function(e){if(!car.contains(e.relatedTarget)){focus=false;schedule()}});
  document.addEventListener('visibilitychange',schedule);
  addEventListener('hashchange',function(){if(page&&page.classList.contains('on')){reveal(slides[i]);fit()}schedule()});
  if(mq.addEventListener)mq.addEventListener('change',function(){if(mq.matches)userPaused=true;syncPlay();schedule()});

  /* swipe */
  var sx=null,sy=0;
  view.addEventListener('pointerdown',function(e){if(e.pointerType==='mouse')return;sx=e.clientX;sy=e.clientY});
  view.addEventListener('pointerup',function(e){
    if(sx===null)return;var dx=e.clientX-sx,dy=e.clientY-sy;sx=null;
    if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.2)manual(dx<0?i+1:i-1);
  });
  view.addEventListener('pointercancel',function(){sx=null});

  if(root.classList.contains('m-on'))prepReveal();
  if('IntersectionObserver' in window){
    visible=false;
    var wasIn=false;
    new IntersectionObserver(function(es){es.forEach(function(x){
      visible=x.isIntersecting;
      if(visible&&!wasIn)reveal(slides[i]);
      wasIn=visible;schedule();
    })},{threshold:.25}).observe(car);
  }
  syncPlay();go(0,false);schedule();
}
[].forEach.call(document.querySelectorAll('[data-car]'),function(c,k){initCar(c,k+1)});
})();
