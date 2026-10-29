"""
Matrícula en colegios (preescolar, básica y media) - Ministerio de Educación, SIMAT, en datos.gov.co (ngw5-c5nw).
Cuántos niños y jóvenes están matriculados cada año, desde 2010, por departamento, colegio público o privado,
zona urbana o rural, nivel y sexo. Sale una vez al año (el corte de matrícula).

Salida: datos/matricula/datos.csv  anio | depto | sector | zona | nivel | matricula   (depto = código DANE de 2 dígitos)
        datos/matricula/sexo.csv   anio | sexo | nivel | matricula   (nacional)
        datos/matricula/deptos.csv código -> nombre del departamento

Cada corrida vuelve a pedir los dos últimos años; los anteriores se conservan.
Uso:  python scripts/matricula.py [--completo]
"""
import sys
import time
from datetime import date
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import DATOS, guardar, soql  # noqa: E402

CONJ = "ngw5-c5nw"
NIVEL = {"Prejardín": "Preescolar", "Prejardin II": "Preescolar", "Jardín I": "Preescolar", "Jardín II": "Preescolar",
         "Transición": "Preescolar", "Primero": "Primaria", "Segundo": "Primaria", "Tercero": "Primaria",
         "Cuarto": "Primaria", "Quinto": "Primaria", "Sexto": "Secundaria", "Septimo": "Secundaria",
         "Octavo": "Secundaria", "Noveno": "Secundaria", "Decimo": "Media", "Once": "Media",
         "Doce": "Media", "12º Normal": "Media", "13º Normal": "Media"}


def nivel(g):
    g = str(g).strip()
    return NIVEL.get(g, "Adultos y otros programas")


def anio(a):
    d = soql(CONJ, select="cod_dane_departamento, max(departamento) as departamento, sector, zona, grado, sum(total_matricula) as m",
             where=f"anno_inf='{a}'", group="cod_dane_departamento, sector, zona, grado")
    d["m"] = pd.to_numeric(d.m)
    d["depto"] = d.cod_dane_departamento.str.zfill(2)
    d["nivel"] = d.grado.map(nivel)
    d["sector"] = d.sector.str.strip().str.upper().str.replace("_", " ").map({"OFICIAL": "Público", "NO OFICIAL": "Privado"}).fillna("Sin dato")
    d["zona"] = d.zona.str.strip().str.capitalize()
    nombres = d.groupby("depto").departamento.first()
    x = d.groupby(["depto", "sector", "zona", "nivel"], as_index=False).m.sum().rename(columns={"m": "matricula"}).assign(anio=a)
    s = soql(CONJ, select="genero_1, grado, sum(total_matricula) as m", where=f"anno_inf='{a}'", group="genero_1, grado")
    s["m"] = pd.to_numeric(s.m)
    s["nivel"], s["sexo"] = s.grado.map(nivel), s.genero_1.fillna("Sin dato").str.strip()
    s = s.groupby(["sexo", "nivel"], as_index=False).m.sum().rename(columns={"m": "matricula"}).assign(anio=a)
    if abs(s.matricula.sum() - x.matricula.sum()) > 1:
        raise RuntimeError(f"{a}: el total por sexo no cuadra con el total por departamento")
    return x, s, nombres


def main():
    completo = "--completo" in sys.argv
    # (pedir la lista de años a toda la tabla es muy lento; se prueba año por año, que sí es rápido)
    hasta = date.today().year
    while soql(CONJ, select="count(*) as n", where=f"anno_inf='{hasta}'").n.astype(int).iloc[0] == 0:
        hasta -= 1
    anios = list(range(2010, hasta + 1))
    previo = DATOS / "matricula" / "datos.csv"
    if previo.exists() and not completo:
        viejo = pd.read_csv(previo, dtype={"depto": str})
        viejo_s = pd.read_csv(DATOS / "matricula" / "sexo.csv")
        nombres = dict(pd.read_csv(DATOS / "matricula" / "deptos.csv", dtype=str).values)
        rehacer = [a for a in anios if a not in set(viejo.anio) or a >= anios[-1] - 1]
    else:
        viejo, viejo_s, nombres, rehacer = None, None, {}, anios
    partes, partes_s = [], []
    for a in rehacer:
        x, s, n = anio(a)
        partes.append(x), partes_s.append(s), nombres.update(n.to_dict())
        print(f"  {a}: {x.matricula.sum():,.0f} matriculados")
        time.sleep(1)
    d = pd.concat(([viejo[~viejo.anio.isin(rehacer)]] if viejo is not None else []) + partes)
    s = pd.concat(([viejo_s[~viejo_s.anio.isin(rehacer)]] if viejo_s is not None else []) + partes_s)
    guardar(d[["anio", "depto", "sector", "zona", "nivel", "matricula"]], "matricula", "datos.csv", ["anio", "depto", "sector", "zona", "nivel"])
    guardar(s[["anio", "sexo", "nivel", "matricula"]], "matricula", "sexo.csv", ["anio", "sexo", "nivel"])
    guardar(pd.DataFrame(sorted(nombres.items()), columns=["depto", "nombre"]), "matricula", "deptos.csv", ["depto"])


if __name__ == "__main__":
    main()
