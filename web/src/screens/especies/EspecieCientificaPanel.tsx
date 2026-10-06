import { useState } from 'react';
import { Microscope, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmarModal,
  Input,
  PanelBloque,
  PanelIdentidad,
  PanelLateral,
  PuntoColor,
} from '../../components';
import { useInvalidarEspecies } from '../../hooks/useInvalidarEspecies';
import type { EspecieCientificaConEspecies } from '../../queries/especieCientificaQueries';
import {
  eliminarEspecieCientifica,
  MENSAJE_NOMBRE_CIENTIFICO_DUPLICADO,
} from '../../repositories/especieCientificaRepository';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import { TAMANO_ICONO } from '../../theme/iconos';
import { sinEspecies } from './filtrosCientificas';
import { useFormularioCientifica } from './useFormularioCientifica';
import styles from './Especies.module.css';

const SIN_AGRUPADAS =
  'Todavía no agrupa ninguna especie. Se vincula desde el panel de cada especie.';
const AYUDA_ELIMINAR = 'Para eliminarla, primero desvinculá sus especies.';

function CabeceraCientifica({ cientifica }: { cientifica: EspecieCientificaConEspecies | null }) {
  return (
    <PanelIdentidad
      marca={<Microscope size={TAMANO_ICONO.lg} className={styles.marcaCientifica} aria-hidden />}
      titulo={cientifica ? 'Editar especie científica' : 'Nueva especie científica'}
    />
  );
}

/** Las especies que agrupa, con su color y su código. */
function BloqueAgrupa({ cientifica }: { cientifica: EspecieCientificaConEspecies }) {
  return (
    <PanelBloque titulo="Agrupa" contador={cientifica.especies.length}>
      {sinEspecies(cientifica) ? (
        <p className={styles.textoBloque}>{SIN_AGRUPADAS}</p>
      ) : (
        <ul className={styles.listaAgrupadas}>
          {cientifica.especies.map((especie) => (
            <li key={especie.id} className={styles.agrupada}>
              <PuntoColor color={colorEspeciePorCodigo(especie.codigo)} />
              <span className={styles.codigoAgrupada}>{especie.codigo}</span>
              {especie.nombre}
            </li>
          ))}
        </ul>
      )}
    </PanelBloque>
  );
}

interface EliminarProps {
  cientifica: EspecieCientificaConEspecies;
  onCerrar: () => void;
}

/** Solo se elimina si no agrupa ninguna especie: la base también lo exige. */
function BloqueEliminar({ cientifica, onCerrar }: EliminarProps) {
  const invalidarEspecies = useInvalidarEspecies();
  const [confirmando, setConfirmando] = useState(false);
  const enUso = !sinEspecies(cientifica);
  return (
    <PanelBloque titulo="Acciones">
      <div className={styles.acciones}>
        <Button
          type="button"
          variant="destructiva"
          size="sm"
          disabled={enUso}
          title={enUso ? AYUDA_ELIMINAR : undefined}
          onClick={() => setConfirmando(true)}
        >
          <Trash2 size={TAMANO_ICONO.md} aria-hidden />
          Eliminar
        </Button>
      </div>
      {enUso && <p className={styles.ayuda}>{AYUDA_ELIMINAR}</p>}
      {confirmando && (
        <ConfirmarModal
          titulo={`Eliminar ${cientifica.nombre}`}
          descripcion="Se borra del catálogo de especies científicas. No agrupa ninguna especie, así que ninguna cambia."
          confirmarEtiqueta="Eliminar"
          destructiva
          accion={() => eliminarEspecieCientifica(cientifica.id)}
          alCompletar={async () => {
            await invalidarEspecies();
            onCerrar();
          }}
          onClose={() => setConfirmando(false)}
        />
      )}
    </PanelBloque>
  );
}

interface EspecieCientificaPanelProps {
  /** Con especie científica es edición; con null, alta. */
  cientifica: EspecieCientificaConEspecies | null;
  onCerrar: () => void;
}

/** Panel lateral de alta y edición de especies científicas (#753). */
export function EspecieCientificaPanel({ cientifica, onCerrar }: EspecieCientificaPanelProps) {
  const formulario = useFormularioCientifica(cientifica, onCerrar);
  return (
    <PanelLateral
      etiqueta={cientifica ? 'Editar especie científica' : 'Nueva especie científica'}
      cabecera={<CabeceraCientifica cientifica={cientifica} />}
      onCerrar={onCerrar}
      pie={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-cientifica" size="sm" loading={formulario.guardando}>
            {cientifica ? 'Guardar' : 'Crear'}
          </Button>
        </>
      }
    >
      <form id="form-cientifica" className={styles.form} onSubmit={formulario.enviar} noValidate>
        <Input
          label="Nombre científico *"
          className={styles.nombreCientifico}
          value={formulario.nombre}
          error={formulario.error}
          hint={cientifica ? 'Cambiarlo lo cambia en todas las especies que agrupa.' : undefined}
          onChange={(evento) => formulario.cambiarNombre(evento.target.value)}
        />
        {formulario.duplicado && (
          <p className={styles.advertencia} role="status">
            {MENSAJE_NOMBRE_CIENTIFICO_DUPLICADO}
          </p>
        )}
        {formulario.errorEnvio && (
          <p className={styles.errorEnvio} role="alert">
            {formulario.errorEnvio}
          </p>
        )}
      </form>
      {cientifica && (
        <>
          <BloqueAgrupa cientifica={cientifica} />
          <BloqueEliminar cientifica={cientifica} onCerrar={onCerrar} />
        </>
      )}
    </PanelLateral>
  );
}
