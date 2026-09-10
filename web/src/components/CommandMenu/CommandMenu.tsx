import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { listarPlantaciones } from '../../queries/plantationQueries';
import type { ResultadoBusqueda } from '../../queries/buscarQueries';
import { useCommandMenu } from '../../hooks/useCommandMenu';
import { useListboxNavegable } from '../../hooks/useListboxNavegable';
import { TECLA } from '../../lib/teclas';
import { Input } from '../Input';
import { accionesRapidas, filtrarAcciones } from './accionesRapidas';
import { construirItems, destinoDeItem, type ItemPaleta } from './construirItems';
import { sugerencias } from './sugerencias';
import { FilaPaleta } from './FilaPaleta';
import { useFocusTrap } from './useFocusTrap';
import { useResultadosBusqueda } from './useResultadosBusqueda';
import { TAMANO_ICONO } from '../../theme/iconos';
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
    queryKey: CLAVE_QUERY.plantaciones(),
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
  const listbox = useListboxNavegable(itemsPlanos.length, (indice) => elegir(itemsPlanos[indice]));

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
          if (evento.key === TECLA.escape) cerrar();
          else if (evento.key === TECLA.tab) atraparFoco(evento);
          else listbox.alPresionar(evento);
        }}
      >
        <div className={styles.cabecera}>
          {scope && (
            <button type="button" className={styles.chipScope} onClick={limpiarScope}>
              en {scope.etiqueta || 'plantación'}
              <X size={TAMANO_ICONO.xs} aria-hidden />
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
            {...listbox.propsBuscador()}
          />
        </div>

        <div {...listbox.propsLista()} aria-label="Resultados" className={styles.lista}>
          {!hayTexto && <p className={styles.overline}>{tituloVacio}</p>}
          {secciones.map((seccion) => (
            <div key={seccion.clave} className={styles.seccion}>
              <p className={styles.overline}>{seccion.titulo}</p>
              {seccion.items.map(({ item, indice }) => (
                <FilaPaleta
                  key={`${seccion.clave}-${indice}`}
                  item={item}
                  propsOpcion={listbox.propsOpcion(indice)}
                  onElegir={() => elegir(item)}
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
