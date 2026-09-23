---
name: issue
description: Crea un Issue de Bayka con el formato del repo — resumen arriba, redacción sintética, labels de quién/tipo/área/estado puestos al crear, y verificado en el board. Usalo cuando haya que abrir un Issue, anotar un bug, un olor detectado de paso, o convertir algo que surgió en la conversación en trabajo trazable.
argument-hint: "[qué pasa]"
disable-model-invocation: true
---

# /issue — abrir un Issue que se lea de un vistazo

Project root: `/Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1`

Formato, reglas de redacción y criterios de cada label: **`docs/convenciones-issues.md`**.
Leelo antes de escribir — es la fuente, esto es el procedimiento.

Un Issue mal escrito cuesta dos veces: cuando alguien lo lee y no entiende qué
pasa, y cuando el dashboard (`/matriz-issues`) tiene que reconstruir el resumen
que debería haber estado ahí desde el principio. Por eso el resumen y los labels
se escriben acá, al crearlo, y no después.

## 1. Entender antes de escribir

Si el issue sale de algo que pasó en la conversación, ya tenés el material.
Si sale de un pedido suelto («anotá que el CommandMenu no filtra»), primero
**verificá en el código** qué es lo que realmente pasa: el archivo, la función,
si hay un test que lo cubre. Un issue que describe el síntoma mal visto manda a
buscar al lugar equivocado.

Buscá duplicados antes de crear:

```sh
gh issue list --state all --search "<palabras clave>" --limit 20 \
  --json number,title,state
```

Si ya existe y está abierto, comentá ahí en vez de abrir otro. Si está cerrado y
el problema volvió, reabrilo (`gh issue reopen`) y comentá qué cambió.

## 2. Escribir

El body arranca con el **resumen**: una a tres oraciones que digan qué pasa, por
qué importa y qué lo hace caro o barato. Todo lo que va antes del primer `##` es
el resumen, y es lo que muestra el dashboard — sin markdown adentro y sin
encabezado propio.

Si lleva `necesita-ok` o `necesita-facu`, va la línea `**Necesita de Facu:**`
justo después, con una oración en imperativo.

Después, las secciones que aporten. El objetivo es que entre en una pantalla.

El título también es parte del trabajo: **decí qué pasa, no de qué se trata.**
«El CommandMenu abre la sección sin filtrar por el resultado elegido» ubica a
cualquiera; «Mejoras en el CommandMenu» no dice nada. Prefijo tipo
`fix(web/db):` solo si el issue es sobre un punto muy concreto del código; el
dashboard se lo saca igual para mostrarlo.

Escribí el body en un archivo y pasalo con `--body-file`: con `--body` inline,
los backticks y las comillas se los come la shell.

```sh
gh issue create --title "<título>" --body-file /tmp/issue-body.md \
  --label hace-claude --label bug --label web --label quick-win
```

## 3. Clasificar al crear

Los labels van en el mismo `gh issue create`, no en un `edit` posterior: si el
issue nace sin ellos, alguien los tiene que adivinar después.

Van siempre uno de **quién** (`hace-claude` / `necesita-ok` / `necesita-facu`),
uno o más de **tipo**, y los de **área** que toque. Los de estado, solo si
aplican. Los criterios están en el doc; el que más se equivoca es el de quién,
así que preguntate concretamente qué haría falta de Facu para dar esto por
terminado.

Si el issue es parte de una épica, linkealo como sub-issue en vez de solo
mencionarla.

## 4. Dejarlo visible

Por la regla de trazabilidad del repo, un issue que no está en el board es
trabajo invisible. El workflow «Auto-add to project» suele agregarlo, pero no
siempre:

```sh
gh project item-list 1 --owner facundo-p --format json \
  | jq '.items[] | select(.content.number == <N>) | .id'
```

Si no aparece:

```sh
gh project item-add 1 --owner facundo-p --url <url-del-issue>
```

## 5. Cerrar el loop

Terminá con el link al issue y **el resumen tal como quedó** — que es lo que
Facu va a leer para confirmar que entendiste bien el problema antes de que nadie
lo implemente.

Si el issue quedó con `necesita-ok` o `necesita-facu`, decilo explícitamente:
es trabajo que no arranca hasta que él haga algo, y conviene que lo sepa ahora y
no cuando mire el dashboard.

Corré `/matriz-issues` después solo si querés ver dónde cae en el cuadrante; el
issue ya nace con todo lo que ese skill necesita.
