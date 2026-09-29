/* =========================================================================
   LE LAB (jouer.html) — galerie de captures vidéo du jeu GEO3D.

   Le jeu Unity ne pouvant pas être hébergé sur le site, cette page présente
   des captures. Un lecteur principal + une liste de captures cliquables.

   ---------------------------------------------------------------------------
   >>> POUR AJOUTER / MODIFIER LES VIDÉOS : éditez le tableau CLIPS ci-dessous.
   Chaque capture accepte AU CHOIX :
     - src     : un fichier vidéo (ex: './assets/videos/forage.mp4')
     - youtube : un identifiant YouTube (ex: 'dQw4w9WgXcQ')
     - (aucun) : affiche un cadre « capture à venir » stylé.
   Champs optionnels : poster (image d'aperçu), duration ('1:24').
   ---------------------------------------------------------------------------
   ========================================================================= */

// -------- DATA : les captures --------
const CLIPS = [
  {
    title: 'Descente — première couche',
    tag: 'Extrait 01',
    duration: '1:24',
    desc: "Le forage démarre en surface : la sonde perce la couche de mousse et " +
          "révèle les premières strates de résidus. Prise en main et repères de profondeur.",
    // src: './assets/videos/forage-01.mp4',
    // youtube: 'XXXXXXXXXXX',
    // poster: './assets/videos/forage-01.jpg',
  },
  {
    title: 'Lecture des strates',
    tag: 'Extrait 02',
    duration: '2:05',
    desc: "Navigation dans le volume : chaque bande de sol répond différemment aux " +
          "méthodes géophysiques. On isole une strate et on la fait « parler ».",
  },
  {
    title: 'Anomalie détectée',
    tag: 'Extrait 03',
    duration: '1:47',
    desc: "Un contraste inattendu apparaît en profondeur. Zoom, mesure, comparaison " +
          "multi-méthodes — l'anomalie est cataloguée.",
  },
  {
    title: 'Remontée & synthèse',
    tag: 'Extrait 04',
    duration: '1:12',
    desc: "Retour vers la surface : le profil complet du forage se recompose en une " +
          "coupe lisible, prête à être partagée avec la collectivité.",
  },
];

// -------- FUNCTIONS --------
(function () {
  'use strict';

  const frame = document.getElementById('playerFrame');
  const elEyebrow = document.getElementById('playerEyebrow');
  const elTitle = document.getElementById('playerTitle');
  const elDesc = document.getElementById('playerDesc');
  const list = document.getElementById('clipList');
  if (!frame || !list) return;

  let activeIndex = -1;

  // Numéro à deux chiffres : 1 -> "01"
  const pad2 = (n) => String(n).padStart(2, '0');

  /* ---------- Lecteur principal ---------- */
  function renderPlayer(clip, autoplay) {
    frame.innerHTML = '';
    frame.classList.remove('is-empty');

    elEyebrow.textContent = clip.tag || '';
    elTitle.textContent = clip.title || '';
    elDesc.textContent = clip.desc || '';

    if (clip.youtube) {
      const iframe = document.createElement('iframe');
      const params = 'rel=0&modestbranding=1&playsinline=1' + (autoplay ? '&autoplay=1' : '');
      iframe.src = `https://www.youtube-nocookie.com/embed/${clip.youtube}?${params}`;
      iframe.title = clip.title || 'Capture GEO3D';
      iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      frame.appendChild(iframe);
      return;
    }

    if (clip.src) {
      const video = document.createElement('video');
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      if (clip.poster) video.poster = clip.poster;
      const source = document.createElement('source');
      source.src = clip.src;
      video.appendChild(source);
      frame.appendChild(video);
      if (autoplay) {
        // Le clic est un geste utilisateur : la lecture avec son est permise.
        const p = video.play();
        if (p && p.catch) p.catch(() => {}); // ignore si le navigateur refuse
      }
      return;
    }

    // Aucune source : cadre « à venir » stylé.
    frame.classList.add('is-empty');
    const glyph = document.createElement('div');
    glyph.className = 'glyph';
    const label = document.createElement('div');
    label.className = 'empty-label';
    label.textContent = 'capture à venir';
    frame.append(glyph, label);
  }

  /* ---------- Sélection d'une capture ---------- */
  function select(index, autoplay) {
    if (index === activeIndex) return;
    activeIndex = index;
    renderPlayer(CLIPS[index], autoplay);
    [...list.children].forEach((li, i) => {
      li.querySelector('.clip').classList.toggle('is-active', i === index);
    });
  }

  /* ---------- Construction de la liste ---------- */
  CLIPS.forEach((clip, i) => {
    const li = document.createElement('li');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'clip reveal-up';

    const num = document.createElement('span');
    num.className = 'clip-num';
    num.textContent = pad2(i + 1);

    const thumb = document.createElement('span');
    thumb.className = 'clip-thumb';
    if (clip.poster) {
      const img = document.createElement('img');
      img.src = clip.poster;
      img.alt = '';
      thumb.appendChild(img);
    } else {
      const play = document.createElement('span');
      play.className = 'mini-play';
      thumb.appendChild(play);
    }
    if (clip.duration) {
      const dur = document.createElement('span');
      dur.className = 'dur';
      dur.textContent = clip.duration;
      thumb.appendChild(dur);
    }

    const body = document.createElement('span');
    body.className = 'clip-body';
    const title = document.createElement('span');
    title.className = 'clip-title';
    title.textContent = clip.title || `Capture ${pad2(i + 1)}`;
    const tag = document.createElement('span');
    tag.className = 'clip-tag';
    tag.textContent = clip.tag || '';
    body.append(title, tag);

    btn.append(num, thumb, body);
    btn.addEventListener('click', () => select(i, true)); // clic = geste utilisateur -> autoplay
    li.appendChild(btn);
    list.appendChild(li);
  });

  // Sélection initiale (sans autoplay : pas de geste utilisateur au chargement).
  select(0, false);

  /* ---------- Reveal léger, en cascade ---------- */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealables = [...document.querySelectorAll('.reveal-up')];
  if (reduceMotion) {
    revealables.forEach((el) => el.classList.add('is-in'));
  } else {
    revealables.forEach((el, i) => {
      setTimeout(() => el.classList.add('is-in'), 80 + i * 70);
    });
  }
})();
