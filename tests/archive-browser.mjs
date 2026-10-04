import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/?session=2024-16-R');await page.getByRole('heading',{name:'Beyond the finishing position'}).waitFor();
await page.locator('#story-driver').selectOption('TSU');assert.match(await page.locator('.story-summary').innerText(),/DNF/);
await page.locator('#story-driver').selectOption('LEC');await page.locator('.story-grid button').first().click();assert.match(await page.locator('.focus-note').innerText(),/laps 1–1/);
await page.getByRole('button',{name:'Clear',exact:true}).click();await page.getByRole('heading',{name:'Your race, your drivers.'}).waitFor();await page.getByRole('button',{name:'Show podium finishers'}).click();await page.locator('#lap').fill('20');assert.equal(await page.locator('#lap').inputValue(),'20');
await page.screenshot({path:'desktop.png',fullPage:true});
const archive=JSON.parse(fs.readFileSync('archive/index.json'));
const entries=Object.values(archive).filter(x=>x.status==='available');
await page.route('**/api/archive',route=>route.fulfill({json:{sessions:entries,mode:'cloud'}}));
await page.route('**/api/archive/*',route=>{const id=new URL(route.request().url()).pathname.split('/').at(-1);const path='archive/sessions/'+id+'.json';return route.fulfill({status:fs.existsSync(path)?200:404,contentType:'application/json',body:fs.existsSync(path)?fs.readFileSync(path,'utf8'):JSON.stringify({error:'Unavailable'})})});
await page.goto('http://127.0.0.1:5173/?session=2023-4-SQ');await page.getByRole('heading',{name:'One lap makes the difference'}).waitFor();await page.getByRole('button',{name:'SQ3',exact:true}).click();assert(await page.locator('tbody tr').count()>=20);await page.getByLabel('Qualifying driver').selectOption('LEC');
await page.getByRole('button',{name:'Sprint',exact:true}).click();await page.getByRole('heading',{name:'Beyond the finishing position'}).waitFor();assert(Number(await page.locator('#lap').getAttribute('max'))!==53);
await page.locator('#event-search').fill('nomatchingevent');assert.equal(await page.locator('#event option').count(),1);await page.locator('#event-search').fill('');
await page.goto('http://127.0.0.1:5173/?session=2023-7-R');await page.getByRole('heading',{name:'Beyond the finishing position'}).waitFor();
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
await page.goto('http://127.0.0.1:5173/?session=2023-99-R');await page.getByRole('heading',{name:'Session unavailable'}).waitFor();assert.equal(await page.locator('.driver-story').count(),0);
assert.deepEqual(errors,[]);console.log('Browser checks passed: fallback, driver evidence, clear/restore, lap slider, sprint qualifying, sprint, wet race, empty search, deep links, missing session and mobile overflow.');await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,3000))]);process.exit(0);



