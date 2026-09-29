/* ==============================================================
   JOUER -- Unity WebGL loader.
   Remplacer "Build" par le dossier exporté par Unity (Build Settings ->
   WebGL -> Build) et "GameName" par le nom donné au build. Unity génère
   GameName.loader.js, GameName.data, GameName.framework.js et
   GameName.wasm -- les 4 fichiers doivent être présents à côté.
   ============================================================== */

// -------- DATA --------
const unityBuildFolder = "./assets/unity-build/Build";
const unityGameName = "GameName";

// -------- INITIALIZATION --------
const unityCanvas = document.querySelector("#unity-canvas");
const unityLoadingBar = document.querySelector("#unity-loading-bar");
const unityProgressBarFull = document.querySelector("#unity-progress-bar-full");
const unityWarningBanner = document.querySelector("#unity-warning");

const unityConfig = {
    dataUrl: `${unityBuildFolder}/${unityGameName}.data`,
    frameworkUrl: `${unityBuildFolder}/${unityGameName}.framework.js`,
    codeUrl: `${unityBuildFolder}/${unityGameName}.wasm`,
    streamingAssetsUrl: "StreamingAssets",
    companyName: "GEO3D",
    productName: unityGameName,
    productVersion: "1.0",
    showBanner: unityShowBanner,
};

// -------- FUNCTIONS --------
function unityShowBanner(msg, type) {
    const div = document.createElement("div");
    div.className = type === "error" ? "unity-warning-error" : "unity-warning-info";
    div.innerHTML = msg;
    unityWarningBanner.appendChild(div);
    if (type !== "error") {
        setTimeout(() => { unityWarningBanner.removeChild(div); }, 5000);
    }
}

// -------- EVENTS --------
const loaderScript = document.createElement("script");
loaderScript.src = `${unityBuildFolder}/${unityGameName}.loader.js`;
loaderScript.onload = () => {
    unityLoadingBar.style.display = "block";
    createUnityInstance(unityCanvas, unityConfig, (progress) => {
        unityProgressBarFull.style.width = `${100 * progress}%`;
    })
        .then((unityInstance) => {
            unityLoadingBar.style.display = "none";
        })
        .catch((message) => {
            unityShowBanner(message, "error");
        });
};
loaderScript.onerror = () => {
    unityShowBanner(
        "Build Unity introuvable -- déposez l'export WebGL dans assets/unity-build/Build/.",
        "error"
    );
};
document.body.appendChild(loaderScript);
