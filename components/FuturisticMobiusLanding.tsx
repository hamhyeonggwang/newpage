"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Image from 'next/image';
import Navigation from './Navigation';

// --- Helper: build a Möbius strip BufferGeometry (no deprecated examples needed) ---
function buildMobiusGeometry({ R = 1.2, width = 0.35, segmentsU = 400, segmentsV = 40 }) {
  const uSeg = Math.max(20, segmentsU);
  const vSeg = Math.max(2, segmentsV);
  const positions = new Float32Array((uSeg + 1) * (vSeg + 1) * 3);
  const uvs = new Float32Array((uSeg + 1) * (vSeg + 1) * 2);
  const indices = [];

  let p = 0;
  let t = 0;
  for (let i = 0; i <= uSeg; i++) {
    const u = (i / uSeg) * Math.PI * 2; // [0, 2pi]
    for (let j = 0; j <= vSeg; j++) {
      const v = ((j / vSeg) * 2 - 1) * width; // [-width, width]
      const a = u; // alias
      const half = a * 0.5; // JS variable name is fine (not GLSL)

      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const cosHalf = Math.cos(half);
      const sinHalf = Math.sin(half);

      const x = (R + (v * cosHalf)) * cos;
      const y = (R + (v * cosHalf)) * sin;
      const z = v * sinHalf;

      positions[p++] = x;
      positions[p++] = y;
      positions[p++] = z;

      uvs[t++] = i / uSeg;
      uvs[t++] = j / vSeg;
    }
  }

  for (let i = 0; i < uSeg; i++) {
    for (let j = 0; j < vSeg; j++) {
      const a = i * (vSeg + 1) + j;
      const b = (i + 1) * (vSeg + 1) + j;
      const c = (i + 1) * (vSeg + 1) + (j + 1);
      const d = i * (vSeg + 1) + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// --- Enhanced glow material with better depth and realism ---
function makeGlowMaterial({ baseColor = new THREE.Color("#7c3aed") }) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: baseColor },
      uTime: { value: 0 },
      uTStrength: { value: 0 }, // side-view T emphasis
      uIntensity: { value: 1.0 }, // glow intensity
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main(){
        vNormal = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uTStrength;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main(){
        // Enhanced fresnel with multiple layers
        vec3 n = normalize(vNormal);
        vec3 v = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 1.8);
        float fres2 = pow(1.0 - max(dot(n, v), 0.0), 3.2);
        
        // Multi-layered pulsing effect
        float pulse1 = 0.7 + 0.3 * sin(uTime * 1.2);
        float pulse2 = 0.5 + 0.5 * sin(uTime * 2.1 + 1.0);
        float pulse3 = 0.8 + 0.2 * sin(uTime * 0.8 + 2.0);
        
        // Enhanced T mask with better edge detection
        float soft = 0.2;
        float hb = 0.04;
        float vb = 0.06;
        float hBand = 1.0 - smoothstep(hb, hb + soft, abs(n.y));
        float vBand = 1.0 - smoothstep(vb, vb + soft, abs(n.x));
        float tMask = max(hBand * 0.95, vBand);
        
        // Multi-layered color composition
        vec3 baseCol = uColor * (1.4 * fres * pulse1 * uIntensity);
        vec3 midCol = uColor * (0.8 * fres2 * pulse2 * uIntensity * 0.6);
        vec3 tCol = uColor * (1.3 + 0.5 * sin(uTime * 2.3)) * tMask * uTStrength * uIntensity;
        vec3 edgeCol = uColor * (0.6 * fres * pulse3 * uIntensity * 0.4);
        
        vec3 col = baseCol + midCol + tCol + edgeCol;
        float alpha = clamp(fres * 1.8 + fres2 * 0.6 + tMask * 1.1 * uTStrength, 0.0, 1.0) * uIntensity;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  return mat;
}

// --- Particle field ---
function makeParticleSystem(count = 1000, radius = 6) {
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = radius * (0.2 + Math.random() * 0.8);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    speeds[i] = 0.4 + Math.random() * 0.8;
  }
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0.0 } },
    vertexShader: `
      attribute float aSpeed;
      uniform float uTime;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * aSpeed + p.y * 0.2) * 0.12;
        p.y += cos(uTime * aSpeed + p.z * 0.2) * 0.12;
        p.z += sin(uTime * aSpeed + p.x * 0.2) * 0.12;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 1.6 + 1.2 * aSpeed;
      }
    `,
    fragmentShader: `
      void main(){
        float d = length(gl_PointCoord - vec2(0.5));
        float alpha = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(0.6, 0.8, 1.0, alpha);
      }
    `,
  });
  const points = new THREE.Points(geom, mat);
  return points;
}

