"""Browser-only auth transition/layout QA. Static assets + mock fetch; no real backend."""
import base64,json,re,sys
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
i18n=(DATA/'js/i18n.js').read_text();i18n_url=as_url(i18n)
forms=(DATA/'js/ui/forms.js').read_text().replace("'../i18n.js'",repr(i18n_url));forms_url=as_url(forms)
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

def metric(page):
 return page.evaluate('''() => {const card=document.querySelector('.auth-card').getBoundingClientRect();
 const a=document.getElementById('auth-content');return {height:card.height,top:card.top,bottom:card.bottom,
  innerScroll:a.scrollHeight>a.clientHeight+2,allowScroll:document.querySelector('.auth-card').classList.contains('allow-scroll'),
  scrollX:document.documentElement.scrollWidth>innerWidth+1,scrollY:document.documentElement.scrollHeight>innerHeight+1,
  contentHeight:a.clientHeight,contentScroll:a.scrollHeight,overflowButton:!!document.querySelector('#submit-button')&&!document.querySelector('.auth-card').classList.contains('allow-scroll')&&document.querySelector('#submit-button').getBoundingClientRect().bottom > a.getBoundingClientRect().bottom+2
 };}''')

if __name__=='__main__':
 failures=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for w,h in [(1366,768),(1440,900),(1024,768),(768,1024),(390,844),(360,640),(320,568)]:
   for lang in ['id','en']:
    page=browser.new_page(viewport={'width':w,'height':h})
    page.set_content(HTML)
    page.add_style_tag(content=CSS)
    page.evaluate(MOCK,I18N)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_script_tag(content=app,type='module')
    page.wait_for_selector('input[name="identifier"]',timeout=6000)
    if lang=='en':page.locator('#language-select').select_option('en')
    page.wait_for_timeout(550)
    results=[('login',metric(page))]
    for path,label,expected in [('/register','register','username'),('/login','login-again','identifier'),('/forgot-password','forgot','email'),('/login','login-final','identifier')]:
     immediately=page.evaluate('''([path,name])=>{document.querySelector(`[data-nav="${path}"]`).click();return !!document.querySelector(`[name="${name}"]`)}''',[path,expected]);
     if not immediately:failures.append((w,h,lang,label,'delayed view'))
     page.wait_for_timeout(185)
     results.append((label,metric(page)))
    # Registration step 2 can use inner scrolling on short screens.
    page.evaluate('''()=>document.querySelector('[data-nav="/register"]').click()''')
    page.locator('[name="username"]').fill('Pixel_Star27');page.locator('[name="email"]').fill('pixel@example.com')
    page.locator('#submit-button').click()
    page.wait_for_selector('[name="phone"]',timeout=3000)
    results.append(('register-step2',metric(page)))
    # Compact views should be shorter than longer forms rather than leaving dead space.
    heights=[m['height'] for _,m in results]
    if results[0][1]['height'] <= 0:
     failures.append((w,h,lang,'missing card height',heights))
    for name,m in results:
     if m['scrollX'] or m['scrollY'] or m['overflowButton']:
      failures.append((w,h,lang,name,m))
    if errors:failures.append((w,h,lang,'errors',errors))
    print(w,h,lang,'card-heights',list(map(lambda x:round(x,1),heights)), 'inner-scroll',[(n,m['innerScroll']) for n,m in results],flush=True)
    page.close()
  browser.close()
 print('RESULT:', 'PASS' if not failures else f'{len(failures)} FAILURES',flush=True)
 for fail in failures[:40]:print(fail)
 sys.exit(bool(failures))
