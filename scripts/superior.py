"""
Educación superior (universidades, instituciones universitarias, tecnológicas y técnicas) - Ministerio de Educación, SNIES,
"Bases consolidadas" (https://snies.mineducacion.gov.co/portal/ESTADISTICAS/Bases-consolidadas/). Una base por año desde 2014,
con el detalle por programa académico y semestre de:
  - matriculados: todos los estudiantes matriculados
  - primer_curso: los que entran por primera vez a un programa (los "nuevos")
  - graduados

Cada base trae un renglón por institución, programa, sexo y semestre. Aquí se agrega a lo que la página necesita:
  datos/superior/datos.csv    anio | semestre | tipo | sector | nivel_academico | nivel_formacion | modalidad | sexo | valor
  datos/superior/deptos.csv   anio | semestre | tipo | depto (código DANE donde se ofrece el programa) | sector | nivel_academico | valor
  datos/superior/areas.csv    anio | semestre | tipo | area (área de conocimiento) | nivel_academico | valor
  datos/superior/ies.csv      anio | semestre | tipo | cod_ies | ies | sector | caracter | valor   (pregrado y posgrado)

Las bases pesan entre 10 y 20 MB cada una: solo se bajan los años que faltan y los dos últimos (el Ministerio los corrige).
Uso:  python scripts/superior.py [--completo]
"""
import html
import io
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import DATOS, bajar, guardar  # noqa: E402

PAGINA = "https://snies.mineducacion.gov.co/portal/ESTADISTICAS/Bases-consolidadas/"
BASE = "https://snies.mineducacion.gov.co/1778/"
TIPOS = {"matriculados en primer curso": "primer_curso", "matriculados": "matriculados", "graduados": "graduados"}
DESDE = 2014
CARPETA = DATOS / "superior"


def plano(x):
    x = unicodedata.normalize("NFKD", str(x)).encode("ascii", "ignore").decode()
    return " ".join(x.upper().split())


def enlaces():
    """{(tipo, año): url} a partir de los títulos de la página del SNIES."""
    pag = bajar(PAGINA).decode("utf-8", "ignore")
    out = {}
    for href, texto in re.findall(r'<a[^>]+href="(articles-\d+_recurso\.xlsx)"[^>]*>(.*?)</a>', pag, re.S):
        t = html.unescape(re.sub("<[^>]+>", "", texto)).strip().lower()
        m = re.match(r"estudiantes (matriculados en primer curso|matriculados|graduados) (\d{4})$", " ".join(t.split()))
        if m and int(m.group(2)) >= DESDE:
            out[(TIPOS[m.group(1)], int(m.group(2)))] = BASE + href
    return out


def columna(cols, *claves, evitar=("ID ", "CODIGO")):
    for c in cols:
        p = plano(c)
        if all(k in p for k in claves) and not any(p.startswith(e) for e in evitar):
            return c
    return None


def leer(url):
    hojas = pd.read_excel(io.BytesIO(bajar(url, timeout=600)), sheet_name=None, header=None, engine="calamine")
    for nombre, d in hojas.items():
        for i in range(min(20, len(d))):
            fila = [plano(v) for v in d.iloc[i]]
            if "SECTOR IES" in fila and any(v.startswith("SEMESTRE") for v in fila):
                x = d.iloc[i + 1:].copy()
                x.columns = [" ".join(str(v).split()) for v in d.iloc[i]]
                return x
    raise RuntimeError(f"No se encontró la tabla en {url}")


