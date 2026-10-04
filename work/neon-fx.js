(function(){
  'use strict';
  window.createNeonComposer=function(renderer,scene,camera){
    const T=THREE,options={type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true};
    const base=new T.WebGLRenderTarget(1,1,options),glow=new T.WebGLRenderTarget(1,1,options),ping=new T.WebGLRenderTarget(1,1,options),pong=new T.WebGLRenderTarget(1,1,options);
    base.samples=Math.min(4,renderer.capabilities.maxSamples||0);
    const quadScene=new T.Scene(),quadCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
    const vertex='varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
    const blur=new T.ShaderMaterial({toneMapped:false,depthTest:false,depthWrite:false,uniforms:{source:{value:null},stepSize:{value:new T.Vector2()}},vertexShader:vertex,fragmentShader:`
      uniform sampler2D source;uniform vec2 stepSize;varying vec2 vUv;
      void main(){vec3 col=texture2D(source,vUv).rgb*.227027;
      col+=(texture2D(source,vUv+stepSize*1.384615).rgb+texture2D(source,vUv-stepSize*1.384615).rgb)*.316216;
      col+=(texture2D(source,vUv+stepSize*3.230769).rgb+texture2D(source,vUv-stepSize*3.230769).rgb)*.070270;
      gl_FragColor=vec4(col,1.);}`});
    const composite=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:true,uniforms:{baseMap:{value:base.texture},glowMap:{value:pong.texture}},vertexShader:vertex,fragmentShader:`
      uniform sampler2D baseMap;uniform sampler2D glowMap;varying vec2 vUv;
      void main(){vec3 color=texture2D(baseMap,vUv).rgb+texture2D(glowMap,vUv).rgb*.78;
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
    const quad=new T.Mesh(new T.PlaneGeometry(2,2),blur);quadScene.add(quad);
    const black=new T.MeshBasicMaterial({color:0x000000,side:T.DoubleSide}),blackLine=new T.LineBasicMaterial({color:0x000000});
    let width=1,height=1;
    function resize(){const s=renderer.getDrawingBufferSize(new T.Vector2());base.setSize(s.x,s.y);width=Math.max(1,Math.round(s.x/2));height=Math.max(1,Math.round(s.y/2));for(const t of [glow,ping,pong])t.setSize(width,height);}
    function pass(input,target,x,y){quad.material=blur;blur.uniforms.source.value=input.texture;blur.uniforms.stepSize.value.set(x/width,y/height);renderer.setRenderTarget(target);renderer.render(quadScene,quadCamera);}
    function render(){
      renderer.setRenderTarget(base);renderer.render(scene,camera);
      const background=scene.background,fog=scene.fog,shadow=renderer.shadowMap.enabled,swapped=[];
      scene.background=new T.Color(0);scene.fog=null;renderer.shadowMap.enabled=false;
      scene.traverse(o=>{if(o.material&&!o.userData.energyLight){swapped.push([o,o.material]);o.material=o.isLine?blackLine:black;}});
      try{renderer.setRenderTarget(glow);renderer.render(scene,camera);}finally{for(const [o,m]of swapped)o.material=m;scene.background=background;scene.fog=fog;renderer.shadowMap.enabled=shadow;}
      pass(glow,ping,1.35,0);pass(ping,pong,0,1.35);pass(pong,ping,1.35,0);pass(ping,pong,0,1.35);
      quad.material=composite;renderer.setRenderTarget(null);renderer.render(quadScene,quadCamera);
    }
    return {render,resize};
  };
})();
