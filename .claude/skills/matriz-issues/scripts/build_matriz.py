#!/usr/bin/env python3
"""Arma el HTML de la matriz a partir de la plantilla y un JSON de issues.

    python3 build_matriz.py datos.json salida.html [--grafo respuesta.json]

datos.json:
    {
      "repo": "facundo-p/bayka-app",
      "fecha": "22 sep 2026",
      "issues": [
        {"n": 606, "imp": 9.2, "cost": 1.8, "tipo": "problema",
         "title": "...", "why": "...", "need": "...", "tags": ["seguridad", "bug"],
         "decision": {"pregunta": "...", "opciones": [...]}}
      ]
    }

La antigüedad y las relaciones (bloqueado por, épica, sub-issues) no van en
datos.json: salen de una sola consulta GraphQL a GitHub. `--grafo` usa una
respuesta guardada en vez de consultar, para probar sin red.

Valida antes de escribir: un dato mal formado se ve como un gráfico vacío en el
navegador y ahí ya es tarde para saber cuál de los 18 estaba mal.
"""

import json
import subprocess
import sys
from pathlib import Path

TIPOS = {"problema", "funcion", "infra"}
CAMPOS = ("n", "imp", "cost", "tipo", "title", "why", "need", "tags")

# Quién lo resuelve. El artifact lo deriva de estos labels, así que cada issue
# necesita exactamente uno: con dos, gana el más exigente y el chip miente.
QUIEN = ("hace-claude", "necesita-ok", "necesita-facu")
HACE_CLAUDE = QUIEN[0]
REQUIERE_DECISION = "requiere-decision"

ABIERTO = "OPEN"

# Los puntos se dibujan en porcentaje sobre el plot: fuera de este rango quedan
# cortados contra el borde.
MIN, MAX = 0.2, 9.8

PLANTILLA = Path(__file__).parent.parent / "assets" / "matriz.template.html"

CONSULTA = """
query($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    issues(states: OPEN, first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number createdAt lastEditedAt
        comments(last: 1) { nodes { createdAt } }
        parent { number state }
        subIssuesSummary { total completed }
        blockedBy(first: 50) { nodes { number state } }
        blocking(first: 50) { nodes { number state } }
      }
    }
  }
}
"""


# ---------- GitHub ----------

def consultar_github(repo):
    """Los nodos de todos los issues abiertos, página por página."""
    owner, name = repo.split("/")
    nodos, cursor = [], None
    while True:
        args = ["gh", "api", "graphql", "-f", "query=" + CONSULTA,
                "-f", "owner=" + owner, "-f", "name=" + name]
        if cursor:
            args += ["-f", "after=" + cursor]
        salida = subprocess.run(args, check=True, capture_output=True, text=True).stdout
        pagina = json.loads(salida)["data"]["repository"]["issues"]
        nodos += pagina["nodes"]
        if not pagina["pageInfo"]["hasNextPage"]:
            return nodos
        cursor = pagina["pageInfo"]["endCursor"]


def actividad(nodo):
    """Última actividad real. updatedAt no sirve: lo bumpea cualquier cambio de labels."""
    fechas = [nodo["createdAt"], nodo.get("lastEditedAt")]
    fechas += [c["createdAt"] for c in (nodo.get("comments") or {}).get("nodes", [])]
    # ISO 8601 en UTC: el orden de strings es el cronológico.
    return max(f for f in fechas if f)


def _abiertos(conexion):
    return sorted(x["number"] for x in (conexion or {}).get("nodes", []) if x["state"] == ABIERTO)


def relaciones(nodo):
    """Un issue cerrado ya no bloquea: solo cuentan los abiertos."""
    rel = {"bloqueadoPor": _abiertos(nodo.get("blockedBy")),
           "bloquea": _abiertos(nodo.get("blocking"))}
    padre = nodo.get("parent")
    if padre:
        rel["padre"] = {"n": padre["number"], "cerrado": padre["state"] != ABIERTO}
    subs = nodo.get("subIssuesSummary") or {}
    if subs.get("total"):
        rel["subs"] = {"cerrados": subs["completed"], "total": subs["total"]}
    return rel


def enriquecer(issues, nodos):
    """Suma actividad y relaciones a cada issue. Devuelve los errores."""
    por_numero = {nd["number"]: nd for nd in nodos}
    errores = []
    for it in issues:
        nodo = por_numero.get(it.get("n"))
        if nodo is None:
            errores.append("#" + str(it.get("n")) + ": no está abierto en GitHub")
            continue
        it["actividad"] = actividad(nodo)
        it["rel"] = relaciones(nodo)
    return errores


# ---------- validación ----------

def _es_texto(v):
    return isinstance(v, str) and v.strip() != ""


def validar_decision(ref, d):
    if not isinstance(d, dict):
        return [ref + ": 'decision' no es un objeto"]
    errores = []
    if not _es_texto(d.get("pregunta")):
        errores.append(ref + ": 'decision' sin 'pregunta'")
    for campo in ("porque", "implicancias", "recomendacion", "fuente", "nota"):
        if campo in d and not _es_texto(d[campo]):
            errores.append(ref + ": 'decision." + campo + "' vacío; sacalo o completalo")
    opciones = d.get("opciones", [])
    if not isinstance(opciones, list):
        return errores + [ref + ": 'decision.opciones' no es una lista"]
    for i, o in enumerate(opciones):
        if not (isinstance(o, dict) and _es_texto(o.get("nombre")) and _es_texto(o.get("detalle"))
                and isinstance(o.get("recomendada"), bool)):
            errores.append(ref + ": opción " + str(i) + " necesita nombre, detalle y recomendada (bool)")
    if sum(1 for o in opciones if isinstance(o, dict) and o.get("recomendada") is True) > 1:
        errores.append(ref + ": más de una opción recomendada")
    return errores


