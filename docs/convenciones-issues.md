# Convenciones de Issues

Cómo se escribe y se clasifica un Issue de Bayka. Vigente desde 2026-09-23.

Lo usan el skill `/issue` (que los crea) y `/matriz-issues` (que los lee para el
dashboard). Un Issue escrito a mano sigue las mismas reglas.

## Formato del body

```
<resumen: una a tres oraciones>

**Necesita de Facu:** <una oración>     ← solo si lleva necesita-ok o necesita-facu

## <primera sección>
...
```

**El resumen es todo lo que va antes del primer `##`.** Ese es el contrato: el
dashboard lo lee de ahí y lo muestra en su panel lateral. Si el body arranca con
un `##`, el issue no tiene resumen.

El resumen contesta tres cosas en ese orden: **qué pasa**, **por qué importa** y
**qué lo hace caro o barato**. Tiene que leerse solo, sin abrir el resto — es lo
que alguien lee para decidir si le dedica tiempo.

Dos restricciones que vienen de dónde se muestra:

- **Sin markdown adentro del resumen** (negritas, links, listas). El dashboard lo
  renderiza como texto plano y los asteriscos se ven crudos. Las referencias
  `#N` sí van: se leen bien igual.
- **Sin encabezado propio.** No lleva `## Resumen` arriba; es el primer párrafo y
  punto.
- **Nada antes del resumen.** Los avisos en blockquote («no entra en este
  release») van después, no arriba: si el primer bloque no es el resumen, quien
  lee —y el dashboard— se lleva otra cosa.

Ejemplo:

> Cualquiera con un mail se registra y queda adentro de la organización del
> cliente, verificado en los dos proyectos. No hay escalación de privilegios,
> pero sí lectura de los perfiles de la org. Cerrar el signup es un cambio de
> configuración.

Tres oraciones: el problema, su alcance real, y por qué cuesta poco.

## Redacción

El objetivo es que el issue **entre en una pantalla**. Si no entra, o es una
épica —y entonces va con sub-issues— o sobra texto.

- **Una oración, una idea.** Si tiene dos comas y un "además", son dos oraciones.
- **El dato concreto le gana a la generalidad.** «352 warnings», «~2,5 GB»,
  «37 tests que no corren» dicen más que «muchos», «bastante espacio»,
  «cobertura incompleta».
- **Nombrá el archivo y la línea** en vez de describir dónde está:
  `PhotoService.ts:93`, no «en el servicio de fotos, cerca del final».
- **Arrancá por el problema**, no por el contexto del contexto. Si la primera
  oración explica qué es una plantación, sobra.
- **Cero relleno**: «cabe destacar», «es importante mencionar», «como sabemos»,
  «a grandes rasgos». Si se puede borrar la frase y no se pierde nada, borrala.
- **Tablas para comparar, listas para enumerar, prosa para explicar por qué.**
  Una lista de un solo ítem es una oración mal escrita.
- **Contá qué pasa y qué se decidió, no la crónica de cómo se descubrió** — salvo
  que el cómo sea la evidencia: dos comprobaciones independientes de un agujero
  de seguridad *son* el aporte.
- **Las decisiones ya tomadas van con fecha y dueño**: «Decisión de Facu
  (2026-09-18): …». Es lo que evita rediscutirlas en tres meses.

Secciones típicas, todas opcionales: `## Problema`, `## Propuesta`,
`## Alcance`, `## A decidir`, `## Criterios de verificación`. Usá las que
aporten; un issue de una línea no necesita ninguna.

## Labels

Cuatro grupos. **Quién** y **tipo** van siempre. **Área** va cuando el issue toca
una de las apps — un issue de tooling o de documentación del repo no lleva
ninguna. Los de **estado**, los que apliquen.

| Grupo | Labels |
|---|---|
| Quién | `hace-claude` `necesita-ok` `necesita-facu` |
| Tipo | `bug` `seguridad` `enhancement` `deuda-tecnica` `infra` `epica` |
| Área | `web` `mobile` `db` |
| Estado | `esta-release` `proxima-release` `fuera-del-release` `quick-win` `requiere-decision` `bloqueado` |

### Quién lo resuelve — exactamente uno

Decide si Claude puede arrancar hoy o si hay que esperar. La pregunta que los
separa es **«¿puede Claude dejar esto terminado?»**.

- **`hace-claude`** — lo resuelve entero: código, tests y PR. Ponelo solo si
  podés imaginar el PR sin una sola pregunta de por medio. Que Facu mergee no
  cuenta como intervención: eso pasa siempre. Un issue difícil pero
  autocontenido es `hace-claude` por más grande que sea.
- **`necesita-ok`** — Claude hace el grueso, pero necesita algo de Facu antes o
  después: una decisión de producto, aprobar cómo se ve algo, probarlo en el
  celular.
- **`necesita-facu`** — hay trabajo que Claude no puede hacer: consola de
  Supabase o Cloudflare, credenciales, coordinar con el cliente, un dispositivo
  físico. Aunque Claude escriba parte del código, si sin Facu no queda hecho, va
  acá.

Los dos últimos llevan la línea **`Necesita de Facu:`** en el body, con una
oración en imperativo y concreta. «Desactivar el registro en el dashboard de
Supabase de prod y de staging» sirve; «requiere intervención manual» no dice
nada y hace que el label no valga la pena.

### Tipo, área y estado

- **`seguridad`** va junto con `bug` cuando además hay algo roto. Es exposición
  de datos, permisos o acceso — no «código frágil», que es `deuda-tecnica`.
- **`deuda-tecnica`** es lo que no ve el usuario: tests apagados, lint, refactor.
  Si el usuario nota el síntoma, es `bug`.
- **`infra`** es entornos, backups, cuentas y CI. Un issue puede ser
  `enhancement` + `infra`.
- **`epica`** es paraguas de varios issues, y entonces lleva sub-issues.
- **`quick-win`** es alto impacto y bajo costo. Es el que más tienta: ponelo solo
  si el arreglo es de una línea o dos y el efecto se nota.
- **`bloqueado`** es esperar algo externo: el cliente, otro issue, una decisión
  ajena. Un issue difícil no está bloqueado, está caro.
- **`requiere-decision`** es que falta una definición de Facu *antes* de poder
  implementar. Suele venir escrito en el propio issue («a decidir»,
  «a confirmar»).
- **`esta-release`** es solo lo que bloquea el pase a prod en curso. Es la
  decisión más fácil de inflar: ante la duda, no va.

## Qué NO va en el issue

- **Impacto y costo numéricos.** Son relativos al resto del backlog —un 7 de
  impacto significa algo distinto según qué más esté abierto— y los mantiene el
  dashboard, donde se pueden arrastrar. Un número en el body envejece y nadie lo
  actualiza.
- **Claves internas de planificación** (`D-16-13`, `Phase 15`, `T02`) y
  referencias a `CLAUDE.md`, a `docs/*.md` o a memorias. Solo `#N` de Issues y
  PRs.
