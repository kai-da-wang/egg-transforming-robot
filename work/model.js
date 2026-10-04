(function () {
  'use strict';
  const T = THREE, PI = Math.PI;
  const smooth = v => v * v * (3 - 2 * v);
  window.createEggRobot = function () {
    const robot = new T.Group(); robot.name = 'EggRobot';
    robot.userData = {description:'Photo-inspired six-legged transforming egg robot. Concept kinematics; not a fabrication plan.',units:'Concept units, no measured physical scale'};
    const materials = {
      shell: new T.MeshStandardMaterial({color:0xf0efe8, metalness:.07, roughness:.38, side:T.DoubleSide}),
      dark: new T.MeshStandardMaterial({color:0x202a2d, metalness:.64, roughness:.39}),
      rubber: new T.MeshStandardMaterial({color:0x161b1d, metalness:.1, roughness:.76}),
      alloy: new T.MeshStandardMaterial({color:0x909b9e, metalness:.82, roughness:.28}),
      screw: new T.MeshStandardMaterial({color:0x4c5759, metalness:.78, roughness:.35}),
      copper: new T.MeshStandardMaterial({color:0xbe653d, metalness:.6, roughness:.32}),
      lightHousing: new T.MeshStandardMaterial({color:0x173022,metalness:.52,roughness:.38}),
      neon: new T.MeshStandardMaterial({color:0x051500,emissive:0x39ff00,emissiveIntensity:3.2,metalness:.08,roughness:.25})
    };
    const footMeshes=[], shellMeshes=[], limbs=[], animated=[robot];
    function mesh(g,m,parent,name) { const o=new T.Mesh(g,m); o.name=name||'Part'; o.castShadow=true; o.receiveShadow=true; parent.add(o); return o; }
    function box(parent,size,pos,mat,name) { const o=mesh(new T.BoxGeometry(...size),mat,parent,name); o.position.set(...pos); return o; }
    function cylinder(parent,r,h,pos,mat,name) { const o=mesh(new T.CylinderGeometry(r,r,h,28),mat,parent,name); o.position.set(...pos); return o; }
    function point(theta,phi,inner=0) {
      const r=1.12*Math.sin(theta)*(1-.14*Math.cos(theta));
      return new T.Vector3((r-inner)*Math.cos(phi),(1.33-inner)*Math.cos(theta),(r-inner)*Math.sin(phi));
    }
    // Surface-mounted light channels stay with each individual articulated panel.
    function surfacePoint(theta,phi,anchor,offset) {
      const n=new T.Vector3(Math.sin(theta)*Math.cos(phi),Math.cos(theta)/1.2,Math.sin(theta)*Math.sin(phi)).normalize();
      return point(theta,phi).sub(anchor).addScaledVector(n,offset);
    }
    function circuit(parent,route,anchor,name,closed=false) {
      const routePoints=closed?[...route,route[0]]:route;
      const makePath=offset=>{
        const samples=[];
        for(let i=0;i<routePoints.length-1;i++){
          const a=routePoints[i],b=routePoints[i+1],steps=Math.max(3,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*38));
          for(let j=0;j<steps;j++){const f=j/steps;samples.push(surfacePoint(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,anchor,offset));}
        }
        const end=routePoints.at(-1);samples.push(surfacePoint(end[0],end[1],anchor,offset));
        return new T.CatmullRomCurve3(samples,false,'centripetal');
      };
      const length=routePoints.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-routePoints[i][0],p[1]-routePoints[i][1]),0),steps=Math.max(20,Math.ceil(length*45));
      mesh(new T.TubeGeometry(makePath(.017),steps,.019,6,false),materials.lightHousing,parent,name+'_recess');
      const light=mesh(new T.TubeGeometry(makePath(.043),steps,.013,10,false),materials.neon,parent,name+'_emitter');
      light.userData.energyLight=true;light.castShadow=false;light.receiveShadow=false;
      if(!closed)for(const [index,tp] of [route[0],route.at(-1)].entries()){
        const node=mesh(new T.SphereGeometry(.019,12,8),materials.neon,parent,name+'_terminal_'+index);node.position.copy(surfacePoint(tp[0],tp[1],anchor,.043));node.userData.energyLight=true;node.castShadow=false;
      }
    }
    // A shell is a solid curved panel, including its inner surface and edge walls.
    function panel(start,end,anchor) {
      const rows=30, cols=18, pos=[], ind=[], half=PI/6-.016;
      for(let side=0;side<2;side++) for(let y=0;y<=rows;y++) for(let x=0;x<=cols;x++) {
        const t=start+(end-start)*y/rows, a=-half+2*half*x/cols;
        const p=point(t,a,side*.026).sub(anchor); pos.push(p.x,p.y,p.z);
      }
      const n=(rows+1)*(cols+1), stride=cols+1;
      for(let side=0;side<2;side++) for(let y=0;y<rows;y++) for(let x=0;x<cols;x++) {
        const a=side*n+y*stride+x,b=a+1,c=a+stride,d=c+1;
        if(!side)ind.push(a,b,c,b,d,c);else ind.push(a,c,b,b,c,d);
      }
      const edge=[];
      for(let x=0;x<=cols;x++)edge.push(x);
      for(let y=1;y<=rows;y++)edge.push(y*stride+cols);
      for(let x=cols-1;x>=0;x--)edge.push(rows*stride+x);
      for(let y=rows-1;y>0;y--)edge.push(y*stride);
      for(let i=0;i<edge.length;i++) {const a=edge[i],b=edge[(i+1)%edge.length];ind.push(a,a+n,b,b,a+n,b+n);}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(ind);g.computeVertexNormals();return g;
    }
    function fasteners(parent,theta,anchor) {
      for(const dx of [-.028,.028])for(const dz of [-.028,.028]) {
        const p=point(theta+dx,dz).sub(anchor);
        const screw=mesh(new T.CylinderGeometry(.013,.013,.009,10),materials.screw,parent,'Panel_fastener');
        screw.position.copy(p);
        const n=new T.Vector3(Math.sin(theta),Math.cos(theta)/1.2,0).normalize();
        screw.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),n);screw.position.addScaledVector(n,.008);
      }
    }
    function hinge(parent,name) {
      const joint=cylinder(parent,.105,.25,[0,0,0],materials.dark,name);joint.rotation.x=PI/2;
      for(const z of [-.135,.135]){const cap=cylinder(parent,.074,.025,[0,0,z],materials.alloy,name+'_cap');cap.rotation.x=PI/2;
        const bolt=cylinder(parent,.028,.028,[0,0,z*1.13],materials.screw,name+'_axle');bolt.rotation.x=PI/2;}
    }
    function link(parent,L,name) {
      box(parent,[L-.08,.115,.12],[L/2,0,0],materials.dark,name+'_servo');
      for(const z of [-.10,.10])box(parent,[L,.055,.028],[L/2,0,z],materials.alloy,name+'_bracket');
      box(parent,[.12,.118,.126],[L*.57,.006,0],materials.rubber,name+'_drive');
    }
    const core=new T.Group();core.name='Internal_chassis';robot.add(core);
    cylinder(core,.69,.19,[0,-.36,0],materials.dark,'Lower_chassis');
    cylinder(core,.58,.13,[0,.26,0],materials.dark,'Upper_chassis');
    cylinder(core,.38,.66,[0,-.04,0],materials.rubber,'Power_unit');
    cylinder(core,.31,.025,[0,.34,0],materials.alloy,'Electronics_deck');
    box(core,[.24,.06,.19],[0,.40,0],materials.dark,'Controller');
    const frameRing=mesh(new T.TorusGeometry(.73,.035,10,64),materials.alloy,core,'Hip_mounting_ring');frameRing.rotation.x=PI/2;frameRing.position.y=-.365;
    for(let i=0;i<6;i++){
      const a=i*PI/3;
      cylinder(core,.028,.65,[.54*Math.cos(a),-.03,.54*Math.sin(a)],materials.alloy,'Chassis_post_'+i);
      const mountAngle=(i+.5)*PI/3,mount=box(core,[.23,.055,.15],[.64*Math.cos(mountAngle),-.365,.64*Math.sin(mountAngle)],materials.alloy,'Hip_mounting_bracket_'+i);mount.rotation.y=-mountAngle;
    }
    const crown=cylinder(core,.169,.085,[0,1.267,0],materials.dark,'Crown_inner_ring');
    const cap=mesh(new T.TorusGeometry(.168,.014,8,40),materials.alloy,core,'Crown_rim');cap.rotation.x=PI/2;cap.position.y=1.30;
    const crownLight=mesh(new T.TorusGeometry(.184,.011,10,64),materials.neon,core,'Crown_energy_ring');crownLight.rotation.x=PI/2;crownLight.position.y=1.305;crownLight.userData.energyLight=true;crownLight.castShadow=false;
    const upperAnchor=new T.Vector3();
    const lowerAnchor=new T.Vector3(.95,-.53,0);
    const upperGeo=panel(.17,1.96,upperAnchor), lowerGeo=panel(1.985,3.045,lowerAnchor);
    const L1=.46,L2=.54,hipX=.71,hipY=-.365;
    for(let i=0;i<6;i++) {
      const angle=(i+.5)*PI/3;
      const upper=new T.Group();upper.name='Upper_panel_'+(i+1);upper.rotation.y=-angle;robot.add(upper);
      const skin=mesh(upperGeo,materials.shell,upper,'Dome_shell_'+(i+1));shellMeshes.push(skin);
      fasteners(upper,.59,upperAnchor);fasteners(upper,1.70,upperAnchor);
      circuit(upper,[[.34,-.40],[1.25,-.40],[1.40,-.32],[1.80,-.32],[1.85,-.25],[1.85,.25],[1.80,.32],[1.40,.32],[1.25,.40],[.34,.40]],upperAnchor,'Dome_energy_loop_'+i,true);
      circuit(upper,[[.79,-.18],[1.03,-.18],[1.14,-.06],[1.39,-.06],[1.48,.10],[1.60,.10]],upperAnchor,'Dome_circuit_trace_'+i);
      const leg=new T.Group();leg.name='Leg_'+(i+1)+'_yaw';leg.position.set(hipX*Math.cos(angle),hipY,hipX*Math.sin(angle));robot.add(leg);animated.push(leg);
      const hip=new T.Group();hip.name='Leg_'+(i+1)+'_hip';leg.add(hip);animated.push(hip);
      hinge(hip,'Hip_hinge_'+i);link(hip,L1,'Thigh_'+i);
      const knee=new T.Group();knee.name='Leg_'+(i+1)+'_knee';knee.position.x=L1;hip.add(knee);animated.push(knee);
      hinge(knee,'Knee_hinge_'+i);link(knee,L2,'Shin_'+i);
      const ankle=new T.Group();ankle.name='Leg_'+(i+1)+'_foot';ankle.position.x=L2;knee.add(ankle);animated.push(ankle);
      hinge(ankle,'Ankle_hinge_'+i);
      const foot=mesh(lowerGeo,materials.shell,ankle,'Foot_shell_'+(i+1));footMeshes.push(foot);shellMeshes.push(foot);
      fasteners(ankle,2.30,lowerAnchor);fasteners(ankle,2.80,lowerAnchor);
      circuit(ankle,[[2.13,-.34],[2.50,-.34],[2.66,-.17],[2.66,.17],[2.50,.34],[2.13,.34]],lowerAnchor,'Foot_energy_loop_'+i,true);
      circuit(ankle,[[2.20,.10],[2.37,.10],[2.45,-.06],[2.56,-.06]],lowerAnchor,'Foot_circuit_trace_'+i);
      limbs.push({angle,leg,hip,knee,ankle,lift:0});
    }
    const v=new T.Vector3(), inv=new T.Matrix4(),qY=new T.Quaternion(),qZ=new T.Quaternion(),parentQ=new T.Quaternion(),axisY=new T.Vector3(0,1,0),axisZ=new T.Vector3(0,0,1);
    const diagnostics={reachLimited:0,maxReach:0,support:6};
    function setPose(deploy,phase=0,walk=0,turn=0,move=1,targets=null) {
      const t=T.MathUtils.clamp(deploy,0,1), g=smooth(t), stride=walk*g;
      diagnostics.reachLimited=0;diagnostics.maxReach=0;diagnostics.support=0;
      for(let i=0;i<6;i++) {
        const l=limbs[i], cycle=((phase/(2*PI)+(i%2)*.5)%1+1)%1,duty=.65;
        const stance=cycle<duty,u=stance?cycle/duty:(cycle-duty)/(1-duty);
        const edgeVelocity=(1-duty)/duty;
        // Match foot velocity at lift-off and touchdown in the exported forward walk.
        const swing=stance?u-.5:.5+edgeVelocity*u-(3+3*edgeVelocity)*u*u+(2+2*edgeVelocity)*u*u*u;
        let lift=(stance?0:Math.pow(Math.sin(PI*u),2))*.12*stride;
        const radius=.95+.53*g;
        let x=radius*Math.cos(l.angle),z=radius*Math.sin(l.angle);
        z+=.208*swing*stride*move;
        x+=Math.sin(l.angle)*.18*swing*turn*stride;
        z-=Math.cos(l.angle)*.18*swing*turn*stride;
        let footYaw=-l.angle;
        if(targets){x=targets[i].x;z=targets[i].z;lift=targets[i].lift;footYaw=targets[i].yaw;}
        const rx=x-l.leg.position.x,rz=z-l.leg.position.z;
        l.leg.rotation.y=-Math.atan2(rz,rx);
        const dx=Math.hypot(rx,rz),dy=-.53+.065*g+lift-hipY;
        const d2=dx*dx+dy*dy;
        diagnostics.maxReach=Math.max(diagnostics.maxReach,Math.sqrt(d2));if(Math.sqrt(d2)>L1+L2+.00001)diagnostics.reachLimited++;
        const kneeAngle=Math.acos(T.MathUtils.clamp((d2-L1*L1-L2*L2)/(2*L1*L2),-1,1));
        const hipAngle=Math.atan2(dy,dx)-Math.atan2(L2*Math.sin(kneeAngle),L1+L2*Math.cos(kneeAngle));
        l.hip.rotation.z=hipAngle;l.knee.rotation.z=kneeAngle;
        // A swivel ankle keeps a planted curved foot's heading fixed in world space.
        parentQ.setFromAxisAngle(axisY,l.leg.rotation.y).multiply(qZ.setFromAxisAngle(axisZ,hipAngle+kneeAngle));
        l.ankle.quaternion.copy(parentQ).invert().multiply(qY.setFromAxisAngle(axisY,footYaw)).multiply(qZ.setFromAxisAngle(axisZ,2.15*g));
        l.lift=lift;if(lift<.001)diagnostics.support++;
      }
      // Constant support height comes from the neutral plate, never the swinging feet.
      let low=Infinity;
      const pos=lowerGeo.attributes.position,c=Math.cos(2.15*g),s=Math.sin(2.15*g);
      for(let i=0;i<pos.count;i++)low=Math.min(low,pos.getX(i)*s+pos.getY(i)*c);
      robot.position.y=-low-(-.53+.065*g)+.006;
      robot.updateMatrixWorld(true);
    }
    function xray(on) { materials.shell.transparent=on; materials.shell.opacity=on?.16:1; materials.shell.depthWrite=!on; materials.shell.needsUpdate=true; }
    function makeClip(name,duration,samples,sampler) {
      const data=animated.map(o=>({o,p:[],q:[]})),times=[];
      for(let i=0;i<=samples;i++) {const time=duration*i/samples;times.push(time);const args=sampler(time/duration);setPose(...args);
        for(const d of data){d.o.position.toArray(d.p,d.p.length);d.o.quaternion.toArray(d.q,d.q.length);}}
      const tracks=[];
      for(const d of data) {tracks.push(new T.VectorKeyframeTrack(d.o.name+'.position',times,d.p));tracks.push(new T.QuaternionKeyframeTrack(d.o.name+'.quaternion',times,d.q));}
      return new T.AnimationClip(name,duration,tracks);
    }
    function clips() {
      const savedPos=robot.position.clone(),savedRot=robot.quaternion.clone();robot.position.set(0,0,0);robot.rotation.set(0,0,0);
      const transform=makeClip('Transform_Open_Close',8,120,u=>{
        const t=u<.125?0:u<.425?smooth((u-.125)/.3):u<.575?1:u<.875?1-smooth((u-.575)/.3):0;return [t,0,0,0];});
      const walk=makeClip('Walk_In_Place',2,60,u=>[1,u*PI*2,1,0]);
      const turn=makeClip('Turn_Gait',2,60,u=>[1,u*PI*2,1,1,0]);
      const forward=makeClip('Walk_Forward',4,120,u=>{robot.position.z=-.16*4*u;return [1,u*PI*4,1,0,1];});
      robot.position.copy(savedPos);robot.quaternion.copy(savedRot);
      return [transform,walk,turn,forward];
    }
    setPose(1);
    return {robot,materials,setPose,xray,clips,limbs,shellMeshes,animated,diagnostics};
  };
})();
