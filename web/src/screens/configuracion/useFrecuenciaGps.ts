import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useInvalidarConListado } from '../../hooks/useInvalidarConListado';
import { mensajeErrorConocido } from '../../lib/mensajeErrorConocido';
import { TECLA } from '../../lib/teclas';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import type { Plantacion } from '../../queries/plantationQueries';
import {
  actualizarConfigGps,
  MENSAJE_GPS_SIN_MIGRACION,
} from '../../repositories/plantationRepository';

/** Presets de frecuencia (cada cuántos árboles se toma un punto GPS). */
export const PRESETS_FRECUENCIA = [1, 5, 10, 20] as const;

/** value del segmentado cuando la frecuencia no es un preset (ninguno activo). */
const SIN_PRESET = -1;

const ERROR_GUARDAR = 'No se pudo guardar la configuración GPS.';

type ConfigGps = { frecuencia: number; obligatoria: boolean };

function esFrecuenciaValida(valor: number): boolean {
  return Number.isInteger(valor) && valor >= 1;
}

function presetDe(frecuencia: number): number {
  return (PRESETS_FRECUENCIA as readonly number[]).includes(frecuencia) ? frecuencia : SIN_PRESET;
}

function configInicial(plantacion: Plantacion): ConfigGps {
  return { frecuencia: plantacion.gpsCaptureFrequency, obligatoria: plantacion.gpsCaptureRequired };
}

function useGuardarConfigGps(plantationId: string) {
  const invalidar = useInvalidarConListado(CLAVE_QUERY.plantacion(plantationId));
  const mutacion = useMutation({
    mutationFn: (config: ConfigGps) => actualizarConfigGps(plantationId, config),
    onSuccess: invalidar,
  });
  const mensajeError = mensajeErrorConocido(
    mutacion.error,
    MENSAJE_GPS_SIN_MIGRACION,
    ERROR_GUARDAR,
  );
  return { guardar: mutacion.mutate, guardando: mutacion.isPending, mensajeError };
}

/**
 * Props del input "o exacto". Guarda una sola vez al confirmar (blur o Enter),
 * no en cada tecla: mientras se escribe vive un borrador, y un valor inválido
 * al confirmar no llega a la base y el campo vuelve a la frecuencia vigente.
 */
export function useCampoExacto(frecuencia: number, aplicar: (valor: number) => void) {
  const [borrador, setBorrador] = useState<string | null>(null);
  const value = borrador ?? String(frecuencia);
  const confirmar = () => {
    const valor = Number(value.trim());
    setBorrador(null);
    if (esFrecuenciaValida(valor)) aplicar(valor);
  };
  const onKeyDown = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key !== TECLA.enter) return;
    evento.preventDefault();
    confirmar();
  };
  const onChange = (evento: ChangeEvent<HTMLInputElement>) => setBorrador(evento.target.value);
  return { value, onChange, onBlur: confirmar, onKeyDown };
}

/** Obligatoriedad y frecuencia comparten payload: cada cambio guarda las dos. */
export function useFrecuenciaGps(plantacion: Plantacion) {
  const [config, setConfig] = useState(() => configInicial(plantacion));
  const { guardar, ...guardado } = useGuardarConfigGps(plantacion.id);
  const aplicar = (cambios: Partial<ConfigGps>) => {
    const proxima = { ...config, ...cambios };
    setConfig(proxima);
    guardar(proxima);
  };
  const presetActivo = presetDe(config.frecuencia);
  return {
    ...guardado,
    ...config,
    presetActivo,
    exactoActivo: presetActivo === SIN_PRESET,
    aplicarFrecuencia: (frecuencia: number) => aplicar({ frecuencia }),
    aplicarObligatoria: (obligatoria: boolean) => aplicar({ obligatoria }),
  };
}
