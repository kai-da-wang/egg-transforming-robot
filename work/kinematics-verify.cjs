const {chromium}=require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path'),fs=require('fs'),assert=require('assert');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage();await page.goto('file:///'+path.resolve(__dirname,'../outputs/蛋形机器人-交互演示.html').replaceAll('\\','/'));await page.waitForFunction(()=>window.eggDemo?.ready);
 const results=await page.evaluate(()=>{
  const rig=createEggRobot(),gait=createGroundedGait(),v=new THREE.Vector3(),p=new THREE.Vector3(),q=new THREE.Quaternion();
  const s={x:0,z:0,yaw:0,phase:0,move:0,turn:0,travel:1,speed:1,deploy:1};const dt=1/60;
  let stanceDrift=0,orientationDrift=0,linkError=0,groundError=0,maxReach=0,minSupports=6,limited=0;let previous=[];
  const footMeshes=rig.limbs.map(l=>l.ankle.children.find(o=>o.name.startsWith('Foot_shell')));
  for(let step=0;step<1440;step++){
   const period=Math.floor(step/180);s.move=[1,-1,1,0,1,-1,0,0][period];s.turn=[0,0,1,1,-1,1,0,0][period];s.speed=[.8,1.5,1,.3,1.5,.8,1,1][period];
   const scale=gait.prepareMotion(s,dt);
   s.phase+=dt*Math.PI*s.speed;s.yaw+=s.turn*dt*s.speed*.1*scale;s.x-=Math.sin(s.yaw)*s.move*dt*s.speed*.16*scale;s.z-=Math.cos(s.yaw)*s.move*dt*s.speed*.16*scale;
   const targets=gait.update(s,dt);rig.robot.position.x=s.x;rig.robot.position.z=s.z;rig.robot.rotation.y=s.yaw;rig.setPose(1,s.phase,1,s.turn,s.move,targets);
   limited+=rig.diagnostics.reachLimited;maxReach=Math.max(maxReach,rig.diagnostics.maxReach);
   const contacts=gait.getContacts();minSupports=Math.min(minSupports,contacts.filter(f=>f.grounded).length);
   const now=[];
   for(let i=0;i<6;i++){
    const l=rig.limbs[i],foot=footMeshes[i];l.hip.getWorldPosition(v);l.knee.getWorldPosition(p);linkError=Math.max(linkError,Math.abs(v.distanceTo(p)-.46));l.ankle.getWorldPosition(v);linkError=Math.max(linkError,Math.abs(v.distanceTo(p)-.54));
    const world=v.clone(),rot=foot.getWorldQuaternion(q).clone();
    if(contacts[i].grounded&&previous[i]?.grounded){stanceDrift=Math.max(stanceDrift,world.distanceTo(previous[i].p));orientationDrift=Math.max(orientationDrift,1-Math.abs(rot.dot(previous[i].q)));}
    if(step%12===0){let min=Infinity;const a=foot.geometry.attributes.position;for(let j=0;j<a.count;j++){p.fromBufferAttribute(a,j).applyMatrix4(foot.matrixWorld);min=Math.min(min,p.y);}groundError=Math.max(groundError,Math.abs(min-(.006+targets[i].lift)));}
    now.push({grounded:contacts[i].grounded,p:world,q:rot});
   }
   previous=now;
  }
  return {frames:1440,simulatedSeconds:24,stanceDrift,orientationDrift,linkLengthError:linkError,groundHeightError:groundError,maxReach,reachLimitEvents:limited,minimumSupportFeet:minSupports,finalDiagnostics:gait.getDiagnostics()};
 });
 fs.writeFileSync(path.join(__dirname,'kinematics-verification.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 assert(results.stanceDrift<1e-7);assert(results.orientationDrift<1e-7);assert(results.linkLengthError<1e-7);assert(results.groundHeightError<1e-7);assert.equal(results.reachLimitEvents,0);assert(results.minimumSupportFeet>=3);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
