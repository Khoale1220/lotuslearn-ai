import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import * as THREE from "three";
import { fileURLToPath } from "node:url";
import { getExteriorDepthConfig } from "./classroomExteriorDepthV2.js";
import {
  CLASSROOM_EXTERIOR_DEPTH_ART_V38_PROFILE,
  classifyExteriorLayerV38,
  createClassroomExteriorDepthArtV38,
  createExteriorDepthTextureV38,
  discoverExteriorDepthLayersV38
} from "./classroomExteriorDepthArtV38.js";

const DIR=path.dirname(fileURLToPath(import.meta.url));
const source=(name)=>readFileSync(path.join(DIR,name),"utf8");
const close=(a,b,e=1e-9)=>Math.abs(a-b)<=e;

function fixture() {
  const scene=new THREE.Scene();
  const defs=[
    {name:"base",parallax:.012,renderOrder:2},
    {name:"mountains",parallax:.026,renderOrder:3},
    {name:"campus",parallax:.044,renderOrder:4},
    {name:"foliage",parallax:.078,renderOrder:5}
  ];
  const materials=defs.map(layer=>{
    const originalMap=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);
    originalMap.needsUpdate=true;
    const material=new THREE.MeshBasicMaterial({
      map:originalMap, transparent:true, opacity:.82, alphaTest:.12,
      depthTest:true, depthWrite:false, toneMapped:true
    });
    return {layer,material,originalMap};
  });
  const geometry=new THREE.PlaneGeometry(2.38,1.58), meshes=[];
  for (const windowName of ["window-north","window-center","window-south"]) {
    const group=new THREE.Group(); group.name=windowName; scene.add(group);
    for (const {layer,material} of materials) {
      const mesh=new THREE.Mesh(geometry,material);
      mesh.name=`${windowName}-depth-${layer.name}`;
      mesh.renderOrder=layer.renderOrder;
      mesh.userData.parallax=layer.parallax;
      mesh.raycast=function legacyExteriorDepthRaycast(){};
      group.add(mesh); meshes.push(mesh);
    }
  }
  return {scene,materials,geometry,meshes};
}

function cleanup(f) {
  f.geometry.dispose();
  for (const e of f.materials) { e.material.dispose(); e.originalMap.dispose(); }
}

test("V38 keeps canonical ExteriorDepthV2 config",()=>{
  const c=getExteriorDepthConfig();
  assert.ok(close(c.width,2.38));
  assert.ok(close(c.height,1.58));
  assert.ok(Array.isArray(c.layers) && c.layers.length>=3);
  assert.equal(c.layers.every(l=>typeof l.name==="string"&&Number.isFinite(l.z)&&Number.isFinite(l.parallax)),true);
});

test("V38 adds no second runtime authority",()=>{
  const p=CLASSROOM_EXTERIOR_DEPTH_ART_V38_PROFILE;
  assert.equal(p.existingParallaxAuthority,"classroomExteriorDepthV2");
  assert.equal(p.addedMeshes,0);
  assert.equal(p.addedGeometries,0);
  assert.equal(p.addedMaterials,0);
  assert.equal(p.addedDrawCalls,0);
  assert.equal(p.addedLights,0);
  assert.equal(p.addedShadowMaps,0);
  assert.equal(p.runtimeSceneTraversal,false);
  assert.equal(p.runtimeTickRequired,false);
  assert.equal(p.runtimeTexturePainting,false);
});

test("V38 classifies exterior vocabulary",()=>{
  assert.equal(classifyExteriorLayerV38({layerName:"base",rank:0,count:4}),"far");
  assert.equal(classifyExteriorLayerV38({layerName:"mountains",rank:1,count:4}),"mountain");
  assert.equal(classifyExteriorLayerV38({layerName:"campus",rank:2,count:4}),"campus");
  assert.equal(classifyExteriorLayerV38({layerName:"foliage",rank:3,count:4}),"near");
});

test("V38 textures use VGA sampling policy",()=>{
  for (const role of ["far","mountain","campus","near"]) {
    const t=createExteriorDepthTextureV38({layerName:role,role});
    assert.equal(t.isDataTexture,true);
    assert.equal(t.image.width,256); assert.equal(t.image.height,128);
    assert.equal(t.magFilter,THREE.NearestFilter); assert.equal(t.minFilter,THREE.NearestFilter);
    assert.equal(t.generateMipmaps,false); assert.equal(t.colorSpace,THREE.SRGBColorSpace); assert.equal(t.flipY,true);
    let visible=0, transparent=0;
    for (let i=3;i<t.image.data.length;i+=4) t.image.data[i]===0?transparent++:visible++;
    assert.ok(visible>0); assert.ok(transparent>0); t.dispose();
  }
});

