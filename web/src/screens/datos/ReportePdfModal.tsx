import { useId } from 'react';
import { Aviso, Button, Modal, SegmentedControl, Spinner } from '../../components';
import { BarraProgreso } from '../../components/BarraProgreso';
import { ResultadoConfirmacion } from '../../components/ConfirmarModal';
import { AccionesModal, ErrorEnvio } from '../../components/FormularioModal';
import { MODO_REPORTE } from '../../pdf/reporte/planReporte';
import { ETAPA_REPORTE, type ProgresoReporte } from '../../services/pdfReporte';
import {
  porcentajeDeFotos,
  TEXTO_REPORTE_PDF as TEXTO,
  textoAvisoTope,
  textoEstimacion,
  textoFotosFallidas,
  textoProgreso,
  textoResumenConteo,
  textoTarjetas,
} from './textosReportePdf';
import { FASE_REPORTE, type EstadoReportePdf } from './useReportePdf';
import formulario from '../../components/Formulario.module.css';
import styles from './ReportePdfModal.module.css';

type ConReporte = { reporte: EstadoReportePdf };

/** «Con fotos» se apaga sin árboles con foto: el sublabel dice por qué. */
function OpcionesModo({ reporte }: ConReporte) {
  const idRotulo = useId();
  const tarjetas = reporte.tarjetasConFotos ?? 0;
  const opciones = [
    {
      value: MODO_REPORTE.conFotos,
      label: TEXTO.conFotos,
      sublabel: textoTarjetas(tarjetas),
      disabled: tarjetas === 0,
    },
    { value: MODO_REPORTE.sinFotos, label: TEXTO.sinFotos, sublabel: TEXTO.sublabelSinFotos },
  ];
  return (
    <div className={styles.modo}>
      <span id={idRotulo} className={styles.rotulo}>
        {TEXTO.grupoModo}
      </span>
      <SegmentedControl
        options={opciones}
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
      <p className={formulario.errorEnvio}>{TEXTO.errorConteo}</p>
      <Button variant="secondary" size="sm" onClick={reintentar}>
        {TEXTO.reintentar}
      </Button>
    </div>
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
  const aviso = reporte.modo === MODO_REPORTE.conFotos && textoAvisoTope(conteo.data.conFoto);
  return (
    <>
      <p className={formulario.info}>{textoResumenConteo(conteo.data)}</p>
      <OpcionesModo reporte={reporte} />
      {aviso && <Aviso>{aviso}</Aviso>}
      <p className={styles.estimacion}>{textoEstimacion(estimacion, peso)}</p>
    </>
  );
}

function Eleccion({ reporte, error }: ConReporte & { error: string | null }) {
  const sinArboles = !reporte.conteo.data || reporte.conteo.data.total === 0;
  return (
    <>
      <p className={formulario.info}>{TEXTO.descripcion}</p>
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
        <p className={styles.renglon} role="status">
          {porcentaje === null && <Spinner size="sm" />}
          {textoProgreso(progreso)}
        </p>
        {porcentaje !== null && <BarraProgreso porcentaje={porcentaje} alto="md" />}
        {progreso.etapa === ETAPA_REPORTE.armandoPdf && (
          <p className={formulario.info}>{TEXTO.armandoDetalle}</p>
        )}
      </div>
      <AccionesModal onCancelar={reporte.cerrar} cancelarDeshabilitado={!reporte.cancelable}>
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

/** Reporte PDF de todos los árboles del filtro: elegir con o sin fotos, generar y bajar. */
export function ReportePdfModal({ reporte }: ConReporte) {
  return (
    <Modal open={reporte.abierto} title={TEXTO.titulo} onClose={reporte.cerrar}>
      <div className={formulario.form}>
        <Contenido reporte={reporte} />
      </div>
    </Modal>
  );
}
