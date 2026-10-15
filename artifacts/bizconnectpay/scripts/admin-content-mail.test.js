import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ejs from 'ejs';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pricingTextFields, pricingCopyTranslator, validatePricingCopy } from '../src-server/pricing-copy.js';
import { mailConfiguration, notificationMessage, deliverContactNotifications } from '../src-server/contact-mail.js';
import { createMailAdminRouter } from '../src-server/mail-admin-routes.js';
import { requireAdmin, verifyCsrf } from '../src-server/security.js';
import { translator } from '../src-server/i18n.js';
import { settingKeys } from '../src-server/constants.js';

const root = fileURLToPath(new URL('../', import.meta.url));
test('Every pricing text has bilingual editable fields and persisted overrides render escaped', async () => {
  assert.ok(pricingTextFields.length > 50);
  assert.ok(pricingTextFields.length * 2 + 3 < 300);
  assert.ok(settingKeys.length + 1 < 40, 'Settings form fits the request parser');
  const body = {};
  for (const language of ['fr','en']) pricingTextFields.forEach((source, index) => {
    body[`copy_${language}_${index}`] = translator(language)(source);
  });
  body[`copy_fr_${pricingTextFields.indexOf('Une tarification')}`] = '<b>Prix personnalisés</b>';
  body[`copy_en_${pricingTextFields.indexOf('Une tarification')}`] = 'Custom pricing';
  body[`copy_fr_${pricingTextFields.indexOf('Tarif IN')}`] = '1,5 %';
  const saved = validatePricingCopy(body);
  const settings = JSON.parse(JSON.stringify(saved)); // Simulate a later request.
  assert.equal(pricingCopyTranslator(settings,'en')('Une tarification'), 'Custom pricing');
  assert.throws(() => validatePricingCopy({}), { status: 400 });
  assert.throws(() => validatePricingCopy({ ...body, copy_fr_0: 'x'.repeat(2001) }), { status: 400 });
  const html = await ejs.renderFile(path.join(root,'views/index.ejs'), {
    settings, basePath: '', t: translator('fr'), pricingT: pricingCopyTranslator(settings,'fr'),
  });
  assert.match(html, /&lt;b&gt;Prix personnalisés&lt;\/b&gt;/);
  assert.match(html, /1,5 %/);
  assert.ok(!html.includes('id="services"'));
  assert.ok(!html.includes('href="#services"'));
  assert.ok(!readFileSync(path.join(root,'views/index.ejs'),'utf8').includes('pages/services'));
  const admin = await ejs.renderFile(path.join(root,'views/admin/pricing.ejs'), {
    settings, pricingTextFields, pricingFr: pricingCopyTranslator(settings,'fr'),
    pricingEn: pricingCopyTranslator(settings,'en'),
  });
  assert.equal((admin.match(/name="copy_(?:fr|en)_\d+"/g) || []).length, pricingTextFields.length * 2);
});
test('Footer publishes configured contacts and social links without invented contacts', async () => {
  const html = await ejs.renderFile(path.join(root,'views/index.ejs'), {
    settings: {
      footer_phone: '+237 600000000', footer_address: 'Adresse test',
      instagram_url: 'https://instagram.com/test', youtube_url: 'https://youtube.com/test',
      tiktok_url: 'https://tiktok.com/@test', telegram_url: 'https://t.me/test',
    },
  });
  assert.match(html, /tel:\+237600000000/);
  assert.match(html, /Adresse test/);
  for (const network of ['instagram.com/test','youtube.com/test','tiktok.com/@test','t.me/test']) {
    assert.ok(html.includes(network));
  }
});
test('SMTP is optional and encrypted; email contains all submitted data with safe reply headers', () => {
  assert.equal(mailConfiguration({}).ready, false);
  const env = { SMTP_HOST:'smtp.example.com',SMTP_USER:'test',SMTP_PASSWORD:'test-fixture',SMTP_FROM:'sender@example.com' };
  const smtp = mailConfiguration(env);
  assert.equal(smtp.ready,true);
  assert.equal(smtp.options.requireTLS,true);
  assert.equal(mailConfiguration({...env,SMTP_PORT:'465'}).options.secure,true);
  assert.equal(mailConfiguration({...env,SMTP_PORT:'bad'}).ready,false);
  const message = notificationMessage({
    submission_key:'uuid',full_name:'Nom test',company:'Société',country_code:'+1',country_iso:'CA',
    phone:'555123456',email:'visitor@example.com',sector:'E-commerce',services:'["IN"]',
    subject:'Objet du visiteur',message:'Contenu du message',consent_at:'2026-10-15',created_at:'2026-10-15',
  },'recipient@example.com',env.SMTP_FROM);
  assert.equal(message.from,'sender@example.com');
  assert.equal(message.replyTo,'visitor@example.com');
  for (const text of ['Nom test','Société','Canada','+1 555123456','visitor@example.com','E-commerce','["IN"]','Objet du visiteur','Contenu du message','2026-10-15']) {
    assert.ok(message.text.includes(text), text);
  }
  assert.ok(!message.html, 'Visitor markup is never interpreted');
});
test('Durable mail queue: disabled, claimed, failed/retry and success, without resending acknowledged messages', async () => {
  const row = { message_id:1, recipient:'owner@example.com', email:'visitor@example.com', submission_key:'key' };
  let enabled = '0', attempts = 0, sent = false, failed = false, claimed = true, calls = 0, queued = 0;
  const database = { async execute(sql) {
    if (sql.startsWith('SELECT setting_key')) return [[
      {setting_key:'contact_notify_enabled',setting_value:enabled},
      {setting_key:'contact_notify_email',setting_value:'owner@example.com'},
      {setting_key:'contact_notify_since',setting_value:'2026-10-15 00:00:00'},
    ]];
    if (sql.includes('INSERT IGNORE')) { queued++; return [{affectedRows:1}]; }
    if (sql.startsWith('SELECT n.message_id')) return [sent || attempts >= 5 ? [] : [row]];
    if (sql.includes('attempts = attempts + 1')) { if(claimed)attempts++; return [{affectedRows:claimed ? 1 : 0}]; }
    if (sql.includes('sent_at = UTC_TIMESTAMP')) { sent=true; failed=false; return [{}]; }
    if (sql.includes('failed = 1')) { failed=true; return [{}]; }
    throw new Error(`Unexpected SQL: ${sql}`);
  }};
  const smtp = {ready:true,from:'sender@example.com'};
  let reject = true;
  const send = async () => { calls++; if(reject)throw new Error('SMTP unavailable'); return {accepted:['owner@example.com']}; };
  await deliverContactNotifications(database,send,smtp);
  assert.equal(queued,0);
  enabled='1'; claimed=false;
  await deliverContactNotifications(database,send,smtp);
  assert.equal(calls,0);
  claimed=true;
  await deliverContactNotifications(database,send,smtp);
  assert.equal(failed,true); assert.equal(sent,false); assert.equal(attempts,1);
  reject=false;
  await deliverContactNotifications(database,send,smtp);
  assert.equal(sent,true); assert.equal(attempts,2);
  await deliverContactNotifications(database,send,smtp);
  assert.equal(calls,2);
});
test('Notifications admin endpoints guard auth/CSRF, persist recipient and never claim failed SMTP success', async () => {
  let settings = {}, deliveries=0;
  const app=express();
  app.set('view engine','ejs'); app.set('views',path.join(root,'views'));
  app.use(express.urlencoded({extended:false}));
  app.use((req,res,next) => {
    req.session = {admin:req.get('X-Test-Admin')==='1',csrfToken:'token',save:callback=>callback()};
    Object.assign(res.locals,{basePath:'',csrfToken:'token',settings}); next();
  }, requireAdmin, (req,res,next)=> req.method==='POST' ? verifyCsrf(req,res,next) : next());
  app.use('/admin/notifications',createMailAdminRouter({
    getPool:()=>({execute:async()=>[[]]}),
    save:async values=>{settings={...settings,...values};},
    configuration:()=>({ready:true}),
    testMail:async()=>{deliveries++; throw new Error('No SMTP');},
  }));
  app.use((error,req,res,next)=>res.status(error.status || 500).json({error:error.message}));
  const server=app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${server.address().port}/admin/notifications`;
  const post=(body,auth=true)=>fetch(url,{method:'POST',redirect:'manual',headers:{
    'Content-Type':'application/x-www-form-urlencoded',...(auth?{'X-Test-Admin':'1'}:{}),
  },body:new URLSearchParams(body)});
  try {
    assert.equal((await post({_csrf:'token',email:'owner@example.com'},false)).status,302);
    assert.equal((await post({_csrf:'wrong',email:'owner@example.com'})).status,403);
    assert.equal((await post({_csrf:'token',enabled:'1',email:'bad'})).status,400);
    assert.equal((await post({_csrf:'token',enabled:'1',email:'owner@example.com'})).status,303);
    assert.equal(settings.contact_notify_email,'owner@example.com');
    assert.equal(settings.contact_notify_enabled,'1');
    assert.ok(settings.contact_notify_since);
    const since=settings.contact_notify_since;
    assert.equal((await post({_csrf:'token',email:''})).status,303);
    assert.equal(settings.contact_notify_enabled,'0');
    assert.equal(settings.contact_notify_since,since);
    const page=await fetch(url,{headers:{'X-Test-Admin':'1'}});
    assert.equal(page.status,200);
    assert.match(await page.text(),/Notifications contact/);
    settings.contact_notify_email='owner@example.com';
    const response=await fetch(url+'/test',{method:'POST',headers:{
      'X-Test-Admin':'1','Content-Type':'application/x-www-form-urlencoded',
    },body:'_csrf=token'});
    assert.equal(response.status,400);
    assert.equal(deliveries,1);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
