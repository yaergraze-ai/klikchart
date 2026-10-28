"""Isolated responsive UI smoke test: no live Supabase/OTP calls."""
from pathlib import Path
import sys,json
sys.path.insert(0,str(Path(__file__).parent))
from transition_check import HTML,CSS,MOCK,I18N,app,metric
from playwright.sync_api import sync_playwright

sizes=[(390,844),(360,640),(320,568)]
failures=[]

def take(page,label,viewport,lang):
    page.wait_for_timeout(235)
    m=metric(page)
    print(f'{viewport} {lang} {label} card={m["height"]:.0f}px scroll={m["innerScroll"]} outer={m["scrollX"] or m["scrollY"]} buttonHidden={m["overflowButton"]}',flush=True)
    if m['scrollX'] or m['scrollY'] or m['overflowButton'] or m['innerScroll']:
        failures.append((viewport,lang,label,m))

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    for vw,vh in sizes:
        for lang in ['id','en']:
            page=browser.new_page(viewport={'width':vw,'height':vh})
            page.set_content(HTML)
            page.add_style_tag(content=CSS)
            page.evaluate(MOCK,I18N)
            page.add_script_tag(content=app,type='module')
            page.wait_for_selector('input[name="identifier"]',timeout=5000)
            if lang=='en': page.locator('#language-select').select_option('en')
            viewport=f'{vw}x{vh}'
            take(page,'login',viewport,lang)
            page.locator('header [data-nav="/register"]').click()
            page.wait_for_selector('input[name="username"]')
            take(page,'register-one',viewport,lang)
            page.locator('input[name="username"]').fill('Pixel_Star27')
            page.locator('input[name="email"]').fill('pixel@example.com')
            page.locator('#submit-button').click()
            page.wait_for_selector('input[name="phone"]')
            take(page,'register-two',viewport,lang)
            page.locator('input[name="phone"]').fill('081234567890')
            page.locator('input[name="password"]').fill('MystrongPass123')
            page.locator('input[name="confirmPassword"]').fill('MystrongPass123')
            page.locator('#submit-button').click()
            page.wait_for_selector('[data-method]', timeout=5000)
            take(page,'register-method',viewport,lang)
            page.locator('#submit-button').click()
            page.wait_for_selector('[data-otp-index="0"]',timeout=5000)
            take(page,'register-otp',viewport,lang)
            page.locator('header nav [data-nav="/login"]').click()
            page.wait_for_selector('input[name="identifier"]')
            take(page,'login-again',viewport,lang)
            page.locator('input[name="identifier"]').fill('pixel@example.com')
            page.locator('input[name="password"]').fill('MystrongPass123')
            page.locator('#submit-button').click()
            page.wait_for_selector('[data-method]')
            take(page,'login-method',viewport,lang)
            page.locator('header nav [data-nav="/login"]').click()
            page.locator('button[data-nav="/forgot-password"]').click()
            page.wait_for_selector('input[name="email"]')
            take(page,'forgot',viewport,lang)
            page.locator('input[name="email"]').fill('pixel@example.com')
            page.locator('#submit-button').click()
            page.wait_for_selector('[data-method]')
            take(page,'forgot-method',viewport,lang)
            page.locator('#submit-button').click()
            page.wait_for_selector('[data-otp-index="0"]')
            take(page,'forgot-otp',viewport,lang)
            page.locator('[data-otp-index="0"]').fill('1')
            page.locator('[data-otp-index="1"]').fill('2')
            page.locator('[data-otp-index="2"]').fill('3')
            page.locator('[data-otp-index="3"]').fill('4')
            page.locator('[data-otp-index="4"]').fill('5')
            page.locator('[data-otp-index="5"]').fill('6')
            page.locator('#submit-button').click()
            page.wait_for_selector('input[name="confirmPassword"]')
            take(page,'forgot-new',viewport,lang)
            page.close()
    browser.close()
print('FULLFLOW RESULT:', 'PASS' if not failures else f'{len(failures)} ISSUES')
for f in failures:print(f)
sys.exit(bool(failures))
