import { Input } from '../Input';
import { FilaOpcion } from './FilaOpcion';
import type { Desplegable } from './useDesplegable';
import styles from './SelectConDetalle.module.css';

export interface TextosLista {
  label: string;
  placeholderBusqueda: string;
  /** Cuando no hay ninguna opción. */
  textoVacio: string;
  /** Cuando la búsqueda no coincide con ninguna opción. */
  textoSinCoincidencias: string;
}

interface ListaOpcionesProps {
  desplegable: Desplegable;
  textos: TextosLista;
}

function Buscador({ desplegable, placeholder }: { desplegable: Desplegable; placeholder: string }) {
  return (
    <div className={styles.cabecera}>
      <Input
        label={placeholder}
        labelOculto
        type="search"
        autoComplete="off"
        autoFocus
        {...desplegable.listbox.propsBuscador()}
        className={styles.busqueda}
        placeholder={placeholder}
        value={desplegable.busqueda}
        onChange={(evento) => desplegable.setBusqueda(evento.target.value)}
        onKeyDown={desplegable.alTeclearBuscador}
      />
    </div>
  );
}

function Opciones({ desplegable, label }: { desplegable: Desplegable; label: string }) {
  const { listbox } = desplegable;
  return (
    <div {...listbox.propsLista()} aria-label={label} className={styles.lista}>
      {desplegable.filtradas.map((opcion, indice) => (
        <FilaOpcion
          key={opcion.valor}
          opcion={opcion}
          elegida={desplegable.esElegida(opcion)}
          propsOpcion={listbox.propsOpcion(indice)}
          onElegir={() => desplegable.elegir(indice)}
        />
      ))}
    </div>
  );
}

export function ListaOpciones({ desplegable, textos }: ListaOpcionesProps) {
  const mensajeVacio = desplegable.sinOpciones ? textos.textoVacio : textos.textoSinCoincidencias;
  return (
    <>
      <Buscador desplegable={desplegable} placeholder={textos.placeholderBusqueda} />
      <Opciones desplegable={desplegable} label={textos.label} />
      {desplegable.filtradas.length === 0 && <p className={styles.vacio}>{mensajeVacio}</p>}
    </>
  );
}
