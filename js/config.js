/* Civili'k · configuración de los módulos comunes (kk-comun). Datos separados: base «civilik» (partidas guardadas en local). */
(function (g) {
  'use strict';
  const DB = g.KKDB.crear({ nombre: 'civilik', version: 1, almacenes: { partidas: {} } });
  // version.json de Civili'k en Drive (carpeta «Grok trabajos › Civili'k»)
  const ACT = g.KKActualizador.crear({ db: DB, app: "Civili'k", urlDefecto: 'https://drive.usercontent.google.com/download?id=18nHXy_ZEtIYk-41NK5RTlFS7U82foHH_&export=download&confirm=t', version: () => g.KK_VERSION });
  g.CivilikConfig = { DB, ACT };
})(window);
