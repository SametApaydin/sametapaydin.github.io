(function () {
  const GEO = '/assets/vendor/world-atlas-2.0.2-countries-50m.json';
  const V = '20261025e';
  const SRC = new URLSearchParams(location.search).get('src') === 'tuik' ? 'tuik' : 'baci';
  const script = src => new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });

  function fmt(mn) {
    if (mn >= 1000) { const d = mn >= 100000 ? 0 : 1; return (mn / 1000).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' mlr $'; }
    if (mn >= 1) return Math.round(mn).toLocaleString('tr-TR') + ' mn $';
    return (mn > 0 ? '<\u00a01 mn $' : '0');
  }

  async function load() {
    const [topo] = await Promise.all([d3.json(GEO), window.MAPDATA ? null : script((SRC === 'tuik' ? 'data_tuik.js' : 'data.js') + '?v=' + V)]);
    const M = window.MAPDATA;
    let features = topojson.feature(topo, topo.objects.countries).features.filter(f => f.id !== '010');
    features.forEach(f => { if (f.id == null && f.properties.name === 'Kosovo') f.id = 'XK'; });
    const seen = {};
    features = features.filter(f => {
      if (f.id == null) return true;
      const g = seen[f.id];
      if (!g) { seen[f.id] = f; return true; }
      const polys = x => x.geometry.type === 'Polygon' ? [x.geometry.coordinates] : x.geometry.coordinates;
      g.geometry = { type: 'MultiPolygon', coordinates: polys(g).concat(polys(f)) };
      return false;
    });
    const sums = m => M.years.map((_, yi) => m.reduce((s, r) => s + r[yi], 0));
    const byId = {};
    Object.entries(M.p).forEach(([id, p]) => {
      byId[id] = { n: p.n, note: p.note, info: p.info, exp: sums(p.exp), imp: sums(p.imp), m: { exp: p.exp, imp: p.imp } };
    });
    const data = {
      years: M.years, families: M.families, order: M.order, tot: M.tot, byId, source: M.source, src: SRC,
      partial: M.partial || {},
      mixOf(id, d, yi) {
        const c = byId[id], t = c[d][yi], o = {};
        M.order.forEach((f, i) => { o[f] = t > 0 ? c.m[d][i][yi] / t : 0; });
        return o;
      }
    };
    const trF = features.find(f => f.id === '792');
    return { features, data, fmt, tr: { id: '792', ll: [32.85, 39.93], feature: trF } };
  }

  window.MapBase = { load, fmt, V };
})();