// --- (Dev) Self-tests for shader strings ---
function runSelfTests({ bgMat, glowMat }: { bgMat: any; glowMat: any }) {
  try {
    const bgSrc = bgMat.fragmentShader || "";
    const glowSrc = glowMat.fragmentShader || "";
    // Test 1: Ensure reserved word 'half' is not used as an identifier in GLSL
    console.assert(!/\bvec2\s+half\b/.test(bgSrc), "GLSL reserved word 'half' used in bgMat fragment shader");
    console.assert(!/\bvec2\s+half\b/.test(glowSrc), "GLSL reserved word 'half' used in glowMat fragment shader");
    // Test 2: Ensure T-strength uniform exists in both shaders
    console.assert(/uTStrength/.test(bgSrc), "uTStrength missing in bgMat fragment shader");
    console.assert(/uTStrength/.test(glowSrc), "uTStrength missing in glowMat fragment shader");
    // Test 3: Ensure srect helper uses halfSize naming
    console.assert(/srect\(vec2\s+uv,\s*vec2\s+center,\s*vec2\s+halfSize,\s*float\s+edge\)/.test(bgSrc), "srect signature not updated to use halfSize");
    console.log("[SelfTests] Shader string checks passed ✔");
  } catch (e) {
    console.warn("[SelfTests] An error occurred while running self-tests", e);
  }
}

// --- Utility: detect static hero preference ---
function detectStaticHero() {
  const params = new URLSearchParams(window.location.search);
  // Default: use 3D hero unless explicitly requesting image
  if (params.get("hero") === "3d") return false;
  if (params.get("hero") === "img") return true;
  // Respect reduced motion preference
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  return false; // default 3D mode
}

