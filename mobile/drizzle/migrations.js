// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_peaceful_winter_soldier.sql';
import m0001 from './0001_noisy_triton.sql';
import m0002 from './0002_overrated_revanche.sql';
import m0003 from './0003_closed_zuras.sql';
import m0004 from './0004_species_uuid_migration.sql';
import m0005 from './0005_user_species_order.sql';
import m0006 from './0006_add_pending_sync.sql';
import m0007 from './0007_add_pending_edit.sql';
import m0008 from './0008_add_foto_synced.sql';
import m0009 from './0009_add_subgroup_pending_sync.sql';
import m0010 from './0010_add_tree_conflict_columns.sql';
import m0011 from './0011_groups_parcelas_migration.sql';
import m0012 from './0012_parcelas_deleted_at.sql';
import m0013 from './0013_parcelas_partial_unique_indexes.sql';
import m0014 from './0014_groups_tipo_parcela_to_bosquete.sql';
import m0015 from './0015_gps_capture.sql';
import m0016 from './0016_gps_config_server_snapshot.sql';
import m0017 from './0017_plantations_visible_in_app.sql';
import m0018 from './0018_groups_parcela_id_not_null.sql';
import m0019 from './0019_plantations_photo_capture_all_trees.sql';
import m0020 from './0020_indices_de_sync.sql';
import m0021 from './0021_borrados_pendientes.sql';
import m0022 from './0022_plantations_archivada_en.sql';
import m0023 from './0023_plantations_eliminada_en_servidor_en.sql';
import m0024 from './0024_plantations_campos_editables.sql';
import m0025 from './0025_plantations_edicion_por_campo.sql';
import m0026 from './0026_cambios_especies_pendientes.sql';
import m0027 from './0027_tecnicos_offline.sql';
import m0028 from './0028_plantations_motivo_varado.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007,
m0008,
m0009,
m0010,
m0011,
m0012,
m0013,
m0014,
m0015,
m0016,
m0017,
m0018,
m0019,
m0020,
m0021,
m0022,
m0023,
m0024,
m0025,
m0026,
m0027,
m0028
    }
  }
