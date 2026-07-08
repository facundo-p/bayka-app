/**
 * Compat de ruta: `PlantationMap` importa `./MapaPuntos` directamente y los
 * tests mockean esta ruta. Re-exporta la fachada; el proveedor concreto vive
 * en `./mapa`. Sin lógica de proveedor acá.
 */
export { MapaPuntos } from './mapa/MapaPuntos';
