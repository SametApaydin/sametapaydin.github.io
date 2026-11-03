/* Shell behaviour: theme, menu, bar hide-on-scroll, consent panel, prototype forms. No third-party code. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  function ls(k, v) { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch (e) { return null; } }

  /* theme: the shared key of the dashboards (trr-theme) */
  function applyTheme(t) { if (t === 'dark' || t === 'light') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme'); }
  applyTheme(ls('trr-theme'));
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-theme-toggle]'); if (!b) return;
    // on a dashboard its own button does the switch, so its charts redraw
    var own = d.getElementById('themeToggle') || d.getElementById('theme');
    if (own) { own.click(); return; }
    var cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next); ls('trr-theme', next);
    d.querySelectorAll('[data-theme-toggle]').forEach(function (x) { x.setAttribute('aria-label', x.getAttribute(next === 'dark' ? 'data-l-light' : 'data-l-dark')); });
  });

  /* language word: write the dashboards' key on click, then follow the link */
  d.addEventListener('click', function (e) {
    var a = e.target.closest('[data-lang]'); if (a) ls('trr-lang', a.getAttribute('data-lang'));
  });

  /* header menu (phones) and bar menu (dashboard pages) */
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-menu]'); if (!b) return;
    var id = b.getAttribute('aria-controls'), box = id && d.getElementById(id), hd = b.closest('.hd');
    var open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (hd) hd.classList.toggle('open', open);
    if (box) box.classList.toggle('open', open);
  });
  /* the dashboard bar's panel closes with Escape, focus back on its button */
  d.addEventListener('keydown', function (e) {
    var more = d.getElementById('sb-more');
    if (e.key !== 'Escape' || !more || !more.classList.contains('open')) return;
    more.classList.remove('open');
    var b = d.querySelector('.sb [data-menu]'); b.setAttribute('aria-expanded', 'false'); b.focus();
  });
  /* an English dashboard written in Turkish says so under the bar, at every width, until closed or scrolled past */
  var note = d.querySelector('[data-note]');
  if (note) {
    note.querySelector('[data-note-close]').addEventListener('click', function () { note.hidden = true; });
    addEventListener('scroll', function () { if (scrollY > 200) note.hidden = true; }, { passive: true });
  }
  /* the dashboard bar's panel closes on a click elsewhere */
  d.addEventListener('click', function (e) {
    var more = d.getElementById('sb-more');
    if (!more || !more.classList.contains('open') || e.target.closest('.sb-more,[data-menu]')) return;
    more.classList.remove('open');
    d.querySelector('.sb [data-menu]').setAttribute('aria-expanded', 'false');
  }, true);  // capture: the maps stop clicks from bubbling

  /* site header: a soft pill rests on the current page and follows the pointer; a hairline appears once the page has scrolled */
  var hd = d.querySelector('[data-hd]');
  if (hd) {
    var seen = function () { hd.classList.toggle('scrolled', scrollY > 4); };
    addEventListener('scroll', seen, { passive: true }); seen();
    var nav = hd.querySelector('.nav,.sb-nav'), pill = hd.querySelector('.nav-pill'), wide = matchMedia('(min-width: 981px)');
    var cur = function () { return nav.querySelector('a[aria-current="page"]'); };
    var near = null;
    var move = function (a) {
      if (near) near.classList.remove('is-near');
      near = a; if (a) a.classList.add('is-near');
      if (!a || !wide.matches) { pill.style.opacity = 0; return; }
      pill.style.width = a.offsetWidth + 'px'; pill.style.transform = 'translateX(' + a.offsetLeft + 'px)'; pill.style.opacity = 1;
    };
    nav.classList.add('has-pill');
    nav.addEventListener('mouseover', function (e) { var a = e.target.closest('a'); if (a) move(a); });
    nav.addEventListener('focusin', function (e) { var a = e.target.closest('a'); if (a) move(a); });
    nav.addEventListener('mouseleave', function () { move(cur()); });
    nav.addEventListener('focusout', function () { move(cur()); });
    var rest = function () { pill.style.transition = 'none'; move(cur()); pill.offsetWidth; pill.style.transition = ''; };
    rest(); addEventListener('resize', rest);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(rest);
  }

  /* the slim bar hides on scroll down, returns on scroll up (dashboard scroll pages only) */
  var bar = d.querySelector('[data-hide]'), last = 0;
  if (bar) addEventListener('scroll', function () {
    var y = scrollY; bar.classList.toggle('hide', y > last && y > 80); last = y;
  }, { passive: true });

  /* consent panel: the decision is written on a click and kept 365 days */
  var panel = d.getElementById('consent');
  if (panel) {
    var KEY = 'mra-consent';
    function stored() { try { var v = JSON.parse(ls(KEY)); return v && v.exp > Date.now() ? v : null; } catch (e) { return null; } }
    function save(analytics) { ls(KEY, JSON.stringify({ necessary: true, analytics: !!analytics, at: new Date().toISOString(), exp: Date.now() + 365 * 864e5 })); }
    function show() { panel.classList.add('show'); panel.querySelector('button').focus(); }
    function hide() { panel.classList.remove('show'); panel.classList.remove('prefs-open'); }
    if (!stored()) show();
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'accept') { save(true); hide(); }
      else if (act === 'reject') { save(false); hide(); }
      else if (act === 'prefs') { panel.classList.toggle('prefs-open'); b.setAttribute('aria-expanded', panel.classList.contains('prefs-open')); }
      else if (act === 'save') { save(panel.querySelector('[name=analytics]').checked); hide(); }
    });
    d.addEventListener('click', function (e) { if (e.target.closest('[data-consent-open]')) { var s = stored(); if (s) panel.querySelector('[name=analytics]').checked = !!s.analytics; show(); panel.classList.add('prefs-open'); } });
  }

  /* prototype forms: validate the consent box, show the message, store nothing */
  d.querySelectorAll('form[data-proto]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var c = f.querySelector('input[type=checkbox][required]'), err = f.querySelector('.err'), msg = f.querySelector('.msg');
      if (c && !c.checked) { if (err) err.classList.add('show'); c.focus(); return; }
      if (err) err.classList.remove('show');
      if (msg) { msg.classList.add('show'); msg.setAttribute('tabindex', '-1'); msg.focus(); }
      f.reset();
    });
  });
})();
