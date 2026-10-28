"""Offline UI regression: visual stability, transitions, viewport safety. Mock API ONLY."""
import base64,json,re,sys,os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'public/assets'
HTML=(ROOT/'public/index.html').read_text()
HTML=re.sub(r'<link\b[^>]*>', '',HTML)
HTML=re.sub(r'<script\b[^>]*>\s*</script>', '',HTML)
CSS=(DATA/'css/style.css').read_text()
for image in ['purple-silk-640.webp','purple-silk-960.webp','purple-silk-1672.webp']:
 data=base64.b64encode((DATA/'images'/image).read_bytes()).decode()
 CSS=CSS.replace("url('/assets/images/"+image+"')",f"url('data:image/webp;base64,{data}')")
as_url=lambda code:'data:text/javascript;base64,'+base64.b64encode(code.encode()).decode()
i18n_url=as_url((DATA/'js/i18n.js').read_text())
forms_url=as_url((DATA/'js/ui/forms.js').read_text().replace("'../i18n.js'",repr(i18n_url)))
api_url=as_url((DATA/'js/api.js').read_text())
motion_url=as_url((DATA/'js/ui/motion.js').read_text())
app=(DATA/'js/app.js').read_text().replace("'./i18n.js'",repr(i18n_url)).replace("'./api.js'",repr(api_url)).replace("'./ui/forms.js'",repr(forms_url)).replace("'./ui/motion.js'",repr(motion_url))
I18N={key:json.loads((DATA/f'i18n/{key}.json').read_text()) for key in ['id','en']}
MOCK='''({id,en}) => {
 Object.defineProperty(window,'localStorage',{value:{getItem:(k)=>null,setItem:()=>{},removeItem:()=>{}},configurable:true});
 history.pushState=function(){};history.replaceState=function(){};
 window.fetch=async (url,opts)=>{
  if(url.endsWith('id.json')) return new Response(JSON.stringify(id),{status:200,headers:{'Content-Type':'application/json'}});
  if(url.endsWith('en.json')) return new Response(JSON.stringify(en),{status:200,headers:{'Content-Type':'application/json'}});
  const path=String(url).replace(/^.*\\/api\\//,'');
  let data={};
  if(path==='config') data={channels:['email','whatsapp'],languages:['id','en'],loginRequiresOTP:true};
  else if(path==='login'||path==='register')data={methods:[{channel:'email',masked:'pi***@example.com'},{channel:'whatsapp',masked:'62812****890'}]};
  else if(path==='me')data={username:'Pixel_Star27',email:'pixel@example.com'};
  else if(path.endsWith('verify'))data={verified:true,ready:true};
  else if(path==='forgot/reset')data={changed:true};
  else data={expiresIn:300,resendAfter:60,accepted:true};
  return new Response(JSON.stringify({ok:true,data}),{status:200,headers:{'Content-Type':'application/json'}});
 };
}'''

metric='''() => {let c=document.querySelector('.auth-card').getBoundingClientRect(),a=document.getElementById('auth-content'),v=document.querySelector('.auth-view'),button=document.querySelector('#submit-button');
return {cardTop:c.top,cardHeight:c.height,cardBottom:c.bottom,
 innerOverflow:a.scrollHeight>a.clientHeight+3,scrollX:document.documentElement.scrollWidth-innerWidth,scrollY:document.documentElement.scrollHeight-innerHeight,
 clipped:!!button&&button.getBoundingClientRect().bottom>a.getBoundingClientRect().bottom+3&&!a.scrollHeight>a.clientHeight+3,
 actualEmpty:v?Math.max(0,a.clientHeight-v.getBoundingClientRect().height):0,
 animations:document.querySelector('.auth-card').getAnimations().map(a=>a.playState)};}'''

def check_still(page,ms=1800):
 samples=[]
 for k in range(ms//75):
  samples.append(page.evaluate(metric));page.wait_for_timeout(75)
 return samples

if __name__=='__main__':
 failures=[]
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for w,h in [tuple(map(int,s.split('x'))) for s in os.environ.get('KLC_SIZES','1910x968,390x844,320x568').split(',')]:
   for lang in os.environ.get('KLC_LANGS','id').split(','):
    page=b.new_page(viewport={'width':w,'height':h},reduced_motion=os.environ.get('KLC_MOTION','reduce'))  # distinguish static jitter from entrance animation
    page.set_content(HTML);page.add_style_tag(content=CSS);page.evaluate(MOCK,I18N)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_script_tag(content=app,type='module')
    try:page.wait_for_selector('input[name="identifier"]',timeout=6000)
    except Exception as e:failures.append((w,h,lang,'not rendered',str(e)));page.close();continue
    if lang=='en': page.locator('#language-select').select_option('en')
    page.wait_for_timeout(1100 if os.environ.get('KLC_MOTION')=='no-preference' else 100)
    for route,sel in [('login','input[name="identifier"]'),('forgot','input[name="email"]'),('register','input[name="username"]')]:
     if route=='forgot': page.evaluate("() => document.querySelector('[data-nav=\"/forgot-password\"]').click()")
     elif route=='register': page.evaluate("() => document.querySelector('[data-nav=\"/register\"]').click()")
     page.wait_for_selector(sel)
     samples=check_still(page,240)
     height_diff=max(x['cardHeight'] for x in samples)-min(x['cardHeight'] for x in samples)
     if height_diff>1.5:failures.append((w,h,lang,route,'jitter',round(height_diff,2)))
     if samples[-1]['scrollX']>1 or samples[-1]['scrollY']>1: failures.append((w,h,lang,route,'viewport overflow',samples[-1]))
     if samples[-1]['clipped']: failures.append((w,h,lang,route,'submit inaccessible',samples[-1]))
     if samples[-1]['actualEmpty']>28: failures.append((w,h,lang,route,'excess blank gap',samples[-1]))
    print(w,h,lang,'login/forgot/register stable',[(x['cardHeight'],x['actualEmpty']) for x in samples[-1:]],flush=True)
    if w==1910 and lang=='en':
     page.locator('[data-nav="/login"]').first.click();page.wait_for_timeout(200);page.screenshot(path='/mnt/data/klikchart-v1.4-desktop.png')
    if w==390 and lang=='id':
     page.locator('[data-nav="/login"]').first.click();page.wait_for_timeout(200);page.screenshot(path='/mnt/data/klikchart-v1.4-mobile.png')
    if errors:failures.append((w,h,lang,'pageerrors',errors))
    page.close()
  b.close()
 print('RESULT',len(failures),'failures')
 for e in failures[:60]:print(e)
 sys.exit(bool(failures))
