import { useId } from 'react';
import { Button, Modal } from '../../components';
import { BotonCasilla } from '../../components/Casilla';
import { AccionesModal, ErrorEnvio } from '../../components/FormularioModal';
import {
  LISTA_OPCIONES_INFORME,
  OPCION_INFORME,
  type OpcionInforme,
} from '../../lib/opcionesInforme';
import type { EstadoInformePdf } from './useInformePdf';
import formulario from '../../components/Formulario.module.css';
import styles from './InformePdfModal.module.css';

const TEXTO_MODAL = {
  titulo: 'Informe PDF',
  descripcion:
    'Los árboles registrados y la distribución por especie van siempre. Elegí qué más incluir:',
  grupo: 'Qué incluir en el informe',
  generar: 'Generar informe',
  generando: 'Generando…',
  sinMeta: 'Meta no definida: se carga como «Objetivo de árboles» al editar la plantación.',
} as const;

const ETIQUETA_OPCION: Record<OpcionInforme, string> = {
  [OPCION_INFORME.meta]: 'Meta y avance',
  [OPCION_INFORME.gps]: 'Porcentaje con GPS',
  [OPCION_INFORME.foto]: 'Porcentaje con foto',
  [OPCION_INFORME.mapa]: 'Mapa de puntos GPS',
};

interface CasillaOpcionProps {
  opcion: OpcionInforme;
  informe: EstadoInformePdf;
}

/** La de meta, sin objetivo en la plantación, queda apagada y dice por qué. */
function CasillaOpcion({ opcion, informe }: CasillaOpcionProps) {
  const idMotivo = useId();
  const bloqueada = informe.bloqueada(opcion);
  return (
    <BotonCasilla
      marcada={informe.opciones[opcion]}
      aria-label={ETIQUETA_OPCION[opcion]}
      aria-describedby={bloqueada ? idMotivo : undefined}
      disabled={bloqueada || informe.descargando}
      className={styles.opcion}
      onClick={() => informe.alternar(opcion)}
    >
      <span className={styles.textos}>
        <span className={styles.etiqueta}>{ETIQUETA_OPCION[opcion]}</span>
        {bloqueada && (
          <span id={idMotivo} className={styles.motivo}>
            {TEXTO_MODAL.sinMeta}
          </span>
        )}
      </span>
    </BotonCasilla>
  );
}

/** Al tocar «Informe PDF»: qué sumar al informe antes de generarlo. */
export function InformePdfModal({ informe }: { informe: EstadoInformePdf }) {
  return (
    <Modal open title={TEXTO_MODAL.titulo} onClose={informe.cerrar}>
      <div className={formulario.form}>
        <p className={formulario.info}>{TEXTO_MODAL.descripcion}</p>
        <div role="group" aria-label={TEXTO_MODAL.grupo} className={styles.opciones}>
          {LISTA_OPCIONES_INFORME.map((opcion) => (
            <CasillaOpcion key={opcion} opcion={opcion} informe={informe} />
          ))}
        </div>
        <ErrorEnvio mensaje={informe.mensaje} />
        <AccionesModal onCancelar={informe.cerrar}>
          <Button loading={informe.descargando} onClick={() => void informe.generar()}>
            {informe.descargando ? TEXTO_MODAL.generando : TEXTO_MODAL.generar}
          </Button>
        </AccionesModal>
      </div>
    </Modal>
  );
}
