---
name: matriz-issues
description: Revisa los issues abiertos del repo, los clasifica con labels de GitHub (quién lo resuelve, tipo, área, estado) y republica la matriz impacto × costo — el gráfico de cuadrantes con filtros por tag y puntos arrastrables, que marca cuáles puede resolver Claude solo y cuáles necesitan a Facu. Usalo cuando quieras ver el backlog entero de una y decidir qué sigue.
argument-hint: "[dry-run]"
disable-model-invocation: true
---

# /matriz-issues — el backlog abierto en un cuadrante

Project root: `/Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1`

Artifact fijo: **https://claude.ai/artifact/RRh7GzaM4igz3RLzdJ4hFn**

Sirve para contestar "¿qué hago ahora?" mirando los issues abiertos ubicados por
**impacto** (eje Y) y **costo de resolverlos** (eje X). El cuadrante de arriba a
la izquierda es lo que más rinde.

Dos cosas que este skill mantiene y que conviene no romper:

- **Los labels de GitHub son la fuente de los filtros.** Los chips del artifact
  no son una taxonomía paralela: son los labels reales. Por eso el skill los
  aplica en GitHub, no solo en el HTML.
- **Las posiciones que Facu arrastró valen más que las que yo estimo.** Cuando
  mueve un punto, esa corrección queda guardada en la base del artifact y este
  skill la respeta en la corrida siguiente.

Con `dry-run`: hacé todo menos escribir labels en GitHub y publicar. Mostrá la
clasificación propuesta y pará.

## 1. Traer los issues y lo ya decidido

```sh
gh issue list --state open --limit 400 \
  --json number,title,labels,createdAt,body > /tmp/issues.json
gh label list --limit 100
```

De cada body sacá dos cosas:

- **El resumen** — lo que hay antes del primer `##`. Es el `why` del gráfico, ya
  escrito por `/issue`. En los issues anteriores a la convención ese bloque
  puede no existir o ser otra cosa (un aviso, una sección, el body entero):
  cuando no sea un resumen, escribilo vos como dice §3.
- **Con qué te quedás para estimar** — el resumen alcanza para el impacto, pero
  el costo suele estar más abajo: en la propuesta, en el alcance, en las
  decisiones ya tomadas. En issues largos con eso basta; no hace falta leer la
  crónica entera.

Traé también las posiciones guardadas del artifact, que son las correcciones
manuales de corridas anteriores:

```
Artifact action="read_db" url=<artifact> db_op="list" collection="posiciones"
```

Cada documento es `i<número>` con `{impacto, costo}`.

## 2. Completar los labels que falten

**Los criterios de cada label están en `docs/convenciones-issues.md`.** Ese doc
es la fuente: cuatro grupos (quién, tipo, área, estado) con la regla de cada uno.
Leelo antes de clasificar en vez de decidir de memoria.

Desde que existe `/issue`, los issues nuevos **nacen clasificados**. Acá solo
quedan dos trabajos:

- **Completar los viejos**, que se crearon antes de la convención y pueden tener
  labels incompletos o ninguno.
- **Avisar las contradicciones.** Un label puesto a mano es una decisión tomada:
  no lo quites. Si contradice lo que dice el issue —un `quick-win` que al leerlo
  resulta caro, un `esta-release` que ya no parece de esta release— decilo en el
  resumen final y dejalo como está.

El que más conviene revisar es el de **quién lo resuelve**, porque es el único
que tiene que estar exactamente una vez por issue: con dos, el artifact toma el
más exigente y el chip miente. Si falta o está duplicado, el script de armado lo
rechaza antes de publicar.

Si algún label no existe todavía en el repo:
`gh label create <nombre> --color <hex> --description "<qué significa>"`.

## 3. Estimar impacto y costo

Escala 0–10 en los dos ejes. Los números no pretenden ser precisos: pretenden
ordenar. Lo que importa es que dos issues comparables queden cerca y que uno
claramente más grave quede arriba del otro.

**Impacto** — qué pasa si no se hace:
- **9–10**: datos o acceso en riesgo ahora, en producción.
- **7–8**: bloquea el pase a prod, o el cliente lo necesita para trabajar.
- **5–6**: molesta seguido, o previene una clase de bug conocida.
- **3–4**: incomodidad acotada, o riesgo lejano.
- **0–2**: casi nadie lo nota.

**Costo** — cuánto trabajo propio es:
- **9–10**: épica, varias apps, migración con backfill.
- **7–8**: feature entera con decisiones de diseño abiertas.
- **5–6**: toca varias capas pero el camino está claro.
- **3–4**: un archivo o dos, más tests.
- **0–2**: una línea, un flag, una constante.

Dos afinaciones que cambian el resultado más de lo que parece:

- **El costo es tiempo tuyo, no calendario.** Un issue que espera a que el
  cliente active una cuenta es `bloqueado` con costo bajo, no costo alto.
