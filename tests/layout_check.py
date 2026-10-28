"""Standalone visual layout validation; uses real markup/styles/form templates but no HTTP or backend."""
import base64,json,re,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path('/mnt/data/klikchart_visual_qa');OUT.mkdir(exist_ok=True)
HTML=(ROOT/'public/index.html').read_text()
HTML=re.sub(r'<link\b[^>]*>', '',HTML)
HTML=re.sub(r'<script\b[^>]*>\s*</script>', '',HTML)
CSS=(ROOT/'public/assets/css/style.css').read_text()
for filename in ('purple-silk-640.webp','purple-silk-960.webp','purple-silk-1672.webp'):
 data=base64.b64encode((ROOT/'public/assets/images'/filename).read_bytes()).decode()
 CSS=CSS.replace("url('/assets/images/"+filename+"')",f"url('data:image/webp;base64,{data}')")
FORMS=(ROOT/'public/assets/js/ui/forms.js').read_text().replace("import {t} from '../i18n.js';",'').replace('export const esc','const esc').replace('export function renderForm','function renderForm')
JS='''const dict='''+json.dumps({lang:json.loads((ROOT/f'public/assets/i18n/{lang}.json').read_text()) for lang in ('id','en')},ensure_ascii=False)+''';
let lang='id';const t=(key,params={})=>(dict[lang]?.[key]||key).replace(/\\{(\\w+)\\}/g,(_,k)=>params[k]??'');
'''+FORMS+'''
window.qa=(stage,language)=>{
lang=language;
document.documentElement.lang=lang;
document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
const route=stage==='login'?'login':stage.startsWith('register')||['methods','otp','success'].includes(stage)?'register':stage.startsWith('forgot')||stage==='new_password'?'forgot':'app';
const phase={'register1':'one','register2':'two','methods':'methods','otp':'otp','success':'otp','forgot':'start','forgot_methods':'methods','new_password':'new'}[stage]||'start';
const s={route,phase,values:{username:'Pixel_Star27',email:'pixel@example.com',phone:'081234567890',identifier:'pixel@example.com'},remember:false,methods:[{channel:'email',masked:'pi***@example.com'},{channel:'whatsapp',masked:'62812****890'}],channel:'email',username:'Pixel_Star27'};
document.querySelector('#auth-content').innerHTML=renderForm(s);
if(stage==='success'){
 const d=document.querySelector('dialog');d.setAttribute('open','');d.querySelector('#dialog-content').innerHTML=`<div class="modal-success"><div class="success-ring"><svg viewBox="0 0 24 24"><use href="#check"></use></svg></div><h2 id="dialog-title">${t('successTitle')}</h2><p>${t('successMessage')}</p></div>`;
}
};
'''
STAGES=['login','register1','register2','methods','otp','success','forgot','forgot_methods','new_password','app']
SIZES=[(320,568),(360,640),(390,844),(768,1024),(1024,768),(1366,768),(1440,900)]
if __name__=='__main__':
 failures=[];count=0
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for w,h in SIZES:
   for lang in ('id','en'):
    page=browser.new_page(viewport={'width':w,'height':h},reduced_motion='reduce')
    page.set_content(HTML)
    page.add_style_tag(content=CSS)
    page.add_script_tag(content=JS)
    for stage in STAGES:
     page.evaluate('([stage,lang])=>window.qa(stage,lang)',[stage,lang])
     page.wait_for_timeout(10)
     d=page.evaluate('''()=>{const c=document.querySelector('.auth-card'),a=document.querySelector('.auth-content'),r=c.getBoundingClientRect();return {width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,top:r.top,bottom:r.bottom, cardHeight:r.height, contentScroll:a.scrollHeight>a.clientHeight+2, contentHeight:a.clientHeight, bodyScroll:document.body.scrollHeight>innerHeight+2}}''')
     if d['width']>w+1 or d['height']>h+1 or d['bottom']>h+1 or d['top']<0 or d['bodyScroll']:
      failures.append((w,h,lang,stage,d))
     if stage in ('login','register2','methods','otp','success','new_password') or (w,h)==(390,844):
      page.screenshot(path=str(OUT/f'{w}x{h}_{lang}_{stage}.png'),animations='disabled')
     count+=1
    print('Checked',w,h,lang,flush=True)
    page.close()
  browser.close()
 print('CHECKED',count,'FAILURES',len(failures))
 for f in failures[:30]:print('FAIL',f)
 sys.exit(1 if failures else 0)
