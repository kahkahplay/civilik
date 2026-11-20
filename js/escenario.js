/* Civili'k 0.5 · terreno de la ciudad (0.2) y del mapa del mundo (0.5) según el LEEME 0.2 de Camachin.
   - Datos por celda de 32 dp (hierba por defecto; agua, roca, camino, plaza; niebla en el mapa).
   - Rejilla dual: las piezas de transición se pintan desplazadas media celda y miran sus 4 esquinas (NO, NE, SO, SE) → 15 combinaciones.
   - Variantes (hierba, a/b, asientos…) por posición con un hash determinista; nunca al azar en cada pintado.
   - Orden de pintado del LEEME §3. Todo se dibuja una vez en un <canvas> (cacheado) con los PNG de Camachin; los edificios de la ciudad van encima en el DOM (se tocan).
   Rutas, medidas y colores en js/texturas.js. */
(function (g) {
  'use strict';
  const J = g.CivilikJuego, T = g.CivilikTexturas, S = T.medidas.celda;

  // ---------- Hash determinista por posición ----------
  function hash(a, b, s) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul((s | 0) ^ 0x5bd1e995, 2246822519)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }

  // ---------- Rejilla dual (autotile) ----------
  // bits en orden NO, NE, SO, SE; 1 = esa celda tiene la capa. '0000' = no se pinta.
  const COMBINACIONES = ['0001', '0010', '0011', '0100', '0101', '0110', '0111', '1000', '1001', '1010', '1011', '1100', '1101', '1110', '1111'];
  const SAL = { agua: 11, roca: 23, camino: 37, plaza: 41, niebla: 53 };
  const mascara = (no, ne, so, se) => '' + (no ? 1 : 0) + (ne ? 1 : 0) + (so ? 1 : 0) + (se ? 1 : 0);
  const variante = (capa, f, c) => hash(c, f, SAL[capa] || 7) < 0.5 ? 'a' : 'b';   // solo depende de la posición
  function nombrePieza(capa, bits, f, c) {
    if (bits === '0000') return null;
    const v = variante(capa, f, c);
    if (bits === '1111') return capa + '_1111' + (capa === 'camino' && v === 'b' ? '_b' : '');
    return capa + '_' + bits + '_' + v;
  }
  // Piezas de una capa: una por cruce de 4 celdas (esquinas 0..W × 0..H). fuera = valor de las celdas fuera del mundo.
  function piezas(m, capa, fuera = 0) {
    const L = m.capas[capa], W = m.W, H = m.H, out = [];
    const v = (c, f) => (c < 0 || f < 0 || c >= W || f >= H) ? fuera : L[f * W + c];
    for (let f = 0; f <= H; f++) for (let c = 0; c <= W; c++) {
      const bits = mascara(v(c - 1, f - 1), v(c, f - 1), v(c - 1, f), v(c, f));
      const n = nombrePieza(capa, bits, f, c); if (n) out.push({ n, bits, c, f, x: (c - 0.5) * S, y: (f - 0.5) * S });
    }
    return out;
  }

  // ---------- Mundo vacío ----------
  function mundo(W, H) {
    const capas = {}; for (const k of T.capas.concat('niebla')) capas[k] = new Uint8Array(W * H);
    return { W, H, S, capas, bajos: [], altos: [], colinas: [], asientos: [], edificios: [], libre: new Uint8Array(W * H) };
  }
  const dentroM = (m, c, f) => c >= 0 && f >= 0 && c < m.W && f < m.H;
  const pon = (m, capa, c, f, v = 1) => { if (dentroM(m, c, f)) m.capas[capa][f * m.W + c] = v; };
  const hay = (m, capa, c, f) => dentroM(m, c, f) && m.capas[capa][f * m.W + c] === 1;

  // Árbol o roca suelta (1 celda) o grande (2×2), escalado 85–115 %, con la base en el suelo
  function objeto(m, n, c, f, celdas, sem) {
    const k = 0.85 + hash(c, f, sem ^ 0x77) * 0.3, lado = S * celdas * k;
    const cx = (c + celdas / 2) * S + (hash(c, f, sem ^ 0x31) - 0.5) * S * 0.3, base = (f + celdas) * S - S * 0.12;
    return { n, x: cx - lado / 2, y: base - lado, w: lado, h: lado, yb: base };
  }
  function arbolEn(m, c, f, sem, grande) {
    const t = hash(c, f, sem ^ 0x1234);
    if (grande) return objeto(m, t < 0.55 ? 'arboleda' : 'arbol_redondo_grande', c, f, 2, sem);
    return objeto(m, t < 0.42 ? 'arbol_redondo' : t < 0.72 ? 'pino' : t < 0.92 ? 'arbusto' : 'tocon', c, f, 1, sem);
  }
  const bajo = (n, c, f, sem) => ({ n, x: c * S + (hash(c, f, sem ^ 0x55) - 0.5) * 8, y: f * S + (hash(c, f, sem ^ 0x66) - 0.5) * 8, w: S, h: S });

  // ---------- Ciudad ----------
  // 0.5: 6×6 manzanas de 2×2 huecos (retícula 12×12). Por eje: borde 3 · [corredor 2 · margen 1 · hueco 3 · separación 1 · hueco 3 · margen 1] × 6 · corredor 2 · borde 3 = 74 celdas.
  const CI = T.ciudad, MZ = J.COLS / 2, LADO_CIUDAD = CI.borde * 2 + CI.bloque * MZ + CI.corredor;
  const corredor = k => CI.borde + CI.bloque * k;
  const celdaHueco = h => ({ c: corredor(h.c >> 1) + CI.corredor + 1 + (h.c & 1) * 4, f: corredor(h.f >> 1) + CI.corredor + 1 + (h.f & 1) * 4 });
  const enCorredor = x => x >= CI.borde && (x - CI.borde) % CI.bloque < CI.corredor && x < LADO_CIUDAD - CI.borde;

  function mundoCiudad(e) {
    const W = LADO_CIUDAD, H = LADO_CIUDAD, m = mundo(W, H), sem = (e.semilla >>> 0) || 1;
    const disp = J.huecosDisponibles(e), abiertos = e.huecos.slice(0, disp), ay = J.ayto(e);
    m.huecos = e.huecos.map(celdaHueco);
    // Camino: tramos de corredor que dan servicio a huecos abiertos; ancho 1–2 celdas, ondulado por tramos (por posición)
    const tramo = (k, a0, a1, vertical) => {
      const x0 = corredor(k);
      for (let t = a0; t <= a1; t++) {
        let ambos = enCorredor(t) || t % 3 === 0, lado = hash(k * 13 + (vertical ? 1 : 2), (t / 3) | 0, sem ^ 0xC0) * 3 | 0;
        if (t < CI.borde || t >= W - CI.borde) lado = hash(k, (t / 2) | 0, sem ^ 0xC1) * 3 | 0, ambos = false;   // salida al campo, más estrecha
        if (ambos || lado === 0) lado = 3; else lado = lado === 1 ? 1 : 2;
        for (let i = 0; i < 2; i++) if (lado & (1 << i)) vertical ? pon(m, 'camino', x0 + i, t) : pon(m, 'camino', t, x0 + i);
      }
    };
    for (let k = 0; k <= MZ; k++) {
      const filas = abiertos.filter(h => h.c === 2 * k - 1 || h.c === 2 * k).map(h => h.f), cols = abiertos.filter(h => h.f === 2 * k - 1 || h.f === 2 * k).map(h => h.c);
      if (filas.length) tramo(k, corredor(Math.min(...filas) >> 1), corredor((Math.max(...filas) >> 1) + 1) + 1, true);
      if (cols.length) tramo(k, corredor(Math.min(...cols) >> 1), corredor((Math.max(...cols) >> 1) + 1) + 1, false);
    }
    // Salidas al campo por el corredor central (2 o 3 de los 4 lados; nunca de lado a lado entero si solo hay 2)
    const fs = abiertos.map(h => h.f), cs = abiertos.map(h => h.c), lados = [0, 1, 2, 3].sort((a, b) => hash(a, 0, sem ^ 0xE1) - hash(b, 0, sem ^ 0xE1)).slice(0, 2 + (hash(9, 9, sem) < 0.5 ? 1 : 0));
    for (const l of lados) {
      const K = MZ >> 1;   // corredor central
      if (l === 0) tramo(K, 0, corredor(Math.min(...fs) >> 1), true);
      if (l === 1) tramo(K, corredor((Math.max(...fs) >> 1) + 1), H - 1, true);
      if (l === 2) tramo(K, 0, corredor(Math.min(...cs) >> 1), false);
      if (l === 3) tramo(K, corredor((Math.max(...cs) >> 1) + 1), W - 1, false);
    }
    // Plaza solo alrededor del ayuntamiento (radio ~3 celdas), sin entrar en otros huecos
    const huella = new Uint8Array(W * H);   // 1 = dentro de un hueco (3×3); 2 = margen de 1 celda alrededor
    m.huecos.forEach(p => { for (let f = p.f - 1; f <= p.f + 3; f++) for (let c = p.c - 1; c <= p.c + 3; c++) if (dentroM(m, c, f)) { const dentro = c >= p.c && c < p.c + 3 && f >= p.f && f < p.f + 3; if (dentro) huella[f * W + c] = 1; else if (!huella[f * W + c]) huella[f * W + c] = 2; } });
    const pa = ay ? m.huecos[ay.hueco] : null;
    if (pa) {
      const X = pa.c + 1.5, Y = pa.f + 1.5, propia = (c, f) => c >= pa.c && c < pa.c + 3 && f >= pa.f && f < pa.f + 3;
      for (let f = pa.f - 3; f <= pa.f + 5; f++) for (let c = pa.c - 3; c <= pa.c + 5; c++) {
        if (!dentroM(m, c, f) || (huella[f * W + c] === 1 && !propia(c, f))) continue;
        if (Math.hypot(c + 0.5 - X, f + 0.5 - Y) <= 3 + (hash(c, f, sem ^ 0x9A) - 0.5) * 0.7) pon(m, 'plaza', c, f);
      }
    }
    // Decoración: arboleda que crece con la distancia a la ciudad abierta (borde irregular); nunca sobre camino o plaza ni en huecos abiertos (ni su margen)
    const abiertosC = abiertos.map(celdaHueco), ocupado = new Uint8Array(W * H);
    const urbano = (c, f) => abiertosC.some(p => c >= p.c - 1 && c <= p.c + 3 && f >= p.f - 1 && f <= p.f + 3);
    const ocupable = (c, f) => dentroM(m, c, f) && !ocupado[f * W + c] && !hay(m, 'camino', c, f) && !hay(m, 'plaza', c, f) && !urbano(c, f);
    const dist = (c, f) => Math.min(...abiertosC.map(p => Math.max(Math.abs(c + 0.5 - p.c - 1.5), Math.abs(f + 0.5 - p.f - 1.5))));
    for (let f = 0; f < H; f++) for (let c = 0; c < W; c++) {
      if (hay(m, 'camino', c, f)) { if (hash(c, f, sem ^ 0x71) < 0.06) m.bajos.push(bajo('piedras_camino', c, f, sem)); continue; }
      if (!ocupable(c, f)) continue;
      const d = dist(c, f), p = Math.max(0, Math.min(0.5, (d - 4) / 9)), t = hash(c, f, sem ^ 0x42);
      if (t < p) {
        const grande = hash(c, f, sem ^ 0x43) < 0.14 && ocupable(c + 1, f) && ocupable(c, f + 1) && ocupable(c + 1, f + 1);
        m.altos.push(arbolEn(m, c, f, sem, grande));
        ocupado[f * W + c] = 1; if (grande) ocupado[f * W + c + 1] = ocupado[(f + 1) * W + c] = ocupado[(f + 1) * W + c + 1] = 1;
      } else if (hash(c, f, sem ^ 0x44) < 0.035) { const q = hash(c, f, sem ^ 0x45); m.bajos.push(bajo(q < 0.55 ? 'flores' : q < 0.75 ? 'setas' : 'piedras_pequenas', c, f, sem)); }
      else if (d > 4 && hash(c, f, sem ^ 0x46) < 0.012) { m.altos.push(objeto(m, 'roca_mediana', c, f, 1, sem)); ocupado[f * W + c] = 1; }
    }
    m.ayto = pa ? { c: pa.c, f: pa.f } : null;
    m.firma = firma(m);
    return m;
  }

  // ---------- Mapa: zona de 21×21 casillas (2×2 celdas cada una) ----------
  const DESPL = [[-6, -6], [0, -6], [6, -6], [-6, 0], [6, 0], [-6, 6], [0, 6], [6, 6]];
  function mundoMapa(e) {
    const N = T.mapa.lado, K = T.mapa.celdasPorCasilla, W = N * K, H = N * K, m = mundo(W, H), sem = (e.semilla >>> 0) || 1;
    const zona = J.generarZona(e.semilla, N), tipo = (c, f) => zona.celdas[(f >> 1) * N + (c >> 1)], fuera = (c, f) => !zona.dentro[(f >> 1) * N + (c >> 1)];
    m.zona = zona;
    // Ciudad en el centro: ayuntamiento + hasta 8 edificios de la partida alrededor, calles en «#»
    const A = (W >> 1) - 1, ciudad = (c, f) => c >= A - 8 && c <= A + 10 && f >= A - 8 && f <= A + 10;
    for (let f = 0; f < H; f++) for (let c = 0; c < W; c++) {
      if (fuera(c, f) || c < 2 || f < 2 || c >= W - 2 || f >= H - 2) pon(m, 'niebla', c, f);
      if (ciudad(c, f)) continue;
      const t = tipo(c, f); if (t === 'a') pon(m, 'agua', c, f); else if (t === 'm') pon(m, 'roca', c, f);
    }
    const otros = e.edificios.filter(b => b.tipo !== 'ayuntamiento').sort((a, b) => a.hueco - b.hueco).slice(0, 8);
    const ay = J.ayto(e);
    m.edificios.push({ tipo: 'ayuntamiento', c: A, f: A, nivel: ay ? ay.nivel : 1 });
    otros.forEach((b, i) => m.edificios.push({ tipo: b.tipo, c: A + DESPL[i][0], f: A + DESPL[i][1], nivel: b.nivel }));
    for (const lin of [A - 2, A + 4]) for (let t = A - 7; t <= A + 9; t++) { pon(m, 'camino', lin, t); pon(m, 'camino', t, lin); }
    for (let f = A - 3; f <= A + 5; f++) for (let c = A - 3; c <= A + 5; c++) {
      const otro = m.edificios.some((b, i) => i > 0 && c >= b.c && c < b.c + 3 && f >= b.f && f < b.f + 3);
      if (!otro && Math.hypot(c + 0.5 - (A + 1.5), f + 0.5 - (A + 1.5)) <= 3 + (hash(c, f, sem ^ 0x9A) - 0.5) * 0.7) pon(m, 'plaza', c, f);
    }
    // Caminos exteriores: 3 de los 4 lados; ondulan, se pierden en la niebla; puente donde cruzan agua (sin pintar camino sobre el agua)
    const puentes = new Uint8Array(W * H);
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]].map((d, i) => ({ d, i })).sort((a, b) => hash(a.i, 1, sem ^ 0xD1) - hash(b.i, 1, sem ^ 0xD1)).slice(0, 3);
    for (const { d, i } of dirs) {
      const lin = hash(i, 2, sem ^ 0xD2) < 0.5 ? A - 2 : A + 4, hz = d[1] === 0;
      let a = hz ? (d[0] < 0 ? A - 8 : A + 10) : (d[1] < 0 ? A - 8 : A + 10), l = lin;
      const cel = (a, l) => hz ? [a, l] : [l, a];
      for (let paso = 0; paso < W; paso++) {
        a += hz ? d[0] : d[1];
        const [c, f] = cel(a, l); if (!dentroM(m, c, f)) break;
        if (hay(m, 'agua', c, f)) {   // ¿se puede cruzar? (hasta 5 celdas de agua)
          let n = 0; while (n < 6) { const [c2, f2] = cel(a + n * (hz ? d[0] : d[1]), l); if (!hay(m, 'agua', c2, f2)) break; n++; }
          if (n > 5) break;
          for (let k = 0; k < n; k++) { const [c2, f2] = cel(a + k * (hz ? d[0] : d[1]), l); puentes[f2 * W + c2] = 1; m.altos.push({ n: hz ? 'puente_horizontal' : 'puente_vertical', x: c2 * S, y: f2 * S, w: S, h: S, yb: (f2 + 1) * S }); }
          a += (n - 1) * (hz ? d[0] : d[1]); continue;
        }
        pon(m, 'camino', c, f);
        if (hay(m, 'niebla', c, f)) break;
        if (paso > 2 && hash(a, l, sem ^ 0xD3 ^ i) < 0.22) {   // ondula: un paso lateral (con la celda de unión, para que siga continuo)
          const nl = l + (hash(a, l, sem ^ 0xD4) < 0.5 ? -1 : 1), [c2, f2] = cel(a, nl);
          if (dentroM(m, c2, f2) && !hay(m, 'agua', c2, f2) && !ciudad(c2, f2)) { pon(m, 'camino', c2, f2); l = nl; }
        }
      }
    }
    // Decoración por tipo de terreno (nunca sobre camino, agua, plaza o roca para los árboles)
    const ocupado = new Uint8Array(W * H);
    const libre = (c, f) => dentroM(m, c, f) && !ocupado[f * W + c] && !hay(m, 'camino', c, f) && !hay(m, 'plaza', c, f) && !hay(m, 'agua', c, f) && !hay(m, 'roca', c, f) && !ciudad(c, f) && !hay(m, 'niebla', c, f);
    for (let f = 0; f < H; f++) for (let c = 0; c < W; c++) {
      if (hay(m, 'niebla', c, f) || ciudad(c, f)) continue;
      const t = tipo(c, f), h1 = hash(c, f, sem ^ 0x51), h2 = hash(c, f, sem ^ 0x52);
      if (hay(m, 'agua', c, f)) {
        if (puentes[f * W + c]) continue;
        const honda = [-1, 0, 1].every(df => [-1, 0, 1].every(dc => !dentroM(m, c + dc, f + df) || hay(m, 'agua', c + dc, f + df)));
        const orilla = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, df]) => dentroM(m, c + dc, f + df) && !hay(m, 'agua', c + dc, f + df));
        if (honda && h1 < 0.14) m.bajos.push(bajo('destellos_agua', c, f, sem));
        else if (orilla && h1 < 0.12) m.bajos.push(bajo('juncos', c, f, sem));
        else if (!orilla && h2 < 0.05) m.bajos.push(bajo('nenufares', c, f, sem));
        continue;
      }
      if (hay(m, 'roca', c, f)) {
        if (!ocupado[f * W + c] && c % 2 === 0 && f % 2 === 0 && h1 < 0.5 && [[1, 0], [0, 1], [1, 1]].every(([dc, df]) => hay(m, 'roca', c + dc, f + df))) {
          m.altos.push(objeto(m, h2 < 0.4 ? 'cantera_natural' : 'roca_grande', c, f, 2, sem)); ocupado[f * W + c] = ocupado[f * W + c + 1] = ocupado[(f + 1) * W + c] = ocupado[(f + 1) * W + c + 1] = 1;
        } else if (!ocupado[f * W + c] && h2 < 0.12) { m.altos.push(objeto(m, 'roca_mediana', c, f, 1, sem)); ocupado[f * W + c] = 1; }
        else if (!ocupado[f * W + c] && h2 < 0.3) m.bajos.push(bajo('grietas_roca', c, f, sem));
        continue;
      }
      if (hay(m, 'camino', c, f)) { if (h1 < 0.06) m.bajos.push(bajo('piedras_camino', c, f, sem)); continue; }
      if (!libre(c, f)) continue;
      if (t === 'p' && c % 2 === 0 && f % 2 === 0 && h1 < 0.75 && libre(c + 1, f) && libre(c, f + 1) && libre(c + 1, f + 1)) {
        m.colinas.push(objeto(m, 'colina', c, f, 2, sem));   // colinas antes que los árboles que tengan encima
        if (h2 < 0.35) m.altos.push(arbolEn(m, c + (h2 < 0.17 ? 0 : 1), f, sem, false));
        ocupado[f * W + c] = ocupado[f * W + c + 1] = ocupado[(f + 1) * W + c] = ocupado[(f + 1) * W + c + 1] = 1; continue;
      }
      const pArbol = t === 'b' ? 0.55 : t === 'p' ? 0.08 : 0.045;
      if (h1 < pArbol) {
        const grande = t === 'b' && h2 < 0.16 && libre(c + 1, f) && libre(c, f + 1) && libre(c + 1, f + 1);
        m.altos.push(arbolEn(m, c, f, sem, grande)); ocupado[f * W + c] = 1; if (grande) ocupado[f * W + c + 1] = ocupado[(f + 1) * W + c] = ocupado[(f + 1) * W + c + 1] = 1;
      } else if (h2 < (t === 'l' ? 0.07 : 0.03)) { const q = hash(c, f, sem ^ 0x53); m.bajos.push(bajo(q < 0.6 ? 'flores' : q < 0.8 ? 'setas' : 'piedras_pequenas', c, f, sem)); }
    }
    // Asientos y edificios de la ciudad (0.3: skin a 96 dp; antes dibujo a 92 dp centrado en sus 3×3 celdas; asiento de 120 dp, 4 dp más abajo)
    const M = T.medidas;
    for (const b of m.edificios) {
      const cx = (b.c + 1.5) * S, cy = (b.f + 1.5) * S;
      m.asientos.push({ n: asientoDe(b.tipo, b.c, b.f), x: cx - M.asiento / 2, y: cy - M.asiento / 2 + M.asientoBajada, w: M.asiento, h: M.asiento });
      const w = M.dibujoSkin;   // 0.3: skin por nivel de Camachin a 96 dp (el dibujo ya trae su margen)
      m.altos.push({ edificio: b.tipo, nivel: b.nivel, x: cx - w / 2, y: cy - w / 2, w, h: w, yb: cy + M.dibujoEdificio / 2 });
    }
    m.capital = { x: (A + 1.5) * S, y: (A + 1.5) * S };
    m.firma = firma(m);
    return m;
  }
  const PLAZA = (g.CivilikDatos && g.CivilikDatos.asientoPlaza) || ['ayuntamiento'];   // Ayuntamiento y Salón de héroes: asiento de plaza
  const asientoDe = (tipo, c, f) => PLAZA.includes(tipo) ? 'asiento_plaza_' + (1 + (hash(c, f, 0xA5) * 2 | 0)) : 'asiento_tierra_' + (1 + (hash(c, f, 0xA7) * 3 | 0));

  // ---------- Lista de dibujo en el orden del LEEME §3 ----------
  const R = T.rutas;
  function listaDibujo(m) {
    const L = [], W = m.W, H = m.H, su = T.suelo;
    // 1 hierba base por posición (hash), 6–10 % pradera
    for (let f = 0; f < H; f++) for (let c = 0; c < W; c++) {
      const n = hash(c, f, 0x2B) < su.porcentajePradera ? 'pradera_' + (1 + (hash(c, f, 0x2C) * su.pradera | 0)) : 'hierba_' + (1 + (hash(c, f, 0x2D) * su.hierba | 0));
      L.push({ capa: 'base', src: R.terreno + 'suelo/' + n + '.png', x: c * S, y: f * S, w: S, h: S });
    }
    // 2 manchas: 1 cada ~10 celdas, giradas o volteadas
    for (let f = 0; f < H; f++) for (let c = 0; c < W; c++) if (hash(c, f, 0x3B) < 1 / su.manchaCada) {
      const n = su.manchas[hash(c, f, 0x3C) * su.manchas.length | 0], lado = T.medidas.mancha[0] + hash(c, f, 0x3D) * (T.medidas.mancha[1] - T.medidas.mancha[0]);
      L.push({ capa: 'manchas', src: R.terreno + 'manchas/' + n + '.png', x: (c + 0.5) * S - lado / 2, y: (f + 0.5) * S - lado / 2, w: lado, h: lado, rot: (hash(c, f, 0x3E) * 4 | 0) * 90, voltear: hash(c, f, 0x3F) < 0.5 });
    }
    // 3–6 agua, roca, camino, plaza (rejilla dual)
    for (const capa of T.capas) for (const p of piezas(m, capa)) L.push({ capa, src: R.terreno + capa + '/' + p.n + '.png', x: p.x, y: p.y, w: S, h: S });
    // 7 asientos (mapa; en la ciudad van con cada edificio en el DOM)
    for (const a of m.asientos) L.push({ capa: 'asientos', src: R.terreno + 'asientos/' + a.n + '.png', x: a.x, y: a.y, w: a.w, h: a.h });
    // 8 decoración baja
    for (const b of m.bajos) L.push({ capa: 'bajos', src: R.deco + b.n + '.png', x: b.x, y: b.y, w: b.w, h: b.h });
    // 9 colinas y, ordenados por la Y de su base, edificios, árboles, rocas, puentes
    for (const o of m.colinas) L.push({ capa: 'altos', colina: true, src: R.deco + o.n + '.png', x: o.x, y: o.y, w: o.w, h: o.h, yb: o.yb });
    for (const o of m.altos.slice().sort((a, b) => a.yb - b.yb || a.x - b.x))
      L.push({ capa: 'altos', src: o.edificio ? R.skins + g.CivilikJuego.skin(o.edificio, o.nivel || 1) + '.svg' : R.deco + o.n + '.png', x: o.x, y: o.y, w: o.w, h: o.h, yb: o.yb });
    // 12 niebla (mapa exterior); fuera del mundo también es niebla
    if (m.capas.niebla.some(v => v)) for (const p of piezas(m, 'niebla', 1)) L.push({ capa: 'niebla', src: R.terreno + 'niebla/' + p.n + '.png', x: p.x, y: p.y, w: S, h: S });
    return L;
  }
  function firma(m) {   // huella estable del mundo (para pruebas y caché)
    let h = 2166136261; const mezcla = s => { for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); };
    for (const k of Object.keys(m.capas)) mezcla(k + Array.prototype.join.call(m.capas[k], ''));
    for (const o of m.bajos.concat(m.altos, m.colinas)) mezcla((o.n || o.edificio) + Math.round(o.x) + ',' + Math.round(o.y));
    return (h >>> 0).toString(16);
  }

  // ---------- Pintado en canvas (una vez; luego se reutiliza el mismo lienzo) ----------
  const imgs = {};
  const cargar = src => imgs[src] || (imgs[src] = new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
  async function pintarLienzo(canvas, m) {
    const lado = m.W * S, esc = Math.min(2, g.devicePixelRatio || 1, 3200 / lado);
    canvas.width = Math.round(m.W * S * esc); canvas.height = Math.round(m.H * S * esc);
    canvas.style.width = '100%'; canvas.style.height = '100%';
    const L = listaDibujo(m), fuentes = [...new Set(L.map(o => o.src))], cargadas = {};
    await Promise.all(fuentes.map(async s => { cargadas[s] = await cargar(s); }));
    const ctx = canvas.getContext('2d'); ctx.setTransform(esc, 0, 0, esc, 0, 0); ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = m.capas.niebla.some(v => v) ? T.colores.niebla : T.colores.hierba; ctx.fillRect(0, 0, m.W * S, m.H * S);
    let faltan = 0;
    for (const o of L) {
      const im = cargadas[o.src]; if (!im) { faltan++; continue; }
      if (o.rot || o.voltear) { ctx.save(); ctx.translate(o.x + o.w / 2, o.y + o.h / 2); ctx.rotate((o.rot || 0) * Math.PI / 180); if (o.voltear) ctx.scale(-1, 1); ctx.drawImage(im, -o.w / 2, -o.h / 2, o.w, o.h); ctx.restore(); }
      else ctx.drawImage(im, o.x, o.y, o.w + 0.02, o.h + 0.02);   // +0,02 para que no asomen costuras al escalar
    }
    canvas.dataset.listo = '1'; canvas.dataset.piezas = String(L.length); canvas.dataset.faltan = String(faltan);
    return L.length;
  }

  // ======================= 0.5 · MAPA DEL MUNDO (100×100 casillas) =======================
  // Terreno de Camachin 0.5: rejilla dual por capas terreno_<tipo>_<NO><NE><SO><SE> (sin variantes a/b), de abajo arriba:
  // agua (fondo 1111) → arena (toda la tierra: queda una franja de playa en la costa) → hierba (tierra que no toca el agua) → bosque → montana.
  // Colinas = hierba con la colina de la 0.2 encima. Niebla de la 0.2 en el borde. Se pinta en 4×4 lienzos (25×25 casillas cada uno).
  const MT = () => T.mundo;
  function mundoGrande(e) {
    const W0 = g.CivilikMundo.generarMundo(e.semilla), N = W0.n, C = MT().casilla, sem = (e.semilla >>> 0) || 1;
    const t = (c, f) => (c < 0 || f < 0 || c >= N || f >= N) ? null : W0.celdas[f * N + c];
    const capa = {}; for (const k of MT().capas.concat('niebla', 'plaza')) capa[k] = new Uint8Array(N * N);
    const cap = W0.capital;
    for (let f = 0; f < N; f++) for (let c = 0; c < N; c++) {
      const i = f * N + c, x = t(c, f), tierra = x !== 'a';
      capa.agua[i] = 1;
      if (tierra) capa.arena[i] = 1;
      if (tierra && ![[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]].some(([a, b]) => t(c + a, f + b) === 'a')) capa.hierba[i] = 1;
      if (x === 'b' && capa.hierba[i]) capa.bosque[i] = 1;
      if (x === 'm' && capa.hierba[i]) capa.montana[i] = 1;
      if (!W0.dentro[i]) capa.niebla[i] = 1;
      if (Math.hypot(c - cap.x, f - cap.y) <= 1.6) capa.plaza[i] = 1;
    }
    const items = [], R = T.rutas;
    const piezasDe = (L, fuera, nombre) => {
      for (let f = 0; f <= N; f++) for (let c = 0; c <= N; c++) {
        const v = (a, b) => (a < 0 || b < 0 || a >= N || b >= N) ? fuera : L[b * N + a];
        const bits = mascara(v(c - 1, f - 1), v(c, f - 1), v(c - 1, f), v(c, f)); if (bits === '0000') continue;
        items.push({ src: nombre(bits, c, f), x: (c - 0.5) * C, y: (f - 0.5) * C, w: C, h: C });
      }
    };
    for (const k of MT().capas) piezasDe(capa[k], k === 'agua' ? 1 : 0, bits => R.mundo + 'terreno/terreno_' + k + '_' + bits + '.png');
    piezasDe(capa.plaza, 0, (bits, c, f) => R.terreno + 'plaza/' + nombrePieza('plaza', bits, f, c) + '.png');
    // decoración (0.2) para romper la repetición
    const deco = [];
    for (let f = 0; f < N; f++) for (let c = 0; c < N; c++) {
      const i = f * N + c, x = t(c, f), h1 = hash(c, f, sem ^ 0x61), h2 = hash(c, f, sem ^ 0x62); if (capa.niebla[i] || capa.plaza[i]) continue;
      const pon = (n, k = 1) => { const lado = C * k * (0.85 + h2 * 0.3); deco.push({ src: R.deco + n + '.png', x: (c + 0.5) * C - lado / 2 + (h1 - 0.5) * C * 0.3, y: (f + 0.92) * C - lado, w: lado, h: lado, yb: (f + 0.92) * C }); };
      if (x === 'a') { if (h1 < 0.03) items.push({ src: R.deco + 'destellos_agua.png', x: c * C, y: f * C, w: C, h: C }); continue; }
      if (!capa.hierba[i]) continue;
      if (x === 'b' && h1 < 0.18) pon(h2 < 0.5 ? 'pino' : 'arbol_redondo');
      else if (x === 'p' && c % 2 === 0 && f % 2 === 0 && h1 < 0.7) pon('colina', 1.6);
      else if (x === 'm' && h1 < 0.08) pon(h2 < 0.5 ? 'roca_grande' : 'cantera_natural', 1.2);
      else if (x === 'l' && Math.hypot(c - cap.x, f - cap.y) > 3) { if (h1 < 0.03) pon(h2 < 0.6 ? 'arbol_redondo' : 'arbusto', 0.8); else if (h1 < 0.07) items.push({ src: R.deco + (h2 < 0.6 ? 'flores' : 'piedras_pequenas') + '.png', x: c * C, y: f * C, w: C * 0.7, h: C * 0.7 }); }
    }
    deco.sort((a, b) => a.yb - b.yb || a.x - b.x).forEach(o => items.push(o));
    piezasDe(capa.niebla, 1, (bits, c, f) => R.terreno + 'niebla/' + nombrePieza('niebla', bits, f, c) + '.png');
    let h = 2166136261; for (const k of Object.keys(capa)) { const s = Array.prototype.join.call(capa[k], ''); for (let i = 0; i < s.length; i += 7) h = Math.imul(h ^ s.charCodeAt(i), 16777619); }
    return { N, C, lado: N * C, items, capital: { x: (cap.x + 0.5) * C, y: (cap.y + 0.5) * C, c: cap.x, f: cap.y }, firma: (h >>> 0).toString(16), mundo: W0 };
  }
  // Pinta el mundo en una rejilla de lienzos (cada uno de MT().trozo casillas). Devuelve el contenedor (posición absoluta, tamaño a zoom 1).
  function pintarMundo(mg) {
    const caja = document.createElement('div'), K = MT().trozo, T0 = K * mg.C, n = Math.ceil(mg.N / K), esc = Math.min(1, g.devicePixelRatio || 1) * MT().resolucion;
    caja.className = 'mundo-terreno'; caja.style.cssText = `position:absolute;left:0;top:0;width:${mg.lado}px;height:${mg.lado}px;transform-origin:0 0`;
    caja.dataset.firma = mg.firma; caja.dataset.piezas = String(mg.items.length); caja.dataset.trozos = String(n * n);
    const fuentes = [...new Set(mg.items.map(o => o.src))];
    const listo = Promise.all(fuentes.map(cargar)).then(ims => {
      const im = {}; fuentes.forEach((s, i) => { im[s] = ims[i]; });
      let faltan = 0;
      // 0.8 (mapa 150×150): cada pieza se apunta solo en los trozos que toca, en el mismo orden de dibujo (antes se recorrían todas en cada trozo)
      const cubos = Array.from({ length: n * n }, () => []);
      for (const o of mg.items) {
        const a0 = Math.max(0, Math.floor(o.x / T0)), a1 = Math.min(n - 1, Math.floor((o.x + o.w) / T0)), b0 = Math.max(0, Math.floor(o.y / T0)), b1 = Math.min(n - 1, Math.floor((o.y + o.h) / T0));
        for (let ty = b0; ty <= b1; ty++) for (let tx = a0; tx <= a1; tx++) cubos[ty * n + tx].push(o);
      }
      for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
        const cv = document.createElement('canvas'), x0 = tx * T0, y0 = ty * T0;
        cv.width = Math.round(T0 * esc); cv.height = Math.round(T0 * esc); cv.className = 'trozo';
        cv.style.cssText = `position:absolute;left:${x0}px;top:${y0}px;width:${T0}px;height:${T0}px`;
        const ctx = cv.getContext('2d'); ctx.setTransform(esc, 0, 0, esc, -x0 * esc, -y0 * esc); ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = T.colores.agua; ctx.fillRect(x0, y0, T0, T0);
        for (const o of cubos[ty * n + tx]) {
          if (o.x > x0 + T0 || o.y > y0 + T0 || o.x + o.w < x0 || o.y + o.h < y0) continue;
          const i2 = im[o.src]; if (!i2) { faltan++; continue; }
          ctx.drawImage(i2, o.x, o.y, o.w + 0.03, o.h + 0.03);
        }
        caja.append(cv);
      }
      caja.dataset.listo = '1'; caja.dataset.faltan = String(faltan);
    });
    caja.listo = listo;
    return caja;
  }

  g.CivilikEscenario = { S, hash, COMBINACIONES, mascara, variante, nombrePieza, piezas, mundoCiudad, mundoMapa, listaDibujo, pintarLienzo, mundoGrande, pintarMundo, celdaHueco, asientoDe, LADO_CIUDAD };
})(window);
