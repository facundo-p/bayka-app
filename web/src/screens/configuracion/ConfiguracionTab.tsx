import { useIdPlantacion } from '../../hooks/useIdPlantacion';
import { usePlantacion } from '../../hooks/usePlantacion';
import { esArchivada } from '../../queries/plantationQueries';
import { ComportamientoConfigSection } from './ComportamientoConfigSection';
import { EspeciesConfigSection } from './EspeciesConfigSection';
import { UsuariosConfigSection } from './UsuariosConfigSection';
import styles from './ConfiguracionTab.module.css';

/**
 * Tab Configuración: el checklist de especies ocupa el alto completo a la
 * izquierda; comportamiento en la app y técnicos se apilan a la derecha.
 * Colapsa a una columna en angosto. En una plantación archivada todos los
 * controles quedan deshabilitados (#477); el aviso lo muestra el detalle.
 */
export function ConfiguracionTab() {
  const { data: plantacion } = usePlantacion(useIdPlantacion());
  return (
    <fieldset className={styles.grilla} disabled={plantacion ? esArchivada(plantacion) : false}>
      <EspeciesConfigSection />
      <div className={styles.columnaDerecha}>
        <ComportamientoConfigSection />
        <UsuariosConfigSection />
      </div>
    </fieldset>
  );
}
