import { useNavigate } from 'react-router';
import { useCommandMenu } from '../../hooks/useCommandMenu';
import { useListboxNavegable } from '../../hooks/useListboxNavegable';
import { destinoDeItem, esResultado, type ItemPaleta } from './construirItems';

/** Solo los resultados de entidad van a recientes: las acciones están siempre a mano. */
function useElegirItem() {
  const { cerrar, registrarReciente } = useCommandMenu();
  const navigate = useNavigate();
  return (item: ItemPaleta) => {
    if (esResultado(item)) registrarReciente(item.resultado);
    navigate(destinoDeItem(item));
    cerrar();
  };
}

/** Listbox de la paleta: Enter y el click eligen el mismo ítem. */
export function useListboxPaleta(itemsPlanos: ItemPaleta[]) {
  const elegir = useElegirItem();
  const listbox = useListboxNavegable(itemsPlanos.length, (indice) => elegir(itemsPlanos[indice]));
  return { ...listbox, elegir };
}

export type ListboxPaleta = ReturnType<typeof useListboxPaleta>;
