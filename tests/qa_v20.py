"""Nonproduction browser QA. HTTP static server + mocked API, test all auth stages/viewport."""
import json, threading, contextlib, socketserver, http.server, os, sys
from pathlib import Path
import base64,re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/'public'
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_GET(self):
        if self.path in ('/login','/register','/forgot-password','/app'):
            self.path='/index.html'
        return super().do_GET()
    def log_message(self,*args): pass
class HTTP(socketserver.ThreadingTCPServer):allow_reuse_address=True;daemon_threads=True
HTML=(ROOT/'index.html').read_text()
HTML=re.sub(r'<link\b[^>]*>', '',HTML)
HTML=re.sub(r'<script\b[^>]*>\s*</script>', '',HTML)
CSS='\n'.join((ROOT/'assets/css'/n).read_text() for n in ['style.css','motion-story.css','v20-polish.css'])
for img in ['purple-silk-640.webp','purple-silk-960.webp','purple-silk-1672.webp']:
 data=base64.b64encode((ROOT/'assets/images'/img).read_bytes()).decode()
 CSS=CSS.replace("url('/assets/images/"+img+"')",f"url('data:image/webp;base64,{data}')")
as_url=lambda s:'data:text/javascript;base64,'+base64.b64encode(s.encode()).decode()
I18N={l:json.loads((ROOT/'assets/i18n'/f'{l}.json').read_text()) for l in ['id','en']}
MOCK='''({id,en})=>{
Object.defineProperty(window,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},configurable:true});
history.pushState=function(){};history.replaceState=function(){};
window.fetch=async url=>{const x=String(url),path=x.split('/api/').pop();let data={};
if(x.endsWith('id.json'))return new Response(JSON.stringify(id),{status:200,headers:{'Content-Type':'application/json'}});
if(x.endsWith('en.json'))return new Response(JSON.stringify(en),{status:200,headers:{'Content-Type':'application/json'}});
if(path==='config')data={channels:['email','whatsapp'],languages:['id','en'],loginRequiresOTP:true};
else if(path==='login'||path==='register')data={methods:[{channel:'email',masked:'ab***@example.com'},{channel:'whatsapp',masked:'62812****890'}]};
else if(path.endsWith('verify'))data={verified:true,ready:true};
else data={expiresIn:300,accepted:true,resendAfter:60};
return new Response(JSON.stringify({ok:true,data}),{status:200,headers:{'Content-Type':'application/json'}});
};
}'''
I18N_JS=as_url((ROOT/'assets/js/i18n.js').read_text())
API_JS=as_url((ROOT/'assets/js/api.js').read_text())
FORMS_JS=as_url((ROOT/'assets/js/ui/forms.js').read_text().replace("'../i18n.js'",repr(I18N_JS)))
MOTION_JS=as_url((ROOT/'assets/js/ui/motion.js').read_text())
HERO_JS=as_url((ROOT/'assets/js/ui/hero-motion.js').read_text())
APP=(ROOT/'assets/js/app.js').read_text().replace("'./i18n.js'",repr(I18N_JS)).replace("'./api.js'",repr(API_JS)).replace("'./ui/forms.js'",repr(FORMS_JS)).replace("'./ui/motion.js'",repr(MOTION_JS)).replace("'./ui/hero-motion.js'",repr(HERO_JS))
def metrics(page):
 return page.evaluate('''() => {
const doc=document.documentElement, card=document.querySelector('.auth-card'),a=document.querySelector('.auth-content'),main=document.querySelector('.main');
const btn=document.querySelector('#submit-button');let b=btn?.getBoundingClientRect(),k=card?.getBoundingClientRect();
return {scrollX:doc.scrollWidth-innerWidth,scrollY:doc.scrollHeight-innerHeight,
mainScroll:main.scrollHeight-main.clientHeight,authScroll:a.scrollHeight-a.clientHeight,
buttonOut:!!btn&&(b.bottom>a.getBoundingClientRect().bottom+1),cardOutside:!!card&&(k.bottom>innerHeight-10||k.top<0),
header:document.querySelector('.header').getBoundingClientRect().height,hero:document.querySelector('.intro').getBoundingClientRect().height,
viewport:innerHeight,card:Math.round(k.height), stage:document.body.dataset.authStage,
focus:document.body.classList.contains('klc-mobile-focus'),tight:document.body.classList.contains('klc-mobile-tight')};}''')
def snapshots(page,tag,w,h):
 page.screenshot(path=str(Path('/mnt/data/klikchart_v20')/f'{tag}_{w}x{h}.png'),full_page=True)
def step(page,tag,w,h,screens=False):
 page.wait_for_timeout(220)
 m=metrics(page)
 print(w,h,tag,json.dumps(m),flush=True)
 if screens: snapshots(page,tag,w,h)
 return m
if __name__=='__main__':
 with sync_playwright() as p:
   browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
   problems=[]
   for w,h in [(390,844),(360,640),(320,568),(414,896),(768,1024),(1280,720),(1366,768),(1440,900)]:
    ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=w<=414,has_touch=w<=414,device_scale_factor=1)
    ctx.route('**/api/**',lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'data': {'channels':['email','whatsapp'],'loginRequiresOTP':True,'signupRequiresOTP':True,'languages':['id','en']} if route.request.url.endswith('/api/config') else {'methods':[{'channel':'email','masked':'ab***@example.com'},{'channel':'whatsapp','masked':'62812****890'}]} if route.request.url.endswith(('/api/login','/api/register')) else {'verified':True,'ready':True,'expiresIn':300,'accepted':True}})))
    page=ctx.new_page();err=[];page.on('pageerror',lambda e:err.append(str(e)))
    page.set_content(HTML);page.add_style_tag(content=CSS);page.evaluate(MOCK,I18N);page.add_script_tag(content=APP,type='module');page.wait_for_selector('input[name="identifier"]',timeout=8000)
    def ck(label,screen=False):
     m=step(page,label,w,h,screen)
     if m['scrollX']>1 or m['scrollY']>1 or m['authScroll']>2 or m['buttonOut'] or m['cardOutside']: problems.append((w,h,label,m))
    ck('login',False)
    page.locator('header [data-nav="/register"]').click();page.wait_for_selector('input[name="username"]');ck('register1')
    page.locator('input[name="username"]').fill('Pixel_Star27');page.locator('input[name="email"]').fill('pixel@example.com');page.locator('#submit-button').click();page.wait_for_selector('input[name="phone"]');ck('register2',False)
    page.locator('input[name="phone"]').fill('081234567890');page.locator('input[name="password"]').fill('MystrongPass123');page.locator('input[name="confirmPassword"]').fill('MystrongPass123');page.locator('#submit-button').click();page.wait_for_selector('[data-method]');ck('register-methods')
    page.locator('#submit-button').click();page.wait_for_selector('[data-otp-index="0"]');ck('register-otp')
    page.locator('header nav [data-nav="/login"]').click();page.wait_for_selector('input[name="identifier"]');page.locator('[data-nav="/forgot-password"]').click();page.wait_for_selector('input[name="email"]');ck('forgot')
    page.locator('input[name="email"]').fill('pixel@example.com');page.locator('#submit-button').click();page.wait_for_selector('[data-method]');ck('forgot-methods')
    page.locator('#submit-button').click();page.wait_for_selector('[data-otp-index="0"]');ck('forgot-otp')
    if err:problems.append((w,h,'js-errors',err))
    ctx.close()
   browser.close()
   print('ISSUES',len(problems),json.dumps(problems[:100]),flush=True)
   sys.exit(bool(problems))
