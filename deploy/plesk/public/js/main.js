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
