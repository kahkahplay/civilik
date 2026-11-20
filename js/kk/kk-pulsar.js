/* kk-comun · kk-pulsar.js — «Mantener pulsado repite» (kk digital studio)
   Origen: Civili'k 0.9 (mejorar, fabricar pociones, comprar e intercambiar: si mantienes pulsado más de 2 s, se repite solo).
   KKPulsar.repetir(boton, accion, { esperaMs = 2000, cadaMs = 250, max = 200, alRepetir, alTerminar })
     · Un toque normal NO cambia nada: el clic del botón hace su acción como siempre.
     · Si el dedo (o el ratón) sigue apretado más de esperaMs, llama a accion() cada cadaMs hasta que se suelta, sale del botón
       o accion() devuelve false (p. ej. ya no hay recursos). El clic que llega al soltar se anula para que no cuente una vez de más.
     · Aguanta que la pantalla se vuelva a pintar entre repeticiones: escucha el «soltar» en todo el documento, no solo en el botón.
   Devuelve el mismo botón (para encadenar al crearlo). KKPulsar.activo() dice si hay una repetición en marcha. */
(function (g) {
  'use strict';
  let actual = null;
  function parar(motivo) {
    const a = actual; if (!a) return; actual = null;
    clearTimeout(a.espera); clearInterval(a.cada);
    for (const [t, f] of a.oyentes) g.document.removeEventListener(t, f, true);
    if (a.repetido) {   // anula el clic que el navegador manda al soltar (y cualquiera en los 400 ms siguientes)
      const hasta = Date.now() + 400, tragar = ev => { if (Date.now() <= hasta) { ev.stopPropagation(); ev.preventDefault(); } g.document.removeEventListener('click', tragar, true); };
      g.document.addEventListener('click', tragar, true); setTimeout(() => g.document.removeEventListener('click', tragar, true), 450);
    }
    if (a.op.alTerminar) a.op.alTerminar({ veces: a.veces, motivo });
  }
  function repetir(boton, accion, op = {}) {
    if (!boton || typeof accion !== 'function') return boton;
    const esperaMs = op.esperaMs ?? 2000, cadaMs = op.cadaMs ?? 250, max = op.max ?? 200;
    const empezar = ev => {
      if (boton.disabled || (ev.button != null && ev.button > 0)) return;
      parar('otro');
      const a = actual = { op, veces: 0, repetido: false, oyentes: [] };
      const soltar = () => parar('soltado');
      for (const t of ['pointerup', 'pointercancel', 'touchend', 'touchcancel', 'mouseup']) { a.oyentes.push([t, soltar]); g.document.addEventListener(t, soltar, true); }
      const fuera = () => { if (g.document.visibilityState === 'hidden') parar('oculta'); };
      a.oyentes.push(['visibilitychange', fuera]); g.document.addEventListener('visibilitychange', fuera, true);
      a.espera = setTimeout(() => {
        if (actual !== a) return;
        a.repetido = true;
        const una = () => {
          if (actual !== a) return;
          let r; try { r = accion(); } catch (err) { r = false; }
          a.veces++; if (op.alRepetir) op.alRepetir(a.veces, r);
          if (r === false || a.veces >= max) parar(r === false ? 'no-se-puede' : 'maximo');
        };
        una(); if (actual === a) a.cada = setInterval(una, cadaMs);
      }, esperaMs);
    };
    boton.addEventListener('pointerdown', empezar);
    boton.addEventListener('contextmenu', ev => { if (actual) ev.preventDefault(); });   // Android: que el toque largo no abra el menú
    return boton;
  }
  g.KKPulsar = { repetir, parar: () => parar('parado'), activo: () => !!actual };
})(typeof window !== 'undefined' ? window : globalThis);
