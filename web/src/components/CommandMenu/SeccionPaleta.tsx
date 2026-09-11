import type { ItemPaleta, Seccion } from './construirItems';
import { FilaPaleta } from './FilaPaleta';
import type { ListboxPaleta } from './useListboxPaleta';
import styles from './CommandMenu.module.css';

interface SeccionPaletaProps {
  seccion: Seccion;
  propsOpcion: ListboxPaleta['propsOpcion'];
  onElegir: (item: ItemPaleta) => void;
}

export function SeccionPaleta({ seccion, propsOpcion, onElegir }: SeccionPaletaProps) {
  return (
    <div className={styles.seccion}>
      <p className={styles.overline}>{seccion.titulo}</p>
      {seccion.items.map(({ item, indice }) => (
        <FilaPaleta
          key={indice}
          item={item}
          propsOpcion={propsOpcion(indice)}
          onElegir={() => onElegir(item)}
        />
      ))}
    </div>
  );
}
