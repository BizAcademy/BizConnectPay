(function(){
  document.querySelectorAll('form[data-confirm]').forEach(function(f){
    f.addEventListener('submit',function(e){if(!window.confirm(f.getAttribute('data-confirm')))e.preventDefault()});
  });
  document.querySelectorAll('.slot').forEach(function(slot){
    var input=slot.querySelector('[data-file]');if(!input)return;
    var preview=slot.querySelector('[data-preview]');var label=slot.querySelector('[data-file-label]');var hint=slot.querySelector('[data-file-hint]');
    var original=preview.innerHTML;var url=null;var btn=slot.querySelector('.upload button[type=submit]');
    var dbDisabled=btn&&btn.disabled;
    input.addEventListener('change',function(){
      if(url){URL.revokeObjectURL(url);url=null}
      var file=input.files&&input.files[0];hint.className='hint';hint.textContent='';
      if(!file){preview.innerHTML=original;preview.classList.remove('pending');label.textContent='Choisir un fichier…';return}
      label.textContent=file.name;
      var isVid=/^video\//.test(file.type);var isImg=/^image\//.test(file.type);
      var max=(isVid?+input.dataset.vidMax:+input.dataset.imgMax)*1024*1024;
      var mb=(file.size/1048576).toFixed(1).replace('.',',');
      if(!isVid&&!isImg){hint.className='hint bad';hint.textContent='Format non pris en charge.';if(btn)btn.disabled=true;return}
      if(file.size>max){hint.className='hint bad';hint.textContent='Fichier trop lourd ('+mb+' Mo). Limite : '+(isVid?input.dataset.vidMax:input.dataset.imgMax)+' Mo.';if(btn)btn.disabled=true;return}
      if(btn)btn.disabled=dbDisabled;
      hint.textContent='Aperçu local · '+mb+' Mo — cliquez pour enregistrer.';
      url=URL.createObjectURL(file);
      var el=document.createElement(isVid?'video':'img');el.src=url;
      if(isVid){el.controls=true;el.muted=true;el.playsInline=true;el.preload='metadata'}else{el.alt='Aperçu'}
      preview.innerHTML='';preview.appendChild(el);preview.classList.add('pending');
    });
    slot.querySelector('.upload').addEventListener('submit',function(){if(btn){setTimeout(function(){btn.disabled=true;btn.textContent='Envoi…'},0)}});
  });
})();
