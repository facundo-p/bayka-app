import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDescarga } from '../../hooks/useDescarga';
import {
  guardarOpcionesInforme,
  leerOpcionesInforme,
  opcionBloqueada,
  opcionesSegunObjetivo,
  SIN_OPCIONES,
  type OpcionInforme,
  type OpcionesInforme,
} from '../../lib/opcionesInforme';
import type { Plantacion } from '../../queries/plantationQueries';
import { descargarInformePdf } from '../../services/pdfInforme';

const MENSAJE_ERROR_INFORME = 'No se pudo generar el informe PDF.';

/** Las casillas como las dejó el usuario: la meta se recuerda aunque esta plantación no tenga. */
function useEleccion() {
  const [eleccion, setEleccion] = useState<OpcionesInforme>(SIN_OPCIONES);
  const alternar = (opcion: OpcionInforme) =>
    setEleccion((previa) => ({ ...previa, [opcion]: !previa[opcion] }));
  const recuperar = () => setEleccion(leerOpcionesInforme());
  return { eleccion, alternar, recuperar };
}

/**
 * Guarda la elección, arma el informe y, si sale bien, cierra el modal. Mientras
 * genera, el modal no se cierra: el render no se puede cortar y el PDF se bajaría igual.
 */
function useDescargaInforme(
  plantacion: Plantacion,
  eleccion: OpcionesInforme,
  opciones: OpcionesInforme,
) {
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const descarga = useDescarga(async () => {
    guardarOpcionesInforme(eleccion);
    await descargarInformePdf(plantacion, queryClient, opciones);
    setAbierto(false);
    return null;
  }, MENSAJE_ERROR_INFORME);
  const mostrar = (abrir: boolean) => {
    if (descarga.descargando) return;
    descarga.limpiarMensaje();
    setAbierto(abrir);
  };
  return { ...descarga, abierto, mostrar };
}

/** El modal del informe y su descarga. */
export function useInformePdf(plantacion: Plantacion) {
  const { eleccion, alternar, recuperar } = useEleccion();
  const opciones = opcionesSegunObjetivo(eleccion, plantacion.objetivoArboles);
  const descarga = useDescargaInforme(plantacion, eleccion, opciones);
  return {
    abierto: descarga.abierto,
    abrir: () => {
      recuperar();
      descarga.mostrar(true);
    },
    cerrar: () => descarga.mostrar(false),
    opciones,
    bloqueada: (opcion: OpcionInforme) => opcionBloqueada(opcion, plantacion.objetivoArboles),
    alternar,
    generar: descarga.descargar,
    descargando: descarga.descargando,
    mensaje: descarga.mensaje,
  };
}

export type EstadoInformePdf = ReturnType<typeof useInformePdf>;
