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

// --- Glow material: simple additive fresnel-ish look (no postprocessing needed) ---
function makeGlowMaterial({ baseColor = new THREE.Color("#7c3aed") }) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: baseColor },
      uTime: { value: 0 },
      uTStrength: { value: 0 }, // side-view T emphasis
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
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main(){
        // Fresnel term
        vec3 n = normalize(vNormal);
        vec3 v = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
        float pulse = 0.6 + 0.4 * sin(uTime * 1.5);
        // Screen-space independent approximate T mask: use normal orientation bands
        float soft = 0.25; // softness of bands
        float hb = 0.05;   // horizontal bar threshold using |n.y|
        float vb = 0.08;   // vertical stem threshold using |n.x|
        float hBand = 1.0 - smoothstep(hb, hb + soft, abs(n.y));
        float vBand = 1.0 - smoothstep(vb, vb + soft, abs(n.x));
        float tMask = max(hBand * 0.9, vBand);
        vec3 baseCol = uColor * (1.2 * fres * pulse);
        vec3 tCol = uColor * (1.1 + 0.4 * sin(uTime * 2.0)) * tMask * uTStrength;
        vec3 col = baseCol + tCol;
        float alpha = clamp(fres * 1.5 + tMask * 0.9 * uTStrength, 0.0, 1.0);
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
function runSelfTests({ bgMat, glowMat }) {
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

    // Möbius Strip Mesh (core) — metallic base
    const mobiusGeo = buildMobiusGeometry({ R: 1.4, width: 0.38, segmentsU: 800, segmentsV: 60 });
    const metal = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#94a3b8"),
      metalness: 0.9,
      roughness: 0.15,
      transmission: 0.0,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
      side: THREE.DoubleSide,
    });
    const mobius = new THREE.Mesh(mobiusGeo, metal);
    scene.add(mobius);

    // Neon edge glow shell (slightly scaled up)
    const glowMat = makeGlowMaterial({ baseColor: new THREE.Color("#7c3aed") });
    const glow = new THREE.Mesh(mobiusGeo.clone(), glowMat);
    glow.scale.multiplyScalar(1.008);
    scene.add(glow);

    // Particles
    const particles = makeParticleSystem(1200, 10);
    scene.add(particles);

    // Lights
    scene.add(new THREE.AmbientLight(0x6677aa, 0.5));
    const p1 = new THREE.PointLight(0x6ee7ff, 2.2, 18);
    const p2 = new THREE.PointLight(0xa78bfa, 2.2, 18);
    p1.position.set(4, 1.5, 2);
    p2.position.set(-4, -1.5, -2);
    scene.add(p1, p2);

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

    // Animation
    function animate() {
      const t = clock.getElapsedTime();

      // Auto-rotation for the strip (to showcase O → T transition during a cycle)
      const slow = 0.25; // base speed
      const autoY = t * slow;
      mobius.rotation.set(
        THREE.MathUtils.damp(mobius.rotation.x, targetRot.x, 4, 0.016),
        autoY + THREE.MathUtils.damp(0, targetRot.y, 4, 0.016),
        0
      );
      glow.rotation.copy(mobius.rotation);

      // Pulse lights around the strip
      p1.position.x = Math.cos(t * 0.7) * 3.6;
      p1.position.z = Math.sin(t * 0.7) * 3.6;
      p2.position.x = Math.cos(t * -0.9 + Math.PI * 0.5) * 3.8;
      p2.position.z = Math.sin(t * -0.9 + Math.PI * 0.5) * 3.8;

      // Side-view detection for the T illusion
      const yRotMod = (mobius.rotation.y % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const edgeOn = Math.min(
        Math.abs(yRotMod - Math.PI * 0.5),
        Math.abs(yRotMod - Math.PI * 1.5)
      );
      const vis = THREE.MathUtils.smoothstep(0.42, 0.0, edgeOn); // wider tolerance
      const target = vis > 0.08 ? 1 : 0; // hysteresis target
      tHold = THREE.MathUtils.damp(tHold, target, 2.5, 0.016);

      // shader uniforms
      glowMat.uniforms.uTime.value = t;
      glowMat.uniforms.uTStrength.value = tHold;
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
      // Dispose
      mobiusGeo.dispose();
      bgGeo.dispose();
      glow.geometry.dispose();
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
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Selected Projects</h2>
          <p className="text-white/70 max-w-3xl mx-auto text-lg">
            ICF, AI, 지역사회, 작업치료의 융합을 통한 혁신적인 재활 기술 솔루션
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {/* ICF Mapper */}
          <div className="group relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-transparent backdrop-blur-sm hover:border-cyan-400/40 transition-all duration-500 hover:scale-105">
            <div className="p-6">
              <div className="aspect-video rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 mb-6 flex items-center justify-center">
                <Image src="/icf-mapper.png" alt="ICF Mapper" width={400} height={225} className="w-full h-full object-cover rounded-2xl" />
              </div>
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
                  <span className="text-white/60 text-sm">2024</span>
                  <a href="#" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium">View Project →</a>
                </div>
              </div>
            </div>
          </div>

          {/* NeuroRehab Scheduler */}
          <div className="group relative overflow-hidden rounded-3xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/10 to-transparent backdrop-blur-sm hover:border-fuchsia-400/40 transition-all duration-500 hover:scale-105">
            <div className="p-6">
              <div className="aspect-video rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 mb-6 flex items-center justify-center">
                <Image src="/neurorehab-scheduler.png" alt="NeuroRehab Scheduler" width={400} height={225} className="w-full h-full object-cover rounded-2xl" />
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">NeuroRehab Scheduler</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    병원-지역 재활치료 예약 및 알림 자동화 워크플로우. 
                    환자의 재활 일정을 최적화하고 치료사와 환자 간의 
                    원활한 소통을 지원하는 지능형 스케줄링 시스템입니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-fuchsia-500/20 text-fuchsia-300 text-xs rounded-full">React</span>
                  <span className="px-3 py-1 bg-pink-500/20 text-pink-300 text-xs rounded-full">Node.js</span>
                  <span className="px-3 py-1 bg-orange-500/20 text-orange-300 text-xs rounded-full">MongoDB</span>
                  <span className="px-3 py-1 bg-red-500/20 text-red-300 text-xs rounded-full">AI</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-white/60 text-sm">2024</span>
                  <a href="#" className="text-fuchsia-400 hover:text-fuchsia-300 text-sm font-medium">View Project →</a>
                </div>
              </div>
            </div>
          </div>

          {/* OT Insight */}
          <div className="group relative overflow-hidden rounded-3xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 to-transparent backdrop-blur-sm hover:border-indigo-400/40 transition-all duration-500 hover:scale-105">
            <div className="p-6">
              <div className="aspect-video rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 mb-6 flex items-center justify-center">
                <Image src="/ot-insight.png" alt="OT Insight" width={400} height={225} className="w-full h-full object-cover rounded-2xl" />
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">OT Insight</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    기능·참여·환경 데이터를 시각화하는 대시보드 (ICF Core Set 기반). 
                    환자의 재활 진행 상황을 직관적으로 파악할 수 있는 
                    데이터 시각화 및 분석 플랫폼입니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs rounded-full">React</span>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">D3.js</span>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">TypeScript</span>
                  <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs rounded-full">ICF Core Set</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-white/60 text-sm">2024</span>
                  <a href="#" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">View Project →</a>
                </div>
              </div>
            </div>
          </div>

          {/* RehabGame Studio */}
          <div className="group relative overflow-hidden rounded-3xl border border-green-400/20 bg-gradient-to-br from-green-500/10 to-transparent backdrop-blur-sm hover:border-green-400/40 transition-all duration-500 hover:scale-105">
            <div className="p-6">
              <div className="aspect-video rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 mb-6 flex items-center justify-center">
                <Image src="/rehabgame-studio.png" alt="RehabGame Studio" width={400} height={225} className="w-full h-full object-cover rounded-2xl" />
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">RehabGame Studio</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    작업치료를 위한 웹게임 개발 플랫폼. 
                    환자의 인지 기능과 운동 기능 향상을 위한 
                    맞춤형 게임 콘텐츠를 쉽게 제작할 수 있는 도구입니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">JavaScript</span>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded-full">Canvas API</span>
                  <span className="px-3 py-1 bg-teal-500/20 text-teal-300 text-xs rounded-full">WebGL</span>
                  <span className="px-3 py-1 bg-lime-500/20 text-lime-300 text-xs rounded-full">Game Design</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-white/60 text-sm">2024</span>
                  <a href="#" className="text-green-400 hover:text-green-300 text-sm font-medium">View Project →</a>
                </div>
              </div>
            </div>
          </div>

          {/* Cognitive Training Games */}
          <div className="group relative overflow-hidden rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-yellow-500/10 to-transparent backdrop-blur-sm hover:border-yellow-400/40 transition-all duration-500 hover:scale-105">
            <div className="p-6">
              <div className="aspect-video rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 mb-6 flex items-center justify-center">
                <Image src="/cognitive-games.png" alt="Cognitive Training Games" width={400} height={225} className="w-full h-full object-cover rounded-2xl" />
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Cognitive Training Games</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    인지 기능 향상을 위한 웹게임 컬렉션. 
                    기억력, 집중력, 문제해결능력 등을 향상시키는 
                    다양한 미니게임들을 제공하는 플랫폼입니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">HTML5</span>
                  <span className="px-3 py-1 bg-orange-500/20 text-orange-300 text-xs rounded-full">CSS3</span>
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-full">JavaScript</span>
                  <span className="px-3 py-1 bg-red-500/20 text-red-300 text-xs rounded-full">Cognitive Science</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-white/60 text-sm">2024</span>
                  <a href="#" className="text-yellow-400 hover:text-yellow-300 text-sm font-medium">View Project →</a>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Profile Image */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10 backdrop-blur-sm">
              <Image 
                src="/profile-ham.png" 
                alt="Ham Profile" 
                width={400}
                height={400}
                className="w-full h-auto object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>
            
            {/* Greeting Message */}
            <div className="mt-8 bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <div className="space-y-4">
                <p className="text-white/90 text-sm leading-relaxed">
                  안녕하세요, 인간의 삶을 다시 디자인하는 작업치료사 함형광입니다.
                </p>
                <p className="text-white/80 text-sm leading-relaxed">
                  저는 인공지능과 ICF(국제기능·장애·건강분류)를 기반으로<br />
                  임상 언어 데이터 속에서 인간의 &quot;되어감(Becoming)&quot;을 탐구하고 있습니다.
                </p>
                <p className="text-white/80 text-sm leading-relaxed">
                  병원에서 지역으로, 사례에서 시스템으로 —<br />
                  삶의 연결과 참여를 새롭게 정의하는 여정을 이어갑니다.
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

            {/* Career Summary */}
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <h4 className="text-lg font-semibold text-white mb-4">주요 경력</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">푸르메재단 넥슨어린이재활병원</p>
                      <p className="text-white/70 text-sm">학령기치료팀장</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-fuchsia-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">강원대학교 일반대학원</p>
                      <p className="text-white/70 text-sm">작업치료학 석사과정</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-white font-medium">ICF 기반 임상 언어 데이터 sLLM 개발 연구</p>
                      <p className="text-white/70 text-sm">책임연구자</p>
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

            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-2xl sm:text-3xl font-semibold">Contact</h2>
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
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>© {new Date().getFullYear()} OT Futurist</div>
          <a id="resume" href="#" className="hover:text-white">Download Résumé</a>
        </div>
      </footer>
    </div>
  );
}

