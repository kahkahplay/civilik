/* Civili'k 0.8 · parte militar (sin DOM): mapa del mundo (monstruos, ciudades enemigas, zonas de farmeo), tropas, héroes (también convocables),
   combate automático, pociones, Academia (árbol de habilidades), objetos, misiones y estadísticas.
   Números en js/datos.js. Todo el tiempo es tiempo JUGADO (avanzar() solo se llama mientras se juega, ya multiplicado por x1/x2/x3).
   El azar sale de la semilla de la partida y de un contador guardado (e.militar.azarN): el mismo estado da siempre el mismo resultado. */
(function (g) {
  'use strict';
  const J = g.CivilikJuego, D = g.CivilikDatos, W = () => g.CivilikMundo;
  const TIPOS_TROPA = Object.keys(D.tropas), TIPOS_HEROE = D.heroes.criables.slice(), POCIONES = Object.keys(D.pociones), MS_MIN = 60000;
  const TIPOS_MONSTRUO = Object.keys(D.monstruos.tipos), FAMILIAS = TIPOS_MONSTRUO.filter(t => !D.monstruos.tipos[t].sinHeroe), OBJETOS = Object.keys(D.objetos), HABS = D.academia.habilidades.concat((D.universidad && D.universidad.habilidades) || []);   // 0.7: + árbol de la Universidad
  const NO = motivo => ({ ok: false, motivo }), SI = (extra = {}) => ({ ok: true, ...extra });
  const NOMBRE = k => (J.NOMBRE_RECURSO[k] || k).toLowerCase();
  const alcanza = (e, coste) => Object.entries(coste).every(([k, v]) => !v || e.recursos[k] + 1e-9 >= v);
  const faltan = (e, coste) => Object.entries(coste).filter(([k, v]) => v && e.recursos[k] + 1e-9 < v).map(([k, v]) => NOMBRE(k) + ' ' + Math.ceil(v - e.recursos[k]));
  const pagar = (e, coste) => { for (const [k, v] of Object.entries(coste)) if (v) e.recursos[k] -= v; };
  const sumar = (a, b, f = 1) => { for (const [k, v] of Object.entries(b)) if (v) a[k] = (a[k] || 0) + v * f; return a; };
  const por = (coste, n) => Object.fromEntries(Object.entries(coste).filter(([, v]) => v).map(([k, v]) => [k, v * n]));
  const edificio = (e, tipo) => e.edificios.find(b => b.tipo === tipo) || null;
  const cero = lista => Object.fromEntries(lista.map(k => [k, 0]));
  const DEFENSAS = Object.keys(D.defensas || {});
  const OBREROS = Object.keys(D.obreros), LEGENDARIOS = Object.keys(D.legendarios.tipos);   // 0.8
  const modo = e => J.modo(e), fMant = e => (e && J.modo(e).mantenimiento) || 1;

  // ---------- Estado de la partida ----------
  function vacio() {
    return { tropas: cero(TIPOS_TROPA), heroes: [], fragmentos: 0, fragFamilia: cero(FAMILIAS), pociones: cero(POCIONES), objetos: cero(OBJETOS),
      investigado: [], academia: {}, monstruos: [], ciudades: [], zonas: [], expediciones: [], misionesCobradas: [],
      azarN: 0, combates: 0, victorias: 0, derrotas: 0, saqueos: 0, recolecciones: 0, recolectado: {}, entrenadas: 0, convocados: 0, porFamilia: cero(FAMILIAS),
      crisis: null, heroeInicialPendiente: true, desertores: 0, ultimoCombate: null, avisos: [],
      // 0.6
      muralla: 0, marchas: [], efectos: {}, defensas: cero(DEFENSAS), conquistas: 0, defensasGanadas: 0, defensasPerdidas: 0, robado: {}, pazFirmadas: 0, ultimaDefensa: null,
      // 0.7
      informes: [], informesVistos: 0, informeN: 0, marchasAceleradas: 0,
      // 0.8
      obreros: cero(OBREROS), obrerosFormados: 0, capturas: [], capturados: 0, asedioMs: 0, farmeosAcelerados: 0, cofresAbiertos: 0,
      // 0.9
      campamento: campamentoInicial(), despedidas: 0, defensasBorradas: 0 };
  }
  // ---------- 0.7 · Informes: historial PERMANENTE (se guarda con la partida) de batallas y avisos, también los de cuando no estabas ----------
  let FUERA = false;   // true mientras se cobra el tiempo desconectado (Clásica)
  function informe(e, tipo, datos) {
    const m = e.militar; if (!m) return null; if (!Array.isArray(m.informes)) m.informes = [];
    m.informeN = (m.informeN || 0) + 1;
    const x = { n: m.informeN, t: Date.now(), jugadoMs: Math.round(e.jugadoMs || 0), desconectado: FUERA || undefined, ...datos, tipo };   // 0.8: «tipo» es siempre el del informe
    if (datos && datos.tipo && datos.tipo !== tipo) x.objetivoTipo = datos.tipo;   // (el resumen de combate trae el tipo del monstruo)
    m.informes.push(x); const max = (D.informes && D.informes.max) || 500; if (m.informes.length > max) m.informes.splice(0, m.informes.length - max);
    return x;
  }
  const informesNuevos = e => { const m = e.militar; return m ? (m.informes || []).filter(x => x.n > (m.informesVistos || 0)).length : 0; };
  function marcarInformesVistos(e) { const m = e.militar; if (m) m.informesVistos = m.informeN || 0; }
  // resumen compacto de un combate para el informe
  // 0.8: con el desglose completo (tropas de cada bando, bajas, héroes, efectos, botín) para la hoja del informe
  const resumenCombate = (r, extra = {}) => ({ gana: r.gana, ciudad: r.ciudad, conquistada: r.conquistada, nombre: r.monstruo.nombre, nivel: r.monstruo.nivel, enemigo: r.monstruo.fuerza, fuerza: r.fuerza,
    enviadas: r.enviadas, bajas: r.bajas, botin: r.botin ? r.botin.recursos : null, fragmentos: r.botin ? (r.botin.fragmentos || 0) + (r.botin.comunes || 0) : 0, heridos: (r.heridos || []).map(h => h.nombre),
    clase: r.monstruo.clase || null, tipo: r.monstruo.tipo || null, legendario: !!r.monstruo.legendario, enemigoBase: r.monstruo.fuerzaBase, azar: r.azar, xp: r.xp,
    heroesDet: r.heroesDet || [], efectos: r.efectos || [], botinDet: r.botin ? { familia: r.botin.familia, fragmentos: r.botin.fragmentos || 0, comunes: r.botin.comunes || 0, pociones: r.botin.pociones || {}, objetos: r.botin.objetos || {} } : null,
    capturable: !!r.captura, ...extra });
  function azar(e) { const m = e.militar; m.azarN = (m.azarN || 0) + 1; return J.azar(((e.semilla >>> 0) ^ Math.imul(m.azarN, 2654435761) ^ 0xC0BA7) >>> 0); }
  // Partidas nuevas y migradas (0.1 … 0.4 → 0.5). Nada de la ciudad se toca. Desde la 0.5:
  //  · los monstruos se recolocan en el mapa del mundo (100×100) con las familias nuevas; se añaden ciudades enemigas y zonas de farmeo;
  //  · la investigación antigua pasa a niveles de la Academia (D.academia.antiguas); los fragmentos antiguos quedan como «comunes»;
  //  · los héroes suben solos los niveles que ya tengan ganados con su experiencia.
  function migrar(e) {
    if (!e || !Array.isArray(e.edificios)) return e;
    if (!e.militar) e.militar = vacio();
    const m = e.militar, v = vacio(), sinInformes = !Array.isArray(m.informes);
    for (const k of Object.keys(v)) if (m[k] === undefined) m[k] = v[k];
    for (const [k, lista] of [['defensas', DEFENSAS], ['tropas', TIPOS_TROPA], ['pociones', POCIONES], ['fragFamilia', FAMILIAS], ['objetos', OBJETOS], ['porFamilia', FAMILIAS], ['obreros', OBREROS]]) for (const t of lista) if (!(m[k][t] >= 0)) m[k][t] = 0;
    migrarObreros(e);
    if (!(m.mundoV >= 1)) {   // 0.4 → 0.5
      m.monstruos = []; m.ciudades = []; m.zonas = []; m.expediciones = [];
      for (const id of m.investigado || []) { const a = D.academia.antiguas[id]; if (a) m.academia[a[0]] = Math.max(m.academia[a[0]] || 0, a[1]); }
      for (const id of Object.keys(m.academia)) { let h = hab(id); while (h && h.requiere) { if (!(m.academia[h.requiere] >= 1)) m.academia[h.requiere] = 1; h = hab(h.requiere); } }
      m.investigado = Object.keys(m.academia).filter(k => m.academia[k] >= 1);
      if (m.victorias == null || m.victorias === 0) m.victorias = 0;
      m.mundoV = 1;
    }
    if (!(m.mundoV >= 2)) {   // 0.5 → 0.6: monstruos y ciudades con la fuerza nueva; zonas con guardia; monstruos con renovación
      for (const mo of m.monstruos) { mo.fuerza = D.monstruos.fuerza[mo.nivel - 1]; }
      for (const c of m.ciudades) c.fuerza = Math.round(D.monstruos.fuerza[c.nivel - 1] * D.ciudades.fuerza);
      m.mundoV = 2;
    }
    if (!(m.mundoV >= 3)) migrar08(e);   // 0.7 → 0.8
    { const r = azar(e); for (const mo of m.monstruos) if (!(mo.vidaMs >= 0)) mo.vidaMs = vidaMonstruo(r); }
    // 0.6 → 0.7: el historial de informes empieza con el último combate y la última defensa que hubiera (marcados como anteriores a la 0.7)
    if (sinInformes) {
      if (m.ultimoCombate && m.ultimoCombate.monstruo) informe(e, 'combate', resumenCombate(m.ultimoCombate, { anterior: true }));
      if (m.ultimaDefensa) informe(e, 'defensa', { ...m.ultimaDefensa, anterior: true });
    }
    poblarMundo(e);
    for (const h of m.heroes) subirAuto(e, h);
    migrar09(e); migrar10(e);
    if (!(e.version >= 6)) e.version = 6;
    return e;
  }
  // 0.8 · el obrero único de la 0.6/0.7 (tropa «obrero», dibujo Peón/Cantero/Maestro de obras según el Cuartel 1–9/10–19/20+) pasa al obrero de la Escuela equivalente
  function migrarObreros(e) {
    const m = e.militar, cu = edificio(e, 'cuartel'), nc = cu ? cu.nivel : 1;
    const destino = D.obrerosAntiguos.filter(([n]) => nc >= n).pop()[1];
    let n = 0;
    if (m.tropas && m.tropas.obrero != null) { n += m.tropas.obrero || 0; delete m.tropas.obrero; }
    for (const x of m.marchas || []) if (x.tropas && x.tropas.obrero != null) { n += x.tropas.obrero || 0; delete x.tropas.obrero; }
    if (n > 0) { m.obreros[destino] = (m.obreros[destino] || 0) + n; m.obrerosMigrados = { n: n + ((m.obrerosMigrados && m.obrerosMigrados.n) || 0), tipo: destino, cuartel: nc }; }
    return n;
  }
  // 0.8 · mapa 150×150: se recoloca todo. Las recogidas en curso se dan por terminadas (con lo que iban a traer); las ciudades conquistadas se conservan
  //       (marcadas como «antiguas»: no cuentan para la misión de las 50) y las demás de la 0.7 desaparecen (y con ellas sus guerras). Aparecen 50 nuevas.
  function migrar08(e) {
    const m = e.militar;
    for (const x of m.expediciones || []) {
      for (const [t, n] of Object.entries(x.tropas || {})) { if (D.tropas[t]) m.tropas[t] += n; else if (t === 'obrero') m.tropas.obrero = (m.tropas.obrero || 0) + n; }
      const traido = x.fallo ? 0 : Math.floor(x.cantidad || 0); if (traido > 0) { e.recursos[x.recurso] += traido; m.recolectado[x.recurso] = (m.recolectado[x.recurso] || 0) + traido; }
      m.recolecciones++;
    }
    m.expediciones = []; migrarObreros(e);
    const antiguas = m.ciudades.filter(c => c.conquistada).map(c => ({ ...c, id: 'v' + c.id, antigua: true, guerra: false, ataqueMs: undefined, recolocar: true }));
    for (const x of m.marchas || []) if (typeof x.objetivo === 'string' && /^c\d/.test(x.objetivo)) x.objetivo = 'perdida_' + x.objetivo;
    m.ciudades = antiguas; m.monstruos = []; m.zonas = [];
    m.mundoV = 3;
  }

  // 0.9 · Campamento: las partidas de la 0.8 reciben el de inicio (nv1 + 1 tienda + 1 cabaña). Si ya superan las plazas, no se les quita nada
  //       (solo no pueden crear más); se apunta para avisar una vez y queda en Informes.
  function migrar09(e) {
    const m = e.militar; if (m.campamentoV >= 1) return;
    if (!m.campamento || !Array.isArray(m.campamento.edificios)) m.campamento = campamentoInicial();
    const t = totalTropasConFuera(e), o = totalObrerosConFuera(e), pt = plazasTropas(e), po = maxObreros(e);
    if (t > pt || o > po) { m.campamentoExceso = { tropas: t, plazas: pt, obreros: o, maxObreros: po }; informe(e, 'campamento', { ...m.campamentoExceso }); }
    m.campamentoV = 1;
  }
  // 0.10 · plazas exponenciales: nada cambia en la partida (las plazas salen del nivel). Si el aviso de «más tropas que plazas» ya no aplica, se quita.
  function migrar10(e) {
    const m = e.militar; if (m.campamentoV >= 2) return; migrar09(e);
    if (m.campamentoExceso && totalTropasConFuera(e) <= plazasTropas(e) && totalObrerosConFuera(e) <= maxObreros(e)) delete m.campamentoExceso;
    m.campamentoV = 2;
  }

  // ---------- Mapa del mundo: monstruos, ciudades enemigas y zonas de farmeo ----------
  const mundo = e => W().generarMundo(e.semilla);
  const entidades = e => { const m = e.militar; return m.monstruos.concat(m.ciudades, m.zonas); };
  // Busca una casilla libre al azar (muestreo): tierra, dentro, lejos de la ciudad y de las demás cosas del mapa. filtro(x, y, d) opcional.
  function buscarSitio(e, r, { sep = 3, dmin = D.monstruos.libreCapital, dmax = 1e9, filtro = null, evitar = null } = {}) {
    const w = mundo(e), N = w.n, otros = entidades(e);
    for (const s of [sep, Math.max(2, sep - 1), 1.5]) for (let i = 0; i < 600; i++) {
      const x = 1 + Math.floor(r() * (N - 2)), y = 1 + Math.floor(r() * (N - 2));
      if (!W().libre(w, x, y)) continue;
      const d = W().distCapital(w, x, y); if (d < dmin || d > dmax) continue;
      if (filtro && !filtro(x, y, d) && i < 450) continue;
      if (otros.some(o => Math.hypot(o.x - x, o.y - y) < s)) continue;
      if (evitar && Math.hypot(evitar.x - x, evitar.y - y) < s) continue;
      return { x, y, d };
    }
    return null;
  }
  const cercaDeTerreno = (w, x, y, t) => !t || [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => W().tipoEn(w, x + a, y + b) === t);
  function colocarMonstruo(e, r, evitar, cerca) {
    const M = D.monstruos, w = mundo(e);
    // nivel objetivo repartido por igual entre 1 y 30 (si no, casi todos saldrían lejos y de nivel alto: hay mucha más superficie lejos)
    const nObj = 1 + Math.floor(r() * 30), dObj = distanciaDeNivel(nObj);
    const p = buscarSitio(e, r, { sep: M.separacion, dmin: cerca ? M.radioCerca[0] : M.libreCapital, dmax: cerca ? M.radioCerca[1] : 1e9, evitar, filtro: cerca ? null : (x, y, d) => Math.abs(d - dObj) < 2.5 });
    if (!p) return null;
    const nivel = W().nivelPorDistancia(p.d, r, M.nivelAzar || 1);
    let tipos = TIPOS_MONSTRUO.filter(t => M.tipos[t].niveles[0] <= nivel && nivel <= M.tipos[t].niveles[1] && (!M.tipos[t].jefe || p.d >= 15));
    if (!tipos.length) tipos = ['orco'];
    const pesos = tipos.map(t => cercaDeTerreno(w, p.x, p.y, M.tipos[t].terreno) && M.tipos[t].terreno ? 3 : 1), tot = pesos.reduce((a, b) => a + b, 0);
    let q = r() * tot, tipo = tipos[0]; for (let i = 0; i < tipos.length; i++) { q -= pesos[i]; if (q <= 0) { tipo = tipos[i]; break; } }
    const mo = { id: 'm' + e.militar.azarN + '_' + Math.floor(r() * 1e6), tipo, nivel, fuerza: M.fuerza[nivel - 1], x: p.x, y: p.y, vidaMs: vidaMonstruo(r) };
    if (cerca) mo.cerca = true;
    return mo;
  }
  // 0.6 · renovación: cada monstruo dura 10–15 min si nadie lo ataca · guardia de las zonas = monstruo de su nivel × 0,5
  const vidaMonstruo = r => { const R = D.monstruos.rotacionMin || [10, 15]; return Math.round((R[0] + r() * (R[1] - R[0])) * MS_MIN); };
  const defensaZona = nivel => Math.round(D.monstruos.fuerza[nivel - 1] * (D.guardiaZona || 0));
  const distanciaDeNivel = n => D.monstruos.nivelPorDistancia.desde + (n - 1) * (D.monstruos.nivelPorDistancia.hasta - D.monstruos.nivelPorDistancia.desde) / 29;
  // 0.8: 50 ciudades nv15–50; distancia a tu ciudad según su nivel (de distanciaMin a distanciaMax). Nombres: los que no use ya una conquistada de la 0.7.
  const distanciaCiudad = nivel => { const C = D.ciudades, n0 = C.niveles[0], n1 = C.niveles[C.niveles.length - 1]; return C.distanciaMin + (nivel - n0) / Math.max(1, n1 - n0) * (C.distanciaMax - C.distanciaMin); };
  function sitioCiudad(e, r, dObj) {
    const C = D.ciudades;   // si no cabe con su separación, se busca con menos (siempre caben las 50: la misión se puede cumplir)
    return buscarSitio(e, r, { sep: C.separacion, dmin: 8, filtro: (x, y, d) => Math.abs(d - dObj) < 4 }) || buscarSitio(e, r, { sep: 2, dmin: 6 }) || buscarSitio(e, r, { sep: 1, dmin: 5 });
  }
  function crearCiudad(e, r, i) {
    const C = D.ciudades, nivel = C.niveles[i], p = sitioCiudad(e, r, distanciaCiudad(nivel)); if (!p) return null;
    const usados = new Set(e.militar.ciudades.filter(c => c.antigua).map(c => c.nombre)), libres = C.nombres.filter(n => !usados.has(n));
    return { id: 'c' + i, nombre: libres[i % libres.length], nivel, fuerza: Math.round(D.monstruos.fuerza[nivel - 1] * C.fuerza), x: p.x, y: p.y, recuperaMs: 0, saqueos: 0 };
  }
  // 0.8 · legendarios: nv31–50, lejos (≥ 55 casillas), uno de los 4 al azar (con preferencia por su terreno)
  function colocarLegendario(e, r, evitar) {
    const L = D.legendarios, w = mundo(e);
    const p = buscarSitio(e, r, { sep: 4, dmin: L.distanciaMin, evitar }); if (!p) return null;
    const pesos = LEGENDARIOS.map(t => cercaDeTerreno(w, p.x, p.y, L.tipos[t].terreno) ? 3 : 1), tot = pesos.reduce((a, b) => a + b, 0);
    let q = r() * tot, tipo = LEGENDARIOS[0]; for (let i = 0; i < LEGENDARIOS.length; i++) { q -= pesos[i]; if (q <= 0) { tipo = LEGENDARIOS[i]; break; } }
    const nivel = L.niveles[0] + Math.floor(r() * (L.niveles[1] - L.niveles[0] + 1));
    return { id: 'L' + e.militar.azarN + '_' + Math.floor(r() * 1e6), tipo, legendario: true, nivel, fuerza: Math.round(D.monstruos.fuerza[nivel - 1] * L.fuerza), x: p.x, y: p.y, vidaMs: vidaMonstruo(r) * 3 };
  }
  const reponerMonstruo = (e, r, mo) => mo.legendario ? colocarLegendario(e, r, mo) : colocarMonstruo(e, r, mo, mo.cerca);
  const RECURSOS_ZONA = Object.keys(D.zonas.recursos);
  // 0.8 · zonas sin nivel, sin guardia y sin agotarse; su aspecto (1–3) solo cambia el dibujo
  function crearZona(e, r, recurso, evitar, k = 0) {
    const Z = D.zonas, w = mundo(e), t = Z.recursos[recurso].terreno;
    const dObj = Z.distanciaMin + r() * (Z.distanciaMax - Z.distanciaMin);
    const p = buscarSitio(e, r, { sep: Z.separacion, dmin: Z.distanciaMin, dmax: Z.distanciaMax + 10, evitar, filtro: (x, y, d) => cercaDeTerreno(w, x, y, t) && Math.abs(d - dObj) < 6 }); if (!p) return null;
    return { id: 'z' + e.militar.azarN + '_' + Math.floor(r() * 1e6), recurso, aspecto: 1 + (k % 3), x: p.x, y: p.y };
  }
  function poblarMundo(e) {
    const m = e.militar, M = D.monstruos;
    if (m.ciudades.some(c => c.recolocar)) { const r = azar(e);   // 0.8: las conquistadas de la 0.7, recolocadas en el mapa nuevo
      for (const c of m.ciudades.filter(c => c.recolocar)) { const p = sitioCiudad(e, r, Math.max(10, distanciaDeNivel(c.nivel))); if (p) { c.x = p.x; c.y = p.y; } delete c.recolocar; delete c.ataqueMs; } }
    if (m.ciudades.filter(c => !c.antigua).length < D.ciudades.niveles.length) { const r = azar(e); for (let i = 0; i < D.ciudades.niveles.length; i++) if (!m.ciudades.some(c => c.id === 'c' + i)) { const c = crearCiudad(e, r, i); if (c) m.ciudades.push(c); } }
    if (m.zonas.length < D.zonas.cantidad) { const r = azar(e); let k = m.zonas.length; while (m.zonas.length < D.zonas.cantidad) { const z = crearZona(e, r, RECURSOS_ZONA[k % RECURSOS_ZONA.length], null, k); k++; if (!z) break; m.zonas.push(z); } }
    const cercanos = () => m.monstruos.filter(x => x.cerca).length, normales = () => m.monstruos.filter(x => !x.legendario).length, legs = () => m.monstruos.filter(x => x.legendario).length;
    if (cercanos() < M.cerca) { const r = azar(e); while (cercanos() < M.cerca) { const x = colocarMonstruo(e, r, null, true); if (!x) break; m.monstruos.push(x); } }
    if (normales() < M.cantidad) { const r = azar(e); while (normales() < M.cantidad) { const x = colocarMonstruo(e, r); if (!x) break; m.monstruos.push(x); } }
    if (legs() < D.legendarios.cantidad) { const r = azar(e); while (legs() < D.legendarios.cantidad) { const x = colocarLegendario(e, r); if (!x) break; m.monstruos.push(x); } }
  }
  // Rango I / II / III por nivel (monstruos, ciudades y zonas: su nivel; tropas: el nivel del Cuartel) y marco del héroe (bronce / plata / oro)
  const rangoDe = nivel => { const i = D.rangos.findIndex(([a, b]) => nivel >= a && nivel <= b); return i < 0 ? (nivel > D.rangos[D.rangos.length - 1][1] ? D.rangos.length : 1) : i + 1; };
  const rangoTropas = e => { const cu = edificio(e, 'cuartel'); return rangoDe(cu ? cu.nivel : 1); };
  const marcoHeroe = h => (D.heroes.marcos.find(([a, b]) => h.nivel >= a && h.nivel <= b) || D.heroes.marcos[D.heroes.marcos.length - 1])[2];
  const datosMonstruo = m => {
    if (m.legendario) { const L = D.legendarios.tipos[m.tipo] || D.legendarios.tipos.fenix; return { ...L, ...m, rango: 4, nombre: L.nombre, categoria: 'legendario', archivo: 'legendario_' + m.tipo, legendario: true, sinHeroe: true }; }
    const T = D.monstruos.tipos[m.tipo] || D.monstruos.tipos.orco, rango = rangoDe(m.nivel); return { ...T, ...m, rango, nombre: T.nombres[rango - 1], archivo: m.tipo + '_' + rango };
  };
  const objetivo = (e, id) => e.militar.monstruos.find(x => x.id === id) || e.militar.ciudades.find(x => x.id === id) || null;
  // 0.8: las conquistadas de la 0.7 tienen id «v…»; los monstruos tienen «tipo» y las ciudades no
  const esCiudad = o => !!o && typeof o.id === 'string' && o.nombre != null && o.saqueos != null && o.tipo === undefined;

  // ---------- Academia (árbol de habilidades por ramas) ----------
  const hab = id => HABS.find(h => h.id === id) || null;
  const nivelHab = (e, id) => (e.militar && e.militar.academia[id]) || 0;
  const costeHab = (h, k) => Object.fromEntries(Object.entries(h.coste).map(([r, v]) => [r, D.curva.redondo(v * Math.pow(D.academia.crece, k - 1))]));
  // 0.7: las habilidades de la Universidad piden nivel de Universidad (h.universidad + 3·(k−1)) y la de la Academia que mejoran (h.academia = [id, nivel])
  const edificioHab = h => h.edificio || 'academia';
  const academiaHab = (h, k) => edificioHab(h) === 'universidad' ? h.universidad + D.universidad.universidadPorNivel * (k - 1) : h.academia + D.academia.academiaPorNivel * (k - 1);
  const tieneHab = (e, id) => nivelHab(e, id) >= 1;
  const habilidadesDe = edif => HABS.filter(h => edificioHab(h) === edif);
  function puedeAprender(e, id) {
    const h = hab(id); if (!h) return NO('Desconocida');
    const n = nivelHab(e, id); if (n >= h.niveles) return NO('Nivel máximo');
    const ed = edificioHab(h), De = D.edificios[ed], a = edificio(e, ed); if (!a) return NO('Construye una ' + De.nombre.toLowerCase());
    if (ed === 'universidad' && Array.isArray(h.academia) && nivelHab(e, h.academia[0]) < h.academia[1]) return NO('Antes: ' + hab(h.academia[0]).nombre + ' nivel ' + h.academia[1] + ' en la ' + D.edificios.academia.nombre.toLowerCase());
    if (h.requiere && !tieneHab(e, h.requiere)) return NO('Antes: ' + hab(h.requiere).nombre);
    const req = academiaHab(h, n + 1); if (a.nivel < req) return NO('Requiere ' + De.nombre.toLowerCase() + ' nivel ' + req);
    const c = costeHab(h, n + 1); if (!alcanza(e, c)) return NO('Faltan ' + faltan(e, c).join(', '));
    return SI({ coste: c, nivel: n + 1 });
  }
  function aprender(e, id) {
    const p = puedeAprender(e, id); if (!p.ok) return p;
    pagar(e, p.coste); const m = e.militar; m.academia[id] = p.nivel; if (!m.investigado.includes(id)) m.investigado.push(id);
    return SI({ nivel: p.nivel });
  }
  // suma de efecto[clave] × nivel (opcionalmente solo las que cumplan filtro)
  const bonoHab = (e, clave, filtro) => e.militar ? HABS.reduce((s, h) => s + ((h.efecto[clave] != null && (!filtro || filtro(h))) ? h.efecto[clave] * nivelHab(e, h.id) : 0), 0) : 0;
  const bonoClase = (e, clase) => bonoHab(e, 'fuerzaClase', h => h.efecto.clase === clase);
  const bonoProduccion = (e, recurso) => bonoHab(e, 'pct', h => h.efecto.produce === recurso || h.efecto.tambien === recurso);
  // compatibilidad 0.3/0.4: «investigar» = aprender el siguiente nivel
  const investigacion = hab, puedeInvestigar = puedeAprender, investigar = aprender;

  // ---------- Tropas ----------
  function puedeEntrenar(e, tipo, n = 1) {
    const t = D.tropas[tipo]; if (!t) return NO('Tropa desconocida');
    const cu = edificio(e, 'cuartel'); if (!cu) return NO('Construye un ' + D.edificios.cuartel.nombre.toLowerCase());
    if (t.avanzada) {
      if (!tieneHab(e, t.avanzada)) return NO('Apréndelo antes en la ' + D.edificios.academia.nombre.toLowerCase() + ' (' + hab(t.avanzada).nombre + ')');
      if (cu.nivel < D.cuartelAvanzadas) return NO('Requiere ' + D.edificios.cuartel.nombre.toLowerCase() + ' nivel ' + D.cuartelAvanzadas);
    }
    if (t.cuartel && cu.nivel < t.cuartel) return NO('Requiere ' + D.edificios.cuartel.nombre.toLowerCase() + ' nivel ' + t.cuartel);   // 0.7: tropas de 2 y 3 estrellas
    if (!(Number.isInteger(n) && n >= 1)) return NO('Cantidad no válida');
    const coste = por(t.coste, n); if (!alcanza(e, coste)) return NO('Faltan ' + faltan(e, coste).join(', '));
    const libre = tropaDisponible(e); if (n > libre) return NO(libre ? 'Solo hay ' + libre + ' plaza' + (libre > 1 ? 's' : '') + ' de tropa disponible: amplía el Campamento' : 'No queda tropa disponible: construye o mejora tiendas de campaña en el Campamento (o despide tropas)');   // 0.9
    return SI({ coste });
  }
  // 0.5 · «Máx»: cuántas se pueden pagar ahora (0 si no se puede entrenar)
  function maxEntrenar(e, tipo) {
    const p = puedeEntrenar(e, tipo, 1); if (!p.ok) return 0;
    return Math.max(0, Math.min(tropaDisponible(e), ...Object.entries(D.tropas[tipo].coste).filter(([, v]) => v).map(([k, v]) => Math.floor((e.recursos[k] + 1e-9) / v))));   // 0.9: y sin pasar de la tropa disponible
  }
  function entrenar(e, tipo, n = 1) { const p = puedeEntrenar(e, tipo, n); if (!p.ok) return p; pagar(e, p.coste); e.militar.tropas[tipo] += n; e.militar.entrenadas += n; return SI({ n }); }
  const fuera = e => { const r = cero(TIPOS_TROPA); for (const x of e.militar.expediciones.concat(e.militar.marchas || [])) for (const [t, n] of Object.entries(x.tropas || {})) if (r[t] != null) r[t] += n; return r; };

  // ---------- 0.8 · Obreros (Escuela de maestría): solo farmean; sin poder ni manutención; solo cuestan crearlos ----------
  const nivelEscuela = e => { const b = edificio(e, 'escuela_maestria'); return b ? b.nivel : 0; };
  function puedeFormar(e, tipo, n = 1) {
    const t = D.obreros[tipo]; if (!t) return NO('Obrero desconocido');
    const es = edificio(e, 'escuela_maestria'); if (!es) return NO('Construye una ' + D.edificios.escuela_maestria.nombre.toLowerCase() + ' (ayuntamiento nivel ' + D.edificios.escuela_maestria.requiere + ')');
    if (es.nivel < t.escuela) return NO('Requiere ' + D.edificios.escuela_maestria.nombre.toLowerCase() + ' nivel ' + t.escuela);
    if (!(Number.isInteger(n) && n >= 1)) return NO('Cantidad no válida');
    const coste = por(t.coste, n); if (!alcanza(e, coste)) return NO('Faltan ' + faltan(e, coste).join(', '));
    const libre = obrerosDisponibles(e); if (n > libre) return NO(libre ? 'Solo caben ' + libre + ' obrero' + (libre > 1 ? 's' : '') + ' más: amplía las cabañas del Campamento' : 'No caben más obreros: construye o mejora cabañas de obreros en el Campamento');   // 0.9
    return SI({ coste });
  }
  function maxFormar(e, tipo) {
    const p = puedeFormar(e, tipo, 1); if (!p.ok) return 0;
    return Math.max(0, Math.min(obrerosDisponibles(e), ...Object.entries(D.obreros[tipo].coste).filter(([, v]) => v).map(([k, v]) => Math.floor((e.recursos[k] + 1e-9) / v))));
  }
  function formar(e, tipo, n = 1) { const p = puedeFormar(e, tipo, n); if (!p.ok) return p; pagar(e, p.coste); e.militar.obreros[tipo] += n; e.militar.obrerosFormados += n; return SI({ n }); }
  const obrerosFuera = e => { const r = cero(OBREROS); for (const x of e.militar.expediciones) for (const [t, n] of Object.entries(x.obreros || {})) if (r[t] != null) r[t] += n; return r; };
  const totalObreros = e => OBREROS.reduce((s, t) => s + (e.militar.obreros[t] || 0), 0);
  const totalObrerosConFuera = e => { const f = obrerosFuera(e); return OBREROS.reduce((s, t) => s + (e.militar.obreros[t] || 0) + f[t], 0); };
  // 0.6: en Clásica el mantenimiento también va ÷3 (como la producción)
  const mantTropas = e => { const f = fuera(e); return TIPOS_TROPA.reduce((s, t) => s + (e.militar.tropas[t] + f[t]) * D.tropas[t].mant, 0) * fMant(e); };
  const totalTropas = e => TIPOS_TROPA.reduce((s, t) => s + e.militar.tropas[t], 0);
  const totalTropasConFuera = e => { const f = fuera(e); return TIPOS_TROPA.reduce((s, t) => s + e.militar.tropas[t] + f[t], 0); };

  // ---------- 0.9 · Campamento (esquina inferior derecha de la ciudad, con su propio mapa) ----------
  // Su nivel (máx. el del ayuntamiento) abre huecos (D.campamento.huecos) y marca el nivel máximo de lo de dentro.
  // Tiendas de campaña → plazas de tropa («tropa disponible»); cabañas de obreros → máximo de obreros. 0.10: 25 a nv1 y ×1,15 por nivel, acumulado (provisional).
  // Nunca se quitan tropas ni obreros por pasarse (partidas antiguas, demoler…): solo no se pueden crear más hasta que haya sitio.
  const CA = () => D.campamento;
  function campamentoInicial() { return { nivel: 1, n: 2, edificios: CA().inicio.map((tipo, i) => ({ id: 'k' + (i + 1), tipo, nivel: 1, hueco: i, gastado: {} })) }; }
  const camp = e => { const m = e.militar; if (!m.campamento || !Array.isArray(m.campamento.edificios)) m.campamento = campamentoInicial(); return m.campamento; };
  // 0.10 · plazas exponenciales: el nivel k aporta round(plazasNv1 × crecePlazas^(k−1)); el edificio da la suma de todos sus niveles
  const plazasNivel = (tipo, k) => { const T = CA().tipos[tipo]; return T && k >= 1 ? Math.round(T.plazasNv1 * Math.pow(T.crecePlazas || 1, k - 1)) : 0; };
  const plazasDe = (tipo, nivel) => { let s = 0; for (let k = 1; k <= nivel; k++) s += plazasNivel(tipo, k); return s; };
  const plazasTipo = (e, tipo) => camp(e).edificios.filter(b => b.tipo === tipo).reduce((s, b) => s + plazasDe(b.tipo, b.nivel), 0);
  const plazasTropas = e => plazasTipo(e, 'tienda_campana');
  const maxObreros = e => plazasTipo(e, 'cabana_obreros');
  const tropaDisponible = e => Math.max(0, plazasTropas(e) - totalTropasConFuera(e));
  const obrerosDisponibles = e => Math.max(0, maxObreros(e) - totalObrerosConFuera(e));
  const huecosCampamento = e => CA().huecos[Math.min(CA().max, camp(e).nivel) - 1];
  const edificioCamp = (e, id) => camp(e).edificios.find(b => b.id === id) || null;
  const enHuecoCamp = (e, i) => camp(e).edificios.find(b => b.hueco === i) || null;
  function puedeConstruirCamp(e, tipo, hueco) {
    const T = CA().tipos[tipo]; if (!T) return NO('No se puede construir eso en el campamento');
    if (!(Number.isInteger(hueco) && hueco >= 0 && hueco < huecosCampamento(e))) return NO('Hueco bloqueado: mejora el campamento');
    if (enHuecoCamp(e, hueco)) return NO('Ese hueco ya está ocupado');
    const c = T.coste[0]; if (!alcanza(e, c)) return NO('Faltan ' + faltan(e, c).join(', '));
    return SI({ coste: c });
  }
  function construirCamp(e, tipo, hueco) {
    const p = puedeConstruirCamp(e, tipo, hueco); if (!p.ok) return p; const C = camp(e);
    pagar(e, p.coste); C.n = (C.n || C.edificios.length) + 1; const b = { id: 'k' + C.n, tipo, nivel: 1, hueco, gastado: { ...p.coste } }; C.edificios.push(b); return SI({ edificio: b });
  }
  function puedeMejorarCamp(e, id) {
    const b = edificioCamp(e, id); if (!b) return NO('Ya no está');
    if (b.nivel >= CA().max) return NO('Nivel máximo');
    if (b.nivel >= camp(e).nivel) return NO('El campamento marca el nivel máximo: mejóralo primero');
    const c = CA().tipos[b.tipo].coste[b.nivel]; if (!alcanza(e, c)) return NO('Faltan ' + faltan(e, c).join(', '));
    return SI({ coste: c });
  }
  function mejorarCamp(e, id) { const p = puedeMejorarCamp(e, id); if (!p.ok) return p; const b = edificioCamp(e, id); pagar(e, p.coste); sumar(b.gastado, p.coste); b.nivel++; return SI({ nivel: b.nivel }); }
  // «Máx»: tantos niveles como se puedan pagar ahora (sin pasar del campamento)
  function maxMejoraCamp(e, id) {
    const b = edificioCamp(e, id); if (!b) return { pasos: 0, nivel: 0, coste: {} };
    const rec = { ...e.recursos }, coste = {}; let n = b.nivel;
    while (n < Math.min(CA().max, camp(e).nivel)) { const c = CA().tipos[b.tipo].coste[n]; if (!Object.entries(c).every(([k, v]) => !v || rec[k] + 1e-9 >= v)) break; for (const [k, v] of Object.entries(c)) { rec[k] -= v; coste[k] = (coste[k] || 0) + v; } n++; }
    return { pasos: n - b.nivel, nivel: n, coste };
  }
  function mejorarCampMax(e, id) { const mx = maxMejoraCamp(e, id); if (mx.pasos < 1) return puedeMejorarCamp(e, id); for (let i = 0; i < mx.pasos; i++) mejorarCamp(e, id); return SI({ nivel: mx.nivel, niveles: mx.pasos }); }
  function puedeDemolerCamp(e, id) {
    const b = edificioCamp(e, id); if (!b) return NO('Ya no está');
    if (camp(e).edificios.filter(x => x.tipo === b.tipo).length <= 1) return NO('Es la última ' + CA().tipos[b.tipo].nombre.toLowerCase() + ': no se puede demoler');
    return SI({ devuelto: Object.fromEntries(Object.entries(b.gastado || {}).map(([k, v]) => [k, Math.floor(v * CA().devolucion)]).filter(([, v]) => v > 0)) });
  }
  function demolerCamp(e, id) { const p = puedeDemolerCamp(e, id); if (!p.ok) return p; const C = camp(e); C.edificios = C.edificios.filter(b => b.id !== id); sumar(e.recursos, p.devuelto); return SI({ devuelto: p.devuelto }); }
  function puedeMejorarCampamento(e) {
    const n = camp(e).nivel; if (n >= CA().max) return NO('Nivel máximo');
    if (n >= J.nivelCiudad(e)) return NO('El ayuntamiento marca el nivel máximo: mejóralo primero');
    const c = CA().coste[n]; if (!alcanza(e, c)) return NO('Faltan ' + faltan(e, c).join(', '));
    return SI({ coste: c });
  }
  function mejorarCampamento(e) { const p = puedeMejorarCampamento(e); if (!p.ok) return p; pagar(e, p.coste); camp(e).nivel++; return SI({ nivel: camp(e).nivel, huecos: huecosCampamento(e) }); }
  // Despedir tropas (de las que están en la ciudad) para liberar plazas. No devuelve nada (provisional).
  function puedeDespedirTropas(e, tipo, n = 1) {
    if (!D.tropas[tipo]) return NO('Tropa desconocida');
    if (!(Number.isInteger(n) && n >= 1)) return NO('Cantidad no válida');
    if ((e.militar.tropas[tipo] || 0) < n) return NO('Solo puedes despedir las que están en la ciudad (' + (e.militar.tropas[tipo] || 0) + ')');
    return SI();
  }
  function despedirTropas(e, tipo, n = 1) {
    const p = puedeDespedirTropas(e, tipo, n); if (!p.ok) return p; const m = e.militar;
    m.tropas[tipo] -= n; m.despedidas = (m.despedidas || 0) + n; informe(e, 'despido', { tropa: tipo, cantidad: n, disponible: tropaDisponible(e) });   // («cantidad», no «n»: n es el número del informe)
    return SI({ n, disponible: tropaDisponible(e) });
  }

  // ---------- 0.9 · Mapa: desde el nivel 30 del jugador se ocultan los monstruos de nivel menor que 30 ----------
  // «Nivel del jugador» = nivel del ayuntamiento (es el nivel de la ciudad: marca el máximo de todo y los requisitos de guerra, conquista, muralla…).
  const nivelJugador = e => J.nivelCiudad(e);
  const monstruoOculto = (e, mo) => { const O = D.ocultarMonstruos; return !!O && !mo.legendario && nivelJugador(e) >= O.desdeNivelJugador && mo.nivel < O.menoresDe && !(e.militar.marchas || []).some(x => x.objetivo === mo.id); };

  // ---------- Héroes ----------
  const tipoHeroe = h => D.heroes.tipos[h.tipo];
  const mantHeroe = (h, e) => (D.heroes.mant.base + D.heroes.mant.porNivel * h.nivel) * fMant(e);
  const poderBase = h => { const P = tipoHeroe(h).poder || D.heroes.poder; return P.base + P.porNivel * (h.nivel - 1); };
  const poderHeroe = h => poderBase(h);
  const estadoHeroe = h => h.marcha ? 'fuera' : h.heridoMs > 0 ? 'herido' : h.inactivo ? 'inactivo' : 'listo';
  const heroe = (e, id) => e.militar.heroes.find(h => h.id === id) || null;
  function nuevoHeroe(e, tipo, r) {
    const T = D.heroes.tipos[tipo], usados = new Set(e.militar.heroes.map(h => h.nombre));
    const libres = T.nombres.filter(n => !usados.has(n));
    let nombre = libres.length ? libres[Math.floor(r() * libres.length)] : null;
    if (!nombre) { const romano = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']; const base = T.nombres[Math.floor(r() * T.nombres.length)]; nombre = base + ' ' + (romano.find(x => !usados.has(base + ' ' + x)) || e.militar.heroes.length); }
    return { id: 'h' + e.militar.azarN + '_' + Math.floor(r() * 1e6), tipo, nombre, nivel: 1, xp: 0, heridoMs: 0, inactivo: false, inactivoMs: 0, gastado: {}, fragGastados: 0 };
  }
  function elegirHeroeInicial(e, tipo) {
    if (!e.militar.heroeInicialPendiente) return NO('El héroe inicial ya está elegido');
    if (!TIPOS_HEROE.includes(tipo)) return NO('Tipo desconocido');
    const h = nuevoHeroe(e, tipo, azar(e)); e.militar.heroes.push(h); e.militar.heroeInicialPendiente = false; return SI({ heroe: h });
  }
  const costeCriar = e => { const f = 1 + D.heroes.criar.factor * e.militar.heroes.length; return { comida: Math.round(D.heroes.criar.comida * f), oro: Math.round(D.heroes.criar.oro * f) }; };
  function puedeCriar(e) {
    if (!edificio(e, 'salon_heroes')) return NO('Construye un ' + D.edificios.salon_heroes.nombre.toLowerCase());
    const c = costeCriar(e); if (!alcanza(e, c)) return NO('Faltan ' + faltan(e, c).join(', '));
    return SI({ coste: c });
  }
  function criarHeroe(e) {   // el tipo sale al azar EN ESTE MOMENTO (entre los 5 clásicos)
    const p = puedeCriar(e); if (!p.ok) return p;
    pagar(e, p.coste); const r = azar(e), tipo = TIPOS_HEROE[Math.floor(r() * TIPOS_HEROE.length)];
    const h = nuevoHeroe(e, tipo, r); h.gastado = { ...p.coste }; e.militar.heroes.push(h); return SI({ heroe: h });
  }
  // 0.5 · Convocar: 10 fragmentos de una familia → su héroe (con sus propias habilidades)
  function puedeConvocar(e, familia) {
    if (!D.heroes.tipos[familia] || !D.heroes.tipos[familia].familia) return NO('Familia desconocida');
    if (!edificio(e, 'salon_heroes')) return NO('Construye un ' + D.edificios.salon_heroes.nombre.toLowerCase());
    const n = e.militar.fragFamilia[familia] || 0; if (n < D.convocar.fragmentos) return NO('Faltan fragmentos (' + n + ' / ' + D.convocar.fragmentos + ')');
    return SI();
  }
  function convocar(e, familia) {
    const p = puedeConvocar(e, familia); if (!p.ok) return p;
    const m = e.militar; m.fragFamilia[familia] -= D.convocar.fragmentos;
    const h = nuevoHeroe(e, familia, azar(e)); h.fragGastados = D.convocar.fragmentos; h.fragFamilia = familia; m.heroes.push(h); m.convocados++;
    h.nivel = Math.min(D.heroes.nivelMax, edificio(e, 'salon_heroes').nivel);   // 0.6: empieza con el nivel del Salón de héroes
    return SI({ heroe: h });
  }
  const nivelMaxHeroe = () => D.heroes.nivelMax;   // 0.5: el Salón ya no limita el nivel
  function requisitosSubir(h) { const n = h.nivel; return { xp: D.heroes.xp[n - 1], fragmentos: D.heroes.fragmentos[n - 1] || 0, coste: {} }; }
  // fragmentos que puede gastar un héroe: comunes (todos) + los de su familia (convocados)
  const famFrag = h => tipoHeroe(h).familia || tipoHeroe(h).fragFam || null;   // 0.8: los capturados de una familia con héroe gastan también los de su familia
  const fragmentosPara = (e, h) => e.militar.fragmentos + (famFrag(h) ? (e.militar.fragFamilia[famFrag(h)] || 0) : 0);
  // 0.5 · Sube SOLO con la experiencia; desde el nivel 20 también gasta fragmentos (primero los de su familia, luego comunes)
  function subirAuto(e, h) {
    const m = e.militar; let sub = 0; h.faltanFragmentos = 0;
    while (h.nivel < D.heroes.nivelMax) {
      const q = requisitosSubir(h); if (h.xp < q.xp) break;
      if (q.fragmentos) {
        if (fragmentosPara(e, h) < q.fragmentos) { h.faltanFragmentos = q.fragmentos; break; }
        let f = q.fragmentos; const fam = famFrag(h);
        if (fam) { const k = Math.min(f, m.fragFamilia[fam] || 0); m.fragFamilia[fam] -= k; f -= k; }
        m.fragmentos -= f; h.fragGastados += q.fragmentos;
      }
      h.xp -= q.xp; h.nivel++; sub++;
    }
    return sub;
  }
  const subirTodos = e => e.militar.heroes.reduce((s, h) => s + subirAuto(e, h), 0);
  // compatibilidad: ya no hay botón «Subir nivel»
  function puedeSubir(e, id) { const h = heroe(e, id); if (!h) return NO('No existe'); return NO('Los héroes suben solos al ganar experiencia'); }
  const subirNivel = puedeSubir;
  function devolucionDespedir(h) {
    const r = {}; for (const [k, v] of Object.entries(h.gastado)) if (v) r[k] = Math.floor(v * D.heroes.despedir.recursos);
    return { recursos: r, fragmentos: Math.floor(h.fragGastados * D.heroes.despedir.fragmentos), familia: h.fragFamilia || null };
  }
  function despedir(e, id) {
    const h = heroe(e, id); if (!h) return NO('No existe');
    const dev = devolucionDespedir(h); sumar(e.recursos, dev.recursos);
    if (dev.familia) e.militar.fragFamilia[dev.familia] += dev.fragmentos; else e.militar.fragmentos += dev.fragmentos;
    e.militar.heroes = e.militar.heroes.filter(x => x !== h);
    if (e.militar.crisis) actualizarCrisis(e);
    return SI(dev);
  }
  // Habilidades activas de un héroe (desbloqueadas y mejoradas con su nivel)
  function habilidades(h) {
    return tipoHeroe(h).habilidades.map(a => ({ ...a, activa: h.nivel >= a.nivel, valor: h.nivel >= a.nivel ? Math.round((((a.fuerza ?? a.todas ?? a.bajas ?? a.botin ?? a.heridas ?? a.variedad ?? a.poder ?? a.pociones) || 0) + a.porNivel * (h.nivel - a.nivel)) * 1000) / 1000 : 0 }));
  }
  function modificadores(heroes) {
    const m = { clase: { infanteria: 0, arqueros: 0, caballeria: 0 }, todas: 0, bajas: 0, botin: 0, heridas: 0, variedad: 0, poder: 0, pociones: 0 };
    for (const h of heroes) for (const a of habilidades(h)) if (a.activa) {
      if (a.clase) m.clase[a.clase] += a.valor; else if (a.todas != null) m.todas += a.valor; else if (a.bajas != null) m.bajas += a.valor;
      else if (a.botin != null) m.botin += a.valor; else if (a.heridas != null) m.heridas += a.valor; else if (a.variedad != null) m.variedad += a.valor;
      else if (a.poder != null) m.poder += a.valor; else if (a.pociones != null) m.pociones += a.valor;
    }
    return m;
  }

  // ---------- Fuerza del ejército (piedra-papel-tijera, variedad, héroes, Academia) ----------
  const rps = (clase, enemigo) => !enemigo ? 1 : D.vence[clase] === enemigo ? D.ventaja : D.vence[enemigo] === clase ? D.desventaja : 1;
  const bonoInvestigado = (e, k) => k === 'fuerza' ? bonoHab(e, 'fuerza') : k === 'heridas' ? bonoHab(e, 'heridas') : k === 'bajas' ? bonoHab(e, 'bajas') : bonoHab(e, k);
  function fuerzaEjercito(e, sel, claseEnemiga) {
    const tropas = sel.tropas || {}, hs = (sel.heroes || []).map(id => heroe(e, id)).filter(Boolean);
    const mods = modificadores(hs), tact = bonoHab(e, 'fuerza'), base = { infanteria: 0, arqueros: 0, caballeria: 0 };
    mods.bajas += bonoHab(e, 'bajas');
    for (const [t, n] of Object.entries(tropas)) if (n > 0) base[D.tropas[t].clase] += n * D.tropas[t].fuerza;
    const B = Object.values(base).reduce((a, b) => a + b, 0);
    const clases = Object.keys(base).filter(c => B > 0 && base[c] / B >= D.variedad.minimo).length;
    const variedad = 1 + D.variedad.porClase * Math.max(0, clases - 1) * (1 + mods.variedad);
    let tropasF = 0; const porClase = {};
    for (const c of Object.keys(base)) { porClase[c] = base[c] * (1 + mods.clase[c] + mods.todas + tact + bonoClase(e, c)) * rps(c, claseEnemiga); tropasF += porClase[c]; }
    const pocion = 1 + efecto(e, 'fuerza');   // 0.6: poción de fuerza
    tropasF *= variedad * pocion;
    const poder = hs.reduce((s, h) => s + poderHeroe(h), 0) * (1 + mods.poder + bonoHab(e, 'poderHeroes')) * pocion;
    return { total: tropasF + poder, tropas: tropasF, poder, variedad, clases, mods, porClase, base };
  }
  function validarSeleccion(e, sel) {
    const tropas = {}, heroes = [];
    for (const [t, n] of Object.entries(sel.tropas || {})) { if (!D.tropas[t]) return NO('Tropa desconocida'); const k = Math.floor(n); if (k < 0 || k > e.militar.tropas[t]) return NO('No tienes tantas tropas'); if (k > 0) tropas[t] = k; }
    for (const id of sel.heroes || []) { const h = heroe(e, id); if (!h) return NO('Héroe desconocido'); if (estadoHeroe(h) !== 'listo') return NO(h.nombre + ' no puede combatir (' + estadoHeroe(h) + ')'); heroes.push(id); }
    if (!Object.keys(tropas).length && !heroes.length) return NO('Elige al menos una tropa o un héroe');
    return SI({ sel: { tropas, heroes } });
  }

  // ---------- Combate automático (monstruos y ciudades enemigas) ----------
  // 0.6 · En Clásica el ejército MARCHA: tarda según la distancia (máx. 30 min a la otra punta), lucha al llegar y vuelve con el botín.
  //       En Rápida el combate es instantáneo (como en la 0.5).
  const efecto = (e, k) => { const x = e.militar && e.militar.efectos && e.militar.efectos[k]; return x && x.ms > 0 ? x.pct : 0; };
  function minutosMarcha(e, x, y) {
    const max = modo(e).marchaMaxMin || 0; if (!max) return 0;
    const w = mundo(e), d = W().distCapital(w, x, y);
    return Math.round(max * Math.min(1, d / W().distMax(w)) * (1 - efecto(e, 'velocidad')) * (1 - bonoVelocidad(e)) * 10) / 10;
  }
  // 0.7: habilidad de velocidad de movimiento (Academia «Marchas rápidas» + Universidad «Marcha forzada»), con tope
  const bonoVelocidad = e => Math.min((D.universidad && D.universidad.velocidadMax) || 0.6, bonoHab(e, 'velocidad'));
  // 0.7 (bug de conquista): el requisito es el nivel de TU ayuntamiento; la ciudad puede ser de cualquier nivel (y aunque se esté recuperando de un saqueo)
  const esConquistable = (e, c) => esCiudad(c) && !c.conquistada && J.nivelCiudad(e) >= D.conquista.desdeAyto;
  function puedeConquistar(e, objetivoId, seleccion) {
    const c = objetivo(e, objetivoId); if (!esCiudad(c)) return NO('Solo se pueden conquistar ciudades');
    if (c.conquistada) return NO(c.nombre + ' ya es tuya');
    if (J.nivelCiudad(e) < D.conquista.desdeAyto) return NO('Requiere tu ayuntamiento nivel ' + D.conquista.desdeAyto + ' (ahora ' + J.nivelCiudad(e) + ')');
    const v = validarSeleccion(e, seleccion); if (!v.ok) return v;
    const F = fuerzaEjercito(e, v.sel, null).total, hace = Math.ceil(c.fuerza * D.conquista.ventaja);
    if (F < hace) return NO('Para conquistar necesitas un poder al menos un ' + Math.round((D.conquista.ventaja - 1) * 100) + ' % mayor: ' + Math.round(F) + ' / ' + hace);
    return SI({ sel: v.sel, fuerza: F, necesaria: hace });
  }
  function atacar(e, objetivoId, seleccion, opts = {}) {
    const m = e.militar, obj = objetivo(e, objetivoId); if (!obj) return NO('Ya no está');
    const ciudad = esCiudad(obj);
    if (ciudad && obj.conquistada) return NO(obj.nombre + ' ya es tuya');
    if (ciudad && obj.recuperaMs > 0 && !opts.conquistar) return NO(obj.nombre + ' aún se recupera del saqueo');
    if (m.marchas.some(x => x.objetivo === objetivoId)) return NO('Ya hay un ejército en camino');
    if (ciudad && m.asedioMs > 0) return NO('Espera ' + Math.ceil(m.asedioMs / MS_MIN) + ' min para otro asedio (o usa una poción de enfriamiento)');   // 0.8
    let v = validarSeleccion(e, seleccion); if (!v.ok) return v;
    if (opts.conquistar) { v = puedeConquistar(e, objetivoId, seleccion); if (!v.ok) return v; }
    const sel = v.sel, min = minutosMarcha(e, obj.x, obj.y);
    if (ciudad) m.asedioMs = Math.round(D.asedio.esperaMin * MS_MIN);   // 0.8: espera mínima entre asedios del jugador
    if (min > 0) {   // Clásica: sale una marcha
      for (const [t, n] of Object.entries(sel.tropas)) m.tropas[t] -= n;
      for (const id of sel.heroes) heroe(e, id).marcha = objetivoId;
      const x = { id: 'a' + (m.azarN + 1) + '_' + m.marchas.length + '_' + Math.round(e.jugadoMs), objetivo: objetivoId, nombre: ciudad ? obj.nombre : datosMonstruo(obj).nombre, nivel: obj.nivel,
        x: obj.x, y: obj.y, tropas: { ...sel.tropas }, heroes: sel.heroes.slice(), conquistar: !!opts.conquistar, idaMs: Math.round(min * MS_MIN), restanteMs: Math.round(min * MS_MIN), totalMs: Math.round(min * 2 * MS_MIN), fase: 'ida', botin: null };
      m.azarN++; m.marchas.push(x);
      return SI({ marcha: x });
    }
    const res = resolverCombate(e, obj, sel, m.tropas, true, !!opts.conquistar);
    return SI({ resultado: res });
  }
  // 0.8 · Habilidades de los LEGENDARIOS (6 turnos teóricos; PROVISIONAL), del monstruo enemigo y de los legendarios capturados que van como héroes.
  //   Fénix: renace una vez con el 50 % → su bando × 1,5 · Kraken: inmoviliza 2 turnos la escuadra (clase) más fuerte del rival → esa clase pierde 2/6
  //   Hidra: muerde 3 escuadras y las envenena → el rival × 0,85 y +15 % de bajas · Titán: el rival actúa el último 2 turnos (× (1 − 2/6 · 0,5)) y escudo del 20 % (su bando ÷ 0,8)
  function efectosLegendarios(e, sel, obj, f, ciudad) {
    const L = D.legendarios, T = L.turnos, out = { kJ: 1, kE: 1, extraJ: 0, bajas: 0, textos: [] };
    if (obj && obj.legendario && L.tipos[obj.tipo]) {
      const x = L.tipos[obj.tipo].efecto, nom = L.tipos[obj.tipo].nombre;
      if (x.renace) { out.kE *= 1 + x.renace; out.textos.push(nom + ' renace con el ' + Math.round(x.renace * 100) + ' % de su vida'); }
      if (x.inmoviliza) { const vals = Object.entries(f.porClase || {}), tot = vals.reduce((a, [, v]) => a + v, 0);
        if (tot > 0 && f.total > 0) { const [cl, v] = vals.sort((a, b) => b[1] - a[1])[0], perdido = f.tropas * (v / tot) * x.inmoviliza / T; out.kJ *= Math.max(0.05, (f.total - perdido) / f.total);
          out.textos.push(nom + ' inmoviliza ' + x.inmoviliza + ' turnos a tu ' + D.clases[cl].toLowerCase()); } }
      if (x.veneno) { out.kJ *= 1 - x.veneno; out.bajas += x.bajas || 0; out.textos.push(nom + ' muerde a 3 escuadras y las envenena'); }
      if (x.ultimos) { out.kJ *= 1 - x.ultimos / T * 0.5; out.kE /= 1 - (x.escudo || 0); out.textos.push('Actúas el último ' + x.ultimos + ' turnos y ' + nom + ' tiene un escudo del ' + Math.round((x.escudo || 0) * 100) + ' %'); }
    }
    for (const id of (sel && sel.heroes) || []) {
      const h = heroe(e, id), TH = h && tipoHeroe(h); if (!TH || !TH.legendario || !L.tipos[TH.monstruo]) continue;
      const x = L.tipos[TH.monstruo].efecto;
      if (x.renace) { out.extraJ += poderHeroe(h) * x.renace; out.textos.push(h.nombre + ' renace con el ' + Math.round(x.renace * 100) + ' % de su vida'); }
      if (x.inmoviliza) { out.kE *= 1 - (ciudad ? 1 / 3 : 1) * x.inmoviliza / T; out.textos.push(h.nombre + ' inmoviliza ' + x.inmoviliza + ' turnos a la escuadra enemiga más fuerte'); }
      if (x.veneno) { out.kE *= 1 - x.veneno; out.textos.push(h.nombre + ' muerde a 3 escuadras enemigas y las envenena'); }
      if (x.ultimos) { out.kE *= 1 - x.ultimos / T * 0.5; out.bajas -= x.escudo || 0; out.textos.push('El enemigo actúa el último ' + x.ultimos + ' turnos; escudo del ' + Math.round((x.escudo || 0) * 100) + ' % para los tuyos'); }
    }
    return out;
  }
  // Resuelve un combate. pool = de dónde salen las bajas (las tropas de la ciudad o las de una marcha). entregar = sumar el botín de recursos ya.
  function resolverCombate(e, obj, sel, pool, entregar, conquistar, marchaId = null) {
    const m = e.militar, ciudad = esCiudad(obj);
    const info = ciudad ? { clase: null, nombre: obj.nombre } : datosMonstruo(obj), C = D.combate, r = azar(e);
    const f = fuerzaEjercito(e, sel, info.clase), LG = efectosLegendarios(e, sel, obj, f, ciudad);
    const factor = C.azar[0] + r() * (C.azar[1] - C.azar[0]), F = (f.total * LG.kJ + LG.extraJ) * factor, M = Math.round(obj.fuerza * LG.kE);
    const gana = F >= M, q = M / Math.max(F, 1e-9);
    const perdida = gana ? C.bajasVictoria * q * q : Math.min(1, C.bajasDerrota[0] + (C.bajasDerrota[1] - C.bajasDerrota[0]) * Math.min(1, q - 1));
    const bajas = {}, fracciones = {};
    for (const [t, n] of Object.entries(sel.tropas)) {
      const k = rps(D.tropas[t].clase, info.clase), adj = k > 1 ? D.bajasVentaja : k < 1 ? D.bajasDesventaja : 1;
      const fr = Math.max(0, Math.min(1, perdida * adj * (1 + f.mods.bajas + LG.bajas))), muertos = Math.min(n, Math.round(n * fr));
      fracciones[t] = fr;
      if (muertos) { bajas[t] = muertos; pool[t] -= muertos; }
    }
    const factorHerida = Math.max(0.1, 1 + f.mods.heridas + bonoHab(e, 'heridas')), heridos = [], xp = Math.round(M * (gana ? C.xpVictoria : C.xpDerrota) * (1 + bonoHab(e, 'xp')));
    const subidas = [];
    for (const id of sel.heroes) {
      const h = heroe(e, id); if (!h) continue; h.xp += xp;
      const herido = gana ? r() < C.heridaVictoriaProb : true;
      // 0.6: herido = 2,5 min por nivel del héroe (nv10 = 25 min)
      if (herido) { h.heridoMs = Math.round((C.heridaMinPorNivel || 2.5) * Math.min(h.nivel, 30) * MS_MIN * factorHerida); heridos.push({ id, nombre: h.nombre, minutos: Math.round(h.heridoMs / MS_MIN * 10) / 10 }); }
    }
    let botin = null, conquistada = false;
    const yaGuerra = !!obj.guerra;
    if (ciudad && J.nivelCiudad(e) >= D.guerra.desdeAyto) obj.guerra = true;   // 0.6: si la atacas (desde ayto nv20), entra en guerra contigo
    if (gana) {
      botin = { recursos: {}, fragmentos: 0, familia: null, rango: null, comunes: 0, pociones: {}, objetos: {} };
      const tabla = ciudad ? D.ciudades.botin : D.monstruos.botin;
      for (const [k, x] of Object.entries(tabla)) { const v2 = Math.round(M * x * (1 + f.mods.botin)); if (v2) { botin.recursos[k] = v2; if (entregar) e.recursos[k] += v2; } }
      if (ciudad) {
        const FC = D.ciudades.fragmentoComun; if (r() < FC.base + FC.porNivel * obj.nivel) { botin.comunes = 1; m.fragmentos += 1; }
        for (const [o, pr] of Object.entries(D.ciudades.cofres)) if (r() < pr) { botin.objetos[o] = 1; m.objetos[o] += 1; }
        obj.saqueos++; m.saqueos++;
        if (conquistar) { obj.conquistada = true; obj.guerra = false; delete obj.ataqueMs; obj.recuperaMs = 0; m.conquistas++; conquistada = true; }
        else obj.recuperaMs = D.ciudades.recuperaMin * MS_MIN;
      } else {
        const FR = D.monstruos.fragmento;
        if (r() < Math.min(FR.max || 1, FR.base + FR.porNivel * obj.nivel)) {
          if (obj.legendario || (D.monstruos.tipos[obj.tipo] && D.monstruos.tipos[obj.tipo].sinHeroe)) { botin.comunes = 1; m.fragmentos += 1; }   // 0.6: familias sin héroe (y 0.8: legendarios) → fragmento común
          else { botin.fragmentos = 1; botin.familia = obj.tipo; botin.rango = rangoDe(obj.nivel); m.fragFamilia[obj.tipo] += 1; }
        }
        for (const p of Object.keys(D.monstruos.pocion)) if (r() < D.monstruos.pocion[p]) { botin.pociones[p] = 1; m.pociones[p] += 1; }
        m.victorias++; m.porFamilia[obj.tipo] = (m.porFamilia[obj.tipo] || 0) + 1;
        // el monstruo derrotado se reemplaza por otro en otro sitio (otro tipo y nivel; los «cercanos» vuelven cerca de la ciudad)
        const i = m.monstruos.indexOf(obj); m.monstruos.splice(i, 1);
        const nuevo = reponerMonstruo(e, r, obj); if (nuevo) m.monstruos.splice(i, 0, nuevo);
      }
    } else m.derrotas++;
    for (const id of sel.heroes) { const h = heroe(e, id); if (!h) continue; const antes = h.nivel; if (subirAuto(e, h)) subidas.push({ id, nombre: h.nombre, de: antes, a: h.nivel }); }
    // 0.8 · captura pendiente: al vencer a un monstruo se elige derrotarlo (no cuesta nada más) o capturarlo (bajas × 2–5)
    let captura = null;
    if (gana && !ciudad) {
      const K = D.captura, kf = K.factor[0] + Math.floor(r() * (K.factor[1] - K.factor[0] + 1));
      captura = { id: 'k' + m.azarN + '_' + Math.round(e.jugadoMs || 0), tipo: obj.tipo, legendario: !!obj.legendario, nivel: obj.nivel, nombre: info.nombre, rango: info.rango, factor: kf,
        enviadas: { ...sel.tropas }, bajas: { ...bajas }, fracciones, marcha: marchaId, t: Math.round(e.jugadoMs || 0) };
      captura.extra = bajasCaptura(captura);
      if (!Array.isArray(m.capturas)) m.capturas = [];
      m.capturas.push(captura); if (m.capturas.length > K.maxPendientes) m.capturas.splice(0, m.capturas.length - K.maxPendientes);
    }
    const heroesDet = sel.heroes.map(id => { const h = heroe(e, id); if (!h) return null; const sub = subidas.find(y => y.id === id), her = heridos.find(y => y.id === id);
      return { nombre: h.nombre, tipo: h.tipo, nivel: h.nivel, xp, herido: her ? her.minutos : 0, subio: sub ? sub.a - sub.de : 0, capturado: !!tipoHeroe(h).capturado }; }).filter(Boolean);
    for (const h of m.heroes) if (!sel.heroes.includes(h.id)) subirAuto(e, h);   // por si han llegado fragmentos
    m.combates++;
    const res = { gana, ciudad, conquistada, monstruo: { id: obj.id, tipo: ciudad ? null : obj.tipo, nombre: info.nombre, nivel: obj.nivel, fuerza: M, fuerzaBase: obj.fuerza, clase: info.clase, legendario: !!obj.legendario, rango: info.rango || null },
      fuerza: Math.round(F), azar: Math.round(factor * 1000) / 1000,
      enviadas: { ...sel.tropas }, bajas, heridos, xp, heroes: sel.heroes.slice(), botin, conHeroe: sel.heroes.length > 0, subidas, heroesDet, efectos: LG.textos, captura };
    m.ultimoCombate = res;
    const inf = informe(e, 'combate', resumenCombate(res, { conquistar: !!conquistar, marcha: !entregar }));   // 0.7
    if (captura && inf) captura.informe = inf.n;
    if (ciudad && obj.guerra && !yaGuerra && !conquistada) informe(e, 'guerra', { nombre: obj.nombre, nivel: obj.nivel });
    return res;
  }
  // ---------- 0.8 · Capturar monstruos ----------
  // Bajas EXTRA de capturar: cada tropa enviada muere con su fracción normal × el factor (2–5) (sobre lo enviado), menos las que ya murieron.
  function bajasCaptura(k) {
    const extra = {};
    for (const [t, n] of Object.entries(k.enviadas || {})) { const tot = Math.min(n, Math.round(n * (k.fracciones[t] || 0) * k.factor)), x = tot - (k.bajas[t] || 0); if (x > 0) extra[t] = x; }
    return extra;
  }
  const capturaPendiente = (e, id) => (e.militar.capturas || []).find(k => k.id === id) || null;
  function puedeCapturar(e, id) {
    const k = capturaPendiente(e, id); if (!k) return NO('Ya no se puede capturar');
    return SI({ captura: k, extra: bajasCaptura(k) });
  }
  function capturar(e, id) {
    const p = puedeCapturar(e, id); if (!p.ok) return p;
    const m = e.militar, k = p.captura, x = k.marcha ? m.marchas.find(y => y.id === k.marcha) : null, pool = x ? x.tropas : m.tropas, muertas = {};
    for (const [t, n] of Object.entries(p.extra)) { const q = Math.min(n, pool[t] || 0); if (q > 0) { pool[t] -= q; muertas[t] = q; } }
    const r = azar(e), tipo = 'cap_' + k.tipo, usados = new Set(m.heroes.map(h => h.nombre));
    let nombre = k.nombre; if (usados.has(nombre)) { const rom = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']; nombre = k.nombre + ' ' + (rom.find(y => !usados.has(k.nombre + ' ' + y)) || m.heroes.length); }
    const h = { id: 'h' + m.azarN + '_' + Math.floor(r() * 1e6), tipo, nombre, nivel: Math.min(D.heroes.nivelMax, k.nivel), xp: 0, heridoMs: 0, inactivo: false, inactivoMs: 0, gastado: {}, fragGastados: 0,
      capturado: true, rango: k.rango, monstruo: k.tipo, legendario: k.legendario || undefined };
    m.heroes.push(h); m.capturados = (m.capturados || 0) + 1;
    m.capturas = m.capturas.filter(y => y !== k);
    const ult = (m.informes || []).find(y => y.n === k.informe); if (ult) { ult.capturado = h.nombre; ult.bajasCaptura = muertas; }
    informe(e, 'captura', { nombre: h.nombre, monstruo: k.nombre, nivel: h.nivel, legendario: !!k.legendario, factor: k.factor, bajas: muertas, enviadas: k.enviadas, bajasNormales: k.bajas });
    return SI({ heroe: h, bajas: muertas, factor: k.factor });
  }
  function derrotar(e, id) {   // descartar la captura: el monstruo queda derrotado (sin coste extra)
    const k = capturaPendiente(e, id); if (!k) return NO('Ya no está pendiente');
    e.militar.capturas = e.militar.capturas.filter(y => y !== k); return SI();
  }
  // Avance de las marchas (Clásica): al llegar luchan; luego vuelven (con el botín) en el mismo tiempo
  function avanzarMarchas(e, ms) {
    const m = e.militar;
    for (const x of m.marchas.slice()) {
      x.restanteMs -= ms;
      if (x.fase === 'ida' && x.restanteMs <= 0) {
        const obj = objetivo(e, x.objetivo), sobra = -x.restanteMs;
        if (!obj || (esCiudad(obj) && ((obj.recuperaMs > 0 && !x.conquistar) || obj.conquistada))) { x.resultado = null; m.avisos.push({ tipo: 'marcha', nombre: x.nombre, motivo: 'ya no estaba' }); informe(e, 'marcha', { nombre: x.nombre, motivo: 'ya no estaba' }); }
        else {
          const sel = { tropas: { ...x.tropas }, heroes: x.heroes.filter(id => heroe(e, id)) };
          for (const t of Object.keys(sel.tropas)) if (!(sel.tropas[t] > 0)) delete sel.tropas[t];
          const res = resolverCombate(e, obj, sel, x.tropas, false, x.conquistar, x.id);
          x.botin = res.botin ? res.botin.recursos : null; x.resultado = res;
          m.avisos.push({ tipo: 'combate', resultado: res });
        }
        x.fase = 'vuelta'; x.restanteMs = x.idaMs - sobra;
      }
      if (x.fase === 'vuelta' && x.restanteMs <= 0) {
        for (const [t, n] of Object.entries(x.tropas)) m.tropas[t] += n;
        for (const id of x.heroes) { const h = heroe(e, id); if (h) delete h.marcha; }
        if (x.botin) sumar(e.recursos, x.botin);
        m.marchas = m.marchas.filter(y => y !== x);
        m.avisos.push({ tipo: 'vuelta', nombre: x.nombre, botin: x.botin });
        informe(e, 'vuelta', { nombre: x.nombre, botin: x.botin, tropas: { ...x.tropas } });
      }
    }
  }
  // 0.7 · «Acelerar» una marcha desde el mapa: una poción de velocidad recorta su % del tiempo que le queda (y de la vuelta, si aún va de ida)
  // 0.8: también las marchas de los obreros que van a farmear (ida y vuelta; mientras trabajan, recorta la vuelta)
  function puedeAcelerarMarcha(e, id, pocion) {
    const m = e.militar, x = (m.marchas || []).find(y => y.id === id), xp = x ? null : m.expediciones.find(y => y.id === id);
    if (!x && !xp) return NO('Ese ejército ya ha llegado');
    if (!(D.acelerarMarcha || []).includes(pocion) || !D.pociones[pocion]) return NO('Solo sirven las pociones de velocidad');
    if (!(m.pociones[pocion] > 0)) return NO('No te quedan: fabrícalas en la ' + D.edificios.botica.nombre.toLowerCase() + ' o cómpralas en la tienda');
    if (xp) { const marcha = xp.fase === 'vuelta' ? xp.faseMs : xp.fase === 'ida' ? xp.faseMs + xp.vueltaMs : xp.vueltaMs; if (!(marcha > 1000)) return NO(xp.idaMs ? 'Ya casi han llegado' : 'En Rápida no hay marcha');
      return SI({ expedicion: xp, pct: D.pociones[pocion].pct }); }
    if (!(x.restanteMs > 1000)) return NO('Ya casi han llegado');
    return SI({ marcha: x, pct: D.pociones[pocion].pct });
  }
  function acelerarMarcha(e, id, pocion) {
    const p = puedeAcelerarMarcha(e, id, pocion); if (!p.ok) return p;
    if (p.expedicion) { const x = p.expedicion, antes = x.restanteMs, k = 1 - p.pct;
      if (x.fase === 'vuelta') x.faseMs = Math.round(x.faseMs * k); else { if (x.fase === 'ida') { x.faseMs = Math.round(x.faseMs * k); x.idaMs = Math.round(x.idaMs * k); } x.vueltaMs = Math.round(x.vueltaMs * k); }
      x.aceleraciones = (x.aceleraciones || 0) + 1; e.militar.pociones[pocion]--; e.militar.marchasAceleradas = (e.militar.marchasAceleradas || 0) + 1; actualizarExpedicion(x);
      return SI({ ahorroMs: antes - x.restanteMs, restanteMs: x.restanteMs }); }
    const x = p.marcha, antes = x.restanteMs;
    x.restanteMs = Math.round(x.restanteMs * (1 - p.pct)); if (x.fase === 'ida') x.idaMs = Math.round(x.idaMs * (1 - p.pct));
    x.aceleraciones = (x.aceleraciones || 0) + 1; e.militar.pociones[pocion]--; e.militar.marchasAceleradas = (e.militar.marchasAceleradas || 0) + 1;
    return SI({ ahorroMs: antes - x.restanteMs, restanteMs: x.restanteMs });
  }
  // progreso (0–1) de una marcha o recogida para dibujar la flecha y las tropas avanzando: dónde va el ejército entre tu ciudad y el destino
  function posicionMarcha(e, x) {
    if (x.objetivo != null) { const ida = Math.max(1, x.idaMs); const f = x.fase === 'ida' ? 1 - x.restanteMs / ida : x.restanteMs / ida; return { fraccion: Math.max(0, Math.min(1, f)), fase: x.fase, restanteMs: Math.max(0, x.restanteMs) }; }
    // recogida (0.8): ida → recogiendo → vuelta
    const R = Math.max(0, x.restanteMs);
    if (x.fase === 'ida') return { fraccion: Math.max(0, Math.min(1, 1 - x.faseMs / Math.max(1, x.idaMs))), fase: 'ida', restanteMs: R };
    if (x.fase === 'trabajando') return { fraccion: 1, fase: 'recogiendo', restanteMs: R };
    return { fraccion: Math.max(0, Math.min(1, x.faseMs / Math.max(1, x.vueltaMs))), fase: 'vuelta', restanteMs: R };
  }
  // Volver antes de tiempo (solo de ida): vuelven en lo mismo que llevan andado
  function retirarMarcha(e, id) {
    const m = e.militar, x = m.marchas.find(y => y.id === id); if (!x) return NO('Ya han vuelto');
    if (x.fase !== 'ida') return NO('Ya vuelven');
    const andado = x.idaMs - x.restanteMs; x.fase = 'vuelta'; x.restanteMs = andado; x.idaMs = andado; x.retirada = true;
    if (x.restanteMs <= 0) avanzarMarchas(e, 0);
    return SI();
  }

  // ---------- 0.6 · Muralla, defensas, guerra, paz y conquista ----------
  const nivelMuralla = e => (e.militar && e.militar.muralla) || 0;
  const costeMuralla = e => nivelMuralla(e) < D.muralla.max ? D.muralla.coste[nivelMuralla(e)] : null;
  function puedeMejorarMuralla(e) {
    if (J.nivelCiudad(e) < D.muralla.requiere) return NO('Requiere ayuntamiento nivel ' + D.muralla.requiere);
    const n = nivelMuralla(e); if (n >= D.muralla.max) return NO('Nivel máximo');
    if (n >= J.nivelCiudad(e)) return NO('El ayuntamiento marca el nivel máximo: mejóralo primero');
    const c = costeMuralla(e); if (!alcanza(e, c)) return NO('Faltan ' + faltan(e, c).join(', '));
    return SI({ coste: c });
  }
  function mejorarMuralla(e) { const p = puedeMejorarMuralla(e); if (!p.ok) return p; pagar(e, p.coste); e.militar.muralla = nivelMuralla(e) + 1; return SI({ nivel: e.militar.muralla }); }
  const bonoMuralla = e => { const n = nivelMuralla(e); return n ? D.murallaBono.base + D.murallaBono.porNivel * n : 0; };
  const totalDefensas = e => DEFENSAS.reduce((s, k) => s + (e.militar.defensas[k] || 0), 0);
  const maxDefensas = e => nivelMuralla(e) * D.defensasPorNivel;
  function puedeConstruirDefensa(e, tipo, n = 1) {
    const d = D.defensas[tipo]; if (!d) return NO('Defensa desconocida');
    const nm = nivelMuralla(e); if (!nm) return NO('Construye antes la muralla (ayuntamiento nivel ' + D.muralla.requiere + ')');
    if (nm < d.muralla) return NO('Requiere muralla nivel ' + d.muralla);
    if (!(Number.isInteger(n) && n >= 1)) return NO('Cantidad no válida');
    if (totalDefensas(e) + n > maxDefensas(e)) return NO('La muralla no admite más defensas (' + totalDefensas(e) + ' / ' + maxDefensas(e) + '): súbela de nivel');
    const coste = por(d.coste, n); if (!alcanza(e, coste)) return NO('Faltan ' + faltan(e, coste).join(', '));
    return SI({ coste });
  }
  function construirDefensa(e, tipo, n = 1) { const p = puedeConstruirDefensa(e, tipo, n); if (!p.ok) return p; pagar(e, p.coste); e.militar.defensas[tipo] += n; return SI({ n }); }
  // 0.9 · borrar una defensa de la muralla: libera su sitio y devuelve el 50 % de lo que costó (como demoler)
  function puedeBorrarDefensa(e, tipo, n = 1) {
    if (!D.defensas[tipo]) return NO('Defensa desconocida');
    if (!(Number.isInteger(n) && n >= 1)) return NO('Cantidad no válida');
    if ((e.militar.defensas[tipo] || 0) < n) return NO('No tienes ' + (n > 1 ? 'tantas' : 'ninguna') + ' (' + D.defensas[tipo].nombre.toLowerCase() + ')');
    return SI({ devuelto: Object.fromEntries(Object.entries(por(D.defensas[tipo].coste, n)).map(([k, v]) => [k, Math.floor(v * D.campamento.devolucion)]).filter(([, v]) => v > 0)) });
  }
  function borrarDefensa(e, tipo, n = 1) { const p = puedeBorrarDefensa(e, tipo, n); if (!p.ok) return p; e.militar.defensas[tipo] -= n; sumar(e.recursos, p.devuelto); e.militar.defensasBorradas = (e.militar.defensasBorradas || 0) + n; return SI({ n, devuelto: p.devuelto }); }
  const fuerzaDefensas = e => DEFENSAS.reduce((s, k) => s + (e.militar.defensas[k] || 0) * D.defensas[k].fuerza, 0);
  // Fuerza al defender: tropas que están en la ciudad + héroes listos + defensas, todo × (1 + bono de la muralla)
  function fuerzaDefensa(e) {
    const m = e.militar, sel = { tropas: { ...m.tropas }, heroes: m.heroes.filter(h => estadoHeroe(h) === 'listo').map(h => h.id) };
    const ej = fuerzaEjercito(e, sel, null).total, def = fuerzaDefensas(e), bono = bonoMuralla(e);
    return { total: (ej + def) * (1 + bono), ejercito: ej, defensas: def, bono };
  }
  const enGuerra = e => e.militar.ciudades.filter(c => c.guerra && !c.conquistada);
  const costePaz = c => ({ oro: Math.round(c.fuerza * D.paz.oroPorFuerza) });
  function firmarPaz(e, id) {
    const c = objetivo(e, id); if (!esCiudad(c)) return NO('Ciudad desconocida');
    if (!c.guerra) return NO('No estás en guerra con ' + c.nombre);
    const coste = costePaz(c); if (!alcanza(e, coste)) return NO('Faltan ' + faltan(e, coste).join(', '));
    pagar(e, coste); c.guerra = false; delete c.ataqueMs; e.militar.pazFirmadas++; informe(e, 'paz', { nombre: c.nombre, coste }); return SI({ coste });
  }
  // Una ciudad en guerra te saquea: si ganas, pierdes pocas tropas; si pierdes, se llevan el 30 % de lo que no está a salvo. Nunca te eliminan.
  function defenderAtaque(e, c) {
    const m = e.militar, G = D.guerra, r = azar(e), C = D.combate;
    const casa = { ...m.tropas }, hsDef = m.heroes.filter(h => estadoHeroe(h) === 'listo'), LG = efectosLegendarios(e, { heroes: hsDef.map(h => h.id) }, c, { porClase: {}, total: 0, tropas: 0 }, true);
    const atk = c.fuerza * G.fuerzaAtaque * LG.kE * (C.azar[0] + r() * (C.azar[1] - C.azar[0])), fd = fuerzaDefensa(e), gana = fd.total >= atk, q = atk / Math.max(fd.total, 1e-9);
    const fr = gana ? C.bajasVictoria * q * q : G.bajasDerrota, bajas = {}, robado = {};
    for (const t of TIPOS_TROPA) { const k = Math.min(m.tropas[t], Math.round(m.tropas[t] * fr)); if (k > 0) { bajas[t] = k; m.tropas[t] -= k; } }
    if (!gana) {
      const cap = J.capacidadASalvo(e);
      for (const k of J.RECURSOS) { const v = Math.floor(Math.max(0, e.recursos[k] - cap) * G.saqueo); if (v > 0) { robado[k] = v; e.recursos[k] -= v; m.robado[k] = (m.robado[k] || 0) + v; } }
      m.defensasPerdidas++;
    } else m.defensasGanadas++;
    const inf = { tipo: 'defensa', ciudad: c.nombre, id: c.id, nivel: c.nivel, gana, fuerzaAtaque: Math.round(atk), fuerzaDefensa: Math.round(fd.total), bajas, robado,
      tropasCasa: Object.fromEntries(Object.entries(casa).filter(([, n]) => n > 0)), heroesDef: hsDef.map(h => h.nombre), ejercito: Math.round(fd.ejercito), defensas: Math.round(fd.defensas),
      defensasN: { ...m.defensas }, muralla: nivelMuralla(e), bonoMuralla: fd.bono, efectos: LG.textos };
    m.ultimaDefensa = inf; m.avisos.push(inf);
    informe(e, 'defensa', inf);   // 0.7: queda en Informes (también si te atacan mientras no juegas)
    return inf;
  }
  // Tributo por minuto de las ciudades conquistadas (sale de su botín)
  function tributo(e) {
    const r = {}; if (!e.militar) return r;
    for (const c of e.militar.ciudades) if (c.conquistada) for (const [k, x] of Object.entries(D.ciudades.botin)) r[k] = (r[k] || 0) + c.fuerza * x * D.conquista.tributoPorMin * J.factorModo(e);
    return r;
  }
  // 0.8 · Estadísticas: producción por minuto de la ciudad principal y de las conquistadas (por separado y en total)
  function produccionDesglose(e) {
    const total = J.ritmos(e), conq = tributo(e), principal = {};
    for (const k of J.RECURSOS) principal[k] = (total[k] || 0) - (conq[k] || 0);
    const porCiudad = (e.militar ? e.militar.ciudades.filter(c => c.conquistada) : []).map(c => ({ nombre: c.nombre, nivel: c.nivel, antigua: !!c.antigua,
      ritmo: Object.fromEntries(Object.entries(D.ciudades.botin).map(([k, x]) => [k, c.fuerza * x * D.conquista.tributoPorMin * J.factorModo(e)])) }));
    return { principal, conquistadas: conq, total, porCiudad };
  }

  // ---------- 0.6 · Tienda ----------
  const valorDe = coste => Object.entries(coste).reduce((s, [k, v]) => s + (v || 0) * (D.tienda.valor[k] || 1), 0);
  // 0.7 · la tienda es un edificio único: su nivel baja el recargo y la comisión (sin partida o sin tienda: los de la 0.6)
  const nivelTienda = e => { const b = e && e.edificios ? edificio(e, 'tienda') : null; return b ? b.nivel : 0; };
  const recargoTienda = e => Math.max(D.tienda.recargoMin || 1, D.tienda.recargo - (D.tienda.recargoPorNivel || 0) * Math.max(0, nivelTienda(e) - 1));
  const comisionTienda = e => Math.max(D.tienda.comisionMin || 0, D.tienda.comision - (D.tienda.comisionPorNivel || 0) * Math.max(0, nivelTienda(e) - 1));
  function precioTienda(item, e) {
    const k = recargoTienda(e);
    if (D.pociones[item]) return { oro: Math.ceil(valorDe(D.pociones[item].coste) * k) };
    if (D.objetos[item]) return { oro: Math.ceil((D.objetos[item].precio || valorDe(D.objetos[item].recursos)) * k) };   // 0.8: los cofres de tienda tienen precio propio (llevan fragmentos)
    if (item === 'fragmento_comun') return { oro: D.tienda.fragmentoComun };
    return null;
  }
  const sinTienda = e => !edificio(e, 'tienda') ? NO('Construye una ' + D.edificios.tienda.nombre.toLowerCase() + ' (ayuntamiento nivel ' + D.edificios.tienda.requiere + ')') : null;
  const articulosTienda = () => D.tienda.venta.concat(['fragmento_comun']);
  function comprarTienda(e, item, n = 1) {
    const st = sinTienda(e); if (st) return st;
    const p = precioTienda(item, e); if (!p || !articulosTienda().includes(item)) return NO('Ese artículo no se vende');
    if (!(Number.isInteger(n) && n >= 1)) return NO('Cantidad no válida');
    const coste = por(p, n); if (!alcanza(e, coste)) return NO('Faltan ' + faltan(e, coste).join(', '));
    pagar(e, coste); const m = e.militar;
    if (D.pociones[item]) m.pociones[item] += n; else if (D.objetos[item]) m.objetos[item] += n; else m.fragmentos += n;
    return SI({ coste });
  }
  // Intercambio de materiales: según su valor, menos la comisión (0.8: 30 % que baja 0,5 puntos por nivel de la tienda, mín. 5 %)
  const tasaCambio = (de, a, e) => D.tienda.valor[de] / D.tienda.valor[a] * (1 - comisionTienda(e));
  function intercambiar(e, de, a, cantidad) {
    const st = sinTienda(e); if (st) return st;
    if (!J.RECURSOS.includes(de) || !J.RECURSOS.includes(a) || de === a) return NO('Intercambio no válido');
    if (!(Number.isInteger(cantidad) && cantidad >= 1)) return NO('Cantidad no válida');
    if (e.recursos[de] + 1e-9 < cantidad) return NO('Faltan ' + NOMBRE(de) + ' ' + Math.ceil(cantidad - e.recursos[de]));
    const recibe = Math.floor(cantidad * tasaCambio(de, a, e) + 1e-9);   // 0.8: sin errores de coma flotante (1000 × 3 × 0,7 = 2100, no 2099) if (recibe < 1) return NO('Demasiado poco para cambiar');
    e.recursos[de] -= cantidad; e.recursos[a] += recibe; return SI({ recibe });
  }

  // ---------- 0.8 · Farmeo nuevo (recolección con obreros) ----------
  // Zonas sin nivel, sin guardia y que no se agotan. Solo van obreros. El ritmo por minuto NO depende de cuántos vayan y crece con el tiempo que llevan:
  //   ritmo(t) = base × (1 + 0,15·(Escuela − 1)) × (1 + bonos de recoger) × mín(tope, 1 + t/cadaMin). Lo recogido tiene el tope de su carga (si se llenan, vuelven antes).
  //   La poción de farmeo rápido (activa al salir, o usada sobre un farmeo en curso) recorta el tiempo de trabajo que queda; la de velocidad, la marcha.
  //   En Clásica la marcha = la de las tropas × ida / × vuelta del obrero más lento del grupo; en Rápida es instantánea.
  const zona = (e, id) => e.militar.zonas.find(z => z.id === id) || null;
  const ocupada = (e, id) => e.militar.expediciones.some(x => x.zona === id);
  const CRECE_Z = () => D.zonas.crece;
  // multiplicador acumulado: minutos «equivalentes a ritmo base» tras D minutos de trabajo
  function acumulado(min) {
    const c = CRECE_Z().cadaMin, T = CRECE_Z().tope, tc = c * (T - 1), d = Math.max(0, min);
    return d <= tc ? d + d * d / (2 * c) : tc + tc * tc / (2 * c) + T * (d - tc);
  }
  function minutosPara(q) {   // inversa de acumulado
    const c = CRECE_Z().cadaMin, T = CRECE_Z().tope, tc = c * (T - 1), qc = acumulado(tc);
    return q <= qc ? c * (-1 + Math.sqrt(1 + 2 * q / c)) : tc + (q - qc) / T;
  }
  const ritmoZona = (e, z) => D.zonas.recursos[z.recurso].ritmo * (1 + D.zonas.porEscuela * Math.max(0, nivelEscuela(e) - 1)) * (1 + bonoHab(e, 'recoger'));
  const cargaDe = obreros => Object.entries(obreros || {}).reduce((s, [t, n]) => s + (n > 0 && D.obreros[t] ? n * D.obreros[t].carga : 0), 0);
  const factorObreros = (obreros, k) => Math.max(0, ...Object.entries(obreros || {}).filter(([t, n]) => n > 0 && D.obreros[t]).map(([t]) => D.obreros[t][k]));
  function previsionRecogida(e, z, obreros, minutos) {
    const n = Object.values(obreros || {}).reduce((a, b) => a + (b > 0 ? b : 0), 0), carga = cargaDe(obreros), r0 = ritmoZona(e, z);
    const maximo = Math.floor(r0 * acumulado(minutos)), cantidad = Math.floor(Math.min(maximo, carga)), llena = carga < maximo;
    const trabajoMin = llena ? Math.min(minutos, minutosPara(carga / r0)) : minutos;
    const recogerMin = Math.round(trabajoMin * (1 - efecto(e, 'farmeo')) * 10) / 10;
    const base = minutosMarcha(e, z.x, z.y), idaMin = Math.round(base * factorObreros(obreros, 'ida') * 10) / 10, vueltaMin = Math.round(base * factorObreros(obreros, 'vuelta') * 10) / 10;
    return { n, carga, ritmo: Math.round(r0 * 10) / 10, ritmoMax: Math.round(r0 * CRECE_Z().tope * 10) / 10, maximo, cantidad, llena, trabajoMin: Math.round(trabajoMin * 10) / 10, recogerMin,
      marchaMin: idaMin, idaMin, vueltaMin, marchaTropasMin: base, totalMin: Math.round((idaMin + vueltaMin + recogerMin) * 10) / 10 };
  }
  // «Auto»: los obreros justos (según su carga) para lo que se puede extraer en ese tiempo (pieza común kk-reparto)
  function autoObreros(e, zonaId, minutos) {
    const z = zona(e, zonaId); if (!z) return { obreros: {}, falta: 0, necesario: 0 };
    const necesario = Math.floor(ritmoZona(e, z) * acumulado(minutos)), m = e.militar;
    const R = g.KKReparto.repartirCarga(necesario, OBREROS.map(t => ({ id: t, carga: D.obreros[t].carga, disponibles: m.obreros[t] || 0 })));
    return { obreros: R.asignados, carga: R.carga, falta: R.falta, necesario };
  }
  function puedeRecoger(e, zonaId, sel, minutos) {
    const z = zona(e, zonaId); if (!z) return NO('Esa zona ya no está');
    if (ocupada(e, zonaId)) return NO('Ya hay obreros trabajando ahí');
    if (!D.zonas.duraciones.includes(minutos)) return NO('Duración no válida');
    if (sel && sel.tropas && Object.values(sel.tropas).some(n => n > 0)) return NO('Solo pueden ir obreros');
    const obreros = {};
    for (const [t, n] of Object.entries((sel && sel.obreros) || {})) { if (!D.obreros[t]) return NO('Obrero desconocido'); const k = Math.floor(n); if (k < 0 || k > (e.militar.obreros[t] || 0)) return NO('No tienes tantos obreros'); if (k > 0) obreros[t] = k; }
    if (!Object.keys(obreros).length) return NO('Elige al menos un obrero (fórmalos en la ' + D.edificios.escuela_maestria.nombre.toLowerCase() + ')');
    const pv = previsionRecogida(e, z, obreros, minutos); if (pv.cantidad < 1) return NO('No hay nada que recoger');
    return SI({ obreros, prevision: pv });
  }
  function recoger(e, zonaId, sel, minutos) {
    const p = puedeRecoger(e, zonaId, sel, minutos); if (!p.ok) return p;
    const m = e.militar, z = zona(e, zonaId), pv = p.prevision;
    for (const [t, n] of Object.entries(p.obreros)) m.obreros[t] -= n;
    const idaMs = Math.round(pv.idaMin * MS_MIN), vueltaMs = Math.round(pv.vueltaMin * MS_MIN);
    const x = { id: 'x' + (m.azarN + 1) + '_' + m.expediciones.length + '_' + Math.round(e.jugadoMs), v: 8, zona: z.id, recurso: z.recurso, obreros: p.obreros, tropas: {}, minutos,
      cantidad: pv.cantidad, r0: ritmoZona(e, z), trabajoMin: pv.trabajoMin, hecho: 0, vel: 1 / Math.max(0.05, 1 - efecto(e, 'farmeo')), llena: pv.llena,
      fase: idaMs > 0 ? 'ida' : 'trabajando', faseMs: idaMs, idaMs, vueltaMs, restanteMs: 0, totalMs: 0 };
    m.azarN++; m.expediciones.push(x); actualizarExpedicion(x); x.totalMs = x.restanteMs;
    return SI({ expedicion: x });
  }
  const recogidoHasta = x => Math.floor(Math.min(x.cantidad, x.r0 * acumulado(x.hecho)));
  const trabajoRestanteMs = x => Math.max(0, (x.trabajoMin - x.hecho) / x.vel * MS_MIN);
  function actualizarExpedicion(x) {
    x.restanteMs = Math.round(x.fase === 'ida' ? x.faseMs + trabajoRestanteMs(x) + x.vueltaMs : x.fase === 'trabajando' ? trabajoRestanteMs(x) + x.vueltaMs : x.faseMs);
    x.recogido = x.fase === 'ida' ? 0 : x.fase === 'trabajando' ? recogidoHasta(x) : x.cantidad;
  }
  function terminarExpedicion(e, x) {
    const m = e.militar, traido = Math.floor(x.cantidad || 0);
    for (const [t, n] of Object.entries(x.obreros || {})) m.obreros[t] = (m.obreros[t] || 0) + n;
    e.recursos[x.recurso] += traido;
    m.expediciones = m.expediciones.filter(y => y !== x);
    const completa = !x.cancelada;
    if (completa) m.recolecciones++;
    if (traido > 0) m.recolectado[x.recurso] = (m.recolectado[x.recurso] || 0) + traido;
    m.avisos.push({ tipo: 'recogida', recurso: x.recurso, cantidad: traido, completa });
    informe(e, 'recogida', { recurso: x.recurso, cantidad: traido, completa, obreros: { ...x.obreros }, minutos: x.minutos, trabajado: Math.round(x.hecho * 10) / 10, llena: !!x.llena,
      ida: Math.round(x.idaMs / MS_MIN * 10) / 10, vuelta: Math.round(x.vueltaMs / MS_MIN * 10) / 10, pociones: x.pociones || 0 });
    return traido;
  }
  // Cancelar: de ida, se dan la vuelta sin nada; trabajando, vuelven con lo recogido hasta ahora. De vuelta ya no se puede.
  function cancelarRecogida(e, expId) {
    const x = e.militar.expediciones.find(y => y.id === expId); if (!x) return NO('Ya han vuelto');
    if (x.fase === 'vuelta') return NO('Ya vuelven');
    if (x.fase === 'ida') { const andado = x.idaMs - x.faseMs; x.cantidad = 0; x.faseMs = Math.round(andado * (x.vueltaMs / Math.max(1, x.idaMs))); }
    else { x.cantidad = recogidoHasta(x); x.faseMs = x.vueltaMs; }
    x.fase = 'vuelta'; x.cancelada = true;
    const traido = x.cantidad;
    if (x.faseMs <= 0) { terminarExpedicion(e, x); return SI({ traido, enCamino: false }); }
    actualizarExpedicion(x); return SI({ traido, enCamino: true });
  }
  function avanzarExpediciones(e, ms) {
    for (const x of e.militar.expediciones.slice()) {
      if (x.v !== 8) { terminarExpedicion(e, x); continue; }   // (no debería quedar ninguna de la 0.7)
      let t = ms;
      while (t > 0 || (x.fase === 'ida' && x.faseMs <= 0) || (x.fase === 'trabajando' && x.hecho >= x.trabajoMin - 1e-9)) {
        if (x.fase === 'ida') { const d = Math.min(t, x.faseMs); x.faseMs -= d; t -= d; if (x.faseMs <= 0) x.fase = 'trabajando'; else break; }
        else if (x.fase === 'trabajando') { const rest = trabajoRestanteMs(x), d = Math.min(t, rest); x.hecho += d / MS_MIN * x.vel; t -= d;
          if (x.hecho >= x.trabajoMin - 1e-9) { x.hecho = x.trabajoMin; x.fase = 'vuelta'; x.faseMs = x.vueltaMs; } else break; }
        else { const d = Math.min(t, x.faseMs); x.faseMs -= d; t -= d; break; }
      }
      if (x.fase === 'vuelta' && x.faseMs <= 0) terminarExpedicion(e, x); else actualizarExpedicion(x);
    }
  }
  // Poción de farmeo rápido sobre un farmeo en curso: recorta en su % el trabajo que queda (y lo que traen no cambia)
  function puedeAcelerarFarmeo(e, expId, pocion) {
    const m = e.militar, x = m.expediciones.find(y => y.id === expId); if (!x) return NO('Ya han vuelto');
    const p = D.pociones[pocion]; if (!p || p.efecto !== 'farmeo') return NO('Solo sirven las pociones de farmeo rápido');
    if (!(m.pociones[pocion] > 0)) return NO('No te quedan: fabrícalas en la ' + D.edificios.botica.nombre.toLowerCase() + ' o cómpralas en la tienda');
    if (x.fase === 'vuelta') return NO('Ya han terminado: vuelven');
    if (!(trabajoRestanteMs(x) > 1000)) return NO('Ya casi han terminado');
    return SI({ expedicion: x, pct: p.pct });
  }
  function acelerarFarmeo(e, expId, pocion) {
    const p = puedeAcelerarFarmeo(e, expId, pocion); if (!p.ok) return p;
    const x = p.expedicion, antes = trabajoRestanteMs(x); x.vel = x.vel / (1 - p.pct); x.pociones = (x.pociones || 0) + 1;
    e.militar.pociones[pocion]--; e.militar.farmeosAcelerados = (e.militar.farmeosAcelerados || 0) + 1; actualizarExpedicion(x);
    return SI({ ahorroMs: Math.round(antes - trabajoRestanteMs(x)), restanteMs: x.restanteMs });
  }

  // ---------- Pociones ----------
  // 0.6: se desbloquean SOLO por el nivel de la Botica (curación 1/11/21, velocidad 3/13/23, fuerza 5/15/25, farmeo 7/17/27)
  function puedeFabricar(e, tipo) {
    const p = D.pociones[tipo]; if (!p) return NO('Poción desconocida');
    const b = edificio(e, 'botica'); if (!b) return NO('Construye una ' + D.edificios.botica.nombre.toLowerCase());
    if (b.nivel < p.botica) return NO('Requiere ' + D.edificios.botica.nombre.toLowerCase() + ' nivel ' + p.botica);
    if (!alcanza(e, p.coste)) return NO('Faltan ' + faltan(e, p.coste).join(', '));
    return SI();
  }
  function fabricar(e, tipo) { const p = puedeFabricar(e, tipo); if (!p.ok) return p; pagar(e, D.pociones[tipo].coste); e.militar.pociones[tipo]++; return SI(); }
  // La Alquimista (activa, en la ciudad) potencia las pociones con «Destilación» (la mejor) y la rama Alquimia de la Academia suma encima
  const potenciaPociones = e => 1 + Math.max(0, ...e.militar.heroes.filter(h => !h.inactivo).map(h => modificadores([h]).pociones)) + bonoHab(e, 'pociones');
  function usarPocion(e, tipo, id) {
    const p = D.pociones[tipo]; if (!p) return NO('Poción desconocida');
    if (!(e.militar.pociones[tipo] > 0)) return NO('No te quedan');
    if (p.tipo === 'enfriamiento') {   // 0.8: recorta la espera entre asedios (solo el jugador)
      const m = e.militar; if (!(m.asedioMs > 0)) return NO('No tienes ningún asedio en espera');
      const antes = m.asedioMs; m.asedioMs = p.menosMin ? Math.max(0, m.asedioMs - p.menosMin * MS_MIN) : Math.max(0, Math.round(m.asedioMs * (1 - p.pct)));   // 0.9: pequeña −3 min fijos; mediana −30 %; grande −100 %
      m.pociones[tipo]--; return SI({ asedioMs: m.asedioMs, ahorroMs: antes - m.asedioMs });
    }
    if (p.tipo === 'efecto') {   // 0.6: efecto para toda la partida (la Alquimia alarga la duración)
      const act = e.militar.efectos[p.efecto];
      if (act && act.ms > 0 && act.pct > p.pct) return NO('Ya tienes activa una poción mejor de ' + p.efecto);
      e.militar.efectos[p.efecto] = { pct: p.pct, ms: Math.round(p.duracion * MS_MIN * potenciaPociones(e)), tipo };
      e.militar.pociones[tipo]--; return SI({ efecto: e.militar.efectos[p.efecto] });
    }
    const h = heroe(e, id); if (!h) return NO('Héroe desconocido');
    const ms = p.minutos * MS_MIN * potenciaPociones(e);
    if (h.heridoMs > 0) h.heridoMs = h.heridoMs <= ms ? 0 : h.heridoMs - ms;
    else if (h.inactivo) { h.inactivoMs = h.inactivoMs <= ms ? 0 : h.inactivoMs - ms; if (!h.inactivoMs) h.inactivo = false; }
    else return NO(h.nombre + ' está bien: no necesita pociones');
    e.militar.pociones[tipo]--; return SI({ heroe: h });
  }
  // ---------- Objetos ----------
  function abrirObjeto(e, id) {
    const o = D.objetos[id]; if (!o) return NO('Objeto desconocido');
    if (!(e.militar.objetos[id] > 0)) return NO('No te quedan');
    e.militar.objetos[id]--; sumar(e.recursos, o.recursos);
    // 0.8 · cofres de tienda: además, fragmentos comunes (de héroe) y de familias de monstruo al azar
    const fr = { comunes: 0, familias: {} };
    if (o.fragmentos) {
      const m = e.militar, r = azar(e); fr.comunes = o.fragmentos.comunes || 0; m.fragmentos += fr.comunes;
      for (let i = 0; i < (o.fragmentos.familia || 0); i++) { const f = FAMILIAS[Math.floor(r() * FAMILIAS.length)]; fr.familias[f] = (fr.familias[f] || 0) + 1; m.fragFamilia[f] = (m.fragFamilia[f] || 0) + 1; }
      m.cofresAbiertos = (m.cofresAbiertos || 0) + 1;
      informe(e, 'cofre', { objeto: id, nombre: o.nombre, recursos: { ...o.recursos }, comunes: fr.comunes, familias: fr.familias });
      for (const h of m.heroes) subirAuto(e, h);
    }
    return SI({ recursos: { ...o.recursos }, fragmentos: fr });
  }

  // ---------- Misiones ----------
  function progresoMision(e, mi) {
    const m = e.militar;
    switch (mi.tipo) {
      case 'edificio': return Math.max(0, ...e.edificios.filter(b => b.tipo === mi.edificio).map(b => b.nivel));
      case 'personas': return J.personasTotales(e);
      case 'tropas': return totalTropasConFuera(e);
      case 'habilidades': return Object.values(m.academia).reduce((a, b) => a + b, 0);
      case 'muralla': return nivelMuralla(e);
      case 'conquistas': return Math.max(m.conquistas || 0, m.ciudades.filter(c => c.conquistada).length);   // 0.7: cuenta las ciudades que son tuyas
      case 'conquistas50': return m.ciudades.filter(c => c.conquistada && !c.antigua).length;   // 0.8: solo las 50 nuevas
      case 'heroe': return Math.max(0, ...m.heroes.map(h => h.nivel));
      default: return m[mi.tipo] || 0;
    }
  }
  function misiones(e) {
    return D.misiones.map(mi => { const v = progresoMision(e, mi); return { ...mi, valor: Math.min(v, mi.meta), completa: v >= mi.meta, cobrada: e.militar.misionesCobradas.includes(mi.id) }; });
  }
  function cobrarMision(e, id) {
    const mi = misiones(e).find(x => x.id === id); if (!mi) return NO('Misión desconocida');
    if (mi.cobrada) return NO('Ya cobrada'); if (!mi.completa) return NO('Aún no está cumplida');
    sumar(e.recursos, mi.premio); e.militar.misionesCobradas.push(id); return SI({ premio: mi.premio });
  }

  // ---------- Mantenimiento (solo mientras se juega): héroes primero, luego tropas ----------
  function sinMantener(e) {
    const P = J.ritmos(e).comida, act = e.militar.heroes.filter(h => !h.inactivo).sort((a, b) => mantHeroe(b, e) - mantHeroe(a, e));
    let s = act.reduce((x, h) => x + mantHeroe(h, e), 0), k = 0; while (s > P + 1e-9 && k < act.length) { s -= mantHeroe(act[k], e); k++; }
    return k;
  }
  function actualizarCrisis(e) { const k = sinMantener(e); if (!k) e.militar.crisis = null; else e.militar.crisis.n = k; }
  const bastan = (e, hs) => e.militar.heroes.filter(h => !h.inactivo && !hs.includes(h)).reduce((s, h) => s + mantHeroe(h, e), 0) <= J.ritmos(e).comida + 1e-9;
  function inactivar(e, h) { h.inactivo = true; h.inactivoMs = D.heroes.inactividadMin * MS_MIN; }
  function elegirInactivos(e, ids) {
    const c = e.militar.crisis; if (!c) return NO('No hace falta');
    const hs = [...new Set(ids)].map(id => heroe(e, id));
    if (hs.some(h => !h || h.inactivo)) return NO('Elige héroes activos');
    if (hs.length < c.n) return NO('Elige ' + c.n + ' héroe' + (c.n > 1 ? 's' : ''));
    if (!bastan(e, hs)) return NO('Con esos no basta la comida: elige otro más');
    hs.forEach(h => inactivar(e, h)); e.militar.crisis = null; return SI();
  }
  // 0.6: opts.factor = 0,5 si es tiempo desconectado (Clásica): el consumo va a la mitad, igual que la producción; los temporizadores corren enteros
  function avanzar(e, ms, opts = {}) {
    if (!e.militar || !(ms > 0)) return e;
    FUERA = !!opts.desconectado;
    try { return avanzarDentro(e, ms, opts); } finally { FUERA = false; }
  }
  function avanzarDentro(e, ms, opts) {
    const m = e.militar, kf = opts.factor || 1, min = ms / MS_MIN * kf;
    for (const h of m.heroes) if (h.heridoMs > 0) h.heridoMs = Math.max(0, h.heridoMs - ms);
    for (const c of m.ciudades) if (c.recuperaMs > 0) c.recuperaMs = Math.max(0, c.recuperaMs - ms);
    for (const k of Object.keys(m.efectos)) { m.efectos[k].ms -= ms; if (m.efectos[k].ms <= 0) delete m.efectos[k]; }
    if (m.asedioMs > 0) m.asedioMs = Math.max(0, m.asedioMs - ms);   // 0.8
    avanzarExpediciones(e, ms);
    avanzarMarchas(e, ms);
    // monstruos que nadie ataca: se renuevan a los 10–15 min
    for (const mo of m.monstruos.slice()) {
      if (!(mo.vidaMs >= 0)) mo.vidaMs = vidaMonstruo(azar(e));
      mo.vidaMs -= ms;
      if (mo.vidaMs <= 0 && !m.marchas.some(x => x.objetivo === mo.id)) {
        const i = m.monstruos.indexOf(mo); m.monstruos.splice(i, 1);
        const nuevo = reponerMonstruo(e, azar(e), mo); if (nuevo) m.monstruos.splice(i, 0, nuevo);
      }
    }
    // guerra: desde ayto nv20, cada ciudad en guerra contigo te ataca cada 3–4 h (0.8) y SOLO UNA a la vez: mientras una tiene el ataque en curso
    // (dentro del aviso de 5 min), las demás esperan sin bajar de ese aviso. Los enemigos no usan pociones.
    if (J.nivelCiudad(e) >= D.guerra.desdeAyto) {
      const avisoMs = D.guerra.avisoMin * MS_MIN, G = enGuerra(e);
      for (const c of G) if (!(c.ataqueMs >= 0)) { const r = azar(e); c.ataqueMs = Math.round((D.guerra.cadaMin[0] + r() * (D.guerra.cadaMin[1] - D.guerra.cadaMin[0])) * MS_MIN); }
      let ocupado = false;
      for (const c of G.slice().sort((a, b) => a.ataqueMs - b.ataqueMs)) {
        if (ocupado) { c.ataqueMs = Math.max(avisoMs + 1000, c.ataqueMs - ms); continue; }
        c.ataqueMs -= ms;
        if (c.ataqueMs <= 0) { defenderAtaque(e, c); delete c.ataqueMs; ocupado = true; }   // los demás esperan (como mínimo el aviso)
        else if (c.ataqueMs <= avisoMs) ocupado = true;
      }
    }
    // tributo de las ciudades conquistadas
    for (const [k, v] of Object.entries(tributo(e))) e.recursos[k] += v * min;
    const P = J.ritmos(e).comida;
    const activos = m.heroes.filter(h => !h.inactivo), uH = activos.reduce((s, h) => s + mantHeroe(h, e), 0);
    if (e.recursos.comida + 1e-9 >= uH * min) { e.recursos.comida -= uH * min; if (m.crisis) m.crisis = null; }
    else {
      e.recursos.comida = 0;
      const k = sinMantener(e);
      if (k && !m.crisis) m.crisis = { n: k, plazoMs: D.heroes.plazoEleccionMin * MS_MIN };
    }
    if (m.crisis) {
      actualizarCrisis(e);
      if (m.crisis) {
        m.crisis.plazoMs -= ms;
        if (m.crisis.plazoMs <= 0) {
          const orden = m.heroes.filter(h => !h.inactivo).sort((a, b) => a.nivel - b.nivel || m.heroes.indexOf(a) - m.heroes.indexOf(b)), elegidos = [];
          for (const h of orden) { if (elegidos.length >= m.crisis.n && bastan(e, elegidos)) break; elegidos.push(h); }
          elegidos.forEach(h => inactivar(e, h)); m.crisis = null; m.autoInactivos = elegidos.map(h => h.id);
        }
      }
    }
    // Tropas (también las que están recogiendo): si no hay comida, desertan de las que están en la ciudad (primero del tipo más numeroso)
    const uT = mantTropas(e);
    if (uT > 0) {
      if (e.recursos.comida + 1e-9 >= uT * min) e.recursos.comida -= uT * min;
      else {
        e.recursos.comida = 0;
        const uHact = m.heroes.filter(h => !h.inactivo).reduce((s, h) => s + mantHeroe(h, e), 0);
        let deficit = uT - Math.max(0, P - uHact); const d0 = m.desertores;
        while (deficit > 1e-9 && totalTropas(e) > 0) {
          const t = TIPOS_TROPA.slice().sort((a, b) => m.tropas[b] - m.tropas[a])[0];
          m.tropas[t]--; m.desertores++; deficit -= D.tropas[t].mant * fMant(e);
        }
        if (m.desertores > d0) { const ult = (m.informes || [])[m.informes.length - 1]; if (ult && ult.tipo === 'desercion' && ult.desconectado === (FUERA || undefined)) ult.n += m.desertores - d0; else informe(e, 'desercion', { n: m.desertores - d0 }); }
      }
    }
    if (e.recursos.comida > 0) for (const h of m.heroes) if (h.inactivo) {
      h.inactivoMs = Math.max(0, h.inactivoMs - ms);
      if (!h.inactivoMs) {
        const libreRate = P - m.heroes.filter(x => !x.inactivo).reduce((s, x) => s + mantHeroe(x, e), 0) - mantTropas(e);
        if (libreRate >= mantHeroe(h, e) || e.recursos.comida >= mantHeroe(h, e) * 10) h.inactivo = false;
      }
    }
    return e;
  }
  function mantenimiento(e) { const m = e.militar; return { heroes: m.heroes.filter(h => !h.inactivo).reduce((s, h) => s + mantHeroe(h, e), 0), tropas: mantTropas(e) }; }

  g.CivilikMilitar = { informe, informesNuevos, marcarInformesVistos, puedeAcelerarMarcha, acelerarMarcha, posicionMarcha, bonoVelocidad, edificioHab, habilidadesDe, nivelTienda, recargoTienda, comisionTienda, TIPOS_MONSTRUO, costeMuralla, puedeMejorarMuralla, mejorarMuralla, DEFENSAS, efecto, minutosMarcha, esConquistable, puedeConquistar, resolverCombate, retirarMarcha, nivelMuralla, bonoMuralla, totalDefensas, maxDefensas,
    puedeConstruirDefensa, construirDefensa, fuerzaDefensas, fuerzaDefensa, enGuerra, costePaz, firmarPaz, defenderAtaque, tributo, precioTienda, articulosTienda, comprarTienda, tasaCambio, intercambiar,
    vidaMonstruo, TIPOS_TROPA, TIPOS_HEROE, POCIONES, FAMILIAS, OBJETOS, rangoDe, rangoTropas, marcoHeroe, potenciaPociones, vacio, migrar, poblarMundo, colocarMonstruo, datosMonstruo, objetivo, esCiudad,
    puedeEntrenar, maxEntrenar, entrenar, mantTropas, totalTropas, totalTropasConFuera, fuera, mantHeroe, poderHeroe, estadoHeroe, heroe, tipoHeroe,
    elegirHeroeInicial, costeCriar, puedeCriar, criarHeroe, puedeConvocar, convocar, nivelMaxHeroe, requisitosSubir, fragmentosPara, subirAuto, subirTodos, puedeSubir, subirNivel, devolucionDespedir, despedir,
    habilidades, modificadores, rps, fuerzaEjercito, validarSeleccion, atacar,
    zona, ocupada, previsionRecogida, puedeRecoger, recoger, cancelarRecogida, autoObreros, acumulado, ritmoZona, cargaDe, puedeAcelerarFarmeo, acelerarFarmeo,
    OBREROS, LEGENDARIOS, nivelEscuela, puedeFormar, maxFormar, formar, obrerosFuera, totalObreros, totalObrerosConFuera, migrarObreros, colocarLegendario, efectosLegendarios,
    bajasCaptura, puedeCapturar, capturar, derrotar, produccionDesglose,
    puedeFabricar, fabricar, usarPocion, abrirObjeto, misiones, progresoMision, cobrarMision,
    hab, nivelHab, tieneHab, costeHab, academiaHab, puedeAprender, aprender, bonoHab, bonoClase, bonoProduccion, investigacion, puedeInvestigar, investigar, bonoInvestigado,
    sinMantener, bastan, elegirInactivos, avanzar, mantenimiento, edificio,
    campamentoInicial, plazasNivel, plazasDe, plazasTropas, maxObreros, tropaDisponible, obrerosDisponibles, huecosCampamento, edificioCamp, puedeConstruirCamp, construirCamp, puedeMejorarCamp, mejorarCamp, maxMejoraCamp, mejorarCampMax,
    puedeDemolerCamp, demolerCamp, puedeMejorarCampamento, mejorarCampamento, puedeDespedirTropas, despedirTropas, puedeBorrarDefensa, borrarDefensa, monstruoOculto, nivelJugador, migrar09, migrar10 };
})(typeof window !== 'undefined' ? window : globalThis);
