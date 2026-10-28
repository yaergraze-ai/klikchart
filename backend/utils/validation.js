export const usernameRE = /^[A-Za-z0-9._]{3,20}$/;
export const emailRE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function normalizedEmail(value){return String(value||'').trim().toLowerCase();}
export function normalizedPhone(value) {
 const digits = String(value||'').replace(/[\s().-]/g,'').replace(/^\+/,'');
 const result = digits.startsWith('0') ? '62'+digits.slice(1) : digits.startsWith('8') ? '62'+digits : digits;
 return /^628[1-9][0-9]{7,11}$/.test(result) ? result : null;
}
export function checkRegistration({username,email,phone,password,confirmPassword}) {
 const fields={};
 if (!usernameRE.test(username||'')) fields.username='USERNAME_INVALID';
 if (!emailRE.test(normalizedEmail(email)) || String(email||'').length>254) fields.email='EMAIL_INVALID';
 if (!normalizedPhone(phone)) fields.phone='PHONE_INVALID';
 if (typeof password!=='string'||password.length<8||password.length>72|| !/[a-zA-Z]/.test(password)|| !/[0-9]/.test(password)) fields.password='PASSWORD_INVALID';
 if (password!==confirmPassword) fields.confirmPassword='PASSWORD_MISMATCH';
 return fields;
}
export function checkPassword(password,confirmPassword){const fields={};if(typeof password!=='string'||password.length<8||password.length>72||!/[a-zA-Z]/.test(password)||!/[0-9]/.test(password))fields.password='PASSWORD_INVALID';if(password!==confirmPassword)fields.confirmPassword='PASSWORD_MISMATCH';return fields;}
export function checkOTP(v){return /^\d{6}$/.test(String(v||''));}
