(function(){
  var data=document.getElementById('bcp-i18n'),dictionary={};
  try{dictionary=JSON.parse(data?data.textContent:'{}')}catch(e){dictionary={}}
  function t(source,params){
    var result=dictionary[source]||source;
    return String(result).replace(/\{(\w+)\}/g,function(token,key){return params&&Object.prototype.hasOwnProperty.call(params,key)?String(params[key]):token});
  }
  window.bcpT=t;
  var current=document.documentElement.lang==='en'?'en':'fr';
  var base=document.body.getAttribute('data-base-path')||'';
  document.querySelectorAll('[data-language-select]').forEach(function(select){
    select.value=current;
    select.addEventListener('change',function(){
      var next=select.value;if(next!=='fr'&&next!=='en')return;
      var form=document.getElementById('contact-form');
      if(form){
        var submit=form.querySelector('.ct-submit');
        if(submit&&submit.getAttribute('aria-busy')==='true'){
          select.value=current;alert(t('Veuillez attendre la fin de l’envoi avant de changer de langue.'));return;
        }
        var dirty=['fullName','company','phone','email','subject','message'].some(function(key){return form.elements[key]&&form.elements[key].value.trim()!==''});
        if(dirty&&!confirm(t('Changer de langue effacera le formulaire non envoyé. Continuer ?'))){select.value=current;return}
      }
      document.cookie='bcp.lang='+next+'; Path='+(base||'/')+'; Max-Age=31536000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
      var url=new URL(location.href);url.searchParams.set('lang',next);location.assign(url.href);
    });
  });
})();
