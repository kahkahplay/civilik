/* Civili'k 0.6 · MAPA DEL MUNDO (sin DOM): terreno generado con la semilla de la partida, 100×100 casillas, la ciudad en el centro.
   Tipos de casilla: a agua, l llanura, b bosque, p colinas, m montaña (roca). «dentro» marca lo explorable; el borde irregular es niebla.
   Sale SOLO de la semilla: es estable entre sesiones y no hace falta guardarlo en la partida. */
(function (g) {
  'use strict';
  const J = g.CivilikJuego, D = g.CivilikDatos;
  const cache = {};
  function generarMundo(semilla, N = (D.mundo || {}).lado || 100) {
    const k = (semilla >>> 0) + ':' + N; if (cache[k]) return cache[k];
    const rnd = J.azar(((semilla >>> 0) ^ 0xA11CE5) >>> 0), s = t => t * t * (3 - 2 * t);
    // ruido de valor en varias octavas (rejillas de 6, 13 y 27 nodos)
    const octava = G => { const b = new Float32Array(G * G); for (let i = 0; i < b.length; i++) b[i] = rnd(); return { G, b }; };
    const muestra = (o, x, y) => { const G = o.G, fx = x / (N - 1) * (G - 1), fy = y / (N - 1) * (G - 1), x0 = Math.min(G - 2, Math.floor(fx)), y0 = Math.min(G - 2, Math.floor(fy)), tx = s(fx - x0), ty = s(fy - y0);
      const v = (i, j) => o.b[j * G + i], a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * tx, d = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * tx; return a + (d - a) * ty; };
    const alt = [octava(6), octava(13), octava(27)], hum = [octava(7), octava(17)], bor = octava(9);
    const ruido = (os, pesos, x, y) => os.reduce((t, o, i) => t + muestra(o, x, y) * pesos[i], 0) / pesos.reduce((a, b) => a + b, 0);
    const c = (N - 1) / 2, celdas = new Array(N * N), dentro = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, dc = Math.hypot(x - c, y - c);
      // borde de niebla: 2–5 casillas irregulares alrededor del cuadrado
      const margen = Math.min(x, y, N - 1 - x, N - 1 - y), b = 2 + muestra(bor, x, y) * 3.2;
      dentro[i] = margen >= b ? 1 : 0;
      let h = ruido(alt, [0.55, 0.3, 0.15], x, y), w = ruido(hum, [0.65, 0.35], x, y);
      h = 0.5 + (h - 0.5) * 1.9;   // más contraste (el promedio de octavas aplana)
      w = 0.5 + (w - 0.5) * 1.7;
      if (dc < 5) { celdas[i] = 'l'; continue; }                 // llanura alrededor de tu ciudad
      if (dc < 8) h = Math.min(Math.max(h, 0.36), 0.62);
      celdas[i] = h < 0.27 ? 'a' : h > 0.8 ? 'm' : h > 0.68 ? 'p' : w > 0.56 ? 'b' : 'l';
    }
    const m = { n: N, celdas: celdas.join(''), dentro, capital: { x: Math.round(c), y: Math.round(c) } };
    m.capital = { x: Math.floor(c), y: Math.floor(c) };
    return (cache[k] = m);
  }
  const tipoEn = (m, x, y) => (x < 0 || y < 0 || x >= m.n || y >= m.n) ? null : m.celdas[y * m.n + x];
  const libre = (m, x, y) => x >= 1 && y >= 1 && x < m.n - 1 && y < m.n - 1 && m.dentro[y * m.n + x] && m.celdas[y * m.n + x] !== 'a';
  const distCapital = (m, x, y) => Math.hypot(x - m.capital.x, y - m.capital.y);
  // Nivel según la distancia a la ciudad: 1 cerca … 30 a unas 46 casillas (± 1 al azar)
  // 0.6: amp = amplitud del azar (los monstruos usan ± D.monstruos.nivelAzar = 3 para tener más variedad de niveles)
  function nivelPorDistancia(d, r, amp = 1) {
    const P = D.monstruos.nivelPorDistancia, base = 1 + (d - P.desde) * 29 / (P.hasta - P.desde);
    return Math.max(1, Math.min(30, Math.round(base + (r ? (r() - 0.5) * 2 * amp : 0))));
  }
  // 0.6 · distancia «de una punta a otra» para el tiempo de marcha en Clásica: del centro a una esquina (≈ 70 casillas)
  const distMax = m => Math.hypot(m.n - 1 - m.capital.x, m.n - 1 - m.capital.y);
  g.CivilikMundo = { distMax, generarMundo, tipoEn, libre, distCapital, nivelPorDistancia };
})(typeof window !== 'undefined' ? window : globalThis);
