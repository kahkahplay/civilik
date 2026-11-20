/* kk-comun · paneles (de Notik’s 1.2): (1) el campo en el que se escribe nunca queda debajo del teclado;
   (2) las hojas inferiores se cierran deslizándolas hacia abajo. Piezas genéricas (sin datos de la app). */
(function () {
  'use strict';
  const CAMPO = 'input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]):not([type=button]), textarea, select';
  const esCampo = e => !!(e && e.matches && e.matches(CAMPO));
  const altoVisible = () => { const vv = window.visualViewport; return vv ? vv.height + vv.offsetTop : window.innerHeight; };
  // Alto del teclado cuando el sistema NO encoge la web (solo encoge el visualViewport): --teclado en CSS
  function medir() {
    const vv = window.visualViewport;
    const t = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    document.documentElement.style.setProperty('--teclado', t + 'px');
    return t;
  }
  // Lo que tape por abajo (barras fijas, p. ej. la barra de bloques del editor) se marca con data-tapa-abajo
  function tapaAbajo(campo) {
    let m = 0;
    const scroller = campo.closest('[data-scroll-campos]');
    for (const b of document.querySelectorAll('[data-tapa-abajo]')) {
      if (b.offsetParent === null || (scroller && !scroller.parentElement.contains(b))) continue;
      const r = b.getBoundingClientRect(); m = Math.max(m, altoVisible() - r.top);
    }
    return Math.max(0, m);
  }
  function asegurar(campo, forzar) {
    if (!campo || !campo.isConnected || document.activeElement !== campo) return false;
    const r = campo.getBoundingClientRect(), abajo = altoVisible() - tapaAbajo(campo) - 8, arriba = 8;
    if (!forzar && r.top >= arriba && r.bottom <= abajo) return false;
    if (r.height > abajo - arriba) return false; // un texto más alto que la pantalla: el navegador sigue al cursor
    const capa = campo.closest('.hoja-inferior, .dialogo');
    if (capa) { campo.scrollIntoView({ block: 'center', inline: 'nearest' }); return true; }
    // Editor: se baja lo justo para que el campo quede por encima de la barra y del teclado
    const cont = campo.closest('[data-scroll-campos]') || document.scrollingElement;
    if (r.bottom > abajo) cont.scrollTop += r.bottom - abajo + 16; else cont.scrollTop -= arriba - r.top + 16;
    return true;
  }
  let t1 = null, t2 = null;
  function programar() {
    const c = document.activeElement; if (!esCampo(c)) return;
    clearTimeout(t1); clearTimeout(t2);
    t1 = setTimeout(() => asegurar(c), 60); t2 = setTimeout(() => asegurar(c), 380);
  }
  function teclado() {
    medir();
    document.addEventListener('focusin', e => { if (esCampo(e.target)) programar(); });
    window.addEventListener('resize', () => { medir(); programar(); });
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', () => { medir(); programar(); }); window.visualViewport.addEventListener('scroll', medir); }
  }
  // Deslizar hacia abajo para cerrar. cerrar() lo cierra de verdad; velo se va aclarando mientras se arrastra.
  function deslizable(hoja, cerrar, velo) {
    let y0 = null, x0 = 0, t0 = 0, dy = 0, arrastra = false, desdeAsa = false, scroll0 = 0;
    const reset = () => { hoja.style.transition = ''; hoja.style.transform = ''; if (velo) velo.style.opacity = ''; };
    hoja.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) { y0 = null; return; }
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; t0 = Date.now(); dy = 0; arrastra = false; scroll0 = hoja.scrollTop;
      desdeAsa = !!(e.target.closest && e.target.closest('.hoja-asa, .hoja-titulo, [data-asa]'));
    }, { passive: true });
    hoja.addEventListener('touchmove', e => {
      if (y0 == null) return;
      const d = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
      if (!arrastra) {
        const enCampo = esCampo(e.target) && e.target.scrollHeight > e.target.clientHeight;
        if (d > 10 && Math.abs(d) > Math.abs(dx) * 1.2 && (desdeAsa || (scroll0 <= 0 && hoja.scrollTop <= 0)) && !enCampo) { arrastra = true; hoja.style.transition = 'none'; }
        else if (d < -10 || Math.abs(dx) > 14) { y0 = null; return; } else return;
      }
      dy = Math.max(0, d);
      hoja.style.transform = 'translateY(' + dy + 'px)';
      if (velo) velo.style.opacity = String(Math.max(0.15, 1 - dy / Math.max(200, hoja.offsetHeight)));
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    const fin = () => {
      if (y0 == null || !arrastra) { y0 = null; return; }
      y0 = null; arrastra = false;
      const v = dy / Math.max(1, Date.now() - t0);
      if (dy > Math.min(140, hoja.offsetHeight * 0.3) || (v > 0.6 && dy > 40)) {
        hoja.style.transition = 'transform .18s ease-in'; hoja.style.transform = 'translateY(110%)';
        setTimeout(() => { cerrar(); reset(); }, 170);
      } else { hoja.style.transition = 'transform .18s ease-out'; hoja.style.transform = ''; if (velo) velo.style.opacity = ''; setTimeout(reset, 200); }
    };
    hoja.addEventListener('touchend', fin); hoja.addEventListener('touchcancel', fin);
    return { reset };
  }
  window.KKPaneles = { teclado, asegurar, deslizable, medir, esCampo };
})();
