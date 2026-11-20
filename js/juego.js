/* Civili'k 0.6 · lógica del juego (sin DOM). Economía EXACTA del encargo de Jose (09/11/2026); no añadir recursos, edificios ni tasas.
   Todo el tiempo se mide en milisegundos JUGADOS: avanzar() solo se llama mientras se juega. */
(function (g) {
  'use strict';
  const RECURSOS = ['comida', 'madera', 'piedra', 'oro', 'hierro', 'metal'];
  const NOMBRE_RECURSO = { comida: 'Comida', madera: 'Madera', piedra: 'Piedra', oro: 'Oro', hierro: 'Hierro', metal: 'Metal de alta calidad', personas: 'Personas' };
  const c = (madera, piedra, oro = 0, hierro = 0) => ({ madera, piedra, oro, hierro });
  // trab = máximo de personas por nivel · requiere = nivel mínimo del ayuntamiento
  // 0.2 (encargo de Jose 10/11): toda la producción ×3 en cada nivel (0.1: granja 8/15/24, aserradero y cantera 6/12/20, mina 4/8/14, fundición 2/4/6;
  // impuestos 1 oro/persona/min). La fundición sigue gastando 2 de hierro por cada metal (su consumo se triplica con su producción). Costes sin cambios.
  const EDIFICIOS = {
    ayuntamiento: { nombre: 'Ayuntamiento', max: 4, huecos: [16, 24, 32, 40], aSalvo: [30, 60, 90, 120], mejora: [null, c(80, 80, 40), c(160, 160, 80), c(320, 320, 160)], unico: true },
    casa: { nombre: 'Casa', max: 4, da: [2, 4, 6, 8], coste: [c(20, 10, 5), c(30, 20, 10), c(50, 30, 20), c(80, 50, 40)], requiere: 1 },
    deposito: { nombre: 'Depósito', max: 3, trab: [1, 2, 2], aSalvo: [80, 140, 220], coste: [c(40, 40, 20), c(80, 80, 40), c(160, 160, 80)], requiere: 2 },
    granja: { nombre: 'Granja', max: 3, trab: [2, 3, 4], produce: 'comida', ritmo: [24, 45, 72], coste: [c(15, 5), c(30, 15, 10), c(60, 30, 20)], requiere: 1 },
    aserradero: { nombre: 'Aserradero', max: 3, trab: [2, 3, 4], produce: 'madera', ritmo: [18, 36, 60], coste: [c(10, 15), c(20, 30, 10), c(40, 60, 20)], requiere: 1 },
    cantera: { nombre: 'Cantera', max: 3, trab: [2, 3, 4], produce: 'piedra', ritmo: [18, 36, 60], coste: [c(15, 10), c(30, 20, 10), c(60, 40, 20)], requiere: 1 },
    mina: { nombre: 'Mina', max: 3, trab: [2, 3, 4], produce: 'hierro', ritmo: [12, 24, 42], coste: [c(20, 20, 10), c(40, 40, 20), c(80, 80, 40)], requiere: 2 },
    fundicion: { nombre: 'Fundición', max: 3, trab: [2, 3, 4], produce: 'metal', ritmo: [6, 12, 18], gasta: { hierro: 2 }, coste: [c(30, 30, 20, 10), c(60, 60, 40, 20), c(120, 120, 80, 40)], requiere: 3 }
  };
  // 0.3: edificios militares (Academia, Cuartel, Salón de héroes, Botica); sus números están en js/datos.js. Uno de cada; mínimo 1 persona.
  const D = g.CivilikDatos || { edificios: {} };
  // 0.4: los edificios civiles llegan al nivel 30; sus tablas (nv antiguos idénticos + curva) están en js/datos.js
  if (D.civiles) for (const [k, v] of Object.entries(D.civiles)) EDIFICIOS[k] = v;
  for (const [k, v] of Object.entries(D.edificios)) EDIFICIOS[k] = v;
  const MILITARES = Object.keys(D.edificios);
  const CONSTRUIBLES = ['casa', 'deposito', 'granja', 'aserradero', 'cantera', 'mina', 'fundicion'].concat(MILITARES);
  // 0.6 · Modos de partida: 'clasica' (producción ÷3, tiempo real, desconectado a la mitad hasta 5 h, marchas con tiempo) o 'rapida' (como la 0.5)
  const MODOS = D.modos || { rapida: { produccion: 1, mantenimiento: 1, inicio: 1 } };
  const modo = e => MODOS[(e && e.modo) || 'rapida'] || MODOS.rapida;
  const factorModo = e => e ? modo(e).produccion : 1;
  // Skins por nivel de Camachin (0.3): aspecto = el mayor de [1, 6, 12, 18, 24, 30] que no supere el nivel → <id>_nNN
  const ASPECTOS = D.skins || [1, 6, 12, 18, 24, 30];
  const aspecto = nivel => ASPECTOS.filter(a => a <= Math.max(1, nivel)).pop();
  // 0.7: nv30 → <id>_n30_grande y nv40 → <id>_n40_4x4 (4×4 casillas, 128 dp; de nv40 a nv50 se mantiene la de nv40)
  const skin = (tipo, nivel) => { const a = aspecto(nivel); return tipo + '_' + ((D.skinNombre || {})[a] || 'n' + String(a).padStart(2, '0')); };
  const skinGrande = nivel => (D.skinsGrandes || []).includes(aspecto(nivel));
  const MAX_HUECOS = 100, ORO_POR_PERSONA_MIN = 3, RECUPERA = 0.5;   // 0.5: hasta 100 parcelas abiertas (ayuntamiento nv30)

  // ---------- Azar con semilla (mapa y distribución distintos en cada partida) ----------
  function azar(semilla) { let a = semilla >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // 0.1.1 · Ciudad más grande: 40 parcelas posibles en una retícula 8×8 (manzanas de 2×2 entre calles). Las más cercanas al centro se abren primero.
  // Cada hueco es { c, f } (columna y fila de 0 a 7). Las 24 casillas que sobran son campo (árboles, huertos) solo de adorno.
  // 0.5 · Ciudad ampliada: retícula 12×12 (6×6 manzanas de 2×2); las 100 parcelas más cercanas al centro se abren por orden con el ayuntamiento.
  const COLS = 12, FILAS = 12, DESPL_05 = 2;   // las partidas antiguas (8×8) quedan centradas: +2 parcelas (= 1 manzana) en cada eje
  function generarHuecos(rnd, fijos = [], cols = COLS, max = MAX_HUECOS) {
    const usadas = new Set(fijos.map(h => h.c + ',' + h.f)), celdas = [], m = (cols - 1) / 2;
    for (let f = 0; f < cols; f++) for (let c = 0; c < cols; c++) if (!usadas.has(c + ',' + f)) celdas.push({ c, f, d: Math.hypot(c - m, f - m) + rnd() * 1.6 });
    celdas.sort((a, b) => a.d - b.d);
    return fijos.map(h => ({ c: h.c, f: h.f })).concat(celdas.slice(0, max - fijos.length).map(k => ({ c: k.c, f: k.f })));
  }
  // Partidas de la 0.1 (12 huecos en %, cuadrícula 6×6): cada hueco conserva su índice y su sitio relativo (la 6×6 queda centrada en la 8×8)
  // y se añaden 28 parcelas nuevas alrededor. Los edificios no se mueven; cuántos huecos se abren lo sigue marcando el ayuntamiento.
  const VERSION_PARTIDA = 11;   // 0.10
  function migrar(e) {
    migrarHuecos(e); ampliarCiudad(e);
    if (e && Array.isArray(e.edificios) && g.CivilikMilitar) g.CivilikMilitar.migrar(e);   // 0.2 → 0.3: se añade la parte militar; nada más cambia
    // 0.5 → 0.6: las partidas antiguas pasan al modo CLÁSICA (decisión de Jose). El tiempo desconectado de antes de la 0.6 no cuenta.
    if (e && Array.isArray(e.edificios)) {
      if (!e.modo) e.modo = 'clasica';
      if (!(e.ultimaVez > 0)) e.ultimaVez = Date.now();
      if (!(e.version >= 8)) e.version = 8;   // 0.6 → 0.7: + informes, tropas nuevas a 0, edificios hasta nv50 (nada se pierde)
      if (!(e.version >= 9)) e.version = 9;   // 0.7 → 0.8: mapa 150×150 (se recoloca el mundo), 50 ciudades, obreros de la Escuela, farmeo nuevo
      if (!(e.version >= 10)) e.version = 10;   // 0.8 → 0.9: + Campamento (nv1, 1 tienda y 1 cabaña); nada se quita aunque sobren tropas u obreros
      if (!(e.version >= 11)) e.version = 11;   // 0.9 → 0.10: plazas del Campamento exponenciales (salen del nivel; no cambia ningún dato)
    }
    return e;
  }
  function migrarHuecos(e) {
    if (!e || !Array.isArray(e.huecos)) return e;
    const viejo = e.huecos.some(h => h.c == null);
    if (e.reticula === COLS) return e;   // ya es una partida de la 0.5
    if (!viejo && e.huecos.length >= 40) { if (!(e.version >= 3)) e.version = 3; return e; }   // 0.1.1 → 0.2: mismos datos (solo cambia el ritmo)
    const fijos = viejo ? e.huecos.map(h => ({ c: Math.min(5, Math.max(0, Math.floor(h.x / (100 / 6)))) + 1, f: Math.min(5, Math.max(0, Math.floor(h.y / (100 / 6)))) + 1 })) : e.huecos;
    e.huecos = generarHuecos(azar((e.semilla ^ 0x5EED11) >>> 0), fijos, 8, 40);   // retícula 8×8 de la 0.1.1–0.4
    e.version = 3;
    return e;
  }
  // 0.4 → 0.5: las 40 parcelas de siempre conservan su índice y su sitio (desplazadas 1 manzana para quedar en el centro de la 12×12)
  // y se añaden 60 nuevas alrededor. Ningún edificio cambia de hueco.
  function ampliarCiudad(e) {
    if (!e || !Array.isArray(e.huecos) || e.reticula === COLS) return e;
    const fijos = e.huecos.map(h => ({ c: h.c + DESPL_05, f: h.f + DESPL_05 }));
    e.huecos = generarHuecos(azar((e.semilla ^ 0xC17A05) >>> 0), fijos);
    e.reticula = COLS;
    return e;
  }
  // Territorio (solo para ver): agua, llanura, bosque, colinas de piedra y montaña. Sin zonas jugables en esta prueba.
  function generarMapa(rnd, N = 28) {
    const G = 7, base = []; for (let i = 0; i < G * G; i++) base.push(rnd());
    const base2 = []; for (let i = 0; i < G * G; i++) base2.push(rnd());
    const muestra = (b, x, y) => { const fx = x / (N - 1) * (G - 1), fy = y / (N - 1) * (G - 1), x0 = Math.min(G - 2, Math.floor(fx)), y0 = Math.min(G - 2, Math.floor(fy)), tx = fx - x0, ty = fy - y0, s = t => t * t * (3 - 2 * t);
      const v = (i, j) => b[j * G + i]; const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * s(tx), d = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * s(tx); return a + (d - a) * s(ty); };
    let celdas = '';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const h = muestra(base, x, y), hum = muestra(base2, x, y);
      celdas += h < 0.3 ? 'a' : h > 0.78 ? 'm' : h > 0.64 ? 'p' : hum > 0.55 ? 'b' : 'l';
    }
    // Capital: la llanura más cercana al centro
    let cap = { x: N >> 1, y: N >> 1 }, mejor = 1e9;
    for (let y = 2; y < N - 2; y++) for (let x = 2; x < N - 2; x++) if (celdas[y * N + x] === 'l') { const d = Math.hypot(x - N / 2, y - N / 2); if (d < mejor) { mejor = d; cap = { x, y }; } }
    if (mejor === 1e9) celdas = celdas.slice(0, cap.y * N + cap.x) + 'l' + celdas.slice(cap.y * N + cap.x + 1);
    return { n: N, celdas, capital: cap };
  }

  // 0.2 · Zona reducida del mapa alrededor de la capital (solo para ver y recorrer). Sale SOLO de la semilla de la partida:
  // es estable entre sesiones y no hace falta guardarla. Tipos: a agua, l llanura, b bosque, p colinas de piedra, m montaña.
  // «dentro» marca las casillas de la zona visible (borde irregular); fuera queda el pergamino sin explorar. La ciudad está en el centro.
  function generarZona(semilla, N = 21) {
    const rnd = azar(((semilla >>> 0) ^ 0x9E3779B9) >>> 0), G = 6, b1 = [], b2 = [], b3 = [];
    for (let i = 0; i < G * G; i++) { b1.push(rnd()); b2.push(rnd()); b3.push(rnd()); }
    const s = t => t * t * (3 - 2 * t);
    const muestra = (b, x, y) => { const fx = x / (N - 1) * (G - 1), fy = y / (N - 1) * (G - 1), x0 = Math.min(G - 2, Math.floor(fx)), y0 = Math.min(G - 2, Math.floor(fy)), tx = s(fx - x0), ty = s(fy - y0);
      const v = (i, j) => b[j * G + i], a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * tx, d = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * tx; return a + (d - a) * ty; };
    const c = (N - 1) / 2, celdas = [], dentro = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dc = Math.hypot(x - c, y - c), ang = Math.atan2(y - c, x - c);
      const borde = (N / 2 - 1.2) + 0.6 * Math.sin(ang * 3 + b3[0] * 6) + 0.45 * Math.sin(ang * 5 + b3[1] * 6) + (muestra(b3, x, y) - 0.5) * 0.8;
      dentro.push(dc <= borde ? 1 : 0);
      let h = muestra(b1, x, y), hum = muestra(b2, x, y);
      if (dc < 4.6) { celdas.push('l'); continue; }               // llanura alrededor de la ciudad (cabe la ciudad de 3×3 edificios)
      if (dc < 6.2) h = Math.min(Math.max(h, 0.36), 0.62);         // ni agua ni roca pegadas a la ciudad
      celdas.push(h < 0.3 ? 'a' : h > 0.8 ? 'm' : h > 0.68 ? 'p' : hum > 0.52 ? 'b' : 'l');
    }
    return { n: N, celdas: celdas.join(''), dentro, capital: { x: c, y: c } };
  }

  const nid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  function nueva(nombre, semilla = (Math.random() * 2 ** 32) >>> 0, modoId = 'rapida') {
    if (!MODOS[modoId]) modoId = 'rapida';
    const rnd = azar(semilla), huecos = generarHuecos(rnd), mapa = generarMapa(rnd);   // (mapa: territorio de la 0.1, ya no se dibuja)
    const ahora = Date.now();
    const e = {
      formato: 'civilik-partida', version: VERSION_PARTIDA, modo: modoId, ultimaVez: Date.now(), reticula: COLS, id: nid(), nombre: (nombre || 'Partida').trim().slice(0, 40) || 'Partida', creada: ahora, actualizada: ahora, semilla,
      jugadoMs: 0, tutorialHecho: false, huecos, mapa,
      // 0.6: recursos iniciales de datos.js (Clásica 80/60/60/40; Rápida × 1,75 → 140/105/105/70, provisional)
      recursos: Object.fromEntries(RECURSOS.map(k => [k, Math.round(((D.recursosIniciales || {})[k] || 0) * (MODOS[modoId].inicio || 1))])),
      edificios: [{ id: 'ayto', tipo: 'ayuntamiento', nivel: 1, hueco: Math.floor(rnd() * 6), personas: 0, gastado: c(0, 0) }]
    };
    if (g.CivilikMilitar) g.CivilikMilitar.migrar(e);
    e.version = VERSION_PARTIDA;
    return e;
  }

  // ---------- Consultas ----------
  const ayto = e => e.edificios.find(b => b.tipo === 'ayuntamiento');
  const nivelCiudad = e => ayto(e).nivel;
  const huecosDisponibles = e => EDIFICIOS.ayuntamiento.huecos[nivelCiudad(e) - 1];
  const enHueco = (e, h) => e.edificios.find(b => b.hueco === h) || null;
  const necesitaPersonas = tipo => !!EDIFICIOS[tipo].trab;
  const maxTrab = b => necesitaPersonas(b.tipo) ? EDIFICIOS[b.tipo].trab[b.nivel - 1] : 0;
  const personasTotales = e => e.edificios.filter(b => b.tipo === 'casa').reduce((s, b) => s + EDIFICIOS.casa.da[b.nivel - 1], 0);
  const personasTrabajando = e => e.edificios.reduce((s, b) => s + (necesitaPersonas(b.tipo) ? b.personas : 0), 0);
  const personasLibres = e => personasTotales(e) - personasTrabajando(e);
  const nivelMax = (e, b) => b.tipo === 'ayuntamiento' ? EDIFICIOS.ayuntamiento.max : Math.min(EDIFICIOS[b.tipo].max, nivelCiudad(e));
  // 0.6: el depósito guarda ~3,5 h de producción de una granja de su nivel (en Clásica, de la producción de Clásica = ÷3)
  function aSalvoDeposito(b, e) { const v = Math.round(EDIFICIOS.deposito.aSalvo[b.nivel - 1] * factorModo(e)); return b.personas > 0 ? v : v / 2; }
  // Cantidad protegida de CADA recurso: ayuntamiento + depósitos
  const capacidadASalvo = e => EDIFICIOS.ayuntamiento.aSalvo[nivelCiudad(e) - 1] + e.edificios.filter(b => b.tipo === 'deposito').reduce((s, b) => s + aSalvoDeposito(b, e), 0);
  function aSalvo(e) { const cap = capacidadASalvo(e), r = {}; for (const k of RECURSOS) r[k] = Math.min(Math.floor(e.recursos[k]), cap); return r; }
  // Ritmos por minuto (a pleno = ritmo; con menos personas, proporcional)
  // 0.5: la rama «Economía» de la Academia suma un % a la producción de su recurso (si se pasa la partida e)
  const bonoProduccion = (e, recurso) => (e && e.militar && g.CivilikMilitar) ? g.CivilikMilitar.bonoProduccion(e, recurso) : 0;
  // 0.6: con la partida e, el ritmo incluye el modo (Clásica ÷3); sin e, es el de la tabla
  function ritmoEdificio(b, e) { const d = EDIFICIOS[b.tipo]; return d.produce ? d.ritmo[b.nivel - 1] * b.personas / d.trab[b.nivel - 1] * (1 + bonoProduccion(e, d.produce)) * factorModo(e) : 0; }
  function ritmos(e) {
    const fm = factorModo(e), r = { comida: 0, madera: 0, piedra: 0, oro: personasTotales(e) * ORO_POR_PERSONA_MIN * fm, hierro: 0, metal: 0 };
    for (const b of e.edificios) { const d = EDIFICIOS[b.tipo]; if (d.produce) { const v = ritmoEdificio(b, e); r[d.produce] += v; if (d.gasta) r.hierro -= ritmoEdificio(b) * fm * d.gasta.hierro; } }
    if (e.militar && g.CivilikMilitar && g.CivilikMilitar.tributo) for (const [k, v] of Object.entries(g.CivilikMilitar.tributo(e))) r[k] += v;   // 0.6: ciudades conquistadas
    return r;
  }
  const alcanza = (e, coste) => Object.entries(coste).every(([k, v]) => e.recursos[k] + 1e-9 >= v);
  const pagar = (e, coste) => { for (const [k, v] of Object.entries(coste)) e.recursos[k] -= v; };
  const sumar = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = (a[k] || 0) + v; };
  const faltan = (e, coste) => Object.entries(coste).filter(([k, v]) => e.recursos[k] + 1e-9 < v).map(([k, v]) => NOMBRE_RECURSO[k].toLowerCase() + ' ' + Math.ceil(v - e.recursos[k]));

  // ---------- Tiempo jugado ----------
  // 0.6: opts.desconectado = tiempo sin jugar en Clásica → producción y consumo × 0,5 (los temporizadores corren enteros)
  function avanzar(e, ms, opts = {}) {
    if (!(ms > 0)) return e;
    const k = opts.desconectado ? (modo(e).desconectado || 0.5) : 1, min = ms / 60000, minP = min * k, fm = factorModo(e);
    e.recursos.oro += personasTotales(e) * ORO_POR_PERSONA_MIN * fm * minP;
    const fundiciones = [];
    for (const b of e.edificios) { const d = EDIFICIOS[b.tipo]; if (!d.produce) continue; if (d.gasta) fundiciones.push(b); else e.recursos[d.produce] += ritmoEdificio(b, e) * minP; }
    for (const b of fundiciones) {   // gasta 2 de hierro por cada metal; sin hierro suficiente, produce en proporción al disponible (la Minería sube el metal, no el gasto)
      const base = ritmoEdificio(b) * fm * minP, metal = ritmoEdificio(b, e) * minP, hierro = base * EDIFICIOS.fundicion.gasta.hierro;
      const f = hierro > 0 ? Math.min(1, Math.max(0, e.recursos.hierro) / hierro) : 0;
      e.recursos.hierro = Math.max(0, e.recursos.hierro - hierro * f); e.recursos.metal += metal * f;
    }
    if (e.militar && g.CivilikMilitar) g.CivilikMilitar.avanzar(e, ms, { factor: k, desconectado: !!opts.desconectado });   // 0.3: mantenimiento de tropas y héroes, heridas e inactividad
    if (!opts.desconectado) e.jugadoMs += ms;
    return e;
  }
  // 0.6 · Clásica: al volver se cobra el tiempo desconectado (tope 5 h) a la mitad, en pasos de 1 min. Devuelve los ms aplicados.
  function ponerseAlDia(e, ms) {
    const md = modo(e); if (!md.tiempoReal || !(ms > 0)) return 0;
    const total = Math.min(ms, (md.desconectadoMaxH || 5) * 3600000);
    for (let t = 0; t < total; t += 60000) avanzar(e, Math.min(60000, total - t), { desconectado: true });
    return total;
  }

  // ---------- Acciones (devuelven { ok, motivo }) ----------
  const NO = motivo => ({ ok: false, motivo }), SI = (extra = {}) => ({ ok: true, ...extra });
  function puedeConstruir(e, tipo, hueco) {
    const d = EDIFICIOS[tipo];
    if (!d || !CONSTRUIBLES.includes(tipo)) return NO('Edificio desconocido');
    if (!(hueco >= 0 && hueco < huecosDisponibles(e))) return NO('Hueco bloqueado: mejora el ayuntamiento');
    if (enHueco(e, hueco)) return NO('Hueco ocupado');
    if (d.unico && e.edificios.some(b => b.tipo === tipo)) return NO('Solo puede haber un' + (['academia', 'botica', 'tienda', 'universidad', 'escuela_maestria'].includes(tipo) ? 'a ' : ' ') + d.nombre.toLowerCase());
    if (nivelCiudad(e) < d.requiere) return NO('Requiere ayuntamiento nivel ' + d.requiere);
    if (necesitaPersonas(tipo) && personasLibres(e) < 1) return NO('Necesita al menos 1 persona libre (construye o mejora casas)');
    if (!alcanza(e, d.coste[0])) return NO('Faltan ' + faltan(e, d.coste[0]).join(', '));
    return SI();
  }
  function construir(e, tipo, hueco) {
    const p = puedeConstruir(e, tipo, hueco); if (!p.ok) return p;
    const d = EDIFICIOS[tipo], coste = d.coste[0];
    pagar(e, coste);
    const b = { id: nid(), tipo, nivel: 1, hueco, personas: necesitaPersonas(tipo) ? Math.min(personasLibres(e), d.trab[0]) : 0, gastado: { ...coste } };
    e.edificios.push(b);
    return SI({ edificio: b });
  }
  const costeMejora = b => b.tipo === 'ayuntamiento' ? EDIFICIOS.ayuntamiento.mejora[b.nivel] : EDIFICIOS[b.tipo].coste[b.nivel];
  // 0.5 · Botón «Máx»: hasta qué nivel se puede subir AHORA pagando nivel a nivel (sin pasar del ayuntamiento ni del máximo). Devuelve { nivel, coste, pasos }.
  function maxMejora(e, id) {
    const b = e.edificios.find(x => x.id === id); if (!b) return { nivel: 0, coste: {}, pasos: 0 };
    const tope = Math.min(EDIFICIOS[b.tipo].max, nivelMax(e, b)), r = { ...e.recursos }, total = {};
    let n = b.nivel;
    while (n < tope) {
      const c = b.tipo === 'ayuntamiento' ? EDIFICIOS.ayuntamiento.mejora[n] : EDIFICIOS[b.tipo].coste[n];
      if (!Object.entries(c).every(([k, v]) => !v || r[k] + 1e-9 >= v)) break;
      for (const [k, v] of Object.entries(c)) if (v) { r[k] -= v; total[k] = (total[k] || 0) + v; }
      n++;
    }
    return { nivel: n, coste: total, pasos: n - b.nivel };
  }
  function mejorarMax(e, id) {
    const m = maxMejora(e, id); if (!m.pasos) { const p = puedeMejorar(e, id); return p.ok ? NO('No alcanza') : p; }
    for (let i = 0; i < m.pasos; i++) { const r = mejorar(e, id); if (!r.ok) return r; }
    return SI({ niveles: m.pasos, nivel: m.nivel, coste: m.coste });
  }
  function puedeMejorar(e, id) {
    const b = e.edificios.find(x => x.id === id); if (!b) return NO('No existe');
    if (b.nivel >= EDIFICIOS[b.tipo].max) return NO('Nivel máximo');
    if (b.nivel >= nivelMax(e, b)) return NO('El ayuntamiento marca el nivel máximo: mejóralo primero');
    const coste = costeMejora(b);
    if (!alcanza(e, coste)) return NO('Faltan ' + faltan(e, coste).join(', '));
    return SI({ coste });
  }
  function mejorar(e, id) {
    const p = puedeMejorar(e, id); if (!p.ok) return p;
    const b = e.edificios.find(x => x.id === id);
    pagar(e, p.coste); sumar(b.gastado, p.coste); b.nivel++;
    if (necesitaPersonas(b.tipo)) b.personas += Math.max(0, Math.min(personasLibres(e), maxTrab(b) - b.personas));   // las extra van solas si hay libres
    return SI({ edificio: b });
  }
  function ponerPersona(e, id) {
    const b = e.edificios.find(x => x.id === id); if (!b || !necesitaPersonas(b.tipo)) return NO('Este edificio no usa personas');
    if (b.personas >= maxTrab(b)) return NO('Ya tiene el máximo de personas de su nivel');
    if (personasLibres(e) < 1) return NO('No hay personas libres');
    b.personas++; return SI();
  }
  function quitarPersona(e, id) {
    const b = e.edificios.find(x => x.id === id); if (!b || !necesitaPersonas(b.tipo)) return NO('Este edificio no usa personas');
    if (b.personas <= 1) return NO('No se puede quitar la última persona');
    b.personas--; return SI();
  }
  function puedeDemoler(e, id) {
    const b = e.edificios.find(x => x.id === id); if (!b) return NO('No existe');
    if (b.tipo === 'ayuntamiento') return NO('El ayuntamiento no se puede demoler');
    if (b.tipo === 'casa') {
      const quedan = personasTotales(e) - EDIFICIOS.casa.da[b.nivel - 1];
      const minimos = e.edificios.filter(x => necesitaPersonas(x.tipo)).length;
      if (quedan < minimos) return NO('No se puede: esas personas son las últimas de algún edificio');
    }
    return SI();
  }
  function demoler(e, id) {
    const p = puedeDemoler(e, id); if (!p.ok) return p;
    const b = e.edificios.find(x => x.id === id), devuelto = {};
    for (const [k, v] of Object.entries(b.gastado)) if (v) { devuelto[k] = Math.floor(v * RECUPERA); e.recursos[k] += devuelto[k]; }
    e.edificios = e.edificios.filter(x => x !== b);   // si trabajaban personas, quedan libres
    if (b.tipo === 'casa') {   // se pierden sus personas: primero las libres; si no bastan, salen de edificios (nunca de su última)
      let exceso = personasTrabajando(e) - personasTotales(e);
      while (exceso > 0) {
        const x = e.edificios.filter(y => necesitaPersonas(y.tipo) && y.personas > 1).sort((a, z) => z.personas - a.personas)[0];
        if (!x) break; x.personas--; exceso--;
      }
    }
    return SI({ devuelto });
  }
  function mover(e, id, hueco) {
    const b = e.edificios.find(x => x.id === id); if (!b) return NO('No existe');
    if (!(hueco >= 0 && hueco < huecosDisponibles(e))) return NO('Hueco bloqueado');
    if (enHueco(e, hueco)) return NO('Hueco ocupado');
    b.hueco = hueco; return SI();   // mover es gratis
  }

  g.CivilikJuego = { VERSION_PARTIDA, MODOS, modo, factorModo, ponerseAlDia, ORO_POR_PERSONA_MIN, generarZona, MAX_HUECOS, COLS, FILAS, DESPL_05, migrar, ampliarCiudad, maxMejora, mejorarMax, bonoProduccion, RECURSOS, NOMBRE_RECURSO, EDIFICIOS, CONSTRUIBLES, MILITARES, ASPECTOS, aspecto, skin, skinGrande, nueva, azar, generarHuecos, generarMapa, ayto, nivelCiudad, huecosDisponibles, enHueco, necesitaPersonas, maxTrab,
    personasTotales, personasTrabajando, personasLibres, nivelMax, capacidadASalvo, aSalvo, ritmoEdificio, ritmos, avanzar, puedeConstruir, construir, costeMejora, puedeMejorar, mejorar,
    ponerPersona, quitarPersona, puedeDemoler, demoler, mover };
})(typeof window !== 'undefined' ? window : globalThis);
