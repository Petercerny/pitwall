import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/circuit');await page.locator('.circuit-canvas[data-ready=true]').waitFor({timeout:45000});
 assert.equal(await page.locator('.circuit-canvas canvas').count(),1);
 await page.screenshot({path:'circuit-desktop.png',fullPage:true});
 await page.locator('.circuit-location-list').getByRole('button',{name:'Variante Ascari'}).click();await page.waitForTimeout(900);assert(await page.getByRole('heading',{name:'A change of direction through the park'}).isVisible());
 await page.getByRole('button',{name:'Track plan',exact:true}).click();await page.waitForTimeout(900);assert.equal(await page.getByRole('button',{name:'Track plan',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Reset circuit camera'}).click();await page.waitForTimeout(900);
 await page.getByLabel('Illustrative lap progress',{exact:true}).fill('48');assert.equal(await page.locator('.circuit-tour output').innerText(),'48%');
 await page.getByRole('button',{name:'Play illustrative lap tour'}).click();await page.waitForTimeout(700);assert((await page.locator('.circuit-tour input').inputValue())>48);await page.getByRole('button',{name:'Pause illustrative lap tour'}).click();
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.getByRole('button',{name:'Zoom out',exact:true}).click();
 const canvas=await page.locator('.circuit-canvas canvas').boundingBox();await page.mouse.move(canvas.x+canvas.width*.5,canvas.y+canvas.height*.5);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width*.5+80,canvas.y+canvas.height*.5+20,{steps:8});await page.mouse.up();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Reset circuit camera'}).click();await page.waitForTimeout(1000);await page.screenshot({path:'circuit-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewportSize({width:320,height:800});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Context loss keeps the location descriptions and geographic outline usable.
 await page.locator('.circuit-canvas canvas').evaluate(c=>c.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));assert(await page.getByText('The 3D view was interrupted.',{exact:false}).isVisible());await page.locator('.circuit-location-list').getByRole('button',{name:'Prima Variante'}).click();assert(await page.getByRole('heading',{name:'A straight becomes a braking zone'}).isVisible());
 const fallback=await browser.newPage();await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args);};});await fallback.goto('http://127.0.0.1:5173/circuit');assert(await fallback.getByText('Interactive 3D is unavailable on this device.',{exact:false}).isVisible());await fallback.locator('.circuit-location-list').getByRole('button',{name:'Lesmo curves'}).click();assert(await fallback.getByRole('heading',{name:'Two corners, one flowing rhythm'}).isVisible());await fallback.close();
 assert.deepEqual(errors,[]);console.log('PASS: WebGL scene, locations, camera, tour, drag, mobile layout, context-loss fallback; zero runtime errors.');
}finally{await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,3000))]);}
process.exit(0);
