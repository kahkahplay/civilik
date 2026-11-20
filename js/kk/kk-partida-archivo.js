/* kk-comun · kk-partida-archivo · guardar una partida (u otro objeto) en un ARCHIVO .json y volver a cargarla, para pasarla entre el APK y la web (PWA).
   Origen: Civili'k 0.10 («Guardar partida» en el menú y «Cargar partida» en el inicio). Requiere kk-nativo.js (opcional en la web).
   Uso:
     const PA = KKPartidaArchivo.crear({ app: 'civilik', nombreApp: "Civili'k", formato: 1, prefijo: 'civilik-partida',
                                          validar: datos => null | 'motivo', version: () => '0.10' });
     await PA.exportar(partida)  → 'COMPARTIDO' | 'DESCARGADO' | 'CANCELADO'
     const f = await PA.elegir()  → File | null (input file)
     const r = await PA.leer(f | texto) → { ok: true, datos, info: { app, formato, fecha, versionApp } } | { ok: false, motivo }
   Archivo: { kk: 'partida-archivo', app, formato, versionApp, fecha (ISO), crc32 (de JSON.stringify(datos)), datos }.
   Salida: Android (Capacitor) → Filesystem (CACHE) + Share (menú de compartir: Drive, Archivos, WhatsApp…), porque en el WebView no van las descargas por blob.
           Web en iPhone/iPad → Web Share con archivo si se puede (Guardar en Archivos, AirDrop…); si no, descarga del blob.
           Web en Android/PC → descarga del blob (carpeta Descargas). Opción `modo`: 'auto' | 'compartir' | 'descargar'. */
(function (g) {
  'use strict';
  const N = () => g.KKNativo;
  const nativo = () => !!(N() && N().esNativo && N().esNativo());
  const TABLA = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(texto) {
    const b = new TextEncoder().encode(texto); let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = TABLA[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
  }
  const dos = n => String(n).padStart(2, '0');
  const sello = d => d.getFullYear() + dos(d.getMonth() + 1) + dos(d.getDate()) + '-' + dos(d.getHours()) + dos(d.getMinutes());
  function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  const esIOS = () => { const n = g.navigator || {}; return /iPhone|iPad|iPod/i.test(n.userAgent || '') || (n.platform === 'MacIntel' && n.maxTouchPoints > 1); };
  g.__kkPartidaArchivo = g.__kkPartidaArchivo || [];   // registro para las pruebas automáticas

  function crear(o) {
    if (!o || !o.app || !Number.isInteger(o.formato)) throw new Error('kk-partida-archivo: faltan opciones (app, formato)');
    const APP = o.app, NOMBRE = o.nombreApp || o.app, PREF = o.prefijo || (o.app + '-partida');
    const nombreArchivo = (d = new Date()) => PREF + '-' + sello(d) + '.json';
    function empaquetar(datos, d = new Date()) {
      const j = JSON.stringify(datos);
      const sobre = { kk: 'partida-archivo', app: APP, formato: o.formato, versionApp: typeof o.version === 'function' ? o.version() : (o.version || ''), fecha: d.toISOString(), crc32: crc32(j) };
      // los datos van al final y tal cual (el crc se calcula sobre su JSON)
      return { nombre: nombreArchivo(d), texto: JSON.stringify(sobre).slice(0, -1) + ',"datos":' + j + '}' };
    }
    async function exportar(datos, op = {}) {
      const { nombre, texto } = empaquetar(datos), bytes = new TextEncoder().encode(texto), modo = op.modo || o.modo || 'auto';
      g.__kkPartidaArchivo.push({ nombre, bytes: bytes.length, texto });
      if (nativo()) {
        const F = N().plugin('Filesystem'), S = N().plugin('Share');
        if (!F || !S) throw new Error('Faltan los plugins Filesystem y Share');
        const { uri } = await F.writeFile({ path: nombre, data: b64(bytes), directory: 'CACHE' });
        try { await S.share({ title: nombre, files: [uri], dialogTitle: op.dialogo || 'Guardar partida' }); }
        catch (e) { if (/cancel/i.test((e && e.message) || '')) return 'CANCELADO'; throw e; }
        return 'COMPARTIDO';
      }
      const nav = g.navigator || {};
      if (modo === 'compartir' || (modo === 'auto' && esIOS())) {
        try {
          const f = new File([bytes], nombre, { type: 'application/json' });
          if (nav.canShare && nav.share && nav.canShare({ files: [f] })) {
            try { await nav.share({ files: [f], title: NOMBRE + ' · ' + nombre }); return 'COMPARTIDO'; }
            catch (e) { if (e && e.name === 'AbortError') return 'CANCELADO'; /* si no deja compartir, se descarga */ }
          }
        } catch (_) { }
      }
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = nombre; a.rel = 'noopener'; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      return 'DESCARGADO';
    }
    // Abre el selector de archivos del sistema (Android: el de Capacitor; iPhone: Archivos). null si se cancela.
    function elegir() {
      return new Promise(ok => {
        const i = document.createElement('input'); i.type = 'file'; i.style.display = 'none';
        if (!nativo()) i.accept = '.json,application/json,text/plain';   // en Android cualquier archivo (lo que llega por WhatsApp/Drive puede venir sin tipo)
        let hecho = false; const fin = v => { if (hecho) return; hecho = true; i.remove(); ok(v); };
        i.addEventListener('change', () => fin(i.files && i.files[0] || null));
        i.addEventListener('cancel', () => fin(null));
        document.body.appendChild(i); i.click();
      });
    }
    const textoDe = x => typeof x === 'string' ? Promise.resolve(x) : (x && x.text ? x.text() : new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => mal(r.error); r.readAsText(x); }));
    async function leer(x) {
      const MAL = m => ({ ok: false, motivo: m });
      if (!x) return MAL('No se ha elegido ningún archivo.');
      if (x.size > (o.maxBytes || 50e6)) return MAL('El archivo es demasiado grande para ser una partida de ' + NOMBRE + '.');
      let t; try { t = await textoDe(x); } catch (_) { return MAL('No se ha podido leer el archivo.'); }
      let s; try { s = JSON.parse(String(t).replace(/^\uFEFF/, '')); } catch (_) { return MAL('El archivo no es una partida de ' + NOMBRE + ' (no es un JSON válido o está incompleto).'); }
      if (!s || typeof s !== 'object' || s.kk !== 'partida-archivo') return MAL('Este archivo no es una partida guardada de ' + NOMBRE + '.');
      if (s.app !== APP) return MAL('Este archivo es de otra app (' + String(s.app).slice(0, 30) + '), no de ' + NOMBRE + '.');
      if (!Number.isInteger(s.formato)) return MAL('El archivo está dañado (sin versión de formato).');
      if (s.formato > o.formato) return MAL('La partida se guardó con una versión más nueva de ' + NOMBRE + ' (' + (s.versionApp || '¿?') + '). Actualiza la app para cargarla.');
      if (!s.datos || typeof s.datos !== 'object') return MAL('El archivo está dañado: no trae la partida.');
      if (s.crc32 && crc32(JSON.stringify(s.datos)) !== s.crc32) return MAL('El archivo está dañado o se ha modificado (la comprobación no coincide).');
      const v = o.validar ? o.validar(s.datos, s) : null; if (v) return MAL(v);
      return { ok: true, datos: s.datos, info: { app: s.app, formato: s.formato, fecha: s.fecha, versionApp: s.versionApp } };
    }
    return { nombreArchivo, empaquetar, exportar, elegir, leer };
  }
  g.KKPartidaArchivo = { crear, crc32, esIOS };
})(typeof window !== 'undefined' ? window : globalThis);
