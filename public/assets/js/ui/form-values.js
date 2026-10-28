// Keep the actual visible form as the source of truth at submission time.
// Autofill and password managers sometimes set input.value silently.
export function readLiveFormValues(form,values={}) {
 if(!form||typeof form.querySelectorAll!=='function')return values;
 for(const field of form.querySelectorAll('input[name],select[name],textarea[name]')){
  if(field.disabled||!field.name||['checkbox','radio','file'].includes(field.type))continue;
  values[field.name]=field.value;
 }
 return values;
}
export function registrationErrorPhase(route,phase,fields={}){
 if(route!=='register'||phase!=='two')return null;
 return ['username','email'].some(key=>Object.prototype.hasOwnProperty.call(fields,key))?'one':null;
}
