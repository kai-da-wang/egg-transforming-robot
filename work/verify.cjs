const {chromium}=require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path'),fs=require('fs'),assert=require('assert');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().startsWith('http'))requests.push(r.url());});
 await page.goto('file:///'+path.resolve(__dirname,'../outputs/蛋形机器人-交互演示.html').replaceAll('\\','/'));await page.waitForFunction(()=>window.eggDemo?.ready);
 await page.click('#btnClosed');await page.waitForFunction(()=>eggDemo.state.deploy===0);assert.equal(await page.locator('#modeLabel').innerText(),'蛋形 · 已收拢');
 await page.keyboard.press('Space');await page.waitForFunction(()=>eggDemo.state.deploy===1);
 const a=await page.evaluate(()=>({x:eggDemo.state.x,z:eggDemo.state.z}));await page.keyboard.down('KeyW');await page.waitForTimeout(900);await page.keyboard.up('KeyW');
 const b=await page.evaluate(()=>({x:eggDemo.state.x,z:eggDemo.state.z}));assert(b.z<a.z-.1,'forward movement failed');
 await page.keyboard.down('KeyA');await page.waitForTimeout(1400);await page.keyboard.up('KeyA');assert(await page.evaluate(()=>eggDemo.state.yaw)>.02,'turn failed');
 const pad=page.locator('[data-move="back"]');const r=await pad.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.waitForTimeout(1400);await page.mouse.up();assert(await page.evaluate(()=>eggDemo.state.z)>b.z,'pointer movement failed');
 await page.click('#btnXray');assert(await page.evaluate(()=>eggDemo.rig.materials.shell.opacity)<.2);await page.click('#btnXray');
 await page.click('#btnWalk');await page.waitForTimeout(350);assert(await page.evaluate(()=>eggDemo.state.walk&&eggDemo.state.phase>0));await page.click('#btnWalk');
 await page.click('#btnDemo');await page.waitForTimeout(400);assert(await page.evaluate(()=>eggDemo.state.demo));await page.click('#btnDemo');
 await page.locator('#transform').fill('47');await page.waitForTimeout(1200);assert(Math.abs(await page.evaluate(()=>eggDemo.state.deploy)-.47)<.01);
 await page.locator('#speed').fill('1.3');assert.equal(await page.evaluate(()=>eggDemo.state.speed),1.3);
 for(const id of ['btnViewTop','btnViewFront','btnViewIso'])await page.click('#'+id);
 await page.click('#btnReset');assert(await page.evaluate(()=>eggDemo.state.x===0&&eggDemo.state.z===0&&eggDemo.state.target===1));
 // Check all transformation and gait samples against the floor using actual geometry.
 const geometry=await page.evaluate(()=>{
   const rig=eggDemo.rig,p=new THREE.Vector3(),results=[];
   for(let i=0;i<=10;i++){rig.setPose(i/10);rig.robot.updateMatrixWorld(true);let min=Infinity;
     for(const o of rig.shellMeshes){let a=o.geometry.attributes.position;for(let j=0;j<a.count;j++){p.fromBufferAttribute(a,j).applyMatrix4(o.matrixWorld);min=Math.min(min,p.y);}}
     results.push({deploy:i/10,min});}
   rig.setPose(1);return results;
 });assert(geometry.every(s=>s.min>=-.001),'shell intersects the floor');
 const downloadPromise=page.waitForEvent('download');await page.click('#btnExport');const dl=await downloadPromise;const glbPath=path.join(__dirname,'../outputs/蛋形变形机器人.glb');await dl.saveAs(glbPath);
 const glb=fs.readFileSync(glbPath);assert.equal(glb.toString('utf8',0,4),'glTF');assert.equal(glb.readUInt32LE(4),2);assert.equal(glb.readUInt32LE(8),glb.length);
 const jsonLength=glb.readUInt32LE(12),json=JSON.parse(glb.subarray(20,20+jsonLength).toString('utf8'));
 assert.equal(json.animations.length,4);assert(json.nodes.length>100);assert(!json.buffers[0].uri,'GLB should embed geometry');
 const animStats=json.animations.map(a=>({name:a.name,channels:a.channels.length}));
 await page.evaluate(()=>document.getElementById('toast').classList.remove('show'));await page.waitForTimeout(300);await page.screenshot({path:path.join(__dirname,'../outputs/蛋形机器人-预览.png')});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await page.screenshot({path:path.join(__dirname,'mobile.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile horizontal overflow');
 const report={errors,networkRequests:requests,geometry,animations:animStats,nodes:json.nodes.length,meshes:json.meshes.length,glbBytes:glb.length,checks:['offline launch','close/open','keyboard move/turn','pointer move','xray','auto walk','auto transform','transform slider','speed slider','view controls','reset','floor clearance','GLB export','mobile layout']};
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));assert.equal(errors.length,0);assert.equal(requests.length,0);await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