def _validar_forma(ref, it):
    errores = [ref + ": falta '" + campo + "'" for campo in CAMPOS if campo not in it]
    if it.get("tipo") not in TIPOS:
        errores.append(ref + ": tipo '" + str(it.get("tipo")) + "' no es " + "/".join(sorted(TIPOS)))
    for eje in ("imp", "cost"):
        v = it.get(eje)
        if not isinstance(v, (int, float)):
            errores.append(ref + ": " + eje + " no es un número")
        elif not (MIN <= v <= MAX):
            errores.append(ref + ": " + eje + "=" + str(v) + " fuera de " + str(MIN) + "–" + str(MAX))
    if not (it.get("tags") or []):
        errores.append(ref + ": sin tags, no lo alcanza ningún filtro")
    if not str(it.get("why", "")).strip():
        errores.append(ref + ": sin 'why' — el panel lateral queda vacío")
    return errores


def _validar_quien(ref, tags, need):
    quien = [t for t in tags if t in QUIEN]
    if len(quien) != 1:
        return [ref + ": tiene " + str(len(quien)) + " labels de quién lo resuelve"
                " (" + (", ".join(quien) or "ninguno") + "); va exactamente uno de " + ", ".join(QUIEN)]
    # 'need' dice qué se espera de Facu: sin eso, el label no sirve de nada.
    need = str(need).strip()
    if quien[0] == HACE_CLAUDE and need:
        return [ref + ": es hace-claude pero tiene 'need'; dejalo vacío"]
    if quien[0] != HACE_CLAUDE and not need:
        return [ref + ": " + quien[0] + " sin 'need' — falta decir qué necesitás hacer"]
    return []


def validar(issues):
    errores = []
    vistos = set()
    for i, it in enumerate(issues):
        ref = "#" + str(it.get("n", "?")) + " (índice " + str(i) + ")"
        if it.get("n") in vistos:
            errores.append(ref + ": número repetido")
        vistos.add(it.get("n"))
        tags = it.get("tags") or []
        errores += _validar_forma(ref, it) + _validar_quien(ref, tags, it.get("need", ""))
        if "decision" in it:
            # Solo la bandeja la muestra, y la bandeja son los requiere-decision.
            if REQUIERE_DECISION not in tags:
                errores.append(ref + ": tiene 'decision' sin el label " + REQUIERE_DECISION)
            errores += validar_decision(ref, it["decision"])
    return errores


def sin_decision(issues):
    """No es error: la bandeja cae a 'need' como pregunta. Es aviso."""
    return [it["n"] for it in issues if REQUIERE_DECISION in it["tags"] and "decision" not in it]


def solapados(issues, min_dist=0.45):
    """Pares tan juntos que un punto tapa al otro. No es error: es aviso."""
    pares = []
    for i, a in enumerate(issues):
        for b in issues[i + 1:]:
            dx = abs(a["cost"] - b["cost"])
            dy = abs(a["imp"] - b["imp"])
            if dx < min_dist and dy < min_dist:
                pares.append((a["n"], b["n"]))
    return pares


# ---------- armado ----------

def render(datos, issues):
    campos = []
    for it in issues:
        c = {k: it[k] for k in CAMPOS + ("actividad", "rel")}
        if "decision" in it:
            c["decision"] = it["decision"]
        campos.append(c)
    return (
        PLANTILLA.read_text(encoding="utf-8")
        .replace("__ISSUES_JSON__", json.dumps(campos, ensure_ascii=False, indent=2))
        .replace("__REPO_ISSUES_URL__", "https://github.com/" + datos["repo"] + "/issues/")
        .replace("__EYEBROW__", "Bayka · backlog abierto · " + datos["fecha"])
        .replace("__N__", str(len(issues)))
    )


def leer_args(argv):
    args = argv[1:]
    grafo = None
    if "--grafo" in args:
        i = args.index("--grafo")
        if i + 1 >= len(args):
            sys.exit("--grafo necesita un archivo")
        grafo = args[i + 1]
        del args[i:i + 2]
    if len(args) != 2:
        sys.exit("uso: build_matriz.py datos.json salida.html [--grafo respuesta.json]")
    return args[0], args[1], grafo


def main():
    entrada, salida, grafo = leer_args(sys.argv)
    datos = json.loads(Path(entrada).read_text(encoding="utf-8"))
    issues = datos["issues"]

    errores = validar(issues)
    if not errores:
        nodos = (json.loads(Path(grafo).read_text(encoding="utf-8")) if grafo
                 else consultar_github(datos["repo"]))
        errores = enriquecer(issues, nodos)
    if errores:
        sys.exit("Datos inválidos:\n  " + "\n  ".join(errores))

    Path(salida).write_text(render(datos, issues), encoding="utf-8")

    print("OK: " + str(len(issues)) + " issues → " + salida)
    bloqueos = sum(len(it["rel"]["bloqueadoPor"]) for it in issues)
    print("  relaciones: " + str(bloqueos) + " «bloqueado por» entre abiertos")
    for a, b in solapados(issues):
        print("  aviso: #" + str(a) + " y #" + str(b) + " se pisan; separalos en algún eje")
    for n in sin_decision(issues):
        print("  aviso: #" + str(n) + " es requiere-decision sin 'decision'; la bandeja muestra solo 'need'")


if __name__ == "__main__":
    main()