// --- Main Component ---
export default function FuturisticMobiusLanding() {
  const HERO_IMG_SRC = "/hero-ot.png"; // your hero image
  const HERO_IMG_SRC_WEBP = "/hero-ot.webp"; // optional optimized version
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [useStaticHero, setUseStaticHero] = useState(false);

  useEffect(() => {
    setUseStaticHero(detectStaticHero());
  }, []);

  useEffect(() => {
    if (useStaticHero) return; // Skip WebGL when static hero is preferred

    const mount = mountRef.current;
    if (!mount) return;

    // Sizes
    const sizes = { width: mount.clientWidth, height: mount.clientHeight };

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current!, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(sizes.width, sizes.height);

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050512, 12, 28);

    const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 100);
    camera.position.set(0, 0.2, 4.6);
    scene.add(camera);

    // Background gradient plane for a sleek look + T gobo overlay
    const bgGeo = new THREE.PlaneGeometry(50, 50);
    const bgMat = new THREE.ShaderMaterial({
      depthWrite: false,
      transparent: true,
      uniforms: {
        uTop: { value: new THREE.Color("#0b1020") },
        uBottom: { value: new THREE.Color("#03040a") },
        uTStrength: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} 
      `,
      fragmentShader: `
        varying vec2 vUv; uniform vec3 uTop; uniform vec3 uBottom; uniform float uTStrength;
        // Smooth rectangle helper (rename 'half' -> 'halfSize' to avoid GLSL reserved word)
        float srect(vec2 uv, vec2 center, vec2 halfSize, float edge){
          vec2 d = abs(uv - center) - halfSize;
          float outside = max(d.x, d.y);
          return 1.0 - smoothstep(0.0, edge, outside);
        }
        void main(){
          // base gradient only - no T effect
          vec3 col = mix(uBottom, uTop, vUv.y);
          gl_FragColor = vec4(col, 0.95);
        }
      `,
    });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.position.z = -10;
    scene.add(bg);

    // Möbius Strip Mesh (core) — enhanced metallic base with better geometry
    const mobiusGeo = buildMobiusGeometry({ R: 1.4, width: 0.42, segmentsU: 1200, segmentsV: 80 });
    const metal = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#94a3b8"),
      metalness: 0.95,
      roughness: 0.08,
      transmission: 0.1,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      side: THREE.DoubleSide,
      envMapIntensity: 1.2,
    });
    const mobius = new THREE.Mesh(mobiusGeo, metal);
    scene.add(mobius);

    // Enhanced neon edge glow with multiple layers
    const glowMat = makeGlowMaterial({ baseColor: new THREE.Color("#7c3aed") });
    const glow = new THREE.Mesh(mobiusGeo.clone(), glowMat);
    glow.scale.multiplyScalar(1.012);
    scene.add(glow);

    // Additional inner glow layer for depth
    const innerGlowMat = makeGlowMaterial({ baseColor: new THREE.Color("#a78bfa") });
    const innerGlow = new THREE.Mesh(mobiusGeo.clone(), innerGlowMat);
    innerGlow.scale.multiplyScalar(0.995);
    scene.add(innerGlow);

    // Particles
    const particles = makeParticleSystem(1200, 10);
    scene.add(particles);

    // Enhanced lighting system for better depth and realism
    scene.add(new THREE.AmbientLight(0x6677aa, 0.4));
    
    // Main rim lights for depth
    const p1 = new THREE.PointLight(0x6ee7ff, 3.0, 20);
    const p2 = new THREE.PointLight(0xa78bfa, 3.0, 20);
    p1.position.set(4, 1.5, 2);
    p2.position.set(-4, -1.5, -2);
    scene.add(p1, p2);

    // Additional accent lights for more depth
    const accent1 = new THREE.PointLight(0x7c3aed, 1.5, 15);
    const accent2 = new THREE.PointLight(0x06b6d4, 1.5, 15);
    accent1.position.set(0, 3, 3);
    accent2.position.set(0, -3, -3);
    scene.add(accent1, accent2);

    // Directional light for overall illumination
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight.position.set(5, 5, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const clock = new THREE.Clock();
    let raf: number;
    let tHold = 0; // hysteresis for T visibility

    // (Dev) Run small shader string self-tests
    runSelfTests({ bgMat, glowMat });

    // Interaction: slight tilt by pointer
    const targetRot = { x: 0, y: 0 };
    const onPointerMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width; // 0..1
      const ny = (e.clientY - rect.top) / rect.height; // 0..1
      targetRot.x = (ny - 0.5) * 0.3;
      targetRot.y = (nx - 0.5) * 0.6;
    };
    window.addEventListener("pointermove", onPointerMove);

    // Resize
    const onResize = () => {
      sizes.width = mount.clientWidth;
      sizes.height = mount.clientHeight;
      camera.aspect = sizes.width / sizes.height;
      camera.updateProjectionMatrix();
      renderer.setSize(sizes.width, sizes.height);
    };
    window.addEventListener("resize", onResize);

    // Enhanced animation with smoother motion
    function animate() {
      const t = clock.getElapsedTime();

      // Smoother auto-rotation with subtle variations
      const slow = 0.2; // slightly slower base speed
      const autoY = t * slow;
      const subtleWobble = Math.sin(t * 0.3) * 0.05; // subtle breathing motion
      
      mobius.rotation.set(
        THREE.MathUtils.damp(mobius.rotation.x, targetRot.x + subtleWobble, 3, 0.016),
        autoY + THREE.MathUtils.damp(0, targetRot.y, 3, 0.016),
        Math.sin(t * 0.1) * 0.02 // subtle z-axis rotation
      );
      
      // Synchronized rotation for all glow layers
      glow.rotation.copy(mobius.rotation);
      innerGlow.rotation.copy(mobius.rotation);

      // Enhanced light animation with more organic movement
      const lightRadius = 4.2;
      const lightSpeed1 = 0.5;
      const lightSpeed2 = 0.7;
      
      p1.position.x = Math.cos(t * lightSpeed1) * lightRadius;
      p1.position.z = Math.sin(t * lightSpeed1) * lightRadius;
      p1.position.y = 1.5 + Math.sin(t * 0.4) * 0.3;
      
      p2.position.x = Math.cos(t * lightSpeed2 + Math.PI * 0.5) * lightRadius;
      p2.position.z = Math.sin(t * lightSpeed2 + Math.PI * 0.5) * lightRadius;
      p2.position.y = -1.5 + Math.cos(t * 0.3) * 0.3;

      // Accent lights subtle movement
      accent1.position.y = 3 + Math.sin(t * 0.2) * 0.5;
      accent2.position.y = -3 + Math.cos(t * 0.25) * 0.5;

      // Side-view detection for the T illusion
      const yRotMod = (mobius.rotation.y % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const edgeOn = Math.min(
        Math.abs(yRotMod - Math.PI * 0.5),
        Math.abs(yRotMod - Math.PI * 1.5)
      );
      const vis = THREE.MathUtils.smoothstep(0.42, 0.0, edgeOn); // wider tolerance
      const target = vis > 0.08 ? 1 : 0; // hysteresis target
      tHold = THREE.MathUtils.damp(tHold, target, 2.5, 0.016);

      // Enhanced shader uniforms with intensity variations
      const intensityVariation = 0.8 + 0.2 * Math.sin(t * 0.5);
      
      glowMat.uniforms.uTime.value = t;
      glowMat.uniforms.uTStrength.value = tHold;
      glowMat.uniforms.uIntensity.value = intensityVariation;
      
      innerGlowMat.uniforms.uTime.value = t;
      innerGlowMat.uniforms.uTStrength.value = tHold * 0.7;
      innerGlowMat.uniforms.uIntensity.value = intensityVariation * 0.6;
      
      particles.material.uniforms.uTime.value = t;
      bgMat.uniforms.uTStrength.value = tHold;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      // Enhanced cleanup for all geometries and materials
      mobiusGeo.dispose();
      bgGeo.dispose();
      glow.geometry.dispose();
      innerGlow.geometry.dispose();
      glowMat.dispose();
      innerGlowMat.dispose();
      metal.dispose();
      renderer.dispose();
    };
  }, [useStaticHero]);

  const toggleHero = () => setUseStaticHero((v) => !v);

  return (
    <div className="w-full min-h-screen bg-black text-white relative overflow-hidden">
      {/* Navigation */}
      <Navigation />
      
      {/* Hero Toggle Button */}
      <div className="fixed top-20 right-4 z-40">
        <button 
          onClick={toggleHero} 
          className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40 transition-all duration-300 bg-black/50 backdrop-blur-sm text-sm font-medium text-white/80 hover:text-white"
        >
          {useStaticHero ? "Use 3D" : "Use Image"}
        </button>
      </div>

      {/* Hero: Static Image OR 3D Stage */}
      <section id="home" className="relative h-[92vh] sm:h-[92vh] flex items-center" ref={useStaticHero ? null : mountRef}>
        {useStaticHero ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black via-gray-900 to-black">
            <div className="relative">
              <Image 
                src={HERO_IMG_SRC} 
                alt="OT neon Möbius logo forming O and T" 
                width={800}
                height={600}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  console.log('Image failed to load:', HERO_IMG_SRC);
                  e.currentTarget.style.display = 'none';
                }}
              />
              {/* Subtle glow effect around the image */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent blur-xl opacity-50"></div>
            </div>
          </div>
        ) : (
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        )}
        {/* Overlay Copy */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center select-none">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-semibold leading-tight tracking-tight">
            From <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-indigo-400">doing</span> to being, from being to meaning
          </h1>
          <p className="mt-4 text-base sm:text-lg md:text-xl text-white/80">
            In the process of becoming.
          </p>
          <div className="mt-6 max-w-3xl mx-auto">
            <p className="text-sm sm:text-base text-white/60 italic leading-relaxed">
              &quot;삶은 행위에서 존재로, 존재에서 의미로<br />
              그 모든 여정은 되어가는 과정 안에서&quot;
            </p>
          </div>
          <div className="mt-8 flex items-center justify-center gap-3">
            <a href="#projects" className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 transition text-sm sm:text-base">View Portfolio</a>
            <a href="#contact" className="px-5 py-3 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-semibold text-sm sm:text-base shadow-lg shadow-fuchsia-500/20">Get in touch</a>
          </div>
          <div className="mt-12 text-white/60 text-xs sm:text-sm">Scroll to explore</div>
        </div>
      </section>


      {/* Projects Section */}
      <section id="projects" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Project</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {/* ICF Mapper */}
          <div className="group relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-transparent backdrop-blur-sm hover:border-cyan-400/40 transition-all duration-500 hover:scale-105">
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">ICF Mapper</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    임상 언어 데이터를 ICF 코드로 자동 분류하는 sLLM 기반 시스템. 
                    작업치료사의 임상 기록을 표준화된 ICF 프레임워크로 변환하여 
                    치료 계획 수립의 효율성을 극대화합니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs rounded-full">Python</span>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">TensorFlow</span>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">sLLM</span>
                  <span className="px-3 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">ICF</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-white/60 text-sm">2025</span>
                  <a href="https://chatgpt.com/g/g-6853a3c55f448191aadefb87182c708f-r-oti-lab-icf-geomsaeg-caesbos" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium">View Project →</a>
                </div>
              </div>
            </div>
          </div>

          {/* 노인인지훈련 웹앱 */}
          <div className="group relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 to-transparent backdrop-blur-sm hover:border-emerald-400/40 transition-all duration-500 hover:scale-105">
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">노인인지훈련 웹앱</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    노인을 위한 인지능력 향상 웹 애플리케이션. 
                    다양한 인지훈련 게임을 통해 노인의 
                    인지 기능을 체계적으로 향상시키는 
                    디지털 치료 솔루션입니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded-full">React</span>
                  <span className="px-3 py-1 bg-teal-500/20 text-teal-300 text-xs rounded-full">Next.js</span>
                  <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs rounded-full">Web Games</span>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">Digital Therapy</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-white/60 text-sm">2025</span>
                  <a href="https://cog-red.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">View Project →</a>
                </div>
              </div>
            </div>
          </div>

          {/* 영양분석 웹앱 */}
          <div className="group relative overflow-hidden rounded-3xl border border-pink-400/20 bg-gradient-to-br from-pink-500/10 to-transparent backdrop-blur-sm hover:border-pink-400/40 transition-all duration-500 hover:scale-105">
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">영양분석 웹앱</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    AI를 활용한 친근한 식생활 교육용 웹 애플리케이션. 
                    음식 사진을 찍으면 AI가 영양소를 분석해주는 
                    재미있는 영양 교육 플랫폼입니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-pink-500/20 text-pink-300 text-xs rounded-full">React</span>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">AI</span>
                  <span className="px-3 py-1 bg-orange-500/20 text-orange-300 text-xs rounded-full">Nutrition</span>
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">Education</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-white/60 text-sm">2025</span>
                  <a href="https://diet-mauve.vercel.app" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 text-sm font-medium">View Project →</a>
                </div>
              </div>
            </div>
          </div>


          {/* OT Assess Tool Box */}
          <div className="group relative overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-transparent backdrop-blur-sm hover:border-amber-400/40 transition-all duration-500 hover:scale-105">
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">OT Assess Tool Box</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    작업치료 평가를 위한 디지털 플랫폼. 
                    다양한 평가도구를 통합하여 임상가의 평가 업무를 
                    효율적으로 지원하는 웹 기반 솔루션입니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-full">Assessment Tools</span>
                  <span className="px-3 py-1 bg-orange-500/20 text-orange-300 text-xs rounded-full">Digital Platform</span>
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">Clinical Support</span>
                  <span className="px-3 py-1 bg-red-500/20 text-red-300 text-xs rounded-full">Web Solution</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-white/60 text-sm">2025</span>
                  <a href="https://assess-beige.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 text-sm font-medium">View Project →</a>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Books Section */}
      <section id="books" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Book</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 나의 작업치료, 당신의 작업 - 공저 */}
          <div className="group relative overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-transparent backdrop-blur-sm hover:border-amber-400/40 transition-all duration-500 hover:scale-105">
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">나의 작업치료, 당신의 작업</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    작업치료의 본질과 실무를 다룬 공저 도서. 
                    작업치료사의 경험과 지혜를 담아 
                    작업치료의 가치와 의미를 전달하는 
                    실무 중심의 전문서입니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-full">공저</span>
                  <span className="px-3 py-1 bg-orange-500/20 text-orange-300 text-xs rounded-full">작업치료</span>
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">실무서</span>
                  <span className="px-3 py-1 bg-red-500/20 text-red-300 text-xs rounded-full">전문서</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-white/60 text-sm">2025</span>
                  <a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=282033239&srsltid=AfmBOorhDqb5XJp4UfhyN-r05LPVRiQrqO1LNLPj_O_9fvE9969Gm2xj" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 text-sm font-medium">View Book →</a>
                </div>
              </div>
            </div>
          </div>

          {/* 감각통합 - 감각처리장애와 중재 - 편집위원 */}
          <div className="group relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-transparent backdrop-blur-sm hover:border-violet-400/40 transition-all duration-500 hover:scale-105">
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">감각통합 - 감각처리장애와 중재</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    감각처리장애와 중재에 대한 전문 도서. 
                    감각통합 이론과 실제 중재 방법을 체계적으로 정리한 
                    감각통합 치료의 핵심 지침서로 편집위원으로 참여했습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-violet-500/20 text-violet-300 text-xs rounded-full">편집위원</span>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">감각통합</span>
                  <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs rounded-full">중재</span>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">전문서</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-white/60 text-sm">2025</span>
                  <a href="https://www.nrbooks.kr/goods/search_result.php?search_key=%EA%B0%90%EA%B0%81%ED%86%B5%ED%95%A9" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 text-sm font-medium">View Book →</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">About</h2>
          <div className="w-24 h-1 bg-gradient-to-r from-cyan-400 to-fuchsia-400 mx-auto rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Profile Image */}
          <div className="relative space-y-8">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10 backdrop-blur-sm">
              <Image 
                src="/profile-ham.png" 
                alt="함형광 프로필" 
                width={400}
                height={400}
                className="w-full h-auto object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>
            
            {/* Greeting Message */}
            <div className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <div className="space-y-4">
                <p className="text-white/90 text-sm leading-relaxed">
                  안녕하세요. 인간의 삶을 다시 디자인하는 작업치료사, 함형광입니다.
                </p>
                <p className="text-white/80 text-sm leading-relaxed">
                  저는 사람의 '할 수 있음'을 넘어 <span className="text-cyan-400 font-medium">*'되어감(Becoming)'*</span>의 여정을 함께합니다.
                </p>
                <p className="text-white/80 text-sm leading-relaxed">
                  작업치료는 기능을 회복하는 일을 넘어,<br />
                  삶의 의미를 다시 세우는 과정이라 믿습니다.
                </p>
                <p className="text-white/80 text-sm leading-relaxed">
                  병원 안에서 시작된 변화가<br />
                  학교와 지역, 그리고 사회로 이어지길 바랍니다.
                </p>
                <p className="text-white/80 text-sm leading-relaxed">
                  사람의 가능성은 데이터가 아닌 이야기에서 시작됩니다.<br />
                  그 이야기가 '실천'되고 다시 '참여'로 이어질 때,<br />
                  우리는 진짜 변화를 만납니다.
                </p>
                <p className="text-white/80 text-sm leading-relaxed">
                  언제나 사람의 가능성을 이야기하고 싶습니다.<br />
                  편하게 연락 주세요. 함께 나누는 대화가 또 하나의 시작이 되길 바랍니다.
                </p>
              </div>
            </div>

          </div>

          {/* Content */}
          <div className="space-y-8">
            {/* Title */}
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Occupational Therapy Futurist
              </h3>
              <p className="text-lg text-cyan-400 font-medium">
                AI × ICF × Human-Centered Design
              </p>
            </div>

            {/* Education */}
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <h4 className="text-lg font-semibold text-white mb-4">학력</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">건양대학교 작업치료학과</p>
                      <p className="text-white/70 text-sm">졸업</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-fuchsia-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">강원대학교 일반대학원 작업치료학과</p>
                      <p className="text-white/70 text-sm">석사수료 (ICF 기반 임상 언어 데이터의 기능분류 및 sLLM 개발 연구 수행 중)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clinical Experience */}
              <div className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <h4 className="text-lg font-semibold text-white mb-4">임상경력</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">푸르메재단 넥슨어린이재활병원</p>
                      <p className="text-white/70 text-sm">학령기치료팀장 (현)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-fuchsia-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">국민건강보험공단 일산병원</p>
                      <p className="text-white/70 text-sm">소아작업치료팀 (전)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">신촌 연세의료원 재활병원</p>
                      <p className="text-white/70 text-sm">소아작업치료팀 (전)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Association Activities */}
              <div className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <h4 className="text-lg font-semibold text-white mb-4">협회/학회 활동</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">대한작업치료사협회 서울지부</p>
                      <p className="text-white/70 text-sm">이사</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-fuchsia-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">대한아동.학교작업치료학회</p>
                      <p className="text-white/70 text-sm">이사</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Teaching Experience */}
              <div className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <h4 className="text-lg font-semibold text-white mb-4">강의경력</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">대한소아재활발달의학회</p>
                      <p className="text-white/70 text-sm">소아재활 전문과정</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-fuchsia-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">대한아동.학교작업치료학회</p>
                      <p className="text-white/70 text-sm">아동발달평가사 / 인지발달심리상담지도사 과정</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">동남보건대학교</p>
                      <p className="text-white/70 text-sm">전공심화 과정</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expertise */}
              <div className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <h4 className="text-lg font-semibold text-white mb-4">전문 분야</h4>
                <div className="flex flex-wrap gap-3">
                  <span className="px-4 py-2 bg-cyan-500/20 text-cyan-300 rounded-full text-sm font-medium">ICF</span>
                  <span className="px-4 py-2 bg-fuchsia-500/20 text-fuchsia-300 rounded-full text-sm font-medium">AI in Rehabilitation</span>
                  <span className="px-4 py-2 bg-indigo-500/20 text-indigo-300 rounded-full text-sm font-medium">Data-driven Clinical Design</span>
                </div>
              </div>

              {/* Awards */}
              <div className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <h4 className="text-lg font-semibold text-white mb-4">수상내역</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">대한작업치료사협회 협회장 표창</p>
                      <p className="text-white/70 text-sm">2013년</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">대한작업치료사협회 서울지회장 표창</p>
                      <p className="text-white/70 text-sm">2020년</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">서울시 의료기사총연합회 회장 표창</p>
                      <p className="text-white/70 text-sm">2023년</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-2xl sm:text-3xl font-semibold">Contact</h2>
        
        {/* SNS Links */}
        <div className="mt-8 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Follow Me</h3>
          <div className="flex flex-wrap gap-4">
            <a 
              href="https://www.instagram.com/starlight_daddy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-400/30 rounded-xl hover:border-pink-400/50 transition-all duration-200"
            >
              <div className="w-6 h-6 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">IG</span>
              </div>
              <span className="text-white font-medium">Instagram</span>
            </a>
            
            <a 
              href="https://brunch.co.kr/@starlight-daddy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-400/30 rounded-xl hover:border-orange-400/50 transition-all duration-200"
            >
              <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">B</span>
              </div>
              <span className="text-white font-medium">Brunch Story</span>
            </a>
          </div>
        </div>

        <form 
          action="mailto:h2g0614@gmail.com" 
          method="post" 
          encType="text/plain"
          className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl"
        >
          <input 
            type="text" 
            name="name"
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-white/30" 
            placeholder="Your name" 
            required
          />
          <input 
            type="email" 
            name="email"
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-white/30" 
            placeholder="Email" 
            required
          />
          <textarea 
            name="message"
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-white/30 sm:col-span-2" 
            placeholder="Message" 
            rows={4}
            required
          />
          <button 
            type="submit"
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-semibold w-fit"
          >
            Send
          </button>
        </form>
      </section>

      <footer className="px-6 py-10 border-t border-white/10 text-white/60 text-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-center">
          <div>© {new Date().getFullYear()} OT Futurist</div>
        </div>
      </footer>
    </div>
  );
}

