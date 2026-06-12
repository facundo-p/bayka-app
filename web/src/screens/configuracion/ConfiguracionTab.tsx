import { EspeciesConfigSection } from './EspeciesConfigSection';
import { GpsConfigSection } from './GpsConfigSection';
import { UsuariosConfigSection } from './UsuariosConfigSection';
import { VisibilidadConfigSection } from './VisibilidadConfigSection';
import styles from './ConfiguracionTab.module.css';

/** Tab Configuración del detalle de plantación: las cuatro secciones apiladas. */
export function ConfiguracionTab() {
  return (
    <div className={styles.secciones}>
      <UsuariosConfigSection />
      <EspeciesConfigSection />
      <GpsConfigSection />
      <VisibilidadConfigSection />
    </div>
  );
}
