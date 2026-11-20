/* kk-comun · kk-actualizador · aviso automático «Actualizar»: consulta version.json, compara versionCode, descarga el APK,
   verifica su SHA-256 y abre el instalador de Android (plugin nativo KKUpdater, android/java/kk/comun/KKUpdaterPlugin.java).
   Origen: Véncelo 1.1 (www/js/actualizador.js + aviso de app.js), generalizado.
   Uso: const A = KKActualizador.crear({ db, app: 'MiApp', urlDefecto: 'https://drive.google.com/uc?export=download&id=…', version: () => window.KK_VERSION });
        A.montarAviso(document.getElementById('aviso-actualizacion'));   // comprueba (1 vez al día) y muestra el aviso si hay versión nueva
   version.json: { versionCode: entero, versionName: texto, apkUrl: 'https://…', sha256: 64 hex, notas?: texto } */
(function (g) {
  'use strict';
  const UN_DIA = 24 * 3600e3;
  function crear(o) {
    if (!o || !o.db || !o.app) throw new Error('kk-actualizador: faltan opciones (db, app)');
    const DB = o.db, APP = o.app, NOMBRE_PLUGIN = o.plugin || 'KKUpdater';
    const nativo = () => !!(g.KKNativo && g.KKNativo.esNativo());
    const plugin = () => g.KKNativo.plugin(NOMBRE_PLUGIN);
    async function instalada() {
      if (nativo()) { try { const r = await plugin().info(); return { versionCode: +r.versionCode, versionName: r.versionName }; } catch (_) { } }
      return { ...(typeof o.version === 'function' ? o.version() : o.version) };
    }
    function validar(m) {
      if (!m || typeof m !== 'object') return false;
      return Number.isInteger(m.versionCode) && m.versionCode > 0 && typeof m.versionName === 'string' && m.versionName.length > 0
        && typeof m.apkUrl === 'string' && /^https:\/\//i.test(m.apkUrl) && typeof m.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(m.sha256);
    }
    const esMasNueva = (m, inst) => validar(m) && Number.isInteger(inst.versionCode) && m.versionCode > inst.versionCode;
    async function obtener(url) {
      if (nativo()) { const r = await plugin().fetchText({ url }); return JSON.parse(r.data); }
      const r = await fetch(url, { cache: 'no-store', redirect: 'follow' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }
    const getUrl = async () => (await DB.getMeta('urlActualizacion')) || o.urlDefecto || '';
    const setUrl = url => DB.setMeta('urlActualizacion', url);
    // Nunca lanza errores: sin red falla en silencio.
    async function comprobar() {
      const url = await getUrl(), inst = await instalada();
      if (!url) return { estado: 'SIN_URL', inst };
      try {
        const m = await obtener(url);
        await DB.setMeta('ultimaComprobacion', Date.now());
        if (!validar(m)) return { estado: 'ERROR', inst, motivo: 'version.json no válido' };
        if (esMasNueva(m, inst)) { await DB.setMeta('actualizacion', m); return { estado: 'NUEVA', inst, m }; }
        await DB.setMeta('actualizacion', null);
        return { estado: 'AL_DIA', inst, m };
      } catch (e) { return { estado: 'ERROR', inst, motivo: e.message }; }
    }
    async function comprobarSiToca() {
      const ult = (await DB.getMeta('ultimaComprobacion')) || 0;
      if (Date.now() - ult >= UN_DIA || Date.now() < ult) return comprobar();
      return null;
    }
    async function pendiente() {
      const m = await DB.getMeta('actualizacion');
      if (!m || !esMasNueva(m, await instalada())) return null;
      const pos = await DB.getMeta('actualizacionPospuesta'), hoy = new Date().toDateString();
      if (pos && pos.versionCode === m.versionCode && pos.dia === hoy) return null;
      return m;
    }
    const posponer = m => DB.setMeta('actualizacionPospuesta', { versionCode: m.versionCode, dia: new Date().toDateString() });
    const hex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    // Devuelve { estado: 'LISTO' | 'HASH' | 'PRIVADO' | 'DESCARGA' | 'PERMISO' }
    async function actualizar(m, alProgreso = () => { }) {
      if (nativo()) {
        const p = plugin(); const h = await p.addListener('progress', ev => alProgreso(ev.percent));
        try {
          const r = await p.download({ url: m.apkUrl, sha256: m.sha256.toLowerCase() });
          if (!r.ok) return { estado: ['HASH', 'PRIVADO'].includes(r.error) ? r.error : 'DESCARGA', detalle: r.detalle };
          const puede = await p.canInstall();
          if (!puede.value) { await p.openInstallSettings(); return { estado: 'PERMISO' }; }
          await p.install();
          return { estado: 'LISTO' };
        } catch (e) { return { estado: 'DESCARGA', detalle: e.message }; }
        finally { h && h.remove && h.remove(); }
      }
      try {   // Navegador (pruebas): descarga con progreso y verificación del hash con WebCrypto
        const r = await fetch(m.apkUrl, { cache: 'no-store', redirect: 'follow' });
        if (!r.ok) return { estado: 'DESCARGA', detalle: 'HTTP ' + r.status };
        const total = +r.headers.get('content-length') || 0, partes = []; let n = 0;
        const lector = r.body.getReader();
        for (;;) { const { done, value } = await lector.read(); if (done) break; partes.push(value); n += value.length; if (total) alProgreso(Math.round(n * 100 / total)); }
        const datos = new Uint8Array(n); let k = 0; for (const p of partes) { datos.set(p, k); k += p.length; }
        const sha = hex(await crypto.subtle.digest('SHA-256', datos));
        if (sha !== m.sha256.toLowerCase()) return { estado: 'HASH', sha256: sha };
        return { estado: 'LISTO', sha256: sha, bytes: n };
      } catch (e) { return { estado: 'DESCARGA', detalle: e.message }; }
    }
    const TEXTOS = Object.assign({
      titulo: 'Nueva versión de ' + APP, boton: 'Actualizar', luego: 'Más tarde',
      hash: 'La descarga no coincide con la versión publicada (comprobación SHA-256). No se ha instalado nada.',
      privado: 'Google Drive pide iniciar sesión: el archivo de la actualización no está compartido con «Cualquier persona con el enlace».',
      permiso: 'Permite «Instalar apps desconocidas» para ' + APP + ' y vuelve a pulsar «Actualizar».',
      error: 'No se pudo descargar la actualización. Revisa la conexión y vuelve a probar.', listo: 'Abriendo el instalador…'
    }, o.textos || {});
    function nodo(tag, props, ...hijos) { const e = document.createElement(tag); for (const [k, v] of Object.entries(props || {})) { if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v); } hijos.flat().forEach(h => h && e.append(h)); return e; }
    async function pintarAviso(caja) {
      const m = await pendiente();
      if (!m) { caja.hidden = true; caja.innerHTML = ''; return null; }
      const estado = nodo('div', { class: 'kk-act-estado' });
      const btn = nodo('button', { class: 'btn primario', id: 'btn-actualizar', text: TEXTOS.boton });
      btn.onclick = async () => {
        btn.disabled = true; estado.textContent = 'Descargando…';
        const r = await actualizar(m, p => { estado.textContent = p >= 0 ? 'Descargando… ' + p + ' %' : 'Descargando…'; });
        btn.disabled = false;
        estado.textContent = r.estado === 'LISTO' ? TEXTOS.listo : r.estado === 'HASH' ? TEXTOS.hash : r.estado === 'PRIVADO' ? TEXTOS.privado : r.estado === 'PERMISO' ? TEXTOS.permiso : TEXTOS.error;
      };
      caja.innerHTML = '';
      caja.append(nodo('div', { class: 'kk-act-texto' }, nodo('b', { text: TEXTOS.titulo + ' (' + m.versionName + ')' }), m.notas ? nodo('div', { class: 'kk-act-notas', text: m.notas }) : null, estado),
        nodo('div', { class: 'kk-act-botones' }, nodo('button', { class: 'btn', id: 'btn-act-luego', text: TEXTOS.luego, onclick: async () => { caja.hidden = true; await posponer(m); } }), btn));
      caja.hidden = false;
      return m;
    }
    async function montarAviso(caja) { await pintarAviso(caja); await comprobarSiToca(); return pintarAviso(caja); }
    return { instalada, validar, esMasNueva, comprobar, comprobarSiToca, pendiente, posponer, actualizar, getUrl, setUrl, pintarAviso, montarAviso };
  }
  // Convierte enlaces de Drive al formato de descarga directa (igual que el plugin nativo)
  function enlaceDirecto(url) {
    const m = /^https:\/\/(?:drive|docs)\.google\.com\/(?:uc\?(?:.*&)?id=|open\?(?:.*&)?id=|file\/d\/)([A-Za-z0-9_-]{10,})/.exec(url || '');
    return m ? 'https://drive.usercontent.google.com/download?id=' + m[1] + '&export=download&confirm=t' : url;
  }
  g.KKActualizador = { crear, enlaceDirecto };
})(window);
