import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/?session=2024-16-R');await page.locator('.recharts-line').first().waitFor();assert(await page.getByText('Historical archive',{exact:true}).isVisible());assert.equal(await page.getByText('Demo data',{exact:true}).count(),0);assert.equal(await page.locator('.podium>div').first().innerText().then(t=>t.includes('Leclerc')),true);await page.screenshot({path:'desktop.png',fullPage:true});
await page.getByRole('button',{name:'Clear',exact:true}).click();assert(await page.getByText('Your race, your drivers.').isVisible());
await page.getByRole('button',{name:'Show podium finishers'}).click();assert.equal(await page.locator('.driver-chip.selected').count(),3);
await page.getByRole('button',{name:'SAI',exact:false}).first().click();await page.getByRole('button',{name:'HAM',exact:false}).first().click();await page.getByRole('button',{name:'VER',exact:false}).first().click();assert.equal(await page.locator('.driver-chip.selected').count(),5);assert(await page.getByText('Five drivers selected. Remove one to add another.').isVisible());
await page.locator('.moment').nth(1).click();assert(await page.getByText('Highlighting laps 32–39', {exact:false}).isVisible());assert.equal(await page.locator('#lap').inputValue(),'39');
await page.getByLabel('Race events').uncheck();assert.equal(await page.locator('.recharts-reference-dot').count(),0);
await page.locator('#lap').fill('33');assert.equal(await page.locator('#lap').inputValue(),'33');
await page.getByRole('button',{name:'Show all 20 drivers'}).click();assert.equal(await page.locator('.strategy-row').count(),20);
await page.locator('#driver0').selectOption('HAM');assert(await page.getByText('Cross-team comparison', {exact:false}).isVisible());
await page.locator('#driver1').selectOption('RUS');assert.equal(await page.locator('.cross-team').count(),0);
await page.locator('.stint').first().click();assert.equal(await page.locator('.driver-chip.selected').count(),1);
await page.getByRole('button',{name:'Clear',exact:true}).click();await page.getByLabel('Add another driver').selectOption('TSU');await page.locator('#lap').fill('53');assert(await page.locator('.lap-readout').getByText('Retired · 7 laps').isVisible());await page.getByLabel('Add another driver').selectOption('OCO');assert(await page.locator('.lap-readout').getByText('Finished · +1 lap').isVisible());await page.locator('#driver0').selectOption('TSU');assert(await page.locator('.compare-row').first().getByText('DNF').isVisible());
await page.getByText('Data sources & calculation notes',{exact:true}).click();assert(await page.getByText('This is a saved historical snapshot',{exact:false}).isVisible());await page.getByText('Data sources & calculation notes',{exact:true}).click();
await page.reload();await page.locator('.recharts-line').first().waitFor();await page.locator('.recharts-wrapper').scrollIntoViewIfNeeded();const chart=await page.locator('.recharts-wrapper').boundingBox();await page.mouse.move(chart.x+chart.width*.6,chart.y+130);assert(await page.locator('.tooltip').isVisible());await page.mouse.move(0,0);
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'mobile.png',fullPage:true});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: selection limit, empty state, recovery, moments, event toggle, lap slider, all strategies, comparison, stint link, mobile width, zero runtime errors');await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,3000))]);process.exit(0);




