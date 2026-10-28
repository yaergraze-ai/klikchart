"""Isolated browser layout check using mock API ONLY. Never tests Supabase, SMTP or Fonnte."""
import json,os,threading,sys,time
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/'public'
PORT=8775
OUT=Path('/mnt/data/klikchart_visual_qa');OUT.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,fmt,*args):pass
 def json(self,code,data):
  raw=json.dumps({'ok':code<400,**({'data':data} if code<400 else {'error':{'code':'UNAUTHORIZED','message':'UNAUTHORIZED'}})}).encode()
  self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
 def do_GET(self):
  url=urlparse(self.path).path
  if url=='/api/config':return self.json(200,{'channels':['email','whatsapp'],'languages':['id','en'],'loginRequiresOTP':True})
  if url=='/api/me':return self.json(200,{'username':'Pixel_Star27','email':'pixel@example.com'})
  if url.startswith('/api/'):return self.json(200,{})
  if url in ('/login','/register','/forgot-password','/app'):self.path='/index.html'
  return super().do_GET()
 def do_POST(self):
  path=urlparse(self.path).path
  length=int(self.headers.get('Content-Length','0'));self.rfile.read(length)
  if path in ('/api/register','/api/login'):
   return self.json(200,{'methods':[{'channel':'email','masked':'pi***@example.com'},{'channel':'whatsapp','masked':'62812****890'}]})
  if path.endswith('/verify'):return self.json(200,{'verified':True,'username':'Pixel_Star27','ready':True})
  if path=='/api/forgot/reset':return self.json(200,{'changed':True})
  if path=='/api/forgot/send':return self.json(200,{'accepted':True,'resendAfter':60})
  return self.json(200,{'expiresIn':300,'resendAfter':60})

def app_loaded(page):
 page.wait_for_selector('#active-form',timeout=12000)
 page.wait_for_timeout(40)

def metrics(page,width,height,stage,language):
 data=page.evaluate('''() => {
 const c=document.querySelector('.auth-card').getBoundingClientRect();
 const a=document.querySelector('.auth-content');
 return {screenW:document.documentElement.scrollWidth, screenH:document.documentElement.scrollHeight,
 viewportW:innerWidth,viewportH:innerHeight,cardTop:c.top,cardBottom:c.bottom,
 innerScroll:a.scrollHeight>a.clientHeight+2, buttonCount:document.querySelectorAll('button').length};
 }''')
 if data['screenW']>width+1 or data['screenH']>height+1 or data['cardBottom']>height+1 or data['cardTop']<0:
  print('OVERFLOW',width,height,language,stage,data,flush=True)
  return False
 return True

def snap(page,width,height,language,stage):
 name=f'{width}x{height}_{language}_{stage}.png';page.screenshot(path=str(OUT/name),full_page=False,animations='disabled')
 return metrics(page,width,height,stage,language)

if __name__=='__main__':
 httpd=ThreadingHTTPServer(('127.0.0.1',PORT),Handler)
 thread=threading.Thread(target=httpd.serve_forever,daemon=True);thread.start()
 sizes=[(320,568),(360,640),(390,844),(768,1024),(1024,768),(1366,768),(1440,900)]
 problems=[];done=0
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for width,height in sizes:
   for lang in ['id','en']:
    context=browser.new_context(viewport={'width':width,'height':height},reduced_motion='reduce')
    page=context.new_page()
    page.route('https://fonts.googleapis.com/**',lambda route:route.abort())
    page.route('https://fonts.gstatic.com/**',lambda route:route.abort())
    try:
     page.goto(f'http://127.0.0.1:{PORT}/login',wait_until='domcontentloaded',timeout=20000)
     app_loaded(page)
     if lang=='en':page.locator('#language-select').select_option('en')
     page.wait_for_timeout(90)
     if not snap(page,width,height,lang,'login'):problems.append((width,height,lang,'login'))
     page.locator('[data-nav="/register"]').first.click()
     app_loaded(page)
     if not snap(page,width,height,lang,'register1'):problems.append((width,height,lang,'register1'))
     page.locator('[name=username]').fill('Pixel_Star27');page.locator('[name=email]').fill('pixel@example.com')
     page.locator('#submit-button').click()
     page.wait_for_selector('[name=phone]',timeout=5000)
     if not snap(page,width,height,lang,'register2'):problems.append((width,height,lang,'register2'))
     page.locator('[name=phone]').fill('081234567890');page.locator('[name=password]').fill('ExamplePassword27');page.locator('[name=confirmPassword]').fill('ExamplePassword27')
     page.locator('#submit-button').click()
     page.wait_for_selector('[data-method]',timeout=6000)
     if not snap(page,width,height,lang,'methods'):problems.append((width,height,lang,'methods'))
     page.locator('#submit-button').click()
     page.wait_for_selector('#otp-boxes',timeout=6000)
     if not snap(page,width,height,lang,'otp'):problems.append((width,height,lang,'otp'))
     for i,x in enumerate('123456'):page.locator(f'#otp-{i}').fill(x)
     page.locator('#submit-button').click()
     page.wait_for_selector('dialog[open] .modal-success',timeout=6000)
     if not snap(page,width,height,lang,'success'):problems.append((width,height,lang,'success'))
     page.locator('.dialog-done').click()
     page.wait_for_selector('#active-form',timeout=6000)
     page.locator('[data-nav="/forgot-password"]').click()
     page.wait_for_selector('[name=email]',timeout=6000)
     if not snap(page,width,height,lang,'forgot'):problems.append((width,height,lang,'forgot'))
     page.locator('[name=email]').fill('pixel@example.com');page.locator('#submit-button').click()
     page.wait_for_selector('[data-method]',timeout=6000)
     if not snap(page,width,height,lang,'forgot_methods'):problems.append((width,height,lang,'forgot_methods'))
     page.locator('#submit-button').click();page.wait_for_selector('#otp-boxes',timeout=6000)
     for i,x in enumerate('123456'):page.locator(f'#otp-{i}').fill(x)
     page.locator('#submit-button').click();page.wait_for_selector('[name=confirmPassword]',timeout=6000)
     if not snap(page,width,height,lang,'new_password'):problems.append((width,height,lang,'new_password'))
     done+=1;print('OK',width,height,lang,flush=True)
    except Exception as e:
     problems.append((width,height,lang,str(e)[:180]));print('ERROR',width,height,lang,str(e)[:180],flush=True)
    context.close()
  browser.close()
 httpd.shutdown()
 print('VISUAL_COMPLETED',done,'of',len(sizes)*2,'PROBLEMS',len(problems),flush=True)
 if problems:print(json.dumps(problems,indent=2),flush=True)
 sys.exit(1 if problems else 0)
