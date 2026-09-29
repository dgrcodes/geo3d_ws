/* ============================================================
   GEO3D — journal de forage (le-projet.html)
   Modules : SmoothScroll / Scene3D / DepthHUD / Reveals
   ============================================================ */

// -------- INDEX --------
// 1. Smooth scroll (Lenis)      4. Render loop
// 2. Three.js background scene  5. Depth HUD
// 3. Scroll/camera state        6. Text split + 7. scroll reveals

(() => {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 900px)').matches;

  /* ---------- 1. SMOOTH SCROLL ----------
     Le smooth-scroll (Lenis) est désormais créé une seule fois dans
     merge-scroll.js, qui pilote toute la page (héros du cube + descente).
     Ce module se contente de lire le scroll via ScrollTrigger. */

  /* ---------- 2. SCÈNE THREE.JS ---------- */
  // -------- DATA --------
const PALETTE = {
  paperBg: 0xd3dada, // correspond à --paper (#d3dada)
  paperInk: 0x6b503d, // correspond à --ink (#6b503d)
  deepBg: 0x2d1b12,  // correspond à --deep (#2d1b12)
  deepInk: 0xd3dada, // correspond à --deep-ink (#d3dada)
};

  // -------- INITIALIZATION --------
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75)); // plafond DPR = perf
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.paperBg);
  scene.fog = new THREE.Fog(PALETTE.paperBg, 40, 160);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);

  // -- Terrain wireframe (écho du cube de la homepage) --
  // Bruit procédural léger : superposition de sinus, zéro dépendance.
  const noise = (x, z) =>
    Math.sin(x * 0.12) * 2.2 +
    Math.cos(z * 0.09) * 1.8 +
    Math.sin(x * 0.31 + z * 0.24) * 0.9;

  const terrainGeo = new THREE.PlaneGeometry(220, 220, 84, 84);
  terrainGeo.rotateX(-Math.PI / 2);
  {
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, noise(pos.getX(i), pos.getZ(i)));
    }
    terrainGeo.computeVertexNormals();
  }
  const terrainMat = new THREE.MeshBasicMaterial({
    color: PALETTE.paperInk, wireframe: true, transparent: true, opacity: 0.16,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  scene.add(terrain);

  /* -- Surface pleine : LA TEXTURE DE LA FACE DU CUBE (homepage) --
     Shader repris de cube-scene.js (FACE_VERTEX/FRAGMENT_SHADER) : fresnel sur
     les arêtes, lignes ondulantes animées, ombrage par bruit. Ici le relief
     vient de la géométrie du terrain (uNoiseAmp = 0, pas de déplacement en
     plus), le shader n'apporte que la « texture » de la face. Le système de
     ripples de la version cube est laissé inerte (aucune impulsion). */
  /* >>> RÉGLAGES DU MESH DU DESSUS <<< change ces 3 valeurs librement */
  const MESH_COLOR = '#556b2f';   // couleur principale de la surface
  const MESH_RIM_COLOR = '#556b2';   // accent d'arête + lignes ondulantes
  const MESH_OPACITY = 0.8;          // 0 = transparent, 1 = plein
  const faceTime = { value: 0 };     // uTime partagé, avancé dans tick()

  const FACE_VERTEX_SHADER = `
    uniform vec2 uUvOffset;
    uniform vec2 uUvScale;
    uniform float uNoiseAmp;
    uniform float uNoiseFreq;
    uniform vec3 uNoiseSeed;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;
    varying float vNoiseHeight;
    varying vec3 vWorldPos;

    float hash13(vec3 p3) {
      p3 = fract(p3 * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    float noise3(vec3 p) {
      vec3 i = floor(p); vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float n000 = hash13(i + vec3(0.0,0.0,0.0));
      float n100 = hash13(i + vec3(1.0,0.0,0.0));
      float n010 = hash13(i + vec3(0.0,1.0,0.0));
      float n110 = hash13(i + vec3(1.0,1.0,0.0));
      float n001 = hash13(i + vec3(0.0,0.0,1.0));
      float n101 = hash13(i + vec3(1.0,0.0,1.0));
      float n011 = hash13(i + vec3(0.0,1.0,1.0));
      float n111 = hash13(i + vec3(1.0,1.0,1.0));
      float nx00 = mix(n000,n100,f.x); float nx10 = mix(n010,n110,f.x);
      float nx01 = mix(n001,n101,f.x); float nx11 = mix(n011,n111,f.x);
      float nxy0 = mix(nx00,nx10,f.y); float nxy1 = mix(nx01,nx11,f.y);
      return mix(nxy0,nxy1,f.z) * 2.0 - 1.0;
    }
    float displacementAt(vec3 worldPos) {
      return noise3(worldPos * uNoiseFreq + uNoiseSeed) * uNoiseAmp;
    }
    void main() {
      vUv = uv * uUvScale + uUvOffset;
      vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      vWorldPos = worldPos;
      float rawNoise = noise3(worldPos * uNoiseFreq + uNoiseSeed);
      vNoiseHeight = rawNoise;
      vec3 displaced = position + normal * rawNoise * uNoiseAmp;
      vec3 worldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vec3 tangent = normalize((modelMatrix * vec4(1.0,0.0,0.0,0.0)).xyz);
      vec3 bitangent = normalize((modelMatrix * vec4(0.0,1.0,0.0,0.0)).xyz);
      float eps = 0.03;
      float dHu = (displacementAt(worldPos + tangent*eps) - displacementAt(worldPos - tangent*eps)) / (2.0*eps);
      float dHv = (displacementAt(worldPos + bitangent*eps) - displacementAt(worldPos - bitangent*eps)) / (2.0*eps);
      vec3 bumpedWorldNormal = normalize(worldNormal - dHu*tangent - dHv*bitangent);
      vNormal = normalize((viewMatrix * vec4(bumpedWorldNormal, 0.0)).xyz);
      vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const FACE_FRAGMENT_SHADER = `
    uniform vec3 uBaseColor;
    uniform vec3 uRimColor;
    uniform float uOpacity;
    uniform float uTime;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;
    varying float vNoiseHeight;
    void main() {
      vec3 viewDir = normalize(vViewPosition);
      vec3 n = normalize(vNormal);
      float fresnel = pow(1.0 - abs(dot(n, viewDir)), 2.2);
      float wave = sin(vUv.y * 200.0 + sin(vUv.x * 5.0 + uTime * 0.25) * 2.5 + uTime * 0.4);
      float lines = smoothstep(0.99, 1.0, abs(wave)) * 0.5;
      // La couleur de base DOMINE (fresnel réduit à un simple liseré
      // d'arête), pour que changer uBaseColor change vraiment le mesh.
      vec3 color = mix(uBaseColor, uRimColor, fresnel * 0.3);
      color += lines * uRimColor * 0.6;
      float heightShade = vNoiseHeight * 0.5 + 0.5;
      color = mix(color * 0.78, color * 1.12, heightShade); // clair/foncé, garde la teinte
      // Brouillard linéaire, aligné sur scene.fog (near/far), pour que le
      // lointain se fonde dans le fond comme le fil de fer et l'arrière-plan.
      float fogFactor = smoothstep(uFogNear, uFogFar, length(vViewPosition));
      color = mix(color, uFogColor, fogFactor);
      gl_FragColor = vec4(color, uOpacity);
    }
  `;

  const surfaceMat = new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Color(MESH_COLOR) },
      uRimColor: { value: new THREE.Color(MESH_RIM_COLOR) },
      uOpacity: { value: MESH_OPACITY },
      uTime: faceTime,
      uUvOffset: { value: new THREE.Vector2(0, 0) },
      uUvScale: { value: new THREE.Vector2(1, 1) },
      uNoiseAmp: { value: 0.0 },      // relief = géométrie du terrain, pas le shader
      uNoiseFreq: { value: 0.03 },    // fréquence basse = ombrage doux
      uNoiseSeed: { value: new THREE.Vector3(12.3, 45.6, 78.9) },
      uFogColor: { value: new THREE.Color(PALETTE.paperBg) },
      uFogNear: { value: 40.0 },      // = scene.fog.near
      uFogFar: { value: 160.0 }       // = scene.fog.far
    },
    vertexShader: FACE_VERTEX_SHADER,
    fragmentShader: FACE_FRAGMENT_SHADER,
    side: THREE.FrontSide,
    transparent: true,   // requis pour que uOpacity < 1 fasse effet
    depthWrite: false    // évite que la surface translucide masque le fil de fer/strates derrière
  });
  const surface = new THREE.Mesh(terrainGeo, surfaceMat);
  scene.add(surface);

  /* Hook exposé à merge-scroll.js : le canvas du terrain démarre invisible
     (opacity 0, cf. merge.css) et l'orchestrateur le fait apparaître pendant
     le fondu depuis le dessus du cube. */
  window.GEO3D = window.GEO3D || {};
  window.GEO3D.terrain = { scene, camera, renderer, canvas };

  // -- Strates fantômes : plans wireframe traversés pendant la descente --
  const strataMat = new THREE.MeshBasicMaterial({
    color: PALETTE.paperInk, wireframe: true, transparent: true, opacity: 0.06,
  });
  const strataDepths = [-40, -85, -135, -190, -245];
  strataDepths.forEach((y) => {
    const g = new THREE.PlaneGeometry(260, 260, 18, 18);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, strataMat);
    m.position.y = y;
    scene.add(m);
  });

  // -- Sédiments : colonne de particules autour du forage --
  const P_COUNT = isMobile ? 250 : 500;
  const pGeo = new THREE.BufferGeometry();
  const pArr = new Float32Array(P_COUNT * 3);
  for (let i = 0; i < P_COUNT; i++) {
    pArr[i * 3]     = (Math.random() - 0.5) * 110;   // x
    pArr[i * 3 + 1] = 15 - Math.random() * 300;      // y : de la surface au fond
    pArr[i * 3 + 2] = (Math.random() - 0.5) * 110;   // z
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
  const pMat = new THREE.PointsMaterial({
    color: PALETTE.paperInk, size: 0.5, transparent: true, opacity: 0.35,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* ---------- 3. ÉTAT DE SCROLL / CAMÉRA ---------- */
  const state = {
    progress: 0,       // 0 → 1 sur toute la page
    themeMix: 0,       // 0 = papier, 1 = profond
    mouseX: 0, mouseY: 0,
  };

  // La descente (profondeur) est mappée sur la section #projet, PAS sur toute
  // la page : le héros du cube (#hero) occupe le haut du scroll et se termine
  // pile quand #projet arrive en haut du viewport, donc progress = 0 à la
  // surface et 1 tout en bas.
  ScrollTrigger.create({
    trigger: '#projet',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => { state.progress = self.progress; },
  });

  // -------- EVENTS --------
  // Parallaxe souris — normalisée [-1, 1], lissée dans la boucle
  addEventListener('pointermove', (e) => {
    state.mouseX = (e.clientX / innerWidth) * 2 - 1;
    state.mouseY = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  // Inversion du thème dans la strate données
  const cBg = new THREE.Color(), cInk = new THREE.Color();
  const paperBg = new THREE.Color(PALETTE.paperBg), deepBg = new THREE.Color(PALETTE.deepBg);
  const paperInk = new THREE.Color(PALETTE.paperInk), deepInk = new THREE.Color(PALETTE.deepInk);

  ScrollTrigger.create({
    trigger: '#s-donnees',
    start: 'top 60%',
    end: 'bottom 40%',
    onEnter:     () => setTheme(1),
    onLeave:     () => setTheme(0),
    onEnterBack: () => setTheme(1),
    onLeaveBack: () => setTheme(0),
  });
  function setTheme(v) {
    document.body.classList.toggle('is-deep', v === 1);
    gsap.to(state, { themeMix: v, duration: 1.2, ease: 'power2.out', overwrite: true });
  }

  /* ---------- 4. BOUCLE DE RENDU ---------- */
  // -------- FUNCTIONS --------
  let smX = 0, smY = 0;
  const clock = new THREE.Clock();
  let running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden; // pause quand l'onglet est caché
    if (running) tick();
  });

  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    const t = clock.getElapsedTime();
    faceTime.value = t; // anime les lignes ondulantes de la texture de face

    // Descente : la caméra suit le scroll de +26 (au-dessus du terrain) à −265
    const camY = 26 - state.progress * 291;
    smX += (state.mouseX - smX) * 0.05;
    smY += (state.mouseY - smY) * 0.05;

    camera.position.set(smX * 3.5, camY + smY * -1.5, 48);
    camera.lookAt(0, camY - 10, 0);

    // Sédiments : dérive lente + attraction très légère vers le curseur
    particles.rotation.y = t * 0.02;
    particles.position.x += ((smX * 4) - particles.position.x) * 0.02;
    particles.position.z += ((smY * 3) - particles.position.z) * 0.02;

    // Lerp des couleurs de la scène selon le thème
    cBg.copy(paperBg).lerp(deepBg, state.themeMix);
    cInk.copy(paperInk).lerp(deepInk, state.themeMix);
    scene.background.copy(cBg);
    scene.fog.color.copy(cBg);
    surfaceMat.uniforms.uFogColor.value.copy(cBg); // même brouillard que la scène
    terrainMat.color.copy(cInk);
    strataMat.color.copy(cInk);
    pMat.color.copy(cInk);

    renderer.render(scene, camera);
  }
  tick();

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  /* ---------- 5. HUD DE PROFONDEUR ---------- */
  const depthValue = document.getElementById('depthValue');
  const depthFill = document.getElementById('depthFill');
  const MAX_DEPTH = 300;
  gsap.ticker.add(() => {
    const d = Math.round(state.progress * MAX_DEPTH);
    depthValue.textContent = d === 0 ? 'PROF. 0 M' : `PROF. −${d} M`;
    depthFill.style.height = (state.progress * 100).toFixed(1) + '%';
  });

  /* ---------- 6. SPLIT DE TEXTE MAISON ---------- */
  // Découpe en mots (.w, insécables) puis en caractères (.ch) — préserve
  // le retour à la ligne naturel, contrairement à un split naïf.
  function splitChars(el) {
    const frag = document.createDocumentFragment();
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent.split(/(\s+)/).forEach((token) => {
          if (!token) return;
          if (/^\s+$/.test(token)) { frag.append(' '); return; }
          const w = document.createElement('span');
          w.className = 'w';
          [...token].forEach((c) => {
            const s = document.createElement('span');
            s.className = 'ch';
            s.textContent = c;
            w.append(s);
          });
          frag.append(w);
        });
      } else {
        frag.append(node.cloneNode(true)); // conserve les <br>
      }
    });
    el.replaceChildren(frag);
    return el.querySelectorAll('.ch');
  }

  /* ---------- 7. REVEALS AU SCROLL ---------- */
  if (!reduceMotion) {
    // Titres : caractères qui montent
    document.querySelectorAll('.reveal').forEach((el) => {
      const chars = splitChars(el);
      gsap.from(chars, {
        yPercent: 115, rotate: 3, opacity: 0,
        duration: 1.1, ease: 'expo.out',
        stagger: { each: 0.018, from: 'start' },
        scrollTrigger: { trigger: el, start: 'top 82%' },
      });
    });

    // Blocs de texte : fondu discret
    gsap.utils.toArray('.lede, .target, .station, .datum, .tech').forEach((el) => {
      gsap.from(el, {
        y: 36, opacity: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
      });
    });

    // Tracés SVG qui se dessinent (scrub = liés à la profondeur)
    // Tracés SVG animés séquentiellement au scroll
    const paths = document.querySelectorAll('#s-objectifs .draw');
    if (paths.length > 0) {
      // 1. Initialiser le strokeDasharray / offset sur chaque tracé
      paths.forEach((path) => {
        const len = path.getTotalLength();
        gsap.set(path, {
          strokeDasharray: len,
          strokeDashoffset: len,
        });
      });

      // 2. Créer une Timeline reliée au scroll de la section
      const drawTl = gsap.timeline({
        scrollTrigger: {
          trigger: '#s-objectifs',
          start: 'top 40%',   // Début du dessin
          end: 'bottom 80%',  // Fin lorsque toutes les lignes sont tracées
          scrub: 0.8,         // Ajuste la réactivité au défilement
        },
      });

      // 3. Empiler le dessin de chaque ligne séquentiellement
      paths.forEach((path) => {
        drawTl.to(path, {
          strokeDashoffset: 0,
          ease: 'none',
        });
      });
    }

    // Compteurs de données
    document.querySelectorAll('.count').forEach((el) => {
      const to = +el.dataset.to;
      const obj = { v: 0 };
      gsap.to(obj, {
        v: to, duration: 2, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%' },
        onUpdate: () => {
          el.textContent = Math.round(obj.v).toLocaleString('fr-CA').replace(/ /g, ' ');
        },
      });
    });
  } else {
    // Reduced motion : tout visible, compteurs à leur valeur finale
    document.querySelectorAll('.count').forEach((el) => {
      el.textContent = (+el.dataset.to).toLocaleString('fr-CA');
    });
  }
})();
