"""
Calidad de la educación: resultados de los exámenes del ICFES, a partir de los "cuadros de salida" de su operación
estadística oficial (https://www.icfes.gov.co/estadisticas-oficiales/). Cada año el ICFES publica un archivo con toda
la serie desde 2016, así que basta con leer el más reciente.

  Saber 11 (lo presentan los estudiantes de grado once; puntaje global de 0 a 500 y cada prueba de 0 a 100).
    Se usa el calendario A, el de la gran mayoría de colegios (el calendario B es casi todo privado y se presenta a mitad de año).
  Saber Pro (lo presentan los estudiantes al terminar una carrera universitaria; escala con promedio 150 en 2016).

Salida (formato largo):
  datos/icfes/saber11.csv   anio | grupo | categoria | sector | medida | valor
       grupo: nacional, nse (nivel socioeconómico 1 a 4), genero, depto (código DANE), sector_zona
       medida: global, Matemáticas, Lectura crítica, ..., y niveles de desempeño ("Matemáticas|Nivel 1", en %)
  datos/icfes/saberpro.csv  anio | grupo | categoria | sector | medida | valor

Uso:  python scripts/icfes.py
"""
import io
import re
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import bajar, cod_depto, guardar  # noqa: E402

PAGINA = "https://www.icfes.gov.co/estadisticas-oficiales/"
SECTOR = {"TOTAL": "Total", "0_TOTAL": "Total", "NO OFICIAL": "Privado", "PRIVADO": "Privado", "OFICIAL": "Público",
          "PUBLICO": "Público", "PÚBLICO": "Público"}
PRUEBAS = {"MATEMATICAS": "Matemáticas", "MATEMÁTICAS": "Matemáticas", "LECTURA CRITICA": "Lectura crítica", "LECTURA CRÍTICA": "Lectura crítica",
           "SOCIALES Y CIUDADANAS": "Sociales y ciudadanas", "CIENCIAS NATURALES": "Ciencias naturales", "INGLES": "Inglés", "INGLÉS": "Inglés",
           "RAZONAMIENTO CUANTITATIVO": "Razonamiento cuantitativo", "COMPETENCIAS CIUDADANAS": "Competencias ciudadanas",
           "COMUNICACION ESCRITA": "Comunicación escrita"}


def ultimo(html, examen):
    urls = re.findall(r'https?://[^"\'<> ]+\.xlsx', html)
    cands = []
    for u in set(urls):
        m = re.search(rf"cuadros[-_]salida[-_]{examen}[-_](\d{{4}})", u, re.I)
        if m:
            cands.append((int(m.group(1)), u))
    if not cands:
        raise RuntimeError(f"No se encontró el archivo de {examen} en la página del ICFES")
    return max(cands)


def tabla(hojas, nombre):
    """La hoja como tabla: busca la fila de títulos (la que dice Periodo o AÑO) y devuelve solo las filas con datos."""
    d = hojas[nombre]
    i = next(i for i in range(min(30, len(d))) if any(str(x).strip().upper() in ("PERIODO", "AÑO") for x in d.iloc[i]))
    cols = [" ".join(str(x).split()) for x in d.iloc[i]]
    # títulos de dos pisos (prueba en una fila y "Nivel 1..." en la siguiente)
    sub = [" ".join(str(x).split()) for x in d.iloc[i + 1]] if i + 1 < len(d) else []
    if any(s.startswith("Nivel") for s in sub):
        prueba = None
        for k, (c, s) in enumerate(zip(cols, sub)):
            if c != "nan":
                prueba = c
            if s.startswith("Nivel"):
                cols[k] = f"{prueba}|{s}"
        i += 1
    x = d.iloc[i + 1:].copy()
    x.columns = cols
    x = x.loc[:, [c for c in cols if c != "nan"]]
    per = next(c for c in x.columns if c.upper() in ("PERIODO", "AÑO"))
    x = x[pd.to_numeric(x[per], errors="coerce").notna()].rename(columns={per: "periodo"})
    x["periodo"] = pd.to_numeric(x.periodo).astype(int)
    return x


def largo(x, grupo, cat=None, sector=None, s11=True):
    """Pasa una tabla ancha a formato largo. cat: columna de categoría; sector: columna del sector."""
    if s11:   # solo calendario A: los periodos que no terminan en 1 (20162, 20194, 20253...)
        x = x[x.periodo.astype(str).str[-1] != "1"]
    x = x.assign(anio=x.periodo.astype(str).str[:4].astype(int))
    llaves = ["periodo", "anio"] + [c for c in (cat, sector) if c]
    medidas = [c for c in x.columns if c not in llaves and not c.upper().startswith(("COD", "NATURALEZA"))]
    m = x.melt(llaves, medidas, var_name="medida", value_name="valor")
    m["valor"] = pd.to_numeric(m.valor, errors="coerce")
    m = m[m.valor.notna()]
    m["grupo"] = grupo
    m["categoria"] = m[cat].astype(str).str.strip() if cat else "Total"
    m["sector"] = m[sector].astype(str).str.strip().str.upper().map(SECTOR).fillna(m[sector].astype(str)) if sector else "Total"

    def med(v):
        v = str(v)
        if "|" in v:
            p, n = v.split("|")
            return PRUEBAS.get(p.strip().upper(), p.strip()) + "|" + n
        if "PROMEDIO" in v.upper():
            return "global"
        return PRUEBAS.get(v.strip().upper(), v.strip())
    m["medida"] = m.medida.map(med)
    return m[["anio", "grupo", "categoria", "sector", "medida", "valor"]]


