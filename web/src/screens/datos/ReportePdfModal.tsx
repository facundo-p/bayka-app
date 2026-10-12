import { useEffect, useId, useRef } from 'react';
import { Aviso, Button, Modal, SegmentedControl, Spinner } from '../../components';
import { BarraProgreso } from '../../components/BarraProgreso';
import { ResultadoConfirmacion } from '../../components/ConfirmarModal';
import { AccionesModal, ErrorEnvio } from '../../components/FormularioModal';
import { MODO_REPORTE, type EstimacionReporte } from '../../pdf/reporte/planReporte';
import type { ConteoDelFiltro } from '../../queries/dataExplorerQueries';
import { ETAPA_REPORTE, type ProgresoReporte } from '../../services/pdfReporte';
import {
  porcentajeDeFotos,
  TEXTO_REPORTE_PDF as TEXTO,
  textoAvisoTope,
  textoEstimacion,
  textoEtapa,
  textoFotosFallidas,
  textoProgreso,
  textoResumenConteo,
  textoTarjetas,
} from './textosReportePdf';
import { FASE_REPORTE, type EstadoReporte, type EstadoReportePdf } from './useReportePdf';
import styles from './ReportePdfModal.module.css';

type ConReporte = { reporte: EstadoReportePdf };

/** «Con fotos» se apaga sin árboles con foto: el sublabel dice por qué. */
function opcionesDeModo(tarjetas: number) {
  return [
    {
      value: MODO_REPORTE.conFotos,
      label: TEXTO.conFotos,
      sublabel: textoTarjetas(tarjetas),
      disabled: tarjetas === 0,
    },
    { value: MODO_REPORTE.sinFotos, label: TEXTO.sinFotos, sublabel: TEXTO.sublabelSinFotos },
  ];
}

function OpcionesModo({ reporte }: ConReporte) {
  const idRotulo = useId();
  return (
    <div className={styles.modo}>
      <span id={idRotulo} className={styles.rotulo}>
        {TEXTO.grupoModo}
      </span>
      <SegmentedControl
        options={opcionesDeModo(reporte.tarjetasConFotos ?? 0)}
        value={reporte.modo}
        onChange={reporte.elegir}
        aria-labelledby={idRotulo}
      />
    </div>
  );
}

function ConteoFallido({ reintentar }: { reintentar: () => void }) {
  return (
    <div className={styles.renglon} role="alert">
      <p className={styles.errorConteo}>{TEXTO.errorConteo}</p>
      <Button variant="secondary" size="sm" onClick={reintentar}>
        {TEXTO.reintentar}
      </Button>
    </div>
  );
}

type Calculo = { conteo: ConteoDelFiltro; estimacion: EstimacionReporte; peso: number };

/** El aviso del tope solo vale con fotos: sin fotos no hay tarjetas que topear. */
function ResumenDelFiltro({ reporte, calculo }: ConReporte & { calculo: Calculo }) {
  const { conteo, estimacion, peso } = calculo;
  const aviso = reporte.modo === MODO_REPORTE.conFotos && textoAvisoTope(conteo.conFoto);
  return (
    <>
      <p className={styles.info}>{textoResumenConteo(conteo)}</p>
      <OpcionesModo reporte={reporte} />
      {aviso && <Aviso>{aviso}</Aviso>}
      <p className={styles.estimacion}>{textoEstimacion(estimacion, peso)}</p>
    </>
  );
}

function DatosDelFiltro({ reporte }: ConReporte) {
  const { conteo, estimacion, peso } = reporte;
  if (conteo.isError) return <ConteoFallido reintentar={() => void conteo.refetch()} />;
  if (!conteo.data || !estimacion || peso === undefined) {
    return (
      <p className={styles.renglon}>
        <Spinner size="sm" />
        {TEXTO.contando}
      </p>
    );
  }
  return <ResumenDelFiltro reporte={reporte} calculo={{ conteo: conteo.data, estimacion, peso }} />;
}

function Eleccion({ reporte, error }: ConReporte & { error: string | null }) {
  const sinArboles = !reporte.conteo.data || reporte.conteo.data.total === 0;
  return (
    <>
      <p className={styles.info}>{TEXTO.descripcion}</p>
      <DatosDelFiltro reporte={reporte} />
      <ErrorEnvio mensaje={error} />
      <AccionesModal onCancelar={reporte.cerrar}>
        <Button disabled={sinArboles} onClick={reporte.generar}>
          {TEXTO.generar}
        </Button>
      </AccionesModal>
    </>
  );
}

/** Solo la bajada de fotos tiene barra; leer y armar no avisan cuánto falta. */
function Progreso({ reporte, progreso }: ConReporte & { progreso: ProgresoReporte }) {
  const porcentaje = porcentajeDeFotos(progreso);
  return (
    <>
      <div className={styles.progreso}>
        <p className={styles.renglon}>
          {porcentaje === null && <Spinner size="sm" />}
          {textoProgreso(progreso)}
        </p>
        {porcentaje !== null && (
          <BarraProgreso porcentaje={porcentaje} alto="md" nombre={TEXTO.barraFotos} />
        )}
        {progreso.etapa === ETAPA_REPORTE.armandoPdf && (
          <p className={styles.info}>{TEXTO.armandoDetalle}</p>
        )}
      </div>
      <AccionesModal onCancelar={reporte.cerrar}>
        <Button loading>{TEXTO.generando}</Button>
      </AccionesModal>
    </>
  );
}

function Contenido({ reporte }: ConReporte) {
  const { estado } = reporte;
  switch (estado.fase) {
    case FASE_REPORTE.eligiendo:
      return <Eleccion reporte={reporte} error={estado.error} />;
    case FASE_REPORTE.generando:
      return <Progreso reporte={reporte} progreso={estado.progreso} />;
    case FASE_REPORTE.terminado:
      return (
        <ResultadoConfirmacion
          texto={textoFotosFallidas(estado.fotosFallidas)}
          onClose={reporte.cerrar}
        />
      );
  }
}

/**
 * Montada desde que abre el modal: una región que aparece junto con su texto
 * no siempre se anuncia. El contador de fotos queda a la vista, sin anunciarse.
 */
function AnuncioDeEtapa({ estado }: { estado: EstadoReporte }) {
  const progreso = estado.fase === FASE_REPORTE.generando ? estado.progreso : null;
  return (
    <p className={styles.anuncio} role="status">
      {textoEtapa(progreso)}
    </p>
  );
}

/**
 * Al cambiar de fase se desmonta el control que tenía el foco («Generar PDF»,
 * «Cancelar»): sin esto caería al body, fuera del modal.
 */
function useFocoAlCambiarDeFase(fase: EstadoReporte['fase']) {
  const cuerpo = useRef<HTMLDivElement>(null);
  const anterior = useRef(fase);
  useEffect(() => {
    if (fase === anterior.current) return;
    anterior.current = fase;
    cuerpo.current?.focus();
  }, [fase]);
  return cuerpo;
}

/** Reporte PDF de todos los árboles del filtro: elegir con o sin fotos, generar y bajar. */
export function ReportePdfModal({ reporte }: ConReporte) {
  const cuerpo = useFocoAlCambiarDeFase(reporte.estado.fase);
  return (
    <Modal open={reporte.abierto} title={TEXTO.titulo} onClose={reporte.cerrar}>
      <div ref={cuerpo} tabIndex={-1} className={styles.cuerpo}>
        <AnuncioDeEtapa estado={reporte.estado} />
        <Contenido reporte={reporte} />
      </div>
    </Modal>
  );
}
