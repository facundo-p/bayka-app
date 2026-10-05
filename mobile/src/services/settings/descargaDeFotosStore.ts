import { crearPreferenciaBooleana } from './preferencia';

/**
 * "Descargar fotos de otros celulares" (#565). La subida de las fotos sacadas en
 * este celular no es configurable.
 *
 * Hereda el valor del viejo "Incluir fotos" del modal de sincronización: apagado
 * cortaba subida y bajada, y quien lo apagó no quería llenar el celular ni gastar
 * datos bajando fotos.
 */
export const preferenciaDescargaDeFotos = crearPreferenciaBooleana({
  clave: 'descargar_fotos_de_otros',
  porDefecto: true,
  claveAnterior: 'sync_include_photos',
});
