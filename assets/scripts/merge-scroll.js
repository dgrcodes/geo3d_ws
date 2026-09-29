/* ============================================================
   GEO3D — orchestrateur de la page unique (cube + « sous la surface »)

   Rôle : coudre les deux scènes Three.js indépendantes en UNE seule page.

   Le haut de la page est le cube. Cliquer sur « découvrir le projet » (label
   de nav du cube) déclenche UNE animation automatique — « la plongée » :
     1. La caméra du cube descend sur son dessus vert jusqu'à ce qu'il remplisse
        tout l'écran (cube-scene.js, pose CONFIG.cube.scrollZoom).
     2. La « chrome » du cube (labels de nav, grille de points, curseur) s'efface.
     3. Le canvas du cube se fond en sortie pendant que le terrain (le-projet.js)
        se fond en entrée — même vert, même shader ondulé : le dessus « devient »
        le terrain.
   Pendant la plongée, le scroll est verrouillé. À la fin, on arrive à la
   surface (« SOUS LA SURFACE ») et le scroll reprend pour dérouler les strates.
   « retour à la surface » (HUD) rejoue la plongée à l'envers.

   Ce fichier possède l'UNIQUE instance de Lenis. Il doit être chargé APRÈS
   cube-scene.js et le-projet.js (window.GEO3D.cube / window.GEO3D.terrain).
   ============================================================ */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cube = (window.GEO3D && window.GEO3D.cube) || null;
  const terrain = (window.GEO3D && window.GEO3D.terrain) || null;
  const sceneCanvas = terrain && terrain.canvas;

  gsap.registerPlugin(ScrollTrigger);

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  /* ---------- Smooth-scroll unique pour toute la page ---------- */
  let lenis = null;
  if (typeof Lenis !== 'undefined' && !reduceMotion) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- La plongée : cube -> terrain ----------
     progress 0 = cube complet (surface) ; 1 = terrain plein écran.
     Découplé en deux temps pour que le vert remplisse TOTALEMENT l'écran
     AVANT le fondu croisé (sinon la silhouette du cube transparaît). */
  const ZOOM_END = 0.6;     // le zoom est terminé à 60 % de la plongée
  const CROSS_START = 0.6;  // le fondu croisé commence quand le vert remplit
  const CROSS_LEN = 0.4;    // longueur du fondu croisé
  const CHROME_LEN = 0.3;   // la chrome disparaît sur les 30 premiers %

  function applyHandoff(p) {
    if (cube) {
      cube.setScrollZoom(clamp01(p / ZOOM_END));
      // À p ~ 0 on laisse l'intro du cube (barre de chargement + fondu) piloter
      // l'opacité de la chrome ; dès que la plongée démarre, on la prend en main.
      if (p > 0.001) cube.setChromeOpacity(1 - clamp01(p / CHROME_LEN));
      cube.canvas.style.opacity = String(1 - clamp01((p - CROSS_START) / CROSS_LEN));
    }
    if (sceneCanvas) {
      sceneCanvas.style.opacity = String(clamp01((p - CROSS_START) / CROSS_LEN));
    }
    // HUD de profondeur + « retour à la surface » : mode « sous la surface »
    // dès que le fondu est engagé.
    document.body.classList.toggle('past-surface', p > CROSS_START);
  }

  /* ---------- Verrouillage du scroll pendant le cube / la plongée ---------- */
  function lockScroll() {
    document.body.classList.add('pre-dive');
    if (lenis) lenis.stop();
  }
  function unlockScroll() {
    document.body.classList.remove('pre-dive');
    if (lenis) lenis.start();
  }

  // État initial : cube plein écran, terrain caché, scroll verrouillé en haut.
  applyHandoff(0);
  lockScroll();

  /* ---------- Timeline de la plongée ---------- */
  let dived = false;
  const driver = { p: 0 };
  const dive = gsap.timeline({
    paused: true,
    onStart: () => { if (lenis) lenis.stop(); },
    onUpdate: () => applyHandoff(driver.p),
    onComplete: () => {
      dived = true;
      unlockScroll();
      // On est en haut (#projet), à la surface. Le scroll déroule la descente.
      ScrollTrigger.refresh();
    },
    onReverseComplete: () => {
      dived = false;
      applyHandoff(0);
      lockScroll();
    },
  });
  dive.to(driver, { p: 1, duration: 2.4, ease: 'power2.inOut' });

  function goDeep() {
    if (dived || dive.isActive()) return;
    if (reduceMotion) {
      // Mouvement réduit : pas d'animation, on bascule directement.
      driver.p = 1;
      applyHandoff(1);
      dived = true;
      unlockScroll();
      ScrollTrigger.refresh();
      return;
    }
    dive.play();
  }

  function goSurface() {
    if (!dived || dive.isActive()) return;
    // Revenir en haut (surface, terrain progress 0) avant de rejouer à l'envers.
    if (lenis) lenis.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0);
    document.body.classList.add('pre-dive'); // reverrouille pendant la remontée
    if (reduceMotion) {
      driver.p = 0;
      applyHandoff(0);
      dived = false;
      return;
    }
    dive.reverse();
  }

  /* ---------- Déclencheurs ---------- */
  // « découvrir le projet » (label de nav du cube) -> plonger.
  document.querySelectorAll('a[href="#projet"]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); goDeep(); });
  });
  // « retour à la surface » (HUD) -> remonter au cube.
  document.querySelectorAll('a[data-to-top]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); goSurface(); });
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
