const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(name) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(`lib/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require','exports','module',code)(require,mod.exports,mod);
  return mod.exports;
}
const { recipientAddress } = load('communication');
const { providerStatus, sendSms, sendEmail, sendWhatsApp } = load('broadcast');
const donor = { email:' USER@EXAMPLE.COM ',phone:'0046 70 000 00 00',comm_email:true,comm_sms:true,comm_whatsapp:true,comm_opt_out:false };
assert.equal(recipientAddress(donor,'sms'),'+46700000000');
assert.equal(recipientAddress(donor,'email'),'user@example.com');
assert.equal(recipientAddress({...donor,comm_opt_out:true},'whatsapp'),null);
assert.equal(recipientAddress({...donor,comm_sms:false},'sms'),null);
assert.equal(recipientAddress({...donor,phone:'0700000000'},'sms'),null);
let calls=[];
global.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:202};};
(async()=>{
  for(const key of ['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM_NUMBER','RESEND_API_KEY','BROADCAST_FROM_EMAIL','WHATSAPP_ENABLED']) delete process.env[key];
  assert.equal((await sendSms('+46700000000','test')).ok,false);
  assert.equal((await sendEmail('a@example.invalid','test','test')).ok,false);
  assert.equal((await sendWhatsApp('+46700000000','test','sv')).ok,false);
  assert.equal(calls.length,0);
  Object.assign(process.env,{TWILIO_ACCOUNT_SID:'test',TWILIO_AUTH_TOKEN:'test',TWILIO_FROM_NUMBER:'+46700000001',RESEND_API_KEY:'test',BROADCAST_FROM_EMAIL:'test@example.invalid',WHATSAPP_ENABLED:'true',WHATSAPP_ACCESS_TOKEN:'test',WHATSAPP_PHONE_NUMBER_ID:'123',WHATSAPP_API_VERSION:'vTest'});
  assert.equal((await sendSms('+46700000000','test')).ok,true);
  assert.equal((await sendEmail('a@example.invalid','test','test')).ok,true);
  assert.equal((await sendWhatsApp('+46700000000','approved_template','sv')).ok,true);
  assert.equal(JSON.parse(calls[2].options.body).template.name,'approved_template');
  global.fetch=async()=>({ok:false,status:429});
  assert.equal((await sendSms('+46700000000','test')).ok,false);
  global.fetch=async()=>{throw new Error('offline')};
  assert.equal((await sendEmail('a@example.invalid','test','test')).ok,false);
  assert.equal(providerStatus().whatsapp,true);
  console.log('Broadcast checks passed: opt-out, preferences, normalization, provider setup, requests and failures. No real messages sent.');
})();
