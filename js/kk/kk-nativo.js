/* kk-comun · kk-nativo · puente mínimo con Android (Capacitor) sin dependencias externas.
   Origen: Véncelo 1.1 (detección de plataforma y acceso a plugins de util.js / nativo.js), generalizado,
   más el plugin nativo KKNativo (android/java/kk/comun/KKNativoPlugin.java) para abrir enlaces en el navegador del móvil
   y (desde Padelika 1.2) para el color de las barras del sistema según el tema claro u oscuro.
   En el navegador (pruebas) los enlaces se registran en window.__kkEnlaces y se abren con window.open. */
(function (g) {
  'use strict';
  const cap = () => g.Capacitor;
  const esNativo = () => { const c = cap(); return !!(c && c.isNativePlatform && c.isNativePlatform()); };
  function plugin(nombre) {
    const c = cap(); if (!c) return null;
    return (c.Plugins && c.Plugins[nombre]) || (esNativo() && c.registerPlugin ? c.registerPlugin(nombre) : null);
  }
  g.__kkEnlaces = g.__kkEnlaces || [];
  async function abrirEnlace(url) {
    if (!/^https:\/\//i.test(url || '')) throw new Error('Solo se abren enlaces https');
    g.__kkEnlaces.push(url);
    if (esNativo()) { const p = plugin('KKNativo'); if (p) { await p.abrirEnlace({ url }); return 'NATIVO'; } }
    g.open(url, '_blank', 'noopener');
    return 'NAVEGADOR';
  }
  // Desde Padelika 1.2 · color de fondo de las barras del sistema (estado y navegación) e iconos claros si el fondo es oscuro.
  // En el navegador solo se recuerda en window.__kkBarras (pruebas).
  async function colorBarras(color, oscuro) {
    if (!/^#[0-9a-f]{6}$/i.test(color || '')) throw new Error('Color no válido');
    g.__kkBarras = { color, oscuro: !!oscuro };
    if (esNativo()) { const p = plugin('KKNativo'); if (p && p.colorBarras) { await p.colorBarras({ color, oscuro: !!oscuro }); return 'NATIVO'; } }
    return 'NAVEGADOR';
  }
  g.KKNativo = { esNativo, plugin, abrirEnlace, colorBarras };
})(window);
