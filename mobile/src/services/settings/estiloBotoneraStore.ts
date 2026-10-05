import { ESTILO_BOTONERA_ORIGINAL, type EstiloBotonera } from '../../constants/estiloBotonera';
import { leerEstiloBotonera } from '../../utils/estiloBotonera';
import { crearPreferencia, type Preferencia } from './preferencia';

const porUsuario = new Map<string, Preferencia<EstiloBotonera>>();

/** Tamaño y orden de la botonera (#744): de cada usuario en este dispositivo, para todas sus plantaciones. */
export function preferenciaEstiloBotonera(userId: string): Preferencia<EstiloBotonera> {
  let preferencia = porUsuario.get(userId);
  if (!preferencia) {
    preferencia = crearPreferencia<EstiloBotonera>({
      clave: `estilo_botonera_${userId}`,
      porDefecto: ESTILO_BOTONERA_ORIGINAL,
      leer: leerEstiloBotonera,
      escribir: (estilo) => JSON.stringify(estilo),
    });
    porUsuario.set(userId, preferencia);
  }
  return preferencia;
}

/** Solo para tests: olvida las preferencias ya creadas. */
export const __resetEstiloBotoneraStore = () => porUsuario.clear();
