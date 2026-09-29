/* =========================================================================
   DOM-UTILS -- small shared helpers used by every page's script, so this
   logic exists in exactly one place instead of being copy-pasted per page.
   Loaded before any page script that calls into window.GEO3D.
   ========================================================================= */

// -------- INDEX --------
// window.GEO3D.getCSSColor(varName, fallback)
// window.GEO3D.createDotGridBackground(options) -> the inserted .bg-dots element

window.GEO3D = window.GEO3D || {};

// -------- FUNCTIONS --------

// Reads a CSS custom property off :root, with a fallback if it's unset.
window.GEO3D.getCSSColor = function getCSSColor(varName, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value || fallback;
};

// Builds the randomized-opacity dot-grid texture (same look on every page:
// homepage cube, données explorer, jouer) and inserts the .bg-dots element
// that carries it (positioning/animation lives in CSS). Returns the element
// so the caller can drive its parallax transform however that page needs.
window.GEO3D.createDotGridBackground = function createDotGridBackground(options) {
    const opts = Object.assign({
        size: 1.5,
        spacing: 48,
        opacityMin: 0.12,
        opacityMax: 0.45,
        cellsPerTile: 6,
        colorVar: "--bg-dot-color",
        colorFallback: "#3d2b1f",
        prepend: false
    }, options || {});

    const color = window.GEO3D.getCSSColor(opts.colorVar, opts.colorFallback);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const tileSizePx = opts.spacing * opts.cellsPerTile;

    const tileCanvas = document.createElement("canvas");
    tileCanvas.width = tileSizePx * dpr;
    tileCanvas.height = tileSizePx * dpr;
    const ctx = tileCanvas.getContext("2d");
    ctx.fillStyle = color;

    for (let row = 0; row < opts.cellsPerTile; row++) {
        for (let col = 0; col < opts.cellsPerTile; col++) {
            const cx = (col + 0.5) * opts.spacing * dpr;
            const cy = (row + 0.5) * opts.spacing * dpr;
            ctx.globalAlpha = opts.opacityMin + Math.random() * (opts.opacityMax - opts.opacityMin);
            ctx.beginPath();
            ctx.arc(cx, cy, opts.size * dpr, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const bgDots = document.createElement("div");
    bgDots.className = "bg-dots";
    bgDots.style.backgroundImage = `url(${tileCanvas.toDataURL()})`;
    bgDots.style.backgroundSize = `${tileSizePx}px ${tileSizePx}px`;

    if (opts.prepend) {
        document.body.insertBefore(bgDots, document.body.firstChild);
    } else {
        document.body.appendChild(bgDots);
    }
    return bgDots;
};
