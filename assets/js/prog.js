(function () {
  'use strict';
  var d = document, de = d.documentElement, page = d.querySelector('[data-pg]');
  if (!page || !window.requestAnimationFrame || !window.IntersectionObserver) { de.classList.remove('pg-js'); return; }
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wide = matchMedia('(min-width: 900px)'), fine = matchMedia('(hover: hover) and (pointer: fine)');
  function onMq(mq, fn) { if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn); }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function out(t) { return 1 - Math.pow(1 - t, 3); }
  function sstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function rng(seed) { return function () { seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hex(v) { v = v.trim().replace('#', ''); if (v.length === 3) v = v.replace(/./g, '$&$&'); var n = parseInt(v, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  var col = {};
  function tokens() {
    var s = getComputedStyle(page);
    col.ink = hex(s.getPropertyValue('--ink') || '#0b0b0b'); col.red = hex(s.getPropertyValue('--s4-red') || '#e31a31');
    col.k = col.ink[0] > 128 ? .96 : .88;
  }
  function fit(cv, w, h) {
    var pr = Math.min(2, devicePixelRatio || 1), x = cv.getContext('2d');
    cv.width = Math.round(w * pr); cv.height = Math.round(h * pr); cv.style.height = h + 'px';
    x.setTransform(pr, 0, 0, pr, 0, 0); return x;
  }
  function dot(x, px, py, s, a, r) {
    if (a < .012) return;
    var i = col.ink, e = col.red;
    x.fillStyle = 'rgba(' + Math.round(i[0] + (e[0] - i[0]) * r) + ',' + Math.round(i[1] + (e[1] - i[1]) * r) + ',' + Math.round(i[2] + (e[2] - i[2]) * r) + ',' + (a * col.k).toFixed(3) + ')';
    x.fillRect(px - s / 2, py - s / 2, s, s);
  }
  tokens();

  var redrawHero = function () {};
  (function () {
    var box = page.querySelector('[data-pg-signal]'); if (!box) return;
    var cv = d.createElement('canvas'); box.appendChild(cv);
    var x, W = 0, H = 0, noise = [], sig = [], vis = false, raf = 0, t00 = performance.now(), start = 0;
    var ptr = { x: 0, y: 0, on: false, f: 0 };
    function build() {
      var r = box.getBoundingClientRect(); W = r.width; H = r.height; if (W < 20 || H < 20) return;
      x = fit(cv, W, H);
      var R = rng(7), b = clamp(W / 190, 2.2, 3.4), cell = clamp(Math.sqrt(W * H / 250), 20, 40), cols = Math.ceil(W / cell), rows = Math.ceil(H / cell), i, j, k, u;
      noise = []; sig = [];
      for (j = 0; j < rows; j++) for (i = 0; i < cols; i++)
        noise.push({ x: (i + .12 + R() * .76) * cell, y: (j + .12 + R() * .76) * cell, s: b * (.7 + R() * .7), a: .13 + R() * .22, p: R() * 6.2832, q: R() * 6.2832, w: .25 + R() * .4, m: 2 + R() * 4 });
      var n = Math.round(clamp(W / 11, 24, 56));
      for (k = 0; k < n; k++) {
        u = k / (n - 1);
        sig.push({ x0: R() * W, y0: R() * H, x1: W * (.05 + .9 * u), y1: H * (.56 - .12 * u) + Math.sin(u * 6.2832 * 1.15 + .4) * H * .17, u: u, s: b, a: .16 + R() * .16, p: R() * 6.2832, q: R() * 6.2832, w: .25 + R() * .4, m: 2 + R() * 4 });
      }
      paint(performance.now());
    }
    function edge(px, py) { return Math.min(sstep(0, 56, px), sstep(0, 40, W - px), sstep(0, 30, py), sstep(0, 30, H - py)); }
    function push(px, py, k) {
      if (ptr.f < .01) return [px, py];
      var dx = px - ptr.x, dy = py - ptr.y, q = Math.sqrt(dx * dx + dy * dy) || 1; if (q > 110) return [px, py];
      var f = (1 - q / 110); f = f * f * k * ptr.f; return [px + dx / q * f, py + dy / q * f];
    }
    function paint(now) {
      if (!x) return;
      var T = calm ? 0 : (now - t00) / 1000, sp = calm ? 1 : start ? clamp((now - start) / 2600, 0, 1) : 0, i, n, q, ti, px, py;
      ptr.f += ((ptr.on ? 1 : 0) - ptr.f) * .12;
      x.clearRect(0, 0, W, H);
      for (i = 0; i < noise.length; i++) {
        n = noise[i]; q = push(n.x + Math.sin(T * n.w + n.p) * n.m, n.y + Math.cos(T * n.w * .8 + n.q) * n.m, 26);
        dot(x, q[0], q[1], n.s, n.a * edge(q[0], q[1]) * (1 - .3 * ease(sp)), 0);
      }
      for (i = 0; i < sig.length; i++) {
        n = sig[i]; ti = ease(clamp(sp * 1.6 - .6 * n.u, 0, 1));
        px = n.x0 + Math.sin(T * n.w + n.p) * n.m; py = n.y0 + Math.cos(T * n.w * .8 + n.q) * n.m;
        q = push(px + (n.x1 - px) * ti, py + (n.y1 - py) * ti, 26 - 21 * ti);
        dot(x, q[0], q[1], n.s * (.9 + .6 * ti), (n.a + (1 - n.a) * ti) * (ti < 1 ? edge(q[0], q[1]) * (1 - ti) + ti : 1), 0);
      }
    }
    function loop(now) { raf = 0; paint(now); if (vis && !d.hidden && !calm) raf = requestAnimationFrame(loop); }
    function go() { if (!raf) raf = requestAnimationFrame(loop); }
    redrawHero = go;
    new IntersectionObserver(function (es) { vis = es[es.length - 1].isIntersecting; if (vis) { if (!start) start = performance.now() + 350; go(); } }, { threshold: .15 }).observe(box);
    d.addEventListener('visibilitychange', function () { if (!d.hidden && vis) go(); });
    var hero = box.closest('.pg-hero');
    hero.addEventListener('pointermove', function (e) { if (e.pointerType !== 'mouse') return; var r = cv.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.on = true; });
    hero.addEventListener('pointerleave', function () { ptr.on = false; });
    if (window.ResizeObserver) { var w0 = 0, h0 = 0; new ResizeObserver(function () { var r = box.getBoundingClientRect(); if (Math.abs(r.width - w0) > 1 || Math.abs(r.height - h0) > 1) { w0 = r.width; h0 = r.height; build(); } }).observe(box); }
    else build();
  })();

  var FIG = {
    basics: function (W, H, b) {
      var o = [], mx = W * .1, my = H * .13, C = 12, R = 7, i, j, t;
      for (i = 0; i < C; i++) for (j = 0; j < R; j++) {
        t = (i / (C - 1) + j / (R - 1)) / 2;
        o.push([mx + i * (W - 2 * mx) / (C - 1), H - my - j * (H - 2 * my) / (R - 1), b * (.5 + 1.3 * t), .2 + .8 * t, t > .82 ? 1 : 0]);
      }
      return o;
    },
    cone: function (W, H, b) {
      var o = [], mx = W * .08, xs = W * .4, y0 = H * .56, n = 13, K = 11, i, k, q, m, half, sp, yc, f, ye;
      for (i = 0; i < n; i++) o.push([mx + i * (xs - mx) / (n - 1), y0 - (i / (n - 1)) * H * .05 + Math.sin(i * .95) * H * .028, b, .9, 0]);
      ye = y0 - H * .05 + Math.sin((n - 1) * .95) * H * .028;
      for (k = 1; k <= K; k++) {
        m = 1 + 2 * Math.ceil(k * .45); half = (m - 1) / 2; sp = H * .36 * Math.pow(k / K, .9); yc = ye - k * H * .011;
        for (q = -half; q <= half; q++) { f = Math.abs(q) / half; o.push([xs + k * (W - mx - xs) / K, yc + (q / half) * sp, b * (1 - .4 * f), q === 0 ? .95 : .7 - .5 * f, q === 0 ? 1 : 0]); }
      }
      return o;
    },
    tree: function (W, H, b) {
      var o = [], mx = W * .08, X = [mx, W * .36, W * .64, W - mx], off = [0, .2, .105, .052], lv = [[.5]], path = [0, 0, 1, 2], l;
      for (l = 1; l < 4; l++) { lv[l] = []; lv[l - 1].forEach(function (y) { lv[l].push(y - off[l], y + off[l]); }); }
      lv.forEach(function (ys, l) {
        ys.forEach(function (y, i) {
          var on = path[l] === i;
          o.push([X[l], y * H, b * (l === 0 ? 1.9 : 1.5), .92, on ? 1 : 0]);
          if (l < 3) [0, 1].forEach(function (c) {
            var j = i * 2 + c, y1 = lv[l + 1][j], n = 7 - l, red = on && path[l + 1] === j, k, t;
            for (k = 1; k <= n; k++) { t = k / (n + 1); o.push([X[l] + (X[l + 1] - X[l]) * t, (y + (y1 - y) * ease(t)) * H, b * .55, red ? .9 : .42, red ? 1 : 0]); }
          });
        });
      });
      return o;
    },
    flash: function (W, H, b) {
      var o = [], S = [[.24, .6, [[.1, 8], [.2, 14], [.3, 20]]], [.58, .33, [[.09, 8], [.18, 13]]], [.83, .7, [[.08, 7], [.16, 12]]]];
      S.forEach(function (c, ci) {
        o.push([c[0] * W, c[1] * H, b * 1.9, .95, 1]);
        c[2].forEach(function (r, ri) {
          for (var k = 0; k < r[1]; k++) { var th = (k + ri * .5) / r[1] * 6.2832 + ci; o.push([c[0] * W + Math.cos(th) * r[0] * H, c[1] * H + Math.sin(th) * r[0] * H, b * (1 - .22 * ri), .8 - .26 * ri, 0]); }
        });
      });
      return o;
    },
    macro: function (W, H, b) {
      var o = [], mx = W * .07, n = 40, i, u;
      for (i = 0; i < n; i++) {
        u = i / (n - 1);
        o.push([mx + u * (W - 2 * mx), H * (.7 - .36 * u) + Math.sin(i * .42) * H * .07 + Math.sin(i * .17 + 1) * H * .04, b, .9, i >= n - 5 ? 1 : 0]);
        o.push([mx + u * (W - 2 * mx), H * (.4 + .22 * u) + Math.sin(i * .36 + 2) * H * .05, b * .8, .32, 0]);
      }
      return o;
    },
    poles: function (W, H, b) {
      var o = [], R = Math.min(W * .16, H * .34), n = 42, g = 9, k, rr, th, u, mid, x0 = W * .22 + R + b * 2.6, x1 = W * .78 - R - b * 2.6;
      [.22, .78].forEach(function (cx, s) {
        for (k = 0; k < n; k++) { rr = R * Math.sqrt((k + .5) / n); th = k * 2.39996 + s; o.push([cx * W + Math.cos(th) * rr, H * .5 + Math.sin(th) * rr, b * .95, .85, 0]); }
      });
      for (k = 0; k < g; k++) { u = k / (g - 1); mid = k === (g - 1) / 2; o.push([x0 + (x1 - x0) * u, H * .5 + Math.sin(u * 6.2832) * H * .035, mid ? b * 1.7 : b * .6, mid ? .95 : .45, mid ? 1 : 0]); }
      return o;
    },
    bars: function (W, H, b) {
      var o = [], hs = [3, 5, 8, 6, 10, 4, 7, 5, 2], cell = Math.min((W * .84) / (hs.length * 3.1), (H * .8) / 10.6), x0 = (W - hs.length * cell * 3.1 + cell * 1.1) / 2, base = H * .9;
      hs.forEach(function (h, k) { for (var q = 0; q < h; q++) for (var a = 0; a < 2; a++) o.push([x0 + k * cell * 3.1 + a * cell + cell / 2, base - (q + .5) * cell, cell * .64, .82, h === 10 ? 1 : 0]); });
      return o;
    },
    net: function (W, H, b) {
      var o = [], L = [4, 6, 6, 3], mx = W * .12, step = (H * .76) / 5, pos = [];
      L.forEach(function (n, l) { pos[l] = []; for (var i = 0; i < n; i++) pos[l].push([mx + l * (W - 2 * mx) / (L.length - 1), H / 2 + (i - (n - 1) / 2) * step]); });
      L.forEach(function (n, l) {
        pos[l].forEach(function (p, i) {
          o.push([p[0], p[1], b * 1.7, .92, l === 3 && i === 1 ? 1 : 0]);
          if (l < 3) {
            var m = L[l + 1], a = clamp(Math.floor((i + .5) / n * m - .5), 0, m - 2);
            [a, a + 1].forEach(function (j) { var q = pos[l + 1][j]; for (var k = 1; k <= 4; k++) o.push([p[0] + (q[0] - p[0]) * k / 5, p[1] + (q[1] - p[1]) * k / 5, b * .45, .5, 0]); });
          }
        });
      });
      return o;
    },
    hub: function (W, H, b) {
      var o = [[W / 2, H / 2, b * 2.4, .95, 1]], n = 8, rx = W * .27, ry = H * .27, k, j, th, X, Y;
      function at(a, f) { return [W / 2 + Math.cos(a) * rx * f, H / 2 + Math.sin(a) * ry * f]; }
      for (k = 0; k < n; k++) {
        th = (k / n) * 6.2832 + .39; X = at(th, 1);
        o.push([X[0], X[1], b * 1.5, .9, 0]);
        for (j = 1; j <= 6; j++) o.push([W / 2 + (X[0] - W / 2) * j / 7, H / 2 + (X[1] - H / 2) * j / 7, b * .55, .55, 0]);
        [-.24, .24].forEach(function (dth) {
          Y = at(th + dth, 1.55);
          o.push([Y[0], Y[1], b * .95, .7, 0], [(X[0] + Y[0]) / 2, (X[1] + Y[1]) / 2, b * .45, .45, 0]);
        });
      }
      return o;
    },
    chain: function (W, H, b) {
      var o = [], n = 5, mx = W * .1, y = H * .62, X = [], k, j, px, u;
      for (k = 0; k < n; k++) X.push(mx + k * (W - 2 * mx) / (n - 1));
      X.forEach(function (x, k) {
        var a = k === 3 ? .3 : .88;
        o.push([x, y, b, a, 0]);
        for (j = 0; j < 6; j++) o.push([x + Math.cos(j * 1.0472) * b * 2.1, y + Math.sin(j * 1.0472) * b * 2.1, b, a, 0]);
        if (k < n - 1) for (j = 1; j <= 6; j++) {
          px = x + b * 3.6 + (X[k + 1] - x - b * 7.2) * (j - 1) / 5;
          if (k === 2) { if (j === 3 || j === 4) continue; o.push([px, y, j < 3 ? b : b * .5, j < 3 ? .95 : .22, j < 3 ? 1 : 0]); }
          else o.push([px, y, b * .5, k === 3 ? .22 : .5, 0]);
        }
      });
      for (j = 1; j <= 16; j++) { u = j / 17; o.push([X[2] + (X[4] - X[2]) * u, y - b * 3.6 - Math.sin(u * Math.PI) * H * .36, b * .5, .5, 0]); }
      return o;
    },
    shock: function (W, H, b) {
      var o = [], mx = W * .07, i, u;
      for (i = 0; i < 14; i++) o.push([mx + i * (W * .36 - mx) / 13, H * .36 + Math.sin(i * 1.7) * H * .008, b, .9, 0]);
      for (i = 1; i <= 5; i++) o.push([W * .36 + i * W * .014, H * .36 + (i / 6) * H * .44, b, .9, 0]);
      for (i = 0; i < 3; i++) o.push([W * .445 + i * W * .022, H * (.8 + (i === 1 ? .012 : 0)), b * 1.3, .95, 1]);
      for (i = 1; i <= 20; i++) { u = i / 20; o.push([W * .49 + u * (W - mx - W * .49), H * (.8 - .52 * out(u)), b, .9, 0]); }
      for (i = 1; i <= 16; i++) { u = i / 16; o.push([W * .49 + u * (W - mx - W * .49), H * (.8 - .13 * u), b * .7, .28, 0]); }
      return o;
    }
  };

  var stage = d.createElement('div'), cv = d.createElement('canvas'), det = d.createElement('div');
  stage.className = 'pg-stage'; cv.className = 'pg-fig'; cv.setAttribute('aria-hidden', 'true'); det.className = 'pg-det'; det.setAttribute('aria-live', 'polite');
  stage.appendChild(cv); stage.appendChild(det);
  var N = 150, DUR = 950, cur = [], src = [], dst = [], jit = [], st = { W: 0, H: 0, b: 4, key: null, t0: 0, raf: 0, x: null, seen: false, dur: DUR };
  (function () { var R = rng(11); for (var i = 0; i < N; i++) jit.push([R() - .5, R() - .5, R()]); })();
  function copy(a) { return a.map(function (p) { return p.slice(); }); }
  function target(key) {
    var f = FIG[key](st.W, st.H, st.b).sort(function (p, q) { return p[0] - q[0] || p[1] - q[1]; }), o = [], i, j, last = -1, p;
    for (i = 0; i < N; i++) { j = Math.min(f.length - 1, Math.floor(i * f.length / N)); p = f[j]; o.push([p[0], p[1], p[2], j === last ? 0 : p[3], p[4]]); last = j; }
    return o;
  }
  function scatter() { var R = rng(23), o = []; for (var i = 0; i < N; i++) o.push([R() * st.W, R() * st.H, st.b * .7, 0, 0]); return o; }
  function paintStage() {
    if (!st.x) return;
    st.x.clearRect(0, 0, st.W, st.H);
    for (var i = 0; i < N; i++) { var p = cur[i]; if (p) dot(st.x, p[0], p[1], p[2], p[3], p[4]); }
  }
  function frame(now) {
    st.raf = 0;
    var t = clamp((now - st.t0) / st.dur, 0, 1), i, ti, a, z, bend;
    for (i = 0; i < N; i++) {
      ti = ease(clamp(t * 1.45 - .45 * (i / N), 0, 1)); a = src[i]; z = dst[i]; bend = Math.sin(Math.PI * ti) * 26 * jit[i][2];
      cur[i] = [a[0] + (z[0] - a[0]) * ti + bend * jit[i][0], a[1] + (z[1] - a[1]) * ti + bend * jit[i][1], a[2] + (z[2] - a[2]) * ti, a[3] + (z[3] - a[3]) * ti, a[4] + (z[4] - a[4]) * ti];
    }
    paintStage();
    if (t < 1) st.raf = requestAnimationFrame(frame);
  }
  function run(dur) { st.dur = dur || DUR; st.t0 = performance.now(); if (!st.raf) st.raf = requestAnimationFrame(frame); }
  function show(key) {
    var same = key === st.key; st.key = key;
    if (!st.W || !st.seen || same) return;
    dst = target(key);
    if (calm) { cur = copy(dst); paintStage(); return; }
    src = copy(cur); run();
  }
  function layoutStage() {
    var w = cv.clientWidth; if (w < 40) return;
    st.W = w; st.H = Math.round(wide.matches ? clamp(w * .58, 180, 380) : clamp(w * .56, 150, 230)); st.b = clamp(w / 120, 3, 5);
    st.x = fit(cv, st.W, st.H);
    if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
    if (!st.key) return;
    dst = target(st.key); cur = st.seen ? copy(dst) : scatter(); paintStage();
  }
  if (window.ResizeObserver) { var sw = 0; new ResizeObserver(function () { var w = cv.clientWidth; if (Math.abs(w - sw) > 1) { sw = w; layoutStage(); } }).observe(cv); }
  new IntersectionObserver(function (es) {
    if (st.seen || !es[es.length - 1].isIntersecting) return;
    if (!st.W) layoutStage(); if (!st.W || !st.key) return;
    st.seen = true; dst = target(st.key);
    if (calm) { cur = copy(dst); paintStage(); return; }
    cur = scatter(); src = copy(cur); run(DUR * 1.35);
  }, { threshold: .3 }).observe(cv);

  var swapT = 0;
  function tell(li, instant) {
    var html = li.querySelector('.pgm-d').innerHTML;
    clearTimeout(swapT);
    if (instant || calm || !det.firstChild) { det.innerHTML = html; det.classList.remove('is-out'); return; }
    det.classList.add('is-out');
    swapT = setTimeout(function () { det.innerHTML = html; det.classList.remove('is-out'); }, 160);
  }

  var panels = [].map.call(page.querySelectorAll('[data-track]'), function (el) {
    return { el: el, id: el.id, mods: [].slice.call(el.querySelectorAll('.pgm')), slot: el.querySelector('.pg-slot'), pill: el.querySelector('.pg-list-pill'), nums: [].slice.call(el.querySelectorAll('.pg-num')), stages: el.querySelector('.pg-stages'), cue: el.querySelector('.pg-cue'), on: -1, counted: false };
  });
  var tabs = [].slice.call(page.querySelectorAll('.pg-tabs [role=tab]')), tpill = page.querySelector('.pg-tabs-pill'), curT = -1;

  function movePill(P, now) {
    var li = P.mods[P.on], s = P.pill.style;
    if (!li || !wide.matches) { s.opacity = 0; return; }
    if (now) s.transition = 'none';
    s.height = li.offsetHeight + 'px'; s.transform = 'translateY(' + li.offsetTop + 'px)'; s.opacity = 1;
    if (now) { P.pill.offsetWidth; s.transition = ''; }
  }
  function pick(P, i, o) {
    o = o || {};
    var w = wide.matches;
    if (!w && !o.keep && i === P.on) i = -1;
    var first = P.on < 0; P.on = i;
    P.mods.forEach(function (li, k) {
      var on = k === i, b = li.querySelector('.pgm-b');
      li.classList.toggle('is-on', on);
      if (w) { b.removeAttribute('aria-expanded'); b.removeAttribute('aria-controls'); if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
      else { b.removeAttribute('aria-current'); b.setAttribute('aria-expanded', on ? 'true' : 'false'); b.setAttribute('aria-controls', li.querySelector('.pgm-d').id); }
    });
    if (i < 0) { movePill(P); return; }
    var li = P.mods[i];
    if (w) { if (stage.parentNode !== P.slot) P.slot.appendChild(stage); movePill(P, o.instant || first); tell(li, o.instant); }
    else { var xi = li.querySelector('.pgm-xi'); if (stage.parentNode !== xi) xi.insertBefore(stage, xi.firstChild); }
    show(li.getAttribute('data-fig'));
  }
  function count(P, from, instant) {
    P.counted = true;
    P.nums.forEach(function (el, j) {
      var to = +el.getAttribute('data-n'), a = from ? from[j] : 0;
      if (instant || calm || a === to) { el.textContent = to; return; }
      var t0 = performance.now(), dur = 520 + 60 * Math.abs(to - a);
      (function step(now) { var t = clamp((now - t0) / dur, 0, 1); el.textContent = Math.round(a + (to - a) * out(t)); if (t < 1) requestAnimationFrame(step); })(t0);
    });
  }
  function placeTab(now) {
    var a = tabs[curT], s = tpill.style; if (!a) return;
    if (now) s.transition = 'none';
    s.width = a.offsetWidth + 'px'; s.transform = 'translateX(' + a.offsetLeft + 'px)'; s.opacity = 1;
    if (now) { tpill.offsetWidth; s.transition = ''; }
    var row = tpill.parentNode; if (row.scrollWidth > row.clientWidth) row.scrollLeft = a.offsetLeft - (row.clientWidth - a.offsetWidth) / 2;
  }
  function choose(k, o) {
    o = o || {};
    if (k === curT || !panels[k]) return;
    var prev = panels[curT], P = panels[k];
    curT = k;
    tabs.forEach(function (b, j) { b.setAttribute('aria-selected', j === k ? 'true' : 'false'); b.tabIndex = j === k ? 0 : -1; });
    panels.forEach(function (Q, j) { Q.el.classList.toggle('is-on', j === k); });
    placeTab(o.instant);
    if (prev && prev.stages) prev.stages.classList.remove('is-in');
    var keep = 0, was = prev && prev.mods[prev.on];
    if (was && P.mods[prev.on] && P.mods[prev.on].getAttribute('data-fig') === was.getAttribute('data-fig')) keep = prev.on;
    pick(P, wide.matches ? keep : -1, { instant: o.instant, keep: true });
    if (!o.instant) {
      count(P, prev && prev.counted ? prev.nums.map(function (el) { return +el.getAttribute('data-n'); }) : null);
      if (!calm) { P.el.classList.remove('pg-enter'); P.el.offsetWidth; P.el.classList.add('pg-enter'); }
      if (history.replaceState) history.replaceState(null, '', '#' + P.id);
    }
  }
  function setCue() { var s = page.getAttribute(fine.matches && wide.matches ? 'data-cue-hover' : 'data-cue-tap'); panels.forEach(function (P) { if (P.cue) P.cue.textContent = s; }); }

  panels.forEach(function (P, pi) {
    P.el.setAttribute('role', 'tabpanel'); P.el.setAttribute('aria-labelledby', 'pg-tab-' + pi);
    var btns = P.mods.map(function (li) { return li.querySelector('.pgm-b'); });
    P.mods.forEach(function (li, k) {
      var t = 0;
      li.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'mouse' || !wide.matches) return; clearTimeout(t); t = setTimeout(function () { if (P.on !== k) pick(P, k); }, 70); });
      li.addEventListener('pointerleave', function () { clearTimeout(t); });
      btns[k].addEventListener('focus', function () { if (wide.matches && P.on !== k) pick(P, k); });
      btns[k].addEventListener('click', function () { if (!wide.matches || P.on !== k) pick(P, k); });
      btns[k].addEventListener('keydown', function (e) {
        var to = e.key === 'ArrowDown' ? k + 1 : e.key === 'ArrowUp' ? k - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? btns.length - 1 : -1;
        if (to < 0 || to >= btns.length || to === k) return;
        e.preventDefault(); btns[to].focus();
      });
    });
    new IntersectionObserver(function (es) { if (es[es.length - 1].isIntersecting && !P.counted) count(P, null); }, { threshold: .6 }).observe(P.el.querySelector('.pg-counts'));
    if (P.stages) new IntersectionObserver(function (es) { if (es[es.length - 1].isIntersecting) P.stages.classList.add('is-in'); }, { threshold: .5 }).observe(P.stages);
    if (!calm) P.nums.forEach(function (el) { el.textContent = '0'; });
  });
  tabs.forEach(function (b, k) {
    b.addEventListener('click', function () { choose(k); });
    b.addEventListener('keydown', function (e) {
      var to = e.key === 'ArrowRight' ? k + 1 : e.key === 'ArrowLeft' ? k - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
      if (to < 0 || to >= tabs.length || to === k) return;
      e.preventDefault(); choose(to); tabs[to].focus();
    });
  });

  function fromHash() { var h = decodeURIComponent(location.hash.slice(1)), k = -1; panels.forEach(function (P, j) { if (P.id === h) k = j; }); return k; }
  var h0 = fromHash();
  setCue();
  choose(h0 < 0 ? 0 : h0, { instant: true });
  if (h0 >= 0) page.querySelector('.pg-pick').scrollIntoView();
  addEventListener('hashchange', function () { var k = fromHash(); if (k >= 0) choose(k); });

  function settle() { placeTab(true); var P = panels[curT]; if (P) movePill(P, true); }
  function mode() { setCue(); var P = panels[curT]; if (!P) return; pick(P, wide.matches && P.on < 0 ? 0 : P.on, { instant: true, keep: true }); settle(); }
  onMq(wide, mode); onMq(fine, setCue);
  var rt = 0; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(settle, 120); });
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(settle);

  function recolour() { tokens(); paintStage(); redrawHero(); }
  new MutationObserver(recolour).observe(de, { attributes: true, attributeFilter: ['data-theme'] });
  onMq(matchMedia('(prefers-color-scheme: dark)'), recolour);
})();