- **Responder una pregunta y construir la respuesta son cosas distintas.** Si el
  issue es "evaluar A vs B", estimá lo que costaría implementarlo, y anotá en el
  `why` que la decisión sale barata.

Si el issue ya tiene posición guardada en `posiciones`, **usá esa** y no la
tuya: es una corrección deliberada. Estimá solo los que no tienen.

### El `why` sale del issue, no de vos

El panel lateral muestra el campo `why`, y **ese texto ya está escrito**: es el
resumen del issue, o sea todo lo que hay en el body antes del primer `##`
(`docs/convenciones-issues.md`). Copialo tal cual.

Copiarlo en vez de reescribirlo hace que lo que se lee en el panel sea lo mismo
que se lee al abrir el issue. Y si el resumen está mal, la corrección va **en el
issue**: es el lugar donde queda arreglada para todos.

Cuando el issue no tenga resumen, escribilo vos: dos o tres oraciones con qué
pasa, por qué ese impacto y por qué ese costo, citando el dato concreto
(«~2,5 GB de fotos», «37 tests que no corren») en vez de generalidades. Si
además vas a editar ese issue por otro motivo, aprovechá y dejale el resumen
arriba.

Lo mismo con `need`: es la línea `**Necesita de Facu:**` del body, sin el
prefijo en negrita. Vacío para los `hace-claude`.

El **color** agrupa en tres, y no hay un cuarto disponible: más de tres tonos en
un scatter dejan de distinguirse entre sí. La separación fina la hacen los
filtros.

| `tipo` | Cuándo |
|---|---|
| `problema` | tiene `bug` o `seguridad` |
| `infra` | si no, tiene `infra` o `deuda-tecnica` |
| `funcion` | el resto |

## 4. Armar y publicar

Escribí un JSON con los issues y pasalo por el script, que valida rangos,
campos faltantes y puntos que se pisan:

```sh
python3 .claude/skills/matriz-issues/scripts/build_matriz.py \
  /tmp/matriz-datos.json /tmp/matriz-issues.html
```

Formato de `/tmp/matriz-datos.json`:

```json
{
  "repo": "facundo-p/bayka-app",
  "fecha": "22 sep 2026",
  "issues": [
    { "n": 606, "imp": 9.2, "cost": 1.8, "tipo": "problema",
      "title": "El registro público está abierto en prod y staging",
      "why": "Cualquiera con un mail se registra y queda adentro de la organización del cliente…",
      "need": "Desactivar el registro en el dashboard de Supabase de prod y de staging.",
      "tags": ["necesita-facu", "seguridad", "bug", "db", "esta-release", "quick-win"] }
  ]
}
```

El `title` es para leer de un vistazo, no el título literal de GitHub: sacale el
prefijo (`fix(web/db):`, `mobile:`) y dejá la frase. El número ya lleva al issue.

Si el script avisa que dos puntos se pisan, separalos en el eje donde tu
estimación sea menos firme — no los dejes encimados, porque uno tapa al otro y
desaparece del gráfico.

Publicá **sobre el artifact existente**, para conservar el link y las posiciones
arrastradas:

```
Artifact url="https://claude.ai/artifact/RRh7GzaM4igz3RLzdJ4hFn"
         file_path="/tmp/matriz-issues.html"
```

Leelo antes de publicar (`action="read"`) — es el requisito para publicar sobre
un artifact que esta conversación todavía no tocó. No pases `favicon`, `icon` ni
`capabilities`: se conservan solos, y cambiar el favicon lo hace irreconocible
en la galería.

Los issues que se cerraron desde la última corrida desaparecen del gráfico, pero
su documento queda en `posiciones`. No pasa nada: el artifact ignora los
documentos que no corresponden a ningún issue del set actual.

## 5. Contar qué cambió

Terminá con el link y un resumen corto, en este orden:

1. **Qué se taggeó de nuevo** — solo los issues que tocaste, con qué labels.
2. **Qué puede arrancar Claude hoy** — los `hace-claude`, que son los que no
   dependen de nadie. Es lo primero que se pregunta quien mira esto.
3. **Qué está esperándote** — los `necesita-ok` y `necesita-facu`, agrupados por
   lo que hace falta, para que se vea si varios se destraban con una sola
   decisión tuya.
4. **Qué hay en "hacer ya"** — los de alto impacto y bajo costo, con el número.
5. **Qué cambió desde la corrida anterior** — issues nuevos, cerrados, o que se
   movieron de cuadrante. Es lo que hace que correrlo seguido valga la pena.
6. **Contradicciones que viste y no corregiste** — un label que no coincide con
   lo que dice el issue, un `esta-release` que ya no parece de esta release.

No repitas la tabla entera: está en el artifact, y ahí se puede filtrar.
