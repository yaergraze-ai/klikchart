import test from 'node:test';
import assert from 'node:assert/strict';
import {readLiveFormValues,registrationErrorPhase} from '../public/assets/js/ui/form-values.js';

test('Chrome silent autofill is collected before registration submission',()=>{
 const store={username:'OldName',email:'',phone:''};
 const form={querySelectorAll:()=>[
  {name:'username',value:'New_User27',type:'text',disabled:false},
  {name:'email',value:'user@example.com',type:'email',disabled:false},
  {name:'remember',value:'on',type:'checkbox',disabled:false},
 ]};
 assert.deepEqual(readLiveFormValues(form,store),{username:'New_User27',email:'user@example.com',phone:''});
});
test('Password manager fill updates phone and both passwords without events',()=>{
 const store={username:'testuser',email:'person@example.com'};
 const form={querySelectorAll:()=>[
  {name:'phone',value:'081223569478',type:'tel'},
  {name:'password',value:'ExamplePassword123',type:'password'},
  {name:'confirmPassword',value:'ExamplePassword123',type:'password'},
 ]};
 readLiveFormValues(form,store);
 assert.deepEqual([store.phone,store.password,store.confirmPassword],['081223569478','ExamplePassword123','ExamplePassword123']);
});
test('Backend username/email errors move user back to first registration step',()=>{
 assert.equal(registrationErrorPhase('register','two',{email:'EMAIL_INVALID'}),'one');
 assert.equal(registrationErrorPhase('register','two',{username:'USERNAME_TAKEN'}),'one');
 assert.equal(registrationErrorPhase('register','two',{phone:'PHONE_INVALID'}),null);
 assert.equal(registrationErrorPhase('login','start',{email:'EMAIL_INVALID'}),null);
});
