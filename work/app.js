(function () {
  'use strict';
  const T=THREE,$=id=>document.getElementById(id),view=$('viewport');
  let renderer;
  try { renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}); }
  catch(e) { $('busy').textContent='无法启动 3D 显示，请使用 Chrome 或 Edge，并开启浏览器硬件加速。';return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.97;
  view.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','可拖动旋转的蛋形机器人 3D 模型');
  const scene=new T.Scene();scene.background=new T.Color(0xe5e3dd);scene.fog=new T.Fog(0xe5e3dd,19,48);
  const camera=new T.PerspectiveCamera(36,1,.1,100);camera.position.set(6.1,5.4,6.8);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.70,0);controls.enableDamping=true;
  controls.minDistance=4.8;controls.maxDistance=17;controls.maxPolarAngle=Math.PI*.485;controls.minPolarAngle=.025;controls.enablePan=false;
  const envCanvas=document.createElement('canvas');envCanvas.width=512;envCanvas.height=256;
  const ec=envCanvas.getContext('2d'),eg=ec.createLinearGradient(0,0,0,256);eg.addColorStop(0,'#ffffff');eg.addColorStop(.48,'#d8dddd');eg.addColorStop(1,'#787f82');ec.fillStyle=eg;ec.fillRect(0,0,512,256);
  ec.fillStyle='#ffffff';ec.fillRect(60,25,55,125);ec.fillRect(330,45,105,75);
  const et=new T.CanvasTexture(envCanvas);et.mapping=T.EquirectangularReflectionMapping;et.colorSpace=T.SRGBColorSpace;
  const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(et).texture;et.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xffffff,0x717971,.85));
  const key=new T.DirectionalLight(0xfff5e7,2.3);key.position.set(-3.5,8,5);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-8;key.shadow.camera.right=8;key.shadow.camera.top=8;key.shadow.camera.bottom=-8;key.shadow.camera.far=25;key.shadow.normalBias=.015;key.shadow.bias=-.00015;key.shadow.radius=5;scene.add(key);scene.add(key.target);
  const fill=new T.DirectionalLight(0xe1f0ff,.65);fill.position.set(5,4,-5);scene.add(fill);
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0xd9d6cd,roughness:.72,metalness:.02}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  const grid=new T.GridHelper(80,32,0xadafa5,0xadafa5);grid.position.y=.002;grid.material.transparent=true;grid.material.opacity=.28;scene.add(grid);
  const contactCanvas=document.createElement('canvas');contactCanvas.width=128;contactCanvas.height=128;const cc=contactCanvas.getContext('2d');
  const cg=cc.createRadialGradient(64,64,9,64,64,64);cg.addColorStop(0,'rgba(32,40,34,0.24)');cg.addColorStop(.5,'rgba(32,40,34,0.12)');cg.addColorStop(1,'rgba(32,40,34,0)');cc.fillStyle=cg;cc.fillRect(0,0,128,128);
  const contact=new T.Mesh(new T.PlaneGeometry(2.9,2.9),new T.MeshBasicMaterial({map:new T.CanvasTexture(contactCanvas),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.008;scene.add(contact);
  const ring=new T.Mesh(new T.RingGeometry(3.10,3.114,160),new T.MeshBasicMaterial({color:0x98a7a0,transparent:true,opacity:.16,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.005;scene.add(ring);
  for(let i=0;i<4;i++){const mark=new T.Mesh(new T.BoxGeometry(.13,.006,.014),new T.MeshBasicMaterial({color:0xb5603c}));mark.position.set(3.11*Math.cos(i*Math.PI/2),.011,3.11*Math.sin(i*Math.PI/2));mark.rotation.y=-i*Math.PI/2;scene.add(mark);}
  const rig=createEggRobot();scene.add(rig.robot);const gait=createGroundedGait();let footTargets=null;
  const composer=createNeonComposer(renderer,scene,camera);
  const greenSpill=new T.PointLight(0x70ff00,.09,3.1,2);greenSpill.position.set(0,.32,0);scene.add(greenSpill);
  const state={deploy:1,target:1,phase:0,speed:.8,walk:false,demo:false,xray:false,travel:0,yaw:0,x:0,z:0,move:0,turn:0};
  const keys=new Set(),held=new Set();let last=performance.now(),demoTime=0,exporting=false,toastTimer;
  function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
  function toggle(el,on){$(el).classList.toggle('active',on);$(el).setAttribute('aria-pressed',String(on));}
  function updateUI(){
    $('transform').value=Math.round(state.target*100);$('transformValue').textContent=Math.round(state.deploy*100)+'%';
    toggle('btnClosed',state.target<.01);toggle('btnOpen',state.target>.99);toggle('btnWalk',state.walk);toggle('btnDemo',state.demo);toggle('btnXray',state.xray);
    $('btnWalk').querySelector('span').textContent=state.walk?'暂停行走':'自动行走';$('btnDemo').querySelector('span').textContent=state.demo?'暂停变形':'自动变形';
    $('modeLabel').textContent=state.deploy<.025?'蛋形 · 已收拢':state.deploy<.975?'变形中 · 关节展开':gait.getDiagnostics().recovering?'落稳 · 调整步态':state.travel>.05?'六足 · 交替行走':'六足 · 已展开';
    $('speedValue').textContent=state.speed.toFixed(1)+'×';
    $('contactLabel').textContent=state.deploy>.999?'支撑足 '+rig.diagnostics.support+' / 6':'足板折叠中';
  }
  function target(value){state.demo=false;state.target=T.MathUtils.clamp(value,0,1);if(value<.95)state.walk=false;updateUI();}
  $('btnClosed').onclick=()=>target(0);$('btnOpen').onclick=()=>target(1);
  $('transform').addEventListener('input',e=>target(Number(e.target.value)/100));
  $('btnWalk').onclick=()=>{state.walk=!state.walk;state.demo=false;if(state.walk)state.target=1;updateUI();};
  $('btnDemo').onclick=()=>{state.demo=!state.demo;state.walk=false;demoTime=state.deploy>.5?4:0;updateUI();};
  $('speed').addEventListener('input',e=>{state.speed=Number(e.target.value);updateUI();});
  $('btnXray').onclick=()=>{state.xray=!state.xray;rig.xray(state.xray);updateUI();};
  const savedOffset=new T.Vector3();
  function setView(kind){const p=kind==='front'?[0,2.4,9.4]:kind==='top'?[.01,10,.01]:[6.1,5.4,6.8];camera.position.set(p[0]+state.x,p[1],p[2]+state.z);controls.target.set(state.x,.70,state.z);controls.update();for(const [id,k] of [['btnViewFront','front'],['btnViewTop','top'],['btnViewIso','iso']])toggle(id,k===kind);}
  $('btnViewFront').onclick=()=>setView('front');$('btnViewTop').onclick=()=>setView('top');$('btnViewIso').onclick=()=>setView('iso');
  $('btnReset').onclick=()=>{Object.assign(state,{deploy:1,target:1,phase:0,walk:false,demo:false,xray:false,travel:0,yaw:0,x:0,z:0,move:0,turn:0});rig.xray(false);gait.reset();footTargets=null;keys.clear();held.clear();setView('iso');updateUI();toast('已恢复初始姿态');};
  for(const button of document.querySelectorAll('[data-move]')){
    const move=button.dataset.move;
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);held.add(move);button.classList.add('pressed');state.walk=false;state.demo=false;state.target=1;});
    const release=()=>{held.delete(move);button.classList.remove('pressed');};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  }
  const recognized=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];
  document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select')||e.ctrlKey||e.altKey||e.metaKey)return;if(!recognized.includes(e.code))return;e.preventDefault();
    if(e.code==='Space'){if(!e.repeat)target(state.target>.5?0:1);return;}
    keys.add(e.code);state.walk=false;state.demo=false;state.target=1;
  });
  document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();held.clear();document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));});
  function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  function render(){composer.render();}
  async function captureBrandedImage(){
    render();const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(renderer.domElement,0,0);
    const logo=document.querySelector('#sceneBrand svg');
    if(logo){const picture=new Image();picture.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(logo));await picture.decode();
      const stage=view.getBoundingClientRect(),r=logo.getBoundingClientRect(),scale=canvas.width/stage.width;ctx.drawImage(picture,(r.left-stage.left)*scale,(r.top-stage.top)*scale,r.width*scale,r.height*scale);}
    return canvas.toDataURL('image/png');
  }
  $('btnShot').onclick=async()=>{try{const a=document.createElement('a');a.download='科创-凡-荧光绿机器人.png';a.href=await captureBrandedImage();a.click();toast('已保存带 Logo 的霓虹机器人画面');}catch(e){console.error(e);toast('画面保存失败，请重试');}};
  async function exportModel(){
    if(exporting)return;exporting=true;$('btnExport').disabled=true;
    const saved={...state};
    try {
      rig.xray(false);rig.robot.position.set(0,0,0);rig.robot.rotation.set(0,0,0);
      const animations=rig.clips();rig.setPose(0);
      const exportRoot=new T.Group();exportRoot.name='Reference_320mm_Approximate';exportRoot.scale.setScalar(.1414);
      exportRoot.userData={scaleNote:'Assumed reference scale: closed diameter approximately 320 mm; not measured from photographs.',motion:'Kinematic articulation, not a validated dynamics model.'};exportRoot.add(rig.robot);
      let buffer;
      try{buffer=await new GLTFExporter().parseAsync(exportRoot,{binary:true,animations,onlyVisible:true,trs:true});}finally{scene.add(rig.robot);}
      return buffer;
    } finally {rig.xray(saved.xray);rig.robot.position.x=saved.x;rig.robot.position.z=saved.z;rig.robot.rotation.y=saved.yaw;rig.setPose(saved.deploy,saved.phase,saved.travel,saved.turn,saved.move,footTargets);exporting=false;$('btnExport').disabled=false;}
  }
  $('btnExport').onclick=async()=>{toast('正在生成带有变形和行走动画的模型…');try {const data=await exportModel();if(data){download(data,'蛋形变形机器人.glb','model/gltf-binary');toast('动画模型已导出，可导入 Blender');}}catch(e){console.error(e);toast('导出失败，请刷新后重试');}};
  function resize(){const r=view.getBoundingClientRect();camera.aspect=r.width/r.height;camera.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(18))*Math.max(1,1.15/camera.aspect)));camera.updateProjectionMatrix();renderer.setSize(r.width,r.height);composer.resize();}
  new ResizeObserver(resize).observe(view);resize();
  function frame(now){
    requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.04);last=now;if(exporting)return;
    if(state.demo){demoTime+=dt*state.speed;const u=demoTime%10;state.target=u<2?0:u<4?(u-2)/2:u<6?1:u<8?1-(u-6)/2:0;}
    state.deploy=T.MathUtils.damp(state.deploy,state.target,6,dt);if(Math.abs(state.deploy-state.target)<.0005)state.deploy=state.target;
    let forward=(keys.has('KeyW')||keys.has('ArrowUp')||held.has('forward')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')||held.has('back')?1:0);
    let turn=(keys.has('KeyA')||keys.has('ArrowLeft')||held.has('left')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')||held.has('right')?1:0);
    if(state.walk){forward=1;turn=.37;}
    const ready=state.deploy>.999?1:0;forward*=ready;turn*=ready;
    state.move=forward;state.turn=turn;state.travel=T.MathUtils.damp(state.travel,Math.max(Math.abs(forward),Math.abs(turn)),9,dt);
    state.phase+=dt*state.speed*Math.PI*(state.travel>.01?1:0);
    const ox=state.x,oz=state.z;
    const motionScale=gait.prepareMotion(state,dt);
    state.yaw+=turn*dt*state.speed*.10*motionScale;state.x-=Math.sin(state.yaw)*forward*dt*state.speed*.16*motionScale;state.z-=Math.cos(state.yaw)*forward*dt*state.speed*.16*motionScale;
    rig.robot.position.x=state.x;rig.robot.position.z=state.z;rig.robot.rotation.y=state.yaw;
    contact.position.x=state.x;contact.position.z=state.z;
    greenSpill.position.x=state.x;greenSpill.position.z=state.z;
    footTargets=gait.update(state,dt);rig.setPose(state.deploy,state.phase,state.travel,state.turn,state.move,footTargets);
    key.position.set(state.x-3.5,8,state.z+5);key.target.position.set(state.x,0,state.z);floor.position.x=state.x;floor.position.z=state.z;grid.position.x=Math.round(state.x/2.5)*2.5;grid.position.z=Math.round(state.z/2.5)*2.5;
    camera.position.x+=state.x-ox;camera.position.z+=state.z-oz;controls.target.x+=state.x-ox;controls.target.z+=state.z-oz;
    controls.update();render();updateUI();
  }
  // Small inspection API also supports delivering a verified GLB alongside this offline viewer.
  window.eggDemo={state,rig,gait,scene,camera,renderer,setView,exportModel,captureBrandedImage,setPose(v){state.deploy=v;state.target=v;state.walk=false;state.demo=false;state.travel=0;state.move=0;state.turn=0;gait.reset();footTargets=null;rig.setPose(v);updateUI();render();},ready:true};
  $('busy').style.display='none';updateUI();requestAnimationFrame(frame);
})();
