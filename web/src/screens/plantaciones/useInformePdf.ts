import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDescarga } from '../../hooks/useDescarga';
import {
  guardarOpcionesInforme,
  leerOpcionesInforme,
  opcionesSegunObjetivo,
  SIN_OPCIONES,
  tieneObjetivo,
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

/** Guarda la elección, arma el informe y, si sale bien, cierra el modal. */
function useDescargaInforme(plantacion: Plantacion, eleccion: OpcionesInforme) {
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const descarga = useDescarga(async () => {
    guardarOpcionesInforme(eleccion);
    const opciones = opcionesSegunObjetivo(eleccion, plantacion.objetivoArboles);
    await descargarInformePdf(plantacion, queryClient, opciones);
    setAbierto(false);
    return null;
  }, MENSAJE_ERROR_INFORME);
  const mostrar = (abrir: boolean) => {
    descarga.limpiarMensaje();
    setAbierto(abrir);
  };
  return { ...descarga, abierto, mostrar };
}

/**
 * El modal del informe y su descarga. Cerrar el modal no la corta: si después
 * falla, el aviso va a la barra, como el de las otras descargas.
 */
export function useInformePdf(plantacion: Plantacion) {
  const { eleccion, alternar, recuperar } = useEleccion();
  const { abierto, mostrar, mensaje, ...descarga } = useDescargaInforme(plantacion, eleccion);
  return {
    abierto,
    abrir: () => {
      recuperar();
      mostrar(true);
    },
    cerrar: () => mostrar(false),
    opciones: opcionesSegunObjetivo(eleccion, plantacion.objetivoArboles),
    conMeta: tieneObjetivo(plantacion.objetivoArboles),
    alternar,
    generar: descarga.descargar,
    descargando: descarga.descargando,
    mensaje: abierto ? mensaje : null,
    mensajeBarra: abierto ? null : mensaje,
  };
}

export type EstadoInformePdf = ReturnType<typeof useInformePdf>;
