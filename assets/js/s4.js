/* The home page's first screen: the dot globe (first built as sample S4). Türkiye's land dots in transparent red; the globe turns slowly (one turn would take about 90 s),
   eases onto each shock, sends dotted ripples out from it and a dotted arc with red pulses to Türkiye, holds 6 s and
   turns on.
   Same approach as the defence page's globe: land as dots on an orthographic projection, shaded by depth, own maths,
   no library at run time (the dots and Türkiye's outline come from globe.json, inlined by partials/home.njk).
   It runs by itself; one button pauses and resumes it. Durations scale with the --t token, so prefers-reduced-motion turns every move
   into a cut. All captions stay in the page for screen readers; only the current one is visible. */
(function () {
  'use strict';
  var hero = document.querySelector('[data-s4]');
  var dataEl = document.getElementById('s4-globe');
  if (!hero || !dataEl || !window.requestAnimationFrame) return;
  var G = JSON.parse(dataEl.textContent);
  var root = document.documentElement;
  var ground = hero.querySelector('.s4-ground'), cv = hero.querySelector('.s4-cv'), cx2 = cv.getContext('2d');
  var col = hero.querySelector('.s4-col'), panel = hero.querySelector('.s4-panel'), flow = hero.querySelector('.s4-flow'), arcEl = hero.querySelector('.s4-arc'), arc = null;
  var caps = [].slice.call(hero.querySelectorAll('.s4-cap'));

  /* ---------- maths ---------- */
  var rad = Math.PI / 180;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function vec(lon, lat) { var l = lon * rad, p = lat * rad; return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function lonlat(v) { return [Math.atan2(v[1], v[0]) / rad, Math.asin(clamp(v[2], -1, 1)) / rad]; }
  function basis(c) {
    var ll = lonlat(c), l = ll[0] * rad, p = ll[1] * rad;
    return { c: c, e: [-Math.sin(l), Math.cos(l), 0], n: [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)] };
  }
  function slerp(a, b, t) {
    var o = Math.acos(clamp(dot(a, b), -1, 1));
    if (o < 1e-6) return a.slice();
    var s = Math.sin(o), k1 = Math.sin((1 - t) * o) / s, k2 = Math.sin(t * o) / s;
    return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
  }
  function easeIO(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }  // the --ease token's curve
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function sstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  /* ---------- data ---------- */
  // is (lon, lat) inside Türkiye's outline? (ray casting over the outline's rings)
  function inTR(lon, lat) {
    if (lon < 25 || lon > 45 || lat < 35 || lat > 43) return false;
    return G.tr.some(function (ring) {
      var inside = false;
      for (var a = 0, b = ring.length - 1; a < ring.length; b = a++) {
        var A = ring[a], B = ring[b];
        if ((A[1] > lat) !== (B[1] > lat) && lon < (B[0] - A[0]) * (lat - A[1]) / (B[1] - A[1]) + A[0]) inside = !inside;
      }
      return inside;
    });
  }
  var land = [], trLand = [];
  G.rows.forEach(function (r) {
    var st = 360 / r[1], runs = r[2];
    for (var i = 0; i < runs.length; i += 2) for (var k = runs[i]; k < runs[i] + runs[i + 1]; k++) {
      var lon = -180 + k * st;
      var into = inTR(lon, r[0]) ? trLand : land; into.push.apply(into, vec(lon, r[0]));
    }
  });
  land = new Float32Array(land); trLand = new Float32Array(trLand);
  var TRC = vec(G.trc[0], G.trc[1]);
  var STOPS = caps.map(function (li) { return vec(+li.getAttribute('data-lon'), +li.getAttribute('data-lat')); });

  /* ---------- time: every duration is a multiple of --t (1 s, or 1 ms under reduced motion) ---------- */
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  function T() {
    var v = getComputedStyle(root).getPropertyValue('--t').trim();
    var n = parseFloat(v) || 1;
    return /ms$/.test(v) ? n / 1000 : n;
  }
  var HOLD = 6000;           // reading time at each stop (not motion, so not scaled)
  var SPEED = 12;            // degrees per second while turning: one turn in 30 s

  /* ---------- layout ---------- */
  var W = 0, H = 0, cx = 0, cy = 0, R = 0, xtPx = 0, narrow = false, cams = [], zooms = [], Z = 1, clear = null;
  var colour = {};
  function readColours() {
    var s = getComputedStyle(hero);
    var hex = s.getPropertyValue('--ink').trim().replace('#', '');
    if (hex.length === 3) hex = hex.replace(/./g, '$&$&');
    var n = parseInt(hex, 16);
    colour.ink = [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
    var red = parseInt((s.getPropertyValue('--s4-red').trim() || '#e31a31').replace('#', ''), 16);
    colour.red = [(red >> 16) & 255, (red >> 8) & 255, red & 255].join(',');
    colour.redA = parseFloat(s.getPropertyValue('--s4-redA')) || .6;
    colour.A = parseFloat(s.getPropertyValue('--s4-dotA')) || .07;
    colour.B = parseFloat(s.getPropertyValue('--s4-dotB')) || .3;
  }
  // the camera that puts point p at (a, b) on the disk (units of R, b upwards)
  function solve(p, a, b) {
    var ll = lonlat(p), best = 1e9, bl = 0, bp = 0;
    function err(L, P) {
      var B = basis(vec(L, P)); if (dot(p, B.c) < .2) return 1e9;
      var de = dot(p, B.e) - a, dn = dot(p, B.n) - b; return de * de + dn * dn;
    }
    for (var L = ll[0] - 60; L <= ll[0] + 60; L += 2) for (var P = -50; P <= 70; P += 2) { var e = err(L, P); if (e < best) { best = e; bl = L; bp = P; } }
    var L0 = bl, P0 = bp;
    for (L = L0 - 2; L <= L0 + 2; L += .2) for (P = P0 - 2; P <= P0 + 2; P += .2) { e = err(L, P); if (e < best) { best = e; bl = L; bp = P; } }
    return vec(bl, bp);
  }
  // Each stop's camera and scale. The default puts the midpoint of the shock and Türkiye at the focus. If any part of the
  // line then falls under the stop's facts, into the fade by the text column, off the frame or too near the limb, a far
  // stop (China, the US) searches for the largest scale and the camera that keep the whole line in the clear.
  var TREND = [vec(26, 39.5), vec(44.8, 38.5)];  // Türkiye's west and east ends: it must sit clear of both fades
  function fits(cam, z, pts) {
    var B = basis(cam), Rz = R * z, xl = cx + xtPx + .3 * Rz;
    function ok(v, pad) {
      if (dot(v, B.c) < .45) return false;
      var x = cx + Rz * dot(v, B.e), y = cy - Rz * dot(v, B.n);
      if (x < xl || x > W - 20 || y < 24 || y > H - 24) return false;
      return !(clear && x > clear.x0 - pad && x < clear.x1 + pad && y > clear.y0 - pad && y < clear.y1 + pad);
    }
    return pts.every(function (v) { return ok(v, 16); }) && TREND.every(function (v) { return ok(v, 56); });
  }
  function place(i) {
    var m = slerp(STOPS[i], TRC, .5), pts = [], ll = lonlat(m), j;
    if (narrow) return { cam: solve(m, 0, -.02), z: 1 };
    for (j = 0; j <= 12; j++) pts.push(lift(i, j / 12));
    var first = solve(m, .1, .04);
    if (fits(first, 1, pts)) return { cam: first, z: 1 };
    for (var z = 1; z >= .5; z -= .02) {
      var best = null, bd = 1e9;
      for (var L = ll[0] - 60; L <= ll[0] + 60; L += 2) for (var P = -30; P <= 80; P += 2) {
        var cam = vec(L, P);
        if (!fits(cam, z, pts)) continue;
        var B = basis(cam), dx = R * z * dot(m, B.e) - (.12 * R), dy = R * z * dot(m, B.n), d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = cam; }
      }
      if (best) return { cam: best, z: z };
    }
    return { cam: first, z: .5 };
  }
  // Browsers have no Turkish hyphenation, and justified lines need it, so mark the syllable breaks: a break falls before the
  // consonant that precedes a vowel. Names and the part after an apostrophe are left whole.
  function shyTr() {
    if (document.documentElement.lang !== 'tr') return;
    var V = 'aeıioöuüâîûAEIİOÖUÜ', KEEP = /^(Caldara|Iacoviello)$/;
    function word(w) {
      if (w.length < 6 || KEEP.test(w)) return w;
      var o = '', i;
      for (i = 0; i < w.length; i++) {
        var brk = i >= 2 && i <= w.length - 3 && V.indexOf(w[i]) < 0 && V.indexOf(w[i + 1]) >= 0 && /[aeıioöuüâîûAEIİOÖUÜ]/.test(o);
        o += (brk ? '\u00ad' : '') + w[i];
      }
      return o;
    }
    flow.querySelectorAll('.s4-h1,.s4-defs p').forEach(function (el) {
      var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
      while ((n = tw.nextNode())) n.nodeValue = n.nodeValue.replace(/[A-Za-zÇĞİÖŞÜçğıöşüâîû]+(?=(’|')?)/g, function (w, _a, at, s) { return at && (s[at - 1] === '’' || s[at - 1] === "'") ? w : word(w); });
    });
  }
  shyTr();
  // one arc shared by the text and the globe's fade, so the words follow the curve of the land. The wrapped text can make
  // the hero taller, and the hero's height sets the arc, so this settles on a height that fits the text it produces.
  function setArc() {
    if (narrow) { arc = null; arcEl.style.shapeOutside = ''; arcEl.style.height = ''; return; }
    var cs = getComputedStyle(col), pb = parseFloat(cs.paddingBottom), min = parseFloat(getComputedStyle(hero).minHeight) || 0;
    var defs = flow.querySelector('.s4-defs'), hh = min, g, f, need, i;
    for (i = 0; i < 5; i++) {
      g = ground.getBoundingClientRect(); f = flow.getBoundingClientRect();
      var rad = .68 * hh;
      arc = { cc: col.getBoundingClientRect().right - g.left - 44 + rad, rad: rad };
      arcEl.style.height = Math.max(0, hh - (f.top - g.top) - pb) + 'px';
      arcEl.style.shapeOutside = 'circle(' + rad.toFixed(1) + 'px at ' + (arc.cc - (f.left - g.left)).toFixed(1) + 'px ' + (.5 * hh - (f.top - g.top)).toFixed(1) + 'px)';
      need = Math.max(min, Math.ceil(defs.getBoundingClientRect().bottom - g.top + pb));
      if (Math.abs(need - hh) < 2) break;
      hh = need;
    }
  }
  function arcEdge(py) { var dy = Math.min(arc.rad, Math.abs(py - cy)); return arc.cc - Math.sqrt(arc.rad * arc.rad - dy * dy); }
  function layout() {
    narrow = matchMedia('(max-width: 1099px)').matches;
    setArc();
    var r = ground.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    cx2.setTransform(d, 0, 0, d, 0, 0);
    baseCv.width = cv.width; baseCv.height = cv.height; basex.setTransform(d, 0, 0, d, 0, 0); baseKey = null;
    if (narrow) { cx = W / 2; cy = H / 2; R = Math.min(.56 * W, .6 * H); xtPx = -2 * R; clear = null; }
    else {
      cx = .63 * W; cy = .5 * H; R = Math.max(.68 * H, .4 * W);
      // the land fades out before the text column: nothing on the globe sits under the text
      xtPx = col.getBoundingClientRect().right - r.left + 24 - cx;
      // the stop's facts sit in the map's bottom right corner: the land shows through, but no line or Türkiye goes under them
      var lifted = panel.style.translate; panel.style.translate = '';
      var q = panel.getBoundingClientRect();
      panel.style.translate = lifted;
      clear = { x0: q.left - r.left - 14, x1: q.right - r.left + 14, y0: q.top - r.top - 10, y1: q.bottom - r.top };
    }
    var ps = STOPS.map(function (_, i) { return place(i); });
    cams = ps.map(function (p) { return p.cam; }); zooms = ps.map(function (p) { return p.z; });
  }

  /* ---------- drawing ---------- */
  var BUCKETS = 10;
  // the land is drawn once per camera position onto its own canvas; while the globe holds, only the shock's dots are redrawn
  var baseCv = document.createElement('canvas'), basex = baseCv.getContext('2d'), baseKey = null, baseTR = null;
  function fillDots(x, groups, rgb, top, s) {
    for (var k = 1; k < BUCKETS; k++) {
      var g = groups[k]; if (!g.length) continue;
      x.fillStyle = 'rgba(' + rgb + ',' + (k / (BUCKETS - 1) * top).toFixed(3) + ')';
      x.beginPath(); for (var i = 0; i < g.length; i += 2) x.rect(g[i], g[i + 1], s, s); x.fill();
    }
  }
  function frame(cam, ovIn, ovOut, out) {
    var B = basis(cam), e = B.e, n = B.n, c = B.c;
    var s = Math.max(1.4, R / 250), fw = .3, maxA = colour.A + colour.B, Rz = R * Z, xt = xtPx / Rz;
    var x = cx2;
    // dots, grouped by opacity so each group is one fill; Türkiye's are the same dots in red, shaded the same way
    function bucket(pts, top, base, slope) {
      var groups = [], k; for (k = 0; k < BUCKETS; k++) groups.push([]);
      for (var i = 0; i < pts.length; i += 3) {
        var X = pts[i], Y = pts[i + 1], Z_ = pts[i + 2];
        var dz = X * c[0] + Y * c[1] + Z_ * c[2]; if (dz < 0) continue;
        var u = X * e[0] + Y * e[1] + Z_ * e[2];
        var px = cx + Rz * u, py = cy - Rz * (X * n[0] + Y * n[1] + Z_ * n[2]);
        var ex = arc ? (arcEdge(py) - cx) / Rz : xt;
        var f = sstep(ex, ex + fw, u); if (f <= 0) continue;
        if (px < -4 || px > W + 4 || py < -4 || py > H + 4) continue;
        k = Math.min(BUCKETS - 1, Math.round((base + slope * dz) * f / top * (BUCKETS - 1))); if (k === 0) continue;
        groups[k].push(px - s / 2, py - s / 2);
      }
      return groups;
    }
    function P(v) { return [cx + Rz * dot(v, e), cy - Rz * dot(v, n), dot(v, c)]; }
    if (out) return svg(bucket(land, maxA, colour.A, colour.B), bucket(trLand, colour.redA, colour.redA * .35, colour.redA * .65), s, maxA, P, ovIn);
    var key = cam[0] + ',' + cam[1] + ',' + cam[2] + ',' + Z;
    if (key !== baseKey) {
      basex.clearRect(0, 0, W, H);
      fillDots(basex, bucket(land, maxA, colour.A, colour.B), colour.ink, maxA, s);
      baseTR = bucket(trLand, colour.redA, colour.redA * .35, colour.redA * .65);
      baseKey = key;
    }
    x.clearRect(0, 0, W, H);
    x.drawImage(baseCv, 0, 0, W, H);
    if (ovOut && ovOut.a > 0) overlay(ovOut.i, 1, 1, ovOut.a, P, s);
    var flash = ovIn ? overlay(ovIn.i, ovIn.ring, ovIn.arc, 1, P, s) : 0;
    fillDots(x, baseTR, colour.red, colour.redA, s);
    if (flash > .01) fillDots(x, baseTR, colour.red, flash * .6, s);  // a pulse has reached Türkiye
  }
  // a point on the arc from the shock to Türkiye, t from 0 to 1, raised off the surface: the longer the arc, the higher
  function lift(i, t) {
    var v = slerp(STOPS[i], TRC, t), th = Math.acos(clamp(dot(STOPS[i], TRC), -1, 1)), h = 1 + (.012 + .06 * th) * Math.sin(Math.PI * t);
    return [v[0] * h, v[1] * h, v[2] * h];
  }
  // a circle of radius rd degrees on the sphere around point E
  function circlePt(E, Bq, rd, phi) {
    var r0 = rd * rad, c0 = Math.cos(r0), s0 = Math.sin(r0), cp = Math.cos(phi), sp = Math.sin(phi);
    return [E[0] * c0 + s0 * (Bq.e[0] * cp + Bq.n[0] * sp), E[1] * c0 + s0 * (Bq.e[1] * cp + Bq.n[1] * sp), E[2] * c0 + s0 * (Bq.e[2] * cp + Bq.n[2] * sp)];
  }
  var RIPPLE = 3000, RMAX = 5;  // one ripple's life in ms and its reach in degrees
  var ARC_MS = 2200, TRAVEL = 2000, GAP = 700;  // arc drawing in, one red dot's trip, and the wait between dots: all ms, within HOLD
  // the shock in the globe's own language, in dots: ripples spread over the surface at the event, a dotted arc rises to
  // Türkiye and three red dots travel along it. Under reduced motion the ripples and the arc stand still and nothing travels.
  function overlay(i, ring, arc, alpha, P, s) {
    var x = cx2, E = STOPS[i], Bq = basis(E), ink = 'rgba(' + colour.ink + ',', calm = reduce.matches, flash = 0, k, j;
    for (k = 0; k < 3; k++) {
      var ph = calm ? (k + 1) * .28 : (fx / RIPPLE + k / 3) % 1;
      var a = alpha * ring * Math.pow(1 - ph, 1.3) * .8; if (a < .01) continue;
      var rd = .8 + (RMAX - .8) * easeOut(ph), N = Math.max(8, Math.round(2 * Math.PI * Math.sin(rd * rad) / (1 * rad)));
      var sr = s * 1.2;
      x.fillStyle = ink + a.toFixed(3) + ')'; x.beginPath();
      for (j = 0; j < N; j++) {
        var q = P(circlePt(E, Bq, rd, j / N * 2 * Math.PI));
        if (q[2] > .05) x.rect(q[0] - sr / 2, q[1] - sr / 2, sr, sr);
      }
      x.fill();
    }
    var c0 = P(E), c1 = P(TRC), len = Math.max(30, Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) * 1.08);
    if (arc > 0) {
      var M = Math.max(6, Math.round(len / 8)), sa = s * .7;
      x.fillStyle = ink + (.5 * alpha).toFixed(3) + ')'; x.beginPath();
      for (j = 1; j < M && j / M <= arc; j++) { var qa = P(lift(i, j / M)); x.rect(qa[0] - sa / 2, qa[1] - sa / 2, sa, sa); }
      x.fill();
    }
    if (ring > 0) { x.fillStyle = ink + (alpha * easeOut(ring)).toFixed(3) + ')'; x.beginPath(); x.arc(c0[0], c0[1], 3, 0, Math.PI * 2); x.fill(); }
    // once the arc is drawn, three red dots set off one after another; each takes TRAVEL to reach Türkiye and does not repeat
    if (!calm && arc >= 1 && alpha >= 1) {
      for (j = 0; j < 3; j++) {
        var u = (fx - ARC_MS - j * GAP) / TRAVEL; if (u < 0) continue;
        if (u >= 1) { flash = Math.max(flash, Math.exp(-(u - 1) * TRAVEL / 340)); continue; }
        var qp = P(lift(i, (1 - Math.cos(Math.PI * u)) / 2)), sz = s * 1.4;  // starts and ends gently
        x.fillStyle = 'rgba(' + colour.red + ',' + (sstep(0, .1, u) * (1 - sstep(.92, 1, u)) * .6).toFixed(3) + ')';
        x.fillRect(qp[0] - sz / 2, qp[1] - sz / 2, sz, sz);
      }
    }
    return flash;
  }
  // the no-JS still: the same frame as SVG (make_data.py asks for it once and saves it as src/samples/S4/still.svg)
  function svg(groups, trGroups, s, maxA, P, ovIn) {
    var f1 = function (v) { return Math.round(v * 10) / 10; }, sd = f1(s);
    var o = '<svg class="s4-still" viewBox="0 0 ' + Math.round(W) + ' ' + Math.round(H) + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">';
    function dots(gs, cls, top) {
      var t = '';
      for (var k = 1; k < BUCKETS; k++) {
        var g = gs[k]; if (!g.length) continue;
        t += '<path class="' + cls + '" fill-opacity="' + (k / (BUCKETS - 1) * top).toFixed(3) + '" d="';
        for (var i = 0; i < g.length; i += 2) t += 'M' + f1(g[i]) + ' ' + f1(g[i + 1]) + 'h' + sd + 'v' + sd + 'h-' + sd + 'z';
        t += '"/>';
      }
      return t;
    }
    o += dots(groups, 'd', maxA);
    var j, line = '';
    for (j = 0; j <= 64; j++) { var ql = P(lift(ovIn.i, j / 64)); line += (j ? 'L' : 'M') + f1(ql[0]) + ' ' + f1(ql[1]); }
    o += '<path class="arc" d="' + line + '"/>';
    var E = STOPS[ovIn.i], Bq = basis(E), q = P(E);
    [2.5, 4.5].forEach(function (rd) {
      var d = ''; for (var m = 0; m <= 48; m++) { var qr = P(circlePt(E, Bq, rd, m / 48 * 2 * Math.PI)); d += (m ? 'L' : 'M') + f1(qr[0]) + ' ' + f1(qr[1]); }
      o += '<path class="ring" d="' + d + '"/>';
    });
    o += '<circle class="pin" cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" r="3"/>';
    o += dots(trGroups, 'tr', colour.redA);
    return o + '</svg>';
  }

  /* ---------- the cycle ---------- */
  var S = { cam: null, i: 0, mode: 'hold', move: null, holdLeft: HOLD };
  var ovIn = null, ovOut = null, raf = 0, last = 0, suspended = false, paused = false, dirty = true, fx = 0;

  // a move: slow turn at SPEED, ending in a 1.4 s ease onto the stop; short moves are a single 1.4 s ease
  function makeMove(from, to) {
    var t = T(), theta = Math.acos(clamp(dot(from, to), -1, 1)) / rad;
    var v = SPEED / t, ta = .8 * t, td = 1.4 * t, D, prof;
    var dA = v * ta / 2, dD = v * td / 2;
    if (theta <= dA + dD + .5) { D = td; prof = function (u) { return easeIO(clamp(u / D, 0, 1)); }; }
    else {
      var tc = (theta - dA - dD) / v; D = ta + tc + td;
      prof = function (u) {
        var d;
        if (u <= ta) d = v * u * u / (2 * ta);
        else if (u <= ta + tc) d = dA + v * (u - ta);
        else { var w = clamp(u - ta - tc, 0, td); d = dA + v * tc + v * w - v * w * w / (2 * td); }
        return clamp(d / theta, 0, 1);
      };
    }
    return { from: from, to: to, z0: Z, z1: zooms[S.i], D: D * 1000, t: 0, prof: function (ms) { return prof(ms / 1000); } };
  }
  function setCaption(j) {
    caps.forEach(function (li, k) { li.classList.toggle('is-on', k === j); });
  }
  function goTo(j) {
    if (S.i !== j || S.mode !== 'hold' || !ovIn) {
      if (ovIn) ovOut = { i: ovIn.i, a: 1 };
      ovIn = null;
    }
    S.i = j; setCaption(j);
    S.move = makeMove(S.cam, cams[j]); S.mode = 'move';
    kick();
  }
  function arrive() {
    S.mode = 'hold'; S.holdLeft = HOLD; S.cam = cams[S.i]; Z = zooms[S.i];
    ovIn = { i: S.i, ring: 0, arc: 0, t: 0 }; fx = 0;
  }
  function busy() { return S.mode === 'move' || (ovIn && ovIn.t < 1) || (ovOut && ovOut.a > 0) || S.mode === 'hold'; }
  function tick(ts) {
    raf = 0;
    if (suspended || paused) return;
    var dt = last ? Math.min(100, ts - last) : 16; last = ts;
    var t = T() * 1000;
    if (S.mode === 'move') {
      S.move.t += dt;
      var pr = S.move.prof(S.move.t);
      S.cam = slerp(S.move.from, S.move.to, pr); Z = S.move.z0 + (S.move.z1 - S.move.z0) * pr;
      dirty = true;
      if (S.move.t >= S.move.D) arrive();
    } else if (S.mode === 'hold') {
      S.holdLeft -= dt;
      if (S.holdLeft <= 0) goTo((S.i + 1) % STOPS.length);
      else if (!reduce.matches) { fx += dt; dirty = true; }
    }
    if (ovOut && ovOut.a > 0) { ovOut.a = Math.max(0, ovOut.a - dt / (.35 * t)); dirty = true; }
    if (ovIn && ovIn.t < 1) {
      ovIn.t = Math.min(1, ovIn.t + dt / (ARC_MS / 1000 * t));
      ovIn.ring = clamp(ovIn.t / .45, 0, 1); ovIn.arc = easeIO(clamp((ovIn.t - .15) / .85, 0, 1));
      dirty = true;
    }
    if (dirty) { frame(S.cam, ovIn, ovOut); dirty = false; }
    if (busy()) raf = requestAnimationFrame(tick); else last = 0;
  }
  function kick() { if (!raf && !suspended && !paused) { raf = requestAnimationFrame(tick); } }

  // pause while off screen or in a background tab
  function setSuspended(v) { suspended = v; if (!v) { last = 0; dirty = true; kick(); } }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { setSuspended(!es[0].isIntersecting); }).observe(hero);
  document.addEventListener('visibilitychange', function () { setSuspended(document.hidden); });

  // theme and size
  function redraw() { readColours(); baseKey = null; dirty = true; if (!raf) frame(S.cam, ovIn, ovOut); }
  new MutationObserver(redraw).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
  var rt = 0;
  function relayout() {
    layout();
    if (S.mode === 'hold') { S.cam = cams[S.i]; Z = zooms[S.i]; } else S.move = makeMove(S.cam, cams[S.i]);
    dirty = true; frame(S.cam, ovIn, ovOut); kick();
  }
  addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(relayout, 120); });
  // the corner clearing follows the panel's real size once the font has loaded
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);

  // the pause button (WCAG 2.2.2): holds the current stop until pressed again
  var pb = hero.querySelector('.s4-pause');
  if (pb) {
    pb.hidden = false;
    pb.addEventListener('click', function () {
      paused = !paused; last = 0;
      pb.classList.toggle('is-paused', paused);
      pb.querySelector('span').textContent = pb.getAttribute(paused ? 'data-play' : 'data-pause');
      if (!paused) { dirty = true; kick(); }
    });
  }

  // while the cookie panel is open on desktop, the facts and the button sit just above it
  var consent = document.getElementById('consent');
  function clearConsent() {
    panel.style.translate = '';
    if (!consent || !consent.classList.contains('show') || getComputedStyle(panel).display === 'contents') return;
    var over = panel.getBoundingClientRect().bottom + scrollY - consent.getBoundingClientRect().top + 12;
    if (over > 0) panel.style.translate = '0 ' + (-Math.round(over)) + 'px';
  }
  if (consent) new MutationObserver(clearConsent).observe(consent, { attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', clearConsent);

  /* ---------- start ---------- */
  hero.classList.add('s4-live');
  readColours(); layout();
  setCaption(0);
  if (reduce.matches || T() < .01) {
    // no rotation: the globe cuts from stop to stop, so every caption is still seen
    Z = zooms[0]; S.cam = cams[0]; arrive(); ovIn.t = 1; ovIn.ring = 1; ovIn.arc = 1;
    frame(S.cam, ovIn, null);
    kick();
  } else {
    // a short turn in from the east onto the first stop
    var ll = lonlat(cams[0]);
    Z = zooms[0];
    S.cam = vec(ll[0] + 14, ll[1]);
    S.move = makeMove(S.cam, cams[0]); S.mode = 'move';
    frame(S.cam, null, null);
    kick();
  }

  clearConsent();
  addEventListener('load', clearConsent);

  window.S4 = { still: function () { var o = { i: 0, ring: 1, arc: 1 }; Z = zooms[0]; return frame(cams[0], o, null, true); } };
})();
