export const ALBUM_GALERIA = 'Bayka';

export const RESULTADO_FOTO = {
  guardada: 'guardada',
  compartida: 'compartida',
  sinPermiso: 'sin-permiso',
  sinConexion: 'sin-conexion',
  descargaFallida: 'descarga-fallida',
  sinArbol: 'sin-arbol',
  error: 'error',
} as const;
export type ResultadoFoto = (typeof RESULTADO_FOTO)[keyof typeof RESULTADO_FOTO];
