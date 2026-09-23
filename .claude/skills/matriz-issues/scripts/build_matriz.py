#!/usr/bin/env python3
"""Arma el HTML de la matriz a partir de la plantilla y un JSON de issues.

    python3 build_matriz.py datos.json salida.html

datos.json:
    {
      "repo": "facundo-p/bayka-app",
      "fecha": "22 sep 2026",
      "issues": [
        {"n": 606, "imp": 9.2, "cost": 1.8, "tipo": "problema",
         "title": "...", "why": "...", "tags": ["seguridad", "bug"]}
      ]
    }

Valida antes de escribir: un dato mal formado se ve como un gráfico vacío en el
navegador y ahí ya es tarde para saber cuál de los 18 estaba mal.
"""

import json
import sys
from pathlib import Path

TIPOS = {"problema", "funcion", "infra"}
CAMPOS = ("n", "imp", "cost", "tipo", "title", "why", "need", "tags")

# Quién lo resuelve. El artifact lo deriva de estos labels, así que cada issue
# necesita exactamente uno: con dos, gana el más exigente y el chip miente.
QUIEN = ("hace-claude", "necesita-ok", "necesita-facu")

# Los puntos se dibujan en porcentaje sobre el plot: fuera de este rango quedan
# cortados contra el borde.
MIN, MAX = 0.2, 9.8


def validar(issues):
    errores = []
    vistos = set()

    for i, it in enumerate(issues):
        ref = "#" + str(it.get("n", "?")) + " (índice " + str(i) + ")"

        for campo in CAMPOS:
            if campo not in it:
                errores.append(ref + ": falta '" + campo + "'")

        if it.get("n") in vistos:
            errores.append(ref + ": número repetido")
        vistos.add(it.get("n"))

        if it.get("tipo") not in TIPOS:
            errores.append(
                ref + ": tipo '" + str(it.get("tipo")) + "' no es " + "/".join(sorted(TIPOS))
            )

        for eje in ("imp", "cost"):
            v = it.get(eje)
            if not isinstance(v, (int, float)):
                errores.append(ref + ": " + eje + " no es un número")
            elif not (MIN <= v <= MAX):
                errores.append(
                    ref + ": " + eje + "=" + str(v) + " fuera de " + str(MIN) + "–" + str(MAX)
                )

        tags = it.get("tags") or []
        if not tags:
            errores.append(ref + ": sin tags, no lo alcanza ningún filtro")

        quien = [t for t in tags if t in QUIEN]
        if len(quien) != 1:
            errores.append(
                ref + ": tiene " + str(len(quien)) + " labels de quién lo resuelve"
                " (" + (", ".join(quien) or "ninguno") + "); va exactamente uno de "
                + ", ".join(QUIEN)
            )

        if not str(it.get("why", "")).strip():
            errores.append(ref + ": sin 'why' — el panel lateral queda vacío")

        # 'need' dice qué se espera de Facu: sin eso, el label no sirve de nada.
        # Solo se chequea con un quién definido; si no, el mensaje sería ruido
        # derivado del error de arriba.
        if len(quien) == 1:
            need = str(it.get("need", "")).strip()
            if quien[0] == "hace-claude" and need:
                errores.append(ref + ": es hace-claude pero tiene 'need'; dejalo vacío")
            elif quien[0] != "hace-claude" and not need:
                errores.append(
                    ref + ": " + quien[0] + " sin 'need' — falta decir qué necesitás hacer"
                )

    return errores


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


def main():
    if len(sys.argv) != 3:
        sys.exit("uso: build_matriz.py datos.json salida.html")

    datos = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    issues = datos["issues"]

    errores = validar(issues)
    if errores:
        sys.exit("Datos inválidos:\n  " + "\n  ".join(errores))

    plantilla = (Path(__file__).parent.parent / "assets" / "matriz.template.html").read_text(
        encoding="utf-8"
    )

    campos = [{k: it[k] for k in CAMPOS} for it in issues]
    html = (
        plantilla
        .replace("__ISSUES_JSON__", json.dumps(campos, ensure_ascii=False, indent=2))
        .replace("__REPO_ISSUES_URL__", "https://github.com/" + datos["repo"] + "/issues/")
        .replace("__EYEBROW__", "Bayka · backlog abierto · " + datos["fecha"])
        .replace("__N__", str(len(issues)))
    )

    Path(sys.argv[2]).write_text(html, encoding="utf-8")

    print("OK: " + str(len(issues)) + " issues → " + sys.argv[2])
    for a, b in solapados(issues):
        print("  aviso: #" + str(a) + " y #" + str(b) + " se pisan; separalos en algún eje")


if __name__ == "__main__":
    main()