test("V38 discovers existing depth meshes",()=>{
  const f=fixture(), d=discoverExteriorDepthLayersV38(f.scene);
  assert.equal(d.meshes.length,12); assert.equal(d.layers.length,4);
  assert.deepEqual(d.windowNames,["window-center","window-north","window-south"]);
  cleanup(f);
});

test("V38 upgrades maps and restores originals",()=>{
  const f=fixture();
  const originalMaps=f.materials.map(x=>x.material.map);
  const originalRaycast=f.meshes.map(x=>x.raycast);
  const originalParallax=f.meshes.map(x=>x.userData.parallax);
  const originalRenderOrder=f.meshes.map(x=>x.renderOrder);
  const r=createClassroomExteriorDepthArtV38({scene:f.scene});
  const s=r.getSnapshot();
  assert.equal(s.depthMeshCount,12); assert.equal(s.windowCount,3); assert.equal(s.uniqueLayerMaterialCount,4);
  assert.equal(s.upgradedTextureCount,4); assert.equal(s.parallaxAuthorityPreserved,true);
  assert.equal(s.presentationAuthorityPreserved,true); assert.equal(s.nearestFiltering,true);
  assert.equal(s.mipmapsDisabled,true); assert.equal(s.srgbColorSpace,true);
  assert.equal(s.hardAlphaCutout,true); assert.equal(s.toneMappingExcluded,true);
  assert.equal(s.addedMeshes,0); assert.equal(s.addedGeometries,0); assert.equal(s.addedMaterials,0); assert.equal(s.addedDrawCalls,0);
  f.meshes.forEach((m,i)=>{ assert.equal(m.raycast,originalRaycast[i]); assert.equal(m.userData.parallax,originalParallax[i]); assert.equal(m.renderOrder,originalRenderOrder[i]); });
  f.materials.forEach((e,i)=>{ assert.notEqual(e.material.map,originalMaps[i]); assert.equal(e.material.map.isDataTexture,true); assert.ok(e.material.alphaTest>=.5); });
  r.dispose();
  f.materials.forEach((e,i)=>{ assert.equal(e.material.map,originalMaps[i]); assert.equal(e.material.alphaTest,.12); assert.equal(e.material.toneMapped,true); });
  cleanup(f);
});

test("V38 has one construction traversal and no duplicate engine",()=>{
  const s=source("classroomExteriorDepthArtV38.js");
  assert.equal((s.match(/scene\.traverse\s*\(/gu)??[]).length,1);
  assert.equal((s.match(/new THREE\.DataTexture\s*\(/gu)??[]).length,1);
  const forbidden=[
    /new THREE\.Mesh\s*\(/gu,/new THREE\.Sprite\s*\(/gu,/new THREE\.InstancedMesh\s*\(/gu,
    /new THREE\..*Geometry\s*\(/gu,/new THREE\..*Material\s*\(/gu,/new THREE\..*Light\s*\(/gu,
    /new THREE\.Raycaster\s*\(/gu,/requestAnimationFrame/gu,/setInterval/gu,/setTimeout/gu,/Math\.random/gu,
    /emitTeacherInterventionCommand/gu,/stepPlayerLocomotion/gu,/resolvePlayerCollision/gu
  ];
  for (const re of forbidden) assert.equal(re.test(s),false);
});

test("V38 leaves ExteriorDepthV2 as sole runtime parallax authority",()=>{
  const world=source("ClassroomWorld.jsx"), v2=source("classroomExteriorDepthV2.js");
  assert.equal(world.split("classroomExteriorDepthV2.update(camera);").length-1,1);
  assert.equal(world.includes("classroomExteriorDepthArtV38.tick("),false);
  assert.equal(world.includes("classroomExteriorDepthArtV38.update("),false);
  assert.equal(v2.includes(".parallax"),true);
  assert.equal(v2.includes("function update("),true);
  assert.equal(v2.includes("mesh.raycast"),true);
});

test("V38 world lifecycle is construction-only",()=>{
  const world=source("ClassroomWorld.jsx");
  assert.equal(world.split("createClassroomExteriorDepthArtV38({").length-1,1);
  assert.equal(world.split("classroomExteriorDepthArtV38.dispose();").length-1,1);
  const a=world.indexOf("classroomExteriorDepthArtV38.dispose();");
  const b=world.indexOf("classroomCharacterDepthOcclusionPolishV37.dispose();");
  assert.ok(a>=0 && b>=0 && a<b);
  assert.equal(world.split(".intersectObjects(interactiveMeshes, false)").length-1,1);
});
