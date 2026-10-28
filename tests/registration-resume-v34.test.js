import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const files=new URL('../',import.meta.url);
const read=f=>readFileSync(new URL(f,files),'utf8');

test('v3.7 keeps registration temporary in an encrypted cookie, not a profile row',()=>{
  const reg=read('backend/services/registration.js');
  assert.match(reg,/createCipheriv/);
  assert.match(reg,/maxAge/);
  assert.match(reg,/clearSignup/);
});

test('Concurrent submissions are blocked by UI and labels remain translated',()=>{
  const client=read('public/assets/js/app.js');
  assert.match(client,/if\(submissionInProgress\)return;/);
  assert.match(client,/finally\{loading\(false\);submissionInProgress=false;\}/);
  for(const locale of ['id','en']){
    const tr=JSON.parse(read(`public/assets/i18n/${locale}.json`));
    assert.ok(tr.EMAIL_TAKEN.length>30);
  }
});

test('Every label with for= points to an input or select id across all form stages',async()=>{
  // The templates are dynamic; imported functions render the actual HTML users see.
  globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
  const {renderForm}=await import('../public/assets/js/ui/forms.js');
  const state={route:'register',phase:'one',values:{},methods:[{channel:'email',masked:'us***@example.com'}]};
  const stages=[['login','start'],['register','one'],['register','two'],['register','methods'],['register','otp'],['forgot','start'],['forgot','new'],['app','wa-otp']];
  for(const [route,phase] of stages){
    const html=renderForm({...state,route,phase,waStatus:{phoneMasked:'628***'}});
    const idSet=new Set([...html.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"/g)].map(m=>m[1]));
    const fors=[...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map(m=>m[1]);
    for(const forId of fors)assert.ok(idSet.has(forId),`${route}/${phase} label for=${forId} has no form control id`);
  }
  const index=read('public/index.html');
  assert.match(index,/for="language-select"/);
  assert.match(index,/id="language-select"/);
});
