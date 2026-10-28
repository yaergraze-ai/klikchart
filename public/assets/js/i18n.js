let language=localStorage.getItem('klikchart-lang')==='en'?'en':'id';
const dictionaries={};
export async function initLanguage(){await Promise.all(['id','en'].map(async key=>{const response=await fetch(`/assets/i18n/${key}.json`);if(!response.ok)throw Error('Translation load failed');dictionaries[key]=await response.json();}));setLanguage(language);}
export function t(key,params={}) {return (dictionaries[language]?.[key]||dictionaries.id?.[key]||key).replace(/\{(\w+)\}/g,(_,k)=>params[k]??'');}
export function getLanguage(){return language;}
export function setLanguage(next){language=next==='en'?'en':'id';localStorage.setItem('klikchart-lang',language);document.documentElement.lang=language;document.title=t('pageTitle');document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));document.querySelector('[data-brand]')?.setAttribute('aria-label',t('brandLabel'));const select=document.querySelector('#language-select');if(select){select.value=language;select.setAttribute('aria-label',t('languageLabel'));}document.querySelector('.close-dialog')?.setAttribute('aria-label',t('dialogClose'));}
