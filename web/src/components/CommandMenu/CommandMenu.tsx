import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { listarPlantaciones } from '../../queries/plantationQueries';
import type { ResultadoBusqueda } from '../../queries/buscarQueries';
import { useCommandMenu } from '../../hooks/useCommandMenu';
import { Input } from '../Input';
import { accionesRapidas, filtrarAcciones } from './accionesRapidas';
import { construirItems, destinoDeItem, type ItemPaleta } from './construirItems';
import { sugerencias } from './sugerencias';
import { FilaPaleta } from './FilaPaleta';
import { useFocusTrap } from './useFocusTrap';
import { useNavegacionTeclado } from './useNavegacionTeclado';
import { useResultadosBusqueda } from './useResultadosBusqueda';
import styles from './CommandMenu.module.css';

/** Devuelve el foco al elemento que abrió la paleta (el trigger) al cerrar. */
function useDevolverFoco(abierto: boolean) {
  const previo = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (abierto) {
      previo.current = document.activeElement as HTMLElement | null;
      return;
    }
    previo.current?.focus?.();
  }, [abierto]);
}

export function CommandMenu() {
  const { abierto, cerrar, scope, limpiarScope, recientes, registrarReciente } = useCommandMenu();
  const navigate = useNavigate();
  const [texto, setTexto] = useState('');
  const refInput = useRef<HTMLInputElement>(null);
  const refDialog = useRef<HTMLDivElement>(null);
  const idListbox = useId();
  const idOpcion = (indice: number) => `${idListbox}-opt-${indice}`;
  const atraparFoco = useFocusTrap(refDialog);
  useDevolverFoco(abierto);

  useEffect(() => {
    if (abierto) {
      setTexto('');
      refInput.current?.focus();
    }
  }, [abierto]);

  const resultados = useResultadosBusqueda(texto, scope ?? undefined);
  const { data: plantaciones } = useQuery({
    queryKey: ['plantaciones'],
    queryFn: listarPlantaciones,
  });

  const hayTexto = texto.trim().length > 0;
  const acciones = useMemo(() => filtrarAcciones(accionesRapidas(scope), texto), [scope, texto]);
  const recientesYSugerencias = useMemo<ResultadoBusqueda[]>(
    () => (recientes.length > 0 ? recientes : sugerencias(plantaciones ?? [])),
    [recientes, plantaciones],
  );
  const { secciones, itemsPlanos } = useMemo(
    () =>
      construirItems({
        acciones,
        resultados,
        recientes: recientesYSugerencias,
        hayTexto,
      }),
    [acciones, resultados, recientesYSugerencias, hayTexto],
  );

  const elegir = (item: ItemPaleta) => {
    if (item.clase === 'resultado') registrarReciente(item.resultado);
    navigate(destinoDeItem(item));
    cerrar();
  };
  const { resaltado, setResaltado, refLista, alPresionar } = useNavegacionTeclado(
    itemsPlanos.length,
    (indice) => elegir(itemsPlanos[indice]),
  );

  if (!abierto) return null;

  const tituloVacio = recientes.length > 0 ? 'Recientes' : 'Sugerencias';

  return createPortal(
    <div className={styles.overlay} onClick={cerrar}>
      <div
        ref={refDialog}
        role="dialog"
        aria-modal="true"
        aria-label="Buscar"
        className={styles.dialog}
        onClick={(evento) => evento.stopPropagation()}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') cerrar();
          else if (evento.key === 'Tab') atraparFoco(evento);
          else alPresionar(evento);
        }}
      >
        <div className={styles.cabecera}>
          {scope && (
            <button type="button" className={styles.chipScope} onClick={limpiarScope}>
              en {scope.etiqueta || 'plantación'}
              <X size={12} aria-hidden />
            </button>
          )}
          <Input
            ref={refInput}
            label="Buscar"
            labelOculto
            placeholder="Buscar plantaciones, árboles, especies…"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            autoComplete="off"
            role="combobox"
            aria-expanded
            aria-controls={idListbox}
            aria-activedescendant={itemsPlanos.length > 0 ? idOpcion(resaltado) : undefined}
          />
        </div>

        <div
          id={idListbox}
          role="listbox"
          aria-label="Resultados"
          className={styles.lista}
          ref={refLista}
        >
          {!hayTexto && <p className={styles.overline}>{tituloVacio}</p>}
          {secciones.map((seccion) => (
            <div key={seccion.clave} className={styles.seccion}>
              <p className={styles.overline}>{seccion.titulo}</p>
              {seccion.items.map(({ item, indice }) => (
                <FilaPaleta
                  key={`${seccion.clave}-${indice}`}
                  id={idOpcion(indice)}
                  item={item}
                  resaltado={indice === resaltado}
                  onElegir={() => elegir(item)}
                  onResaltar={() => setResaltado(indice)}
                />
              ))}
            </div>
          ))}
          {itemsPlanos.length === 0 && (
            <p className={styles.vacio}>Sin resultados para “{texto}”.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
