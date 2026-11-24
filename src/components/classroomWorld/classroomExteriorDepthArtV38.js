import * as THREE from "three";

const PROFILE = Object.freeze({
  id: "cw06-exterior-depth-art-v38",
  textureWidth: 256,
  textureHeight: 128,
  minimumAlphaTest: 0.5,
  existingParallaxAuthority: "classroomExteriorDepthV2",
  addedMeshes: 0,
  addedGeometries: 0,
  addedMaterials: 0,
  addedLights: 0,
  addedDrawCalls: 0,
  addedShadowMaps: 0,
  constructionSceneTraversalCount: 1,
  runtimeSceneTraversal: false,
  runtimeTickRequired: false,
  runtimeTexturePainting: false
});

const P = Object.freeze({
  ink: [20,18,31,255],
  plumDeep: [44,28,55,255],
  plum: [78,45,76,255],
  cyanDeep: [37,91,118,255],
  cyan: [61,151,176,255],
  cyanLight: [143,205,211,255],
  cream: [239,216,177,255],
  orange: [230,131,65,255],
  orangeLight: [251,185,99,255]
});

const DEPTH_MESH_RE = /^window-(north|center|south)-depth-(.+)$/u;

function hash32(value) {
  let h = 2166136261;
  for (const ch of String(value ?? "")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function px(data,w,h,x,y,c) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const i = (y*w+x)*4;
  data[i]=c[0]; data[i+1]=c[1]; data[i+2]=c[2]; data[i+3]=c[3];
}

function rect(data,w,h,x,y,rw,rh,c) {
  const x0=Math.max(0,Math.floor(x)), y0=Math.max(0,Math.floor(y));
  const x1=Math.min(w,Math.ceil(x+rw)), y1=Math.min(h,Math.ceil(y+rh));
  for (let yy=y0; yy<y1; yy++) for (let xx=x0; xx<x1; xx++) px(data,w,h,xx,yy,c);
}

function diamond(data,w,h,cx,cy,r,c) {
  for (let dy=-r; dy<=r; dy++) {
    const s=r-Math.abs(dy);
    rect(data,w,h,cx-s,cy+dy,s*2+1,1,c);
  }
}

function drawFar(data,w,h,seed) {
  const sx=194+(seed%13);
  diamond(data,w,h,sx,30,10,P.orangeLight);
  diamond(data,w,h,sx,30,6,P.cream);
  const clouds=[[8,14,46,7],[39,9,30,6],[82,22,54,8],[145,12,43,7],[201,19,49,7]];
  clouds.forEach(([x,y,cw,ch],i)=>{
    rect(data,w,h,x,y,cw,ch,i%2?P.cyanLight:P.cream);
    rect(data,w,h,x+7,y-3,Math.max(8,Math.floor(cw*.44)),3,P.cyanLight);
  });
  for (let x=0;x<w;x+=4){
    const ridge=7+(((x*17+seed)%13));
    rect(data,w,h,x,80-ridge,5,ridge,P.plum);
  }
  rect(data,w,h,0,80,w,3,P.plumDeep);
  for (let x=4;x<w;x+=17) {
    rect(data,w,h,x,85+((x+seed)%4),6+((x+seed)%5),1,x%34===4?P.orange:P.cyan);
  }
}

function drawMountains(data,w,h,seed) {
  for (let x=0;x<w;x+=2){
    const ridge=21+Math.floor(12*Math.abs(Math.sin((x+(seed%29))*.045)));
    rect(data,w,h,x,88-ridge,3,ridge,P.plumDeep);
    if (x%8===0) rect(data,w,h,x,88-ridge,3,Math.max(2,Math.floor(ridge*.18)),P.cyanDeep);
  }
  rect(data,w,h,0,88,w,3,P.ink);
  for (let x=9;x<w;x+=29) rect(data,w,h,x,92+((x+seed)%5),12,2,P.cyan);
}

function drawCampus(data,w,h,seed) {
  const buildings=[[8,64,42,38],[57,55,54,47],[121,67,38,35],[168,58,49,44],[222,70,30,32]];
  buildings.forEach(([x,y,bw,bh],bi)=>{
    rect(data,w,h,x-3,y-5,bw+6,5,P.ink);
    rect(data,w,h,x,y,bw,bh,bi%2?P.plumDeep:P.plum);
    rect(data,w,h,x+2,y+2,Math.max(2,bw-4),2,P.cyanDeep);
    for (let wx=x+6;wx<x+bw-4;wx+=10) for (let wy=y+10;wy<y+bh-4;wy+=10) {
      rect(data,w,h,wx,wy,4,4,(wx+wy+bi+seed)%4===0?P.orange:P.cyan);
    }
  });
  rect(data,w,h,0,104,w,5,P.ink);
  for (let x=2;x<w;x+=15) rect(data,w,h,x,106,7,2,P.cyanDeep);
}

function drawNear(data,w,h,seed) {
  const clusters=[[0,18,33,18],[7,38,43,20],[0,64,29,20],[216,19,40,19],[226,43,30,22],[207,70,49,20]];
  clusters.forEach(([x,y,cw,ch],i)=>{
    rect(data,w,h,x,y,cw,ch,i%2?P.plumDeep:P.ink);
    rect(data,w,h,x+4,y+3,Math.max(5,Math.floor(cw*.34)),3,P.cyanDeep);
  });
  rect(data,w,h,0,109,w,5,P.ink);
  rect(data,w,h,0,114,w,2,P.orange);
  for (let x=5+(seed%5);x<w;x+=24) {
    rect(data,w,h,x,92,4,30,P.ink);
    rect(data,w,h,x+1,94,1,20,P.cyanDeep);
  }
}

function classifyExteriorLayerV38({ layerName, rank, count }) {
  const n=String(layerName ?? "").toLowerCase();
  if (/foliage|tree|near|foreground|front/u.test(n)) return "near";
  if (/campus|city|building|school|urban/u.test(n)) return "campus";
  if (/mountain|island|ridge|mid/u.test(n)) return "mountain";
  if (/sky|base|horizon|far|ocean/u.test(n)) return "far";
  if (count<=1 || rank===0) return "far";
  if (rank===count-1) return "near";
  return rank%2===1 ? "mountain" : "campus";
}

function createExteriorDepthTextureV38({ layerName, role }) {
  const w=PROFILE.textureWidth, h=PROFILE.textureHeight;
  const data=new Uint8Array(w*h*4), seed=hash32(layerName);
  if (role==="far") drawFar(data,w,h,seed);
  else if (role==="mountain") drawMountains(data,w,h,seed);
  else if (role==="campus") drawCampus(data,w,h,seed);
  else if (role==="near") drawNear(data,w,h,seed);
  else throw new Error(`unknown V38 exterior role: ${role}`);
  const texture=new THREE.DataTexture(data,w,h,THREE.RGBAFormat);
  texture.name=`cw06-v38-${role}-${String(layerName)}-texture`;
  texture.magFilter=THREE.NearestFilter;
  texture.minFilter=THREE.NearestFilter;
  texture.generateMipmaps=false;
  texture.wrapS=THREE.ClampToEdgeWrapping;
  texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.flipY=true;
  texture.needsUpdate=true;
  return texture;
}

function discoverExteriorDepthLayersV38(scene) {
  if (!scene?.isScene) throw new TypeError("V38 requires THREE.Scene");
  const meshes=[];
  scene.traverse((object)=>{
    if (!object?.isMesh || typeof object.name!=="string") return;
    const match=DEPTH_MESH_RE.exec(object.name);
    if (!match || !Number.isFinite(object.userData?.parallax)) return;
    if (!object.material || Array.isArray(object.material)) return;
    meshes.push({
      mesh:object,
      windowName:`window-${match[1]}`,
      layerName:match[2],
      material:object.material,
      parallax:object.userData.parallax,
      renderOrder:object.renderOrder,
      raycast:object.raycast
    });
  });
  if (!meshes.length) throw new Error("V38 could not discover classroomExteriorDepthV2 meshes");
  const byMaterial=new Map();
  for (const e of meshes) {
    if (!byMaterial.has(e.material)) byMaterial.set(e.material,{
      material:e.material, layerName:e.layerName, parallax:e.parallax, renderOrder:e.renderOrder, meshes:[]
    });
    byMaterial.get(e.material).meshes.push(e.mesh);
  }
  const layers=Array.from(byMaterial.values()).sort((a,b)=>{
    const d=a.parallax-b.parallax;
    return Math.abs(d)>1e-12 ? d : a.renderOrder-b.renderOrder;
  });
  const windowNames=Array.from(new Set(meshes.map(e=>e.windowName))).sort();
  return Object.freeze({meshes:Object.freeze(meshes),layers:Object.freeze(layers),windowNames:Object.freeze(windowNames)});
}

function createClassroomExteriorDepthArtV38({ scene }) {
  const discovery=discoverExteriorDepthLayersV38(scene);
  if (discovery.windowNames.length!==3) throw new Error(`V38 expected 3 canonical window groups, found ${discovery.windowNames.length}`);
  const states=[], ownedTextures=[], roles=[];
  let disposed=false;
  discovery.layers.forEach((layer,rank)=>{
    const material=layer.material;
    states.push({
      material,
      map:material.map ?? null,
      alphaTest:material.alphaTest,
      toneMapped:material.toneMapped,
      transparent:material.transparent,
      opacity:material.opacity,
      depthTest:material.depthTest,
      depthWrite:material.depthWrite,
      side:material.side,
      blending:material.blending
    });
    const role=classifyExteriorLayerV38({layerName:layer.layerName,rank,count:discovery.layers.length});
    const texture=createExteriorDepthTextureV38({layerName:layer.layerName,role});
    roles.push({layerName:layer.layerName,role});
    ownedTextures.push(texture);
    material.map=texture;
    material.alphaTest=Math.max(Number.isFinite(material.alphaTest)?material.alphaTest:0,PROFILE.minimumAlphaTest);
    material.toneMapped=false;
    material.needsUpdate=true;
  });

  function getSnapshot() {
    const parallaxAuthorityPreserved=discovery.meshes.every(e=>
      e.mesh.userData.parallax===e.parallax &&
      e.mesh.renderOrder===e.renderOrder &&
      e.mesh.raycast===e.raycast
    );
    const presentationAuthorityPreserved=states.every(s=>
      s.material.transparent===s.transparent &&
      s.material.opacity===s.opacity &&
      s.material.depthTest===s.depthTest &&
      s.material.depthWrite===s.depthWrite &&
      s.material.side===s.side &&
      s.material.blending===s.blending
    );
    return Object.freeze({
      id:PROFILE.id,
      depthMeshCount:discovery.meshes.length,
      windowCount:discovery.windowNames.length,
      uniqueLayerMaterialCount:discovery.layers.length,
      upgradedTextureCount:ownedTextures.length,
      parallaxAuthorityPreserved,
      presentationAuthorityPreserved,
      nearestFiltering:ownedTextures.every(t=>t.magFilter===THREE.NearestFilter&&t.minFilter===THREE.NearestFilter),
      mipmapsDisabled:ownedTextures.every(t=>t.generateMipmaps===false),
      srgbColorSpace:ownedTextures.every(t=>t.colorSpace===THREE.SRGBColorSpace),
      hardAlphaCutout:discovery.layers.every(l=>l.material.alphaTest>=PROFILE.minimumAlphaTest),
      toneMappingExcluded:discovery.layers.every(l=>l.material.toneMapped===false),
      layerRoles:Object.freeze(roles.map(x=>Object.freeze({...x}))),
      addedMeshes:0, addedGeometries:0, addedMaterials:0, addedTextures:ownedTextures.length,
      addedLights:0, addedDrawCalls:0, addedShadowMaps:0,
      constructionSceneTraversalCount:1, runtimeSceneTraversal:false, runtimeTickRequired:false,
      runtimeTexturePainting:false, disposed
    });
  }

  function dispose() {
    if (disposed) return;
    disposed=true;
    for (const s of states) {
      s.material.map=s.map;
      s.material.alphaTest=s.alphaTest;
      s.material.toneMapped=s.toneMapped;
      s.material.needsUpdate=true;
    }
    for (const t of ownedTextures) t.dispose();
  }

  return Object.freeze({getSnapshot,dispose});
}

export {
  PROFILE as CLASSROOM_EXTERIOR_DEPTH_ART_V38_PROFILE,
  classifyExteriorLayerV38,
  createClassroomExteriorDepthArtV38,
  createExteriorDepthTextureV38,
  discoverExteriorDepthLayersV38
};
