(function(){
  var f=document.getElementById('contact-form');if(!f)return;
  var base=document.body.getAttribute('data-base-path')||'';
  var st=document.getElementById('ct-status'),btn=f.querySelector('.ct-submit'),msg=f.elements.message,cnt=document.getElementById('ct-count'),svc=document.getElementById('ct-svc');
  var uuid=null,busy=false,lastPayload=null;
  btn.disabled=false;
  function mkId(){
    try{
      var c=window.crypto;if(!c)return null;
      if(typeof c.randomUUID==='function')return c.randomUUID();
      if(typeof c.getRandomValues!=='function')return null;
      var b=new Uint8Array(16);c.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
      var h=[];for(var i=0;i<16;i++)h.push((b[i]+256).toString(16).slice(1));
      return h.slice(0,4).join('')+'-'+h.slice(4,6).join('')+'-'+h.slice(6,8).join('')+'-'+h.slice(8,10).join('')+'-'+h.slice(10).join('');
    }catch(e){return null}
  }
  function say(t,k){st.className='ct-status '+(k||'');st.setAttribute('role',k==='err'?'alert':'status');st.textContent=t}
  function mark(el,bad){if(el)el.setAttribute('aria-invalid',bad?'true':'false')}
  function upd(){cnt.textContent=msg.value.length+' / 5000'}
  msg.addEventListener('input',upd);upd();
  f.addEventListener('input',function(e){if(e.target.getAttribute('aria-invalid')==='true')mark(e.target,false);if(e.target.name==='services')svc.classList.remove('bad')});
  function v(n){var e=f.elements[n];return e?String(e.value||'').trim():''}
  f.addEventListener('submit',function(e){
    e.preventDefault();if(busy)return;
    var E=f.elements,first=null,err='';
    function fail(el,t){mark(el,true);if(!first){first=el;err=t}}
    ['fullName','phone','email','subject','message','sector'].forEach(function(n){mark(E[n],false)});
    if(!v('fullName'))fail(E.fullName,'Veuillez indiquer votre nom complet.');
    var digits=v('phone').replace(/\D/g,'');
    if(!/^\+\d{1,4}$/.test(v('countryCode')))fail(E.countryCode,'Veuillez choisir un indicatif pays.');
    if(digits.length<6||digits.length>15||v('countryCode').length-1+digits.length>15||/[^\d\s().\-+]/.test(v('phone')))fail(E.phone,'Veuillez saisir un numéro valide sans répéter l’indicatif.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email')))fail(E.email,'Veuillez saisir une adresse e-mail valide.');
    if(!v('sector'))fail(E.sector,'Veuillez choisir votre secteur d\u2019activité.');
    var services=[].slice.call(f.querySelectorAll('input[name="services"]:checked')).map(function(x){return x.value});
    if(!services.length){svc.classList.add('bad');if(!first){first=f.querySelector('input[name="services"]');err='Veuillez sélectionner au moins un service.'}}
    if(!v('subject'))fail(E.subject,'Veuillez indiquer l\u2019objet de votre demande.');
    var m=v('message');if(m.length<10||m.length>5000)fail(E.message,'Votre message doit contenir entre 10 et 5000 caractères.');
    if(!E.consent.checked&&!first){first=E.consent;err='Veuillez accepter la politique de confidentialité.'}
    if(first){say(err,'err');first.focus();return}
    var data={fullName:v('fullName'),company:v('company'),countryCode:v('countryCode'),phone:v('phone'),email:v('email'),sector:v('sector'),services:services,subject:v('subject'),message:m,consent:true,website:E.website.value||''};
    var payload=JSON.stringify(data);
    if(payload!==lastPayload){uuid=null;lastPayload=payload}
    if(!uuid)uuid=mkId();
    if(!uuid){say('Votre navigateur ne permet pas de sécuriser l\u2019envoi. Mettez-le à jour ou utilisez un autre navigateur.','err');return}
    data.submissionId=uuid;
    var controls=[].slice.call(f.elements).filter(function(el){return !el.disabled});
    busy=true;controls.forEach(function(el){el.disabled=true});btn.setAttribute('aria-busy','true');var lbl=btn.textContent;btn.textContent='Envoi en cours\u2026';say('Envoi de votre demande\u2026');
    fetch(base+'/contact-request',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'same-origin',body:JSON.stringify(data)})
      .then(function(r){return r.json().catch(function(){return {}}).then(function(d){return {ok:(r.status===200||r.status===201)&&d&&typeof d.message==='string'&&!!d.message.trim(),s:r.status,d:d||{}}})})
      .then(function(o){
        if(o.ok){say(o.d.message,'ok');f.reset();uuid=null;lastPayload=null;upd()}
        else say(o.d.error||(o.s===429?'Trop de demandes. Patientez avant de réessayer.':o.s===503?'Service momentanément indisponible. Vos informations sont conservées, réessayez plus tard.':'Envoi impossible pour le moment. Vos informations sont conservées, réessayez.'),'err');
      })
      .catch(function(){say('Erreur réseau. Vos informations sont conservées, vous pouvez réessayer.','err')})
      .then(function(){busy=false;controls.forEach(function(el){el.disabled=false});btn.removeAttribute('aria-busy');btn.textContent=lbl});
  });
})();
