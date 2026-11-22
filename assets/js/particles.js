/* =============================================================
   Konvex — interactive particle field
   - Single requestAnimationFrame loop, no per-frame allocations
   - Depth layers (size / opacity / speed / parallax strength)
   - Desktop: pointer parallax + gentle local repulsion
   - Mobile: touch parallax + scroll drift
   - Pauses when the tab is hidden, honours prefers-reduced-motion
   ============================================================= */

(function () {
  'use strict';

  var canvas = document.getElementById('particles');
  if (!canvas || !canvas.getContext) { return; }
  var ctx = canvas.getContext('2d');
  if (!ctx) { return; }

  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Palette: light Konvex green, very light blue, neutral white. */
  var COLORS = ['149, 214, 158', '162, 201, 235', '238, 243, 246'];
  var COLOR_WEIGHTS = [0.44, 0.36, 0.2];

  var MAX_DPR = 2;
  var MIN_COUNT = 38;
  var MAX_COUNT = 105;
  var AREA_PER_PARTICLE = 14500;

  var PARALLAX_X = 30;   /* px of horizontal drift at full depth */
  var PARALLAX_Y = 22;   /* px of vertical drift at full depth */
  var CURSOR_RADIUS = 130;
  var CURSOR_PUSH = 22;
  var WRAP_MARGIN = 36;

  var width = 0;
  var height = 0;
  var dpr = 1;
  var particles = [];
  var sprites = [];
  var rafId = null;
  var lastTime = 0;
  var running = false;
  var resizeQueued = false;

  var pointer = {
    tx: 0, ty: 0,               /* target, normalised -1..1 */
    x: 0, y: 0,                 /* eased values (inertia) */
    cx: -9999, cy: -9999,       /* raw client coordinates */
    active: false
  };

  var scrollTarget = 0;
  var scrollEased = 0;

  /* ---------- Sprite generation (once) ---------- */

  function buildSprites() {
    sprites = [];
    for (var i = 0; i < COLORS.length; i++) {
      var size = 64;
      var c = document.createElement('canvas');
      c.width = c.height = size;
      var g = c.getContext('2d');
      var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(' + COLORS[i] + ', 1)');
      grad.addColorStop(0.2, 'rgba(' + COLORS[i] + ', 0.75)');
      grad.addColorStop(0.5, 'rgba(' + COLORS[i] + ', 0.18)');
      grad.addColorStop(1, 'rgba(' + COLORS[i] + ', 0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      sprites.push(c);
    }
  }

  function pickColor() {
    var r = Math.random();
    var acc = 0;
    for (var i = 0; i < COLOR_WEIGHTS.length; i++) {
      acc += COLOR_WEIGHTS[i];
      if (r <= acc) { return i; }
    }
    return 0;
  }

  /* ---------- Particle field ---------- */

  function seed() {
    var count = Math.round((width * height) / AREA_PER_PARTICLE);
    if (count < MIN_COUNT) { count = MIN_COUNT; }
    if (count > MAX_COUNT) { count = MAX_COUNT; }
    /* Slightly lighter load on touch devices. */
    if (window.matchMedia('(pointer: coarse)').matches) {
      count = Math.round(count * 0.72);
    }

    particles = new Array(count);
    for (var i = 0; i < count; i++) {
      /* Depth 0 (far) → 1 (near), biased towards the far layers. */
      var depth = Math.pow(Math.random(), 1.55);
      particles[i] = {
        x: Math.random() * width,
        y: Math.random() * height,
        depth: depth,
        size: 1.5 + depth * 4 + Math.random() * 0.7,
        alpha: 0.13 + depth * 0.38 + Math.random() * 0.1,
        vx: (Math.random() - 0.5) * (0.09 + depth * 0.22),
        vy: (Math.random() - 0.5) * (0.09 + depth * 0.22),
        sprite: pickColor(),
        rx: 0,
        ry: 0
      };
    }
  }

  function drawParticle(p, x, y) {
    var r = p.size * 2.6;
    ctx.globalAlpha = p.alpha > 1 ? 1 : p.alpha;
    ctx.drawImage(sprites[p.sprite], x - r, y - r, r * 2, r * 2);
  }

  /* ---------- Frame ---------- */

  function frame(now) {
    rafId = null;
    if (!running) { return; }

    var dt = lastTime ? Math.min((now - lastTime) / 16.667, 3) : 1;
    lastTime = now;

    /* Inertial easing of pointer + scroll → smooth, fluid response. */
    pointer.x += (pointer.tx - pointer.x) * Math.min(0.055 * dt, 1);
    pointer.y += (pointer.ty - pointer.y) * Math.min(0.055 * dt, 1);
    scrollEased += (scrollTarget - scrollEased) * Math.min(0.07 * dt, 1);

    ctx.clearRect(0, 0, width, height);

    var hasCursor = pointer.active && pointer.cx > -999;

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < -WRAP_MARGIN) { p.x = width + WRAP_MARGIN; }
      else if (p.x > width + WRAP_MARGIN) { p.x = -WRAP_MARGIN; }
      if (p.y < -WRAP_MARGIN) { p.y = height + WRAP_MARGIN; }
      else if (p.y > height + WRAP_MARGIN) { p.y = -WRAP_MARGIN; }

      var par = 0.3 + p.depth;
      var ox = -pointer.x * par * PARALLAX_X;
      var oy = -pointer.y * par * PARALLAX_Y - scrollEased * (0.35 + p.depth * 0.9);

      /* Gentle repulsion: particles drift away from the cursor. */
      var tx = 0;
      var ty = 0;
      if (hasCursor) {
        var dx = p.x + ox - pointer.cx;
        var dy = p.y + oy - pointer.cy;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CURSOR_RADIUS && dist > 0.001) {
          var f = 1 - dist / CURSOR_RADIUS;
          f = f * f * CURSOR_PUSH;
          tx = (dx / dist) * f;
          ty = (dy / dist) * f;
        }
      }
      p.rx += (tx - p.rx) * Math.min(0.08 * dt, 1);
      p.ry += (ty - p.ry) * Math.min(0.08 * dt, 1);

      drawParticle(p, p.x + ox + p.rx, p.y + oy + p.ry);
    }

    ctx.globalAlpha = 1;
    rafId = window.requestAnimationFrame(frame);
  }

  function drawStatic() {
    ctx.clearRect(0, 0, width, height);
    for (var i = 0; i < particles.length; i++) {
      drawParticle(particles[i], particles[i].x, particles[i].y);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Lifecycle ---------- */

  function start() {
    if (running || reduceQuery.matches || document.hidden) { return; }
    running = true;
    lastTime = 0;
    rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function applyMotionPreference() {
    if (reduceQuery.matches) {
      stop();
      drawStatic();
    } else {
      start();
    }
  }

  /* ---------- Sizing ---------- */

  function resize() {
    var w = canvas.clientWidth || window.innerWidth;
    var h = canvas.clientHeight || window.innerHeight;
    if (!w || !h) { return; }

    var widthChanged = w !== width;
    var bigHeightChange = height !== 0 && Math.abs(h - height) > 140;

    width = w;
    height = h;
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!particles.length || widthChanged || bigHeightChange) {
      seed();
    }
    if (!running) {
      drawStatic();
    }
  }

  function onResize() {
    if (resizeQueued) { return; }
    resizeQueued = true;
    window.requestAnimationFrame(function () {
      resizeQueued = false;
      resize();
    });
  }

  /* ---------- Input (passive listeners only) ---------- */

  function onPointerMove(e) {
    if (!width || !height) { return; }
    pointer.cx = e.clientX;
    pointer.cy = e.clientY;
    pointer.active = true;
    var nx = (e.clientX / width) * 2 - 1;
    var ny = (e.clientY / height) * 2 - 1;
    pointer.tx = nx < -1 ? -1 : (nx > 1 ? 1 : nx);
    pointer.ty = ny < -1 ? -1 : (ny > 1 ? 1 : ny);
  }

  function onPointerLeave() {
    pointer.active = false;
  }

  function onPointerEnd(e) {
    /* Touch: let the field ease gently back to rest. */
    if (e.pointerType === 'touch') {
      pointer.active = false;
      pointer.tx = 0;
      pointer.ty = 0;
    }
  }

  function onScroll() {
    scrollTarget = window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  /* ---------- Init ---------- */

  buildSprites();
  resize();
  onScroll();
  applyMotionPreference();

  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerEnd, { passive: true });
  window.addEventListener('pointercancel', onPointerEnd, { passive: true });
  document.addEventListener('pointerleave', onPointerLeave, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stop();
    } else {
      applyMotionPreference();
    }
  });

  if (reduceQuery.addEventListener) {
    reduceQuery.addEventListener('change', applyMotionPreference);
  } else if (reduceQuery.addListener) {
    reduceQuery.addListener(applyMotionPreference);
  }
})();
