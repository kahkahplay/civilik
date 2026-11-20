/* Civili'k 0.2 · TEXTURAS, MEDIDAS Y COLORES DEL TERRENO (ciudad y mapa) en un solo sitio.
   Fuente: Camachin, «LEEME_Programator_0.2.txt» y «Civilik 0.2 - Guia ciudad integrada y terreno.pdf» (10/11/2026),
   assets de diseno/03_v0.2/ copiados en www/img/terreno/ (01, 02, 03), www/img/modos/ (04) y www/img/deco/ (05) a 2x (png_64 / png_192 / png_240).
   Para cambiar una textura basta con sustituir el PNG/SVG con el mismo nombre; las rutas y medidas están aquí. */
(function (g) {
  'use strict';
  g.CivilikTexturas = {
    colores: {
      // Paleta 0.1
      tinta: '#2B1D14', pergamino: '#F4E7C9', pergaminoOscuro: '#E3CFA0', madera: '#7A4E2D', granate: '#9B2C2C', oro: '#E8A93A', bosque: '#386F35', noche: '#2E2620',
      // Colores nuevos de terreno (LEEME 0.2, §6)
      hierba: '#93B860', hierbaClara: '#97BC64', hierbaMedia: '#8FB45C', sombraBorde: '#6F9443',
      camino: '#CFAE72', bordeCamino: '#A8854E', plaza: '#C8B485', adoquin: '#D0BC8F', bordillo: '#B4A06E',
      agua: '#5FA3C9', aguaHonda: '#4F93BC', espuma: '#CFE7F2', orilla: '#2F5D7C', arena: '#E3CFA0',
      roca: '#A9A59C', bordeRoca: '#8A857B', niebla: '#F4E7C9'
    },
    // Velo de los modos construir/mover: noche al 22 % sobre el mapa (no sobre la UI)
    veloModo: 'rgba(46,38,32,.22)',
    rutas: { mundo: 'img/mundo/', terreno: 'img/terreno/', modos: 'img/modos/', deco: 'img/deco/', edificios: 'img/edificios/', skins: 'img/skins/', militar: 'img/militar/', combate: 'img/combate/' },
    // 0.3 · monstruos, tropas, héroes, pociones y pantalla de combate de Camachin (LEEME_Programator_0.3): SVG de 256 u en img/combate/
    // 0.3 · skins por nivel (Camachin, LEEME_Programator_skins): SVG de 256 u = 96 dp; el dibujo crece dentro de su casilla (66 → 100 %)
    // Medidas en dp (LEEME §1)
    medidas: { celda: 32, edificioCeldas: 3, edificio: 96, dibujoEdificio: 92, dibujoSkin: 96, asiento: 120, asientoBajada: 4, overlay: 96, seleccionado: 100, nivel: 18, mancha: [80, 150],
      mapaCombate: { monstruo: 72, jefe: 96, escuadra: 80, heroe: 60 } },   // tamaños en el mapa de cercanías (LEEME 0.3 §4)
    suelo: { hierba: 6, pradera: 3, porcentajePradera: 0.08, manchaCada: 10,
      manchas: ['mancha_hierba_oscura_1', 'mancha_hierba_oscura_2', 'mancha_hierba_clara_1', 'mancha_hierba_clara_2', 'mancha_musgo_1', 'mancha_musgo_2', 'mancha_tierra_1', 'mancha_tierra_2'] },
    capas: ['agua', 'roca', 'camino', 'plaza'],   // rejilla dual, en este orden; la niebla va al final (solo mapa)
    imagenes: {   // miniaturas de las hojas y del tutorial (identidad 0.1)
      huecoLibre: 'img/suelo/hueco_libre.svg', huecoBloqueado: 'img/suelo/hueco_bloqueado.svg', solar: 'img/suelo/solar_edificio.svg', edificios: 'img/edificios/'
    },
    ciudad: { borde: 3, bloque: 11, corredor: 2 },   // retícula: 4×4 manzanas de 2×2 huecos (3×3 celdas) entre corredores de camino
    mapa: { lado: 21, celdasPorCasilla: 2 },         // (0.2–0.4) zona de 21×21 casillas; ya no se usa
    // 0.5 · mapa del mundo (Camachin, LEEME_Programator_0.5): casilla de 48 dp; terreno dual-grid img/mundo/terreno/terreno_<tipo>_<NO><NE><SO><SE>.png (png_64)
    // capas de abajo arriba; se pinta en lienzos de 25×25 casillas a 0,6 de resolución (memoria contenida en el móvil)
    mundo: { casilla: 48, capas: ['agua', 'arena', 'hierba', 'bosque', 'montana'], trozo: 25, resolucion: 0.5,   /* 0.8: 0.6 → 0.5 porque el mapa pasa a 150×150 (36 trozos en vez de 16; memoria parecida) */ zoom: [0.25, 1.5], zoomInicial: 0.6,
      tam: { monstruo: 72, jefe: 96, zona: 72, ciudad: 96, escuadra: 80, heroe: 60, capital: 120, escudo: 48 } }
  };
})(window);
