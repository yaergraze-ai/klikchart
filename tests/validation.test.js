import test from 'node:test';
import assert from 'node:assert/strict';
import {checkRegistration,checkPassword,normalizedPhone,normalizedEmail,usernameRE,checkOTP} from '../backend/utils/validation.js';
import {mac,code,sessionHash,maskEmail,maskPhone} from '../backend/utils/security.js';

test('username case preserved; period, underscore, numbers and capitals allowed',()=>{
 for(const value of ['Pixel_Star27','A.b','JOHN_123'])assert.equal(usernameRE.test(value),true);
 for(const value of ['bad name','ab','a'.repeat(21),'user@one'])assert.equal(usernameRE.test(value),false);
});
test('Indonesia phone canonicalization',()=>{
 for(const input of ['081234567890','81234567890','6281234567890','+6281234567890'])assert.equal(normalizedPhone(input),'6281234567890');
 for(const input of ['abc','0211234567','+441234567890'])assert.equal(normalizedPhone(input),null);
});
test('email normalized and passwords checked',()=>{
 assert.equal(normalizedEmail('  EXAMPLE@EMAIL.COM '),'example@email.com');
 assert.deepEqual(checkPassword('ComplexPwd27','ComplexPwd27'),{});
 assert.equal(checkPassword('passwordonly','passwordonly').password,'PASSWORD_INVALID');
 assert.equal(checkPassword('ValidPass22','NoMatch2').confirmPassword,'PASSWORD_MISMATCH');
 const fields=checkRegistration({username:'bad name',email:'invalid',phone:'111',password:'abc',confirmPassword:'different'});
 assert.deepEqual(Object.keys(fields).sort(),['confirmPassword','email','password','phone','username'].sort());
});
test('OTP six numeric digits only',()=>{assert.equal(checkOTP('000001'),true);assert.equal(checkOTP('12ab56'),false);assert.equal(checkOTP('12345'),false);});
test('random OTP format and keyed HMAC changes with context',()=>{
 for(let i=0;i<30;i++)assert.match(code(),/^\d{6}$/);
 const a=mac('otp','user-a:register:123456:1','private-test-secret');
 assert.notEqual(a,mac('otp','user-a:login:123456:1','private-test-secret'));
 assert.notEqual(a,mac('otp','user-b:register:123456:1','private-test-secret'));
 assert.equal(a.length,64);
 assert.notEqual(sessionHash('token1'),sessionHash('token2'));
 assert.equal(maskEmail('abraham@example.com'),'ab***@example.com');
 assert.equal(maskPhone('6281234567890'),'62812****890');
});
