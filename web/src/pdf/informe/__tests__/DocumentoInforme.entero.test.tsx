// @vitest-environment node
// Con el texto largo entero, en los renglones que haga falta (#883).
import { View } from '@react-pdf/renderer';
import { entradaInforme, NOMBRES_LARGOS } from '../../../test/informePdf';
import { paginasDelPdf } from '../../../test/pdfNode';
import { armarInforme, entraAlPie, hojasQueOcupa } from '../../../test/renderInforme';
import { textosConGlifosCorridos } from '../../../test/textoPdf';
import { CUERPO_HOJA } from '../../plantilla/tokens';
import { datosInforme } from '../datosInforme';
import { Leyenda } from '../DocumentoInforme';
import {
  altoEnUltimaHoja,
  altoLeyenda,
  renglonesDelFlujo,
  UBICACION_MAPA,
} from '../planificarInforme';
import type { InformeConMapa } from '../renglonesInforme';
import { BloqueEspecies, FilaIndicadores, Titulo } from '../SeccionesInforme';

vi.mock('../../plantilla/textoLargo', () => ({ CORTAR_TEXTO_LARGO: false }));

const LARGOS = { parcelas: 4, nn: 3, largos: true, codigosLargos: true } as const;

/** Los textos del usuario como salen del modelo y como quedaron en renglones. */
function textosPartidos(entrada: Parameters<typeof datosInforme>[0], modelo: InformeConMapa) {
  const datos = datosInforme(entrada);
  return [
    { original: datos.linea, renglones: modelo.linea },
    ...datos.especies.filas.map(({ titulo }, indice) => ({
      original: titulo,
      renglones: modelo.especies.filas[indice].titulo,
    })),
  ];
}

test('la línea y los nombres de especie salen enteros, en renglones que se dibujan sin apretar', async () => {
  const entrada = entradaInforme({ ...LARGOS, especies: 3 });
  const { pdf, textos, modelo } = await armarInforme(entrada);
  const apretados = textosConGlifosCorridos(pdf);
  const partidos = textosPartidos(entrada, modelo as InformeConMapa);
  expect(partidos[1].original).toBe(`LAPCOLORADO · ${NOMBRES_LARGOS[0]}`);
  // La línea y los tres nombres largos se parten; la fila de las NN entra en uno.
  expect(partidos.map(({ renglones }) => renglones.length > 1)).toEqual([
    true,
    true,
    true,
    true,
    false,
  ]);
  for (const { original, renglones } of partidos) {
    expect(renglones.join(' ')).toBe(original);
    for (const renglon of renglones) {
      expect(textos).toContain(renglon);
      expect(apretados).not.toContain(renglon);
    }
  }
  expect(textos.some((texto) => texto.endsWith('…'))).toBe(false);
});

test('un código que no entra en la leyenda se parte en renglones', async () => {
  const { pdf, textos, modelo } = await armarInforme(entradaInforme({ ...LARGOS, especies: 3 }));
  const [primero] = (modelo as InformeConMapa).mapa.leyenda;
  expect(primero.texto.length).toBeGreaterThan(1);
  expect(primero.texto.join('')).toBe('LAPCOLORADO');
  expect(textos).toEqual(expect.arrayContaining([...primero.texto]));
  expect(textosConGlifosCorridos(pdf)).toEqual(expect.not.arrayContaining([...primero.texto]));
});

/** Lo que cabe debajo, hasta el pie: con `margen` de más, no entra. */
const relleno = (alto: number, margen: number) => (
  <View style={{ height: CUERPO_HOJA.alto - alto + margen }} wrap={false} />
);

// Si el plan contara mal, el mapa podría ir al pie y no entrar, o saltar sin necesidad.
test.each([-0.5, 0.5])(
  'el alto que suma el plan es el del PDF, a %s pt del pie',
  async (margen) => {
    const { modelo } = await armarInforme(entradaInforme({ ...LARGOS, especies: 4 }));
    const alto = altoEnUltimaHoja(renglonesDelFlujo(modelo));
    const cuerpo = (
      <>
        <Titulo linea={modelo.linea} />
        <FilaIndicadores indicadores={modelo.indicadores} />
        <BloqueEspecies especies={modelo.especies} />
        {relleno(alto, margen)}
      </>
    );
    expect(await hojasQueOcupa(cuerpo)).toBe(margen < 0 ? 1 : 2);
  },
);

test.each([-0.5, 0.5])('la leyenda mide lo que dice el plan, a %s pt del pie', async (margen) => {
  const { modelo } = await armarInforme(entradaInforme({ ...LARGOS, especies: 12 }));
  const conMapa = modelo as InformeConMapa;
  const cuerpo = (
    <>
      <Leyenda items={conMapa.mapa.leyenda} />
      {relleno(altoLeyenda(conMapa), margen)}
    </>
  );
  expect(await hojasQueOcupa(cuerpo)).toBe(margen < 0 ? 1 : 2);
});

// Con 3 especies el mapa entra al pie; con 5, ya no.
test.each([3, 5])(
  'con %i especies de nombre largo, el plan acierta si el mapa entra al pie',
  async (especies) => {
    const entrada = entradaInforme({ ...LARGOS, especies, codigosLargos: false });
    const { plan } = await armarInforme(entrada);
    expect(plan?.ubicacion === UBICACION_MAPA.ultimaHoja).toBe(await entraAlPie(entrada));
  },
);

test('con nombres largos el informe crece, sin hojas de más', async () => {
  const largo = await armarInforme(entradaInforme({ ...LARGOS, especies: 40 }));
  const corto = await armarInforme(entradaInforme({ parcelas: 4, nn: 3, especies: 40 }));
  expect(paginasDelPdf(largo.pdf)).toBeGreaterThan(paginasDelPdf(corto.pdf));
  const ultima = paginasDelPdf(largo.pdf);
  expect(largo.textos).toContain(`Emitido el 06/10/2026 · Página ${ultima} de ${ultima}`);
});
