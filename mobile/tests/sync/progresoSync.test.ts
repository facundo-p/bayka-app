/**
 * El sync no se trababa: dejaba de informar durante minutos en las fases largas
 * (#447). Estos tests fijan que cada fase emita progreso, porque el síntoma es
 * invisible desde los tests de resultado: la sync terminaba bien igual.
 */
import { fetchAllRows } from '../../src/services/sync/paginate';

describe('fetchAllRows · progreso de paginación', () => {
  /** Query paginada falsa: devuelve `paginas` sucesivas de a 1000 filas. */
  function queryDe(paginas: number[]) {
    let llamada = 0;
    return () => ({
      range: async () => {
        const filas = paginas[llamada++] ?? 0;
        return { data: Array.from({ length: filas }, (_, i) => ({ i })), error: null };
      },
    });
  }

  it('reporta filas descargadas en cada página, no solo al final', async () => {
    const reportado: number[] = [];

    await fetchAllRows(queryDe([1000, 1000, 250]), (filas) => reportado.push(filas));

    expect(reportado).toEqual([1000, 2000, 2250]);
  });

  it('sin callback no rompe', async () => {
    const { data } = await fetchAllRows<{ i: number }>(queryDe([5]));
    expect(data).toHaveLength(5);
  });

  it('no reporta nada si la primera página falla', async () => {
    const reportado: number[] = [];
    const conError = () => ({ range: async () => ({ data: null, error: { message: 'sin red' } }) });

    const { error } = await fetchAllRows(conError, (filas) => reportado.push(filas));

    expect(error).toBeTruthy();
    expect(reportado).toEqual([]);
  });
});

