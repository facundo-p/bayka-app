"""python3 .claude/skills/matriz-issues/scripts/test_build_matriz.py"""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import build_matriz as bm  # noqa: E402


def nodo(n, **extra):
    base = {"number": n, "createdAt": "2026-09-01T10:00:00Z", "lastEditedAt": None,
            "comments": {"nodes": []}, "parent": None,
            "subIssuesSummary": {"total": 0, "completed": 0},
            "blockedBy": {"nodes": []}, "blocking": {"nodes": []}}
    base.update(extra)
    return base


def issue(n, **extra):
    base = {"n": n, "imp": 5, "cost": 5, "tipo": "funcion", "title": "t", "why": "w",
            "need": "", "tags": ["hace-claude"]}
    base.update(extra)
    return base


DECISION = {"pregunta": "¿A o B?", "opciones": [
    {"nombre": "A", "detalle": "barato", "recomendada": True},
    {"nombre": "B", "detalle": "caro", "recomendada": False}]}


class Actividad(unittest.TestCase):
    def test_sin_edicion_ni_comentarios_es_la_creacion(self):
        self.assertEqual(bm.actividad(nodo(1)), "2026-09-01T10:00:00Z")

    def test_gana_la_mas_reciente_entre_edicion_y_comentario(self):
        n = nodo(1, lastEditedAt="2026-09-10T00:00:00Z",
                 comments={"nodes": [{"createdAt": "2026-09-05T00:00:00Z"}]})
        self.assertEqual(bm.actividad(n), "2026-09-10T00:00:00Z")
        n["comments"]["nodes"][0]["createdAt"] = "2026-09-20T00:00:00Z"
        self.assertEqual(bm.actividad(n), "2026-09-20T00:00:00Z")


class Relaciones(unittest.TestCase):
    def test_solo_cuentan_los_bloqueos_abiertos(self):
        n = nodo(1, blockedBy={"nodes": [{"number": 9, "state": "OPEN"},
                                         {"number": 8, "state": "CLOSED"}]},
                 blocking={"nodes": [{"number": 7, "state": "OPEN"}]})
        rel = bm.relaciones(n)
        self.assertEqual(rel["bloqueadoPor"], [9])
        self.assertEqual(rel["bloquea"], [7])

    def test_padre_y_sub_issues(self):
        n = nodo(244, parent={"number": 385, "state": "CLOSED"},
                 subIssuesSummary={"total": 11, "completed": 9})
        rel = bm.relaciones(n)
        self.assertEqual(rel["padre"], {"n": 385, "cerrado": True})
        self.assertEqual(rel["subs"], {"cerrados": 9, "total": 11})

    def test_sin_relaciones_no_agrega_padre_ni_subs(self):
        self.assertEqual(bm.relaciones(nodo(1)), {"bloqueadoPor": [], "bloquea": []})

    def test_issue_que_ya_no_esta_abierto_es_error(self):
        errores = bm.enriquecer([issue(1), issue(2)], [nodo(1)])
        self.assertEqual(errores, ["#2: no está abierto en GitHub"])


class Decision(unittest.TestCase):
    def rd(self, **extra):
        return issue(5, tags=["necesita-ok", "requiere-decision"], need="decidir", **extra)

    def test_decision_valida(self):
        self.assertEqual(bm.validar([self.rd(decision=DECISION)]), [])

    def test_sin_pregunta(self):
        errores = bm.validar([self.rd(decision={"opciones": []})])
        self.assertIn("#5 (índice 0): 'decision' sin 'pregunta'", errores)

    def test_dos_recomendadas(self):
        d = {"pregunta": "?", "opciones": [
            {"nombre": "A", "detalle": "x", "recomendada": True},
            {"nombre": "B", "detalle": "y", "recomendada": True}]}
        self.assertIn("#5 (índice 0): más de una opción recomendada", bm.validar([self.rd(decision=d)]))

    def test_decision_sin_el_label(self):
        errores = bm.validar([issue(5, decision=DECISION)])
        self.assertIn("#5 (índice 0): tiene 'decision' sin el label requiere-decision", errores)

    def test_requiere_decision_sin_decision_es_aviso(self):
        self.assertEqual(bm.validar([self.rd()]), [])
        self.assertEqual(bm.sin_decision([self.rd()]), [5])


class Render(unittest.TestCase):
    def test_la_plantilla_recibe_actividad_relaciones_y_decision(self):
        it = issue(559, tags=["necesita-ok", "requiere-decision"], need="decidir", decision=DECISION)
        bm.enriquecer([it], [nodo(559, blocking={"nodes": [{"number": 534, "state": "OPEN"}]})])
        html = bm.render({"repo": "o/r", "fecha": "29 sep 2026"}, [it])
        datos = json.loads(html.split("var ISSUES = ")[1].split(";\n")[0])
        self.assertEqual(datos[0]["rel"]["bloquea"], [534])
        self.assertEqual(datos[0]["actividad"], "2026-09-01T10:00:00Z")
        self.assertEqual(datos[0]["decision"]["pregunta"], "¿A o B?")
        for marca in ("__ISSUES_JSON__", "__REPO_ISSUES_URL__", "__EYEBROW__", "__N__"):
            self.assertNotIn(marca, html)


if __name__ == "__main__":
    unittest.main()
