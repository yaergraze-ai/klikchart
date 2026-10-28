import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const read=(p)=>readFileSync(path.resolve('public',p),'utf8');
const markup=read('dashboard.html');
const script=read('assets/dashboard/dashboard.js');
const style=read('assets/dashboard/dashboard.css');
const auth=read('assets/js/app.js');
const forms=read('assets/js/ui/forms.js');
const server=readFileSync('backend/app.js','utf8');
test('dashboard provides desktop and mobile viewport layout',()=>{
 assert.match(markup,/name="viewport"/);
 assert.match(style,/@media\(max-width:760px\)/);
 assert.match(style,/\.sidebar-overlay/);
 assert.match(markup,/id="mobile-menu"/);
});
test('dashboard has all five sections and data demo disclosure',()=>{
 for(const id of ['overview','orders','products','customers','analytics'])assert.match(markup,new RegExp('id="'+id+'-panel"'));
 assert.match(markup,/DATA DEMONSTRASI/);
 assert.match(markup,/belum berasal dari transaksi Supabase/);
});
test('dashboard uses authenticated me API except in explicit demo mode',()=>{
 assert.match(script,/fetch\('\/api\/me'/);
 assert.match(script,/state\.demo/);
 assert.match(script,/location\.replace\('\/login'\)/);
});
test('dashboard demo labels data and exports CSV locally',()=>{
 assert.match(script,/function exportCsv\(/);
 assert.match(script,/klikchart-pesanan-demo\.csv/);
 assert.match(markup,/id="export-button"/);
});
test('login OTP routes to dashboard and profile remains available',()=>{
 assert.match(auth,/location\.assign\('\/dashboard'\)/);
 assert.match(forms,/data-action="dashboard"/);
 assert.match(markup,/href="\/app"/);
 assert.match(server,/app\.get\('\/dashboard'/);
});
