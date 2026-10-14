import { ESTILO_BOTONERA_ORIGINAL, type EstiloBotonera } from '../../constants/estiloBotonera';
import { leerEstiloBotonera } from '../../utils/estiloBotonera';
import { crearPreferencia, preferenciaFija, type Preferencia } from './preferencia';

const porUsuario = new Map<string, Preferencia<EstiloBotonera>>();

const SIN_USUARIO = preferenciaFija<EstiloBotonera>(ESTILO_BOTONERA_ORIGINAL);

/**
 * Tamaño y orden de la botonera (#744): de cada usuario en este dispositivo, para todas sus
 * plantaciones. Sin usuario todavía es el diseño original y no se guarda.
 */
export function preferenciaEstiloBotonera(userId: string | null): Preferencia<EstiloBotonera> {
  if (!userId) return SIN_USUARIO;
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
