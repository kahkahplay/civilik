/* Civili'k 0.9 · NÚMEROS PROVISIONALES de la parte militar (autorizados por Jose, 10/11/2026), en un solo sitio para poder cambiarlos.
   Coherentes con la economía ×3 de la 0.2 (una granja nv1 da 24 comida/min; una casa nv1, 2 personas = 6 oro/min). La economía de la 0.2 NO cambia.
   Tiempos en minutos JUGADOS (el reloj solo corre mientras se juega; el acelerador x2/x3 también los acelera). Tabla completa en ESTADO.md. */
(function (g) {
  'use strict';
  const c = (madera, piedra, oro = 0, hierro = 0) => ({ madera, piedra, oro, hierro });

  // ================= 0.4 · NIVELES HASTA 30 (curva PROVISIONAL, encargo de Jose 10/11/2026) =================
  // Regla: los niveles que ya existían (1–3, o 1–4 en ayuntamiento y casa) CONSERVAN sus números exactos (las partidas no cambian).
  // A partir de ahí:
  //  · Costes: el último coste conocido × 1,3 por nivel. Hierro desde nv5 (al menos 20 % de la madera) y metal desde nv10 (3 % de la madera).
  //  · Producción a pleno: f(n) = (n+1)·(9+3n) (fórmula exacta de la granja 24/45/72); los demás escalan su nv3 por f(n)/f(3).
  //  · Trabajadores: producción n+1 (2/3/4 → 31 en nv30); Academia, Cuartel y Salón n; Botica y Depósito ⌈2n/3⌉ (1/2/2 → 20).
  //  · Casa: 2n personas (2/4/6/8 → 60). A salvo (ayuntamiento y depósito): último valor × 1,3 por nivel.
  //  · Huecos del ayuntamiento: 16/24/32/40 en nv1–4 y 40 desde ahí (la retícula 8×8 de la ciudad tiene 40 parcelas: ampliarla queda pendiente).
  //  · La construcción y las mejoras siguen siendo instantáneas (no hay tiempos de obra en el juego). Redondeo: 3 cifras significativas.
  // 0.7 · TODOS LOS EDIFICIOS HASTA NIVEL 50 (encargo de Jose, 13/11/2026). Niveles 1–30 SIN CAMBIOS; del 31 al 50 (PROVISIONAL):
  //  · costes y «a salvo»: el del nivel anterior × 1,15 (más suave que el × 1,3 de antes, para que no se dispare); producción con la misma fórmula f(n);
  //  · casa: 300 personas en nv30 → 450 en nv40 → 650 en nv50; huecos del ayuntamiento: 100 desde nv30 (la ciudad no cambia).
  //  Héroes, monstruos, ciudades y zonas siguen en niveles 1–30.
  // 0.8 (encargo de Jose, 14/11/2026; TODO PROVISIONAL salvo lo que él fijó): monstruos legendarios nv31–50 (fuerza × 1,15 por nivel desde el 30),
  //  ciudades enemigas nv15–50, héroes y capturados hasta nv100 (experiencia × 1,08 por nivel desde el 30).
  const NIVEL_MAX = 50, NIVEL_30 = 30, CRECE = 1.3, CRECE_ALTO = 1.15;
  const redondo = v => { if (v <= 0) return 0; if (v < 100) return Math.max(5, Math.round(v / 5) * 5); const p = Math.pow(10, Math.floor(Math.log10(v)) - 2); return Math.round(v / p) * p; };
  // Extiende una lista de costes (objetos) hasta 30 niveles. desde = nivel (1-based) del primer coste de la lista.
  function costes(lista, desde = 1) {
    const out = lista.slice(), ult = lista[lista.length - 1], nUlt = desde + lista.length - 1;
    for (let n = nUlt + 1; n <= NIVEL_MAX; n++) {
      const k = Math.pow(CRECE, n - nUlt), x = {};
      // 0.7: del 31 al 50, el coste del nivel anterior × 1,15
      for (const r of ['madera', 'piedra', 'oro', 'hierro', 'metal']) x[r] = n <= NIVEL_30 ? redondo((ult[r] || 0) * k) : redondo((out[out.length - 1][r] || 0) * CRECE_ALTO);
      if (n >= 5) x.hierro = Math.max(x.hierro, redondo(x.madera * 0.2));
      if (n >= 10) x.metal = Math.max(x.metal, redondo(x.madera * 0.03));
      out.push(x);
    }
    return out;
  }
  // 0.9 · costes del Campamento: solo madera, piedra y oro; × 1,3 por nivel hasta el 30 y × 1,15 desde ahí
  function costesCamp(base) { const out = [{ ...base }]; for (let n = 2; n <= NIVEL_MAX; n++) { const p = out[n - 2], k = n <= NIVEL_30 ? CRECE : CRECE_ALTO; out.push(Object.fromEntries(Object.entries(n <= NIVEL_30 ? base : p).map(([r, v]) => [r, redondo(n <= NIVEL_30 ? v * Math.pow(CRECE, n - 1) : v * k)]))); } return out; }
  const serie = (lista, f, max = NIVEL_MAX) => { const out = lista.slice(); for (let n = lista.length + 1; n <= max; n++) out.push(f(n, out)); return out; };
  const fProd = n => (n + 1) * (9 + 3 * n);
  const ritmo = lista => serie(lista, n => Math.round(lista[2] * fProd(n) / fProd(3)));
  const trabProd = serie([2, 3, 4], n => n + 1), dosTercios = l => serie(l, n => Math.ceil(2 * n / 3)), lineal = serie([1, 2, 3], n => n);
  const aSalvo = lista => serie(lista, (n, o) => n <= NIVEL_30 ? redondo(lista[lista.length - 1] * Math.pow(CRECE, n - lista.length)) : redondo(o[n - 2] * CRECE_ALTO));
  // 0.5 · Casas con curva exponencial suave (encargo de Jose: ~2/4/7/11 en nv1-4, ~25 en nv10, ~100 en nv20, ~300 en nv30):
  // interpolación geométrica entre esos puntos, redondeada. Así no hace falta llenar la ciudad de casas.
  const ANCLAS_CASA = [[1, 2], [2, 4], [3, 7], [4, 11], [10, 25], [20, 100], [30, 300], [40, 450], [50, 650]];   // 0.7: + nv40 450 y nv50 650 (provisional)
  const personasCasa = []; for (let n = 1; n <= NIVEL_MAX; n++) { let i = 0; while (ANCLAS_CASA[i + 1][0] < n) i++; const [n0, v0] = ANCLAS_CASA[i], [n1, v1] = ANCLAS_CASA[i + 1]; personasCasa.push(Math.round(v0 * Math.pow(v1 / v0, (n - n0) / (n1 - n0)))); }
  // 0.5 · Ciudad ampliada: retícula de 12×12 parcelas (6×6 manzanas); el ayuntamiento abre 16/24/32/40 (nv1–4, igual) y luego +60/26 por nivel → 100 en nv30
  const huecosAyto = serie([16, 24, 32, 40], n => Math.min(100, 40 + Math.round((n - 4) * 60 / 26)));   // 0.7: 100 desde nv30 (los huecos no cambian)
  // Edificios civiles (0.1/0.2): mismos números de siempre en sus niveles antiguos + curva 0.4 (juego.js los toma de aquí)
  const civiles = {
    ayuntamiento: { nombre: 'Ayuntamiento', max: NIVEL_MAX, huecos: huecosAyto, aSalvo: aSalvo([30, 60, 90, 120]), mejora: [null].concat(costes([c(80, 80, 40), c(160, 160, 80), c(320, 320, 160)], 2)), unico: true },
    casa: { nombre: 'Casa', max: NIVEL_MAX, da: personasCasa, coste: costes([c(20, 10, 5), c(30, 20, 10), c(50, 30, 20), c(80, 50, 40)]), requiere: 1 },
    // 0.6 · Depósito (almacén) con MÁS CAPACIDAD: guarda a salvo ~3,5 h (210 min) de la producción de una granja de su nivel (en Clásica, de la producción de Clásica)
    deposito: { nombre: 'Depósito', max: NIVEL_MAX, trab: dosTercios([1, 2, 2]), aSalvo: ritmo([24, 45, 72]).map(v => redondo(v * 210)), horasAlmacen: 3.5, coste: costes([c(40, 40, 20), c(80, 80, 40), c(160, 160, 80)]), requiere: 2 },
    granja: { nombre: 'Granja', max: NIVEL_MAX, trab: trabProd, produce: 'comida', ritmo: ritmo([24, 45, 72]), coste: costes([c(15, 5), c(30, 15, 10), c(60, 30, 20)]), requiere: 1 },
    aserradero: { nombre: 'Aserradero', max: NIVEL_MAX, trab: trabProd, produce: 'madera', ritmo: ritmo([18, 36, 60]), coste: costes([c(10, 15), c(20, 30, 10), c(40, 60, 20)]), requiere: 1 },
    cantera: { nombre: 'Cantera', max: NIVEL_MAX, trab: trabProd, produce: 'piedra', ritmo: ritmo([18, 36, 60]), coste: costes([c(15, 10), c(30, 20, 10), c(60, 40, 20)]), requiere: 1 },
    mina: { nombre: 'Mina', max: NIVEL_MAX, trab: trabProd, produce: 'hierro', ritmo: ritmo([12, 24, 42]), coste: costes([c(20, 20, 10), c(40, 40, 20), c(80, 80, 40)]), requiere: 2 },
    fundicion: { nombre: 'Fundición', max: NIVEL_MAX, trab: trabProd, produce: 'metal', ritmo: ritmo([6, 12, 18]), gasta: { hierro: 2 }, coste: costes([c(30, 30, 20, 10), c(60, 60, 40, 20), c(120, 120, 80, 40)]), requiere: 3 }
  };
  // Fuerza de los monstruos: 60/150/300/550/900 (nv1–5, sin cambios) y × 1,22 por nivel hasta el 30
  // 0.6 · Monstruos MÁS FUERTES por nivel (encargo de Jose, 11/11/2026), sobre todo desde nv5: 60/160/330/600/1000 y × 1,30 por nivel → nv30 ≈ 706.000 (antes 130.000)
  const fuerzaMonstruo = serie([60, 160, 330, 600, 1000], (n, o) => n <= NIVEL_30 ? redondo(1000 * Math.pow(1.30, n - 5)) : redondo(o[n - 2] * CRECE_ALTO), NIVEL_MAX);   // 0.8: hasta nv50
  // Héroes: el Salón de héroes nv1/2/3 deja subirlos a 4/7/10 (sin cambios); desde nv4, 10 + (nv−3)·20/27 → 30 con el Salón a 30
  const heroeMaxSalon = serie([4, 7, 10], n => 10 + Math.round((n - 3) * 20 / 27), NIVEL_30);
  const HEROE_MAX = 100;   // 0.8: héroes y monstruos capturados hasta nv100
  const xpHeroe = serie([60, 150, 280, 450, 660, 900, 1200, 1550, 1950], (n, o) => n < NIVEL_30 ? redondo(1950 * Math.pow(1.18, n - 9)) : redondo(o[n - 2] * 1.08), HEROE_MAX - 1);
  const fragHeroe = serie([1, 1, 2, 2, 3, 3, 4, 5, 6], n => 6 + Math.ceil((n - 9) / 2), NIVEL_30).slice(0, NIVEL_30 - 1);

  // 0.8 · 50 ciudades enemigas de nv15 a nv50, con más peso en los niveles altos: nivel = 15 + 35·√(i/49) (15, 20, 22 … 48, 49, 50)
  const nivelesCiudad = Array.from({ length: 50 }, (_, i) => 15 + Math.round(35 * Math.sqrt(i / 49)));
  const NOMBRES_CIUDAD = ['Valdeoscuro', 'Peñagrís', 'Torrenegra', 'Castroumbrío', 'Robleseco', 'Villahosca', 'Monteceniza', 'Aguaturbia', 'Cerrocuervo', 'Hondonegra', 'Fuentesombría', 'Lomaferro',
    'Brumaria', 'Piedrahonda', 'Valdecardo', 'Rocaespina', 'Torrelobo', 'Navalcuervo', 'Sierranegra', 'Ventisquero', 'Castrohierro', 'Peñalba', 'Murovelo', 'Ojonegro', 'Fuenteceniza', 'Cardoscuro',
    'Villaespina', 'Montehielo', 'Robleda', 'Aguasmuertas', 'Calavera', 'Torreciega', 'Valdeniebla', 'Puertogrís', 'Cuervalia', 'Hornacho', 'Penumbra', 'Grajera', 'Rocanegra', 'Villabruma',
    'Lomaoscura', 'Castrocardo', 'Ferralia', 'Hondalobo', 'Montesombra', 'Pozonegro', 'Altoceniza', 'Valdeferro', 'Torreumbría', 'Ciénaga Gris', 'Picoespina', 'Navaturbia', 'Riscogrís', 'Villaceniza',
    'Brezal Negro', 'Tajonegro', 'Fuentelobo', 'Morcuera', 'Canturria', 'Sombrerete', 'Garrafal', 'Atalaya Rota'];
  g.CivilikDatos = {
    nivelMax: NIVEL_MAX, nivelMundo: NIVEL_30, curva: { crece: CRECE, creceAlto: CRECE_ALTO, redondo }, civiles,
    // ---------- Edificios nuevos (ocupan un hueco; mínimo 1 persona; nunca se quedan vacíos). Uno de cada.
    // Nombres CONFIRMADOS por Jose (10/11/2026): Academia (investigación), Cuartel (tropas), Salón de héroes y Botica (pociones). Se cambian aquí si hiciera falta. ----------
    edificios: {
      // 0.4: hasta nivel 30 con la curva de arriba (nv1–3 sin cambios)
      academia: { nombre: 'Academia', max: NIVEL_MAX, trab: lineal, coste: costes([c(60, 60, 30), c(120, 120, 60, 20), c(240, 240, 120, 40)]), requiere: 1, unico: true },
      cuartel: { nombre: 'Cuartel', max: NIVEL_MAX, trab: lineal, coste: costes([c(40, 40, 20), c(80, 80, 40, 20), c(160, 160, 80, 40)]), requiere: 1, unico: true },
      // 0.6 · subir el Salón es CARO (el héroe convocado empieza con su nivel): mejoras × 3 desde nv2 (construirlo cuesta lo mismo)
      salon_heroes: { nombre: 'Salón de héroes', max: NIVEL_MAX, trab: lineal, coste: costes([c(60, 40, 40), c(120, 80, 80, 20), c(240, 160, 160, 40)]).map((x, i) => i ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v * 3])) : x), requiere: 1, unico: true },
      botica: { nombre: 'Botica', max: NIVEL_MAX, trab: dosTercios([1, 2, 2]), coste: costes([c(30, 30, 30), c(60, 60, 60, 20), c(120, 120, 120, 40)]), requiere: 1, unico: true },
      // 0.7 · La TIENDA pasa a ser un edificio único (antes era una pestaña). Desde ayuntamiento nv3. Cada nivel abarata un poco (ver «tienda» abajo).
      tienda: { nombre: 'Tienda', max: NIVEL_MAX, trab: dosTercios([1, 1, 2]), coste: costes([c(120, 80, 60), c(240, 160, 120, 20), c(480, 320, 240, 40)]), requiere: 3, unico: true },
      // 0.7 · UNIVERSIDAD: edificio único desde ayuntamiento nv20, con su propio árbol (mejora lo de la Academia con mejores estadísticas). Cara.
      universidad: { nombre: 'Universidad', max: NIVEL_MAX, trab: lineal, coste: costes([{ madera: 40000, piedra: 40000, oro: 30000, hierro: 8000, metal: 800 }]), requiere: 20, unico: true },
      // 0.8 · ESCUELA DE MAESTRÍA: forma a los obreros (ya no salen del Cuartel). Única, desde ayuntamiento nv2. Skins de Camachin escuela_maestria_nNN.
      escuela_maestria: { nombre: 'Escuela de maestría', max: NIVEL_MAX, trab: dosTercios([1, 1, 2]), coste: costes([c(100, 100, 50), c(200, 200, 100, 20), c(400, 400, 200, 40)]), requiere: 2, unico: true }
    },
    // ---------- Tropas (sin tope). Mantenimiento en comida por unidad y minuto jugado. ----------
    clases: { infanteria: 'Infantería', arqueros: 'Arqueros', caballeria: 'Caballería' },
    vence: { infanteria: 'caballeria', caballeria: 'arqueros', arqueros: 'infanteria' },   // piedra-papel-tijera: A vence a B
    ventaja: 1.5, desventaja: 0.67,          // multiplicador de fuerza contra la clase del monstruo
    bajasVentaja: 0.7, bajasDesventaja: 1.3, // las tropas en desventaja caen más
    variedad: { minimo: 0.15, porClase: 0.10 },   // +10 % de fuerza por cada clase extra que aporte ≥ 15 % del ejército (máx. +20 %)
    // Nombres PROVISIONALES (propuesta de Camachin, 2.ª entrega 0.3; pendientes de que Jose los confirme). Dibujo: img/combate/tropas/<clase>_<rango>,
    // con el rango según el nivel del Cuartel (1–9 → 1, 10–19 → 2, 20–30 → 3). Las avanzadas usan el mismo dibujo de su clase (con marca «avanzada»).
    tropas: {
      lancero: { nombre: 'Lancero recluta', clase: 'infanteria', fuerza: 10, coste: { comida: 6, oro: 3 }, mant: 0.3, carga: 60 },
      arquero: { nombre: 'Arquero recluta', clase: 'arqueros', fuerza: 10, coste: { comida: 6, oro: 4 }, mant: 0.3, carga: 50 },
      jinete: { nombre: 'Jinete', clase: 'caballeria', fuerza: 14, coste: { comida: 10, oro: 6 }, mant: 0.5, carga: 80 },
      veterano: { nombre: 'Soldado veterano', clase: 'infanteria', avanzada: 'forja', fuerza: 22, coste: { comida: 10, oro: 6, hierro: 4, metal: 1 }, mant: 0.5, carga: 100 },
      arquero_bosque: { nombre: 'Arquero del bosque', clase: 'arqueros', avanzada: 'arcos', fuerza: 22, coste: { comida: 10, oro: 6, madera: 6, hierro: 3 }, mant: 0.5, carga: 90 },
      caballero: { nombre: 'Caballero', clase: 'caballeria', avanzada: 'herraduras', fuerza: 30, coste: { comida: 16, oro: 10, hierro: 6, metal: 2 }, mant: 0.8, carga: 140 },
      // 0.7 · Tropas de 2 y 3 ESTRELLAS (nombres y números PROVISIONALES): más poder; se desbloquean por NIVEL DEL CUARTEL desde el 25 (no piden Academia).
      // Dibujo: MARCADOR (el de su clase en rango III con estrellas) hasta que Camachin haga tropa_<id>, tropa_<id>_retrato y tropa_<id>_escuadra.
      guardia_real: { nombre: 'Guardia real', clase: 'infanteria', estrellas: 2, cuartel: 25, fuerza: 60, coste: { comida: 30, oro: 20, hierro: 12, metal: 4 }, mant: 1.2, carga: 160 },
      ballestero: { nombre: 'Ballestero de élite', clase: 'arqueros', estrellas: 2, cuartel: 27, fuerza: 60, coste: { comida: 30, oro: 20, madera: 20, hierro: 10, metal: 3 }, mant: 1.2, carga: 140 },
      coracero: { nombre: 'Coracero', clase: 'caballeria', estrellas: 2, cuartel: 29, fuerza: 80, coste: { comida: 45, oro: 30, hierro: 18, metal: 6 }, mant: 1.8, carga: 220 },
      campeon: { nombre: 'Campeón de la corona', clase: 'infanteria', estrellas: 3, cuartel: 35, fuerza: 160, coste: { comida: 80, oro: 60, hierro: 40, metal: 15 }, mant: 3, carga: 260 },
      tirador_rey: { nombre: 'Tirador del rey', clase: 'arqueros', estrellas: 3, cuartel: 40, fuerza: 160, coste: { comida: 80, oro: 60, madera: 50, hierro: 35, metal: 12 }, mant: 3, carga: 230 },
      caballero_dragon: { nombre: 'Caballero dragón', clase: 'caballeria', estrellas: 3, cuartel: 45, fuerza: 220, coste: { comida: 120, oro: 90, hierro: 60, metal: 25 }, mant: 4.5, carga: 360 }
    },
    // 0.8 · OBREROS (Escuela de maestría): no son ejército (sin poder ni manutención), solo cuestan crearlos y solo farmean. Más rápidos que las tropas,
    //       sobre todo a la vuelta: su marcha = la de las tropas × ida / × vuelta. Nombres e ids confirmados por Jose (vía Peaky, 15/11/2026); números PROVISIONALES.
    //       Sustituyen a Peón / Cantero / Maestro de obras de la 0.6 (que eran el mismo «obrero» con el dibujo según el nivel del Cuartel 1–9 / 10–19 / 20+).
    obreros: {
      obrero_basico: { nombre: 'Aprendiz', escuela: 1, coste: { comida: 4, oro: 2 }, carga: 120, ida: 0.7, vuelta: 0.4 },
      obrero_oficial: { nombre: 'Oficial', escuela: 10, coste: { comida: 12, oro: 8, madera: 4 }, carga: 400, ida: 0.6, vuelta: 0.35 },
      obrero_maestro: { nombre: 'Maestro artesano', escuela: 20, coste: { comida: 40, oro: 25, madera: 10, hierro: 5 }, carga: 1200, ida: 0.5, vuelta: 0.3 },
      obrero_gran_maestro: { nombre: 'Gran maestro', escuela: 30, coste: { comida: 120, oro: 80, madera: 30, hierro: 15, metal: 2 }, carga: 3500, ida: 0.4, vuelta: 0.25 }
    },
    // Migración 0.7 → 0.8: el obrero único pasa al tipo que mostraba su dibujo (por el nivel del Cuartel): Peón → Aprendiz, Cantero → Oficial, Maestro de obras → Maestro artesano
    obrerosAntiguos: [[1, 'obrero_basico'], [10, 'obrero_oficial'], [20, 'obrero_maestro']],
    rangos: [[1, 9], [10, 19], [20, 30]],   // rango I / II / III (monstruos por su nivel; tropas por el nivel del Cuartel)
    cuartelAvanzadas: 2,   // nivel del cuartel para entrenar tropas avanzadas (además de investigarlas)
    // ---------- 0.5 · Monstruos del mapa del mundo (Camachin v2, aprobados por Jose: sustituyen a limos, lobos, setones, trasgos y gólems) ----------
    // Dibujo: img/combate/monstruos/<familia>_<rango>_mapa|_retrato (rango por nivel: 1–9 I, 10–19 II, 20–30 III). Mapa: 72 dp (dragón 96).
    // Nivel según la distancia a tu ciudad (más lejos, más fuertes). Clase para el piedra-papel-tijera (2 familias de cada clase).
    monstruos: {
      cantidad: 100, cerca: 6, radioCerca: [5, 12], separacion: 3, libreCapital: 4.5,   // 0.8: mapa 150×150 → 100 monstruos (antes 45)
      // nivel = 1 + (distancia − 5) × 29 / 41 (± 1 al azar), entre 1 y 30 → nv 30 a unas 46 casillas de la ciudad
      nivelPorDistancia: { desde: 5, hasta: 69 },   // 0.8: la escala se estira × 1,5 con el mapa (nv30 a ~69 casillas)
      nivelAzar: 3,                // 0.6 · más variedad: ± 3 niveles al azar sobre el de su distancia (antes ± 1)
      rotacionMin: [10, 15],       // 0.6 · si nadie los ataca, cada monstruo se renueva (otro sitio, tipo y nivel) a los 10–15 min
      tipos: {
        orco: { nombres: ['Orco saqueador', 'Orco guerrero', 'Caudillo orco'], clase: 'infanteria', categoria: 'común', niveles: [1, 30], terreno: 'l' },
        huargo: { nombres: ['Huargo', 'Huargo de guerra', 'Huargo terrible'], clase: 'caballeria', categoria: 'rápido', niveles: [1, 30], terreno: 'b' },
        no_muerto: { nombres: ['Esqueleto', 'Esqueleto guerrero', 'Caballero espectral'], clase: 'arqueros', categoria: 'común', niveles: [1, 30], terreno: null },
        troll: { nombres: ['Troll de las colinas', 'Troll de piedra', 'Troll de guerra'], clase: 'infanteria', categoria: 'fuerte', niveles: [3, 30], terreno: 'p' },
        grifo: { nombres: ['Grifo joven', 'Grifo de guerra', 'Grifo real'], clase: 'caballeria', categoria: 'fuerte', niveles: [4, 30], terreno: 'm' },
        dragon: { nombres: ['Dragón joven', 'Dragón de fuego', 'Dragón ancestral'], clase: 'arqueros', categoria: 'jefe', niveles: [6, 30], jefe: true, terreno: null },
        // 0.6 · familias nuevas de Camachin (NOMBRES PROVISIONALES, pendientes de OK de Jose). No tienen héroe convocable: sueltan fragmentos COMUNES.
        arana: { nombres: ['Araña del bosque', 'Araña tejedora', 'Reina araña'], clase: 'arqueros', categoria: 'emboscada', niveles: [1, 30], terreno: 'b', sinHeroe: true },
        saurio: { nombres: ['Saurio cazador', 'Saurio guerrero', 'Chamán saurio'], clase: 'caballeria', categoria: 'rápido', niveles: [2, 30], terreno: 'a', sinHeroe: true },
        minotauro: { nombres: ['Minotauro joven', 'Minotauro guerrero', 'Señor del laberinto'], clase: 'infanteria', categoria: 'fuerte', niveles: [5, 30], terreno: 'p', sinHeroe: true }
      },
      // Partidas antiguas: cada tipo retirado pasa a la familia nueva de su misma clase (solo afecta a fragmentos y estadísticas; los monstruos se recolocan)
      antiguos: { limo: 'no_muerto', seton: 'no_muerto', lobo: 'huargo', trasgo: 'orco', golem: 'troll', dragon: 'dragon' },
      fuerza: fuerzaMonstruo,                              // por nivel 1–30 (1–5 sin cambios; se ve antes de atacar)
      botin: { comida: 0.6, madera: 0.4, piedra: 0.3, oro: 0.5, hierro: 0.15 },   // × fuerza del monstruo, al ganar
      fragmento: { base: 0.08, porNivel: 0.015, max: 0.5 }, // 0.5: 1 fragmento DE SU FAMILIA: 9,5 % (nv1) … 23 % (nv10) … 38 % (nv20) … tope 50 % (nv28+)
      pocion: { pequena: 0.20, mediana: 0.08, grande: 0.03 }   // probabilidad de que caiga cada poción
    },
    // ---------- 0.8 · MONSTRUOS LEGENDARIOS (diseños de Camachin, diseno/0.8): solo nv31–50, lejos de tu ciudad. Rango legendario en amatista #7B4FC9 (provisional).
    // Combate en 6 turnos teóricos (provisional): las habilidades se aplican como multiplicadores de fuerza y se cuentan en el informe.
    legendarios: {
      cantidad: 6, distanciaMin: 55, niveles: [31, 50], fuerza: 1.5, turnos: 6, color: '#7B4FC9',
      tipos: {
        fenix: { nombre: 'Ígnea Fénix', clase: 'arqueros', terreno: 'm', habilidad: 'Renace una vez con el 50 % de su vida', efecto: { renace: 0.5 } },
        kraken: { nombre: 'Zhaal Kraken', clase: 'caballeria', terreno: 'a', habilidad: 'Inmoviliza 2 turnos la escuadra enemiga más fuerte', efecto: { inmoviliza: 2 } },
        hidra: { nombre: 'Hidra', clase: 'infanteria', terreno: 'b', habilidad: 'Muerde a 3 escuadras y las envenena', efecto: { veneno: 0.15, bajas: 0.15 } },
        titan: { nombre: 'Hrimnir Titán', clase: 'infanteria', terreno: 'p', habilidad: 'Los enemigos actúan los últimos 2 turnos y tiene un escudo del 20 %', efecto: { ultimos: 2, escudo: 0.2 } }
      }
    },
    // ---------- 0.8 · CAPTURAR MONSTRUOS: al vencer a uno se elige derrotarlo o capturarlo; capturarlo multiplica las bajas normales × 2–5 (azar con semilla).
    // El capturado es un héroe: no muere, se cura y tiene habilidades propias de su familia. Sube hasta nv100 (empieza con el nivel del monstruo).
    captura: { factor: [2, 5], maxPendientes: 5, poder: { base: 40, porNivel: 20 }, poderLegendario: { base: 80, porNivel: 35 },
      habilidades: {   // por familia (PROVISIONAL)
        orco: [{ id: 'c_furia', nombre: 'Furia orca', nivel: 1, poder: 0.4, porNivel: 0.05 }, { id: 'c_saqueo', nombre: 'Saqueador', nivel: 10, botin: 0.10, porNivel: 0.01 }],
        huargo: [{ id: 'c_jauria', nombre: 'Jauría', nivel: 1, clase: 'caballeria', fuerza: 0.12, porNivel: 0.02 }, { id: 'c_olfato', nombre: 'Olfato', nivel: 10, botin: 0.08, porNivel: 0.01 }],
        no_muerto: [{ id: 'c_dolor', nombre: 'Sin dolor', nivel: 1, bajas: -0.10, porNivel: -0.01 }, { id: 'c_miedo', nombre: 'Miedo', nivel: 10, todas: 0.04, porNivel: 0.005 }],
        troll: [{ id: 'c_piel', nombre: 'Piel dura', nivel: 1, bajas: -0.12, porNivel: -0.01 }, { id: 'c_regenera', nombre: 'Regenera', nivel: 10, heridas: -0.20, porNivel: -0.02 }],
        grifo: [{ id: 'c_picado', nombre: 'Picado', nivel: 1, clase: 'arqueros', fuerza: 0.12, porNivel: 0.02 }, { id: 'c_vista', nombre: 'Vista de águila', nivel: 10, todas: 0.04, porNivel: 0.005 }],
        dragon: [{ id: 'c_aliento', nombre: 'Aliento', nivel: 1, todas: 0.08, porNivel: 0.01 }, { id: 'c_escamas', nombre: 'Escamas', nivel: 10, bajas: -0.10, porNivel: -0.01 }],
        arana: [{ id: 'c_tela', nombre: 'Telaraña', nivel: 1, todas: 0.05, porNivel: 0.01 }, { id: 'c_veneno', nombre: 'Veneno', nivel: 10, poder: 0.3, porNivel: 0.04 }],
        saurio: [{ id: 'c_embestida', nombre: 'Embestida', nivel: 1, clase: 'caballeria', fuerza: 0.12, porNivel: 0.02 }, { id: 'c_caza', nombre: 'Cazador', nivel: 10, botin: 0.08, porNivel: 0.01 }],
        minotauro: [{ id: 'c_cornada', nombre: 'Cornada', nivel: 1, clase: 'infanteria', fuerza: 0.12, porNivel: 0.02 }, { id: 'c_laberinto', nombre: 'Laberinto', nivel: 10, bajas: -0.08, porNivel: -0.01 }],
        fenix: [{ id: 'l_renacer', nombre: 'Renacer', nivel: 1, todas: 0.10, porNivel: 0.01 }],
        kraken: [{ id: 'l_abismo', nombre: 'Abismo', nivel: 1, todas: 0.10, porNivel: 0.01 }],
        hidra: [{ id: 'l_mordisco', nombre: 'Mordisco triple', nivel: 1, todas: 0.10, porNivel: 0.01 }],
        titan: [{ id: 'l_hielo', nombre: 'Hielo eterno', nivel: 1, todas: 0.10, porNivel: 0.01 }]
      } },
    // ---------- 0.5 · Fragmentos y héroes convocables (uno por familia de monstruo) ----------
    convocar: { fragmentos: 10 },   // con 10 fragmentos de una familia se convoca su héroe (requiere Salón de héroes)
    // ---------- 0.5 · Mapa del mundo ----------
    mundo: { lado: 150, casilla: 48 },   // 0.8: 150×150 casillas de 48 dp (7200 dp); terreno generado con la semilla; la ciudad en el centro
    // Ciudades enemigas fijas (no atacan; sin murallas ni defensas). Nombres PROVISIONALES. Dibujo: img/mundo/ciudad_enemiga_<1|2|3> por rango del nivel.
    ciudades: {
      // 0.8: 50 ciudades (nv15–50); su distancia a tu ciudad crece con el nivel (de ~16 a ~70 casillas). Nombres PROVISIONALES (62: sobran para las conquistadas de la 0.7).
      nombres: NOMBRES_CIUDAD, niveles: nivelesCiudad, separacion: 6, distanciaMin: 16, distanciaMax: 70,
      fuerza: 1.6,                 // × la fuerza de un monstruo de su nivel (ejército mixto: sin ventaja de clase)
      recuperaMin: 20,             // tras saquearla, se recupera en 20 min jugados (mientras, no se puede atacar)
      botin: { comida: 1.0, madera: 0.8, piedra: 0.6, oro: 1.0, hierro: 0.3, metal: 0.05 },   // × su fuerza, al ganar
      fragmentoComun: { base: 0.3, porNivel: 0.01 },   // 1 fragmento común (sirve para subir de nivel a los héroes clásicos desde nv20)
      cofres: { cofre_p: 0.3, cofre_m: 0.1, cofre_g: 0.03 }
    },
    // Zonas de farmeo: mandas tropas a recoger un recurso durante un tiempo (jugado). Dibujo: img/mundo/zona_farmeo_<recurso>.
    // 0.8 · FARMEO NUEVO (PROVISIONAL): menos zonas, sin nivel, sin guardia y sin agotarse; solo van obreros. La producción por minuto NO depende de cuántos vayan:
    //   ritmo(t) = base × (1 + 0,15 × (Escuela − 1)) × (1 + bonos) × mín(4, 1 + t/30)  → se multiplica cuanto más tiempo están (×2 a los 30 min, tope ×4 a los 90).
    //   Lo recogido tiene el tope de la carga de los obreros; si se llenan antes, vuelven antes. El botón «Auto» elige los obreros justos para esa carga.
    zonas: {
      cantidad: 12, separacion: 6, distanciaMin: 6, distanciaMax: 45,
      // 0.9 (Jose): «mucho más por minuto, pero limitado por la carga real de los obreros» → ritmos × 10 (PROVISIONAL); lo que traen sigue con el tope de su carga
      recursos: { comida: { nombre: 'Campos', ritmo: 200, terreno: 'l' }, madera: { nombre: 'Bosque talable', ritmo: 150, terreno: 'b' }, piedra: { nombre: 'Cantera', ritmo: 150, terreno: 'p' },
        oro: { nombre: 'Mina de oro', ritmo: 100, terreno: 'm' }, hierro: { nombre: 'Veta de hierro', ritmo: 40, terreno: 'm' } },
      crece: { cadaMin: 30, tope: 4 }, porEscuela: 0.15,
      duraciones: [15, 30, 60, 120, 240]          // minutos jugados trabajando (más la marcha de ida y vuelta)
    },
    // Objetos del inventario (caen al saquear ciudades). Dibujo PROVISIONAL: img/militar/objeto_cofre_<1|2|3>.
    objetos: {
      cofre_p: { nombre: 'Cofre pequeño', icono: 'objeto_cofre_1', recursos: { comida: 500, madera: 400, piedra: 400, oro: 300 } },
      cofre_m: { nombre: 'Cofre mediano', icono: 'objeto_cofre_2', recursos: { comida: 2000, madera: 1600, piedra: 1600, oro: 1200, hierro: 300 } },
      cofre_g: { nombre: 'Cofre grande', icono: 'objeto_cofre_3', recursos: { comida: 8000, madera: 6400, piedra: 6400, oro: 4800, hierro: 1200, metal: 150 } },
      // 0.8 · COFRES DE TIENDA (dibujo de Camachin cofre_tienda_*): recursos + fragmentos de monstruo (de familias al azar) y comunes (de héroe). Contenido y precio PROVISIONALES.
      ct_mediano: { nombre: 'Cofre mediano', icono: 'cofre_tienda_mediano', tienda: true, precio: 30000, recursos: { comida: 5000, madera: 4000, piedra: 4000, oro: 3000, hierro: 800 }, fragmentos: { comunes: 2, familia: 1 } },
      ct_grande: { nombre: 'Cofre grande de la tienda', icono: 'cofre_tienda_grande', tienda: true, precio: 120000, recursos: { comida: 20000, madera: 16000, piedra: 16000, oro: 12000, hierro: 3200, metal: 300 }, fragmentos: { comunes: 5, familia: 3 } },
      ct_epico: { nombre: 'Cofre épico', icono: 'cofre_tienda_epico', tienda: true, precio: 450000, recursos: { comida: 80000, madera: 64000, piedra: 64000, oro: 48000, hierro: 12800, metal: 1200 }, fragmentos: { comunes: 12, familia: 8 } },
      ct_legendario: { nombre: 'Cofre legendario', icono: 'cofre_tienda_legendario', tienda: true, precio: 1600000, recursos: { comida: 320000, madera: 256000, piedra: 256000, oro: 192000, hierro: 51200, metal: 4800 }, fragmentos: { comunes: 30, familia: 20 } }
    },
    // Misiones sencillas con premio (se cobran una vez). tipo: edificio (nivel de un edificio), personas, tropas, victorias, saqueos, recolecciones, habilidades, convocados, heroe (nivel)
    misiones: [
      { id: 'casa1', texto: 'Construye una casa', tipo: 'edificio', edificio: 'casa', meta: 1, premio: { madera: 60, piedra: 40, oro: 20 } },
      { id: 'granja3', texto: 'Sube la granja a nivel 3', tipo: 'edificio', edificio: 'granja', meta: 3, premio: { comida: 200, madera: 100 } },
      { id: 'ayto3', texto: 'Sube el ayuntamiento a nivel 3', tipo: 'edificio', edificio: 'ayuntamiento', meta: 3, premio: { madera: 300, piedra: 300, oro: 150 } },
      { id: 'cuartel1', texto: 'Construye un Cuartel', tipo: 'edificio', edificio: 'cuartel', meta: 1, premio: { comida: 150, oro: 100 } },
      { id: 'tropas20', texto: 'Ten 20 tropas', tipo: 'tropas', meta: 20, premio: { comida: 300, oro: 200 } },
      { id: 'victoria1', texto: 'Derrota a un monstruo', tipo: 'victorias', meta: 1, premio: { comida: 200, oro: 150 } },
      { id: 'granja5', texto: 'Sube la granja a nivel 5', tipo: 'edificio', edificio: 'granja', meta: 5, premio: { comida: 400, oro: 200 } },
      { id: 'personas50', texto: 'Llega a 50 personas', tipo: 'personas', meta: 50, premio: { madera: 500, piedra: 500 } },
      { id: 'academia1', texto: 'Aprende una habilidad en la Academia', tipo: 'habilidades', meta: 1, premio: { oro: 300, hierro: 50 } },
      { id: 'recoger1', texto: 'Completa una recolección en el mapa', tipo: 'recolecciones', meta: 1, premio: { comida: 300, madera: 300 } },
      { id: 'saqueo1', texto: 'Saquea una ciudad enemiga', tipo: 'saqueos', meta: 1, premio: { oro: 600, hierro: 100 } },
      { id: 'ayto5', texto: 'Sube el ayuntamiento a nivel 5', tipo: 'edificio', edificio: 'ayuntamiento', meta: 5, premio: { madera: 800, piedra: 800, oro: 400, hierro: 100 } },
      { id: 'victoria10', texto: 'Derrota a 10 monstruos', tipo: 'victorias', meta: 10, premio: { comida: 1000, oro: 800, hierro: 150 } },
      { id: 'heroe5', texto: 'Sube un héroe a nivel 5', tipo: 'heroe', meta: 5, premio: { comida: 800, oro: 600 } },
      { id: 'convocar1', texto: 'Convoca un héroe con 10 fragmentos', tipo: 'convocados', meta: 1, premio: { oro: 1500, metal: 30 } },
      { id: 'ayto10', texto: 'Sube el ayuntamiento a nivel 10', tipo: 'edificio', edificio: 'ayuntamiento', meta: 10, premio: { madera: 4000, piedra: 4000, oro: 2000, hierro: 600, metal: 80 } },
      { id: 'heroe20', texto: 'Sube un héroe a nivel 20', tipo: 'heroe', meta: 20, premio: { oro: 10000, hierro: 2000, metal: 300 } },
      { id: 'ayto20', texto: 'Sube el ayuntamiento a nivel 20', tipo: 'edificio', edificio: 'ayuntamiento', meta: 20, premio: { madera: 30000, piedra: 30000, oro: 15000, hierro: 5000, metal: 800 } },
      { id: 'ayto30', texto: 'Sube el ayuntamiento a nivel 30', tipo: 'edificio', edificio: 'ayuntamiento', meta: 30, premio: { madera: 200000, piedra: 200000, oro: 100000, hierro: 40000, metal: 6000 } },
      // 0.6
      { id: 'muralla1', texto: 'Construye la muralla', tipo: 'muralla', meta: 1, premio: { piedra: 40000, oro: 20000, hierro: 5000 } },
      { id: 'conquista1', texto: 'Conquista una ciudad enemiga', tipo: 'conquistas', meta: 1, premio: { madera: 100000, piedra: 100000, oro: 60000, hierro: 20000, metal: 2000 } },
      // 0.8 · Misión GRANDE: conquistar las 50 ciudades enemigas (sustituye a la de las 12; las conquistadas en la 0.7 no cuentan). Premio × 10 (provisional).
      { id: 'todos50', grande: true, texto: 'Conquista las 50 ciudades enemigas', tipo: 'conquistas50', meta: 50, premio: { comida: 20000000, madera: 20000000, piedra: 20000000, oro: 10000000, hierro: 4000000, metal: 600000 } }
    ],
    combate: {
      azar: [0.9, 1.1],                 // la fuerza propia se multiplica por un azar (con semilla) en este rango
      bajasVictoria: 0.6,               // fracción perdida al ganar = 0,6 × (fuerza monstruo / fuerza propia)²
      bajasDerrota: [0.6, 1.0],         // al perder: de 60 % a 100 % según lo lejos que se quedara
      heridaVictoriaProb: 0.2, heridaVictoriaMin: 5, heridaDerrotaMin: 15,   // (0.3–0.5) héroes: nunca se pierden
      heridaMinPorNivel: 2.5,           // 0.6 · herido: 2,5 min de recuperación por nivel del héroe (nv10 = 25 min); al ganar sigue habiendo un 20 % de quedar herido
      xpVictoria: 0.25, xpDerrota: 0.10 // experiencia = fuerza del monstruo × factor, para cada héroe que va
    },
    // ---------- Héroes (sin tope; tipos repetibles). Mantenimiento en comida por minuto jugado. ----------
    heroes: {
      // Tipos de Camachin (nombres PROVISIONALES). Dibujo: img/combate/heroes/heroe_<tipo>_mapa y _retrato_<bronce|plata|oro> (marco por nivel: 1–10, 11–20, 21–30).
      tipos: {
        paladina: { nombre: 'Paladina', papel: 'Defensa · protege a la infantería', clase: 'infanteria', nombres: ['Elvira', 'Urraca', 'Jimena', 'Berenguela', 'Sancha', 'Toda'],
          habilidades: [{ id: 'muro', nombre: 'Muro de escudos', nivel: 1, clase: 'infanteria', fuerza: 0.15, porNivel: 0.03 },
            { id: 'egida', nombre: 'Égida', nivel: 3, bajas: -0.10, porNivel: -0.02 }, { id: 'baluarte', nombre: 'Baluarte', nivel: 6, todas: 0.05, porNivel: 0.01 }] },
        montaraz: { nombre: 'Montaraz', papel: 'Distancia · mejora a los arqueros', clase: 'arqueros', nombres: ['Álvar', 'Nuño', 'Mencía', 'Pelayo', 'Aldonza', 'Fruela'],
          habilidades: [{ id: 'tiro', nombre: 'Tiro certero', nivel: 1, clase: 'arqueros', fuerza: 0.15, porNivel: 0.03 },
            { id: 'rastreo', nombre: 'Rastreo', nivel: 3, botin: 0.10, porNivel: 0.02 }, { id: 'lluvia', nombre: 'Lluvia de flechas', nivel: 6, todas: 0.06, porNivel: 0.01 }] },
        hechicera: { nombre: 'Hechicera', papel: 'Magia · daño en área', clase: null, nombres: ['Oria', 'Leonor', 'Elo', 'Mafalda', 'Sol', 'Teresa'],
          habilidades: [{ id: 'bola', nombre: 'Bola de fuego', nivel: 1, todas: 0.08, porNivel: 0.015 },
            { id: 'runas', nombre: 'Runas', nivel: 3, poder: 0.25, porNivel: 0.05 }, { id: 'tormenta', nombre: 'Tormenta arcana', nivel: 6, todas: 0.06, porNivel: 0.01 }] },
        barbaro: { nombre: 'Bárbaro', papel: 'Ataque · golpe fuerte cuerpo a cuerpo', clase: 'caballeria', nombres: ['Gonzalo', 'Sancho', 'Fernán', 'Diego', 'Ordoño', 'Martín'],
          habilidades: [{ id: 'golpe', nombre: 'Golpe brutal', nivel: 1, poder: 0.40, porNivel: 0.08 },
            { id: 'carga', nombre: 'Carga', nivel: 3, clase: 'caballeria', fuerza: 0.15, porNivel: 0.03 }, { id: 'furia', nombre: 'Furia', nivel: 6, todas: 0.05, porNivel: 0.01 }] },
        alquimista: { nombre: 'Alquimista', papel: 'Apoyo · cura heridos y potencia pociones', clase: null, nombres: ['Inés', 'Bermudo', 'Gelmírez', 'Mayor', 'Velasco', 'Onneca'],
          habilidades: [{ id: 'auxilios', nombre: 'Primeros auxilios', nivel: 1, bajas: -0.15, porNivel: -0.02 },
            { id: 'vendas', nombre: 'Vendas limpias', nivel: 3, heridas: -0.20, porNivel: -0.03 }, { id: 'destilar', nombre: 'Destilación', nivel: 6, pociones: 0.25, porNivel: 0.05 }] },
        // 0.5 · Héroes CONVOCABLES (10 fragmentos de su familia), con sus propias habilidades. Nombres APROBADOS por Jose (10/11/2026); habilidades y números provisionales.
        // Dibujo de Camachin 0.5: img/combate/heroes/heroe_<familia> (marco bronce nv 1–10), _plata (11–20), _oro (21–30), _mapa (60 dp).
        orco: { nombre: 'Héroe orco', familia: 'orco', papel: 'Ataque · golpea y rompe defensas', clase: 'infanteria', poder: { base: 30, porNivel: 15 }, nombres: ['Gorrak Rompeescudos'],
          habilidades: [{ id: 'rompe', nombre: 'Rompeescudos', nivel: 1, poder: 0.50, porNivel: 0.08 },
            { id: 'grito', nombre: 'Grito de guerra', nivel: 5, clase: 'infanteria', fuerza: 0.15, porNivel: 0.03 }, { id: 'saqueo', nombre: 'Saqueo', nivel: 10, botin: 0.15, porNivel: 0.02 }] },
        huargo: { nombre: 'Héroe huargo', familia: 'huargo', papel: 'Rapidez · acelera a la caballería', clase: 'caballeria', poder: { base: 30, porNivel: 15 }, nombres: ['Kaela de los Huargos'],
          habilidades: [{ id: 'acoso', nombre: 'Acoso', nivel: 1, clase: 'caballeria', fuerza: 0.18, porNivel: 0.03 },
            { id: 'rastro', nombre: 'Rastro nocturno', nivel: 5, botin: 0.10, porNivel: 0.02 }, { id: 'manada', nombre: 'Manada', nivel: 10, variedad: 0.5, porNivel: 0.05 }] },
        no_muerto: { nombre: 'Héroe no-muerto', familia: 'no_muerto', papel: 'Resistencia · reduce las bajas', clase: null, poder: { base: 30, porNivel: 15 }, nombres: ['Sir Ósmund el Espectral'],
          habilidades: [{ id: 'levantar', nombre: 'Levantar a los caídos', nivel: 1, bajas: -0.15, porNivel: -0.02 },
            { id: 'espectral', nombre: 'Guardia espectral', nivel: 5, heridas: -0.20, porNivel: -0.03 }, { id: 'terror', nombre: 'Terror', nivel: 10, todas: 0.06, porNivel: 0.01 }] },
        troll: { nombre: 'Héroe troll', familia: 'troll', papel: 'Defensa · aguanta golpes fuertes', clase: 'infanteria', poder: { base: 40, porNivel: 18 }, nombres: ['Brugo Guardapuentes'],
          habilidades: [{ id: 'piel', nombre: 'Piel de piedra', nivel: 1, bajas: -0.12, porNivel: -0.02 },
            { id: 'puente', nombre: 'Guardapuentes', nivel: 5, clase: 'infanteria', fuerza: 0.15, porNivel: 0.03 }, { id: 'regenera', nombre: 'Regeneración', nivel: 10, heridas: -0.25, porNivel: -0.03 }] },
        grifo: { nombre: 'Héroe grifo', familia: 'grifo', papel: 'Distancia · mejora a los arqueros', clase: 'arqueros', poder: { base: 35, porNivel: 16 }, nombres: ['Aleria Alagrifo'],
          habilidades: [{ id: 'picado', nombre: 'Picado', nivel: 1, clase: 'arqueros', fuerza: 0.18, porNivel: 0.03 },
            { id: 'vista', nombre: 'Vista de águila', nivel: 5, todas: 0.05, porNivel: 0.01 }, { id: 'vuelo', nombre: 'Vuelo rápido', nivel: 10, botin: 0.12, porNivel: 0.02 }] },
        dragon: { nombre: 'Héroe dragón', familia: 'dragon', papel: 'Magia de fuego · daño en área', clase: null, poder: { base: 50, porNivel: 22 }, nombres: ['Ignara Escamadorada'],
          habilidades: [{ id: 'aliento', nombre: 'Aliento de fuego', nivel: 1, todas: 0.10, porNivel: 0.015 },
            { id: 'escamas', nombre: 'Escamas doradas', nivel: 5, bajas: -0.15, porNivel: -0.02 }, { id: 'furia_draco', nombre: 'Furia dracónica', nivel: 10, poder: 0.60, porNivel: 0.10 }] }
      },
      criables: ['paladina', 'montaraz', 'hechicera', 'barbaro', 'alquimista'],   // los que salen al criar (al azar) o al elegir el inicial
      marcos: [[1, 10, 'bronce'], [11, 20, 'plata'], [21, HEROE_MAX, 'oro']],   // 0.8: del 31 al 100 sigue el marco de oro
      poder: { base: 20, porNivel: 12 },            // fuerza propia del héroe en el combate
      nivelMax: HEROE_MAX, nivelMaxPorSalon: heroeMaxSalon,   // 0.8: hasta nv100   // (0.4; desde la 0.5 el Salón ya NO limita el nivel: suben solos con la experiencia)
      // 0.5 · Suben de nivel SOLOS al ganar la experiencia (sin recursos). Para pasar de n a n+1 (índice n-1): experiencia (× 1,18 por nivel desde el 10)
      // y, a partir del nivel 20, también fragmentos: 2 + (n − 20) (héroes clásicos: fragmentos comunes; convocados: de su familia o comunes)
      xp: xpHeroe,
      fragmentos: xpHeroe.map((_, i) => { const n = i + 1; return n < 20 ? 0 : n <= NIVEL_30 ? 2 + (n - 20) : 12 + 2 * Math.floor((n - NIVEL_30) / 10); }),   // 0.8: desde el 30, 12 + 2 por decena
      fragmentosDesde: 20,
      coste: () => ({}),
      mant: { base: 2, porNivel: 1 },               // comida/min = 2 + nivel
      criar: { comida: 150, oro: 120, factor: 0.5 },   // × (1 + 0,5 × héroes que ya tienes)
      despedir: { recursos: 0.5, fragmentos: 0.5 }, // se recupera la mitad de lo gastado en criarlo y subirlo
      inactividadMin: 10, plazoEleccionMin: 1       // si falta comida: el jugador elige en 1 min jugado; si no, elige el juego
    },
    // ---------- Pociones (inventario común sin tope; se fabrican al instante en la botica tras investigarlas) ----------
    // Dibujo: img/combate/pociones/pocion_vida_<p|m|g> («Poción de vida» de Camachin; nombres PROVISIONALES). Efecto del ALCANCE DE JOSE:
    // acortan la herida o la inactividad de un héroe un tiempo fijo; si queda menos, curan del todo. (Los otros 7 tipos de Camachin no se usan: ver ESTADO.md.)
    // 0.6 · POCIONES (todas provisionales): bastante más caras; se desbloquean por NIVEL DE LA BOTICA (ya no por la Academia).
    // Curación (pequeña/mediana/grande) 1/11/21 · velocidad 3/13/23 · fuerza 5/15/25 · farmeo 7/17/27 (niveles 9/19/29/30 libres).
    // Las de curación acortan la herida o la inactividad de un héroe; las demás dan un efecto a toda la partida durante 5/15/30 min (usar otra igual o mejor lo renueva).
    // Dibujo de Camachin (0.6): pocion_vida_* (0.3, curación), pocion_movimiento_* (velocidad), pocion_furia_* (fuerza), pocion_farmeo_*.
    pociones: {
      pequena: { nombre: 'Poción de vida pequeña', icono: 'pocion_vida_p', tipo: 'curacion', minutos: 5, coste: { comida: 240, madera: 80, oro: 160 }, botica: 1 },   // 0.8: pequeñas × 2
      mediana: { nombre: 'Poción de vida mediana', icono: 'pocion_vida_m', tipo: 'curacion', minutos: 12, coste: { comida: 2400, oro: 1800, hierro: 240 }, botica: 11 },
      grande: { nombre: 'Poción de vida grande', icono: 'pocion_vida_g', tipo: 'curacion', minutos: 25, coste: { comida: 24000, oro: 18000, hierro: 2400, metal: 300 }, botica: 21 },
      velocidad_p: { nombre: 'Poción de velocidad pequeña', icono: 'pocion_movimiento_p', tipo: 'efecto', efecto: 'velocidad', pct: 0.20, duracion: 5, coste: { comida: 400, oro: 300 }, botica: 3 },
      velocidad_m: { nombre: 'Poción de velocidad mediana', icono: 'pocion_movimiento_m', tipo: 'efecto', efecto: 'velocidad', pct: 0.35, duracion: 15, coste: { comida: 4000, oro: 3000, hierro: 400 }, botica: 13 },
      velocidad_g: { nombre: 'Poción de velocidad grande', icono: 'pocion_movimiento_g', tipo: 'efecto', efecto: 'velocidad', pct: 0.50, duracion: 30, coste: { comida: 40000, oro: 30000, hierro: 4000, metal: 500 }, botica: 23 },
      fuerza_p: { nombre: 'Poción de fuerza pequeña', icono: 'pocion_furia_p', tipo: 'efecto', efecto: 'fuerza', pct: 0.05, duracion: 5, coste: { comida: 600, oro: 500, hierro: 40 }, botica: 5 },
      fuerza_m: { nombre: 'Poción de fuerza mediana', icono: 'pocion_furia_m', tipo: 'efecto', efecto: 'fuerza', pct: 0.10, duracion: 15, coste: { comida: 6000, oro: 5000, hierro: 600 }, botica: 15 },
      fuerza_g: { nombre: 'Poción de fuerza grande', icono: 'pocion_furia_g', tipo: 'efecto', efecto: 'fuerza', pct: 0.15, duracion: 30, coste: { comida: 60000, oro: 50000, hierro: 6000, metal: 800 }, botica: 25 },
      // 0.8 · «farmeo rápido» (la misma de la 0.6, iconos nuevos de Camachin): además se puede usar sobre un farmeo en curso (recorta su trabajo restante en su %)
      farmeo_p: { nombre: 'Poción de farmeo rápido pequeña', icono: 'pocion_farmeo_rapido_p', tipo: 'efecto', efecto: 'farmeo', pct: 0.15, duracion: 5, coste: { comida: 500, madera: 400, oro: 400 }, botica: 7 },
      farmeo_m: { nombre: 'Poción de farmeo rápido mediana', icono: 'pocion_farmeo_rapido_m', tipo: 'efecto', efecto: 'farmeo', pct: 0.30, duracion: 15, coste: { comida: 5000, madera: 4000, oro: 4000, hierro: 500 }, botica: 17 },
      farmeo_g: { nombre: 'Poción de farmeo rápido grande', icono: 'pocion_farmeo_rapido_g', tipo: 'efecto', efecto: 'farmeo', pct: 0.50, duracion: 30, coste: { comida: 50000, madera: 40000, oro: 40000, hierro: 5000, metal: 600 }, botica: 27 },
      // 0.8 · ENFRIAMIENTO (solo el jugador; los enemigos no usan pociones): recorta la espera que queda para lanzar otro asedio. Botica 9/19/29.
      // 0.9 (Jose): pequeña −3 min fijos, mediana −30 %, grande −100 % (al instante)
      enfriamiento_p: { nombre: 'Poción de enfriamiento pequeña', icono: 'pocion_enfriamiento_p', tipo: 'enfriamiento', menosMin: 3, coste: { comida: 1000, oro: 800, hierro: 100 }, botica: 9 },
      enfriamiento_m: { nombre: 'Poción de enfriamiento mediana', icono: 'pocion_enfriamiento_m', tipo: 'enfriamiento', pct: 0.30, coste: { comida: 8000, oro: 6000, hierro: 800 }, botica: 19 },
      enfriamiento_g: { nombre: 'Poción de enfriamiento grande', icono: 'pocion_enfriamiento_g', tipo: 'enfriamiento', pct: 1, coste: { comida: 60000, oro: 45000, hierro: 6000, metal: 800 }, botica: 29 }
    },
    // ---------- 0.5 · Academia: árbol de habilidades por ramas ----------
    // Cada habilidad tiene varios niveles; para aprender una hay que tener la anterior (requiere) al menos a nivel 1.
    // Nivel k de una habilidad: coste = coste × 1,8^(k−1); pide Academia nivel = academia + 3·(k−1). Instantáneo si hay recursos.
    // efecto (por nivel): fuerza (todo el ejército), clase+fuerzaClase, bajas, heridas, pociones (+ minutos), produce (recurso → %), recoger (farmeo), xp, poderHeroes.
    academia: {
      ramas: [{ id: 'ejercito', nombre: 'Ejército' }, { id: 'alquimia', nombre: 'Alquimia' }, { id: 'economia', nombre: 'Economía' }, { id: 'heroes', nombre: 'Héroes' }],
      crece: 1.8, academiaPorNivel: 3,
      habilidades: [
        { id: 'instruccion', rama: 'ejercito', nombre: 'Instrucción', niveles: 5, efecto: { fuerza: 0.025 }, coste: { comida: 200, oro: 200 }, academia: 1, requiere: null },
        { id: 'forja', rama: 'ejercito', nombre: 'Forja de espadas', niveles: 3, desbloquea: 'veterano', efecto: { clase: 'infanteria', fuerzaClase: 0.05 }, coste: { oro: 100, hierro: 40 }, academia: 1, requiere: 'instruccion' },
        { id: 'arcos', rama: 'ejercito', nombre: 'Arcos largos', niveles: 3, desbloquea: 'arquero_bosque', efecto: { clase: 'arqueros', fuerzaClase: 0.05 }, coste: { madera: 120, oro: 100, hierro: 30 }, academia: 1, requiere: 'instruccion' },
        { id: 'herraduras', rama: 'ejercito', nombre: 'Herraduras', niveles: 3, desbloquea: 'caballero', efecto: { clase: 'caballeria', fuerzaClase: 0.05 }, coste: { oro: 150, hierro: 60, metal: 10 }, academia: 2, requiere: 'instruccion' },
        { id: 'estrategia', rama: 'ejercito', nombre: 'Estrategia', niveles: 5, efecto: { bajas: -0.04 }, coste: { comida: 400, oro: 400, hierro: 80 }, academia: 4, requiere: 'forja' },
        { id: 'herboristeria', rama: 'alquimia', nombre: 'Herboristería', niveles: 3, efecto: { pociones: 0.05 }, coste: { madera: 60, oro: 60 }, academia: 1, requiere: null },
        { id: 'alquimia', rama: 'alquimia', nombre: 'Alquimia', niveles: 3, efecto: { pociones: 0.05 }, coste: { oro: 150, hierro: 40, metal: 10 }, academia: 2, requiere: 'herboristeria' },
        { id: 'elixires', rama: 'alquimia', nombre: 'Elixires', niveles: 3, efecto: { pociones: 0.05 }, coste: { comida: 200, oro: 200, hierro: 40, metal: 15 }, academia: 3, requiere: 'alquimia' },
        { id: 'medicina', rama: 'alquimia', nombre: 'Medicina de campaña', niveles: 5, efecto: { heridas: -0.06 }, coste: { comida: 150, oro: 150, metal: 10 }, academia: 3, requiere: 'herboristeria' },
        { id: 'agricultura', rama: 'economia', nombre: 'Agricultura', niveles: 5, efecto: { produce: 'comida', pct: 0.04 }, coste: { madera: 150, oro: 100 }, academia: 1, requiere: null },
        { id: 'carpinteria', rama: 'economia', nombre: 'Carpintería', niveles: 5, efecto: { produce: 'madera', pct: 0.04 }, coste: { piedra: 150, oro: 100 }, academia: 1, requiere: 'agricultura' },
        { id: 'canteria', rama: 'economia', nombre: 'Cantería', niveles: 5, efecto: { produce: 'piedra', pct: 0.04 }, coste: { madera: 150, oro: 100 }, academia: 2, requiere: 'agricultura' },
        { id: 'mineria', rama: 'economia', nombre: 'Minería', niveles: 5, efecto: { produce: 'hierro', pct: 0.04, tambien: 'metal' }, coste: { madera: 300, piedra: 300, oro: 200 }, academia: 3, requiere: 'canteria' },
        { id: 'logistica', rama: 'economia', nombre: 'Logística', niveles: 5, efecto: { recoger: 0.10 }, coste: { comida: 300, madera: 300, oro: 200 }, academia: 2, requiere: 'agricultura' },
        { id: 'entrenamiento', rama: 'heroes', nombre: 'Entrenamiento de héroes', niveles: 5, efecto: { xp: 0.10 }, coste: { comida: 300, oro: 300 }, academia: 2, requiere: null },
        { id: 'liderazgo', rama: 'heroes', nombre: 'Liderazgo', niveles: 5, efecto: { poderHeroes: 0.05 }, coste: { comida: 500, oro: 500, hierro: 100 }, academia: 4, requiere: 'entrenamiento' },
        // 0.7 · velocidad de movimiento por el mapa (marchas y recogidas en Clásica): −3 % de tiempo por nivel
        { id: 'marchas', rama: 'ejercito', nombre: 'Marchas rápidas', niveles: 5, efecto: { velocidad: 0.03 }, coste: { comida: 300, madera: 200, oro: 300 }, academia: 3, requiere: 'instruccion' }
      ],
      // Partidas antiguas (investigación de la 0.3/0.4) → nivel de la habilidad nueva (Tácticas +10 % = Instrucción 4; Medicina −30 % = Medicina 5)
      antiguas: { herboristeria: ['herboristeria', 1], forja: ['forja', 1], arcos: ['arcos', 1], herraduras: ['herraduras', 1], alquimia: ['alquimia', 1], tacticas: ['instruccion', 4], elixires: ['elixires', 1], medicina: ['medicina', 5] }
    },
    // ---------- 0.7 · UNIVERSIDAD: árbol propio que MEJORA la Academia con mejores estadísticas (TODO PROVISIONAL) ----------
    // Cada habilidad pide la de la Academia que mejora a cierto nivel (academia: [id, nivel]) y, como en la Academia, la anterior de su rama (requiere).
    // Nivel k: coste × 1,8^(k−1); pide Universidad nivel = universidad + 3·(k−1). Los efectos se SUMAN a los de la Academia.
    universidad: {
      ramas: [{ id: 'ejercito', nombre: 'Ejército' }, { id: 'alquimia', nombre: 'Alquimia' }, { id: 'economia', nombre: 'Economía' }, { id: 'heroes', nombre: 'Héroes' }],
      crece: 1.8, universidadPorNivel: 3, velocidadMax: 0.6,
      habilidades: [
        { id: 'u_tactica', edificio: 'universidad', rama: 'ejercito', nombre: 'Táctica superior', niveles: 5, efecto: { fuerza: 0.05 }, coste: { comida: 20000, oro: 20000, hierro: 4000 }, universidad: 1, academia: ['instruccion', 5], requiere: null },
        { id: 'u_marcha', edificio: 'universidad', rama: 'ejercito', nombre: 'Marcha forzada', niveles: 5, efecto: { velocidad: 0.05 }, coste: { comida: 20000, madera: 15000, oro: 20000 }, universidad: 1, academia: ['marchas', 3], requiere: null },
        { id: 'u_acero', edificio: 'universidad', rama: 'ejercito', nombre: 'Escudos de acero', niveles: 5, efecto: { bajas: -0.05 }, coste: { comida: 30000, oro: 30000, hierro: 8000, metal: 800 }, universidad: 4, academia: ['estrategia', 3], requiere: 'u_tactica' },
        { id: 'u_alquimia', edificio: 'universidad', rama: 'alquimia', nombre: 'Gran alquimia', niveles: 3, efecto: { pociones: 0.10 }, coste: { oro: 30000, hierro: 6000, metal: 800 }, universidad: 1, academia: ['elixires', 3], requiere: null },
        { id: 'u_cirugia', edificio: 'universidad', rama: 'alquimia', nombre: 'Cirugía', niveles: 5, efecto: { heridas: -0.08 }, coste: { comida: 25000, oro: 25000, metal: 600 }, universidad: 3, academia: ['medicina', 5], requiere: 'u_alquimia' },
        { id: 'u_agronomia', edificio: 'universidad', rama: 'economia', nombre: 'Agronomía', niveles: 5, efecto: { produce: 'comida', pct: 0.06 }, coste: { madera: 25000, oro: 20000 }, universidad: 1, academia: ['agricultura', 5], requiere: null },
        { id: 'u_ingenieria', edificio: 'universidad', rama: 'economia', nombre: 'Ingeniería', niveles: 5, efecto: { produce: 'madera', pct: 0.06, tambien: 'piedra' }, coste: { madera: 25000, piedra: 25000, oro: 20000 }, universidad: 2, academia: ['carpinteria', 5], requiere: 'u_agronomia' },
        { id: 'u_metalurgia', edificio: 'universidad', rama: 'economia', nombre: 'Metalurgia', niveles: 5, efecto: { produce: 'hierro', pct: 0.06, tambien: 'metal' }, coste: { madera: 40000, piedra: 40000, oro: 30000 }, universidad: 4, academia: ['mineria', 5], requiere: 'u_ingenieria' },
        { id: 'u_logistica', edificio: 'universidad', rama: 'economia', nombre: 'Logística avanzada', niveles: 5, efecto: { recoger: 0.15 }, coste: { comida: 30000, madera: 30000, oro: 20000 }, universidad: 2, academia: ['logistica', 5], requiere: 'u_agronomia' },
        { id: 'u_maestria', edificio: 'universidad', rama: 'heroes', nombre: 'Maestría heroica', niveles: 5, efecto: { xp: 0.15 }, coste: { comida: 30000, oro: 30000 }, universidad: 1, academia: ['entrenamiento', 5], requiere: null },
        { id: 'u_mando', edificio: 'universidad', rama: 'heroes', nombre: 'Mando supremo', niveles: 5, efecto: { poderHeroes: 0.08 }, coste: { comida: 50000, oro: 50000, hierro: 10000 }, universidad: 4, academia: ['liderazgo', 5], requiere: 'u_maestria' }
      ]
    },
    // ---------- 0.7 · Informes: historial permanente de batallas y avisos (también los ataques recibidos sin jugar). Se guardan los últimos 500. ----------
    informes: { max: 500 },
    // ---------- 0.7 · Acelerar una marcha: las pociones de velocidad aplicadas a UN ejército en camino recortan su tiempo restante (y la vuelta) en su %. ----------
    acelerarMarcha: ['velocidad_p', 'velocidad_m', 'velocidad_g'],
    // ================= 0.6 · encargo de Jose (11/11/2026). TODO PROVISIONAL =================
    // Modos de partida (se eligen al crearla; las partidas de antes de la 0.6 pasan a Clásica).
    modos: {
      clasica: { nombre: 'Clásica', produccion: 1 / 3, mantenimiento: 1 / 3, inicio: 1, acelerador: false, tiempoReal: true, desconectado: 0.5, desconectadoMaxH: 5, marchaMaxMin: 30,
        texto: 'Producción como antes del ×3. El tiempo corre siempre (no se pausa); desconectado produce la mitad, hasta 5 h. Moverse por el mapa tarda según la distancia (hasta 30 min a la otra punta).' },
      rapida: { nombre: 'Rápida', produccion: 1, mantenimiento: 1, inicio: 1.75, acelerador: true, tiempoReal: false, marchaMaxMin: 0,
        texto: 'Como la 0.5: producción ×3, el tiempo solo corre mientras juegas (con acelerador x1/x2/x3) y el movimiento por el mapa es instantáneo. Empieza con más recursos.' }
    },
    recursosIniciales: { comida: 80, madera: 60, piedra: 60, oro: 40, hierro: 0, metal: 0 },   // Clásica; Rápida × modos.rapida.inicio (1,75 → 140/105/105/70)
    // Zonas de farmeo con guardia: defensa = fuerza de un monstruo de su nivel × 0,5. Primero luchan los guerreros; si ganan, la zona queda limpia y los obreros trabajan.
    guardiaZona: 0.5,
    // Muralla: NO ocupa hueco; rodea la ciudad (piezas muralla_<1|2|3>_<lados> de Camachin sobre las casillas de 32 dp). Se construye y mejora
    // desde el ayuntamiento (o tocando la muralla). Se desbloquea con el ayuntamiento nv20 y es CARA. Aspecto 1 nv1-9, 2 nv10-19, 3 nv20-30.
    muralla: { nombre: 'Muralla', max: NIVEL_MAX, coste: costes([{ madera: 30000, piedra: 60000, oro: 15000, hierro: 6000, metal: 600 }]), requiere: 20 },
    // 0.7 · la muralla se hace MÁS ANCHA y más GRANDE con su nivel: grosor de las piezas (en casillas de 32 dp) y separación extra de la ciudad (provisional)
    murallaTamano: [{ desde: 1, grosor: 1, holgura: 0 }, { desde: 10, grosor: 1.5, holgura: 1 }, { desde: 20, grosor: 2, holgura: 2 }, { desde: 30, grosor: 2.5, holgura: 3 }, { desde: 40, grosor: 3, holgura: 4 }],
    // Defensas (suman al ejército al defender la ciudad). Tope de defensas: 20 por nivel de muralla.
    murallaBono: { base: 0.05, porNivel: 0.02 },   // + 7 % (nv1) … + 65 % (nv30) a la fuerza al defender
    defensasPorNivel: 20,
    defensas: {
      empalizada: { nombre: 'Empalizada', fuerza: 40, coste: { madera: 200, piedra: 100 }, muralla: 1, icono: 'empalizada_eo' },          // anillo de troncos por fuera de la muralla
      torre: { nombre: 'Torre de defensa', fuerza: 150, coste: { madera: 600, piedra: 1200, oro: 400 }, muralla: 5, icono: 'torre_defensa' },   // torre_defensa_1-3 (2×2)
      ballesta: { nombre: 'Ballesta', fuerza: 500, coste: { madera: 2000, piedra: 1500, oro: 1000, hierro: 300 }, muralla: 10, icono: 'ballesta' }   // ballesta_1-3 (2×2)
    },
    // Guerra, paz y conquista
    guerra: { desdeAyto: 20, cadaMin: [180, 240], avisoMin: 5, unoALaVez: true, fuerzaAtaque: 0.8, saqueo: 0.3, bajasDerrota: 0.25 },
    // 0.8 · ASEDIOS: tras lanzar un ataque a una ciudad, el jugador espera al menos 60 min jugados para el siguiente; cada ciudad en guerra, 3–4 h; y solo UNA ataca a la vez.
    asedio: { esperaMin: 60 },
    paz: { oroPorFuerza: 0.5 },        // firmar la paz con una ciudad cuesta oro = su fuerza × 0,5
    // 0.7: desdeAyto es el nivel de TU ayuntamiento (no el de la ciudad); se conquista una ciudad de CUALQUIER nivel con un poder ≥ 1,5 × el suyo (también si está recuperándose de un saqueo)
    conquista: { desdeAyto: 25, ventaja: 1.5, tributoPorMin: 0.006 },   // 0.8: tributo/min de una ciudad conquistada = su botín × 0,006 (× 3 que en la 0.7)
    // Tienda: comprar objetos con oro e intercambiar materiales con comisión
    tienda: { valor: { comida: 1, madera: 1, piedra: 1, oro: 1, hierro: 3, metal: 15 }, recargo: 1.5, comision: 0.30, cantidades: [100, 1000, 10000, 100000, 1000000],   // 0.8: comisión del 30 % y botón de 100k · 0.9: botón de 1M
      venta: ['pequena', 'velocidad_p', 'fuerza_p', 'farmeo_p', 'enfriamiento_p', 'mediana', 'velocidad_m', 'fuerza_m', 'farmeo_m', 'enfriamiento_m', 'cofre_p', 'ct_mediano', 'ct_grande', 'ct_epico', 'ct_legendario'], fragmentoComun: 5000,
      // 0.7 · edificio: cada nivel por encima del 1 baja el recargo 0,01 (mín. 1,2) y la comisión 0,2 puntos (mín. 3 %)
      recargoPorNivel: 0.01, recargoMin: 1.2, comisionPorNivel: 0.005, comisionMin: 0.05 },   // 0.8: −0,5 puntos por nivel (30 % → 5 % en nv50)
    // Color de tejado / tinte por edificio (provisional; Camachin podrá cambiarlos). Se aplica como tinte sobre la skin.
    // Colores de Camachin (colores_tejado_0.6.csv); se usan sus skins <edificio>_nNN_color
    // ---------- 0.9 · CAMPAMENTO (encargo de Jose, 19/11/2026; números PROVISIONALES) ----------
    // En la esquina inferior derecha de la ciudad, con su propio mapa. Su nivel (máx. el del ayuntamiento) abre huecos y marca el nivel máximo de lo que hay dentro.
    //  · 0.10 (Jose, 20/11/2026): cada nivel da más que el anterior: nivel k aporta round(25 × 1,15^(k−1)) y el edificio da la SUMA de sus niveles (nv1 = 25, nv2 = 25 + 29 = 54…).
    //  · Tienda de campaña (casa de tropa): antes (0.9) 5 plazas por nivel. La suma es la «tropa disponible»: cada tropa (en la ciudad o fuera) ocupa 1 plaza.
    //  · Cabaña de obreros: igual (mismas cifras en obreros); la suma es el máximo de obreros.
    //  · Costes solo en madera, piedra y oro: × 1,3 por nivel hasta el 30 y × 1,15 desde ahí (como las casas). Demoler devuelve el 50 %. Despedir tropas no devuelve nada.
    //  · Partidas nuevas y de la 0.8: Campamento nv1 con 1 tienda y 1 cabaña de nv1. Si ya tienes más tropas u obreros que plazas, no se quitan: solo no puedes crear más.
    campamento: { nombre: 'Campamento', max: NIVEL_MAX, huecos: serie([4], n => Math.min(30, 4 + Math.round((n - 1) * 26 / 29))),
      coste: costesCamp({ madera: 80, piedra: 60, oro: 40 }), inicio: ['tienda_campana', 'cabana_obreros'], devolucion: 0.5,
      tipos: {
        tienda_campana: { nombre: 'Tienda de campaña', corto: 'Tienda', plazasNv1: 25, crecePlazas: 1.15, para: 'tropas', coste: costesCamp({ madera: 25, piedra: 15, oro: 10 }) },
        cabana_obreros: { nombre: 'Cabaña de obreros', corto: 'Cabaña', plazasNv1: 25, crecePlazas: 1.15, para: 'obreros', coste: costesCamp({ madera: 20, piedra: 20, oro: 10 }) }
      } },
    // 0.9 · desde el nivel 30 del jugador (= nivel del ayuntamiento) el mapa oculta los monstruos de nivel menor que 30 (los legendarios y los que estás atacando, no)
    ocultarMonstruos: { desdeNivelJugador: 30, menoresDe: 30 },
    // 0.9 · mantener pulsado más de 2 s repite la acción (mejorar, fabricar, comprar, intercambiar)
    repetir: { esperaMs: 2000, cadaMs: 250, maxSeguidas: 200 },
    tintes: { ayuntamiento: '#9B2C2C', casa: '#C8603A', granja: '#E2B83C', aserradero: '#8A5A30', cantera: '#A8A39A', mina: '#4B4950', fundicion: '#E68A2E',
      deposito: '#2E8B86', academia: '#1F3A5F', cuartel: '#4A7FB0', salon_heroes: '#7A3B8F', botica: '#3E8E3E', tienda: '#D45D8C', universidad: '#3CC4D8', escuela_maestria: '#5B5FC7',
      campamento: '#5E6B2E', tienda_campana: '#5E6B2E', cabana_obreros: '#5E6B2E' },   // 0.9: verde oliva de Camachin (pendiente de Jose)   // 0.8: colores de Camachin (Escuela añil, aprobado por Jose)
    // ---------- Skins por nivel (Camachin, LEEME_Programator_skins, 10/11/2026): www/img/skins/<id>_nNN.svg ----------
    // Aspecto = el mayor de estos niveles que no supere el nivel del edificio (con los niveles máximos actuales, casi todo usa n01).
    // 0.7 · skins GRANDES de Camachin (v2): nv30–39 {id}_n30_grande y nv40–50 {id}_n40_4x4, ambas 4×4 (128 dp) centradas sobre su hueco de 3×3
    //       (los huecos no cambian). Entre el 40 y el 50 se mantiene la de 40 (decisión provisional).
    skins: [1, 6, 12, 18, 24, 30, 40], skinNombre: { 30: 'n30_grande', 40: 'n40_4x4' }, skinsGrandes: [30, 40],
    asientoPlaza: ['ayuntamiento', 'salon_heroes']
  };
  // 0.8 · tipos de héroe de los MONSTRUOS CAPTURADOS (uno por familia y por legendario): cap_<familia>. Dibujo: el del monstruo (retrato y mapa).
  { const D = g.CivilikDatos, K = D.captura;
    for (const [f, T] of Object.entries(D.monstruos.tipos)) D.heroes.tipos['cap_' + f] = { nombre: 'Capturado · ' + T.nombres[0], capturado: true, monstruo: f, clase: T.clase, poder: K.poder,
      papel: 'Monstruo capturado · ' + (T.clase ? D.clases[T.clase] : 'apoyo'), fragFam: T.sinHeroe ? null : f, nombres: [], habilidades: K.habilidades[f] || [] };
    for (const [f, L] of Object.entries(D.legendarios.tipos)) D.heroes.tipos['cap_' + f] = { nombre: 'Legendario · ' + L.nombre, capturado: true, legendario: true, monstruo: f, clase: L.clase, poder: K.poderLegendario,
      papel: 'Legendario capturado · ' + L.habilidad, fragFam: null, nombres: [], habilidades: K.habilidades[f] || [] };
  }
})(typeof window !== 'undefined' ? window : globalThis);
