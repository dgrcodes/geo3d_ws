/* =========================================================================
   BG-DOTS -- standalone background dot grid for pages without the 3D cube
   (jouer.html). Same look as the homepage cube's background, without pulling
   in three.js. Texture/element creation is shared via dom-utils.js; this
   file only owns the independent mouse-parallax loop.
   ========================================================================= */
(function () {
    // -------- INITIALIZATION --------
    const bgDots = window.GEO3D.createDotGridBackground({ prepend: true });

    // -------- DATA --------
    const PARALLAX_STRENGTH = 18;
    const PARALLAX_EASE = 0.05;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    // -------- EVENTS --------
    window.addEventListener("mousemove", (e) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        targetX = -nx * PARALLAX_STRENGTH;
        targetY = -ny * PARALLAX_STRENGTH;
    });

    // -------- FUNCTIONS --------
    function tickDotParallax() {
        currentX += (targetX - currentX) * PARALLAX_EASE;
        currentY += (targetY - currentY) * PARALLAX_EASE;
        bgDots.style.transform = `translate3d(${currentX.toFixed(1)}px, ${currentY.toFixed(1)}px, 0)`;
        requestAnimationFrame(tickDotParallax);
    }
    requestAnimationFrame(tickDotParallax);
})();
