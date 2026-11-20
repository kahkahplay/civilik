/* kk-comun · kk-db · almacenamiento local en IndexedDB, configurable por app (sin internet ni servidores).
   Origen: Véncelo 1.1 (www/js/db.js), generalizado.
   Uso: const DB = KKDB.crear({ nombre: 'miapp', version: 1, almacenes: { cosas: { indices: { porX: 'x' } } } });
   Siempre crea además el almacén 'meta' (clave/valor). Cada app usa su propio nombre de base: datos separados. */
(function (g) {
  'use strict';
  function crear(cfg) {
    if (!cfg || !cfg.nombre) throw new Error('kk-db: falta el nombre de la base de datos');
    const NOMBRE = cfg.nombre, VERSION = cfg.version || 1, ALM = cfg.almacenes || {};
    let dbp = null;
    function abrir() {
      if (dbp) return dbp;
      dbp = new Promise((ok, mal) => {
        const r = indexedDB.open(NOMBRE, VERSION);
        r.onupgradeneeded = () => {
          const db = r.result, t = r.transaction;
          for (const [s, def] of Object.entries(ALM)) {
            const st = db.objectStoreNames.contains(s) ? t.objectStore(s) : db.createObjectStore(s, { keyPath: (def && def.clave) || 'id' });
            for (const [nom, campo] of Object.entries((def && def.indices) || {})) if (!st.indexNames.contains(nom)) st.createIndex(nom, campo, { unique: false });
          }
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        };
        r.onsuccess = () => ok(r.result);
        r.onerror = () => mal(r.error);
      });
      return dbp;
    }
    async function tx(store, modo, fn) {
      const db = await abrir();
      return new Promise((ok, mal) => {
        const t = db.transaction(store, modo), s = t.objectStore(store);
        let res; const r = fn(s);
        if (r && 'onsuccess' in r) r.onsuccess = () => { res = r.result; };
        t.oncomplete = () => ok(res); t.onerror = () => mal(t.error); t.onabort = () => mal(t.error);
      });
    }
    async function ponerVarios(store, lista, sustituir) {
      const db = await abrir();
      return new Promise((ok, mal) => {
        const t = db.transaction(store, 'readwrite'), s = t.objectStore(store);
        if (sustituir) s.clear();
        for (const n of lista) s.put(n);
        t.oncomplete = () => ok(); t.onerror = () => mal(t.error); t.onabort = () => mal(t.error);
      });
    }
    async function porIndice(store, indice, valor) {
      const db = await abrir();
      return new Promise((ok, mal) => {
        const t = db.transaction(store, 'readonly'), s = t.objectStore(store);
        const r = s.index(indice).getAll(valor); let res = [];
        r.onsuccess = () => { res = r.result || []; };
        t.oncomplete = () => ok(res); t.onerror = () => mal(t.error);
      });
    }
    function cerrar() { if (!dbp) return Promise.resolve(); const p = dbp; dbp = null; return p.then(db => db.close()).catch(() => { }); }
    return {
      nombre: NOMBRE, almacenes: Object.keys(ALM),
      todos: store => tx(store, 'readonly', s => s.getAll()),
      uno: (store, id) => tx(store, 'readonly', s => s.get(id)),
      poner: (store, obj) => tx(store, 'readwrite', s => s.put(obj)),
      quitar: (store, id) => tx(store, 'readwrite', s => s.delete(id)),
      vaciar: store => tx(store, 'readwrite', s => s.clear()),
      ponerVarios, porIndice, cerrar,
      getMeta: k => tx('meta', 'readonly', s => s.get(k)), setMeta: (k, v) => tx('meta', 'readwrite', s => s.put(v, k))
    };
  }
  g.KKDB = { crear };
})(window);
