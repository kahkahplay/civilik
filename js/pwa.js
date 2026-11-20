/* Civili'k 0.10 · PWA (solo en la versión web, codigo/dist-pwa): marca KK_PWA (sin aviso «Actualizar» del APK), registra el service worker
   (juego sin conexión) y avisa «Hay una versión nueva» con un botón para recargar cuando el service worker detecta una actualización.
   La partida sigue en el dispositivo (IndexedDB); se pide almacenamiento persistente para que el navegador no la borre. */
(function (g) {
  'use strict';
  const nativo = !!(g.Capacitor && g.Capacitor.isNativePlatform && g.Capacitor.isNativePlatform());
  if (nativo) return;
  g.KK_PWA = true;
  const estado = g.__kkPwa = { sw: 'no', aviso: false };
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(v => { estado.persistente = v; }).catch(() => { }); } catch (_) { }
  if (!('serviceWorker' in navigator) || !g.isSecureContext) { estado.sw = 'sin soporte'; return; }
  let recargando = false;
  function aviso(reg) {
    if (document.getElementById('aviso-pwa')) return;
    const caja = document.createElement('div'); caja.id = 'aviso-pwa'; caja.className = 'aviso-pwa'; caja.setAttribute('role', 'status');
    const t = document.createElement('span'); t.textContent = 'Hay una versión nueva de Civili\'k.';
    const b = document.createElement('button'); b.id = 'btn-pwa-recargar'; b.className = 'btn oro'; b.textContent = 'Recargar';
    b.onclick = () => {
      b.disabled = true; b.textContent = 'Recargando…';
      const w = reg.waiting; if (w) w.postMessage({ tipo: 'SALTAR_ESPERA' }); else location.reload();
      setTimeout(() => { if (!recargando) location.reload(); }, 4000);
    };
    caja.append(t, b); document.body.appendChild(caja); estado.aviso = true;
  }
  function vigilar(reg) {
    if (reg.waiting && navigator.serviceWorker.controller) aviso(reg);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) aviso(reg); });
    });
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (recargando || !estado.aviso) return; recargando = true; location.reload(); });
  g.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).then(reg => {
      estado.sw = 'registrado'; vigilar(reg);
      navigator.serviceWorker.ready.then(() => { estado.sw = 'activo'; });
      // busca versión nueva al volver a la app y cada hora
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => { }); });
      setInterval(() => reg.update().catch(() => { }), 3600e3);
      g.__kkPwaReg = reg;
    }).catch(e => { estado.sw = 'error: ' + ((e && e.message) || e); });
  });
})(window);