def normalizar(x, tipo, anio):
    cols = list(x.columns)
    c = {"sector": columna(cols, "SECTOR IES"), "caracter": columna(cols, "CARACTER IES"),
         "nivel_academico": columna(cols, "NIVEL ACADEMICO"), "nivel_formacion": columna(cols, "NIVEL DE FORMACION"),
         "modalidad": columna(cols, "MODALIDAD") or columna(cols, "METODOLOGIA"), "sexo": columna(cols, "SEXO"),
         "semestre": columna(cols, "SEMESTRE"), "area": columna(cols, "AREA DE CONOCIMIENTO"),
         "ies": columna(cols, "INSTITUCION DE EDUCACION SUPERIOR"), "cod_ies": columna(cols, "INSTITUCION", evitar=("ID ",)),
         "depto": next((k for k in cols if "DEPARTAMENTO" in plano(k) and "PROGRAMA" in plano(k) and plano(k).startswith("CODIGO")), None)}
    faltan = [k for k, v in c.items() if v is None]
    if faltan:
        raise RuntimeError(f"{tipo} {anio}: no se encontraron las columnas {faltan} en {cols}")
    valor = cols[-1]   # la última columna es la cifra (MATRICULADOS, GRADUADOS, PRIMER CURSO...)
    d = pd.DataFrame({k: x[v] for k, v in c.items()})
    d["valor"] = pd.to_numeric(x[valor], errors="coerce")
    d = d[d.valor.notna() & pd.to_numeric(d.semestre, errors="coerce").notna()]
    d["semestre"] = pd.to_numeric(d.semestre).astype(int)
    d["anio"], d["tipo"] = anio, tipo
    t = lambda s: s.fillna("Sin dato").astype(str).str.strip()
    d["sector"] = t(d.sector).map(lambda v: "Pública" if plano(v) == "OFICIAL" else "Privada" if plano(v).startswith("PRIVAD") else "Sin dato")
    d["nivel_academico"] = t(d.nivel_academico).str.capitalize()
    d["nivel_formacion"] = t(d.nivel_formacion).map(lambda v: v[:1].upper() + v[1:].lower())
    mod = t(d.modalidad).map(plano)
    d["modalidad"] = mod.map(lambda v: "Presencial" if v == "PRESENCIAL" else "A distancia" if v in ("A DISTANCIA", "DISTANCIA (TRADICIONAL)", "DISTANCIA TRADICIONAL")
                             else "Virtual" if v in ("VIRTUAL", "DISTANCIA (VIRTUAL)", "DISTANCIA VIRTUAL") else "Sin dato" if v == "SIN DATO" else "Combinada (presencial, virtual o dual)")
    d["sexo"] = t(d.sexo).map(lambda v: {"MASCULINO": "Hombres", "HOMBRE": "Hombres", "FEMENINO": "Mujeres", "MUJER": "Mujeres"}.get(plano(v), "Otro o sin dato"))
    d["area"] = t(d.area).map(lambda v: v[:1].upper() + v[1:].lower())
    d["caracter"] = t(d.caracter)
    d["ies"] = t(d.ies)
    d["cod_ies"] = pd.to_numeric(d.cod_ies, errors="coerce").fillna(0).astype(int)
    d["depto"] = pd.to_numeric(d.depto, errors="coerce").fillna(0).astype(int).map(lambda v: f"{v:02d}")
    return d


def agregar(d):
    g = lambda cols: d.groupby(["anio", "semestre", "tipo"] + cols, as_index=False).valor.sum()
    ies = g(["cod_ies", "sector", "caracter"]).merge(d.groupby("cod_ies").ies.agg(lambda s: s.mode().iat[0]).reset_index(), on="cod_ies")
    return {"datos": g(["sector", "nivel_academico", "nivel_formacion", "modalidad", "sexo"]),
            "deptos": g(["depto", "sector", "nivel_academico"]),
            "areas": g(["area", "nivel_academico"]),
            "ies": ies[["anio", "semestre", "tipo", "cod_ies", "ies", "sector", "caracter", "valor"]]}


CLAVES = {"datos": ["anio", "semestre", "tipo", "sector", "nivel_academico", "nivel_formacion", "modalidad", "sexo"],
          "deptos": ["anio", "semestre", "tipo", "depto", "sector", "nivel_academico"],
          "areas": ["anio", "semestre", "tipo", "area", "nivel_academico"],
          "ies": ["anio", "semestre", "tipo", "cod_ies", "sector", "caracter"]}


def main():
    completo = "--completo" in sys.argv
    links = enlaces()
    if not links:
        raise RuntimeError("No se encontraron bases en la página del SNIES")
    previos = {k: pd.read_csv(CARPETA / f"{k}.csv", dtype={"depto": str}) for k in CLAVES if (CARPETA / f"{k}.csv").exists() and not completo}
    hechos = set(zip(previos["datos"].tipo, previos["datos"].anio)) if "datos" in previos else set()
    ultimo = max(a for _, a in links)
    pendientes = sorted(k for k in links if k not in hechos or k[1] >= ultimo - 1)
    print(f"Bases disponibles: {len(links)} | por procesar: {pendientes}")
    nuevos = {k: [] for k in CLAVES}
    for tipo, anio in pendientes:
        try:
            d = normalizar(leer(links[(tipo, anio)]), tipo, anio)
        except Exception as e:  # noqa: BLE001  una base mala no debe tumbar las demás
            print(f"  ERROR {tipo} {anio}: {e}")
            continue
        for k, v in agregar(d).items():
            nuevos[k].append(v)
        s = d.groupby("semestre").valor.sum()
        print(f"  {tipo} {anio}: " + ", ".join(f"semestre {i}: {v:,.0f}" for i, v in s.items()))
    for k, claves in CLAVES.items():
        if not nuevos[k]:
            continue
        hecho = pd.concat(nuevos[k])
        listos = set(zip(hecho.tipo, hecho.anio))
        viejo = previos.get(k)
        if viejo is not None:
            viejo = viejo[[(t, a) not in listos for t, a in zip(viejo.tipo, viejo.anio)]]
        todo = pd.concat(([viejo] if viejo is not None else []) + [hecho])
        guardar(todo.groupby(claves + (["ies"] if k == "ies" else []), as_index=False).valor.sum()
                .drop_duplicates(claves, keep="first"), "superior", f"{k}.csv", claves)


if __name__ == "__main__":
    main()
