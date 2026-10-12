import { FileDown } from 'lucide-react';
import { Button } from '../../components';
import { TAMANO_ICONO } from '../../theme/iconos';
import { ReportePdfModal } from './ReportePdfModal';
import { TEXTO_REPORTE_PDF } from './textosReportePdf';
import { useReportePdf, type ReportePdfProps } from './useReportePdf';
import styles from './BotonReportePdf.module.css';

interface BotonProps {
  deshabilitado: boolean;
  onClick?: () => void;
}

function Boton({ deshabilitado, onClick }: BotonProps) {
  return (
    <Button
      variant="contorno"
      size="sm"
      className={styles.boton}
      disabled={deshabilitado}
      title={TEXTO_REPORTE_PDF.botonDescripcion}
      onClick={onClick}
    >
      <FileDown size={TAMANO_ICONO.md} aria-hidden />
      <span className={styles.etiqueta}>{TEXTO_REPORTE_PDF.boton}</span>
    </Button>
  );
}

type ReportePdfConBotonProps = ReportePdfProps & { hayArboles: boolean };

function ReportePdfConBoton({ hayArboles, ...props }: ReportePdfConBotonProps) {
  const reporte = useReportePdf(props);
  return (
    <>
      <Boton deshabilitado={!hayArboles} onClick={reporte.abrir} />
      <ReportePdfModal reporte={reporte} />
    </>
  );
}

type BotonReportePdfProps = Omit<ReportePdfConBotonProps, 'plantacion'> & {
  /** Sin la plantación no hay lugar ni periodo para el nombre: queda deshabilitado. */
  plantacion: ReportePdfProps['plantacion'] | null | undefined;
};

/** «Reporte PDF» de la barra de Árboles; sin árboles en el filtro no hay qué reportar. */
export function BotonReportePdf({ plantacion, ...props }: BotonReportePdfProps) {
  if (!plantacion) return <Boton deshabilitado />;
  return <ReportePdfConBoton plantacion={plantacion} {...props} />;
}
