const {chromium}=require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path');
const fs=require('fs');
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('file:///'+path.resolve(__dirname,'../outputs/蛋形机器人-交互演示.html').replaceAll('\\','/'));
  await page.waitForFunction(()=>window.eggDemo?.ready,{timeout:30000});
  await page.waitForTimeout(1500);
  await page.screenshot({path:path.join(__dirname,'preview-open.png')});
  console.log('initial',await page.evaluate(()=>({height:eggDemo.rig.robot.position.y,size:eggDemo.renderer.getSize(new THREE.Vector2()).toArray(),triangles:eggDemo.renderer.info.render.triangles})));
  await page.evaluate(()=>eggDemo.setPose(0));await page.waitForTimeout(150);await page.screenshot({path:path.join(__dirname,'preview-closed.png')});
  await page.evaluate(()=>{eggDemo.setPose(1);eggDemo.setView('top');});await page.waitForTimeout(150);await page.screenshot({path:path.join(__dirname,'preview-top.png')});
  console.log('errors',errors);
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
