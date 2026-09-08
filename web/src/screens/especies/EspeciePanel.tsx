import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, PanelLateral } from '../../components';
import { varsCss } from '../../lib/cssVars';
import { formatearEntero } from '../../lib/formato';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import {
  listarPlantacionesDeEspecie,
  type EspecieConCatalogoUso,
} from '../../queries/especieQueries';
import {
  CodigoEspecieDuplicadoError,
  crearEspecie,
  editarEspecie,
  MENSAJE_CODIGO_DUPLICADO,
  type EspecieInput,
} from '../../repositories/especieRepository';
import {
  aEspecieInput,
  hayErroresEspecie,
  validarEspecie,
  type ErroresEspecie,
  type EspecieFormValues,
} from '../../services/especieValidaciones';
import styles from './Especies.module.css';

/** Clave de la query del catálogo con uso (listado de la pantalla). */
const QUERY_CATALOGO = ['especies-catalogo-uso'] as const;

const MENSAJE_ERROR_GUARDADO =
  'No se pudo guardar la especie. Revisá tu conexión y probá de nuevo.';
const NOTA_CODIGO_EDICION =
  'El código es el identificador global de la especie: cambiarlo afecta su etiqueta y color en toda la app.';

function valoresIniciales(especie: EspecieConCatalogoUso | null): EspecieFormValues {
  return {
    codigo: especie?.codigo ?? '',
    nombre: especie?.nombre ?? '',
    nombreCientifico: especie?.nombreCientifico ?? '',
  };
}

/** Identidad del panel: punto de color + título + chip con el código actual. */
function CabeceraEspecie({ especie }: { especie: EspecieConCatalogoUso | null }) {
  return (
    <div className={styles.panelIdentidad}>
      <span
        className={styles.panelPunto}
        style={varsCss({ color: colorEspeciePorCodigo(especie?.codigo ?? null) })}
      />
      <h2 className={styles.panelTitulo}>{especie ? 'Editar especie' : 'Nueva especie'}</h2>
      {especie && <span className={styles.chipCodigo}>{especie.codigo}</span>}
    </div>
  );
}

/** Caja de conteos agregados de la especie (plantaciones y árboles). */
function BloqueConteos({ especie }: { especie: EspecieConCatalogoUso }) {
  return (
    <div className={styles.conteos}>
      <div className={styles.conteo}>
        <span className={styles.overline}>Plantaciones</span>
        <span className={styles.conteoValor}>{formatearEntero(especie.plantaciones)}</span>
      </div>
      <div className={styles.conteo}>
        <span className={styles.overline}>Árboles</span>
        <span className={styles.conteoValor}>{formatearEntero(especie.arboles)}</span>
      </div>
    </div>
  );
}

/** Plantaciones que habilitan la especie, con sus árboles a la derecha. */
function BloqueHabilitadaEn({ especieId }: { especieId: string }) {
  const plantaciones = useQuery({
    queryKey: ['especie-plantaciones', especieId],
    queryFn: () => listarPlantacionesDeEspecie(especieId),
  });
  if (!plantaciones.data || plantaciones.data.length === 0) return null;
  return (
    <div className={styles.bloque}>
      <span className={styles.overline}>Habilitada en</span>
      <ul className={styles.listaUso}>
        {plantaciones.data.map((plantacion) => (
          <li key={plantacion.id} className={styles.filaUso}>
            <Link to={`/plantaciones/${plantacion.id}`} className={styles.enlaceUso}>
              {plantacion.nombre}
            </Link>
            <span className={styles.numeroUso}>{formatearEntero(plantacion.arboles)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface EspeciePanelProps {
  /** Con especie es edición; con null, alta. */
  especie: EspecieConCatalogoUso | null;
  onCerrar: () => void;
}

/** Panel lateral de alta y edición de especies del catálogo global. */
export function EspeciePanel({ especie, onCerrar }: EspeciePanelProps) {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState(() => valoresIniciales(especie));
  const [errores, setErrores] = useState<ErroresEspecie>({});
  const [duplicado, setDuplicado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const editando = especie !== null;

  const mutacion = useMutation({
    mutationFn: async (input: EspecieInput) => {
      if (especie) return editarEspecie(especie.id, input);
      await crearEspecie(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_CATALOGO });
      onCerrar();
    },
    onError: (error) => {
      if (error instanceof CodigoEspecieDuplicadoError) setDuplicado(true);
      else setErrorEnvio(MENSAJE_ERROR_GUARDADO);
    },
  });

  function cambiarCampo(campo: keyof EspecieFormValues, valor: string) {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    // Al cambiar el código, el aviso de duplicado queda viejo.
    if (campo === 'codigo') setDuplicado(false);
  }

  function manejarEnvio(evento: FormEvent) {
    evento.preventDefault();
    setErrorEnvio(null);
    const nuevosErrores = validarEspecie(valores);
    setErrores(nuevosErrores);
    if (hayErroresEspecie(nuevosErrores)) return;
    mutacion.mutate(aEspecieInput(valores));
  }

  return (
    <PanelLateral
      etiqueta={editando ? 'Editar especie' : 'Nueva especie'}
      cabecera={<CabeceraEspecie especie={especie} />}
      onCerrar={onCerrar}
      pie={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-especie" size="sm" loading={mutacion.isPending}>
            {editando ? 'Guardar' : 'Crear'}
          </Button>
        </>
      }
    >
      {/* El submit vive en el pie, fuera del form: los une el atributo form. */}
      <form id="form-especie" className={styles.form} onSubmit={manejarEnvio} noValidate>
        <Input
          label="Código *"
          className={styles.campoCodigo}
          value={valores.codigo}
          error={errores.codigo}
          hint={editando ? NOTA_CODIGO_EDICION : undefined}
          onChange={(evento) => cambiarCampo('codigo', evento.target.value)}
        />
        <Input
          label="Nombre común *"
          value={valores.nombre}
          error={errores.nombre}
          onChange={(evento) => cambiarCampo('nombre', evento.target.value)}
        />
        <Input
          label="Nombre científico"
          className={styles.campoCientifico}
          value={valores.nombreCientifico}
          onChange={(evento) => cambiarCampo('nombreCientifico', evento.target.value)}
        />
        {duplicado && (
          <p className={styles.advertencia} role="status">
            {MENSAJE_CODIGO_DUPLICADO}
          </p>
        )}
        {errorEnvio && (
          <p className={styles.errorEnvio} role="alert">
            {errorEnvio}
          </p>
        )}
      </form>
      {especie && (
        <>
          <BloqueConteos especie={especie} />
          <BloqueHabilitadaEn especieId={especie.id} />
        </>
      )}
    </PanelLateral>
  );
}
