import { estadoMock } from './supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from './queryBuilderMock';

/** Captura todas las consultas del mock y delega la respuesta en `responder`. */
export function capturarConsultas(
  responder: (consulta: ConsultaCapturada) => RespuestaMock,
): ConsultaCapturada[] {
  const consultas: ConsultaCapturada[] = [];
  estadoMock.resolverConsulta = (consulta) => {
    consultas.push(consulta);
    return responder(consulta);
  };
  return consultas;
}
