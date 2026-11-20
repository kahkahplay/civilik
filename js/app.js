/* Civili'k 0.1.1 · interfaz con la identidad visual de Camachin (kk digital studio): cómic medieval, ciudad cenital sobre pergamino.
   Pantallas: inicio (partidas guardadas) · juego (ciudad / mapa) · acerca. El tiempo del juego solo corre en la pantalla de juego,
   con la app visible y sin menú ni tutorial abiertos; si no, todo queda en pausa (recursos, producción e impuestos). */
(function (g) {
  'use strict';
  const J = g.CivilikJuego, { DB, ACT } = g.CivilikConfig, PA = g.KKPaneles;
  const $ = s => document.querySelector(s);
  function el(tag, props, ...hijos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v; else if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e[k] = v; else if (k === 'disabled' || k === 'hidden') e[k] = !!v; else e.setAttribute(k, v);
    }
    hijos.flat().forEach(h => h != null && h !== false && e.append(h)); return e;
  }
  const N = x => Math.floor(x + 1e-9);
  // 0.4: cifras grandes compactas en la barra (niveles hasta 30): 99999 tal cual; 294000 → «294 k»; 1250000 → «1,25 M»
  const corto = v => v < 100000 ? String(v) : v < 1e6 ? Math.floor(v / 1000) + ' k' : (Math.floor(v / 1e4) / 100).toLocaleString('es-ES') + ' M';
  const textoCoste = c => Object.entries(c).filter(([, v]) => v).map(([k, v]) => v.toLocaleString('es-ES') + ' ' + J.NOMBRE_RECURSO[k].toLowerCase()).join(' · ') || 'gratis';
  // Iconos de interfaz (SVG de trazo, coloreados con currentColor mediante máscara), de recursos y de edificios (diseno/ de Camachin)
  const ico = (n, cls) => el('span', { class: 'ico' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true', style: '-webkit-mask-image:url(img/ui/' + n + '.svg);mask-image:url(img/ui/' + n + '.svg)' });
  const imgRec = (k, cls) => el('img', { class: cls || 'ico-rec', src: 'img/recursos/' + (k === 'metal' ? 'metal_alta_calidad' : k) + '.svg', alt: J.NOMBRE_RECURSO[k] || '', draggable: 'false' });
  // 0.3 · skins por nivel de Camachin: <id>_nNN (aspecto = el mayor de 1, 6, 12, 18, 24, 30 que no supere el nivel)
  // 0.6 · tejados con el color de cada edificio (skins <id>_nNN_color de Camachin)
  const imgEdif = (t, cls, nivel = 1) => el('img', { class: cls || 'img-edif', src: 'img/skins/' + J.skin(t, nivel) + ((g.CivilikDatos.tintes || {})[t] ? '_color' : '') + '.svg', alt: '', draggable: 'false' });
  const imgSuelo = (n, cls) => el('img', { class: cls, src: 'img/suelo/' + n + '.svg', alt: '', draggable: 'false' });
  const imgUi = (n, cls) => el('img', { class: cls || 'ico-ui', src: 'img/ui/' + n + '.svg', alt: '', draggable: 'false' });   // iconos a color de Camachin (0.5)
  const costeIconos = c => el('span', { class: 'coste-iconos' }, Object.entries(c).filter(([, v]) => v).map(([k, v]) => el('span', { class: 'coste-item', title: J.NOMBRE_RECURSO[k] }, imgRec(k, 'ico-coste'), el('b', { text: v.toLocaleString('es-ES') }))));
  const tiempo = ms => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? h + ' h ' + m + ' min' : m + ' min ' + (s % 60) + ' s'; };
  // 0.9 · Campamento: dibujos de Camachin (img/campamento/<id>_nNN[_color].svg, 96 dp) e iconos de 48 dp
  const aspectoCamp = nivel => String([1, 6, 12, 18, 24, 30].filter(n => n <= Math.max(1, nivel)).pop()).padStart(2, '0');
  const imgCamp = (tipo, nivel, cls) => el('img', { class: cls || 'img-edif', src: 'img/campamento/' + tipo + '_n' + aspectoCamp(nivel) + ((g.CivilikDatos.tintes || {})[tipo] ? '_color' : '') + '.svg', alt: '', draggable: 'false' });
  const imgIcoCamp = (n, cls) => el('img', { class: cls || 'ico-coste', src: 'img/campamento/' + n + '.svg', alt: '', draggable: 'false' });

  // ---------- Estado de la interfaz ----------
  const E = { pantalla: 'inicio', anterior: 'inicio', vista: 'ciudad', partidas: [], moviendo: null, pausaSistema: false, zoom: 1, scroll: null, modo: null, tocado: null, zoomMapa: null, scrollMapa: null };
  let PARTIDA = null, activo = false, ultimo = Date.now(), sinGuardar = 0, guardando = Promise.resolve();
  let hojaRender = null, hojaPausa = false, dialogoActual = null;

  // ---------- Reloj del juego (pausa total fuera del juego) ----------
  // 0.6 · Clásica: el tiempo corre en tiempo real aunque haya menús u hojas abiertas (solo se para fuera de la partida o de la app;
  //       al volver se cobra lo desconectado a la mitad, hasta 5 h). Rápida: como la 0.5 (pausa con menús y diálogos).
  const tiempoReal = () => !!(PARTIDA && J.modo(PARTIDA).tiempoReal);
  const jugando = () => !!(E.pantalla === 'juego' && PARTIDA && !E.pausaSistema && document.visibilityState !== 'hidden' && (tiempoReal() || (!hojaPausa && !dialogoActual)));
  function tick() {
    const ahora = Date.now(), dt = ahora - ultimo; ultimo = ahora;
    if (!activo || !PARTIDA) return;
    if (tiempoReal() && dt > 5000) { J.ponerseAlDia(PARTIDA, dt); PARTIDA.ultimaVez = ahora; return; }   // el sistema congeló los temporizadores: cuenta como desconectado
    J.avanzar(PARTIDA, Math.min(Math.max(dt, 0), 1500) * velocidad());   // tope por si el sistema congela los temporizadores; × velocidad (x1/x2/x3)
    PARTIDA.ultimaVez = ahora;
    sinGuardar += dt; if (sinGuardar >= 10000) guardar();
  }
  // Clásica: al volver a la partida se cobra el tiempo desconectado (producción y consumo a la mitad, tope 5 h)
  function ponerAlDia() {
    if (!tiempoReal()) { if (PARTIDA) PARTIDA.ultimaVez = Date.now(); return; }
    const ahora = Date.now(), fuera = ahora - (PARTIDA.ultimaVez || ahora);
    PARTIDA.ultimaVez = ahora;
    if (fuera < 5000) return;
    const antes = { ...PARTIDA.recursos }, ms = J.ponerseAlDia(PARTIDA, fuera);
    const gan = J.RECURSOS.map(k => [k, Math.floor(PARTIDA.recursos[k] - antes[k])]).filter(([, v]) => v > 0).map(([k, v]) => '+' + v.toLocaleString('es-ES') + ' ' + J.NOMBRE_RECURSO[k].toLowerCase());
    E.alDia = { ms, fuera };
    aviso('Mientras no estabas: ' + tiempo(ms) + (fuera > ms ? ' (tope 5 h)' : ''), 'info', 'Producción a la mitad. ' + (gan.join(' · ') || ''), 6000);
    guardar();
  }
  // 0.1.1 · Acelerador de tiempo: x1 / x2 / x3. Solo actúa mientras se juega (en pausa no corre nada a ninguna velocidad).
  const VELOCIDADES = [1, 2, 3];
  const velocidad = () => (PARTIDA && J.modo(PARTIDA).acelerador !== false && VELOCIDADES.includes(PARTIDA.velocidad)) ? PARTIDA.velocidad : 1;
  function cambiarVelocidad() {
    if (!PARTIDA) return;
    if (J.modo(PARTIDA).acelerador === false) return aviso('Partida clásica', 'info', 'En Clásica no hay acelerador: el tiempo corre como el real.');
    tick();   // lo jugado hasta ahora cuenta a la velocidad anterior
    PARTIDA.velocidad = VELOCIDADES[(VELOCIDADES.indexOf(velocidad()) + 1) % VELOCIDADES.length];
    pintarVelocidad();
    guardar();
  }
  function cambio() { const antes = activo; tick(); activo = jugando(); ultimo = Date.now(); if (activo && !antes && PARTIDA) ponerAlDia(); pintarEstado(); if (!activo && PARTIDA) guardar(); }
  function guardar() {
    if (!PARTIDA) return guardando; sinGuardar = 0; PARTIDA.actualizada = Date.now();
    const copia = JSON.parse(JSON.stringify(PARTIDA));
    guardando = guardando.then(() => DB.poner('partidas', copia)).catch(() => { }); return guardando;
  }
  function pintarEstado() { const s = $('#estado-juego'); if (s) { s.textContent = activo ? 'En juego' : 'En pausa'; s.classList.toggle('pausa', !activo); } pintarVelocidad(); }
  // Botón de velocidad (guía UI): x1 pergamino · x2 oro · x3 granate · en pausa gris «II»
  function pintarVelocidad() {
    const b = $('#btn-velocidad'); if (!b || !PARTIDA) return;
    const v = velocidad(), pausa = !activo;
    if (J.modo(PARTIDA).acelerador === false) {   // 0.6 · Clásica: sin acelerador; el botón muestra el modo
      b.className = 'btn-velocidad clasica' + (pausa ? ' pausa' : ''); b.setAttribute('aria-label', 'Partida clásica: tiempo real, sin acelerador');
      b.replaceChildren(imgUi('icono_modo_clasica', 'ico-modo'), el('span', { class: 'v-texto', text: pausa ? 'II' : 'x1' })); return;
    }
    b.className = 'btn-velocidad v' + v + (pausa ? ' pausa' : '');
    b.setAttribute('aria-label', pausa ? 'Juego en pausa (velocidad x' + v + ')' : 'Velocidad del tiempo x' + v + '. Toca para cambiar');
    b.replaceChildren(ico('velocidad'), el('span', { class: 'v-texto', text: pausa ? 'II' : 'x' + v }));
  }

  // ---------- Toast, diálogos y hojas ----------
  let tt = null;
  // Aviso (toast arriba): banda de color + icono + texto; se cierra solo a ~4 s. Tipos: info, exito, aviso, error.
  const ICONO_AVISO = { info: 'info', exito: 'exito', aviso: 'aviso', error: 'error' };
  function aviso(t, tipo = 'aviso', texto = '', ms = 4000) {
    const x = $('#toast'); x.className = 'toast ' + tipo; x.setAttribute('role', 'status');
    x.replaceChildren(el('span', { class: 'toast-banda' }), ico(ICONO_AVISO[tipo] || 'info', 'toast-ico'), el('div', { class: 'toast-txt' }, el('b', { text: t }), texto ? el('div', { text: texto }) : null));
    x.hidden = false; clearTimeout(tt); tt = setTimeout(() => { x.hidden = true; }, ms);
  }
  function dialogo({ titulo, texto, campo, botones, clase, alCerrar = null, cabecera = null, pie = null, capa: claseCapa = '' }) {
    return new Promise(ok => {
      const capa = $('#dialogo-capa'); capa.innerHTML = ''; capa.className = claseCapa;
      let input = null;
      const fin = v => { capa.hidden = true; capa.innerHTML = ''; dialogoActual = null; cambio(); ok(v); };
      const caja = el('div', { class: 'dialogo panel ' + (clase || ''), role: 'dialog' }, cabecera, titulo ? el('h2', { text: titulo }) : null, texto ? el('p', { text: texto }) : null, pie);
      if (campo) { input = el('input', { id: 'dialogo-campo', type: 'text', value: campo.valor || '', maxlength: 40, placeholder: campo.placeholder || '' }); caja.append(input); }
      caja.append(el('div', { class: 'botones' }, botones.map(b => el('button', { class: 'btn ' + (b.tipo || 'secundario'), id: b.id, text: b.texto, onclick: () => fin(b.valor === '$campo' ? input.value.trim() : b.valor) }))));
      capa.append(caja); capa.hidden = false;
      dialogoActual = { cerrar: () => fin(alCerrar) }; cambio();
      if (input) setTimeout(() => input.focus(), 50);
    });
  }
  function abrirHoja(render, { pausa = false } = {}) {
    hojaRender = render; hojaPausa = pausa; refrescarHoja();
    $('#hoja').hidden = false; $('#velo').hidden = false; $('#hoja').scrollTop = 0; cambio();
  }
  function refrescarHoja() { if (!hojaRender) return; const h = $('#hoja'), st = h.scrollTop; h.innerHTML = ''; h.append(el('div', { class: 'hoja-asa' })); hojaRender(h); h.scrollTop = st; }
  function cerrarHoja() { if (!hojaRender) return false; hojaRender = null; if (E.tocado != null) { E.tocado = null; if (PARTIDA && E.pantalla === 'juego') setTimeout(pintar, 0); } hojaPausa = false; $('#hoja').hidden = true; $('#velo').hidden = true; $('#hoja').innerHTML = ''; cambio(); return true; }

  // ---------- Navegación y botón Atrás (como Notik's 1.2) ----------
  function ir(p) { if (p !== E.pantalla) E.anterior = E.pantalla; E.pantalla = p; E.moviendo = null; E.modo = null; cerrarHoja(); pintar(); cambio(); }
  function atras() {
    if (dialogoActual) { dialogoActual.cerrar(); return true; }
    if (hojaRender) { cerrarHoja(); return true; }
    if (E.moviendo) { E.moviendo = null; pintar(); return true; }
    if (E.modo) { E.modo = null; pintar(); return true; }
    if (E.pantalla === 'acerca') { ir(E.anterior === 'juego' && PARTIDA ? 'juego' : 'inicio'); return true; }
    if (E.pantalla === 'juego') { if (E.vista !== 'ciudad') { E.vista = 'ciudad'; pintar(); } else salirAPartidas(); return true; }
    return false;   // inicio: Android deja la app en segundo plano (no la cierra)
  }
  async function salirAPartidas() { await guardarYSoltar(); await cargarPartidas(); ir('inicio'); }
  async function guardarYSoltar() { tick(); activo = false; await guardar(); PARTIDA = null; }

  // ---------- Pantalla de inicio: partidas guardadas ----------
  async function cargarPartidas() { E.partidas = (await DB.todos('partidas')).map(J.migrar).sort((a, b) => b.actualizada - a.actualizada); }
  function pintarInicio(m) {
    const p = el('div', { class: 'pagina', id: 'inicio' },
      el('div', { class: 'portada' }, el('img', { class: 'logo-inicio', id: 'logo-inicio', src: 'img/logo/logo_civilik_apilado_claro.svg', alt: "Civili'k" }),
        el('h1', { class: 'solo-lector', text: "Civili'k" }),
        el('p', { class: 'lema', text: 'Construye tu ciudad y produce recursos' }), el('div', { class: 'sub centro', text: 'Prototipo de prueba ' + ((g.KK_VERSION || {}).versionName || '') })),
      el('button', { class: 'btn principal ancho', id: 'btn-nueva', text: 'Nueva partida', onclick: nuevaPartida }),
      el('h2', { class: 'titulo-seccion', text: 'Partidas guardadas' }));
    if (!E.partidas.length) p.append(el('p', { class: 'sub', id: 'sin-partidas', text: 'Aún no hay partidas. Empieza una nueva.' }));
    for (const x of E.partidas) {
      const nv = (x.edificios.find(b => b.tipo === 'ayuntamiento') || {}).nivel || 1;
      p.append(el('div', { class: 'tarjeta partida', 'data-id': x.id },
        el('div', { class: 'mini' }, imgSuelo('solar_edificio', 'mini-solar'), imgEdif('ayuntamiento', 'mini-edif')),
        el('div', { class: 'datos' }, el('div', { class: 'nombre', text: x.nombre }),
          el('div', { class: 'sub modo-partida', text: 'Modo ' + J.modo(x).nombre }),
          el('div', { class: 'sub', text: 'Nivel ' + nv + ' · ' + J.EDIFICIOS.ayuntamiento.huecos[nv - 1] + ' huecos · ' + (x.edificios.length - 1) + ' edificios · jugado ' + tiempo(x.jugadoMs) })),
        el('div', { class: 'acciones' },
          el('button', { class: 'btn oro btn-jugar', text: 'Seguir', onclick: () => abrirPartida(x.id) }),
          el('button', { class: 'btn peligro pequeno btn-borrar', text: 'Borrar', 'aria-label': 'Borrar ' + x.nombre, onclick: () => borrarPartida(x) }))));
    }
    // 0.10 · «Cargar partida» (archivo .json de «Guardar partida»: APK ⇄ PWA) e «Información»
    p.append(el('button', { class: 'btn secundario ancho', id: 'btn-cargar', style: 'margin-top:16px', onclick: cargarPartidaArchivo }, ico('guardar'), 'Cargar partida'));
    p.append(el('button', { class: 'btn secundario ancho', id: 'btn-info', style: 'margin-top:10px', onclick: () => abrirHoja(hojaInformacion) }, ico('info'), 'Información'));
    p.append(el('button', { class: 'btn secundario ancho', id: 'btn-acerca', style: 'margin-top:10px', text: 'Acerca de', onclick: () => ir('acerca') }));
    m.append(p);
  }
  // ---------- 0.10 · Guardar partida en un archivo / Cargar partida (kk-comun: kk-partida-archivo.js) ----------
  const ARCH = g.KKPartidaArchivo.crear({ app: 'civilik', nombreApp: "Civili'k", formato: 1, prefijo: 'civilik-partida', version: () => (g.KK_VERSION || {}).versionName || '',
    validar: d => {
      if (d.formato !== 'civilik-partida' || typeof d.id !== 'string' || !Array.isArray(d.edificios) || !Array.isArray(d.huecos) || !d.recursos || typeof d.recursos !== 'object') return "El archivo no contiene una partida de Civili'k válida (le faltan datos).";
      if (!d.edificios.some(b => b && b.tipo === 'ayuntamiento')) return 'La partida del archivo está dañada (no tiene ayuntamiento).';
      if (d.version > J.VERSION_PARTIDA) return "La partida es de una versión más nueva de Civili'k. Actualiza la app para cargarla.";
      return null;
    } });
  const fechaHora = t => new Date(t).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  async function guardarPartidaArchivo() {
    if (!PARTIDA) return; tick(); await guardar();
    try {
      const r = await ARCH.exportar(JSON.parse(JSON.stringify(PARTIDA)));
      if (r === 'CANCELADO') return aviso('No se ha guardado el archivo', 'info');
      aviso('Partida guardada en un archivo', 'exito', r === 'DESCARGADO' ? 'Está en Descargas. Con «Cargar partida» la abres en otro móvil o PC.' : 'Guárdalo (Archivos, Drive…) y ábrelo con «Cargar partida» en el otro dispositivo.', 6000);
    } catch (err) { aviso('No se ha podido guardar el archivo', 'error', String((err && err.message) || err).slice(0, 120)); }
  }
  async function cargarPartidaArchivo() {
    const f = await ARCH.elegir(); if (!f) return;
    const r = await ARCH.leer(f);
    if (!r.ok) return dialogo({ titulo: 'No se puede cargar', texto: r.motivo, botones: [{ texto: 'Vale', valor: null, tipo: 'principal', id: 'dlg-ok' }] });
    const x = r.datos, nv = (x.edificios.find(b => b.tipo === 'ayuntamiento') || {}).nivel || 1, ya = await DB.uno('partidas', x.id);
    const resumen = '«' + x.nombre + '» · nivel ' + nv + ' · guardada el ' + fechaHora(r.info.fecha || x.actualizada) + (r.info.versionApp ? " (Civili'k " + r.info.versionApp + ')' : '') + '.';
    const v = await dialogo({ titulo: ya ? 'Ya tienes esta partida' : 'Cargar partida', clase: 'cargar-partida',
      texto: ya ? resumen + ' En este dispositivo ya está «' + ya.nombre + '» (guardada el ' + fechaHora(ya.actualizada) + '). Si la sobrescribes, se pierde la de este dispositivo.' : resumen + ' ¿Cargarla en este dispositivo?',
      botones: ya ? [{ texto: 'Cancelar', valor: null, id: 'dlg-cancelar' }, { texto: 'Como copia', valor: 'copia', id: 'dlg-copia' }, { texto: 'Sobrescribir', valor: 'sobre', tipo: 'peligro', id: 'dlg-ok' }]
        : [{ texto: 'Cancelar', valor: null, id: 'dlg-cancelar' }, { texto: 'Cargar', valor: 'nueva', tipo: 'principal', id: 'dlg-ok' }] });
    if (!v) return;
    if (v === 'copia') { x.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); x.nombre = (x.nombre + ' (copia)').slice(0, 40); }
    try { J.migrar(x); } catch (err) { return dialogo({ titulo: 'No se puede cargar', texto: 'La partida del archivo está dañada y no se puede abrir.', botones: [{ texto: 'Vale', valor: null, tipo: 'principal', id: 'dlg-ok' }] }); }
    x.actualizada = Date.now();
    await DB.poner('partidas', x); await cargarPartidas(); pintar();
    aviso('Partida cargada', 'exito', '«' + x.nombre + '» ya está en tus partidas guardadas.');
  }
  // 0.10 · Información (inicio): dónde se guarda la partida, pasarla a otro dispositivo, instalar la versión web y aviso del iPhone
  function hojaInformacion(h) {
    const sec = (id, titulo, ...ps) => el('section', { class: 'info-seccion', id }, el('h3', { text: titulo }), ...ps.map(t => el('p', { text: t })));
    h.append(cabeceraHoja('Información', "Cómo se guarda y cómo llevar tu partida a otro sitio", 'hoja-titulo'),
      el('div', { class: 'info-lista', id: 'info-texto' },
        sec('info-guardado', 'Tu partida está en este dispositivo', 'La partida se guarda solo en este móvil o PC, dentro de la app. No hace falta cuenta ni iniciar sesión, y no se envía a ningún sitio.'),
        sec('info-pasar', 'Pasarla a otro móvil o PC, o hacer una copia',
          '1. Dentro de la partida, abre el Menú y pulsa «Guardar partida». Se crea un archivo (civilik-partida-fecha.json): guárdalo o envíatelo.',
          '2. En el otro dispositivo, en esta pantalla de inicio, pulsa «Cargar partida» y elige ese archivo. Si ya tenías esa partida, te pregunta antes de sobrescribirla.',
          'Sirve entre la app de Android y la versión web, en los dos sentidos. Guarda ese archivo de vez en cuando como copia.'),
        sec('info-instalar', 'Instalar la versión web',
          "Android: abre la web de Civili'k en Chrome, pulsa el menú ⋮ y elige «Instalar aplicación» o «Añadir a pantalla de inicio».",
          "iPhone: abre la web de Civili'k en Safari, pulsa Compartir (el cuadrado con la flecha) y elige «Añadir a pantalla de inicio».",
          'Así se abre a pantalla completa y se puede jugar sin conexión.'),
        sec('info-iphone', 'Aviso para iPhone', 'En iPhone, si la app pasa varias semanas sin abrirse, el sistema puede borrar la partida. Guarda una copia con «Guardar partida» de vez en cuando.')),
      el('button', { class: 'btn principal ancho', id: 'info-cerrar', text: 'Entendido', onclick: cerrarHoja }));
  }
  // 0.6 · Selector de modo (maqueta 04 de Camachin): Clásica o Rápida (Rápida preseleccionada)
  async function nuevaPartida() {
    E.modoNueva = 'rapida';
    const tarjeta = id => { const md = DM.modos[id], on = E.modoNueva === id;
      return el('button', { type: 'button', class: 'tarjeta-modo' + (on ? ' activa' : ''), id: 'modo-' + id, 'aria-pressed': on ? 'true' : 'false', onclick: ev => { E.modoNueva = id; for (const b of document.querySelectorAll('.tarjeta-modo')) { const a = b.id === 'modo-' + id; b.classList.toggle('activa', a); b.setAttribute('aria-pressed', a ? 'true' : 'false'); const ic = b.querySelector('.modo-check'); if (ic) ic.src = 'img/ui/boton_modo_' + b.id.slice(5) + '_' + (a ? 'seleccionado' : 'normal') + '.svg'; } } },
        imgUi('icono_modo_' + id, 'ico-modo-grande'), el('span', { class: 'datos' }, el('b', { text: md.nombre }), el('span', { class: 'sub', text: md.texto + (id === 'rapida' ? ' Recursos iniciales ×' + String(md.inicio).replace('.', ',') + '.' : '') })),
        imgUi('boton_modo_' + id + '_' + (on ? 'seleccionado' : 'normal'), 'modo-check')); };
    const nombre = await dialogo({ titulo: 'Nueva partida', texto: 'Elige el modo y ponle un nombre:', campo: { valor: 'Partida ' + (E.partidas.length + 1) }, clase: 'nueva-partida',
      pie: el('div', { class: 'selector-modo', id: 'selector-modo' }, tarjeta('clasica'), tarjeta('rapida')),
      botones: [{ texto: 'Cancelar', valor: null, id: 'dlg-cancelar' }, { texto: 'Empezar', valor: '$campo', tipo: 'principal', id: 'dlg-ok' }] });
    if (nombre == null) return;
    const x = J.nueva(nombre || 'Partida ' + (E.partidas.length + 1), undefined, E.modoNueva || 'rapida');
    await DB.poner('partidas', x); await cargarPartidas();
    await abrirPartida(x.id);
  }
  async function borrarPartida(x) {
    const ok = await dialogo({ titulo: 'Borrar partida', texto: '¿Borrar «' + x.nombre + '»? No se puede deshacer.', botones: [{ texto: 'Cancelar', valor: false, id: 'dlg-cancelar' }, { texto: 'Borrar', valor: true, tipo: 'peligro', id: 'dlg-ok' }] });
    if (!ok) return; await DB.quitar('partidas', x.id); await cargarPartidas(); pintar();
  }
  async function abrirPartida(id) {
    const x = await DB.uno('partidas', id); if (!x) return aviso('No se encuentra la partida', 'error');
    const antes = x.huecos.length, versionAntes = x.version; J.migrar(x);   // partidas de la 0.1: 12 → 40 parcelas (sin mover edificios)
    PARTIDA = x; E.vista = 'ciudad'; E.scroll = null; E.scrollMapa = null; E.modo = null; E.tocado = null; ir('juego');
    if (x.huecos.length !== antes || x.version !== versionAntes) guardar();
    E.desertores = null; E.ataque = null;
    if (!PARTIDA.tutorialHecho) await tutorial();
    if (PARTIDA && PARTIDA.militar && PARTIDA.militar.heroeInicialPendiente) elegirHeroeInicial();   // 0.3: partidas nuevas y migradas
  }

  // ---------- Tutorial corto (solo lo de esta prueba) ----------
  const PASOS = [
    ['Tu capital', 'Gestionas tu ciudad, vista desde arriba. Las pestañas de arriba (solo iconos) llevan a la ciudad, el mapa del mundo, el ejército, el inventario, las misiones y las estadísticas. En Rápida el tiempo solo corre mientras juegas (si sales de la partida o de la app, todo se pausa) y el botón x1 / x2 / x3 lo acelera. En Clásica el tiempo es real: desconectado se produce la mitad, hasta 5 h.'],
    ['Construir', 'Pulsa el botón de construir (martillo): la ciudad se oscurece un poco y aparecen los huecos libres (+) y los bloqueados (candado). Toca un hueco libre; también puedes tocar directamente un sitio libre de la hierba. El botón de salir vuelve a la vista normal. Es instantáneo si tienes los recursos. Al empezar hay 16 sitios; mejorar el ayuntamiento abre más (hasta 100 con el nivel 30) y la ciudad crece. Desliza para recorrer la ciudad y usa − / + para alejar o acercar.'],
    ['Personas y oro', 'Las casas dan personas. Cada persona paga ' + J.ORO_POR_PERSONA_MIN + ' de oro por minuto en impuestos. Empieza construyendo una casa.'],
    ['Producción', 'Granja, aserradero, cantera, mina y fundición necesitan al menos 1 persona libre y producen más con más personas. La fundición gasta 2 de hierro por cada metal.'],
    ['A salvo y edificios', 'El ayuntamiento guarda a salvo una parte de cada recurso; con nivel 2 se desbloquea el depósito. Toca un edificio para mejorarlo (el botón «Máx» sube todos los niveles que puedas pagar), moverlo (gratis) o demolerlo (recuperas el 50 %).'],
    ['Ejército y monstruos', 'Cuartel, Academia, Salón de héroes y Botica. Entrena tropas (infantería vence a caballería, caballería a arqueros y arqueros a infantería) y llévalas con tus héroes contra monstruos y ciudades enemigas del mapa del mundo (pellizca para acercar), o mándalas a recoger recursos a las zonas (los obreros recogen mucho más rápido; primero hay que vencer a la guardia). Los monstruos sueltan fragmentos: con 10 de una familia convocas a su héroe. Los héroes suben solos con la experiencia. Tropas y héroes comen mientras juegas.']
  ];
  const ILUSTRA = ['ayuntamiento', null, 'casa', 'granja', 'deposito', 'cuartel'];
  async function tutorial() {
    for (let i = 0; i < PASOS.length; i++) {
      const ult = i === PASOS.length - 1;
      const dib = ILUSTRA[i] ? el('div', { class: 'tut-dibujo' }, imgSuelo('solar_edificio', 'mini-solar'), imgEdif(ILUSTRA[i], 'mini-edif')) : el('div', { class: 'tut-dibujo destacado' }, imgSuelo('hueco_libre', 'mini-solar'));
      const r = await dialogo({ titulo: PASOS[i][0], texto: PASOS[i][1], clase: 'tutorial', alCerrar: 'saltar',
        cabecera: el('div', { class: 'tut-cabecera' }, dib, el('div', { class: 'paso', text: 'Paso ' + (i + 1) + ' de ' + PASOS.length })),
        pie: el('div', { class: 'tut-puntos', 'aria-hidden': 'true' }, PASOS.map((_, k) => el('i', { class: k === i ? 'activo' : '' }))),
        botones: [{ texto: 'Saltar', valor: 'saltar', id: 'tut-saltar' }, { texto: ult ? 'Empezar a jugar' : 'Siguiente', valor: 'sig', tipo: 'principal', id: 'tut-siguiente' }] });
      if (r !== 'sig') break;
    }
    if (PARTIDA) { PARTIDA.tutorialHecho = true; guardar(); }
  }

  // ---------- Pantalla de juego ----------
  function pintarJuego(m) {
    const e = PARTIDA;
    const caja = el('div', { class: 'juego', id: 'juego' });
    caja.append(el('div', { class: 'barra-juego' },
      el('button', { class: 'btn secundario barra solo-icono', id: 'btn-menu', 'aria-label': 'Menú', title: 'Menú', onclick: menuJuego }, ico('menu')),
      el('div', { class: 'titulo', id: 'nombre-partida', text: e.nombre }),
      el('button', { class: 'btn-velocidad', id: 'btn-velocidad', 'aria-label': 'Velocidad del tiempo', onclick: cambiarVelocidad }, ico('velocidad'), el('span', { class: 'v-texto', text: 'x' + velocidad() })),
      el('span', { class: 'estado-juego', id: 'estado-juego' })));
    const rec = pintarRecursos(e);
    caja.append(rec);
    // 0.5 · pestañas SOLO con icono (sin texto; el nombre va en aria-label y title). Estadísticas e Inventario con los iconos on/off de Camachin.
    const pest = (id, nombre, icono) => el('button', { class: 'pestana' + (E.vista === id ? ' activa' : ''), id: 'tab-' + id, 'aria-label': nombre, title: nombre,
      onclick: () => { E.vista = id; E.moviendo = null; E.modo = null; pintar(); } }, icono(E.vista === id));
    const nMis = M.misiones(e).filter(x => x.completa && !x.cobrada).length;
    caja.append(el('div', { class: 'pestanas' },
      pest('ciudad', 'Ciudad', () => ico('ciudad')), pest('mapa', 'Mapa', () => ico('mapa')),
      pest('ejercito', 'Ejército', () => el('img', { class: 'ico-pestana', src: 'img/combate/tropas/infanteria_1_retrato.svg', alt: '' })),
      pest('inventario', 'Inventario', on => imgUi('icono_inventario_' + (on ? 'on' : 'off'), 'ico-pestana')),
      el('span', { class: 'pestana-envoltura' }, pest('misiones', 'Misiones', on => imgUi('icono_misiones_' + (on ? 'on' : 'off'), 'ico-pestana')), nMis ? el('b', { class: 'globo', id: 'globo-misiones', text: String(nMis) }) : null),
      pest('estadisticas', 'Estadísticas', on => imgUi('icono_estadisticas_' + (on ? 'on' : 'off'), 'ico-pestana')),
      // 0.7: la tienda pasa a ser un edificio; su botón de la barra es ahora «Informes» (historial permanente de batallas y avisos)
      el('span', { class: 'pestana-envoltura' }, pest('informes', 'Informes', on => imgUi('icono_informes_' + (on ? 'on' : 'off'), 'ico-pestana')), (() => { const k = M.informesNuevos(e); return k && E.vista !== 'informes' ? el('b', { class: 'globo', id: 'globo-informes', text: String(Math.min(99, k)) }) : null; })())));
    caja.append(bannersMilitar(e));
    const zona = el('div', { class: 'zona' + (E.vista === 'ciudad' ? ' zona-ciudad' : ''), id: 'zona' }); caja.append(zona);
    const V = { mapa: pintarMapa, ejercito: pintarEjercito, inventario: pintarInventario, misiones: pintarMisiones, estadisticas: pintarEstadisticas, informes: pintarInformes, campamento: pintarCampamento };
    (V[E.vista] || pintarCiudad)(zona);
    m.append(caja); pintarEstado();
    if (caja.isConnected) { if (E.vista === 'ciudad') colocarVista(); else if (E.vista === 'mapa') colocarMapa(); }
  }

  function pintarRecursos(e) {
    // 0.5 · barra pequeña: SOLO cantidades (el ritmo por minuto y lo «a salvo» están en la pestaña «Estadísticas»)
    const rec = el('div', { class: 'recursos compacta', id: 'recursos' });
    for (const k of J.RECURSOS) {
      const v = N(e.recursos[k]);
      rec.append(el('div', { class: 'recurso', id: 'rec-' + k, 'data-valor': v, title: J.NOMBRE_RECURSO[k], 'aria-label': J.NOMBRE_RECURSO[k] + ': ' + v },
        imgRec(k), el('b', { text: corto(v) })));
    }
    rec.append(el('div', { class: 'recurso', id: 'rec-personas', title: 'Personas libres / total', 'aria-label': 'Personas libres / total' }, imgRec('personas'),
      el('b', { text: J.personasLibres(e) + ' / ' + J.personasTotales(e) })));
    // 0.9 · recurso nuevo «tropa disponible»: plazas libres en las tiendas de campaña / plazas totales
    if (e.militar) { const td = M.tropaDisponible(e), pl = M.plazasTropas(e);
      rec.append(el('div', { class: 'recurso' + (td ? '' : ' agotado'), id: 'rec-tropa', 'data-valor': td, title: 'Tropa disponible (plazas libres / total)', 'aria-label': 'Tropa disponible: ' + td + ' de ' + pl }, imgIcoCamp('icono_tropa_disponible', 'ico-rec'), el('b', { text: corto(td) + ' / ' + corto(pl) }))); }
    return rec;
  }

  // ---------- Ciudad (0.2, pautas de Camachin): terreno de celdas de 32 dp con rejilla dual; edificios de 3×3 celdas ----------
  // El suelo (hierba, manchas, caminos, plaza, arboleda) se pinta una vez en un canvas (js/escenario.js); encima, en el DOM,
  // cada hueco con su asiento, su edificio y su nivel. Normal: los huecos libres y bloqueados no se dibujan.
  // Modos construir / mover: velo noche 22 % sobre la ciudad + overlays de 96 dp + banda inferior con la instrucción.
  const ES = g.CivilikEscenario, TX = g.CivilikTexturas, CEL = TX.medidas.celda, ED = TX.medidas.edificio;
  const ZOOMS = [0.5, 0.75, 1];   // edificio de 48, 72 y 96 dp (nunca por debajo del área táctil mínima); la guía muestra la ciudad a 0,75
  const ZOOMS_MAPA = [0.4, 0.6, 1];   // al abrir (0,6) se ve la ciudad y buena parte de sus alrededores
  const lienzos = {};
  function lienzo(clave, hacer) {
    if (lienzos[clave]) return lienzos[clave];
    const m = hacer(), cv = el('canvas', { class: 'terreno', 'aria-hidden': 'true', 'data-firma': m.firma, 'data-celdas': m.W + 'x' + m.H });
    ES.pintarLienzo(cv, m);
    return (lienzos[clave] = { m, cv });
  }
  const mundoCiudadDe = e => lienzo('c:' + e.id + ':' + e.semilla + ':' + J.huecosDisponibles(e) + ':' + (J.ayto(e) || {}).hueco, () => ES.mundoCiudad(e));
  const IMG_MODO = n => TX.rutas.modos + n + '.svg';
  function pintarCiudad(zona) {
    const e = PARTIDA, disp = J.huecosDisponibles(e), z = zoomCiudadAct(), ocupados = e.edificios.length, construyendo = E.modo === 'construir', mov = E.moviendo ? e.edificios.find(x => x.id === E.moviendo) : null;
    const libres = disp - ocupados, enModo = construyendo || !!mov;
    zona.append(el('div', { class: 'ciudad-barra' },
      enModo ? null : el('button', { class: 'btn principal barra solo-icono', id: 'btn-construir', 'aria-label': 'Construir', title: 'Construir',
        onclick: () => { E.modo = 'construir'; E.tocado = null; pintar(); if (libres < 1) aviso('No quedan huecos libres', 'info', 'Mejora el ayuntamiento para abrir más (hasta ' + J.MAX_HUECOS + ').'); } },
        ico('construir')),
      el('span', { class: 'huecos-texto', id: 'huecos-texto', text: enModo ? libres + ' huecos libres de ' + disp + ' · ayuntamiento nivel ' + J.nivelCiudad(e)
        : 'Huecos: ' + ocupados + ' de ' + disp + ' ocupados · ayuntamiento nivel ' + J.nivelCiudad(e) }),
      el('button', { class: 'btn secundario barra zoom', id: 'zoom-menos', 'aria-label': 'Alejar', text: '−', disabled: z <= ZOOMS[0] + 1e-6, onclick: () => zoom(-1) }),
      el('button', { class: 'btn secundario barra zoom', id: 'zoom-mas', 'aria-label': 'Acercar', text: '+', disabled: z >= ZOOMS[ZOOMS.length - 1] - 1e-6, onclick: () => zoom(1) })));
    const { m, cv } = mundoCiudadDe(e), lado = m.W * CEL;
    const vista = el('div', { class: 'ciudad-vista', id: 'ciudad-vista', onscroll: () => { E.scroll = centroVista(vista); } });
    const c = el('div', { class: 'ciudad' + (enModo ? ' en-modo' : '') + (mov ? ' modo-mover' : construyendo ? ' modo-construir' : ''), id: 'ciudad', 'data-zoom': String(Math.round(z * 1000) / 1000), style: `width:${lado * z}px;height:${lado * z}px;--z:${z}` });
    c.append(cv);
    pintarMuralla(c, e, m, z, disp);
    if (enModo) c.append(el('div', { class: 'velo-modo', id: 'velo-modo', style: 'background:' + TX.veloModo }));
    e.huecos.forEach((h, i) => {
      const b = J.enHueco(e, i), bloq = i >= disp, libre = !bloq && !b, tocado = E.tocado === i && libre, p = m.huecos[i];
      let overlay = null;
      if (construyendo) overlay = bloq ? 'hueco_bloqueado' : libre ? (tocado ? 'hueco_seleccionado' : 'hueco_modo_construir') : null;
      else if (mov) overlay = bloq ? 'hueco_bloqueado' : libre ? 'hueco_valido' : b.id === mov.id ? 'huella_origen_mover' : 'hueco_no_valido';
      else if (tocado) overlay = 'hueco_seleccionado';
      const d = el('div', { class: 'hueco' + (bloq ? ' bloqueado' : '') + (b ? ' ocupado ' + b.tipo : libre ? ' libre' : '') + (mov && libre ? ' destino' : '') + (b && mov && b.id === mov.id ? ' moviendo' : '') + (tocado ? ' seleccionado' : '') + (b && J.skinGrande(b.nivel) ? ' grande' : '') + (overlay || b ? ' visible' : ' oculto'),
        id: 'hueco-' + i, 'data-h': i, 'data-tipo': b ? b.tipo : '', 'data-overlay': overlay || '', role: 'button', 'aria-label': b ? J.EDIFICIOS[b.tipo].nombre + ' nivel ' + b.nivel : bloq ? 'Hueco bloqueado' : 'Hueco libre para construir',
        style: `left:${p.c * CEL * z}px;top:${p.f * CEL * z}px;width:${ED * z}px;height:${ED * z}px`, onclick: () => tocarHueco(i) });
      if (b) {
        if (b.id === E.moviendo) d.append(el('img', { class: 'sombra-levantado', src: IMG_MODO('sombra_edificio_levantado'), alt: '', draggable: 'false' }));
        else d.append(el('img', { class: 'asiento', src: TX.rutas.terreno + 'asientos/' + ES.asientoDe(b.tipo, p.c, p.f) + '.png', alt: '', draggable: 'false' }));
        d.append(imgEdif(b.tipo, 'edif', b.nivel), el('span', { class: 'nivel', text: String(b.nivel), title: J.EDIFICIOS[b.tipo].nombre + ' · nivel ' + b.nivel }));
      }
      if (overlay) d.append(el('img', { class: 'modo ' + overlay, src: IMG_MODO(overlay), alt: '', draggable: 'false' }));
      c.append(d);
    });
    // 0.9 · Campamento en la esquina inferior derecha de la ciudad (fuera de los huecos); tocarlo abre su propio mapa
    { const nc = e.militar ? e.militar.campamento.nivel : 1, lc = 3.2;
      c.append(el('button', { type: 'button', class: 'campamento-ciudad', id: 'btn-campamento', 'aria-label': 'Campamento nivel ' + nc + ' (tiendas de campaña y cabañas de obreros)', title: 'Campamento',
        style: `left:${(m.W - lc - 0.9) * CEL * z}px;top:${(m.H - lc - 0.9) * CEL * z}px;width:${lc * CEL * z}px;height:${lc * CEL * z}px`, onclick: () => { if (enModo) return; E.vista = 'campamento'; E.tocado = null; pintar(); } },
        imgCamp('campamento', nc, 'edif'), el('span', { class: 'nivel', text: String(nc) }))); }
    vista.append(c); zona.append(vista); pellizcoCiudad(vista);
    if (construyendo) zona.append(el('div', { class: 'banda-modo', id: 'banda-modo' }, el('span', { text: 'Modo construir · toca un hueco libre' }),
      el('button', { class: 'btn secundario barra solo-icono', id: 'btn-salir-modo', 'aria-label': 'Salir', title: 'Salir', onclick: () => { E.modo = null; E.tocado = null; pintar(); } }, ico('cerrar'))));
    if (mov) zona.append(el('div', { class: 'banda-modo', id: 'banda-modo' }, el('span', { text: 'Mover ' + J.EDIFICIOS[mov.tipo].nombre + ' · toca un hueco verde' }),
      el('button', { class: 'btn secundario barra solo-icono', id: 'btn-salir-modo', 'aria-label': 'Cancelar', title: 'Cancelar', onclick: () => { E.moviendo = null; pintar(); } }, ico('cerrar'))));
  }
  // 0.6 · Zoom continuo de la ciudad (pellizco y Ctrl + rueda, como el mapa). Los botones − / + saltan entre 48, 72 y 96 dp.
  const ZOOM_CIUDAD = [ZOOMS[0], 1.5];
  const zoomCiudadAct = () => { const z = +E.zoomC; return E.zoomC != null && z >= ZOOM_CIUDAD[0] && z <= ZOOM_CIUDAD[1] ? z : ZOOMS[E.zoom]; };
  function aplicarZoomCiudad(nuevo, fx, fy) {
    const v = $('#ciudad-vista'); if (!v || !PARTIDA) return;
    const z0 = zoomCiudadAct(), z = Math.max(ZOOM_CIUDAD[0], Math.min(ZOOM_CIUDAD[1], nuevo));
    if (fx == null) { fx = v.clientWidth / 2; fy = v.clientHeight / 2; }
    const wx = (v.scrollLeft + fx) / z0, wy = (v.scrollTop + fy) / z0;
    E.zoomC = z; const k = ZOOMS.findIndex(x => Math.abs(x - z) < 1e-6); if (k >= 0) E.zoom = k;
    E.scrollFijo = { wx, wy, fx, fy };
    pintar();
  }
  // Durante el gesto se escala con CSS (fluido); al soltar se vuelve a pintar la ciudad al nuevo tamaño, con el punto entre los dedos fijo
  function pellizcoCiudad(v) {
    let ini = null;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const medio = t => { const r = v.getBoundingClientRect(); return [(t[0].clientX + t[1].clientX) / 2 - r.left, (t[0].clientY + t[1].clientY) / 2 - r.top]; };
    v.addEventListener('touchstart', ev => { if (ev.touches.length === 2) { const [fx, fy] = medio(ev.touches); ini = { d: dist(ev.touches), z: zoomCiudadAct(), fx, fy, nz: zoomCiudadAct() }; ev.preventDefault(); } }, { passive: false });
    v.addEventListener('touchmove', ev => {
      if (!ini || ev.touches.length !== 2) return; ev.preventDefault();
      ini.nz = Math.max(ZOOM_CIUDAD[0], Math.min(ZOOM_CIUDAD[1], ini.z * dist(ev.touches) / Math.max(1, ini.d)));
      const c = $('#ciudad'); if (c) { c.style.transformOrigin = (v.scrollLeft + ini.fx) + 'px ' + (v.scrollTop + ini.fy) + 'px'; c.style.transform = 'scale(' + (ini.nz / ini.z) + ')'; }
    }, { passive: false });
    const fin = ev => { if (ini && ev.touches.length < 2) { const x = ini; ini = null; if (Math.abs(x.nz - x.z) > 1e-3) aplicarZoomCiudad(x.nz, x.fx, x.fy); else { const c = $('#ciudad'); if (c) c.style.transform = ''; } } };
    v.addEventListener('touchend', fin); v.addEventListener('touchcancel', fin);
    v.addEventListener('wheel', ev => { if (!ev.ctrlKey) return; ev.preventDefault(); const r = v.getBoundingClientRect(); aplicarZoomCiudad(zoomCiudadAct() * (ev.deltaY < 0 ? 1.1 : 1 / 1.1), ev.clientX - r.left, ev.clientY - r.top); }, { passive: false });
  }
  // 0.6 · Muralla alrededor de la ciudad (piezas de 32 dp de Camachin sobre las casillas de la ciudad, no sobre la rejilla del terreno),
  // empalizada por fuera y torres / ballestas encima de la muralla (2×2 casillas). Tocarla abre su hoja.
  function pintarMuralla(c, e, m, z, disp) {
    const nm = M.nivelMuralla(e); if (!nm) return;
    const hs = m.huecos.slice(0, disp), W = m.W, H = m.H, cl = (v, a, b) => Math.max(a, Math.min(b, v));
    // 0.7: la muralla crece con su nivel: piezas más gruesas (grosor en casillas) y anillo más ancho (holgura); tramos en datos.js (provisional)
    const T = (DM.murallaTamano || [{ desde: 1, grosor: 1, holgura: 0 }]).filter(t => t.desde <= nm).pop(), gr = T.grosor, hol = T.holgura;
    const x0 = cl(Math.min(...hs.map(p => p.c)) - 2 - hol, 0, W - 1), y0 = cl(Math.min(...hs.map(p => p.f)) - 2 - hol, 0, H - 1);
    const x1 = cl(Math.max(...hs.map(p => p.c)) + 4 + hol, 0, W - 1), y1 = cl(Math.max(...hs.map(p => p.f)) + 4 + hol, 0, H - 1);
    const capa = el('div', { class: 'capa-muralla', id: 'capa-muralla', 'data-nivel': nm, 'data-grosor': gr, 'data-holgura': hol, 'data-anillo': (x1 - x0 + 1) + 'x' + (y1 - y0 + 1) });
    const pieza = (pref, cx, cy, lados, cls = 'pieza-muralla', tam = 1) => capa.append(el('img', { class: cls, src: 'img/muralla/' + pref + lados + '.svg', alt: '', draggable: 'false',
      style: `left:${cx * CEL * z}px;top:${cy * CEL * z}px;width:${CEL * tam * z}px;height:${CEL * tam * z}px` }));
    // piezas de g casillas centradas en la línea del anillo, cada g casillas
    const pasos = (a, b, g) => { const r = []; for (let v = a; v < b - 1e-6; v += g) r.push(v); r.push(b); return r; };
    const anillo = (pref, a0, b0, a1, b1, cls, g = 1) => {
      const o = (1 - g) / 2, xs = pasos(a0, a1, g), ys = pasos(b0, b1, g), mx = g === 1 ? (a0 + a1) >> 1 : xs[xs.length >> 1], my = g === 1 ? (b0 + b1) >> 1 : ys[ys.length >> 1];
      for (const x of xs) for (const y of [b0, b1]) {
        const lados = x === a0 ? (y === b0 ? 'es' : 'ne') : x === a1 ? (y === b0 ? 'so' : 'no') : x === mx ? 'puerta_eo' : 'eo';
        pieza(pref, x + o, y + o, lados, cls, g);
      }
      for (const y of ys.slice(1, -1)) for (const x of [a0, a1]) pieza(pref, x + o, y + o, y === my ? 'puerta_ns' : 'ns', cls, g);
    };
    const asp = M.rangoDe(nm), d = e.militar.defensas || {}, fe = Math.ceil((gr + 1) / 2);
    if (d.empalizada > 0 && x0 - fe >= 0 && y0 - fe >= 0 && x1 + fe <= W - 1 && y1 + fe <= H - 1) anillo('empalizada_', x0 - fe, y0 - fe, x1 + fe, y1 + fe, 'pieza-muralla empalizada');
    anillo('muralla_' + asp + '_', x0, y0, x1, y1, 'pieza-muralla', gr);
    // torres en las esquinas y ballestas en los cuartos de cada lado (como mucho 4 + 4 dibujadas; la fuerza cuenta todas)
    const esquinas = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]], lados = [[(x0 * 3 + x1) >> 2, y0], [(x0 + x1 * 3) >> 2, y1], [x0, (y0 * 3 + y1) >> 2], [x1, (y0 + y1 * 3) >> 2]];
    for (let i = 0; i < Math.min(4, d.torre || 0); i++) pieza('torre_defensa_', esquinas[i][0] - 0.5, esquinas[i][1] - 1, asp, 'defensa-ciudad torre', 2);
    for (let i = 0; i < Math.min(4, d.ballesta || 0); i++) pieza('ballesta_', lados[i][0] - 0.5, lados[i][1] - 1, asp, 'defensa-ciudad ballesta', 2);
    capa.onclick = ev => { if (ev.target !== capa) abrirHoja(hojaMuralla); };
    c.append(capa);
  }
  function centroVista(v) { return { x: (v.scrollLeft + v.clientWidth / 2) / v.scrollWidth, y: (v.scrollTop + v.clientHeight / 2) / v.scrollHeight }; }
  function colocarVista() {
    const v = $('#ciudad-vista'); if (!v) return;
    if (E.scrollFijo) { const f = E.scrollFijo, z = zoomCiudadAct(); E.scrollFijo = null; v.scrollLeft = f.wx * z - f.fx; v.scrollTop = f.wy * z - f.fy; E.scroll = centroVista(v); return; }
    let p = E.scroll;
    if (!p) { const { m } = mundoCiudadDe(PARTIDA), a = m.huecos[(J.ayto(PARTIDA) || { hueco: 0 }).hueco]; p = { x: (a.c + 1.5) / m.W, y: (a.f + 1.5) / m.H }; }
    v.scrollLeft = p.x * v.scrollWidth - v.clientWidth / 2; v.scrollTop = p.y * v.scrollHeight - v.clientHeight / 2;
    E.scroll = centroVista(v);
  }
  function zoom(d) {
    const v = $('#ciudad-vista'); if (v) E.scroll = centroVista(v);
    const z = zoomCiudadAct(), k = d > 0 ? ZOOMS.findIndex(x => x > z + 1e-6) : ZOOMS.map((x, i) => x < z - 1e-6 ? i : -1).filter(i => i >= 0).pop();
    if (k == null || k < 0) return;
    E.zoom = k; E.zoomC = null; pintar();
  }

  // ---------- 0.5 · Mapa del mundo: 100×100 casillas, zoom por pellizco (y − / +), monstruos, ciudades enemigas y zonas de farmeo ----------
  const TW = TX.mundo, TAMW = TW.tam;
  const TERRENO = { a: 'Agua', l: 'Llanura', b: 'Bosque', p: 'Colinas', m: 'Montaña' };
  const COLOR_LEYENDA = { a: TX.colores.agua, l: TX.colores.hierba, b: TX.colores.bosque, p: TX.colores.sombraBorde, m: TX.colores.roca };
  const zoomMapaAct = () => { const z = +E.zoomMapa; return z >= TW.zoom[0] && z <= TW.zoom[1] ? z : TW.zoomInicial; };
  const mundoDe = e => lienzos['w:' + e.semilla] || (lienzos['w:' + e.semilla] = { mg: ES.mundoGrande(e) });
  function pintarMapa(zona) {
    const e = PARTIDA, z = zoomMapaAct(), W0 = mundoDe(e), mg = W0.mg;
    if (!W0.caja) W0.caja = ES.pintarMundo(mg);
    zona.classList.add('zona-ciudad');
    // 0.7 · una sola línea: filtros (solo icono) + zoom; sin leyenda ni texto debajo → el mapa gana alto (mismas casillas, más área visible)
    const F = filtros();
    const chip = (k, icono, nombre) => el('button', { type: 'button', class: 'chip-filtro solo-icono' + (F[k] ? ' on' : ''), id: 'filtro-' + k, 'data-icono': icono, 'data-nombre': nombre, 'aria-pressed': F[k] ? 'true' : 'false', 'aria-label': (F[k] ? 'Ocultar ' : 'Mostrar ') + nombre.toLowerCase(), title: nombre,
      onclick: () => alternarFiltro(k) }, imgUi('icono_filtro_' + icono + '_' + (F[k] ? 'on' : 'off'), 'ico-filtro'));
    zona.append(el('div', { class: 'ciudad-barra barra-mapa' },
      el('div', { class: 'filtros-mapa', id: 'filtros-mapa', role: 'group', 'aria-label': 'Mostrar en el mapa' }, chip('zonas', 'farmeo', 'Farmeo'), chip('monstruos', 'monstruos', 'Monstruos'), chip('enemigos', 'enemigos', 'Enemigos')),
      // 0.9 · desde el nivel 30 del jugador (= nivel del ayuntamiento) no se ven los monstruos de nivel < 30
      (() => { const O = DM.ocultarMonstruos, nj = M.nivelJugador(e), n = O && nj >= O.desdeNivelJugador ? e.militar.monstruos.filter(mo => M.monstruoOculto(e, mo)).length : 0;
        return n ? el('button', { type: 'button', class: 'nota-ocultos', id: 'monstruos-ocultos', text: 'nv < ' + O.menoresDe + ' ocultos', 'aria-label': n + ' monstruos de nivel menor que ' + O.menoresDe + ' ocultos',
          onclick: () => aviso('Monstruos de nivel < ' + O.menoresDe + ' ocultos', 'info', 'Eres nivel ' + nj + ' (el nivel del jugador es el de tu ayuntamiento). Desde el nivel ' + O.desdeNivelJugador + ' ya no se ven los ' + n + ' monstruos pequeños; los legendarios y los que estás atacando, sí.') }) : null; })(),
      el('button', { class: 'btn secundario barra zoom', id: 'mapa-zoom-menos', 'aria-label': 'Alejar el mapa', text: '−', disabled: z <= TW.zoom[0] + 1e-6, onclick: () => zoomMapa(1 / 1.3) }),
      el('button', { class: 'btn secundario barra zoom', id: 'mapa-zoom-mas', 'aria-label': 'Acercar el mapa', text: '+', disabled: z >= TW.zoom[1] - 1e-6, onclick: () => zoomMapa(1.3) })));
    const vista = el('div', { class: 'ciudad-vista mapa-vista', id: 'mapa-vista', onscroll: () => { E.scrollMapa = centroVista(vista); } });
    const caja = el('div', { class: 'mapa-zona' + (F.zonas ? '' : ' sin-zonas') + (F.monstruos ? '' : ' sin-monstruos') + (F.enemigos ? '' : ' sin-enemigos'), id: 'mapa', 'data-casillas': mg.N + 'x' + mg.N, 'data-zoom': String(Math.round(z * 1000) / 1000), 'data-firma': firmaMapa(e.militar), style: `width:${mg.lado * z}px;height:${mg.lado * z}px` });
    W0.caja.style.transform = 'scale(' + z + ')'; caja.append(W0.caja);
    const capa = el('div', { class: 'capa-sprites', id: 'mapa-sprites' }); caja.append(capa);
    tokensMundo(capa, mg);
    colocarSprites(capa, z);
    vista.append(caja);
    pellizco(vista);
    const marco = el('div', { class: 'mapa-marco', id: 'mapa-marco' }, vista);
    const rc = recuadroMarchas(e); if (rc) marco.append(rc);
    zona.append(marco);
  }
  // 0.7 (bug de los filtros): el clic usaba el estado de cuando se pintó el mapa (F[k] cerrado en el closure) y a la segunda vez no cambiaba nada.
  // Ahora se lee siempre el estado actual y se aplica a la caja y al botón que haya en pantalla en ese momento.
  function alternarFiltro(k) {
    const act = filtros(); E.filtros = { ...act, [k]: !act[k] }; const on = E.filtros[k];
    const cj = $('#mapa'); if (cj) cj.classList.toggle('sin-' + k, !on);
    const b = $('#filtro-' + k); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.setAttribute('aria-label', (on ? 'Ocultar ' : 'Mostrar ') + b.dataset.nombre.toLowerCase()); const im = b.querySelector('img'); if (im) im.src = 'img/ui/icono_filtro_' + b.dataset.icono + '_' + (on ? 'on' : 'off') + '.svg'; }
  }
  // 0.7 · recuadro sobre el mapa con lo que le queda a cada ejército en marcha y el botón «Acelerar» (pociones de velocidad)
  function recuadroMarchas(e) {
    const m = e.militar, ms = (m.marchas || []), xs = m.expediciones.filter(x => x.idaMs > 0);
    if (!ms.length && !xs.length) return null;
    return el('div', { class: 'recuadro-marchas', id: 'recuadro-marchas' },
      ms.map(x => el('div', { class: 'fila-marcha', id: 'fila-marcha-' + x.id },
        el('span', { class: 'txt-marcha' }, el('b', { text: (x.fase === 'ida' ? '⚔ ' : '↩ ') + x.nombre }), el('span', { class: 'tiempo-marcha', id: 'tiempo-marcha-' + x.id, text: minutosTxt(Math.max(0, x.restanteMs)) })),
        el('button', { class: 'btn oro mini-btn', id: 'acelerar-' + x.id, 'aria-label': 'Acelerar la marcha a ' + x.nombre, onclick: () => abrirHoja(h => hojaAcelerar(h, x.id)) }, imgPocion('velocidad_p', 'ico-coste'), 'Acelerar'))),
      xs.map(x => { const ps = M.posicionMarcha(e, x);
        return el('div', { class: 'fila-marcha recogida', id: 'fila-recogida-' + x.zona },
          el('span', { class: 'txt-marcha' }, el('b', { text: (ps.fase === 'vuelta' ? '↩ ' : ps.fase === 'recogiendo' ? '⛏ ' : '→ ') + DM.zonas.recursos[x.recurso].nombre }), el('span', { class: 'tiempo-marcha', id: 'tiempo-recogida-' + x.zona, text: minutosTxt(ps.restanteMs) })),
          el('button', { class: 'btn oro mini-btn', id: 'acelerar-' + x.id, 'aria-label': 'Acelerar la marcha de los obreros', onclick: () => abrirHoja(h => hojaAcelerar(h, x.id)) }, imgPocion('velocidad_p', 'ico-coste'), 'Acelerar')); }));
  }
  function hojaAcelerar(h, id) {
    const e = PARTIDA, m = e.militar, xp = m.expediciones.find(y => y.id === id), x = (m.marchas || []).find(y => y.id === id) || (xp ? { ...xp, nombre: DM.zonas.recursos[xp.recurso].nombre, fase: xp.fase } : null);
    h.append(cabeceraHoja(xp ? 'Acelerar a los obreros' : 'Acelerar la marcha', x ? (x.fase === 'ida' ? 'Hacia ' : x.fase === 'trabajando' ? 'Trabajando en ' : 'Vuelve de ') + x.nombre + ' · faltan ' + minutosTxt(Math.max(0, x.restanteMs)) : 'Ese ejército ya ha llegado', 'hoja-titulo'));
    if (!x) return;
    h.append(el('p', { class: 'sub', text: xp ? 'Cada poción de velocidad recorta su porcentaje de la marcha que les queda (ida y vuelta; mientras trabajan, la vuelta).' : 'Cada poción de velocidad recorta su porcentaje del tiempo que le queda' + (x.fase === 'ida' ? ' (y también el de la vuelta).' : '.') }));
    for (const p of DM.acelerarMarcha) {
      const n = m.pociones[p] || 0, r = M.puedeAcelerarMarcha(e, id, p), pct = Math.round(DM.pociones[p].pct * 100);
      h.append(el('div', { class: 'tarjeta-clara fila-pocion' + (r.ok ? '' : ' no'), id: 'acel-' + p }, imgPocion(p, 'ico-mil'),
        el('div', { class: 'txt' }, el('b', { text: DM.pociones[p].nombre }), el('span', { class: 'sub', text: '−' + pct + ' % · tienes ' + n })),
        el('button', { class: 'btn oro mini-btn', id: 'usar-acel-' + p, disabled: !r.ok, title: r.ok ? '' : r.motivo, onclick: () => { const q = M.acelerarMarcha(e, id, p); if (!q.ok) return aviso(q.motivo, 'aviso'); guardar(); cerrarHoja(); pintar(); aviso('Marcha acelerada', 'exito', '−' + minutosTxt(q.ahorroMs) + ' · faltan ' + minutosTxt(q.restanteMs)); } }, 'Usar')));
    }
  }
  const filtros = () => ({ zonas: true, monstruos: true, enemigos: true, ...(E.filtros || {}) });
  // Sprites en coordenadas del mundo (dp a zoom 1); se recolocan al cambiar el zoom sin repintar el terreno
  function spriteW(capa, { cx, cy, tam, img, id, clase, nivel, etiqueta, onclick, chip }) {
    const b = el(onclick ? 'button' : 'div', { class: 'sprite ' + clase, id, 'aria-label': etiqueta, title: etiqueta, onclick, 'data-cx': cx, 'data-cy': cy, 'data-tam': tam }, img);
    if (nivel != null) b.append(el('span', { class: 'nivel-sprite', text: String(nivel) }));
    if (chip) b.append(el('span', { class: 'chip-sprite', text: chip }));
    capa.append(b); return b;
  }
  function colocarSprites(capa, z) {
    const minimo = z >= 0.5 ? 48 : 34;
    for (const b of capa.children) {
      if (b.classList.contains('flecha-marcha')) { colocarFlecha(b, z); continue; }
      if (+b.dataset.tam === 0) { b.style.left = (+b.dataset.cx * z) + 'px'; b.style.top = (+b.dataset.cy * z) + 'px'; continue; }   // rótulos
      const cx = +b.dataset.cx * z, cy = +b.dataset.cy * z, t = Math.max(minimo, +b.dataset.tam * z), pie = b.classList.contains('centrado') ? 0.5 : 0.87;
      b.style.cssText = `left:${cx - t / 2}px;top:${cy - t * pie}px;width:${t}px;height:${t}px;z-index:${10 + Math.round(cy)}`;
    }
  }
  // 0.7 · flecha de la marcha: de tu ciudad al destino, girada; las tropas avanzan encima según lo que llevan andado
  function colocarFlecha(b, z) {
    const x0 = +b.dataset.x0 * z, y0 = +b.dataset.y0 * z, x1 = +b.dataset.x1 * z, y1 = +b.dataset.y1 * z, L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
    b.style.cssText = `left:${x0}px;top:${y0}px;width:${Math.max(0, L)}px;transform:rotate(${a}rad);z-index:9`;
  }
  function datosMarcha(e, mg, x) {
    const C = mg.C, o = { x: mg.capital.x, y: mg.capital.y + C * 0.5 };
    const z = x.objetivo != null ? null : e.militar.zonas.find(q => q.id === x.zona);
    const d = x.objetivo != null ? { x: (x.x + 0.5) * C, y: (x.y + 0.5) * C } : z ? { x: (z.x + 0.5) * C, y: (z.y + 0.5) * C } : o;
    const ps = M.posicionMarcha(e, x);
    return { o, d, ps, p: { x: o.x + (d.x - o.x) * ps.fraccion, y: o.y + (d.y - o.y) * ps.fraccion } };
  }
  const claseMarcha = x => { const t = M.TIPOS_TROPA.filter(k => (x.tropas || {})[k] > 0).sort((a, b) => x.tropas[b] - x.tropas[a])[0]; return t || 'infanteria'; };
  const obreroMarcha = x => M.OBREROS.filter(k => (x.obreros || {})[k] > 0).sort((a, b) => DM.obreros[b].carga - DM.obreros[a].carga)[0] || 'obrero_basico';
  function flechasMarcha(capa, mg) {
    const e = PARTIDA, m = e.militar, lista = (m.marchas || []).map(x => ({ x, id: 'm-' + x.id })).concat(m.expediciones.filter(x => x.idaMs > 0).map(x => ({ x, id: 'r-' + x.zona })));
    for (const { x, id } of lista) {
      const { o, d, ps, p } = datosMarcha(e, mg, x), vuelta = ps.fase === 'vuelta';
      capa.append(el('div', { class: 'flecha-marcha' + (vuelta ? ' vuelta' : '') + (x.objetivo == null ? ' recogida' : ''), id: 'flecha-' + id, 'aria-hidden': 'true', 'data-x0': vuelta ? d.x : o.x, 'data-y0': vuelta ? d.y : o.y, 'data-x1': vuelta ? o.x : d.x, 'data-y1': vuelta ? o.y : d.y, 'data-tam': 0 }, el('i', { class: 'punta' })));
      const t = claseMarcha(x), img = x.objetivo == null ? imgObrero(obreroMarcha(x), 'escuadra', 'img-sprite') : DM.tropas[t] ? imgTropa(t, 'escuadra', 'img-sprite') : imgC('tropas/infanteria_1_escuadra', 'img-sprite');
      const s = spriteW(capa, { cx: p.x, cy: p.y, tam: TAMW.escuadra * 0.8, img, id: 'tropas-' + id, clase: 'tropas-marcha centrado', etiqueta: 'Tus tropas en marcha · faltan ' + minutosTxt(ps.restanteMs) });
      s.append(el('span', { class: 'chip-sprite chip-marcha', text: minutosTxt(ps.restanteMs) }));
    }
  }
  const imgMundo = (ruta, cls) => el('img', { class: cls || 'img-sprite', src: TX.rutas.mundo + ruta + '.svg', alt: '', draggable: 'false' });
  // 0.8: las conquistadas usan la ciudad conquistada de Camachin (0.7 extras); las zonas no tienen nivel: su aspecto (1–3) elige el dibujo
  const imgCiudadEnemiga = (c, cls) => imgMundo('ciudades/' + (c.conquistada ? 'ciudad_conquistada_' + M.rangoDe(c.nivel) : 'ciudad_enemiga_' + M.rangoDe(c.nivel) + (c.recuperaMs > 0 ? '_derrotada' : '')), cls);
  const imgZona = (z, cls) => imgMundo('zonas/zona_farmeo_' + z.recurso + '_' + (z.aspecto || (z.nivel ? M.rangoDe(z.nivel) : 1)), cls);
  function tokensMundo(capa, mg) {
    const e = PARTIDA, m = e.militar, C = mg.C, pos = (x, y, pie = 0.85) => ({ cx: (x + 0.5) * C, cy: (y + pie) * C });
    // tu ciudad (ayuntamiento con su skin) y su nombre
    const ay = J.ayto(e);
    // 0.8: tocar tu ciudad abre la pestaña de la ciudad
    spriteW(capa, { ...pos(mg.capital.c, mg.capital.f, 1.1), tam: TAMW.capital, img: imgEdif('ayuntamiento', 'img-sprite', ay ? ay.nivel : 1), id: 'sprite-capital', clase: 'capital', etiqueta: e.nombre + ' (abrir tu ciudad)',
      onclick: () => { E.vista = 'ciudad'; E.moviendo = null; E.modo = null; pintar(); } });
    const nom = el('span', { class: 'mapa-nombre', id: 'mapa-capital', text: e.nombre, 'data-cx': mg.capital.x, 'data-cy': mg.capital.y + C * 1.9, 'data-tam': 0 }); nom.classList.add('centrado'); capa.append(nom);
    for (const z of m.zonas) {
      const x = m.expediciones.find(y => y.zona === z.id);
      spriteW(capa, { ...pos(z.x, z.y, 0.5), tam: TAMW.zona, img: imgZona(z), id: 'zona-' + z.id, clase: 'zona-farmeo centrado' + (x ? ' ocupada' : ''),
        etiqueta: DM.zonas.recursos[z.recurso].nombre + ' · ' + J.NOMBRE_RECURSO[z.recurso].toLowerCase() + (x ? ' · obreros trabajando' : ' · manda obreros'), chip: x ? minutosTxt(Math.max(0, x.restanteMs)) : null,
        onclick: () => { E.recogida = null; abrirHoja(h => hojaZona(h, z.id)); } });
    }
    for (const c of m.ciudades) {
      const s = spriteW(capa, { ...pos(c.x, c.y, 0.5), tam: TAMW.ciudad, img: imgCiudadEnemiga(c), id: 'ciudad-' + c.id, clase: 'ciudad-enemiga centrado' + (c.recuperaMs > 0 ? ' derrotada' : '') + (c.conquistada ? ' conquistada' : '') + (c.guerra ? ' en-guerra' : ''), nivel: c.nivel,
        etiqueta: c.nombre + (c.conquistada ? ' (conquistada: es tuya)' : ' (ciudad enemiga' + (c.guerra ? ', en guerra' : '') + ')') + ' nivel ' + c.nivel + ', fuerza ' + c.fuerza, chip: c.conquistada ? 'Tuya' : c.recuperaMs > 0 ? minutosTxt(c.recuperaMs) : c.guerra && c.ataqueMs <= DM.guerra.avisoMin * 60000 ? '⚔ ' + minutosTxt(c.ataqueMs) : null, onclick: () => { E.ataque = null; abrirHoja(h => hojaAtaque(h, c.id)); } });
      if (c.guerra || c.conquistada) s.append(imgUi(c.conquistada ? 'icono_conquista' : 'icono_guerra', 'marca-diplomacia'));
    }
    // 0.6 · marchas en camino (Clásica): marca sobre el objetivo con el tiempo que falta
    flechasMarcha(capa, mg);
    for (const x of m.marchas || []) spriteW(capa, { cx: (x.x + 0.5) * C, cy: (x.y - 0.2) * C, tam: 0, img: el('span', { class: 'marcha-chip', text: (x.fase === 'ida' ? '⚔ ' : '↩ ') + minutosTxt(Math.max(0, x.restanteMs)) }), id: 'marcha-' + x.id, clase: 'marcha-mapa centrado', etiqueta: 'Tu ejército ' + (x.fase === 'ida' ? 'va hacia ' : 'vuelve de ') + x.nombre });
    for (const mo of m.monstruos) {
      if (M.monstruoOculto(e, mo)) continue;   // 0.9: desde el nivel 30 del jugador (ayuntamiento) no se ven los de nivel < 30
      const d = M.datosMonstruo(mo);
      spriteW(capa, { ...pos(mo.x, mo.y), tam: d.jefe || mo.legendario ? TAMW.jefe : TAMW.monstruo, img: imgMonstruo(mo, 'mapa', 'img-sprite'), id: 'monstruo-' + mo.id, clase: 'monstruo' + (d.jefe ? ' jefe' : '') + (mo.legendario ? ' legendario' : ''), nivel: mo.nivel,
        etiqueta: (mo.legendario ? 'Legendario: ' : '') + d.nombre + ' nivel ' + mo.nivel + ', fuerza ' + mo.fuerza, onclick: () => { E.ataque = null; abrirHoja(h => hojaAtaque(h, mo.id)); } });
    }
    // tu ejército acampado al sur de la ciudad (solo se ve): una escuadra por clase y los héroes listos
    const clases = Object.keys(DM.clases).filter(c => M.TIPOS_TROPA.some(t => DM.tropas[t].clase === c && m.tropas[t] > 0));
    clases.forEach((c, i) => { const t = M.TIPOS_TROPA.find(x => DM.tropas[x].clase === c);
      spriteW(capa, { cx: mg.capital.x + (i - 1) * C * 1.6, cy: mg.capital.y + C * 3.2, tam: TAMW.escuadra, img: imgTropa(t, 'escuadra', 'img-sprite'), id: 'escuadra-' + c, clase: 'escuadra', etiqueta: 'Tus ' + DM.clases[c].toLowerCase() }); });
    m.heroes.filter(h => M.estadoHeroe(h) === 'listo').slice(0, 5).forEach((h, i) =>
      spriteW(capa, { cx: mg.capital.x + (i - 2) * C * 1.1, cy: mg.capital.y + C * 4.4, tam: TAMW.heroe, img: imgHeroe(h, 'mapa', 'img-sprite'), id: 'sprite-heroe-' + h.id, clase: 'heroe-mapa', nivel: h.nivel, etiqueta: h.nombre }));
  }
  const firmaMapa = m => m.monstruos.map(x => x.id).concat(m.ciudades.map(c => c.id + (c.recuperaMs > 0 ? '*' : '') + (c.guerra ? 'g' : '') + (c.conquistada ? 'c' : '')), m.zonas.map(z => z.id), m.expediciones.map(x => x.zona), (m.marchas || []).map(x => x.id + x.fase)).join(',');
  function refrescarMapa() {
    const m = PARTIDA.militar, caja = $('#mapa'); if (!caja) return;
    const f = firmaMapa(m);
    if (caja.dataset.firma && caja.dataset.firma !== f) { if (!hojaRender) pintar(); return; }
    caja.dataset.firma = f;
    for (const x of m.expediciones) { const c = $('#zona-' + x.zona + ' .chip-sprite'); if (c) c.textContent = minutosTxt(Math.max(0, x.restanteMs)); }
    for (const c of m.ciudades) { const s = $('#ciudad-' + c.id + ' .chip-sprite'); if (s && !c.conquistada) s.textContent = minutosTxt(c.recuperaMs); }
    for (const x of m.marchas || []) { const s = $('#marcha-' + x.id + ' .marcha-chip'); if (s) s.textContent = (x.fase === 'ida' ? '⚔ ' : '↩ ') + minutosTxt(Math.max(0, x.restanteMs)); }
    // 0.7: tropas avanzando por la flecha y tiempos del recuadro
    const mg = mundoDe(PARTIDA).mg, z = zoomMapaAct(), capa = $('#mapa-sprites'); let mover = false;
    for (const [x, id] of (m.marchas || []).map(x => [x, 'm-' + x.id]).concat(m.expediciones.filter(x => x.idaMs > 0).map(x => [x, 'r-' + x.zona]))) {
      const t = $('#tropas-' + id); const { p, ps } = datosMarcha(PARTIDA, mg, x);
      if (t) { t.dataset.cx = p.x; t.dataset.cy = p.y; mover = true; const c = t.querySelector('.chip-marcha'); if (c) c.textContent = minutosTxt(ps.restanteMs); }
      const f = $('#flecha-' + id); if (f && f.classList.contains('vuelta') !== (ps.fase === 'vuelta')) { if (!hojaRender) pintar(); return; }
      const r = $(x.objetivo != null ? '#tiempo-marcha-' + x.id : '#tiempo-recogida-' + x.zona); if (r) r.textContent = minutosTxt(ps.restanteMs);
    }
    if (mover && capa) colocarSprites(capa, z);
  }
  function colocarMapa() {
    const v = $('#mapa-vista'); if (!v) return;
    const mg = mundoDe(PARTIDA).mg, p = E.scrollMapa || { x: mg.capital.x / mg.lado, y: (mg.capital.y + mg.C) / mg.lado };   // la ciudad en el centro
    v.scrollLeft = p.x * v.scrollWidth - v.clientWidth / 2; v.scrollTop = p.y * v.scrollHeight - v.clientHeight / 2;
    E.scrollMapa = centroVista(v);
  }
  // Cambia el zoom manteniendo fijo el punto (fx, fy) de la vista (por defecto, el centro). Sin repintar: escala el terreno y recoloca los sprites.
  function aplicarZoomMapa(nuevo, fx, fy) {
    const v = $('#mapa-vista'), caja = $('#mapa'); if (!v || !caja || !PARTIDA) return;
    const W0 = mundoDe(PARTIDA), z0 = zoomMapaAct(), z = Math.max(TW.zoom[0], Math.min(TW.zoom[1], nuevo));
    if (fx == null) { fx = v.clientWidth / 2; fy = v.clientHeight / 2; }
    const wx = (v.scrollLeft + fx) / z0, wy = (v.scrollTop + fy) / z0;
    E.zoomMapa = z;
    caja.style.width = caja.style.height = (W0.mg.lado * z) + 'px';
    W0.caja.style.transform = 'scale(' + z + ')';
    colocarSprites($('#mapa-sprites'), z);
    v.scrollLeft = wx * z - fx; v.scrollTop = wy * z - fy;
    E.scrollMapa = centroVista(v);
    const menos = $('#mapa-zoom-menos'), mas = $('#mapa-zoom-mas');
    if (menos) menos.disabled = z <= TW.zoom[0] + 1e-6; if (mas) mas.disabled = z >= TW.zoom[1] - 1e-6;
    $('#mapa').dataset.zoom = String(Math.round(z * 1000) / 1000);
  }
  function zoomMapa(f) { aplicarZoomMapa(zoomMapaAct() * f); }
  // Pellizco con dos dedos (y Ctrl + rueda en el ordenador). touch-action: pan-x pan-y deja el desplazamiento al navegador.
  function pellizco(v) {
    let ini = null;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const medio = t => { const r = v.getBoundingClientRect(); return [(t[0].clientX + t[1].clientX) / 2 - r.left, (t[0].clientY + t[1].clientY) / 2 - r.top]; };
    v.addEventListener('touchstart', ev => { if (ev.touches.length === 2) { ini = { d: dist(ev.touches), z: zoomMapaAct() }; ev.preventDefault(); } }, { passive: false });
    v.addEventListener('touchmove', ev => {
      if (!ini || ev.touches.length !== 2) return; ev.preventDefault();
      const [fx, fy] = medio(ev.touches); aplicarZoomMapa(ini.z * dist(ev.touches) / Math.max(1, ini.d), fx, fy);
    }, { passive: false });
    const fin = ev => { if (ev.touches.length < 2) ini = null; };
    v.addEventListener('touchend', fin); v.addEventListener('touchcancel', fin);
    v.addEventListener('wheel', ev => { if (!ev.ctrlKey) return; ev.preventDefault(); const r = v.getBoundingClientRect(); aplicarZoomMapa(zoomMapaAct() * (ev.deltaY < 0 ? 1.1 : 1 / 1.1), ev.clientX - r.left, ev.clientY - r.top); }, { passive: false });
  }
  function tocarHueco(i) {
    const e = PARTIDA, b = J.enHueco(e, i), disp = J.huecosDisponibles(e);
    if (E.moviendo) {
      if (b && b.id === E.moviendo) { E.moviendo = null; return pintar(); }
      const r = J.mover(e, E.moviendo, i); if (!r.ok) return aviso(r.motivo, 'aviso');
      E.moviendo = null; guardar(); pintar(); return aviso('Edificio movido', 'exito');
    }
    if (b) return abrirHoja(h => hojaEdificio(h, b.id));
    if (i >= disp) return aviso('Hueco bloqueado', 'info', 'Se abre al mejorar el ayuntamiento (hasta ' + J.MAX_HUECOS + ' huecos con el nivel 30).');
    E.tocado = i; pintar();   // el sitio tocado se marca con su solar mientras la hoja está abierta
    abrirHoja(h => hojaConstruir(h, i));
  }
  function describir(tipo, nivel) {
    const d = J.EDIFICIOS[tipo], i = nivel - 1;
    if (tipo === 'casa') return 'Da ' + d.da[i] + ' personas (no necesita trabajadores)';
    const fm = PARTIDA ? J.factorModo(PARTIDA) : 1;
    if (tipo === 'deposito') return '+' + Math.round(d.aSalvo[i] * fm).toLocaleString('es-ES') + ' a salvo de cada recurso (≈ ' + String(d.horasAlmacen || 3.5).replace('.', ',') + ' h de una granja) · ' + d.trab[i] + ' persona' + (d.trab[i] > 1 ? 's' : '') + ' máx.';
    if (tipo === 'fundicion') return num(d.ritmo[i] * fm) + ' metal/min a pleno (' + d.trab[i] + ' personas) · gasta ' + num(d.ritmo[i] * 2 * fm) + ' hierro/min';
    if (DM.edificios[tipo]) return describirMilitar(tipo, nivel);
    if (d.produce) return num(d.ritmo[i] * fm) + ' ' + J.NOMBRE_RECURSO[d.produce].toLowerCase() + '/min a pleno (' + d.trab[i] + ' personas)';
    return '';
  }
  // Botón «Máx» de Camachin (boton_max / boton_max_desactivado), solo icono
  const botonMax = (id, ok, etiqueta, onclick) => el('button', { class: 'btn-max', id, 'aria-label': etiqueta, title: etiqueta, disabled: !ok, onclick }, imgUi(ok ? 'boton_max' : 'boton_max_desactivado', 'img-max'));
  const cabeceraHoja = (titulo, sub, id) => el('div', { class: 'hoja-cabecera' }, el('div', {}, el('h2', { id, text: titulo }), sub ? el('p', { class: 'sub', text: sub }) : null),
    el('button', { class: 'btn-icono', id: 'hoja-cerrar', 'aria-label': 'Cerrar', onclick: cerrarHoja }, ico('cerrar')));
  function hojaConstruir(h, i) {
    h.append(cabeceraHoja('Construir en el hueco ' + (i + 1), 'Instantáneo si tienes los recursos.'));
    for (const t of J.CONSTRUIBLES) {
      const d = J.EDIFICIOS[t], p = J.puedeConstruir(PARTIDA, t, i);
      h.append(el('div', { class: 'opcion-edif tarjeta-clara' + (p.ok ? '' : ' no'), 'data-tipo': t },
        el('div', { class: 'mini' }, imgSuelo('solar_edificio', 'mini-solar'), imgEdif(t, 'mini-edif')),
        el('div', { class: 'datos' }, el('div', { class: 'nombre-edif', text: d.nombre }), el('div', { class: 'sub', text: describir(t, 1) }),
          el('div', { class: 'coste', 'aria-label': 'Coste: ' + textoCoste(d.coste[0]) }, costeIconos(d.coste[0])),
          !p.ok ? el('div', { class: 'motivo', text: p.motivo }) : null),
        el('button', { class: 'btn principal', id: 'construir-' + t, text: 'Construir', disabled: !p.ok, onclick: () => {
          const r = J.construir(PARTIDA, t, i); if (!r.ok) return aviso(r.motivo, 'aviso');
          E.modo = null; cerrarHoja(); guardar(); pintar(); aviso(d.nombre + ' construida', 'exito', describir(t, 1) + '.');
        } })));
    }
  }
  function hojaEdificio(h, id) {
    const e = PARTIDA, b = e.edificios.find(x => x.id === id); if (!b) return;
    const d = J.EDIFICIOS[b.tipo];
    h.append(el('div', { class: 'hoja-cabecera' }, el('div', { class: 'mini' }, imgSuelo('solar_edificio', 'mini-solar'), imgEdif(b.tipo, 'mini-edif', b.nivel)),
      el('div', { style: 'flex:1;min-width:0' }, el('h2', { id: 'hoja-titulo', text: d.nombre + ' · nivel ' + b.nivel })),
      el('button', { class: 'btn-icono', id: 'hoja-cerrar', 'aria-label': 'Cerrar', onclick: cerrarHoja }, ico('cerrar'))));
    if (b.tipo === 'ayuntamiento') {
      h.append(el('p', { text: 'Edificio principal. Marca el nivel máximo de la ciudad. Huecos: ' + d.huecos[b.nivel - 1] + ' de ' + J.MAX_HUECOS + '. A salvo: ' + d.aSalvo[b.nivel - 1] + ' de cada recurso. No se puede demoler; sí mover.' }));
    } else h.append(el('p', { text: describir(b.tipo, b.nivel) }));
    if (J.necesitaPersonas(b.tipo)) {
      const qp = J.quitarPersona(JSON.parse(JSON.stringify(e)), id), pp = J.ponerPersona(JSON.parse(JSON.stringify(e)), id);
      h.append(el('div', { class: 'tarjeta-clara' }, el('div', { class: 'fila' }, imgRec('personas', 'ico-coste'), el('span', { text: 'Personas trabajando: ' }), el('b', { id: 'personas-edif', text: b.personas + ' / ' + J.maxTrab(b) })),
        J.EDIFICIOS[b.tipo].produce ? el('div', { class: 'sub', text: 'Produce ahora ' + Math.round(J.ritmoEdificio(b, e) * 10) / 10 + '/min' }) : null,
        el('div', { class: 'fila', style: 'margin-top:8px' },
          el('button', { class: 'btn secundario', id: 'btn-quitar-persona', text: '− Quitar persona', disabled: !qp.ok, onclick: () => accion(J.quitarPersona(e, id)) }),
          el('button', { class: 'btn secundario', id: 'btn-poner-persona', text: '+ Poner persona', disabled: !pp.ok, onclick: () => accion(J.ponerPersona(e, id)) })),
        el('div', { class: 'sub', text: 'Libres: ' + J.personasLibres(e) + '. Nunca se puede quitar la última persona.' })));
    }
    if (DM.edificios[b.tipo]) panelMilitar(h, b);
    if (b.tipo === 'ayuntamiento') panelMuralla(h, true);
    const pm = J.puedeMejorar(e, id), sig = b.nivel < d.max ? J.costeMejora(b) : null;
    h.append(el('div', { class: 'tarjeta-clara' },
      sig ? el('div', {}, el('b', { text: 'Mejorar a nivel ' + (b.nivel + 1) }), el('div', { class: 'coste', id: 'coste-mejora', 'aria-label': 'Coste: ' + textoCoste(sig) }, costeIconos(sig)),
        el('div', { class: 'sub', text: b.tipo === 'ayuntamiento' ? 'Huecos ' + d.huecos[b.nivel] + ' · a salvo ' + d.aSalvo[b.nivel] : describir(b.tipo, b.nivel + 1) })) : el('b', { text: 'Nivel máximo' }),
      !pm.ok && sig ? el('div', { class: 'motivo', text: pm.motivo }) : null));
    const pd = J.puedeDemoler(e, id), dev = {}; for (const [k, v] of Object.entries(b.gastado)) if (v) dev[k] = Math.floor(v / 2);
    // 0.5 · «Máx»: sube al máximo nivel pagable ahora (sin pasar del ayuntamiento)
    const mx = J.maxMejora(e, id);
    if (sig && mx.pasos > 1) h.append(el('p', { class: 'sub', id: 'max-mejora', text: 'Con «Máx» sube hasta nivel ' + mx.nivel + ' (' + mx.pasos + ' niveles) por ' + textoCoste(mx.coste) + '.' }));
    h.append(el('div', { class: 'fila acciones-edif' },
      repetible(el('button', { class: 'btn principal', id: 'btn-mejorar', disabled: !pm.ok, onclick: () => { const msg = 'Mejorado a nivel ' + (b.nivel + 1); accion(J.mejorar(e, id), msg); } }, 'Mejorar'), () => J.mejorar(e, id), () => d.nombre + ' a nivel ' + b.nivel),
      sig ? botonMax('btn-mejorar-max', mx.pasos >= 1, 'Mejorar al máximo pagable (nivel ' + mx.nivel + ')', () => { const r = J.mejorarMax(e, id); accion(r, r.ok ? 'Mejorado a nivel ' + r.nivel + ' (+' + r.niveles + ')' : null); }) : null,
      el('button', { class: 'btn secundario solo-icono', id: 'btn-mover', 'aria-label': 'Mover', title: 'Mover', onclick: () => { E.moviendo = id; cerrarHoja(); pintar(); } }, ico('mover')),
      el('button', { class: 'btn peligro solo-icono', id: 'btn-demoler', 'aria-label': 'Demoler', title: 'Demoler', disabled: !pd.ok, onclick: () => { const r = J.demoler(e, id); if (!r.ok) return aviso(r.motivo, 'error'); cerrarHoja(); guardar(); pintar(); aviso('Demolido', 'exito', 'Recuperas: ' + textoCoste(r.devuelto)); } }, ico('demoler'))),
      ...[el('p', { class: 'sub', text: 'Mover es gratis.' + (b.tipo !== 'ayuntamiento' && pd.ok ? ' Al demoler recuperas el 50 %: ' + textoCoste(dev) + (b.tipo === 'casa' ? '. Se pierden sus personas.' : '.') : '') }),
      !pd.ok ? el('p', { class: 'motivo', id: 'motivo-demoler', text: pd.motivo }) : null].filter(Boolean));
  }
  // 0.6 · Muralla (no ocupa hueco) y defensas
  function hojaMuralla(h) { h.append(cabeceraHoja(DM.muralla.nombre + (M.nivelMuralla(PARTIDA) ? ' · nivel ' + M.nivelMuralla(PARTIDA) : ''), 'Rodea la ciudad y protege al defender.', 'hoja-titulo')); panelMuralla(h, false); }
  function panelMuralla(h, resumido) {
    const e = PARTIDA, m = e.militar, nm = M.nivelMuralla(e), pm = M.puedeMejorarMuralla(e), c = M.costeMuralla(e);
    const caja = el('div', { class: 'tarjeta-clara', id: 'panel-muralla' }, el('div', { class: 'fila' }, el('img', { class: 'ico-coste', src: 'img/muralla/muralla_' + M.rangoDe(Math.max(1, nm)) + '_puerta_eo.svg', alt: '' }),
      el('b', { text: nm ? DM.muralla.nombre + ' nivel ' + nm + ' · defensa ' + pct(M.bonoMuralla(e)) : DM.muralla.nombre + ' (sin construir)' })),
      el('div', { class: 'sub', text: 'Rodea la ciudad. Suma ' + pct(DM.murallaBono.base + DM.murallaBono.porNivel) + ' (+' + Math.round(DM.murallaBono.porNivel * 100) + ' % por nivel) a la fuerza al defender y desbloquea las defensas. Requiere ayuntamiento nivel ' + DM.muralla.requiere + '.' }),
      c ? el('div', { class: 'coste', id: 'coste-muralla' }, costeIconos(c)) : el('b', { text: 'Nivel máximo' }),
      !pm.ok && c ? el('div', { class: 'motivo', id: 'motivo-muralla', text: pm.motivo }) : null,
      c ? repetible(el('button', { class: 'btn principal', id: 'btn-muralla', text: nm ? 'Mejorar muralla' : 'Construir muralla', disabled: !pm.ok, onclick: () => { const r = M.mejorarMuralla(e); accion(r, r.ok ? (r.nivel === 1 ? 'Muralla construida' : 'Muralla a nivel ' + r.nivel) : null); } }), () => M.mejorarMuralla(e), () => 'Muralla a nivel ' + M.nivelMuralla(e)) : null);
    h.append(caja);
    if (resumido && !nm) return;
    if (resumido) { h.append(el('button', { class: 'btn secundario ancho', id: 'btn-ver-defensas', text: 'Defensas (' + M.totalDefensas(e) + ' / ' + M.maxDefensas(e) + ')', onclick: () => abrirHoja(hojaMuralla) })); return; }
    h.append(el('h3', { text: 'Defensas · ' + M.totalDefensas(e) + ' / ' + M.maxDefensas(e) }), el('p', { class: 'sub', text: 'Suman su fuerza (× bono de la muralla) a tus tropas cuando una ciudad en guerra te ataca. Caben ' + DM.defensasPorNivel + ' por nivel de muralla.' }));
    for (const k of M.DEFENSAS) {
      const d = DM.defensas[k], p = M.puedeConstruirDefensa(e, k, 1), src = k === 'empalizada' ? 'img/muralla/empalizada_eo.svg' : 'img/muralla/' + d.icono + '_' + M.rangoDe(Math.max(1, nm)) + '.svg';
      h.append(el('div', { class: 'tarjeta-clara opcion-mil' + (p.ok ? '' : ' no'), 'data-defensa': k }, el('img', { class: 'ico-mil', src, alt: '' }),
        el('div', { class: 'datos' }, el('b', { text: d.nombre + ' · tienes ' + (m.defensas[k] || 0) }), el('div', { class: 'sub', text: 'Fuerza ' + d.fuerza + ' · muralla nv ' + d.muralla }), el('div', { class: 'coste' }, costeIconos(d.coste)), !p.ok ? el('div', { class: 'motivo', text: p.motivo }) : null),
        el('div', { class: 'botones-defensa' },
          el('button', { class: 'btn principal mini-btn', id: 'defensa-' + k, text: 'Construir', disabled: !p.ok, onclick: () => accion(M.construirDefensa(e, k, 1), d.nombre + ' construida') }),
          // 0.9 · borrar una defensa (libera su sitio; devuelve el 50 %)
          el('button', { class: 'btn peligro mini-btn solo-icono', id: 'borrar-defensa-' + k, 'aria-label': 'Borrar una ' + d.nombre.toLowerCase(), title: 'Borrar una (devuelve el 50 %)', disabled: !(m.defensas[k] > 0),
            onclick: () => { const r = M.borrarDefensa(e, k, 1); accion(r, r.ok ? d.nombre + ' borrada · recuperas ' + textoCoste(r.devuelto) : null); } }, ico('demoler')))));
    }
  }
  // 0.6 · Tienda (maqueta 03 de Camachin): objetos por oro e intercambio de materiales con comisión. Precios PROVISIONALES; sin pagos reales.
  // 0.7: es el panel del EDIFICIO Tienda (único, desde ayuntamiento nv3); su nivel baja el recargo y la comisión
  function pintarTienda(zona) {
    const e = PARTIDA, m = e.militar, caja = el('div', { class: 'ejercito tienda', id: 'tienda' }), T = DM.tienda, otra = () => hojaRender ? refrescarHoja() : pintar();
    caja.append(el('div', { class: 'tienda-cab' }, imgUi('icono_tienda_on', 'ico-tienda'), el('h3', { text: 'Comprar' }), el('span', { class: 'chip-provisional', text: 'Precios provisionales' })));
    caja.append(el('p', { class: 'sub', id: 'tienda-recargo', text: 'Se paga con oro del juego. Recargo sobre fabricar en la ' + DM.edificios.botica.nombre.toLowerCase() + ': ×' + String(Math.round(M.recargoTienda(e) * 100) / 100).replace('.', ',') + ' (baja con el nivel de la tienda); no piden nivel.' }));
    const tarjeta = (item, img, nombre, sub) => { const pr = M.precioTienda(item, e), ok = e.recursos.oro >= pr.oro;
      return el('div', { class: 'tarjeta-tienda' + (ok ? '' : ' no'), 'data-item': item }, img, el('b', { text: nombre }), sub ? el('span', { class: 'sub', text: sub }) : null,
        repetible(el('button', { class: 'btn oro mini-btn precio', id: 'comprar-' + item, disabled: !ok, onclick: () => accion(M.comprarTienda(e, item, 1), nombre + ' comprad' + (item.startsWith('cofre') || item.startsWith('ct_') || item === 'fragmento_comun' ? 'o' : 'a')) }, imgRec('oro', 'ico-coste'), pr.oro.toLocaleString('es-ES')), () => M.comprarTienda(e, item, 1), k => k + ' × ' + nombre)); };
    caja.append(el('h3', { class: 'titulo-tienda', text: 'Pociones' }), el('div', { class: 'rejilla-tienda', id: 'tienda-pociones' }, T.venta.filter(p => DM.pociones[p]).map(p => tarjeta(p, imgPocion(p, 'ico-tienda-item'), DM.pociones[p].nombre, textoPocion(p)))));
    caja.append(el('h3', { class: 'titulo-tienda', text: 'Cofres y fragmentos' }), el('div', { class: 'rejilla-tienda', id: 'tienda-objetos' },
      T.venta.filter(o => DM.objetos[o]).map(o => tarjeta(o, imgObjeto(o, 'ico-tienda-item'), DM.objetos[o].nombre, textoCofre(o))), tarjeta('fragmento_comun', imgFragmento(null, null, 'ico-tienda-item'), 'Fragmento común', 'para cualquier héroe desde nv ' + DM.heroes.fragmentosDesde)));
    // Intercambio
    if (!E.cambio) E.cambio = { de: 'madera', a: 'piedra', n: T.cantidades[0] };
    const cb = E.cambio, recibe = Math.floor(cb.n * M.tasaCambio(cb.de, cb.a, e) + 1e-9), pc = e.recursos[cb.de] >= cb.n && cb.de !== cb.a;
    const selRec = (k, id) => el('div', { class: 'sel-recurso', id }, J.RECURSOS.map(r => el('button', { type: 'button', class: 'btn-rec' + (cb[k] === r ? ' on' : ''), id: id + '-' + r, 'aria-label': J.NOMBRE_RECURSO[r], title: J.NOMBRE_RECURSO[r], onclick: () => { cb[k] = r; otra(); } }, imgRec(r, 'ico-coste'))));
    caja.append(el('h3', { class: 'titulo-tienda', text: 'Intercambiar materiales' }), el('div', { class: 'tarjeta-clara', id: 'tienda-cambio' },
      el('div', { class: 'sub', text: 'Das' }), selRec('de', 'cambio-de'), el('div', { class: 'sub', text: 'Recibes' }), selRec('a', 'cambio-a'),
      el('div', { class: 'fila', style: 'gap:6px;flex-wrap:wrap;margin:6px 0' }, T.cantidades.map(n => el('button', { class: 'btn mini-btn ' + (cb.n === n ? 'principal' : 'secundario'), id: 'cambio-n-' + n, text: etiquetaCantidad(n), onclick: () => { cb.n = n; otra(); } }))),
      el('div', { id: 'cambio-resumen' }, el('b', { text: cb.n.toLocaleString('es-ES') + ' ' + J.NOMBRE_RECURSO[cb.de].toLowerCase() + ' → ' + (cb.de === cb.a ? '—' : recibe.toLocaleString('es-ES') + ' ' + J.NOMBRE_RECURSO[cb.a].toLowerCase()) }),
        el('div', { class: 'sub', text: 'Valores: comida, madera, piedra y oro 1 · hierro ' + T.valor.hierro + ' · metal ' + T.valor.metal + '. Comisión del ' + String(Math.round(M.comisionTienda(e) * 1000) / 10).replace('.', ',') + ' % por intercambio.' })),
      repetible(el('button', { class: 'btn principal', id: 'btn-cambiar', text: 'Intercambiar', disabled: !pc, onclick: () => { const r = M.intercambiar(e, cb.de, cb.a, cb.n); accion(r, r.ok ? 'Recibes ' + r.recibe.toLocaleString('es-ES') + ' de ' + J.NOMBRE_RECURSO[cb.a].toLowerCase() : null); } }), () => M.intercambiar(e, cb.de, cb.a, cb.n), k => k + ' intercambios de ' + etiquetaCantidad(cb.n))));
    zona.append(caja);
  }
  // 0.8: botones del intercambio rotulados 100 · 1k · 10k · 100k; cofres de tienda con su contenido
  const etiquetaCantidad = n => n >= 1e6 ? (n / 1e6).toLocaleString('es-ES') + 'M' : n >= 1000 ? (n / 1000).toLocaleString('es-ES') + 'k' : String(n);   // 0.9: + «1M»
  const textoCofre = o => { const O = DM.objetos[o]; return O.fragmentos ? textoCoste(O.recursos) + ' · ' + O.fragmentos.comunes + ' fragmentos comunes · ' + O.fragmentos.familia + ' de monstruo' : null; };
  function abrirTienda() { const t = M.edificio(PARTIDA, 'tienda'); if (t) abrirHoja(h => hojaEdificio(h, t.id)); else aviso('Aún no tienes tienda', 'info', 'Constrúyela en un hueco libre (ayuntamiento nivel ' + DM.edificios.tienda.requiere + ').'); }
  // ---------- 0.7 · Informes: historial permanente de batallas y avisos (también los de cuando no estabas jugando) ----------
  const TIPOS_INFORME = { todos: 'Todos', batallas: 'Batallas', avisos: 'Avisos' };
  const esBatalla = x => ['combate', 'defensa', 'guardia'].includes(x.tipo);
  function textoInforme(x) {
    const b = x.botin && textoCoste(x.botin) !== 'gratis' ? 'botín ' + textoCoste(x.botin) : 'sin botín', baj = o => { const n = Object.values(o || {}).reduce((s, v) => s + v, 0); return n ? n.toLocaleString('es-ES') + ' bajas' : 'sin bajas'; };
    switch (x.tipo) {
      case 'combate': return [x.conquistada ? '¡' + x.nombre + ' conquistada!' : (x.gana ? 'Victoria' : 'Derrota') + ' · ' + x.nombre + ' nv ' + x.nivel, 'Tu fuerza ' + N(x.fuerza).toLocaleString('es-ES') + ' contra ' + N(x.enemigo).toLocaleString('es-ES') + ' · ' + baj(x.bajas) + (x.gana && !x.conquistada ? ' · ' + b : ''), x.gana ? 'bien' : 'mal'];
      case 'defensa': return [x.gana ? 'Has rechazado a ' + x.ciudad : x.ciudad + ' te ha saqueado', 'Ataque ' + N(x.fuerzaAtaque).toLocaleString('es-ES') + ' · tu defensa ' + N(x.fuerzaDefensa).toLocaleString('es-ES') + ' · ' + baj(x.bajas) + (x.gana ? '' : ' · se llevan ' + (textoCoste(x.robado || {}) === 'gratis' ? 'nada' : textoCoste(x.robado))), x.gana ? 'bien' : 'mal'];
      case 'guardia': return [(x.gana ? 'Guardia vencida' : 'La guardia ha ganado') + ' · ' + J.NOMBRE_RECURSO[x.recurso] + ' nv ' + x.nivel, 'Tu fuerza ' + N(x.fuerza).toLocaleString('es-ES') + ' contra ' + N(x.defensa).toLocaleString('es-ES') + ' · ' + baj(x.bajas), x.gana ? 'bien' : 'mal'];
      case 'recogida': return [x.fallo ? 'Recogida fallida' : 'Recogida ' + (x.completa ? 'completa' : 'parcial'), '+' + (x.cantidad || 0).toLocaleString('es-ES') + ' de ' + J.NOMBRE_RECURSO[x.recurso].toLowerCase(), x.fallo ? 'mal' : 'bien'];
      case 'captura': return ['Has capturado a ' + x.monstruo, x.nombre + ' se une como héroe (nv ' + x.nivel + ') · ' + baj(x.bajas) + ' extra (× ' + x.factor + ')', 'bien'];
      case 'cofre': return ['Has abierto: ' + x.nombre, textoCoste(x.recursos || {}) + ' · ' + ((x.comunes || 0) + Object.values(x.familias || {}).reduce((a, b) => a + b, 0)) + ' fragmentos', 'bien'];
      case 'vuelta': return ['Tu ejército ha vuelto de ' + x.nombre, x.botin ? 'Botín: ' + textoCoste(x.botin) : 'Sin botín.', 'info'];
      case 'marcha': return ['Tu ejército vuelve', x.nombre + ' ' + x.motivo + '.', 'info'];
      case 'guerra': return [x.nombre + ' está en guerra contigo', 'Te atacará cada ' + DM.guerra.cadaMin.map(v => v / 60).join('–') + ' h hasta que firméis la paz (solo un enemigo ataca a la vez).', 'mal'];
      case 'paz': return ['Paz con ' + x.nombre, 'Pagada: ' + textoCoste(x.coste || {}), 'info'];
      case 'desercion': return [x.n + ' soldado' + (x.n > 1 ? 's' : '') + ' han desertado', 'No había comida para mantenerlos.', 'mal'];
      case 'despido': return ['Has despedido ' + (x.cantidad || 0).toLocaleString('es-ES') + ' × ' + nombreTropa(x.tropa).toLowerCase(), 'Tropa disponible: ' + (x.disponible || 0).toLocaleString('es-ES'), 'info'];
      case 'campamento': return ['Nuevo Campamento', x.tropas.toLocaleString('es-ES') + ' tropas para ' + x.plazas + ' plazas · ' + x.obreros + ' obreros para ' + x.maxObreros + ' (no se quita nada)', 'info'];
      default: return [x.tipo, '', 'info'];
    }
  }
  // 0.9 · informes más vistosos: icono de cada tipo y sello del resultado
  const SELLO = { bien: 'Éxito', mal: 'Pérdida', info: 'Aviso' };
  function icoInforme(x) {
    const c = 'ico-informe', k = { combate: 'icono_guerra', guardia: 'icono_guerra', guerra: 'icono_guerra', defensa: 'a_salvo', paz: 'icono_paz', captura: 'icono_conquista', cofre: 'icono_inventario_on' }[x.tipo];
    const img = x.tipo === 'recogida' && x.recurso ? imgRec(x.recurso, c) : x.tipo === 'despido' ? imgIcoCamp('icono_despedir', c) : x.tipo === 'campamento' ? imgIcoCamp('icono_tropa_disponible', c) : imgUi(k || 'info', c);
    return el('span', { class: 'informe-ico' }, img);
  }
  // barra «tú contra ellos» para el desglose de combates y defensas
  const barraVs = (id, a, b, ta, tb) => { const s = (N(a) + N(b)) || 1, p = Math.round(N(a) / s * 100);
    return el('div', { class: 'vs', id }, el('div', { class: 'vs-nombres' }, el('b', { text: ta + ' ' + nfmt(a) }), el('span', { class: 'vs-x', text: 'VS' }), el('b', { text: tb + ' ' + nfmt(b) })),
      el('div', { class: 'vs-barra' }, el('span', { class: 'vs-tu', style: 'width:' + p + '%' }), el('span', { class: 'vs-el', style: 'width:' + (100 - p) + '%' }))); };
  const fechaInforme = t => { const d = new Date(t), hoy = new Date(); const h = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); return d.toDateString() === hoy.toDateString() ? 'hoy ' + h : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ' ' + h; };
  function pintarInformes(zona) {
    const e = PARTIDA, m = e.militar, todos = (m.informes || []).slice().reverse(), f = E.filtroInformes || 'todos';
    const lista = todos.filter(x => f === 'todos' || (f === 'batallas' ? esBatalla(x) : !esBatalla(x))), vistos = m.informesVistos || 0, max = E.informesMax || 60;
    const caja = el('div', { class: 'ejercito informes', id: 'informes' });
    caja.append(el('div', { class: 'tienda-cab' }, imgUi('icono_informes_on', 'ico-tienda'), el('h3', { text: 'Informes' }), el('span', { class: 'sub', id: 'informes-total', text: todos.length + ' guardados' })));
    caja.append(el('div', { class: 'fila filtros-informes', id: 'filtros-informes' }, Object.entries(TIPOS_INFORME).map(([k, n]) => el('button', { class: 'btn mini-btn ' + (f === k ? 'principal' : 'secundario'), id: 'inf-filtro-' + k, text: n, onclick: () => { E.filtroInformes = k; E.informesMax = 60; pintar(); } }))));
    if (!lista.length) caja.append(el('p', { class: 'sub', id: 'informes-vacio', text: 'Aún no hay informes. Aquí quedan todas tus batallas, las defensas de tu ciudad y los avisos, también los de cuando no estabas jugando.' }));
    caja.append(el('div', { class: 'lista-informes', id: 'lista-informes' }, lista.slice(0, max).map(x => { const [t, sub, tono] = textoInforme(x);
      return el('button', { class: 'tarjeta-clara informe ' + tono + (x.n > vistos ? ' nuevo' : ''), id: 'informe-' + x.n, 'data-tipo': x.tipo, 'aria-label': t + ' (ver el desglose)', onclick: () => abrirHoja(h => hojaInforme(h, x.n)) },
        icoInforme(x),
        el('div', { class: 'informe-cuerpo' },
        el('div', { class: 'informe-cab' }, el('b', { text: t }), el('span', { class: 'sub informe-fecha', text: fechaInforme(x.t) })),
        el('span', { class: 'sello ' + tono, text: SELLO[tono] || '' }),
        sub ? el('div', { class: 'sub', text: sub }) : null,
        x.botin && textoCoste(x.botin) !== 'gratis' && x.gana ? el('div', { class: 'informe-botin' }, costeIconos(x.botin)) : null),
        x.desconectado ? el('span', { class: 'chip fuera', text: 'mientras no jugabas' }) : x.anterior ? el('span', { class: 'chip fuera', text: 'antes de la 0.7' }) : null); })));
    if (lista.length > max) caja.append(el('button', { class: 'btn secundario', id: 'informes-mas', text: 'Ver más (' + (lista.length - max) + ')', onclick: () => { E.informesMax = max + 60; pintar(); } }));
    zona.append(caja);
    if (M.informesNuevos(e)) { M.marcarInformesVistos(e); guardar(); }
  }
  // ---------- 0.8 · Informe pulsable: desglose completo ----------
  const nombreTropa = t => (DM.tropas[t] && DM.tropas[t].nombre) || (DM.obreros[t] && DM.obreros[t].nombre) || t;
  function tablaInf(id, cab, filas) {
    return el('table', { class: 'tabla-informe', id }, el('thead', {}, el('tr', {}, cab.map(c => el('th', { text: c })))), el('tbody', {}, filas.map(f => el('tr', {}, f.map(c => el('td', { text: String(c) }))))));
  }
  const seccionInf = (titulo, ...hijos) => el('div', { class: 'tarjeta-clara seccion-informe' }, el('b', { text: titulo }), ...hijos);
  const nfmt = v => N(v).toLocaleString('es-ES');
  function hojaInforme(h, n) {
    const e = PARTIDA, x = (e.militar.informes || []).find(y => y.n === n);
    if (!x) { h.append(cabeceraHoja('Informe', 'Ya no está guardado', 'hoja-titulo')); return; }
    const [t, sub, tono] = textoInforme(x);
    h.append(cabeceraHoja(t, fechaInforme(x.t) + (x.desconectado ? ' · mientras no jugabas' : ''), 'hoja-titulo'));
    const caja = el('div', { class: 'detalle-informe ' + tono, id: 'detalle-informe', 'data-tipo': x.tipo }); h.append(caja);
    caja.append(el('div', { class: 'informe-banda ' + tono, id: 'informe-banda' }, icoInforme(x), el('span', { class: 'sello ' + tono, text: SELLO[tono] || '' })));
    if (x.tipo === 'combate' || x.tipo === 'guardia') caja.append(barraVs('inf-vs', x.fuerza, x.tipo === 'guardia' ? x.defensa : x.enemigo, 'Tú', x.tipo === 'guardia' ? 'Guardia' : (x.nombre || 'Enemigo')));
    if (x.tipo === 'defensa') caja.append(barraVs('inf-vs', x.fuerzaDefensa, x.fuerzaAtaque, 'Tu defensa', x.ciudad || 'Ataque'));
    if (x.tipo === 'combate') {
      caja.append(seccionInf('Resultado', el('p', { id: 'inf-resultado', text: (x.conquistada ? 'Conquista' : x.gana ? 'Victoria' : 'Derrota') + (x.conquistar ? ' (intento de conquista)' : '') + (x.capturado ? ' · capturado: ' + x.capturado : x.capturable ? ' · se pudo capturar' : '') }),
        el('p', { class: 'sub', text: 'Tu fuerza ' + nfmt(x.fuerza) + (x.azar ? ' (azar × ' + String(x.azar).replace('.', ',') + ')' : '') + ' contra ' + nfmt(x.enemigo) + (x.enemigoBase && x.enemigoBase !== x.enemigo ? ' (base ' + nfmt(x.enemigoBase) + ')' : '') })));
      const env = x.enviadas || {}, baj = x.bajas || {}, bc = x.bajasCaptura || {};
      caja.append(seccionInf('Tu ejército', tablaInf('inf-tropas', ['Tropa', 'Enviadas', 'Bajas', bc && Object.keys(bc).length ? 'Captura' : '', 'Vuelven'].filter(Boolean),
        Object.keys(env).map(k => [nombreTropa(k), nfmt(env[k]), nfmt(baj[k] || 0)].concat(Object.keys(bc).length ? [nfmt(bc[k] || 0)] : [], [nfmt(env[k] - (baj[k] || 0) - (bc[k] || 0))])))));
      if ((x.heroesDet || []).length) caja.append(seccionInf('Héroes', tablaInf('inf-heroes', ['Héroe', 'Nivel', 'Experiencia', 'Estado'],
        x.heroesDet.map(y => [y.nombre, y.nivel + (y.subio ? ' (+' + y.subio + ')' : ''), '+' + nfmt(y.xp), y.herido ? 'herido ' + String(y.herido).replace('.', ',') + ' min' : 'bien']))));
      else if ((x.heridos || []).length) caja.append(seccionInf('Héroes', el('p', { text: 'Heridos: ' + x.heridos.join(', ') })));
      caja.append(seccionInf('Enemigo', el('p', { id: 'inf-enemigo', text: x.nombre + ' · nivel ' + x.nivel + (x.legendario ? ' · legendario' : '') + (x.ciudad ? ' · ciudad' : x.clase ? ' · ' + DM.clases[x.clase].toLowerCase() : '') + ' · fuerza ' + nfmt(x.enemigo) })));
      if ((x.efectos || []).length) caja.append(seccionInf('Habilidades legendarias', el('ul', { id: 'inf-efectos' }, x.efectos.map(y => el('li', { text: y })))));
      const B = x.botinDet || {};
      if (x.gana) caja.append(seccionInf('Botín', el('p', { id: 'inf-botin', text: x.botin && textoCoste(x.botin) !== 'gratis' ? textoCoste(x.botin) : 'Sin recursos' }), x.botin && textoCoste(x.botin) !== 'gratis' ? el('div', { class: 'informe-botin' }, costeIconos(x.botin)) : null,
        B.fragmentos ? el('p', { text: B.fragmentos + ' fragmento de ' + nombreFamilia(B.familia) }) : null, B.comunes ? el('p', { text: B.comunes + ' fragmento común' }) : null,
        Object.keys(B.pociones || {}).length ? el('p', { text: 'Pociones: ' + Object.entries(B.pociones).map(([k, v]) => v + ' × ' + DM.pociones[k].nombre).join(', ') }) : null,
        Object.keys(B.objetos || {}).length ? el('p', { text: 'Objetos: ' + Object.entries(B.objetos).map(([k, v]) => v + ' × ' + DM.objetos[k].nombre).join(', ') }) : null));
    } else if (x.tipo === 'defensa') {
      caja.append(seccionInf('Resultado', el('p', { id: 'inf-resultado', text: (x.gana ? 'Defensa ganada' : 'Defensa perdida') + ' contra ' + x.ciudad + (x.nivel ? ' (nv ' + x.nivel + ')' : '') }),
        el('p', { class: 'sub', text: 'Ataque ' + nfmt(x.fuerzaAtaque) + ' · tu defensa ' + nfmt(x.fuerzaDefensa) + (x.ejercito != null ? ' (ejército ' + nfmt(x.ejercito) + ' + defensas ' + nfmt(x.defensas) + ', muralla nv ' + (x.muralla || 0) + ' ' + pct(x.bonoMuralla || 0) + ')' : '') })));
      const casa = x.tropasCasa || {}, baj = x.bajas || {};
      caja.append(seccionInf('Tus tropas', tablaInf('inf-tropas', ['Tropa', 'En la ciudad', 'Bajas'], Object.keys(Object.keys(casa).length ? casa : baj).map(k => [nombreTropa(k), casa[k] != null ? nfmt(casa[k]) : '—', nfmt(baj[k] || 0)]))));
      if ((x.heroesDef || []).length) caja.append(seccionInf('Héroes en la ciudad', el('p', { text: x.heroesDef.join(', ') })));
      if (x.defensasN) caja.append(seccionInf('Defensas', el('p', { text: Object.entries(x.defensasN).filter(([, v]) => v > 0).map(([k, v]) => v + ' × ' + DM.defensas[k].nombre).join(', ') || 'Ninguna' })));
      if ((x.efectos || []).length) caja.append(seccionInf('Habilidades legendarias', el('ul', {}, x.efectos.map(y => el('li', { text: y })))));
      caja.append(seccionInf('Robado', el('p', { id: 'inf-robado', text: textoCoste(x.robado || {}) === 'gratis' ? 'Nada' : textoCoste(x.robado) })));
    } else if (x.tipo === 'recogida') {
      caja.append(seccionInf('Recogida', el('p', { id: 'inf-resultado', text: '+' + nfmt(x.cantidad || 0) + ' de ' + J.NOMBRE_RECURSO[x.recurso].toLowerCase() + (x.completa ? ' (completa)' : ' (vuelta antes de tiempo)') + (x.llena ? ' · volvieron llenos' : '') }),
        x.minutos ? el('p', { class: 'sub', text: 'Trabajo: ' + String(x.trabajado).replace('.', ',') + ' de ' + x.minutos + ' min · ida ' + String(x.ida).replace('.', ',') + ' min · vuelta ' + String(x.vuelta).replace('.', ',') + ' min' + (x.pociones ? ' · ' + x.pociones + ' poción(es) de farmeo' : '') }) : null));
      if (x.obreros) caja.append(seccionInf('Obreros', tablaInf('inf-obreros', ['Obrero', 'Cantidad', 'Carga'], Object.entries(x.obreros).map(([k, v]) => [nombreTropa(k), nfmt(v), nfmt(v * (DM.obreros[k] ? DM.obreros[k].carga : 0))]))));
    } else if (x.tipo === 'captura') {
      caja.append(seccionInf('Captura', el('p', { id: 'inf-resultado', text: x.monstruo + ' (nv ' + x.nivel + ')' + (x.legendario ? ', legendario,' : '') + ' es ahora tu héroe ' + x.nombre }),
        el('p', { class: 'sub', text: 'Capturarlo multiplicó las bajas × ' + x.factor }),
        tablaInf('inf-tropas', ['Tropa', 'Enviadas', 'Bajas normales', 'Bajas por capturar'], Object.keys(x.enviadas || {}).map(k => [nombreTropa(k), nfmt(x.enviadas[k]), nfmt((x.bajasNormales || {})[k] || 0), nfmt((x.bajas || {})[k] || 0)]))));
    } else {
      if (sub) caja.append(el('p', { class: 'informe-resumen', text: sub }));
      const fuera = new Set(['n', 'tipo', 't', 'jugadoMs', 'desconectado']);
      // 0.9: nombres legibles en el detalle genérico
      const NOM = { nombre: 'Nombre', nivel: 'Nivel', recurso: 'Recurso', cantidad: 'Cantidad', recursos: 'Recursos', coste: 'Coste', botin: 'Botín', motivo: 'Motivo', tropa: 'Tropa', n: 'Cantidad', disponible: 'Tropa disponible', tropas: 'Tropas', plazas: 'Plazas', obreros: 'Obreros', maxObreros: 'Máximo de obreros', comunes: 'Fragmentos comunes', familias: 'Fragmentos por familia', ciudad: 'Ciudad' };
      caja.append(seccionInf('Detalle', el('ul', { id: 'inf-detalle' }, Object.entries(x).filter(([k, v]) => !fuera.has(k) && v != null).map(([k, v]) => el('li', { text: (NOM[k] || k) + ': ' + (k === 'tropa' && typeof v === 'string' ? nombreTropa(v) : typeof v === 'object' ? (textoCoste(v) !== 'gratis' && Object.keys(v).every(q => J.RECURSOS.includes(q)) ? textoCoste(v) : JSON.stringify(v)) : String(v)) })))));
    }
  }
  // ======================= PARTE MILITAR (interfaz; 0.3, ampliada en la 0.5) =======================
  const M = g.CivilikMilitar, DM = g.CivilikDatos;
  // Gráficos de Camachin en img/combate/ (0.3 y monstruos v2), img/militar/ (fragmentos 0.5) e img/mundo/ (0.5).
  const imgMil = (n, cls) => el('img', { class: cls || 'ico-mil', src: TX.rutas.militar + n + '.svg', alt: '', draggable: 'false' });
  const imgC = (ruta, cls) => el('img', { class: cls || 'ico-mil', src: TX.rutas.combate + ruta + '.svg', alt: '', draggable: 'false' });
  // 0.8: legendarios de Camachin: legendario_<x>_mapa (72 dp), _combate (64 dp, en la hoja de ataque), _retrato (96 dp, como héroe) y _figura (48 dp)
  const imgMonstruo = (mo, v = 'retrato', cls) => imgC('monstruos/' + M.datosMonstruo(mo).archivo + '_' + (mo.legendario && v === 'retrato' ? 'combate' : v), cls);
  // 0.7: las tropas de 2 y 3 estrellas usan de marcador la imagen de rango 3 de su clase hasta que Camachin dibuje tropas/<id>_<variante>.svg
  // 0.8: ya con los dibujos de Camachin de las tropas de 2 y 3 estrellas (tropas/<id>_retrato|_escuadra)
  const imgTropa = (t, v = 'retrato', cls) => DM.tropas[t].estrellas ? imgC('tropas/' + t + '_' + (v === 'escuadra' ? 'escuadra' : 'retrato'), cls) : imgC('tropas/' + DM.tropas[t].clase + '_' + M.rangoTropas(PARTIDA) + '_' + v, cls);
  // 0.8: obreros de la Escuela (Camachin): <id> (figura 48 dp), _retrato (64 dp), _escuadra (72 dp)
  const imgObrero = (t, v = 'retrato', cls) => imgC('tropas/' + t + (v === 'figura' ? '' : '_' + v), cls);
  // héroes clásicos: heroe_<tipo>_retrato_<marco> · convocables (0.5): heroe_<familia> (bronce), _plata, _oro y _mapa
  const imgHeroe = (h, v = 'retrato', cls) => { const T = DM.heroes.tipos[h.tipo], fam = T.familia, mc = M.marcoHeroe(h);
    if (T.capturado) return imgC('monstruos/' + (T.legendario ? 'legendario_' + T.monstruo + (v === 'mapa' ? '_figura' : '_retrato') : T.monstruo + '_' + (h.rango || 1) + (v === 'mapa' ? '_mapa' : '_retrato')), (cls || 'ico-mil') + (T.legendario ? ' marco-legendario' : ''));   // 0.8: capturados
    return imgC('heroes/heroe_' + h.tipo + (v === 'mapa' ? '_mapa' : fam ? (mc === 'bronce' ? '' : '_' + mc) : '_retrato_' + mc), cls); };
  const imgPocion = (p, cls) => imgC('pociones/' + DM.pociones[p].icono, cls);
  const imgFragmento = (fam, rango, cls) => imgMil(fam ? 'fragmento_' + fam + (rango ? '_' + rango : '') : 'fragmento_comun', cls);
  const imgObjeto = (o, cls) => imgMil(DM.objetos[o].icono, cls);
  const pct = v => (v > 0 ? '+' : '') + Math.round(v * 1000) / 10 + ' %';
  const nombreClase = c => c ? DM.clases[c] : 'Apoyo';
  const NOMBRE_FAMILIA = { orco: 'Orco', huargo: 'Huargo', no_muerto: 'No-muerto', troll: 'Troll', grifo: 'Grifo', dragon: 'Dragón', arana: 'Araña', saurio: 'Saurio', minotauro: 'Minotauro', fenix: 'Ígnea Fénix', kraken: 'Zhaal Kraken', hidra: 'Hidra', titan: 'Hrimnir Titán' }, nombreFamilia = f => NOMBRE_FAMILIA[f] || f;
  const ESTADO_HEROE = { listo: 'Listo', herido: 'Herido', inactivo: 'Inactivo', fuera: 'Fuera' };
  const NOMBRE_EFECTO = { fuerza: 'Fuerza +', farmeo: 'Farmeo −', velocidad: 'Marcha −' };
  const minutosTxt = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s'; };
  const num = v => Math.round(v * 10) / 10;
  function textoHabilidad(a) {
    const v = a.activa ? a.valor : (a.fuerza ?? a.todas ?? a.bajas ?? a.botin ?? a.heridas ?? a.variedad ?? a.poder ?? a.pociones);
    if (a.poder != null) return pct(v) + ' poder propio del héroe';
    if (a.pociones != null) return pct(v) + ' minutos de cada poción (con la Alquimista en la ciudad)';
    if (a.clase) return pct(v) + ' fuerza de ' + DM.clases[a.clase].toLowerCase();
    if (a.todas != null) return pct(v) + ' fuerza de todo el ejército';
    if (a.bajas != null) return pct(v) + ' bajas';
    if (a.botin != null) return pct(v) + ' botín';
    if (a.heridas != null) return pct(v) + ' duración de heridas';
    return pct(v) + ' al bono de ejército variado';
  }
  // Avisos fijos bajo las pestañas: héroe inicial pendiente y falta de comida para los héroes
  function bannersMilitar(e) {
    const m = e.militar, caja = el('div', { class: 'banners-militar', id: 'banners-militar' });
    if (!m) return caja;
    if (m.heroeInicialPendiente) caja.append(el('div', { class: 'banner-mil' }, imgHeroe({ tipo: M.TIPOS_HEROE[0], nivel: 1 }, 'retrato', 'ico-banner'), el('span', { text: 'Elige el tipo de tu héroe inicial' }),
      el('button', { class: 'btn principal barra', id: 'btn-elegir-heroe', text: 'Elegir', onclick: elegirHeroeInicial })));
    // 0.6 · guerra: aviso cuando una ciudad enemiga está a punto de atacar; efectos de pociones activos
    for (const c of (J.nivelCiudad(e) >= DM.guerra.desdeAyto ? M.enGuerra(e) : [])) if (c.ataqueMs >= 0 && c.ataqueMs <= DM.guerra.avisoMin * 60000)
      caja.append(el('div', { class: 'banner-mil crisis', id: 'banner-ataque-' + c.id }, imgUi('icono_guerra', 'ico-banner'), el('span', { text: c.nombre + ' te atacará en ' + minutosTxt(c.ataqueMs) + ' · tu defensa ' + Math.round(M.fuerzaDefensa(e).total) + ' / su ataque ≈ ' + Math.round(c.fuerza * DM.guerra.fuerzaAtaque) }),
        el('button', { class: 'btn secundario barra', text: 'Paz', id: 'btn-paz-banner-' + c.id, onclick: () => { E.ataque = null; abrirHoja(h => hojaAtaque(h, c.id)); } })));
    const ef = Object.entries(m.efectos || {}).filter(([, x]) => x.ms > 0);
    if (ef.length) caja.append(el('div', { class: 'banner-mil efectos', id: 'banner-efectos' }, ef.map(([k, x]) => el('span', { class: 'efecto-chip', title: DM.pociones[x.tipo] ? DM.pociones[x.tipo].nombre : k }, imgPocion(x.tipo, 'ico-coste'), el('b', { text: NOMBRE_EFECTO[k] + Math.round(x.pct * 100) + ' % · ' + minutosTxt(x.ms) })))));
    // 0.9 · partida antigua con más tropas u obreros que plazas: aviso una vez (no se quita nada)
    if (m.campamentoExceso) caja.append(el('div', { class: 'banner-mil', id: 'banner-campamento' }, imgIcoCamp('icono_tropa_disponible', 'ico-banner'),
      el('span', { text: 'Nuevo Campamento: tienes ' + m.campamentoExceso.tropas.toLocaleString('es-ES') + ' tropas para ' + m.campamentoExceso.plazas + ' plazas y ' + m.campamentoExceso.obreros + ' obreros para ' + m.campamentoExceso.maxObreros + '. No se quita nada; para crear más, amplía el Campamento.' }),
      el('button', { class: 'btn principal barra', id: 'btn-banner-campamento', text: 'Ver', onclick: () => { delete m.campamentoExceso; guardar(); E.vista = 'campamento'; pintar(); } })));
    // 0.8 · capturas pendientes y espera entre asedios
    for (const k of (m.capturas || []).slice(-1)) caja.append(el('div', { class: 'banner-mil captura', id: 'banner-captura' }, imgC('monstruos/' + (k.legendario ? 'legendario_' + k.tipo + '_combate' : k.tipo + '_' + (k.rango || 1) + '_retrato'), 'ico-banner'),
      el('span', { text: 'Has vencido a ' + k.nombre + ': ¿lo capturas?' + ((m.capturas || []).length > 1 ? ' (' + m.capturas.length + ' pendientes)' : '') }),
      el('button', { class: 'btn oro barra', id: 'btn-captura-banner', text: 'Decidir', onclick: () => abrirHoja(h => hojaCaptura(h, k.id)) })));
    if (m.asedioMs > 0) caja.append(el('div', { class: 'banner-mil efectos', id: 'banner-asedio' }, imgUi('icono_guerra', 'ico-coste'), el('b', { id: 'asedio-restante', text: 'Próximo asedio en ' + minutosTxt(m.asedioMs) })));
    if (m.crisis) caja.append(el('div', { class: 'banner-mil crisis', id: 'banner-crisis' }, imgPocion('pequena', 'ico-banner'),
      el('span', { text: 'Falta comida: elige ' + m.crisis.n + ' héroe' + (m.crisis.n > 1 ? 's' : '') + ' que quedará' + (m.crisis.n > 1 ? 'n' : '') + ' inactivo' + (m.crisis.n > 1 ? 's' : '') + ' (' + minutosTxt(Math.max(0, m.crisis.plazoMs)) + '; si no, elige el juego)' }),
      el('button', { class: 'btn peligro barra', id: 'btn-crisis', text: 'Elegir', onclick: () => abrirHoja(hojaCrisis) })));
    return caja;
  }
  async function elegirHeroeInicial() {
    if (!PARTIDA || !PARTIDA.militar.heroeInicialPendiente) return;
    const tipos = M.TIPOS_HEROE, T = DM.heroes.tipos;
    const r = await dialogo({ titulo: 'Tu héroe inicial', clase: 'elegir-heroe', alCerrar: null,
      texto: 'Los héroes mejoran a tus tropas en combate y suben de nivel solos con la experiencia. Elige el tipo del primero; los siguientes se crían en el Salón de héroes (tipo al azar) o se convocan con fragmentos.',
      pie: el('div', { class: 'lista-heroes-tipo' }, tipos.map(t => el('div', { class: 'tipo-heroe' }, imgHeroe({ tipo: t, nivel: 1 }, 'retrato', 'ico-mil grande'),
        el('div', {}, el('b', { text: T[t].nombre }), el('div', { class: 'sub', text: T[t].papel + ' · ' + T[t].habilidades.map(a => a.nombre + ' (nv ' + a.nivel + ')').join(', ') }))))),
      botones: tipos.map(t => ({ texto: T[t].nombre, valor: t, id: 'heroe-' + t, tipo: 'principal' })).concat([{ texto: 'Más tarde', valor: null, id: 'heroe-luego' }]) });
    if (!r || !PARTIDA) { if (PARTIDA) aviso('Héroe pendiente', 'info', 'Puedes elegirlo cuando quieras con el aviso «Elegir».'); return; }
    const x = M.elegirHeroeInicial(PARTIDA, r); if (!x.ok) return aviso(x.motivo, 'aviso');
    guardar(); pintar(); aviso(x.heroe.nombre + ' se une a tu ciudad', 'exito', T[r].nombre + ' de nivel 1.');
  }
  function hojaCrisis(h) {
    const e = PARTIDA, m = e.militar;
    if (!m.crisis) { h.append(cabeceraHoja('Comida suficiente', 'Ya no hace falta dejar héroes inactivos.')); return; }
    if (!E.crisisSel) E.crisisSel = [];
    const activos = m.heroes.filter(x => !x.inactivo); E.crisisSel = E.crisisSel.filter(id => activos.some(x => x.id === id));
    h.append(cabeceraHoja('Falta comida para tus héroes', 'Elige al menos ' + m.crisis.n + ' que quedará' + (m.crisis.n > 1 ? 'n' : '') + ' inactivo' + (m.crisis.n > 1 ? 's' : '') + '. Quedan ' + minutosTxt(Math.max(0, m.crisis.plazoMs)) + ' jugados; si no eliges, el juego deja inactivos a los de menor nivel.', 'hoja-titulo'),
      el('p', { class: 'sub', text: 'Los inactivos no consumen comida y vuelven solos cuando hay comida (' + DM.heroes.inactividadMin + ' min jugados), o antes con pociones.' }));
    for (const x of activos) {
      const on = E.crisisSel.includes(x.id);
      h.append(el('label', { class: 'tarjeta-clara fila-check' + (on ? ' activo' : '') }, el('input', { type: 'checkbox', id: 'crisis-' + x.id, checked: on || null, onchange: ev => { E.crisisSel = ev.target.checked ? E.crisisSel.concat(x.id) : E.crisisSel.filter(i => i !== x.id); refrescarHoja(); } }),
        imgHeroe(x), el('span', { text: x.nombre + ' · nivel ' + x.nivel + ' · consume ' + M.mantHeroe(x, e) + ' comida/min' })));
    }
    h.append(el('button', { class: 'btn peligro ancho', id: 'btn-confirmar-crisis', text: 'Dejar inactivos', disabled: E.crisisSel.length < m.crisis.n, onclick: () => {
      const r = M.elegirInactivos(e, E.crisisSel); if (!r.ok) return aviso(r.motivo, 'aviso'); E.crisisSel = []; cerrarHoja(); guardar(); pintar(); aviso('Héroes inactivos', 'info', 'Se recuperarán solos cuando vuelva la comida.'); } }));
  }

  // ---------- Pestaña Ejército ----------
  function barraXp(x) {
    const q = x.nivel < DM.heroes.nivelMax ? M.requisitosSubir(x) : null, pr = q ? Math.min(1, x.xp / q.xp) : 1;
    return el('div', { class: 'barra-exp' }, el('i', { style: 'width:' + Math.round(pr * 100) + '%' }));
  }
  function pintarEjercito(zona) {
    const e = PARTIDA, m = e.militar, mt = M.mantenimiento(e), cu = M.edificio(e, 'cuartel');
    const caja = el('div', { class: 'ejercito', id: 'ejercito' });
    caja.append(el('div', { class: 'tarjeta-clara resumen-mil' },
      el('div', { class: 'fila' }, el('b', { text: 'Mantenimiento: ' }), el('span', { id: 'mant-militar', text: num(mt.heroes + mt.tropas) + ' comida/min' }),
        el('span', { class: 'sub', text: ' (héroes ' + num(mt.heroes) + ' · tropas ' + num(mt.tropas) + ')' })),
      el('div', { class: 'sub', text: (J.modo(e).tiempoReal ? 'Se consume en tiempo real (a la mitad mientras no juegas), también el de las tropas que están fuera.' : 'Solo se consume mientras juegas (también el de las tropas que están en marcha).') + ' Los obreros no comen.' + ' Si falta comida, desertan las tropas de la ciudad que no se pueden mantener y los héroes quedan inactivos.' }),
      el('div', { class: 'sub', text: 'Piedra-papel-tijera: infantería vence a caballería, caballería a arqueros y arqueros a infantería. Un ejército variado pelea mejor.' })));
    // 0.9 · tropa disponible (plazas de las tiendas de campaña del Campamento)
    { const pl = M.plazasTropas(e), tt = M.totalTropasConFuera(e);
      caja.append(el('div', { class: 'tarjeta-clara fila plazas-tropa' + (tt > pl ? ' exceso' : ''), id: 'resumen-plazas' }, imgIcoCamp('icono_tropa_disponible', 'ico-mil'),
        el('div', { class: 'datos' }, el('b', { text: 'Tropa disponible: ' + M.tropaDisponible(e).toLocaleString('es-ES') }), el('div', { class: 'sub', text: 'Tropas ' + tt.toLocaleString('es-ES') + ' de ' + pl.toLocaleString('es-ES') + ' plazas' + (tt > pl ? ' · tienes más de las que caben: no se quitan, pero no puedes entrenar más' : '') + '. Amplía las tiendas de campaña o despide tropas.' })),
        el('button', { class: 'btn secundario mini-btn', id: 'ejercito-ir-campamento', text: 'Campamento', onclick: () => { E.vista = 'campamento'; pintar(); } }))); }
    caja.append(el('h3', { text: 'Tropas en la ciudad' }));
    if (!cu) caja.append(el('p', { class: 'sub', id: 'sin-cuartel', text: 'Construye un ' + DM.edificios.cuartel.nombre + ' para entrenar tropas.' }));
    const lista = el('div', { class: 'lista-mil' });
    for (const t of M.TIPOS_TROPA) {
      const d = DM.tropas[t], n = m.tropas[t]; if (!n && d.avanzada && !M.tieneHab(e, d.avanzada)) continue;
      lista.append(el('div', { class: 'fila-mil', id: 'fila-tropa-' + t }, imgTropa(t), el('div', { class: 'datos' }, el('b', { text: d.nombre + (d.avanzada ? ' ★' : '') }), el('div', { class: 'sub', text: nombreClase(d.clase) + (d.avanzada ? ' avanzada' : '') + ' · fuerza ' + d.fuerza + ' · ' + d.mant + ' comida/min · carga ' + d.carga })),
        el('b', { class: 'cuenta', id: 'tropas-' + t, text: String(n) }),
        n > 0 ? el('button', { class: 'btn peligro mini-btn solo-icono', id: 'despedir-' + t, 'aria-label': 'Despedir ' + d.nombre.toLowerCase(), title: 'Despedir (libera plazas)', onclick: () => { E.despedir = { tipo: t, n: 1 }; abrirHoja(hojaDespedir); } }, imgIcoCamp('icono_despedir', 'ico-boton')) : null));
    }
    caja.append(lista);
    // 0.8 · obreros (no son ejército)
    const fo = M.obrerosFuera(e);
    if (M.totalObrerosConFuera(e) || M.edificio(e, 'escuela_maestria')) caja.append(el('h3', { text: 'Obreros (no son ejército) · ' + M.totalObrerosConFuera(e) + ' / ' + M.maxObreros(e) }), el('div', { class: 'lista-mil', id: 'lista-obreros' }, M.OBREROS.filter(t => m.obreros[t] || fo[t]).map(t =>
      el('div', { class: 'fila-mil', id: 'fila-obrero-' + t }, imgObrero(t), el('div', { class: 'datos' }, el('b', { text: DM.obreros[t].nombre }), el('div', { class: 'sub', text: 'carga ' + DM.obreros[t].carga.toLocaleString('es-ES') + (fo[t] ? ' · ' + fo[t] + ' farmeando' : '') })),
        el('b', { class: 'cuenta', id: 'obreros-' + t, text: String(m.obreros[t] || 0) })))));
    if (m.expediciones.length) {
      caja.append(el('h3', { text: 'Recogiendo en el mapa' }));
      caja.append(el('div', { class: 'lista-mil', id: 'lista-expediciones' }, m.expediciones.map(x => el('div', { class: 'fila-mil', id: 'exp-' + x.id }, imgRec(x.recurso, 'ico-mil'),
        el('div', { class: 'datos' }, el('b', { text: DM.zonas.recursos[x.recurso].nombre + ' · +' + x.cantidad + ' ' + J.NOMBRE_RECURSO[x.recurso].toLowerCase() }),
          el('div', { class: 'sub', text: Object.entries(x.obreros || {}).map(([t, n]) => n + ' ' + DM.obreros[t].nombre.toLowerCase()).join(', ') + ' · vuelven en ' + minutosTxt(Math.max(0, x.restanteMs)) })),
        x.fase === 'vuelta' ? null : el('button', { class: 'btn secundario mini-btn', id: 'cancelar-' + x.id, text: 'Volver', onclick: () => { const r = M.cancelarRecogida(e, x.id); accion(r, r.ok ? 'Han vuelto con ' + r.traido + ' de ' + J.NOMBRE_RECURSO[x.recurso].toLowerCase() : null); } })))));
    }
    if ((m.marchas || []).length) {
      caja.append(el('h3', { text: 'Ejércitos en marcha' }));
      caja.append(el('div', { class: 'lista-mil', id: 'lista-marchas' }, m.marchas.map(x => el('div', { class: 'fila-mil', id: 'marcha-fila-' + x.id }, imgUi('icono_guerra', 'ico-mil'),
        el('div', { class: 'datos' }, el('b', { text: (x.fase === 'ida' ? 'Hacia ' : 'Vuelven de ') + x.nombre + ' nv ' + x.nivel + (x.conquistar ? ' (conquista)' : '') }),
          el('div', { class: 'sub', text: Object.entries(x.tropas).filter(([, n]) => n > 0).map(([t, n]) => n + ' ' + DM.tropas[t].nombre.toLowerCase()).join(', ') + (x.heroes.length ? ' · ' + x.heroes.length + ' héroe' + (x.heroes.length > 1 ? 's' : '') : '') + ' · ' + (x.fase === 'ida' ? 'llegan en ' : 'vuelven en ') + minutosTxt(Math.max(0, x.restanteMs)) })),
        x.fase === 'ida' ? el('button', { class: 'btn secundario mini-btn', id: 'retirar-' + x.id, text: 'Volver', onclick: () => accion(M.retirarMarcha(e, x.id), 'Tu ejército da la vuelta') }) : null))));
    }
    if (J.nivelCiudad(e) >= DM.guerra.desdeAyto || M.nivelMuralla(e)) {
      const fd = M.fuerzaDefensa(e);
      caja.append(el('div', { class: 'tarjeta-clara', id: 'resumen-defensa' }, el('b', { text: 'Defensa de la ciudad: ' + Math.round(fd.total).toLocaleString('es-ES') }),
        el('div', { class: 'sub', text: 'Tropas y héroes en la ciudad ' + Math.round(fd.ejercito) + ' + defensas ' + Math.round(fd.defensas) + (fd.bono ? ' · muralla ' + pct(fd.bono) : ' · sin muralla') + (M.enGuerra(e).length ? ' · en guerra con ' + M.enGuerra(e).map(c => c.nombre).join(', ') : '') })));
    }
    caja.append(el('h3', { text: 'Héroes' }));
    if (!m.heroes.length) caja.append(el('p', { class: 'sub', text: m.heroeInicialPendiente ? 'Elige tu héroe inicial con el aviso de arriba.' : 'Cría héroes en el ' + DM.edificios.salon_heroes.nombre + ' o convócalos con fragmentos (Inventario).' }));
    const lh = el('div', { class: 'lista-mil' });
    for (const x of m.heroes) {
      const st = M.estadoHeroe(x);
      lh.append(el('button', { class: 'fila-mil boton estado-' + st, id: 'heroe-' + x.id, onclick: () => abrirHoja(hh => hojaHeroe(hh, x.id)) }, imgHeroe(x),
        el('div', { class: 'datos' }, el('b', { text: x.nombre + ' · nivel ' + x.nivel }), el('div', { class: 'sub', text: DM.heroes.tipos[x.tipo].nombre + ' · poder ' + M.poderHeroe(x) + ' · ' + Math.floor(x.xp) + ' xp' + (x.faltanFragmentos ? ' · faltan fragmentos' : '') }), barraXp(x)),
        el('span', { class: 'chip ' + st, text: ESTADO_HEROE[st] + (st === 'fuera' ? '' : st === 'herido' ? ' ' + minutosTxt(x.heridoMs) : st === 'inactivo' ? ' ' + minutosTxt(x.inactivoMs) : '') })));
    }
    caja.append(lh, el('h3', { text: 'Academia' }), el('p', { class: 'sub', id: 'investigado', text: Object.keys(m.academia).length ? DM.academia.habilidades.filter(hb => m.academia[hb.id]).map(hb => hb.nombre + ' ' + m.academia[hb.id]).join(' · ') : 'Nada aprendido todavía (en la ' + DM.edificios.academia.nombre + ').' }),
      el('p', { class: 'sub', text: 'Pociones, fragmentos y objetos: pestaña «Inventario». Ve al «Mapa» para atacar monstruos y ciudades o mandar tropas a recoger.' }));
    zona.append(caja);
  }

  // 0.9 · despedir tropas de la ciudad para liberar plazas (no devuelven nada)
  function hojaDespedir(h) {
    const e = PARTIDA, D0 = E.despedir || {}, t = D0.tipo, d = DM.tropas[t]; if (!d) return;
    const tiene = e.militar.tropas[t] || 0, n = Math.max(1, Math.min(tiene, D0.n || 1));
    h.append(cabeceraHoja('Despedir ' + d.nombre.toLowerCase(), 'Tienes ' + tiene.toLocaleString('es-ES') + ' en la ciudad. Se van para siempre y no devuelven nada; liberan su plaza.', 'hoja-titulo'));
    if (!tiene) { h.append(el('p', { class: 'sub', text: 'No quedan en la ciudad.' })); return; }
    h.append(el('div', { class: 'tarjeta-clara' }, el('div', { class: 'fila' }, imgTropa(t), el('b', { id: 'despedir-n', text: n.toLocaleString('es-ES') + ' × ' + d.nombre })),
      el('input', { type: 'range', class: 'deslizador', id: 'despedir-deslizador', style: 'width:100%;accent-color:var(--granate);min-height:40px', min: '1', max: String(tiene), step: '1', value: String(n), 'aria-label': 'Cuántas despedir',
        oninput: ev => { E.despedir.n = Math.max(1, +ev.target.value | 0); const b = $('#despedir-n'); if (b) b.textContent = E.despedir.n.toLocaleString('es-ES') + ' × ' + d.nombre; } }),
      el('div', { class: 'sub', text: 'Tropa disponible ahora: ' + M.tropaDisponible(e).toLocaleString('es-ES') })),
      el('button', { class: 'btn peligro ancho', id: 'btn-confirmar-despedir', onclick: () => { const k = E.despedir.n; const r = M.despedirTropas(e, t, k); if (!r.ok) return aviso(r.motivo, 'aviso'); cerrarHoja(); guardar(); pintar(); aviso(k + ' × ' + d.nombre + ' despedid' + (k > 1 ? 'os' : 'o'), 'info', 'Tropa disponible: ' + r.disponible.toLocaleString('es-ES')); } }, imgIcoCamp('icono_despedir', 'ico-boton'), 'Despedir'));
  }

  // ---------- 0.9 · Campamento (esquina inferior derecha de la ciudad): mapa propio con tiendas de campaña y cabañas de obreros ----------
  const CAMP_COLS = 5, CAMP_FILAS = 6, CAMP_CEL = 32;   // 30 huecos de 3×3 casillas (96 dp, como los dibujos) con 1 de separación; casillas de 32 dp como la ciudad y el suelo de Camachin
  const W_CAMP = CAMP_COLS * 4 + 1, H_CAMP = CAMP_FILAS * 4 + 1;
  const posHuecoCamp = i => ({ c: 1 + (i % CAMP_COLS) * 4, f: 1 + Math.floor(i / CAMP_COLS) * 4 });
  // suelo_campamento de Camachin con rejilla dual (como camino y plaza de la 0.2): cada pieza mira sus 4 casillas NO, NE, SO, SE; variante a/b por posición
  function sueloCampamento(abiertos) {
    const s = new Uint8Array(W_CAMP * H_CAMP), pon = (c, f) => { if (c >= 0 && f >= 0 && c < W_CAMP && f < H_CAMP) s[f * W_CAMP + c] = 1; };
    for (let i = 0; i < abiertos; i++) { const p = posHuecoCamp(i); for (let f = p.f - 1; f <= p.f + 3; f++) for (let c = p.c - 1; c <= p.c + 3; c++) pon(c, f); }
    const en = (c, f) => c >= 0 && f >= 0 && c < W_CAMP && f < H_CAMP ? s[f * W_CAMP + c] : 0, capa = el('div', { class: 'suelo-campamento', 'aria-hidden': 'true' });
    for (let j = 0; j <= H_CAMP; j++) for (let i = 0; i <= W_CAMP; i++) {
      const k = '' + en(i - 1, j - 1) + en(i, j - 1) + en(i - 1, j) + en(i, j); if (k === '0000') continue;
      const b = (i + j) % 2 === 1, n = k === '1111' ? (b ? '1111_b' : '1111') : k + (b ? '_b' : '_a');
      capa.append(el('img', { class: 'pieza-suelo', src: 'img/campamento/suelo/suelo_campamento_' + n + '.png', alt: '', draggable: 'false', style: `left:${(i - 0.5) * CAMP_CEL}px;top:${(j - 0.5) * CAMP_CEL}px;width:${CAMP_CEL}px;height:${CAMP_CEL}px` }));
    }
    return capa;
  }
  function pintarCampamento(zona) {
    const e = PARTIDA, C = e.militar.campamento, abiertos = M.huecosCampamento(e), pm = M.puedeMejorarCampamento(e), sig = C.nivel < DM.campamento.max ? DM.campamento.coste[C.nivel] : null;
    const pl = M.plazasTropas(e), tt = M.totalTropasConFuera(e), mo = M.maxObreros(e), to = M.totalObrerosConFuera(e);
    zona.classList.add('zona-campamento');
    zona.append(el('div', { class: 'ciudad-barra' },
      el('button', { class: 'btn secundario barra solo-icono', id: 'btn-volver-ciudad', 'aria-label': 'Volver a la ciudad', title: 'Volver a la ciudad', onclick: () => { E.vista = 'ciudad'; pintar(); } }, ico('atras')),
      el('span', { class: 'huecos-texto', id: 'campamento-titulo', text: 'Campamento nivel ' + C.nivel + ' · huecos ' + C.edificios.length + ' de ' + abiertos })));
    zona.append(el('div', { class: 'tarjeta-clara resumen-campamento', id: 'resumen-campamento' },
      el('div', { class: 'fila' }, imgCamp('campamento', C.nivel, 'ico-mil'), el('div', { class: 'datos' },
        el('div', { class: 'fila plazas' }, imgIcoCamp('icono_tropa_disponible'), el('b', { id: 'camp-tropas', text: 'Tropa disponible ' + M.tropaDisponible(e).toLocaleString('es-ES') }), el('span', { class: 'sub', text: '(' + tt.toLocaleString('es-ES') + ' / ' + pl.toLocaleString('es-ES') + ' plazas)' })),
        el('div', { class: 'fila plazas' }, imgIcoCamp('icono_obreros_max'), el('b', { id: 'camp-obreros', text: 'Obreros ' + to.toLocaleString('es-ES') + ' / ' + mo.toLocaleString('es-ES') }), el('span', { class: 'sub', text: '(máximo)' })),
        (tt > pl || to > mo) ? el('div', { class: 'sub aviso-exceso', id: 'camp-exceso', text: 'Tienes más de lo que cabe: no se quita nada, pero no podrás crear más hasta ampliar.' }) : null)),
      sig ? el('div', { class: 'fila', style: 'gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px' }, el('span', { class: 'sub', text: 'Mejorar a nivel ' + (C.nivel + 1) + ' (' + DM.campamento.huecos[C.nivel] + ' huecos):' }), costeIconos(sig),
        repetible(el('button', { class: 'btn principal mini-btn', id: 'btn-mejorar-campamento', text: 'Mejorar', disabled: !pm.ok, onclick: () => { const r = M.mejorarCampamento(e); accion(r, r.ok ? 'Campamento a nivel ' + r.nivel : null); } }), () => M.mejorarCampamento(e), () => 'Campamento a nivel ' + e.militar.campamento.nivel)) : el('b', { text: 'Nivel máximo' }),
      sig && !pm.ok ? el('div', { class: 'motivo', id: 'motivo-campamento', text: pm.motivo }) : null));
    const vista = el('div', { class: 'ciudad-vista campamento-vista', id: 'campamento-vista' });
    const mapa = el('div', { class: 'mapa-campamento', id: 'mapa-campamento', style: `width:${W_CAMP * CAMP_CEL}px;height:${H_CAMP * CAMP_CEL}px` }, sueloCampamento(abiertos));
    for (let i = 0; i < DM.campamento.huecos[DM.campamento.max - 1]; i++) {
      const p = posHuecoCamp(i), b = C.edificios.find(x => x.hueco === i), bloq = i >= abiertos, T = b ? DM.campamento.tipos[b.tipo] : null;
      const d = el('button', { type: 'button', class: 'hueco-camp' + (b ? ' ocupado ' + b.tipo : bloq ? ' bloqueado' : ' libre'), id: 'camp-hueco-' + i, 'data-h': i, 'data-tipo': b ? b.tipo : '',
        'aria-label': b ? T.nombre + ' nivel ' + b.nivel + ' (' + M.plazasDe(b.tipo, b.nivel) + ' plazas)' : bloq ? 'Hueco bloqueado' : 'Hueco libre: construir', style: `left:${p.c * CAMP_CEL}px;top:${p.f * CAMP_CEL}px;width:${3 * CAMP_CEL}px;height:${3 * CAMP_CEL}px`,
        onclick: () => b ? abrirHoja(h => hojaEdifCamp(h, b.id)) : bloq ? aviso('Hueco bloqueado', 'info', 'Se abre al mejorar el Campamento.') : abrirHoja(h => hojaConstruirCamp(h, i)) });
      if (b) d.append(imgCamp(b.tipo, b.nivel, 'edif'), el('span', { class: 'nivel', text: String(b.nivel) }));
      else if (!bloq) d.append(el('span', { class: 'mas-camp', text: '+' }));
      mapa.append(d);
    }
    vista.append(mapa); zona.append(vista);
  }
  function hojaConstruirCamp(h, i) {
    const e = PARTIDA; h.append(cabeceraHoja('Construir en el campamento', 'Hueco ' + (i + 1) + '. Instantáneo si tienes los recursos.'));
    for (const [t, T] of Object.entries(DM.campamento.tipos)) {
      const p = M.puedeConstruirCamp(e, t, i);
      h.append(el('div', { class: 'opcion-edif tarjeta-clara' + (p.ok ? '' : ' no'), 'data-tipo': t }, el('div', { class: 'mini' }, imgCamp(t, 1, 'mini-edif')),
        el('div', { class: 'datos' }, el('div', { class: 'nombre-edif', text: T.nombre }), el('div', { class: 'sub', text: '+' + M.plazasDe(t, 1) + (T.para === 'tropas' ? ' plazas de tropa' : ' obreros como máximo') + ' (cada nivel da un ' + Math.round((T.crecePlazas - 1) * 100) + ' % más que el anterior)' }),
          el('div', { class: 'coste' }, costeIconos(T.coste[0])), !p.ok ? el('div', { class: 'motivo', text: p.motivo }) : null),
        el('button', { class: 'btn principal', id: 'construir-camp-' + t, text: 'Construir', disabled: !p.ok, onclick: () => { const r = M.construirCamp(e, t, i); if (!r.ok) return aviso(r.motivo, 'aviso'); cerrarHoja(); guardar(); pintar(); aviso(T.nombre + ' construida', 'exito'); } })));
    }
  }
  function hojaEdifCamp(h, id) {
    const e = PARTIDA, b = M.edificioCamp(e, id); if (!b) { h.append(cabeceraHoja('Ya no está', '')); return; }
    const T = DM.campamento.tipos[b.tipo], pm = M.puedeMejorarCamp(e, id), sig = b.nivel < DM.campamento.max ? T.coste[b.nivel] : null, mx = M.maxMejoraCamp(e, id), pd = M.puedeDemolerCamp(e, id);
    const que = T.para === 'tropas' ? ' plazas de tropa' : ' obreros como máximo';
    h.append(el('div', { class: 'hoja-cabecera' }, el('div', { class: 'mini' }, imgCamp(b.tipo, b.nivel, 'mini-edif')), el('div', { style: 'flex:1;min-width:0' }, el('h2', { id: 'hoja-titulo', text: T.nombre + ' · nivel ' + b.nivel })),
      el('button', { class: 'btn-icono', id: 'hoja-cerrar', 'aria-label': 'Cerrar', onclick: cerrarHoja }, ico('cerrar'))));
    h.append(el('p', { id: 'camp-da', text: 'Da ' + M.plazasDe(b.tipo, b.nivel).toLocaleString('es-ES') + que + '. En total: ' + (T.para === 'tropas' ? M.plazasTropas(e) : M.maxObreros(e)).toLocaleString('es-ES') + '.' }));
    h.append(el('div', { class: 'tarjeta-clara' }, sig ? el('div', {}, el('b', { text: 'Mejorar a nivel ' + (b.nivel + 1) + ' (+' + M.plazasNivel(b.tipo, b.nivel + 1).toLocaleString('es-ES') + ' → ' + M.plazasDe(b.tipo, b.nivel + 1).toLocaleString('es-ES') + que + ')' }), el('div', { class: 'coste', id: 'coste-mejora-camp' }, costeIconos(sig))) : el('b', { text: 'Nivel máximo' }),
      !pm.ok && sig ? el('div', { class: 'motivo', text: pm.motivo }) : null));
    if (sig && mx.pasos > 1) h.append(el('p', { class: 'sub', text: 'Con «Máx» sube hasta nivel ' + mx.nivel + ' (' + mx.pasos + ' niveles) por ' + textoCoste(mx.coste) + '.' }));
    h.append(el('div', { class: 'fila acciones-edif' },
      repetible(el('button', { class: 'btn principal', id: 'btn-mejorar-camp', disabled: !pm.ok, onclick: () => { const r = M.mejorarCamp(e, id); accion(r, r.ok ? 'Mejorada a nivel ' + r.nivel : null); } }, 'Mejorar'), () => M.mejorarCamp(e, id), () => T.nombre + ' a nivel ' + b.nivel),
      sig ? botonMax('btn-mejorar-camp-max', mx.pasos >= 1, 'Mejorar al máximo pagable (nivel ' + mx.nivel + ')', () => { const r = M.mejorarCampMax(e, id); accion(r, r.ok ? 'Mejorada a nivel ' + r.nivel + ' (+' + r.niveles + ')' : null); }) : null,
      el('button', { class: 'btn peligro solo-icono', id: 'btn-demoler-camp', 'aria-label': 'Demoler', title: 'Demoler', disabled: !pd.ok, onclick: () => { const r = M.demolerCamp(e, id); if (!r.ok) return aviso(r.motivo, 'error'); cerrarHoja(); guardar(); pintar(); aviso('Demolida', 'exito', 'Recuperas: ' + textoCoste(r.devuelto)); } }, ico('demoler'))),
      el('p', { class: 'sub', text: 'El nivel máximo lo marca el Campamento. Al demoler recuperas el 50 % (nunca se quitan tropas ni obreros, aunque sobren).' }));
    if (!pd.ok) h.append(el('p', { class: 'motivo', id: 'motivo-demoler-camp', text: pd.motivo }));
  }

  // ---------- 0.5 · Pestaña Inventario: pociones, fragmentos y objetos ----------
  function pintarInventario(zona) {
    const e = PARTIDA, m = e.militar, caja = el('div', { class: 'ejercito inventario', id: 'inventario' });
    caja.append(el('div', { class: 'fila', style: 'justify-content:space-between;align-items:center' }, el('h3', { text: 'Pociones' }),
      el('button', { class: 'btn secundario mini-btn', id: 'inv-tienda', onclick: abrirTienda }, imgUi('icono_tienda_on', 'ico-coste'), 'Tienda')));
    // 0.6: se ven las que tienes y las que ya puedes fabricar; las de efecto se usan directamente (toda la partida)
    const bot = M.edificio(e, 'botica'), visibles = M.POCIONES.filter(p => m.pociones[p] > 0 || (bot && bot.nivel >= DM.pociones[p].botica) || DM.pociones[p].tipo === 'curacion');
    caja.append(el('div', { class: 'lista-mil' }, visibles.map(p => el('div', { class: 'fila-mil' }, imgPocion(p), el('div', { class: 'datos' }, el('b', { text: DM.pociones[p].nombre }), el('div', { class: 'sub', text: textoPocion(p) })),
      el('b', { class: 'cuenta', id: 'pociones-' + p, text: String(m.pociones[p]) }),
      el('button', { class: 'btn secundario mini-btn', id: 'inv-usar-' + p, text: 'Usar', disabled: !(m.pociones[p] > 0), onclick: () => DM.pociones[p].tipo === 'efecto' ? accion(M.usarPocion(e, p), DM.pociones[p].nombre + ' activa') : DM.pociones[p].tipo === 'enfriamiento' ? (() => { const r = M.usarPocion(e, p); accion(r, r.ok ? 'Espera para el próximo asedio: ' + minutosTxt(r.asedioMs) : null); })() : abrirHoja(h => hojaUsarPocion(h, p)) })))));
    caja.append(el('h3', { text: 'Fragmentos' }), el('p', { class: 'sub', text: 'Los monstruos sueltan fragmentos de su familia. Con ' + DM.convocar.fragmentos + ' convocas a su héroe (en el ' + DM.edificios.salon_heroes.nombre + '). Desde el nivel ' + DM.heroes.fragmentosDesde + ' los héroes también gastan fragmentos para subir.' }));
    const lf = el('div', { class: 'lista-mil' });
    for (const f of M.FAMILIAS) {
      const n = m.fragFamilia[f] || 0, pc = M.puedeConvocar(e, f), T = DM.heroes.tipos[f];
      lf.append(el('div', { class: 'fila-mil', 'data-familia': f }, imgFragmento(f), el('div', { class: 'datos' }, el('b', { text: 'Fragmento de ' + nombreFamilia(f).toLowerCase() }),
        el('div', { class: 'sub', text: 'Convoca a ' + T.nombres[0] + ' (' + T.papel.toLowerCase() + ')' }), el('div', { class: 'barra-exp' }, el('i', { style: 'width:' + Math.min(100, Math.round(n / DM.convocar.fragmentos * 100)) + '%' }))),
        el('b', { class: 'cuenta', id: 'frag-' + f, text: n + ' / ' + DM.convocar.fragmentos }),
        el('button', { class: 'btn principal mini-btn', id: 'convocar-' + f, text: 'Convocar', disabled: !pc.ok, title: pc.ok ? '' : pc.motivo, onclick: () => { const r = M.convocar(e, f); if (r.ok) { guardar(); pintar(); aviso(r.heroe.nombre + ' acude a tu llamada', 'exito', T.nombre + ' de nivel ' + r.heroe.nivel + ' (el del ' + DM.edificios.salon_heroes.nombre + ').'); } else aviso(r.motivo, 'aviso'); } })));
    }
    lf.append(el('div', { class: 'fila-mil' }, imgFragmento(null), el('div', { class: 'datos' }, el('b', { text: 'Fragmentos comunes' }), el('div', { class: 'sub', text: 'Caen al saquear ciudades (y los de partidas antiguas). Sirven a cualquier héroe desde el nivel ' + DM.heroes.fragmentosDesde + '.' })),
      el('b', { class: 'cuenta', id: 'fragmentos', text: String(m.fragmentos) })));
    caja.append(lf, el('h3', { text: 'Objetos' }));
    const objs = M.OBJETOS.filter(o => m.objetos[o] > 0);
    if (!objs.length) caja.append(el('p', { class: 'sub', id: 'sin-objetos', text: 'Aún no tienes objetos. Los cofres caen al saquear ciudades enemigas y se compran en la tienda.' }));
    caja.append(el('div', { class: 'lista-mil' }, objs.map(o => el('div', { class: 'fila-mil', 'data-objeto': o }, imgObjeto(o), el('div', { class: 'datos' }, el('b', { text: DM.objetos[o].nombre }), el('div', { class: 'coste' }, costeIconos(DM.objetos[o].recursos))),
      el('b', { class: 'cuenta', id: 'objetos-' + o, text: String(m.objetos[o]) }),
      el('button', { class: 'btn principal mini-btn', id: 'abrir-' + o, text: 'Abrir', onclick: () => { const r = M.abrirObjeto(e, o); const nf = r.ok && r.fragmentos ? r.fragmentos.comunes + Object.values(r.fragmentos.familias).reduce((a, b) => a + b, 0) : 0;
        accion(r, r.ok ? DM.objetos[o].nombre + ' abierto' + (nf ? ' · +' + nf + ' fragmentos' : '') : null); } })))));
    zona.append(caja);
  }
  const textoPocion = p => { const d = DM.pociones[p]; if (d.tipo === 'enfriamiento') return (d.menosMin ? '−' + d.menosMin + ' min' : d.pct >= 1 ? 'Toda (−100 %, al instante)' : '−' + Math.round(d.pct * 100) + ' %') + ' de la espera para el próximo asedio (solo tú)';
    if (d.tipo !== 'efecto') return '−' + d.minutos + ' min de herida o inactividad de un héroe';
    return (d.efecto === 'fuerza' ? '+' + Math.round(d.pct * 100) + ' % fuerza del ejército' + ' durante ' + d.duracion + ' min' : d.efecto === 'farmeo' ? '−' + Math.round(d.pct * 100) + ' % tiempo de trabajo (al salir, ' + d.duracion + ' min; o sobre un farmeo en curso)' : '−' + Math.round(d.pct * 100) + ' % tiempo de marcha por el mapa durante ' + d.duracion + ' min (o sobre una marcha en curso, también de obreros)'); };
  function hojaUsarPocion(h, p) {
    const e = PARTIDA, m = e.militar, nec = m.heroes.filter(x => M.estadoHeroe(x) === 'herido' || M.estadoHeroe(x) === 'inactivo');
    h.append(cabeceraHoja(DM.pociones[p].nombre + ' · tienes ' + m.pociones[p], 'Elige a qué héroe se la das.', 'hoja-titulo'));
    if (!nec.length) h.append(el('p', { class: 'sub', id: 'sin-heridos', text: 'Ningún héroe está herido ni inactivo.' }));
    for (const x of nec) h.append(el('div', { class: 'tarjeta-clara opcion-mil' }, imgHeroe(x), el('div', { class: 'datos' }, el('b', { text: x.nombre }), el('div', { class: 'sub', text: ESTADO_HEROE[M.estadoHeroe(x)] + ': ' + minutosTxt(x.heridoMs || x.inactivoMs) })),
      el('button', { class: 'btn principal mini-btn', id: 'dar-' + x.id, text: 'Usar', disabled: !(m.pociones[p] > 0), onclick: () => accion(M.usarPocion(e, p, x.id), DM.pociones[p].nombre + ' usada') })));
  }

  // ---------- 0.5 · Pestaña Misiones ----------
  function pintarMisiones(zona) {
    const e = PARTIDA, caja = el('div', { class: 'ejercito misiones', id: 'misiones' }), lista = M.misiones(e);
    caja.append(el('p', { class: 'sub', text: 'Cumple misiones sencillas y cobra su premio.' }));
    const orden = lista.slice().sort((a, b) => (a.cobrada - b.cobrada) || (b.completa - a.completa));
    for (const mi of orden) caja.append(el('div', { class: 'tarjeta-clara mision' + (mi.grande ? ' grande' : '') + (mi.cobrada ? ' hecho' : mi.completa ? ' lista' : ''), id: 'mision-' + mi.id },
      el('div', { class: 'datos' }, el('b', { text: mi.texto + (mi.cobrada ? ' ✓' : '') }), el('div', { class: 'sub', text: mi.valor + ' / ' + mi.meta }),
        el('div', { class: 'barra-exp' }, el('i', { style: 'width:' + Math.round(mi.valor / mi.meta * 100) + '%' })), el('div', { class: 'coste' }, costeIconos(mi.premio))),
      mi.cobrada ? null : el('button', { class: 'btn principal mini-btn', id: 'cobrar-' + mi.id, text: 'Cobrar', disabled: !mi.completa, onclick: () => { const r = M.cobrarMision(e, mi.id); accion(r, r.ok ? 'Premio cobrado' : null); } })));
    zona.append(caja);
  }

  // ---------- 0.5 · Pestaña Estadísticas (lo que antes iba en la barra de recursos) ----------
  function pintarEstadisticas(zona) {
    const e = PARTIDA, m = e.militar, rit = J.ritmos(e), cap = J.capacidadASalvo(e), mt = M.mantenimiento(e), caja = el('div', { class: 'ejercito estadisticas', id: 'estadisticas' });
    caja.append(el('h3', { text: 'Recursos' }));
    const tabla = el('div', { class: 'tabla-est' }, el('div', { class: 'fila-est cab' }, el('span', {}), el('span', { text: 'Tienes' }), el('span', { text: 'Por minuto' }), el('span', { text: 'A salvo' })));
    for (const k of J.RECURSOS) {
      let r = rit[k]; if (k === 'comida') r -= mt.heroes + mt.tropas;
      const v = N(e.recursos[k]);
      tabla.append(el('div', { class: 'fila-est', id: 'stat-' + k }, el('span', { class: 'nom' }, imgRec(k, 'ico-coste'), J.NOMBRE_RECURSO[k]), el('b', { text: v.toLocaleString('es-ES') }),
        el('span', { class: 'ritmo' + (r < 0 ? ' neg' : ''), id: 'stat-ritmo-' + k, text: (r > 0 ? '+' : '') + num(r).toLocaleString('es-ES') + '/min' }), el('span', { id: 'stat-salvo-' + k, text: Math.min(v, cap).toLocaleString('es-ES') })));
    }
    caja.append(tabla, el('p', { class: 'sub', text: (J.modo(e).tiempoReal ? 'Por minuto (Clásica: tiempo real; desconectado, la mitad);' : 'Por minuto jugado (a velocidad x1);') + ' la comida ya descuenta lo que comen tropas y héroes. «A salvo»: lo protegido por el ayuntamiento y los depósitos (' + cap.toLocaleString('es-ES') + ' de cada recurso).' }));
    // 0.8 · producción por minuto: ciudad principal / ciudades conquistadas / total (sin descontar el mantenimiento)
    const PD = M.produccionDesglose(e), nc = m.ciudades.filter(c => c.conquistada).length;
    const tp = el('div', { class: 'tabla-est', id: 'tabla-produccion' }, el('div', { class: 'fila-est cab' }, el('span', {}), el('span', { text: 'Ciudad principal' }), el('span', { text: 'Conquistadas (' + nc + ')' }), el('span', { text: 'Total' })));
    for (const k of J.RECURSOS) tp.append(el('div', { class: 'fila-est', id: 'prod-' + k }, el('span', { class: 'nom' }, imgRec(k, 'ico-coste'), J.NOMBRE_RECURSO[k]),
      el('span', { id: 'prod-principal-' + k, text: '+' + num(PD.principal[k] || 0).toLocaleString('es-ES') }), el('span', { id: 'prod-conq-' + k, text: '+' + num(PD.conquistadas[k] || 0).toLocaleString('es-ES') }), el('b', { id: 'prod-total-' + k, text: '+' + num(PD.total[k] || 0).toLocaleString('es-ES') })));
    caja.append(el('h3', { text: 'Producción por minuto' }), tp, el('p', { class: 'sub', text: 'Las ciudades conquistadas te pagan un tributo según su fuerza (antes de descontar lo que comen tropas y héroes).' }));
    // 0.9 · ciudades conquistadas al detalle: por recurso (minuto, hora, día, % del total, la que más da) y por ciudad
    if (PD.porCiudad.length) {
      const rr = J.RECURSOS.filter(k => PD.porCiudad.some(c => c.ritmo[k] > 0)), f1 = v => num(v).toLocaleString('es-ES');
      const tr = el('div', { class: 'tabla-est cinco', id: 'tabla-conquistadas-recurso' }, el('div', { class: 'fila-est cab' }, el('span', {}), el('span', { text: '/min' }), el('span', { text: '/hora' }), el('span', { text: '/día' }), el('span', { text: '% del total' }), el('span', { text: 'La que más da' })));
      for (const k of rr) { const v = PD.conquistadas[k] || 0, mej = PD.porCiudad.slice().sort((a, b) => b.ritmo[k] - a.ritmo[k])[0];
        tr.append(el('div', { class: 'fila-est', id: 'conq-' + k }, el('span', { class: 'nom' }, imgRec(k, 'ico-coste'), J.NOMBRE_RECURSO[k]), el('b', { text: '+' + f1(v) }), el('span', { text: '+' + Math.round(v * 60).toLocaleString('es-ES') }), el('span', { text: '+' + Math.round(v * 1440).toLocaleString('es-ES') }),
          el('span', { id: 'conq-pct-' + k, text: (PD.total[k] ? Math.round(v / PD.total[k] * 1000) / 10 : 0).toLocaleString('es-ES') + ' %' }), el('span', { class: 'sub', text: mej.nombre }))); }
      const tc = el('div', { class: 'tabla-est muchas', id: 'tabla-conquistadas-ciudad', style: '--cols:' + (rr.length + 1) }, el('div', { class: 'fila-est cab' }, el('span', { text: 'Ciudad' }), rr.map(k => el('span', { class: 'cab-ico' }, imgRec(k, 'ico-coste'))), el('span', { text: 'Total/min' })));
      for (const [i, c] of PD.porCiudad.entries()) tc.append(el('div', { class: 'fila-est', id: 'conq-ciudad-' + i }, el('span', { class: 'nom', text: c.nombre + ' · nv ' + c.nivel + (c.antigua ? ' (0.7)' : '') }), rr.map(k => el('span', { text: '+' + f1(c.ritmo[k]) })), el('b', { text: '+' + f1(Object.values(c.ritmo).reduce((s, v) => s + v, 0)) })));
      caja.append(el('h3', { text: 'Ciudades conquistadas · por recurso' }), tr, el('h3', { text: 'Ciudades conquistadas · por ciudad' }), tc);
    }
    const dato = (id, t, v) => el('div', { class: 'fila-est dos', id }, el('span', { text: t }), el('b', { text: String(v) }));
    const recog = Object.entries(m.recolectado || {}).filter(([, v]) => v).map(([k, v]) => v.toLocaleString('es-ES') + ' ' + J.NOMBRE_RECURSO[k].toLowerCase()).join(' · ') || 'nada';
    caja.append(el('h3', { text: 'Ciudad' }), el('div', { class: 'tabla-est' },
      dato('stat-personas', 'Personas (libres / total)', J.personasLibres(e) + ' / ' + J.personasTotales(e)), dato('stat-impuestos', 'Impuestos', '+' + rit.oro.toLocaleString('es-ES') + ' oro/min'),
      dato('stat-huecos', 'Huecos ocupados', e.edificios.length + ' / ' + J.huecosDisponibles(e)), dato('stat-jugado', 'Tiempo jugado', tiempo(e.jugadoMs)),
      dato('stat-modo', 'Modo de partida', J.modo(e).nombre), dato('stat-nivel-jugador', 'Nivel del jugador (= ayuntamiento)', M.nivelJugador(e)), dato('stat-muralla', 'Muralla · defensas', (M.nivelMuralla(e) ? 'nivel ' + M.nivelMuralla(e) : 'sin muralla') + ' · ' + M.totalDefensas(e))));
    caja.append(el('p', { class: 'sub', id: 'explica-nivel-jugador', text: 'Nivel del jugador: es el nivel de tu ayuntamiento. Desde el nivel ' + DM.ocultarMonstruos.desdeNivelJugador + ', el mapa deja de mostrar los monstruos de nivel menor que ' + DM.ocultarMonstruos.menoresDe + ' (no los legendarios ni los que estés atacando).' }));
    caja.append(el('h3', { text: 'Ejército' }), el('div', { class: 'tabla-est' },
      dato('stat-tropas', 'Tropas (en la ciudad / fuera)', M.totalTropas(e) + ' / ' + (M.totalTropasConFuera(e) - M.totalTropas(e))), dato('stat-plazas', 'Plazas de tropa (usadas / total)', M.totalTropasConFuera(e).toLocaleString('es-ES') + ' / ' + M.plazasTropas(e).toLocaleString('es-ES')),
      dato('stat-campamento', 'Campamento', 'nivel ' + m.campamento.nivel + ' · máx. obreros ' + M.maxObreros(e) + ' · despedidas ' + (m.despedidas || 0)), dato('stat-mant', 'Mantenimiento', num(mt.heroes + mt.tropas) + ' comida/min'),
      dato('stat-heroes', 'Héroes', m.heroes.length), dato('stat-combates', 'Combates (victorias / derrotas)', m.combates + ' (' + m.victorias + ' / ' + m.derrotas + ')'),
      dato('stat-saqueos', 'Ciudades saqueadas', m.saqueos), dato('stat-recolecciones', 'Recolecciones', m.recolecciones + ' · ' + recog),
      dato('stat-entrenadas', 'Tropas entrenadas', m.entrenadas), dato('stat-obreros', 'Obreros (en la ciudad / farmeando)', M.totalObreros(e) + ' / ' + (M.totalObrerosConFuera(e) - M.totalObreros(e))), dato('stat-capturados', 'Monstruos capturados', m.capturados || 0), dato('stat-desertores', 'Desertores', m.desertores), dato('stat-convocados', 'Héroes convocados', m.convocados),
      dato('stat-conquistas', 'Ciudades conquistadas (de las 50)', m.ciudades.filter(c => c.conquistada && !c.antigua).length + ' / ' + m.ciudades.filter(c => !c.antigua).length + (m.ciudades.some(c => c.antigua) ? ' (+' + m.ciudades.filter(c => c.antigua).length + ' de la 0.7)' : '')), dato('stat-guerra', 'En guerra con', M.enGuerra(e).length),
      dato('stat-defensas', 'Ataques rechazados / sufridos', (m.defensasGanadas || 0) + ' / ' + (m.defensasPerdidas || 0)),
      dato('stat-robado', 'Te han robado', Object.entries(m.robado || {}).filter(([, v]) => v).map(([k, v]) => v.toLocaleString('es-ES') + ' ' + J.NOMBRE_RECURSO[k].toLowerCase()).join(' · ') || 'nada')));
    zona.append(caja);
  }

  // ---------- Hojas de los edificios militares ----------
  function describirMilitar(tipo, nivel) {
    const d = DM.edificios[tipo], pers = d.trab[nivel - 1] + ' persona' + (d.trab[nivel - 1] > 1 ? 's' : '') + ' máx.';
    if (tipo === 'academia') return 'Árbol de habilidades por ramas · niveles de habilidad según la Academia · ' + pers;
    if (tipo === 'cuartel') return 'Entrena tropas' + (nivel >= DM.cuartelAvanzadas ? ' (también avanzadas)' : ' (avanzadas desde nivel ' + DM.cuartelAvanzadas + ')') + ' · ' + pers;
    if (tipo === 'salon_heroes') return 'Cría héroes y convoca héroes con fragmentos · ' + pers;
    if (tipo === 'botica') return 'Fabrica pociones al instante · ' + pers;
    if (tipo === 'tienda') { const k = Math.max(DM.tienda.recargoMin, DM.tienda.recargo - DM.tienda.recargoPorNivel * (nivel - 1)), c = Math.max(DM.tienda.comisionMin, DM.tienda.comision - DM.tienda.comisionPorNivel * (nivel - 1));
      return 'Compra pociones, cofres y fragmentos con oro e intercambia materiales · recargo ×' + String(Math.round(k * 100) / 100).replace('.', ',') + ' · comisión ' + String(Math.round(c * 1000) / 10).replace('.', ',') + ' % · ' + pers; }
    if (tipo === 'universidad') return 'Árbol de habilidades superior: mejora las de la ' + DM.edificios.academia.nombre.toLowerCase() + ' · ' + pers;
    if (tipo === 'escuela_maestria') { const sig = Object.values(DM.obreros).find(o => o.escuela > nivel);
      return 'Forma obreros para farmear (+' + Math.round(DM.zonas.porEscuela * (nivel - 1) * 100) + ' % de ritmo de recogida)' + (sig ? ' · ' + sig.nombre + ' en nivel ' + sig.escuela : '') + ' · ' + pers; }
    return '';
  }
  function textoEfectoHab(hb, n) {
    const f = hb.efecto, x = k => pct(f[k] * Math.max(1, n));
    const parte = f.fuerza != null ? x('fuerza') + ' fuerza de todo el ejército' : f.fuerzaClase != null ? x('fuerzaClase') + ' fuerza de ' + DM.clases[f.clase].toLowerCase()
      : f.bajas != null ? x('bajas') + ' bajas' : f.heridas != null ? x('heridas') + ' duración de heridas' : f.pociones != null ? x('pociones') + ' minutos de las pociones'
      : f.produce ? x('pct') + ' producción de ' + J.NOMBRE_RECURSO[f.produce].toLowerCase() + (f.tambien ? ' y ' + J.NOMBRE_RECURSO[f.tambien].toLowerCase() : '') : f.recoger != null ? x('recoger') + ' recogida en el mapa'
      : f.xp != null ? x('xp') + ' experiencia de los héroes' : f.poderHeroes != null ? x('poderHeroes') + ' poder de los héroes'
      : f.velocidad != null ? '−' + Math.round(f.velocidad * Math.max(1, n) * 1000) / 10 + ' % tiempo de marcha' : '';
    const des = hb.desbloquea ? (DM.tropas[hb.desbloquea] ? 'Desbloquea ' + DM.tropas[hb.desbloquea].nombre.toLowerCase() : 'Desbloquea la ' + DM.pociones[hb.desbloquea].nombre.toLowerCase()) + ' · ' : '';
    return des + parte + (n ? ' (nivel ' + n + ')' : ' por nivel');
  }
  function profundidad(hb) { let k = 0, x = hb; while (x.requiere) { k++; x = M.hab(x.requiere); } return k; }
  function panelMilitar(h, b) {
    const e = PARTIDA, m = e.militar;
    if (b.tipo === 'cuartel') {
      if (!E.entrenar) E.entrenar = {};
      h.append(el('h3', { text: 'Entrenar tropas' }));
      for (const t of M.TIPOS_TROPA) {
        const d = DM.tropas[t], n = E.entrenar[t] || 1, p = M.puedeEntrenar(e, t, n), mx = M.maxEntrenar(e, t);
        const bloqueada = (d.avanzada && (!M.tieneHab(e, d.avanzada) || b.nivel < DM.cuartelAvanzadas)) || (d.cuartel && b.nivel < d.cuartel);
        const costeN = k => Object.fromEntries(Object.entries(d.coste).map(([r, v]) => [r, v * k])), desliza = E.deslizador === t && !bloqueada;
        // 0.5 · tarjeta: nombre y clase arriba a lo ancho; debajo fuerza / comida por minuto / tienes / coste en una línea; abajo − cantidad + · Máx · Entrenar
        h.append(el('div', { class: 'tarjeta-clara tarjeta-entrenar' + (p.ok ? '' : ' no'), 'data-tropa': t },
          el('div', { class: 'ent-cab' }, imgTropa(t, 'retrato', 'retrato-36' + (d.estrellas ? ' tropa-estrellas' : '')), el('b', { text: d.nombre + (d.estrellas ? ' ' + '★'.repeat(d.estrellas) : d.avanzada ? ' ★' : '') }), el('span', { class: 'clase-chip', text: nombreClase(d.clase) })),
          el('div', { class: 'ent-datos' }, el('span', { text: 'Fuerza ' + d.fuerza }), el('span', { text: d.mant + ' comida/min' }), el('span', { id: 'tienes-' + t, text: 'Tienes ' + m.tropas[t] }), d.cuartel ? el('span', { class: 'sub', text: 'Cuartel nv ' + d.cuartel }) : null),
          // 0.7: el coste va en su propia línea (antes se cortaba por la derecha)
          el('div', { class: 'ent-coste coste', id: 'coste-' + t }, costeIconos(costeN(n))),
          !p.ok ? el('div', { class: 'motivo', text: p.motivo }) : null,
          bloqueada ? null : el('div', { class: 'ent-pie paso-num' },
            el('button', { class: 'btn secundario mini-btn', id: 'menos-' + t, text: '−', 'aria-label': 'Menos', disabled: n <= 1, onclick: () => { E.entrenar[t] = Math.max(1, n - (n > 10 ? 10 : 1)); refrescarHoja(); } }),
            // 0.7: tocar la cantidad abre un deslizador de 1 al máximo pagable
            el('button', { type: 'button', class: 'cantidad btn-cantidad' + (desliza ? ' on' : ''), id: 'cantidad-' + t, text: String(n), 'aria-label': 'Cantidad: ' + n + '. Toca para elegir con un deslizador', 'aria-expanded': desliza ? 'true' : 'false',
              onclick: () => { E.deslizador = E.deslizador === t ? null : t; refrescarHoja(); } }),
            el('button', { class: 'btn secundario mini-btn', id: 'mas-' + t, text: '+', 'aria-label': 'Más', onclick: () => { E.entrenar[t] = n + (n >= 10 ? 10 : 1); refrescarHoja(); } }),
            botonMax('max-' + t, mx >= 1, 'Máximo pagable (' + mx + ')', () => { E.entrenar[t] = Math.max(1, mx); refrescarHoja(); }),
            el('button', { class: 'btn principal mini-btn', id: 'entrenar-' + t, text: 'Entrenar', disabled: !p.ok, onclick: () => accion(M.entrenar(e, t, n), n + ' × ' + d.nombre + ' entrenad' + (n > 1 ? 'os' : 'o')) })),
          desliza ? el('div', { class: 'deslizador-tropa', id: 'deslizador-caja-' + t }, el('span', { class: 'sub', text: '1' }),
            el('input', { type: 'range', class: 'deslizador', id: 'deslizador-' + t, min: '1', max: String(Math.max(1, mx)), step: '1', value: String(Math.min(n, Math.max(1, mx))), 'aria-label': 'Cantidad de ' + d.nombre.toLowerCase(),
              oninput: ev => { const v = Math.max(1, +ev.target.value | 0); E.entrenar[t] = v; const c = $('#cantidad-' + t); if (c) c.textContent = String(v); const k = $('#coste-' + t); if (k) { k.innerHTML = ''; k.append(costeIconos(costeN(v))); } },
              onchange: () => refrescarHoja() }),
            el('span', { class: 'sub', text: String(Math.max(1, mx)) })) : null));
      }
    } else if (b.tipo === 'academia' || b.tipo === 'universidad') {
      const uni = b.tipo === 'universidad', A = uni ? DM.universidad : DM.academia;
      h.append(el('h3', { text: uni ? 'Árbol de la Universidad' : 'Árbol de habilidades' }), el('p', { class: 'sub', text: uni ? 'Habilidades superiores: cada una pide su habilidad de la ' + DM.edificios.academia.nombre.toLowerCase() + ' y mejora sus números. La velocidad de marcha suma con «Marchas rápidas» (tope −' + Math.round(DM.universidad.velocidadMax * 100) + ' %).'
        : 'Cada habilidad tiene varios niveles; para aprender una hay que tener antes la anterior de su rama. Instantáneo si tienes los recursos.' }));
      for (const r of A.ramas) {
        h.append(el('div', { class: 'rama', 'data-rama': r.id }, el('b', { class: 'rama-titulo', text: r.nombre }),
          M.habilidadesDe(b.tipo).filter(x => x.rama === r.id).map(hb => {
            const n = M.nivelHab(e, hb.id), p = M.puedeAprender(e, hb.id), max = n >= hb.niveles, c = max ? null : M.costeHab(hb, n + 1);
            return el('div', { class: 'tarjeta-clara nodo-hab' + (max ? ' hecho' : p.ok ? '' : ' no') + (n ? ' aprendida' : ''), 'data-inv': hb.id, style: '--prof:' + profundidad(hb) },
              el('div', { class: 'datos' }, el('b', { text: hb.nombre + ' · ' + n + ' / ' + hb.niveles }), el('div', { class: 'sub', text: textoEfectoHab(hb, n) + (hb.requiere ? ' · tras ' + M.hab(hb.requiere).nombre : '') + (uni && Array.isArray(hb.academia) ? ' · pide ' + M.hab(hb.academia[0]).nombre + ' ' + hb.academia[1] : '') }),
                el('div', { class: 'niveles-hab' }, Array.from({ length: hb.niveles }, (_, k) => el('i', { class: k < n ? 'on' : '' }))),
                c ? el('div', { class: 'coste' }, costeIconos(c), el('span', { class: 'sub', text: ' · ' + DM.edificios[b.tipo].nombre + ' nv ' + M.academiaHab(hb, n + 1) })) : null,
                !max && !p.ok ? el('div', { class: 'motivo', text: p.motivo }) : null),
              max ? null : el('button', { class: 'btn principal mini-btn', id: 'investigar-' + hb.id, text: n ? 'Subir' : 'Aprender', disabled: !p.ok, onclick: () => accion(M.aprender(e, hb.id), hb.nombre + ' nivel ' + (n + 1)) }));
          })));
      }
    } else if (b.tipo === 'salon_heroes') {
      const pc = M.puedeCriar(e), c = M.costeCriar(e);
      h.append(el('h3', { text: 'Criar un héroe' }), el('div', { class: 'tarjeta-clara' }, el('div', { class: 'sub', text: 'El tipo sale al azar al criarlo (uno de los 5 clásicos). Sin tope de héroes; los tipos se pueden repetir. El coste sube con cada héroe que tienes.' }),
        el('div', { class: 'coste', id: 'coste-criar' }, costeIconos(c)), !pc.ok ? el('div', { class: 'motivo', text: pc.motivo }) : null,
        el('button', { class: 'btn principal', id: 'btn-criar', text: 'Criar héroe', disabled: !pc.ok, onclick: () => { const r = M.criarHeroe(e); if (!r.ok) return aviso(r.motivo, 'aviso'); accion(r, r.heroe.nombre + ' (' + DM.heroes.tipos[r.heroe.tipo].nombre + ') se une'); } })),
        el('p', { class: 'sub', text: 'Con ' + DM.convocar.fragmentos + ' fragmentos de una familia de monstruos puedes convocar a su héroe desde la pestaña «Inventario». Los héroes suben de nivel solos con la experiencia (desde el nivel ' + DM.heroes.fragmentosDesde + ' también gastan fragmentos).' }));
    } else if (b.tipo === 'botica') {
      h.append(el('h3', { text: 'Fabricar pociones' }), el('p', { class: 'sub', text: 'Al instante si tienes los recursos (mantén pulsado «Fabricar» 2 s para hacer varias seguidas). Cada tipo se desbloquea con el nivel de la ' + DM.edificios.botica.nombre.toLowerCase() + ' (curación 1/11/21, velocidad 3/13/23, fuerza 5/15/25, farmeo 7/17/27). Se guardan en el inventario; las de curación se dan a un héroe y las demás actúan en toda la partida.' }));
      for (const t of M.POCIONES.slice().sort((a, b) => DM.pociones[a].botica - DM.pociones[b].botica)) {
        const d = DM.pociones[t], p = M.puedeFabricar(e, t);
        h.append(el('div', { class: 'tarjeta-clara opcion-mil' + (p.ok ? '' : ' no'), 'data-pocion': t }, imgPocion(t),
          el('div', { class: 'datos' }, el('b', { text: d.nombre + ' · tienes ' + m.pociones[t] }), el('div', { class: 'sub', text: textoPocion(t) + (d.tipo === 'efecto' ? '' : ' (si queda menos, cura del todo)') + ' · ' + DM.edificios.botica.nombre.toLowerCase() + ' nv ' + d.botica }),
            el('div', { class: 'coste' }, costeIconos(d.coste)), !p.ok ? el('div', { class: 'motivo', text: p.motivo }) : null),
          repetible(el('button', { class: 'btn principal mini-btn', id: 'fabricar-' + t, text: 'Fabricar', disabled: !p.ok, onclick: () => accion(M.fabricar(e, t), d.nombre + ' fabricada') }), () => M.fabricar(e, t), k => k + ' × ' + d.nombre)));
      }
    } else if (b.tipo === 'tienda') pintarTienda(h);
    else if (b.tipo === 'escuela_maestria') panelEscuela(h, b);
  }
  // ---------- 0.8 · Escuela de maestría: forma obreros (no son ejército: sin poder ni manutención; solo cuestan crearlos) ----------
  function panelEscuela(h, b) {
    const e = PARTIDA, m = e.militar; if (!E.formar) E.formar = {};
    h.append(el('h3', { text: 'Formar obreros' }), el('p', { class: 'sub', text: 'Solo sirven para farmear en el mapa. No son ejército: no tienen poder ni comen; solo cuestan al formarlos. Van más rápido que las tropas, sobre todo a la vuelta. Cada nivel de la escuela sube un ' + Math.round(DM.zonas.porEscuela * 100) + ' % el ritmo de recogida.' }),
      el('div', { class: 'tarjeta-clara fila', id: 'escuela-max-obreros' }, imgIcoCamp('icono_obreros_max'), el('span', { text: 'Obreros ' + M.totalObrerosConFuera(e) + ' / ' + M.maxObreros(e) + ' (máximo de las cabañas del Campamento)' }),
        el('button', { class: 'btn secundario mini-btn', id: 'escuela-ir-campamento', text: 'Campamento', onclick: () => { cerrarHoja(); E.vista = 'campamento'; pintar(); } })));
    for (const t of M.OBREROS) {
      const d = DM.obreros[t], n = E.formar[t] || 1, p = M.puedeFormar(e, t, n), mx = M.maxFormar(e, t), bloq = b.nivel < d.escuela, fuera = M.obrerosFuera(e)[t];
      const costeN = k => Object.fromEntries(Object.entries(d.coste).map(([r, v]) => [r, v * k])), desliza = E.deslizadorObrero === t && !bloq;
      h.append(el('div', { class: 'tarjeta-clara tarjeta-entrenar' + (p.ok ? '' : ' no'), 'data-obrero': t },
        el('div', { class: 'ent-cab' }, imgObrero(t, 'retrato', 'retrato-36'), el('b', { text: d.nombre }), el('span', { class: 'clase-chip', text: 'Obrero' })),
        el('div', { class: 'ent-datos' }, el('span', { text: 'Carga ' + d.carga.toLocaleString('es-ES') }), el('span', { text: 'Marcha ×' + String(d.ida).replace('.', ',') + ' · vuelta ×' + String(d.vuelta).replace('.', ',') }),
          el('span', { id: 'tienes-' + t, text: 'Tienes ' + (m.obreros[t] || 0) + (fuera ? ' (+' + fuera + ' fuera)' : '') }), bloq ? el('span', { class: 'sub', text: 'Escuela nv ' + d.escuela }) : null),
        el('div', { class: 'ent-coste coste', id: 'coste-' + t }, costeIconos(Object.fromEntries(Object.entries(d.coste).map(([r, v]) => [r, v * n])))),
        !p.ok ? el('div', { class: 'motivo', text: p.motivo }) : null,
        bloq ? null : el('div', { class: 'ent-pie paso-num' },
          el('button', { class: 'btn secundario mini-btn', id: 'menos-' + t, text: '−', 'aria-label': 'Menos', disabled: n <= 1, onclick: () => { E.formar[t] = Math.max(1, n - (n > 10 ? 10 : 1)); refrescarHoja(); } }),
          // 0.9: como en las tropas, tocar la cantidad abre un deslizador de 1 al máximo (pagable y que quepa en las cabañas)
          el('button', { type: 'button', class: 'cantidad btn-cantidad' + (desliza ? ' on' : ''), id: 'cantidad-' + t, text: String(n), 'aria-label': 'Cantidad: ' + n + '. Toca para elegir con un deslizador', 'aria-expanded': desliza ? 'true' : 'false',
            onclick: () => { E.deslizadorObrero = E.deslizadorObrero === t ? null : t; refrescarHoja(); } }),
          el('button', { class: 'btn secundario mini-btn', id: 'mas-' + t, text: '+', 'aria-label': 'Más', onclick: () => { E.formar[t] = n + (n >= 10 ? 10 : 1); refrescarHoja(); } }),
          botonMax('max-' + t, mx >= 1, 'Máximo (' + mx + ')', () => { E.formar[t] = Math.max(1, mx); refrescarHoja(); }),
          el('button', { class: 'btn principal mini-btn', id: 'formar-' + t, text: 'Formar', disabled: !p.ok, onclick: () => accion(M.formar(e, t, n), n + ' × ' + d.nombre + ' formad' + (n > 1 ? 'os' : 'o')) })),
        desliza ? el('div', { class: 'deslizador-tropa', id: 'deslizador-caja-' + t }, el('span', { class: 'sub', text: '1' }),
          el('input', { type: 'range', class: 'deslizador', id: 'deslizador-' + t, min: '1', max: String(Math.max(1, mx)), step: '1', value: String(Math.min(n, Math.max(1, mx))), 'aria-label': 'Cantidad de ' + d.nombre.toLowerCase(),
            oninput: ev => { const v = Math.max(1, +ev.target.value | 0); E.formar[t] = v; const c = $('#cantidad-' + t); if (c) c.textContent = String(v); const k = $('#coste-' + t); if (k) { k.innerHTML = ''; k.append(costeIconos(costeN(v))); } },
            onchange: () => refrescarHoja() }),
          el('span', { class: 'sub', text: String(Math.max(1, mx)) })) : null));
    }
  }

  // ---------- Ficha de héroe ----------
  function hojaHeroe(h, id) {
    const e = PARTIDA, m = e.militar, x = M.heroe(e, id); if (!x) { h.append(cabeceraHoja('Héroe', 'Ya no está.')); return; }
    const st = M.estadoHeroe(x), T = DM.heroes.tipos[x.tipo];
    h.append(el('div', { class: 'hoja-cabecera' }, imgHeroe(x, 'retrato', 'ico-mil grande'), el('div', { style: 'flex:1;min-width:0' }, el('h2', { id: 'hoja-titulo', text: x.nombre + ' · nivel ' + x.nivel }),
      el('p', { class: 'sub', text: T.nombre + ' · poder ' + M.poderHeroe(x) + ' · consume ' + M.mantHeroe(x, e) + ' comida/min' + (x.inactivo ? ' (ahora no: inactivo)' : '') })),
      el('button', { class: 'btn-icono', id: 'hoja-cerrar', 'aria-label': 'Cerrar', onclick: cerrarHoja }, ico('cerrar'))));
    h.append(el('div', { class: 'tarjeta-clara' }, el('b', { id: 'estado-heroe', text: ESTADO_HEROE[st] + (st === 'herido' ? ': ' + minutosTxt(x.heridoMs) + ' jugados' : st === 'inactivo' ? ': ' + minutosTxt(x.inactivoMs) + ' jugados con comida' : '') }),
      st !== 'listo' && st !== 'fuera' ? el('div', { class: 'fila', style: 'margin-top:6px;flex-wrap:wrap;gap:6px' }, M.POCIONES.filter(p => DM.pociones[p].tipo !== 'efecto').map(p => el('button', { class: 'btn secundario mini-btn', id: 'usar-' + p, disabled: !(m.pociones[p] > 0),
        onclick: () => accion(M.usarPocion(e, p, id), DM.pociones[p].nombre + ' usada') }, imgPocion(p, 'ico-coste'), DM.pociones[p].nombre + ' (' + m.pociones[p] + ')'))) : null));
    h.append(el('h3', { text: 'Habilidades' }), el('div', { class: 'lista-mil' }, M.habilidades(x).map(a => el('div', { class: 'fila-mil' + (a.activa ? '' : ' bloqueada'), 'data-hab': a.id },
      el('div', { class: 'datos' }, el('b', { text: a.nombre + (a.activa ? '' : ' · desde nivel ' + a.nivel) }), el('div', { class: 'sub', text: textoHabilidad(a) + (a.activa ? ' (mejora al subir de nivel)' : '') }))))));
    if (x.nivel < DM.heroes.nivelMax) {
      const q = M.requisitosSubir(x);
      h.append(el('div', { class: 'tarjeta-clara' }, el('b', { text: 'Nivel ' + (x.nivel + 1) + ': sube solo al ganar la experiencia' }),
        el('div', { class: 'sub', id: 'req-heroe', text: 'Experiencia ' + Math.floor(x.xp) + ' / ' + q.xp + (q.fragmentos ? ' · fragmentos ' + M.fragmentosPara(e, x) + ' / ' + q.fragmentos + (T.familia ? ' (de su familia o comunes)' : ' (comunes)') : '') }), barraXp(x),
        x.faltanFragmentos ? el('div', { class: 'motivo', id: 'motivo-subir', text: 'Tiene la experiencia, pero le faltan fragmentos para pasar de nivel.' }) : null));
    } else h.append(el('div', { class: 'tarjeta-clara' }, el('b', { text: 'Nivel máximo' })));
    const dev = M.devolucionDespedir(x);
    h.append(el('div', { class: 'fila acciones-edif' },
      el('button', { class: 'btn peligro', id: 'btn-despedir', text: 'Despedir', onclick: async () => {
        const ok = await dialogo({ titulo: 'Despedir a ' + x.nombre, texto: 'Recuperas ' + (textoCoste(dev.recursos) === 'gratis' ? 'nada de recursos' : textoCoste(dev.recursos)) + (dev.fragmentos ? ' y ' + dev.fragmentos + ' fragmento' + (dev.fragmentos > 1 ? 's' : '') : '') + '. No se puede deshacer.',
          botones: [{ texto: 'Cancelar', valor: false, id: 'dlg-cancelar' }, { texto: 'Despedir', valor: true, tipo: 'peligro', id: 'dlg-ok' }] });
        if (!ok) return; const r = M.despedir(e, id); if (!r.ok) return aviso(r.motivo, 'aviso'); cerrarHoja(); guardar(); pintar(); aviso(x.nombre + ' se marcha', 'info');
      } })),
      el('p', { class: 'sub', text: 'Al despedir recuperas la mitad de lo gastado en criarlo o convocarlo (recursos y fragmentos). El héroe inicial no costó nada.' }));
  }

  // ---------- 0.5 · Zona de farmeo: mandar tropas a recoger ----------
  // 0.8 · farmeo nuevo: solo obreros; el ritmo crece con el tiempo y no depende de cuántos vayan; «Auto» pone los justos por carga
  function hojaZona(h, zid) {
    const e = PARTIDA, m = e.militar, z = M.zona(e, zid);
    if (!z) { h.append(cabeceraHoja('Ya no está', 'Esa zona ya no está.')); return; }
    const R = DM.zonas.recursos[z.recurso], x = m.expediciones.find(y => y.zona === zid), r0 = M.ritmoZona(e, z), C = DM.zonas.crece;
    h.append(el('div', { class: 'hoja-cabecera' }, el('div', { class: 'marco-retrato' }, imgZona(z, 'retrato-76')), el('div', { style: 'flex:1;min-width:0' }, el('h2', { id: 'hoja-titulo', text: R.nombre }),
      el('p', { class: 'sub', id: 'zona-ritmo', text: J.NOMBRE_RECURSO[z.recurso] + ' · ' + num(r0).toLocaleString('es-ES') + '/min al empezar → ×' + C.tope + ' (' + num(r0 * C.tope).toLocaleString('es-ES') + '/min) a los ' + C.cadaMin * (C.tope - 1) + ' min' }),
      el('p', { class: 'sub', id: 'zona-guardia', text: 'Sin guardia ni nivel: solo van obreros y la zona no se agota' })),
      el('button', { class: 'btn-icono', id: 'hoja-cerrar', 'aria-label': 'Cerrar', onclick: cerrarHoja }, ico('cerrar'))));
    if (x) {
      const fase = x.cancelada ? 'Vuelven antes de tiempo' : x.fase === 'ida' ? 'Van de camino a la zona' : x.fase === 'trabajando' ? 'Tus obreros están trabajando aquí' : 'Vuelven a la ciudad';
      const obs = Object.entries(x.obreros || {}).map(([t, n]) => n + ' × ' + DM.obreros[t].nombre).join(', ');
      h.append(el('div', { class: 'tarjeta-clara', id: 'zona-ocupada' }, el('b', { text: fase }),
        el('div', { class: 'sub', id: 'zona-progreso', text: (x.fase === 'trabajando' ? 'Llevan ' + (x.recogido || 0).toLocaleString('es-ES') + ' de ' : 'Traerán ') + x.cantidad.toLocaleString('es-ES') + ' ' + J.NOMBRE_RECURSO[x.recurso].toLowerCase() + ' · vuelven en ' + minutosTxt(Math.max(0, x.restanteMs)) }),
        el('div', { class: 'sub', text: obs }),
        x.cancelada || x.fase === 'vuelta' ? null : el('button', { class: 'btn secundario', id: 'btn-volver-recogida', text: 'Que vuelvan ya', onclick: () => { const r = M.cancelarRecogida(e, x.id); accion(r, r.ok ? (r.enCamino ? 'Vuelven con ' : 'Han vuelto con ') + r.traido + ' de ' + J.NOMBRE_RECURSO[x.recurso].toLowerCase() : null); } })));
      // 0.8: la poción de farmeo rápido también se usa mientras farmean (recorta el trabajo que queda)
      if (x.fase !== 'vuelta') {
        h.append(el('h3', { text: 'Farmeo rápido' }), el('p', { class: 'sub', text: 'Cada poción recorta su porcentaje del trabajo que les queda (traen lo mismo).' }));
        for (const p of ['farmeo_p', 'farmeo_m', 'farmeo_g']) {
          const n = m.pociones[p] || 0, q = M.puedeAcelerarFarmeo(e, x.id, p);
          h.append(el('div', { class: 'tarjeta-clara fila-pocion' + (q.ok ? '' : ' no'), id: 'farm-' + p }, imgPocion(p, 'ico-mil'),
            el('div', { class: 'txt' }, el('b', { text: DM.pociones[p].nombre }), el('span', { class: 'sub', text: '−' + Math.round(DM.pociones[p].pct * 100) + ' % · tienes ' + n })),
            el('button', { class: 'btn oro mini-btn', id: 'usar-farm-' + p, disabled: !q.ok, title: q.ok ? '' : q.motivo, onclick: () => { const r = M.acelerarFarmeo(e, x.id, p); if (!r.ok) return aviso(r.motivo, 'aviso'); guardar(); refrescarHoja(); aviso('Farmeo acelerado', 'exito', '−' + minutosTxt(r.ahorroMs) + ' · vuelven en ' + minutosTxt(r.restanteMs)); } }, 'Usar')));
        }
        if (x.idaMs > 0) h.append(el('button', { class: 'btn oro', id: 'btn-acelerar-recogida', onclick: () => abrirHoja(q => hojaAcelerar(q, x.id)) }, imgPocion('velocidad_p', 'ico-coste'), 'Acelerar la marcha'));
      }
      return;
    }
    if (!E.recogida || E.recogida.zona !== zid) E.recogida = { zona: zid, minutos: DM.zonas.duraciones[1], obreros: {} };
    const sel = E.recogida; if (!sel.obreros) sel.obreros = {};
    if (!sel.tocado) { sel.obreros = M.autoObreros(e, zid, sel.minutos).obreros; }   // por defecto, «Auto»
    for (const t of M.OBREROS) sel.obreros[t] = Math.min(sel.obreros[t] || 0, m.obreros[t] || 0);
    h.append(el('p', { class: 'sub', text: 'Manda obreros a trabajar un tiempo' + (J.modo(e).marchaMaxMin ? ' (más la marcha de ida y vuelta, más rápida que la de las tropas)' : '') + '. Recogen más por minuto cuanto más tiempo están, vayan los que vayan; lo que traen tiene el tope de su carga.' }));
    h.append(el('div', { class: 'fila duraciones' }, el('span', { class: 'sub', text: 'Tiempo trabajando:' }), DM.zonas.duraciones.map(d => el('button', { class: 'btn mini-btn ' + (sel.minutos === d ? 'principal' : 'secundario'), id: 'dur-' + d, text: d >= 60 ? d / 60 + ' h' : d + ' min', onclick: () => { sel.minutos = d; refrescarHoja(); } }))));
    const tiene = M.OBREROS.filter(t => (m.obreros[t] || 0) > 0);
    if (!tiene.length) h.append(el('p', { class: 'sub', id: 'sin-tropas-recoger', text: 'No tienes obreros en la ciudad. Fórmalos en la ' + DM.edificios.escuela_maestria.nombre + ' (ayuntamiento nivel ' + DM.edificios.escuela_maestria.requiere + ').' }));
    else h.append(el('button', { class: 'btn oro', id: 'btn-auto-obreros', text: 'Auto · los justos por carga', onclick: () => { const a = M.autoObreros(e, zid, sel.minutos); sel.obreros = a.obreros; sel.tocado = true; refrescarHoja(); if (a.falta > 0) aviso('No hay obreros para todo', 'info', 'Faltaría carga para ' + a.falta.toLocaleString('es-ES') + ' más.'); } }));
    for (const t of tiene) {
      const n = sel.obreros[t] || 0, tot = m.obreros[t], paso = Math.max(1, Math.round(tot / 10));
      h.append(el('div', { class: 'fila-ataque' }, imgObrero(t, 'retrato', 'retrato-48'), el('div', { class: 'datos' }, el('b', { text: DM.obreros[t].nombre }), el('div', { class: 'sub', text: 'carga ' + DM.obreros[t].carga.toLocaleString('es-ES') + ' · de ' + tot })),
        el('div', { class: 'paso-num' }, el('button', { class: 'btn secundario mini-btn', id: 'rec-menos-' + t, text: '−', disabled: n <= 0, onclick: () => { sel.obreros[t] = Math.max(0, n - paso); sel.tocado = true; refrescarHoja(); } }),
          el('b', { id: 'rec-' + t, text: String(n) }),
          el('button', { class: 'btn secundario mini-btn', id: 'rec-mas-' + t, text: '+', disabled: n >= tot, onclick: () => { sel.obreros[t] = Math.min(tot, n + paso); sel.tocado = true; refrescarHoja(); } }))));
    }
    const p = M.puedeRecoger(e, zid, sel, sel.minutos), pv = M.previsionRecogida(e, z, Object.fromEntries(Object.entries(sel.obreros).filter(([, n]) => n > 0)), sel.minutos);
    // 0.9 · se ve claro el tope de la carga: lo que traen nunca pasa de lo que caben en los obreros
    const pctC = pv.maximo ? Math.min(100, Math.round(pv.carga / pv.maximo * 100)) : 0;
    h.append(el('div', { class: 'tarjeta-clara', id: 'prevision-recogida' }, el('b', { text: 'Traerán +' + pv.cantidad.toLocaleString('es-ES') + ' ' + J.NOMBRE_RECURSO[z.recurso].toLowerCase() + (pv.llena ? ' (van llenos)' : '') }),
      el('div', { class: 'barra-carga', id: 'barra-carga', title: 'Carga de los obreros frente a lo que se puede extraer' }, el('span', { style: 'width:' + pctC + '%' })),
      el('div', { class: 'sub', id: 'ritmo-zona', text: 'Ritmo de la zona: ' + String(pv.ritmo).replace('.', ',') + '/min al empezar (hasta ' + String(pv.ritmoMax).replace('.', ',') + '/min) · posible en ' + sel.minutos + ' min: ' + pv.maximo.toLocaleString('es-ES') }),
      pv.llena && pv.n ? el('div', { class: 'motivo', id: 'faltan-obreros', text: 'Faltan obreros: con más carga traerías hasta ' + pv.maximo.toLocaleString('es-ES') + ' (ahora ' + pv.carga.toLocaleString('es-ES') + ').' }) : null,
      el('div', { class: 'sub', text: pv.n + ' obreros · carga ' + pv.carga.toLocaleString('es-ES') + ' de ' + pv.maximo.toLocaleString('es-ES') + ' posibles · ' + (pv.idaMin ? 'ida ' + String(pv.idaMin).replace('.', ',') + ' min · vuelta ' + String(pv.vueltaMin).replace('.', ',') + ' min · ' : '') + 'vuelven en ' + String(pv.totalMin).replace('.', ',') + ' min' })));
    h.append(el('div', { class: 'botones-ataque' }, el('button', { class: 'btn principal', id: 'btn-recoger', text: 'Enviar obreros', disabled: !p.ok, onclick: () => {
      const r = M.recoger(e, zid, sel, sel.minutos); if (!r.ok) return aviso(r.motivo, 'aviso'); E.recogida = null; guardar(); cerrarHoja(); pintar(); aviso('Obreros en camino', 'exito', 'Volverán en ' + String(pv.totalMin).replace('.', ',') + ' min con +' + r.expedicion.cantidad + ' ' + J.NOMBRE_RECURSO[z.recurso].toLowerCase() + '.'); } }),
      el('button', { class: 'btn secundario', id: 'btn-cancelar-recoger', text: 'Cancelar', onclick: cerrarHoja })));
    if (!p.ok && tiene.length) h.append(el('p', { class: 'motivo', text: p.motivo }));
  }

  // ---------- Ataque (monstruos y ciudades enemigas) ----------
  function seleccionAtaque(e) {
    const m = e.militar;
    if (!E.ataque) E.ataque = { tropas: Object.fromEntries(M.TIPOS_TROPA.map(t => [t, m.tropas[t]])), heroes: m.heroes.filter(x => M.estadoHeroe(x) === 'listo').map(x => x.id) };
    for (const t of M.TIPOS_TROPA) E.ataque.tropas[t] = Math.min(E.ataque.tropas[t] || 0, m.tropas[t]);
    E.ataque.heroes = E.ataque.heroes.filter(id => { const x = M.heroe(e, id); return x && M.estadoHeroe(x) === 'listo'; });
    return E.ataque;
  }
  function prevision(F, Mf) { return F * 0.9 >= Mf ? ['Victoria probable', 'bien'] : F * 1.1 < Mf ? ['Derrota probable', 'mal'] : ['Incierto', 'duda']; }
  function hojaAtaque(h, objId) {
    const e = PARTIDA, m = e.militar, mo = M.objetivo(e, objId);
    if (!mo) { h.append(cabeceraHoja('Ya no está', 'Ese enemigo se ha ido.')); return; }
    const ciudad = M.esCiudad(mo), d = ciudad ? { nombre: mo.nombre, clase: null, categoria: 'ciudad enemiga' } : M.datosMonstruo(mo), sel = seleccionAtaque(e), f = M.fuerzaEjercito(e, sel, d.clase), cu = M.edificio(e, 'cuartel');
    h.classList.add('hoja-ataque');
    h.append(el('div', { class: 'hoja-cabecera' }, el('div', { class: 'marco-retrato' + (ciudad ? ' enemiga' : '') }, ciudad ? imgCiudadEnemiga(mo, 'retrato-76') : imgMonstruo(mo, 'retrato', 'retrato-76')), el('div', { style: 'flex:1;min-width:0' }, el('h2', { id: 'hoja-titulo', text: d.nombre }),
      el('p', { class: 'sub', text: 'Nivel ' + mo.nivel + ' · ' + d.categoria + (ciudad ? (mo.conquistada ? ' · conquistada: es tuya' : mo.guerra ? ' · en guerra contigo: te saquea' : J.nivelCiudad(e) < DM.guerra.desdeAyto ? ' · no te ataca (hasta tu ayuntamiento nv ' + DM.guerra.desdeAyto + ')' : ' · no te ataca si no la atacas') : ' · ' + nombreClase(d.clase).toLowerCase()) }),
      el('div', { class: 'chips' }, ciudad ? imgMundo('ciudades/escudo_enemigo', 'ico-escudo') : null, el('span', { class: 'chip-poder', id: 'fuerza-enemigo', 'data-fuerza': mo.fuerza, text: 'Poder enemigo ' + mo.fuerza }))),
      el('button', { class: 'btn-icono', id: 'hoja-cerrar', 'aria-label': 'Cerrar', onclick: cerrarHoja }, ico('cerrar'))));
    if (ciudad && mo.recuperaMs > 0) h.append(el('p', { class: 'motivo', id: 'ciudad-recuperando', text: 'Saqueada: se recupera en ' + minutosTxt(mo.recuperaMs) + ' jugados.' }));
    if (mo.legendario) h.append(el('div', { class: 'tarjeta-clara legendario', id: 'habilidad-legendaria' }, el('b', { text: 'Legendario · ' + d.habilidad }), el('div', { class: 'sub', text: 'Si lo vences puedes capturarlo: luchará a tu lado con esta habilidad.' })));
    if (ciudad && !mo.conquistada && m.asedioMs > 0) h.append(el('p', { class: 'motivo', id: 'asedio-espera', text: 'Espera ' + minutosTxt(m.asedioMs) + ' para otro asedio (o usa una poción de enfriamiento).' }));
    // 0.6 · diplomacia: guerra / paz / conquista
    if (ciudad && mo.conquistada) {
      const tr = Object.entries(DM.ciudades.botin).map(([k, x]) => [k, Math.round(mo.fuerza * x * DM.conquista.tributoPorMin * J.factorModo(e) * 10) / 10]);
      h.append(el('div', { class: 'tarjeta-clara', id: 'ciudad-conquistada' }, el('div', { class: 'fila' }, imgUi('icono_conquista', 'ico-coste'), el('b', { text: 'Ciudad conquistada' })),
        el('div', { class: 'sub', text: 'Te paga un tributo cada minuto: ' + tr.map(([k, v]) => v + ' ' + J.NOMBRE_RECURSO[k].toLowerCase()).join(' · ') + '.' }),
        el('button', { class: 'btn secundario', id: 'btn-cerrar-conquistada', text: 'Cerrar', onclick: cerrarHoja })));
      return;
    }
    if (ciudad) {
      const pz = M.costePaz(mo), puedePaz = mo.guerra && Object.entries(pz).every(([k, v]) => e.recursos[k] >= v), nvc = J.nivelCiudad(e);
      h.append(el('div', { class: 'diplomacia', id: 'diplomacia' },
        el('span', { class: 'chip-diplo' + (mo.guerra ? ' guerra' : ' paz'), id: 'estado-diplomacia' }, imgUi(mo.guerra ? 'icono_guerra' : 'icono_paz', 'ico-coste'), mo.guerra ? 'En guerra' + (mo.ataqueMs >= 0 ? ' · ataca en ' + minutosTxt(mo.ataqueMs) : '') : 'En paz'),
        mo.guerra ? el('button', { class: 'btn verde mini-btn', id: 'btn-paz', disabled: !puedePaz, onclick: () => { const r = M.firmarPaz(e, objId); accion(r, r.ok ? 'Paz firmada con ' + mo.nombre : null); } }, imgUi('icono_paz', 'ico-coste'), 'Paz (' + textoCoste(pz) + ')') : null),
        el('p', { class: 'sub' }, nvc < DM.guerra.desdeAyto ? 'Protección de principiante: hasta el ayuntamiento nivel ' + DM.guerra.desdeAyto + ' ninguna ciudad te ataca.' : 'Si la atacas, entra en guerra contigo y te atacará cada ' + DM.guerra.cadaMin.map(v => v / 60).join('–') + ' h (solo un enemigo a la vez; nunca te elimina: solo roba lo que no está a salvo). Tras cada asedio tuyo esperas ' + DM.asedio.esperaMin + ' min. Defiéndete con tropas, muralla y defensas.'));
    }
    const tabla = ciudad ? DM.ciudades.botin : DM.monstruos.botin, posible = Object.fromEntries(Object.entries(tabla).map(([k, x]) => [k, Math.round(mo.fuerza * x)]));
    h.append(el('div', { class: 'botin-posible' }, el('b', { text: 'Botín posible' }), el('div', { class: 'coste' }, costeIconos(posible),
      ciudad ? el('span', { class: 'coste-item' }, imgObjeto('cofre_p', 'ico-coste'), el('b', { text: '¿?' })) : el('span', { class: 'coste-item' }, imgFragmento(mo.tipo, M.rangoDe(mo.nivel), 'ico-coste'), el('b', { text: '¿?' })),
      ciudad ? null : el('span', { class: 'coste-item' }, imgPocion('pequena', 'ico-coste'), el('b', { text: '¿?' })))));
    h.append(el('div', { class: 'fila-titulo' }, el('b', { text: 'Tu ejército' }), el('span', { class: 'sub', text: cu ? DM.edificios.cuartel.nombre + ' nv ' + cu.nivel : 'Sin ' + DM.edificios.cuartel.nombre.toLowerCase() })));
    const tiene = M.TIPOS_TROPA.filter(t => m.tropas[t] > 0);
    if (!tiene.length) h.append(el('p', { class: 'sub', text: 'No tienes tropas en la ciudad. Entrénalas en el ' + DM.edificios.cuartel.nombre + '.' }));
    for (const t of tiene) {
      const n = sel.tropas[t], tot = m.tropas[t], paso = Math.max(1, Math.round(tot / 10)), k = M.rps(DM.tropas[t].clase, d.clase);
      h.append(el('div', { class: 'fila-ataque' }, imgTropa(t, 'retrato', 'retrato-48'), el('div', { class: 'datos' }, el('b', { text: DM.tropas[t].nombre }), el('div', { class: 'sub' + (k > 1 ? ' ventaja' : k < 1 ? ' desventaja' : ''), text: nombreClase(DM.tropas[t].clase) + (k > 1 ? ' · ventaja' : k < 1 ? ' · desventaja' : '') + ' · de ' + tot })),
        el('div', { class: 'paso-num' }, el('button', { class: 'btn secundario mini-btn', id: 'atq-menos-' + t, text: '−', disabled: n <= 0, onclick: () => { sel.tropas[t] = Math.max(0, n - paso); refrescarHoja(); } }),
          el('b', { id: 'atq-' + t, text: String(n) }),
          el('button', { class: 'btn secundario mini-btn', id: 'atq-mas-' + t, text: '+', disabled: n >= tot, onclick: () => { sel.tropas[t] = Math.min(tot, n + paso); refrescarHoja(); } }))));
    }
    if (!m.heroes.length) h.append(el('p', { class: 'sub', text: 'Sin héroes: puedes atacar, pero tus tropas no tendrán su mejora.' }));
    for (const x of m.heroes) {
      const st = M.estadoHeroe(x), on = sel.heroes.includes(x.id);
      h.append(el('label', { class: 'fila-ataque fila-check' + (st !== 'listo' ? ' bloqueada' : '') }, imgHeroe(x, 'retrato', 'retrato-48'),
        el('span', { class: 'datos', text: 'Héroe: ' + x.nombre + ' · nv ' + x.nivel + (st !== 'listo' ? ' · ' + ESTADO_HEROE[st].toLowerCase() : '') }),
        el('input', { type: 'checkbox', id: 'atq-heroe-' + x.id, checked: on || null, disabled: st !== 'listo' || null,
          onchange: ev => { sel.heroes = ev.target.checked ? sel.heroes.concat(x.id) : sel.heroes.filter(i => i !== x.id); refrescarHoja(); } })));
    }
    if (m.heroes.length && !sel.heroes.length) h.append(el('p', { class: 'motivo', id: 'aviso-sin-heroe', text: 'Sin héroe: tus tropas no tienen la mejora de ningún héroe.' }));
    if (!m.heroes.length) h.append(el('span', { id: 'aviso-sin-heroe', hidden: true }));
    const v = M.validarSeleccion(e, sel), [pv, pc] = prevision(f.total, mo.fuerza), enCamino = (m.marchas || []).some(x => x.objetivo === objId), bloq = (ciudad && mo.recuperaMs > 0) || enCamino || (ciudad && m.asedioMs > 0);   // 0.7: conquistar no espera a que se recupere
    const marcha = M.minutosMarcha(e, mo.x, mo.y), pq = ciudad ? M.puedeConquistar(e, objId, sel) : null;
    if (marcha > 0) h.append(el('p', { class: 'sub', id: 'tiempo-marcha', text: 'Marcha: ' + String(marcha).replace('.', ',') + ' min de ida y otros tantos de vuelta. El combate se resuelve al llegar.' }));
    if ((m.marchas || []).some(x => x.objetivo === objId)) h.append(el('p', { class: 'motivo', id: 'ya-en-camino', text: 'Ya tienes un ejército en camino hacia aquí.' }));
    h.append(el('div', { class: 'fila-titulo' }, el('span', { class: 'sub', text: 'Tu fuerza ' }), el('b', { id: 'fuerza-propia', text: String(Math.round(f.total)) }),
      f.clases > 1 ? el('span', { class: 'sub', text: ' · variado ' + pct(f.variedad - 1) }) : null, el('span', { class: 'chip-prevision ' + pc, id: 'prevision', text: v.ok ? pv : '—' })));
    h.append(el('div', { class: 'botones-ataque' },
      el('button', { class: 'btn peligro', id: 'btn-atacar', text: ciudad ? 'Saquear' : 'Atacar', disabled: !v.ok || bloq, onclick: () => lanzar(false) }),
      ciudad && J.nivelCiudad(e) >= DM.conquista.desdeAyto ? el('button', { class: 'btn oro', id: 'btn-conquistar', disabled: !pq.ok || enCamino || m.asedioMs > 0, title: pq.ok ? '' : pq.motivo, onclick: () => lanzar(true) }, imgUi('icono_conquista', 'ico-coste'), 'Conquistar') : null,
      el('button', { class: 'btn secundario', id: 'btn-cancelar-ataque', text: 'Cancelar', onclick: cerrarHoja })));
    function lanzar(conquistar) {
      const r = M.atacar(e, objId, sel, { conquistar }); if (!r.ok) return aviso(r.motivo, 'aviso');
      E.ataque = null; guardar(); cerrarHoja(); pintar();
      if (r.marcha) aviso('Tu ejército se pone en marcha', 'info', 'Llegará a ' + r.marcha.nombre + ' en ' + minutosTxt(r.marcha.idaMs) + '. Verás el resultado al llegar.');
      else pantallaResultado(r.resultado);
    }
    if (!v.ok) h.append(el('p', { class: 'motivo', text: v.motivo }));
    if (ciudad && J.nivelCiudad(e) >= DM.conquista.desdeAyto && !pq.ok && v.ok) h.append(el('p', { class: 'sub', id: 'motivo-conquista', text: pq.motivo }));
    else if (ciudad && J.nivelCiudad(e) < DM.conquista.desdeAyto) h.append(el('p', { class: 'sub', id: 'motivo-conquista', text: 'Conquistar: desde tu ayuntamiento nivel ' + DM.conquista.desdeAyto + ' (ahora ' + J.nivelCiudad(e) + '); vale cualquier ciudad, de cualquier nivel, con un poder al menos un ' + Math.round((DM.conquista.ventaja - 1) * 100) + ' % mayor que el de la ciudad.' }));
  }
  // Pantalla de resultado (maquetas 03/04): velo tinta 65 %, panel pergamino con filete oro, cinta Victoria/Derrota, enemigo, bajas, botín, héroes
  async function pantallaResultado(r) {
    const e = PARTIDA, c = r.ciudad ? M.objetivo(e, r.monstruo.id) : null, pend = r.captura ? (e.militar.capturas || []).find(k => k.id === r.captura.id) : null;
    const enemigo = el('div', { class: 'res-enemigo' }, el('div', { class: 'marco-retrato' }, r.ciudad ? (c ? imgCiudadEnemiga(c, 'retrato-68') : imgMundo('ciudades/ciudad_enemiga_1', 'retrato-68')) : imgC('monstruos/' + (r.monstruo.legendario ? 'legendario_' + r.monstruo.tipo + '_combate' : r.monstruo.tipo + '_' + M.rangoDe(r.monstruo.nivel) + '_retrato'), 'retrato-68')),
      el('div', {}, el('b', { text: r.monstruo.nombre + ' · nv ' + r.monstruo.nivel }), el('div', { class: 'sub', text: 'Poder ' + r.monstruo.fuerza + ' · tu fuerza ' + r.fuerza }),
        el('span', { class: 'chip-res ' + (r.gana ? 'bien' : 'mal'), text: r.gana ? (r.conquistada ? 'Conquistada' : r.ciudad ? 'Saqueada' : 'Derrotado') : 'Resiste' })));
    const filas = Object.entries(r.enviadas || {}).map(([t, n]) => el('div', { class: 'res-fila' }, imgTropa(t, 'retrato', 'retrato-36'), el('span', { class: 'datos', text: DM.tropas[t].nombre }),
      el('b', { text: String(n) }), el('b', { class: 'caidas', text: '−' + (r.bajas[t] || 0) })));
    const bajas = el('div', { class: 'res-bloque', id: 'resultado-bajas' }, el('div', { class: 'res-cab' }, el('h3', { text: 'Bajas' }), el('span', { text: 'Enviadas' }), el('span', { text: 'Caídas' })),
      filas.length ? filas : el('p', { class: 'sub', text: 'No enviaste tropas.' }));
    let botin;
    if (r.botin) {
      const cas = Object.entries(r.botin.recursos).map(([k, v]) => el('div', { class: 'casilla' }, imgRec(k, 'ico-casilla'), el('b', { text: '+' + v })));
      Object.entries(r.botin.pociones || {}).filter(([, n]) => n).forEach(([p, n]) => cas.push(el('div', { class: 'casilla' }, imgPocion(p, 'ico-casilla'), el('b', { text: '×' + n }))));
      Object.entries(r.botin.objetos || {}).filter(([, n]) => n).forEach(([o, n]) => cas.push(el('div', { class: 'casilla' }, imgObjeto(o, 'ico-casilla'), el('b', { text: '×' + n }))));
      if (r.botin.fragmentos) cas.push(el('div', { class: 'casilla', id: 'botin-fragmento' }, imgFragmento(r.botin.familia, r.botin.rango, 'ico-casilla'), el('b', { text: '+' + r.botin.fragmentos })));
      if (r.botin.comunes) cas.push(el('div', { class: 'casilla' }, imgFragmento(null, null, 'ico-casilla'), el('b', { text: '+' + r.botin.comunes })));
      botin = el('div', { class: 'res-bloque', id: 'resultado-botin' }, el('h3', { text: 'Botín' }), el('div', { class: 'casillas' }, cas));
    } else botin = el('div', { class: 'res-bloque', id: 'resultado-botin' }, el('h3', { text: 'Botín' }), el('p', { class: 'sub', text: 'Sin botín esta vez.' }));
    const heroes = el('div', { class: 'res-bloque', id: 'resultado-heroes' }, r.heroes.map(id => {
      const x = M.heroe(e, id); if (!x) return null; const q = x.nivel < DM.heroes.nivelMax ? M.requisitosSubir(x) : null, pr = q ? Math.min(1, x.xp / q.xp) : 1, her = r.heridos.find(y => y.id === id), sub = (r.subidas || []).find(y => y.id === id);
      return el('div', { class: 'res-heroe' }, imgHeroe(x, 'retrato', 'retrato-44'), el('div', { class: 'datos' }, el('div', { class: 'fila' }, el('b', { text: x.nombre }), el('b', { class: 'exp', text: '+' + r.xp + ' exp' })),
        el('div', { class: 'barra-exp' }, el('i', { style: 'width:' + Math.round(pr * 100) + '%' })), el('div', { class: 'sub', text: 'nv ' + x.nivel + (q ? ' · ' + Math.round(pr * 100) + ' % de experiencia para nv ' + (x.nivel + 1) : '') }),
        sub ? el('div', { class: 'sube-nivel', text: '¡Sube a nivel ' + sub.a + '!' }) : null,
        her ? el('div', { class: 'motivo', text: 'Herido: ' + her.minutos + ' min jugados (se queda en la ciudad; nunca se pierde)' }) : null));
    }));
    const v = await dialogo({ clase: 'resultado-combate', capa: 'capa-resultado', cabecera: el('div', { class: 'cinta ' + (r.gana ? 'victoria' : 'derrota') }, imgC('pantalla/cinta_' + (r.gana ? 'victoria' : 'derrota'), 'img-cinta'),
      el('h2', { id: 'resultado-titulo', text: r.gana ? '¡Victoria!' : 'Derrota' })),
      pie: el('div', { class: 'res-cuerpo', id: 'resultado-combate' }, enemigo, bajas, botin, r.heroes.length ? heroes : el('p', { class: 'sub', text: 'Sin héroe en este ataque.' }),
        r.gana ? el('p', { class: 'sub', text: r.conquistada ? '¡Ahora es tuya! Te pagará tributo cada minuto.' : r.ciudad ? 'La ciudad se recuperará en ' + DM.ciudades.recuperaMin + ' min jugados.' : 'Otro monstruo aparecerá en otro sitio del mapa.' }) : null,
        r.enMarcha ? el('p', { class: 'sub', text: 'Tus tropas vuelven a la ciudad con el botín (llega al volver).' }) : null,
        (r.efectos || []).length ? el('div', { class: 'res-bloque', id: 'resultado-efectos' }, el('h3', { text: 'Habilidades legendarias' }), el('ul', {}, r.efectos.map(t => el('li', { text: t })))) : null,
        pend ? el('div', { class: 'res-bloque', id: 'resultado-captura' }, el('h3', { text: '¿Derrotar o capturar?' }), el('p', { class: 'sub', text: 'Capturarlo multiplica × ' + pend.factor + ' las bajas: ' + textoBajasCaptura(pend) + '. Se une como héroe (no muere, se cura y sube hasta nv ' + DM.heroes.nivelMax + ').' })) : null),
      botones: pend ? [{ texto: 'Capturar', valor: 'capturar', tipo: 'oro', id: 'btn-res-capturar' }, { texto: 'Derrotar', valor: 'derrotar', tipo: 'principal', id: 'btn-res-derrotar' }]
        : [{ texto: 'Volver al mapa', valor: 'mapa', tipo: 'principal', id: 'btn-resultado-ok' }, { texto: 'Ver la ciudad', valor: 'ciudad', id: 'btn-resultado-ciudad' }], alCerrar: 'mapa' });
    if (pend && v === 'capturar') { const q = M.capturar(e, pend.id); guardar(); pintar(); if (q.ok) aviso(q.heroe.nombre + ' capturado', 'exito', 'Ya es tu héroe (nv ' + q.heroe.nivel + ').'); else aviso(q.motivo, 'aviso'); return; }
    if (pend && v === 'derrotar') { M.derrotar(e, pend.id); guardar(); pintar(); return; }
    if (v === 'ciudad' && PARTIDA) { E.vista = 'ciudad'; pintar(); }
  }
  // 0.8 · Capturar o derrotar un monstruo vencido
  function textoBajasCaptura(k) { const ex = M.bajasCaptura(k), n = Object.values(ex).reduce((a, b) => a + b, 0); return n ? n.toLocaleString('es-ES') + ' bajas más (' + Object.entries(ex).map(([t, v]) => v + ' ' + DM.tropas[t].nombre.toLowerCase()).join(', ') + ')' : 'sin bajas extra'; }
  function hojaCaptura(h, kid) {
    const e = PARTIDA, k = (e.militar.capturas || []).find(y => y.id === kid);
    if (!k) { h.append(cabeceraHoja('Captura', 'Ya no está pendiente.', 'hoja-titulo')); return; }
    const T = DM.heroes.tipos['cap_' + k.tipo];
    h.append(cabeceraHoja('¿Capturar a ' + k.nombre + '?', 'Nivel ' + k.nivel + (k.legendario ? ' · legendario' : ''), 'hoja-titulo'));
    h.append(el('div', { class: 'tarjeta-clara', id: 'captura-detalle' }, el('p', { text: 'Capturarlo multiplica × ' + k.factor + ' las bajas de este combate: ' + textoBajasCaptura(k) + '.' }),
      el('p', { class: 'sub', text: 'Se une como héroe: no muere, se cura y tiene habilidades propias (' + T.habilidades.map(a => a.nombre).join(', ') + (T.legendario ? '; además, su habilidad legendaria en combate' : '') + '). Sube hasta el nivel ' + DM.heroes.nivelMax + '.' })));
    h.append(el('div', { class: 'botones-ataque' },
      el('button', { class: 'btn oro', id: 'btn-capturar', text: 'Capturar', onclick: () => { const r = M.capturar(e, kid); if (!r.ok) return aviso(r.motivo, 'aviso'); guardar(); cerrarHoja(); pintar(); aviso(r.heroe.nombre + ' capturado', 'exito', 'Ya es tu héroe (nv ' + r.heroe.nivel + ').'); } }),
      el('button', { class: 'btn secundario', id: 'btn-derrotar', text: 'Derrotar', onclick: () => { M.derrotar(e, kid); guardar(); cerrarHoja(); pintar(); } })));
  }
  function accion(r, ok) { if (!r.ok) return aviso(r.motivo, 'aviso'); guardar(); pintar(); refrescarHoja(); if (ok) aviso(ok, 'exito'); }
  function menuJuego() {
    abrirHoja(h => {
      h.append(tiempoReal() ? cabeceraHoja('Menú', 'Partida clásica: el tiempo sigue corriendo mientras el menú está abierto.') : cabeceraHoja('Menú · partida en pausa', 'Mientras este menú está abierto, el juego no avanza.'),
        el('div', { class: 'menu-lista' },
          el('button', { class: 'btn principal', id: 'menu-continuar', text: 'Continuar', onclick: cerrarHoja }),
          el('button', { class: 'btn secundario', id: 'menu-guardar-archivo', onclick: () => { cerrarHoja(); guardarPartidaArchivo(); } }, ico('guardar'), 'Guardar partida'),
          el('button', { class: 'btn secundario', id: 'menu-tutorial', text: 'Ver el tutorial', onclick: () => { cerrarHoja(); tutorial(); } }),
          el('button', { class: 'btn secundario', id: 'menu-acerca', onclick: () => ir('acerca') }, ico('info'), 'Acerca de'),
          el('button', { class: 'btn secundario', id: 'menu-salir', onclick: salirAPartidas }, ico('guardar'), 'Guardar y volver a partidas')));
    }, { pausa: true });
  }

  // ---------- Acerca de (sin «Buscar actualizaciones»: el aviso «Actualizar» es automático) ----------
  function pintarAcerca(m) {
    const v = g.KK_VERSION || {};
    m.append(el('div', { class: 'pagina', id: 'acerca' },
      el('div', { class: 'cabecera-pagina' }, el('button', { class: 'btn-icono', id: 'btn-atras-acerca', 'aria-label': 'Atrás', onclick: atras }, ico('atras')), el('h2', { text: 'Acerca de' })),
      el('div', { class: 'portada' }, el('img', { class: 'logo-acerca', src: 'img/logo/logo_civilik_apilado_claro.svg', alt: "Civili'k" }), el('h1', { class: 'solo-lector', text: "Civili'k" })),
      el('div', { class: 'panel centro' }, el('p', { class: 'version', text: 'Versión ' + v.versionName + ' (' + v.versionCode + ')' }),
        el('p', { class: 'sub', text: 'Creado por' }), el('p', { class: 'creador', text: 'kk digital studio' }),
        el('p', { text: 'Prototipo de prueba: ciudad, recursos, ejército, mapa del mundo, guerra y conquista, con partidas Clásica o Rápida. Las partidas se guardan solo en este móvil. Internet solo se usa para avisar de actualizaciones.' }),
        el('p', { class: 'sub pequeno', text: 'Fuentes Grenze y Alegreya Sans (SIL Open Font License 1.1). Arte original de Civili\u2019k.' })),
      el('button', { class: 'btn secundario ancho', id: 'btn-volver', text: 'Volver', onclick: atras })));
  }

  // 0.9 (bug): al repintar (abrir un cofre, usar una poción, cobrar…) la pestaña volvía arriba. Ahora, si sigues en la misma pestaña, se queda donde estaba.
  function pintar() {
    const m = $('#pantalla'), z0 = $('#zona'), antes = z0 && E.pantalla === 'juego' ? { vista: E.vista, top: z0.scrollTop, left: z0.scrollLeft } : null;
    m.innerHTML = '';
    if (E.pantalla === 'juego' && PARTIDA) pintarJuego(m); else if (E.pantalla === 'acerca') pintarAcerca(m); else pintarInicio(m);
    const z1 = $('#zona'); if (antes && z1 && E.pantalla === 'juego' && antes.vista === E.vista && !['ciudad', 'mapa'].includes(E.vista)) { z1.scrollTop = antes.top; z1.scrollLeft = antes.left; }
  }
  // 0.9 · mantener pulsado más de 2 s repite la acción (pieza común kk-pulsar). hacer() devuelve { ok, motivo }.
  function repetible(b, hacer, texto) {
    if (!g.KKPulsar || !b) return b; let bien = 0, motivo = '';
    return g.KKPulsar.repetir(b, () => { const r = hacer(); if (!r || !r.ok) { motivo = (r && r.motivo) || ''; return false; } bien++; guardar(); pintar(); refrescarHoja(); return true; },
      { esperaMs: DM.repetir.esperaMs, cadaMs: DM.repetir.cadaMs, max: DM.repetir.maxSeguidas, alTerminar: () => { if (bien) aviso((texto ? texto(bien) : 'Hecho') + ' (×' + bien + ' seguidas)', 'exito', motivo ? 'Se para: ' + motivo : ''); bien = 0; motivo = ''; } });
  }
  // Refresco ligero de recursos y de la hoja abierta mientras se juega
  function refrescar() {
    if (E.pantalla !== 'juego' || !PARTIDA) return;
    const viejo = $('#recursos'); if (!viejo) return;
    viejo.replaceWith(pintarRecursos(PARTIDA));
    const m = PARTIDA.militar, bn = $('#banners-militar'); if (bn) bn.replaceWith(bannersMilitar(PARTIDA));
    if (m) {
      if (E.desertores == null) E.desertores = m.desertores;
      if (m.desertores > E.desertores) { aviso('Han desertado ' + (m.desertores - E.desertores) + ' tropas', 'aviso', 'No había comida para mantenerlas.'); E.desertores = m.desertores; if (E.vista === 'ejercito' && !hojaRender) pintar(); }
      if (m.autoInactivos) { aviso('Héroes inactivos por falta de comida', 'aviso', 'No elegiste a tiempo: quedan inactivos los de menor nivel.'); delete m.autoInactivos; if (!hojaRender) pintar(); }
      // 0.5 · avisos del motor (vuelta de las tropas que recogían)
      // 0.7: si llegan muchos de golpe (p. ej. al volver tras horas sin jugar) se resumen en uno; todos quedan en «Informes»
      const avs = (m.avisos || []).splice(0);
      if (avs.length > 3) aviso(avs.length + ' novedades mientras no estabas', 'info', 'Las tienes todas en «Informes».', 6000); else for (const x of avs) avisoMotor(x);
      const gi = $('#globo-informes'), nI = E.vista === 'informes' ? 0 : M.informesNuevos(PARTIDA);
      if ((gi ? +gi.textContent : 0) !== Math.min(99, nI)) { const env = $('#tab-informes') && $('#tab-informes').parentNode; if (gi) gi.remove(); if (nI && env) env.append(el('b', { class: 'globo', id: 'globo-informes', text: String(Math.min(99, nI)) })); }
      // globo de misiones por cobrar
      const nMis = M.misiones(PARTIDA).filter(x => x.completa && !x.cobrada).length, gl = $('#globo-misiones');
      if ((gl ? +gl.textContent : 0) !== nMis) { const env = $('#tab-misiones') && $('#tab-misiones').parentNode; if (gl) gl.remove(); if (nMis && env) env.append(el('b', { class: 'globo', id: 'globo-misiones', text: String(nMis) })); }
      if (['ejercito', 'inventario', 'misiones', 'estadisticas', 'informes'].includes(E.vista) && !hojaRender) { const z = $('#zona'), st = z ? z.scrollTop : 0; pintar(); const z2 = $('#zona'); if (z2) z2.scrollTop = st; }
      if (E.vista === 'mapa') refrescarMapa();
    }
    if (hojaRender && !hojaPausa) refrescarHoja();
  }

  // 0.6 · avisos del motor: recogidas, guardias de zona, combates de las marchas (Clásica), vueltas y ataques a tu ciudad
  function avisoMotor(x) {
    if (x.tipo === 'recogida') return aviso(x.completa ? 'Tus obreros han vuelto' : 'Obreros de vuelta', 'exito', '+' + x.cantidad + ' de ' + J.NOMBRE_RECURSO[x.recurso].toLowerCase() + '.');
    if (x.tipo === 'guardia') return x.gana ? null : aviso('La guardia de la zona ha ganado', 'aviso', 'Tus tropas vuelven con bajas y sin recursos.');
    if (x.tipo === 'combate') { if (!dialogoActual && !hojaRender) pantallaResultado({ ...x.resultado, enMarcha: true }); else aviso(x.resultado.gana ? '¡Victoria en ' + x.resultado.monstruo.nombre + '!' : 'Derrota en ' + x.resultado.monstruo.nombre, x.resultado.gana ? 'exito' : 'aviso', 'Tu ejército vuelve a la ciudad.'); return; }
    if (x.tipo === 'vuelta') return aviso('Tu ejército ha vuelto', 'exito', x.botin ? 'Botín: ' + textoCoste(x.botin) : 'Sin botín.');
    if (x.tipo === 'marcha') return aviso('Tu ejército vuelve', 'info', x.nombre + ' ' + x.motivo + '.');
    if (x.tipo === 'defensa') return aviso(x.gana ? 'Has rechazado a ' + x.ciudad : x.ciudad + ' te ha saqueado', x.gana ? 'exito' : 'error',
      'Ataque ' + x.fuerzaAtaque + ' · tu defensa ' + x.fuerzaDefensa + (x.gana ? '.' : '. Se llevan ' + (textoCoste(x.robado) === 'gratis' ? 'nada (todo estaba a salvo)' : textoCoste(x.robado)) + '.'), 7000);
  }
  async function iniciar() {
    await cargarPartidas();
    PA.teclado();
    PA.deslizable($('#hoja'), cerrarHoja, $('#velo'));
    $('#velo').onclick = cerrarHoja;
    document.addEventListener('visibilitychange', cambio);
    g.CivilikPausaSistema = v => { E.pausaSistema = !!v; cambio(); };
    g.CivilikAtras = atras;
    setInterval(() => { const antes = activo; tick(); if (antes) refrescar(); }, 1000);
    pintar(); cambio();
    if (!g.KK_PWA) ACT.montarAviso($('#aviso-actualizacion')).catch(() => { });   // 0.10 · en la PWA no aplica (el service worker avisa de las versiones nuevas)
  }
  g.CivilikApp = { E, J, ARCH, guardarPartidaArchivo, cargarPartidaArchivo, atras, sincronizar: cambio, velocidad: () => velocidad(), partida: () => PARTIDA, jugando: () => activo, guardar: () => guardar(), refrescar, pintar, refrescarHoja };
  iniciar();
})(window);
