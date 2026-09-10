import { describe, expect, it, vi } from 'vitest';
import type { FilaDemo } from '../datos';
import { supabase } from '../supabase';
import { listarPlantacionesDeEspecie } from '../../queries/especieQueries';

// Como en `dev:demo`: la query real corre contra el cliente falso.
vi.mock('../../lib/supabase', () => import('../supabase'));

describe('cliente demo: selects con embebidos', () => {
  it('resuelve el embebido many-to-one por su FK', async () => {
    const { data } = await supabase
      .from('plantation_species')
      .select('plantation_id, plantations(id, lugar)')
      .eq('species_id', 's1');

    const lugares = (data as FilaDemo[]).map((fila) => (fila.plantations as FilaDemo).lugar);
    expect(lugares).toEqual(['San Sebastián', 'Estancia La Escondida', 'Campo Los Molles']);
  });

  it('resuelve embebidos anidados y con hint', async () => {
    const { data } = await supabase
      .from('trees')
      .select('id, groups!inner(nombre, plantations(lugar), parcelas(codigo))')
      .eq('id', 't1')
      .single();

    expect((data as FilaDemo).groups).toMatchObject({
      nombre: 'Línea 10',
      plantations: { lugar: 'San Sebastián' },
      parcelas: { codigo: 'LP12' },
    });
  });

  it('no agrega un embebido sin FK modelada', async () => {
    const { data } = await supabase.from('plantations').select('id, groups(id)').eq('id', 'p1').single();

    expect(data).not.toHaveProperty('groups');
  });

  it('el panel de especie recibe el nombre de cada plantación', async () => {
    const plantaciones = await listarPlantacionesDeEspecie('s1');

    expect(plantaciones.map((plantacion) => plantacion.nombre).sort()).toEqual([
      'Campo Los Molles',
      'Estancia La Escondida',
      'San Sebastián',
    ]);
  });
});
