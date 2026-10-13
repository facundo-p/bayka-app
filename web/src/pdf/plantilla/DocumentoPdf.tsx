import { Document } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { TEXTO_PLANTILLA, type EncabezadoPdf } from './textos';

type DocumentoPdfProps = {
  /** Nombre del documento, ej. «Informe de plantación». */
  documento: string;
  encabezado: EncabezadoPdf;
  children: ReactNode;
};

/** El archivo de marca: el visor lo titula «Documento · Lugar · Período». */
export function DocumentoPdf({ documento, encabezado, children }: DocumentoPdfProps) {
  const { separador, marca } = TEXTO_PLANTILLA;
  return (
    <Document
      title={`${documento}${separador}${encabezado.titulo}`}
      creator={marca}
      producer={marca}
    >
      {children}
    </Document>
  );
}