def saber11(hojas):
    partes = [
        largo(tabla(hojas, "prom_glob_nal"), "nacional", sector="Sector"),
        largo(tabla(hojas, "prom_prueb_nal"), "nacional", sector="Sector"),
        largo(tabla(hojas, "niv_prueb_nal"), "nacional", sector="Sector"),
        largo(tabla(hojas, "prom_glob_NSE"), "nse", cat="Nivel Socioeconómico"),
        largo(tabla(hojas, "prom_prueb_NSE"), "nse", cat="Nivel Socioeconómico"),
        largo(tabla(hojas, "prom_glob_gen"), "genero", cat="Genero"),
        largo(tabla(hojas, "prom_glob_dep"), "depto", cat="Departamento", sector="Sector"),
        largo(tabla(hojas, "prom_prueb_dep"), "depto", cat="Departamento", sector="Sector"),
    ]
    if "prom_glob_seczon" in hojas:
        t = tabla(hojas, "prom_glob_seczon")
        partes.append(largo(t, "sector_zona", cat=next(c for c in t.columns if "zona" in c.lower())))
    d = pd.concat(partes)
    dep = d.grupo == "depto"
    d.loc[dep, "categoria"] = d.loc[dep, "categoria"].map(cod_depto)
    d = d[d.categoria.notna()]
    d["categoria"] = d.categoria.replace({"Femenino": "Mujeres", "Masculino": "Hombres", "Oficial-Rural": "Públicos rurales",
                                          "Oficial-Urbano": "Públicos urbanos", "No Oficial": "Privados"})
    return d.groupby(["anio", "grupo", "categoria", "sector", "medida"], as_index=False).valor.mean()


def saberpro(hojas):
    partes = [largo(tabla(hojas, "prom_glob_nal"), "nacional", sector=next(c for c in tabla(hojas, "prom_glob_nal").columns if c.upper().startswith("NATURALEZA")), s11=False)]
    t = tabla(hojas, "prom_glob_NSE")
    partes.append(largo(t, "nse", cat=next(c for c in t.columns if "SOCIOECON" in c.upper()), s11=False))
    t = tabla(hojas, "prom_glob_gen")
    partes.append(largo(t, "genero", cat=next(c for c in t.columns if c.upper().startswith("GENERO")), s11=False))
    t = tabla(hojas, "prom_glob_dep")
    nat = next(c for c in t.columns if c.upper().startswith("NATURALEZA"))
    t = t.drop(columns=[c for c in t.columns if c.upper().startswith("COD")])
    partes.append(largo(t, "depto", cat="DEPARTAMENTO", sector=nat, s11=False))
    # puntajes de las pruebas genéricas (las que presentan todos los estudiantes, sin importar la carrera)
    t = tabla(hojas, "prom_prueb_nal")
    p = largo(t, "nacional", sector=next(c for c in t.columns if c.upper().startswith("NATURALEZA")), s11=False)
    partes.append(p[p.medida.isin(set(PRUEBAS.values()))])
    d = pd.concat(partes)
    dep = d.grupo == "depto"
    d.loc[dep, "categoria"] = d.loc[dep, "categoria"].map(cod_depto)
    d = d[d.categoria.notna()]
    d["categoria"] = d.categoria.replace({"FEMENINO": "Mujeres", "MASCULINO": "Hombres"})
    return d.groupby(["anio", "grupo", "categoria", "sector", "medida"], as_index=False).valor.mean()


def main():
    pag = bajar(PAGINA).decode("utf-8", "ignore")
    for examen, fn, nombre in [("saber-11", saber11, "saber11.csv"), ("saber-pro", saberpro, "saberpro.csv")]:
        anio, url = ultimo(pag, examen)
        print(f"{examen}: {url.rsplit('/', 1)[-1]}")
        hojas = pd.read_excel(io.BytesIO(bajar(url, timeout=600)), sheet_name=None, header=None, engine="calamine")
        d = fn(hojas)
        d["valor"] = d.valor.round(3)
        guardar(d, "icfes", nombre, ["anio", "grupo", "categoria", "sector", "medida"])
        n = d[(d.grupo == "nacional") & (d.sector == "Total") & (d.medida == "global")].set_index("anio").valor
        print("  puntaje global nacional:", n.round(1).to_dict())


if __name__ == "__main__":
    main()
