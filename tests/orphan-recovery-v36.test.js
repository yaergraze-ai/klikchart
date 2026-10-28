import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('v3.7 fresh registration removes the old orphan-profile recovery path',()=>{
 const auth=read('backend/services/auth.js');
 const reg=read('backend/services/registration.js');
 assert.doesNotMatch(auth,/orphanId|existing && !existing.signup_verified/);
 assert.doesNotMatch(reg,/signup_verified:false|resumed:true/);
 assert.match(reg,/signup_verified:true/);
});
test('new signup does not need to delete unverified Auth accounts',()=>{
 const reg=read('backend/services/registration.js');
 const createAt=reg.lastIndexOf('.auth.admin.createUser');
 const verifyAt=reg.indexOf('export async function verifyRegister');
 assert.ok(createAt>verifyAt);
});
