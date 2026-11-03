/* The Panolar tab: one field of dots, pinned, that rearranges itself into each dashboard's figure as the page scrolls.
   The dots are the same throughout; only their places change (real values from figures.json, via panoMinis.js).
   Without JavaScript, under reduced motion or on very short screens the page stays a plain list with static charts. */
(function () {
  'use strict';
  var root = document.querySelector('[data-ps]'), dataEl = document.getElementById('pano-data');
  if (!root || !dataEl || !window.requestAnimationFrame) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || innerHeight < 520) return;
  var D = JSON.parse(dataEl.textContent), page = root.closest('.pano'), de = document.documentElement;
  var stick = root.querySelector('.ps-stick'), items = [].slice.call(root.querySelectorAll('.pe')), cue = root.querySelector('.ps-cue');
  var links = [].slice.call(page.querySelectorAll('.pi a')), pill = page.querySelector('.pi-pill');
  function markPill() { var a = links[activeI]; if (!a || !pill) return; pill.style.width = a.offsetWidth + 'px'; pill.style.transform = 'translateX(' + a.offsetLeft + 'px)'; pill.style.opacity = 1; var row = pill.parentNode; if (row.scrollWidth > row.clientWidth) row.scrollLeft = a.offsetLeft - (row.clientWidth - a.offsetWidth) / 2; }
  var cv = document.createElement('canvas'); cv.className = 'ps-cv'; cv.setAttribute('aria-hidden', 'true');
  page.classList.add('ps-on'); de.classList.remove('ps-early'); stick.insertBefore(cv, stick.firstChild);
  requestAnimationFrame(function () { requestAnimationFrame(function () { page.classList.add('ps-ready'); }); });
  var x = cv.getContext('2d');

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function fmt(v, d) { var s = v.toFixed(d == null ? 1 : d); return D.lang === 'tr' ? s.replace('.', ',') : s; }
  function money(v, u) { return D.lang === 'tr' ? v + ' ' + (u === 'bn' ? 'mlr' : 'mn') + ' $' : '$' + v + ' ' + u; }
  function whole(v) { return v >= 100 ? Math.round(v).toLocaleString(D.lang === 'tr' ? 'tr-TR' : 'en-US') : fmt(v); }

  var W = 0, H = 0, ox = 0, oy = 0, narrow = false, scenes = [], N = 0, jit = [], col = {};
  function hex(v) { v = v.trim().replace('#', ''); if (v.length === 3) v = v.replace(/./g, '$&$&'); var n = parseInt(v, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function tokens() {
    var s = getComputedStyle(page);
    col.ink = hex(s.getPropertyValue('--ink')); col.ink2 = s.getPropertyValue('--ink2').trim(); col.inkT = s.getPropertyValue('--ink').trim();
    col.red = hex(s.getPropertyValue('--s4-red') || '#e31a31'); col.rule = s.getPropertyValue('--rule2').trim(); col.bg = s.getPropertyValue('--bg').trim();
    var dark = col.ink[0] > 128; col.gA = dark ? .46 : .36; col.rA = dark ? .95 : .72; col.kA = dark ? .92 : .82;
  }
  // each scene: dots [x, y, red?, size], plus its rules and words
  function pct(v) { return D.lang === 'tr' ? '%' + fmt(v) : fmt(v) + '%'; }
  // who carries Türkiye's import risk: 1995 grows to the left, 2024 to the right; one dot is one per cent
  function story() {
    var d = [], tx = [], R = D.shares, cw = narrow ? 56 : 104, s = narrow ? 4.2 : 8, g = narrow ? 5.2 : 11, top = 8, rh = Math.min(narrow ? 44 : 62, (H - top) / R.length), y0 = top + (H - top - rh * R.length) / 2, mid = W / 2, left = mid - cw / 2, right = mid + cw / 2;
    tx.push([left, y0 - 4, D.years[0], 'end', 1], [right, y0 - 4, D.years[D.years.length - 1], 'start', 1]);
    R.forEach(function (row, r) {
      var cy = y0 + r * rh + rh / 2, n0 = Math.round(row[1]), n1 = Math.round(row[2]), k;
      function y(q) { return cy - g + (q % 2) * g; }
      for (k = 0; k < n0; k++) d.push([left - (Math.floor(k / 2) + 1) * g, y(k), 0, s]);
      for (k = 0; k < n1; k++) d.push([right + Math.floor(k / 2) * g, y(k), 0, s, 1]);
      tx.push([mid, cy + 4, row[0], 'center', 1], [left - (Math.ceil(n0 / 2) + .6) * g, cy + 4, pct(row[1]), 'end'], [right + (Math.ceil(n1 / 2) + .3) * g, cy + 4, pct(row[2]), 'start', 1]);
    });
    return { d: d, tx: tx, ln: [] };
  }
  function spread() {
    var d = [], tx = [], ln = [], base = H - 22, s = clamp(H / 34, narrow ? 4.5 : 7, 11), g = s + (narrow ? 1.6 : 2.4), px = (W - s) / 150, bin = g / px, st = {}, tv = D.trRisk, m = D.med[D.med.length - 1];
    D.econ.slice().sort(function (a, b) { return a - b; }).forEach(function (v) {
      var k = Math.floor(v / bin); st[k] = (st[k] || 0) + 1;
      d.push([k * bin * px, base - st[k] * g, Math.abs(v - tv) < 1e-6 ? 1 : 0, s]);
    });
    var xt = tv * px + s / 2, xm = m * px;
    ln.push([xt, 14, xt, base, 'rgba(' + col.red + ',.6)'], [xm, 32, xm, base, col.ink2], [0, base, W, base, col.rule]);
    tx.push([xt + 6, 24, D.w.tr + ' ' + fmt(tv)], [xm + 6, 42, D.w.med + ' ' + fmt(m)]);
    [0, 50, 100, 150].forEach(function (v) { tx.push([v * px + (v === 150 ? s : 0), H - 5, v, v === 150 ? 'end' : 'start']); });
    return { d: d, tx: tx, ln: ln };
  }
  function arms() {
    var d = [], tx = [], ln = [], v = D.arms, n = v.length, base = H - 22, top = 26, s = narrow ? 2.6 : 4, across = narrow ? 2 : 3, g = s + (narrow ? 1 : 1.8), step = W / n, peak = Math.max.apply(null, v), rows = Math.floor((base - top) / g);
    v.forEach(function (val, i) {
      var r = Math.max(1, Math.round(val / peak * rows));
      for (var q = 0; q < r; q++) for (var a = 0; a < across; a++) d.push([i * step + a * g, base - (q + 1) * g, 1, s]);
    });
    ln.push([0, base, W, base, col.rule]);
    tx.push([0, base - g - 8, money(whole(v[0]), 'mn')], [W, 14, money(whole(v[n - 1]), 'mn'), 'end'], [0, H - 5, D.armsYears[0]], [W, H - 5, D.armsYears[n - 1], 'end']);
    return { d: d, tx: tx, ln: ln };
  }
  // trade: the dots become a globe, Türkiye in red, the five partners darkened by value and tied to it by arcs
  function partners() {
    var d = [], tx = [], ln = [], listH = narrow ? 92 : 0, R = Math.min(W / 2 - 2, (H - listH) / 2 - 2), cx = W / 2, cy = (H - listH) / 2, rd = Math.PI / 180, s = Math.max(1.8, R / 68);
    function vec(p) { var l = p[0] * rd, q = p[1] * rd; return [Math.cos(q) * Math.cos(l), Math.cos(q) * Math.sin(l), Math.sin(q)]; }
    function dt(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    var C = vec(D.cam), L0 = D.cam[0] * rd, P0 = D.cam[1] * rd, E = [-Math.sin(L0), Math.cos(L0), 0], Nn = [-Math.sin(P0) * Math.cos(L0), -Math.sin(P0) * Math.sin(L0), Math.cos(P0)];
    function XY(v) { return [cx + R * dt(v, E), cy - R * dt(v, Nn)]; }
    D.land.forEach(function (p) {
      var v = vec(p), q = XY(v), dz = dt(v, C);
      var dark = D.top.some(function (t) { return Math.hypot((p[0] - t[2][0]) * Math.cos(p[1] * rd), p[1] - t[2][1]) <= 1.5 + Math.sqrt(t[0]) * .8; });
      d.push([q[0], q[1], p[2] ? 1 : 0, s, !p[2] && dark ? 1 : 0, !p[2] && !dark ? .25 + .75 * dz : 1]);
    });
    var A = vec(D.trAt), sa = Math.max(1.5, s * .62);
    D.top.forEach(function (t) {
      var B = vec(t[2]), th = Math.acos(dt(A, B)), h0 = .02 + .13 * th, n = Math.max(6, Math.round(th * R / 6.5));
      for (var j = 1; j < n; j++) {
        var u = j / n, k0 = Math.sin((1 - u) * th) / Math.sin(th), k1 = Math.sin(u * th) / Math.sin(th), h = 1 + h0 * Math.sin(Math.PI * u), q = XY([(A[0] * k0 + B[0] * k1) * h, (A[1] * k0 + B[1] * k1) * h, (A[2] * k0 + B[2] * k1) * h]);
        d.push([q[0], q[1], 0, sa, 1]);
      }
    });
    if (narrow) D.top.forEach(function (t, i) { var y = cy + R + 18 + i * 17; tx.push([W / 2 - 8, y, t[1], 'end'], [W / 2 + 8, y, money(fmt(t[0]), 'bn'), 'start', 1]); });
    else {
      D.top.forEach(function (t) {
        var a = t[3], q = XY(vec(t[2]));
        tx.push([q[0] + a[0], q[1] + a[1], t[1] + ' ' + money(fmt(t[0]), 'bn'), a[2] === 'middle' ? 'center' : a[2], 0, 1]);
      });
      var tq = XY(A); tx.push([tq[0] + 14, tq[1] - 12, D.w.tr, 'start', 1, 1]);
    }
    return { d: d, tx: tx, ln: ln };
  }
  var headerH = 0;
  function layout() {
    tokens();
    var hd = document.querySelector('.hd'); headerH = hd ? hd.getBoundingClientRect().height : 0;
    page.style.setProperty('--hh', headerH + 'px');
    var r = stick.getBoundingClientRect(), pr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(r.width * pr); cv.height = Math.round(r.height * pr);
    cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    x.setTransform(pr, 0, 0, pr, 0, 0);
    // the stage: the free space between the words above and the words below, in the tallest scene
    var a = 0, b = r.height;
    items.forEach(function (li) {
      var h = li.querySelector('.pe-line').getBoundingClientRect(), c = li.querySelector('figcaption').getBoundingClientRect();
      a = Math.max(a, h.bottom - r.top); b = Math.min(b, c.top - r.top);
    });
    narrow = r.width < 620;
    W = Math.min(r.width - 32, 860); H = Math.max(150, b - a - (narrow ? 20 : 36));
    ox = (r.width - W) / 2; oy = a + (narrow ? 10 : 18);
    scenes = [story(), spread(), arms(), partners()];
    N = Math.max.apply(null, scenes.map(function (q) { return q.d.length; }));
    jit = []; for (var i = 0; i < N; i++) jit.push([Math.sin(i * 12.9898) * 43758.5453 % 1, Math.sin(i * 78.233) * 12543.123 % 1]);
    dirty = true; kick(); markPill();
  }
  var p = 0, target = 0, intro = 0, raf = 0, dirty = true, last = 0, activeI = -1;
  function words(sc, a) {
    if (a <= .01) return;
    x.globalAlpha = a;
    sc.ln.forEach(function (l) { x.strokeStyle = l[4]; x.lineWidth = 1; x.beginPath(); x.moveTo(ox + l[0] + .5, oy + l[1] + .5); x.lineTo(ox + l[2] + .5, oy + l[3] + .5); x.stroke(); });
    x.font = (narrow ? '12px ' : '13px ') + getComputedStyle(page).fontFamily;
    sc.tx.forEach(function (t) {
      x.font = (t[4] ? '500 ' : '400 ') + (narrow ? '12px ' : '13px ') + getComputedStyle(page).fontFamily;
      x.textAlign = t[3] || 'start';
      if (t[5]) { x.strokeStyle = col.bg; x.lineWidth = 4; x.lineJoin = 'round'; x.strokeText(t[2], ox + t[0], oy + t[1]); }  // a halo keeps labels clear of the dots
      x.fillStyle = t[4] ? col.inkT : col.ink2; x.fillText(t[2], ox + t[0], oy + t[1]);
    });
    x.globalAlpha = 1;
  }
  function draw() {
    if (!scenes.length) return;
    var a = Math.min(scenes.length - 1, Math.floor(p)), f = p - a, b = Math.min(scenes.length - 1, a + 1);
    var t = sstep(.25, .78, f), A = scenes[a], B = scenes[b], stag = .4, I = ease(intro);
    x.clearRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < N; i++) {
      var pa = A.d[i], ha = !!pa; if (!pa) pa = A.d[i % A.d.length];
      var pb = B.d[i], hb = !!pb; if (!pb) pb = B.d[i % B.d.length];
      var ti = ease(clamp(t * (1 + stag) - stag * (i / N), 0, 1));
      var bend = Math.sin(Math.PI * ti) * jit[i][0] * (narrow ? 26 : 54);
      var X = pa[0] + (pb[0] - pa[0]) * ti + bend * jit[i][1], Y = pa[1] + (pb[1] - pa[1]) * ti + bend;
      var s = pa[3] + (pb[3] - pa[3]) * ti, red = pa[2] + (pb[2] - pa[2]) * ti;
      var op = (ha ? 1 : 0) * (1 - ti) + (hb ? 1 : 0) * ti; if (op < .01) continue;
      if (I < 1) { var ii = ease(clamp(intro * 1.5 - .5 * (i / N), 0, 1)); X = W / 2 + jit[i][0] * W * .55 + (X - W / 2 - jit[i][0] * W * .55) * ii; Y = H / 2 + jit[i][1] * H * .6 + (Y - H / 2 - jit[i][1] * H * .6) * ii; op *= ii; }
      var ga = col.gA + (col.rA - col.gA) * red;
      var dk = (pa[4] ? 1 : 0) * (1 - ti) + (pb[4] ? 1 : 0) * ti; ga += (col.kA - ga) * dk;
      ga *= (pa[5] || 1) * (1 - ti) + (pb[5] || 1) * ti;  // the globe's depth
      x.fillStyle = 'rgba(' + Math.round(col.ink[0] + (col.red[0] - col.ink[0]) * red) + ',' + Math.round(col.ink[1] + (col.red[1] - col.ink[1]) * red) + ',' + Math.round(col.ink[2] + (col.red[2] - col.ink[2]) * red) + ',' + (ga * op).toFixed(3) + ')';
      x.fillRect(ox + X, oy + Y, s, s);
    }
    words(A, (1 - sstep(.02, .3, f)) * I);
    if (b !== a) words(B, sstep(.74, .95, f));
    var cur = f > .5 ? b : a;
    if (cur !== activeI) {
      activeI = cur;
      items.forEach(function (li, k) { li.classList.toggle('is-on', k === cur); });
      links.forEach(function (a, k) { if (k === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      markPill();
    }
    if (cue) cue.style.opacity = p < .04 ? 1 : 0;
  }
  function measure() {
    var r = root.getBoundingClientRect(), span = r.height - stick.getBoundingClientRect().height;
    target = clamp((headerH - r.top) / (span || 1), 0, 1) * (scenes.length - 1);
  }
  function tick(ts) {
    raf = 0;
    var dt = last ? Math.min(60, ts - last) : 16; last = ts;
    measure();
    if (intro < 1) { intro = Math.min(1, intro + dt / 1300); dirty = true; }
    var d = target - p;
    if (Math.abs(d) > .0005) { p += d * (1 - Math.pow(.0025, dt / 1000)); dirty = true; } else if (d !== 0) { p = target; dirty = true; }
    if (dirty) { draw(); dirty = false; }
    if (intro < 1 || Math.abs(target - p) > .0005) raf = requestAnimationFrame(tick); else last = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }
  addEventListener('scroll', kick, { passive: true });
  var rt = 0; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 120); });
  function recolour() { tokens(); layout(); }
  new MutationObserver(recolour).observe(de, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolour);
  function goScene(k, smooth) {
    var r = root.getBoundingClientRect(), span = r.height - stick.getBoundingClientRect().height, y = scrollY + r.top - headerH + span * k / (items.length - 1);
    scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' });
  }
  // the list above the stage goes to that scene
  links.forEach(function (a, k) { a.addEventListener('click', function (e) { e.preventDefault(); goScene(k, true); }); });
  // a keyboard visitor reaching a link in another scene: scroll there
  root.addEventListener('focusin', function (e) { var k = items.indexOf(e.target.closest('.pe')); if (k >= 0) goScene(k, false); });
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
})();
