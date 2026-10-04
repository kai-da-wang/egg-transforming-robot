const fs=require('fs');
const path=require('path');
function wrap(name,exports){
  let s=fs.readFileSync(path.join(__dirname,name+'.js'),'utf8');
  s=s.replace(/import\s*\{([\s\S]*?)\}\s*from\s*'three';/g,'const {$1} = THREE;');
  s=s.replace(/import\s*\{\s*decompress\s*\}\s*from[^;]+;/g,'const {decompress}=TextureUtils;');
  s=s.replace(/export\s*\{[^}]+\};?/g,'').replace(/export function /g,'function ');
  return '(function(){\n'+s+'\n'+exports.map(n=>'window.'+n+'='+n+';').join('\n')+'\n})();';
}
const scripts=[fs.readFileSync(path.join(__dirname,'three.min.js'),'utf8'),wrap('OrbitControls',['OrbitControls']),wrap('TextureUtils',['decompress']).replace('window.decompress=decompress','window.TextureUtils={decompress}'),wrap('GLTFExporter',['GLTFExporter']),fs.readFileSync(path.join(__dirname,'model.js'),'utf8'),fs.readFileSync(path.join(__dirname,'gait.js'),'utf8'),fs.readFileSync(path.join(__dirname,'neon-fx.js'),'utf8'),fs.readFileSync(path.join(__dirname,'app.js'),'utf8')];
let html=fs.readFileSync(path.join(__dirname,'ui.html'),'utf8').replace('<!-- STYLE -->','<style>'+fs.readFileSync(path.join(__dirname,'ui.css'),'utf8')+'</style>').replace('<!-- SCRIPTS -->',()=>scripts.map(s=>'<script>\n'+s.replace(/<\/script/gi,'<\\/script')+'\n</script>').join('\n'));
html=html.replace('<html lang="zh-CN">','<!-- Three.js and bundled addon modules: '+fs.readFileSync(path.join(__dirname,'LICENSE'),'utf8')+' -->\n<html lang="zh-CN">');
const out=path.join(__dirname,'../outputs/蛋形机器人-交互演示.html');fs.writeFileSync(out,html);
console.log('Offline viewer built:',fs.statSync(out).size,'bytes');
