/**
 * PharmaLog – Motion Poster engine
 * - Scales the 1080×1920 canvas to any screen
 * - Runs a per-scene timeline: any element with data-at="ms" gets class "on"
 *   at that time; elements with data-type are typed out letter by letter
 * - Loops forever with a capsule wipe between scenes
 *
 * URL options:  ?scene=3  start at scene 3   ·  ?pause=1  start paused
 *               ?speed=2  play twice as fast  ·  ?controls=0  never show controls
 */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const SPEED = Math.max(0.1, parseFloat(params.get('speed')) || 1);
  const TYPE_CPS = 26;            // characters per second for typing
  const WIPE_MS = 1500;           // must match .wipe animation
  const WIPE_SWAP_AT = 0.5;       // swap scenes when the capsule covers the screen
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stage = document.getElementById('stage');
  const scenes = Array.from(stage.querySelectorAll('.scene'));
  const wipe = document.getElementById('wipe');
  const segWrap = document.getElementById('segments');
  const controls = document.getElementById('controls');
  const playBtn = document.getElementById('playBtn');

  /* ---------- Fit canvas to screen ---------- */
  function fit() {
    const s = Math.min(innerWidth / 1080, innerHeight / 1920);
    stage.style.setProperty('--s', s);
  }
  addEventListener('resize', fit);
  fit();

  /* ---------- Grapheme splitting (keeps Thai vowels/tones attached) ---------- */
  const seg = 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null;
  const graphemes = (t) => seg ? Array.from(seg.segment(t), (x) => x.segment) : Array.from(t);

  /* ---------- Prepare timelines ---------- */
  const timelines = scenes.map((sc) => {
    const items = Array.from(sc.querySelectorAll('[data-at]')).map((el) => {
      const item = { el, at: +el.dataset.at, done: false };
      if (el.hasAttribute('data-type')) {
        item.chars = graphemes(el.textContent.trim());
        item.shown = -1;
        el.textContent = '';
      }
      return item;
    });
    return { dur: +sc.dataset.dur || 8000, items };
  });

  /* ---------- Progress segments ---------- */
  const segFills = scenes.map(() => {
    const s = document.createElement('div');
    s.className = 'seg';
    const b = document.createElement('b');
    s.appendChild(b);
    segWrap.appendChild(s);
    return b;
  });

  /* ---------- Hero wave path (speech → line) ---------- */
  (function buildWave() {
    const path = document.getElementById('heroWave');
    if (!path) return;
    const x0 = 120, x1 = 800, y = 180, n = 22, step = (x1 - x0) / n;
    let d = `M${x0} ${y}`;
    for (let i = 0; i < n; i++) {
      const env = Math.sin(Math.PI * (i + 0.5) / n);
      const amp = (30 + 110 * env * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7)))) * (i % 2 ? -1 : 1);
      d += ` Q${(x0 + step * (i + 0.5)).toFixed(1)} ${(y - amp).toFixed(1)} ${(x0 + step * (i + 1)).toFixed(1)} ${y}`;
    }
    path.setAttribute('d', d);
  })();

  /* ---------- Floating background capsules ---------- */
  (function buildPills() {
    const wrap = document.getElementById('bgPills');
    const spots = [
      [80, 140, 120], [860, 300, 90], [930, 980, 150], [40, 760, 80], [760, 1500, 110],
      [120, 1380, 140], [520, 120, 70], [600, 1680, 80], [980, 1260, 70], [300, 1000, 60]
    ];
    spots.forEach(([x, y, w], i) => {
      const p = document.createElement('div');
      p.className = 'fp';
      p.innerHTML = '<i></i><i></i>';
      const r0 = (i * 47) % 180 - 90;
      Object.assign(p.style, {
        left: x + 'px', top: y + 'px', width: w + 'px', height: w * 0.42 + 'px',
        opacity: (0.1 + (i % 4) * 0.05).toFixed(2),
        filter: i % 3 === 0 ? 'blur(3px)' : 'none'
      });
      p.style.setProperty('--r0', r0 + 'deg');
      p.style.setProperty('--r1', (r0 + (i % 2 ? 40 : -40)) + 'deg');
      p.style.setProperty('--dx', ((i % 2 ? 1 : -1) * (30 + i * 6)) + 'px');
      p.style.setProperty('--dy', ((i % 3 ? -1 : 1) * (50 + i * 8)) + 'px');
      p.style.setProperty('--d', (12 + (i % 5) * 3) + 's');
      p.style.setProperty('--dl', (-i * 1.7) + 's');
      wrap.appendChild(p);
    });
  })();

  /* ---------- Outro burst particles ---------- */
  (function buildBurst() {
    const b = document.getElementById('burst');
    if (!b) return;
    const colors = ['var(--blue)', 'var(--amber)', 'var(--red)', 'var(--ink)'];
    for (let i = 0; i < 22; i++) {
      const p = document.createElement('div');
      p.className = 'bp';
      p.innerHTML = '<i></i><i></i>';
      const a = (i / 22) * Math.PI * 2 + (i % 2) * 0.15;
      const dist = 330 + (i % 4) * 90;
      const w = 54 + (i % 3) * 22;
      Object.assign(p.style, { width: w + 'px', height: w * 0.42 + 'px' });
      p.style.setProperty('--tx', Math.cos(a) * dist + 'px');
      p.style.setProperty('--ty', Math.sin(a) * dist * 1.25 + 'px');
      p.style.setProperty('--rot', (i * 77 % 720 - 360) + 'deg');
      p.style.setProperty('--bd', (i % 5) * 0.04 + 's');
      p.style.setProperty('--c', colors[i % colors.length]);
      b.appendChild(p);
    }
  })();

  /* ---------- Ticker: duplicate content for a seamless loop ---------- */
  (function buildTicker() {
    const t = document.getElementById('tickerTrack');
    const html = t.innerHTML;
    t.innerHTML = html + html;
    requestAnimationFrame(() => {
      const half = t.scrollWidth / 2;
      t.style.setProperty('--tw', -half + 'px');
      t.style.animationDuration = (half / 110) + 's';
    });
  })();

  /* ---------- State ---------- */
  let current = -1;
  let elapsed = 0;
  let playing = params.get('pause') !== '1';
  let last = performance.now();
  let wiping = false;

  function resetScene(i) {
    timelines[i].items.forEach((it) => {
      it.done = false;
      it.el.classList.remove('on');
      if (it.chars) { it.shown = -1; it.el.textContent = ''; }
    });
  }

  function showScene(i) {
    if (current >= 0) scenes[current].classList.remove('active');
    current = (i + scenes.length) % scenes.length;
    resetScene(current);
    // force style flush so re-entering animations restart
    void scenes[current].offsetWidth;
    scenes[current].classList.add('active');
    stage.dataset.scene = current;
    elapsed = 0;
    segFills.forEach((f, k) => { f.style.width = k < current ? '100%' : '0%'; });
    applyTimeline(reduceMotion ? 1e9 : 0);
  }

  /* Wipe is driven frame by frame so the scene swap always happens
     while the capsule fully covers the screen (no flashes). */
  let wipeStart = 0, wipeTarget = 0, swapped = false;
  const easeIO = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function wipeY(p) {
    if (p < .4) return 3400 - (3400 - 180) * easeIO(p / .4);
    if (p < .6) return 180 - 360 * ((p - .4) / .2);
    return -180 - (3400 - 180) * easeIO((p - .6) / .4);
  }
  function setWipe(y) { wipe.style.transform = `translate(-50%, calc(-50% + ${y}px)) rotate(-18deg)`; }
  setWipe(3400);

  function goTo(i) {
    if (wiping) return;
    if (reduceMotion) { showScene(i); return; }
    wiping = true; swapped = false;
    wipeTarget = i;
    wipeStart = performance.now();
    scenes[current].classList.add('leaving');
  }

  function stepWipe(now) {
    const p = Math.min(1, (now - wipeStart) / WIPE_MS);
    setWipe(wipeY(p));
    if (!swapped && p >= .5) {
      swapped = true;
      scenes.forEach((s) => s.classList.remove('leaving'));
      showScene(wipeTarget);
      mascotJump();
    }
    if (p >= 1) { wiping = false; setWipe(3400); }
  }

  function applyTimeline(t) {
    const tl = timelines[current];
    tl.items.forEach((it) => {
      if (t < it.at) return;
      if (!it.done) {
        it.done = true;
        it.el.classList.add('on');
        if (it.el.classList.contains('stamp')) {
          const card = it.el.closest('.logcard');
          setTimeout(() => {
            card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
          }, 380);
        }
      }
      if (it.chars) {
        const n = Math.min(it.chars.length, Math.floor((t - it.at) / 1000 * TYPE_CPS) + 1);
        if (n !== it.shown) {
          it.shown = n;
          it.el.textContent = it.chars.slice(0, n).join('');
        }
      }
    });
  }

  function tick(now) {
    const dt = Math.min(100, now - last) * SPEED;
    last = now;
    if (wiping) stepWipe(now);
    else if (playing) {
      elapsed += dt;
      const tl = timelines[current];
      applyTimeline(elapsed);
      segFills[current].style.width = Math.min(100, elapsed / tl.dur * 100) + '%';
      if (elapsed >= tl.dur) goTo(current + 1);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- Controls ---------- */
  function setPlaying(v) {
    playing = v;
    stage.classList.toggle('paused', !playing);
    playBtn.textContent = playing ? '❚❚' : '▶';
  }
  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }

  controls.addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'prev') goTo(current - 1);
    if (act === 'next') goTo(current + 1);
    if (act === 'play') setPlaying(!playing);
    if (act === 'full') toggleFullscreen();
  });

  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
    else if (e.code === 'KeyF') toggleFullscreen();
    else if (e.code === 'ArrowRight') goTo(current + 1);
    else if (e.code === 'ArrowLeft') goTo(current - 1);
  });

  // Show controls on mouse move / tap, hide cursor + controls when idle
  let idleTimer;
  const allowControls = params.get('controls') !== '0';
  function wake() {
    document.body.classList.remove('idle');
    if (allowControls) controls.classList.add('show');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      document.body.classList.add('idle');
      controls.classList.remove('show');
    }, 2500);
  }
  addEventListener('pointermove', wake);
  addEventListener('pointerdown', wake);
  document.body.classList.add('idle');

  /* ---------- Keep the screen awake (signage) ---------- */
  let lock = null;
  async function keepAwake() {
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch (_) {}
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
  keepAwake();

  /* ---------- Mascot: jump between scenes, eyes follow the pointer ---------- */
  const mascot = document.getElementById('mascot');
  const pupils = document.getElementById('mPupils');
  function mascotJump() {
    if (!mascot) return;
    mascot.classList.remove('jump', 'happy'); void mascot.offsetWidth;
    mascot.classList.add('jump', 'happy');
    setTimeout(() => mascot.classList.remove('happy'), 2200);
  }
  function stagePoint(e) {
    const r = stage.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * 1080, y: (e.clientY - r.top) / r.height * 1920 };
  }
  addEventListener('pointermove', (e) => {
    const pt = stagePoint(e);
    stage.style.setProperty('--px', (pt.x / 1080 - .5).toFixed(3));
    stage.style.setProperty('--py', (pt.y / 1920 - .5).toFixed(3));
    if (!pupils) return;
    const m = mascot.getBoundingClientRect(), r = stage.getBoundingClientRect();
    const mx = (m.left + m.width / 2 - r.left) / r.width * 1080, my = (m.top + m.height * .35 - r.top) / r.height * 1920;
    const a = Math.atan2(pt.y - my, pt.x - mx);
    pupils.style.transform = `translate(${(Math.cos(a) * 6).toFixed(1)}px, ${(Math.sin(a) * 7).toFixed(1)}px)`;
  });

  /* ---------- Tap anywhere: pill confetti ---------- */
  const taps = document.getElementById('taps');
  const tapColors = ['#1E88E5', '#F2A900', '#E5484D', '#0B2545', '#5BB0FF'];
  stage.addEventListener('pointerdown', (e) => {
    if (reduceMotion) return;
    const pt = stagePoint(e);
    for (let k = 0; k < 12; k++) {
      const d = document.createElement('div');
      d.className = 'tp';
      d.innerHTML = '<i></i><i></i>';
      const a = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 180, w = 40 + Math.random() * 34;
      Object.assign(d.style, { left: pt.x + 'px', top: pt.y + 'px', width: w + 'px', height: w * .42 + 'px' });
      d.style.setProperty('--c', tapColors[k % tapColors.length]);
      d.style.setProperty('--tx', Math.cos(a) * dist + 'px');
      d.style.setProperty('--ty', Math.sin(a) * dist + 'px');
      d.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      taps.appendChild(d);
      setTimeout(() => d.remove(), 950);
    }
    if (mascot && !mascot.classList.contains('jump')) mascotJump();
    setTimeout(() => mascot && mascot.classList.remove('jump'), 950);
  });
  if (mascot) mascot.addEventListener('animationend', (e) => { if (e.animationName === 'mJump') mascot.classList.remove('jump'); });

  /* ---------- Rising bubbles ---------- */
  (function buildBubbles() {
    const wrap = document.getElementById('bgPills');
    for (let k = 0; k < 9; k++) {
      const b = document.createElement('div');
      b.className = 'bub';
      const s = 24 + (k * 37) % 60;
      Object.assign(b.style, { left: (60 + (k * 131) % 960) + 'px', width: s + 'px', height: s + 'px' });
      b.style.setProperty('--d', (14 + (k % 4) * 4) + 's');
      b.style.setProperty('--dl', (-k * 2.3) + 's');
      b.style.setProperty('--sway', ((k % 2 ? 1 : -1) * (30 + k * 6)) + 'px');
      wrap.appendChild(b);
    }
  })();

  /* ---------- Start ---------- */
  showScene((parseInt(params.get('scene'), 10) || 1) - 1);
  setPlaying(playing);
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(tick); });

  window.PharmaLog = {
    goTo: (n) => showScene(n),
    seek: (ms) => { elapsed = ms; applyTimeline(ms); },
    play: () => setPlaying(true),
    pause: () => setPlaying(false)
  };
})();
