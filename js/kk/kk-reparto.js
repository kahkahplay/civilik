/* kk-comun · kk-reparto.js — «Auto»: elige las unidades justas para cubrir una carga (kk digital studio)
   Origen: Civili'k 0.8 (botón «Auto» al mandar obreros a farmear). Sin DOM: sirve en navegador y en Node.
   repartirCarga(necesario, tipos) → { asignados: {id: n}, carga, unidades, falta }
     tipos: [{ id, carga, disponibles }] (carga por unidad > 0). Busca cubrir «necesario» con POCAS unidades
     (primero las de más carga, sin pasarse) y remata con la que menos sobre. Si no alcanza, manda todo lo que hay. */
(function (g) {
  'use strict';
  function repartirCarga(necesario, tipos) {
    const lista = (tipos || []).filter(t => t && t.carga > 0 && t.disponibles > 0).map(t => ({ id: t.id, carga: t.carga, quedan: Math.floor(t.disponibles) }))
      .sort((a, b) => b.carga - a.carga);
    const asignados = {}; let resto = Math.max(0, Math.ceil(necesario || 0));
    const toma = (t, n) => { if (n <= 0) return; asignados[t.id] = (asignados[t.id] || 0) + n; t.quedan -= n; resto -= n * t.carga; };
    // 1) sin pasarse, de mayor a menor carga
    for (const t of lista) { if (resto <= 0) break; toma(t, Math.min(t.quedan, Math.floor(resto / t.carga))); }
    // 2) remate: la opción que cubre lo que falta con menos unidades (y, a igualdad, la que menos sobra)
    if (resto > 0) {
      let mejor = null;
      for (const t of lista) { if (!t.quedan) continue; const u = Math.ceil(resto / t.carga); if (u > t.quedan) continue; const sobra = u * t.carga - resto;
        if (!mejor || u < mejor.u || (u === mejor.u && sobra < mejor.sobra)) mejor = { t, u, sobra }; }
      if (mejor) toma(mejor.t, mejor.u);
      else for (const t of lista) { if (resto <= 0) break; toma(t, Math.min(t.quedan, Math.ceil(resto / t.carga))); }
    }
    const carga = Object.entries(asignados).reduce((s, [id, n]) => s + n * lista.find(t => t.id === id).carga, 0);
    return { asignados, carga, unidades: Object.values(asignados).reduce((a, b) => a + b, 0), falta: Math.max(0, Math.ceil(necesario || 0) - carga) };
  }
  g.KKReparto = { repartirCarga };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.KKReparto;
})(typeof window !== 'undefined' ? window : globalThis);
