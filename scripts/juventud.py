"""
Jóvenes de 15 a 28 años: estudio y trabajo — DANE, Gran Encuesta Integrada de Hogares (GEIH),
anexo "Mercado laboral de la juventud". Sale cada mes, en trimestre móvil (por ejemplo, junio a agosto),
con la serie completa desde 2007.

Qué se guarda (datos/juventud/datos.csv, formato largo fecha | id_serie | medida | valor):
  id_serie  JUV_<DOMINIO>[_HOMBRES|_MUJERES]   dominio: NACIONAL, CABECERAS (urbano), RURAL
  medidas   ninis, pct_ninis (jóvenes que no estudian ni trabajan, en miles y como % de los jóvenes del grupo),
            poblacion (jóvenes de 15 a 28 años, miles), tgp, to, td (tasas en %), ocupados, desocupados (miles)
  fecha     el último mes del trimestre móvil (jun-ago 2026 -> 2026-08-01)

El porcentaje de ninis de hombres y de mujeres se calcula sobre los jóvenes de cada sexo (el anexo lo da
sobre el total de jóvenes, lo que no permite comparar entre sexos).

Uso:  python scripts/juventud.py
"""
import io
import re
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import bajar, guardar  # noqa: E402

DANE = "https://www.dane.gov.co"
PAGINA = "/index.php/estadisticas-por-tema/mercado-laboral/mercado-laboral-de-la-juventud"
MES = {"ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6, "jul": 7, "ago": 8, "sep": 9, "oct": 10, "nov": 11, "dic": 12}
DOMINIOS = {"Total Nacional": "NACIONAL", "Total Cabeceras": "CABECERAS", "Total Centros Poblados y Rural Disperso": "RURAL"}
MEDIDAS = {"Tasa Global de Participación": "tgp", "Tasa de Ocupación": "to", "Tasa de Desocupación": "td",
           "Población en edad de trabajar (PET) de 15 a 28 años": "poblacion", "Población ocupada": "ocupados",
           "Población desocupada": "desocupados"}


def fecha(etq):
    """'Jun - Ago 26' o 'Dic 25 - Feb 26' -> '2026-08-01' (último mes del trimestre)."""
    m = re.search(r"-\s*([A-Za-z]{3})\w*\.?\s*(\d{2})\s*$", str(etq).strip())
    if not m or m.group(1).lower() not in MES:
        return None
    return f"20{m.group(2)}-{MES[m.group(1).lower()]:02d}-01"


def bloques(d):
    """Recorre la hoja: cada bloque empieza con su título y una fila 'Concepto' seguida de las etiquetas de periodo."""
    for i in range(1, len(d) - 1):
        if str(d.iat[i, 0]).strip() != "Concepto":
            continue
        titulo = " ".join(str(d.iat[i - 1, 0]).split())
        fechas = {j: fecha(d.iat[i + 1, j]) for j in range(1, d.shape[1])}
        fechas = {j: f for j, f in fechas.items() if f}
        filas = []
        for k in range(i + 2, len(d)):
            nombre = d.iat[k, 0]
            if pd.isna(nombre) or str(nombre).strip() == "Concepto":
                break
            filas.append((" ".join(str(nombre).split()), {f: d.iat[k, j] for j, f in fechas.items()}))
        yield titulo, filas


def id_de(titulo):
    base, _, sexo = titulo.partition(" - ")
    if base not in DOMINIOS:
        return None
    return "JUV_" + DOMINIOS[base] + ("_" + sexo.strip().upper() if sexo else "")


def main():
    html = bajar(DANE + PAGINA).decode("utf-8", "ignore")
    url = next((h for h in re.findall(r'href="([^"]+anex-GEIHMLJ-[^"]+\.xlsx)"', html)), None)
    if not url:
        raise RuntimeError("No se encontró el anexo de juventud en la página del DANE")
    url = url if url.startswith("http") else DANE + url
    print("Anexo:", url.rsplit("/", 1)[-1])
    hojas = pd.read_excel(io.BytesIO(bajar(url)), sheet_name=None, header=None)
    nal = next(v for k, v in hojas.items() if k.strip().lower().startswith("tnal trimestre"))
    noe = next(v for k, v in hojas.items() if k.strip().lower().startswith("jóvenes_noe"))

    filas = []
    for titulo, renglones in bloques(nal):
        sid = id_de(titulo)
        if not sid:
            continue
        for nombre, valores in renglones:
            med = next((v for k, v in MEDIDAS.items() if nombre.startswith(k)), None)
            if med:
                filas += [(f, sid, med, float(x)) for f, x in valores.items() if pd.notna(x)]
    # ninis: el anexo trae el total nacional y su división por sexo, en miles
    for titulo, renglones in bloques(noe):
        if titulo != "Total Nacional":
            continue
        for nombre, valores in renglones:
            n = nombre.lower()
            if "no estudian" not in n or n.startswith("proporción"):
                continue
            sid = "JUV_NACIONAL_HOMBRES" if "hombres" in n else "JUV_NACIONAL_MUJERES" if "mujeres" in n else "JUV_NACIONAL"
            filas += [(f, sid, "ninis", float(x)) for f, x in valores.items() if pd.notna(x)]

    d = pd.DataFrame(filas, columns=["fecha", "id_serie", "medida", "valor"]).drop_duplicates(["fecha", "id_serie", "medida"], keep="last")
    # % de ninis dentro de cada grupo
    p = d.pivot_table(index=["fecha", "id_serie"], columns="medida", values="valor")
    pct = (p.ninis / p.poblacion * 100).dropna().rename("valor").reset_index()
    pct["medida"] = "pct_ninis"
    d = pd.concat([d, pct[["fecha", "id_serie", "medida", "valor"]]], ignore_index=True)

    # control: hombres + mujeres = total (ninis y población)
    q = d[d.medida.isin(["ninis", "poblacion"])].pivot_table(index=["fecha", "medida"], columns="id_serie", values="valor")
    dif = (q.JUV_NACIONAL_HOMBRES + q.JUV_NACIONAL_MUJERES - q.JUV_NACIONAL).abs().max()
    assert dif < 1, f"hombres + mujeres no da el total ({dif})"

    series = pd.DataFrame([
        dict(id_serie="JUV_NACIONAL", nombre="Jóvenes de 15 a 28 años, total nacional", grupo="Total", zona="Nacional"),
        dict(id_serie="JUV_NACIONAL_HOMBRES", nombre="Hombres de 15 a 28 años", grupo="Hombres", zona="Nacional"),
        dict(id_serie="JUV_NACIONAL_MUJERES", nombre="Mujeres de 15 a 28 años", grupo="Mujeres", zona="Nacional"),
        dict(id_serie="JUV_CABECERAS", nombre="Jóvenes en cabeceras (zonas urbanas)", grupo="Total", zona="Urbana"),
        dict(id_serie="JUV_CABECERAS_HOMBRES", nombre="Hombres en cabeceras", grupo="Hombres", zona="Urbana"),
        dict(id_serie="JUV_CABECERAS_MUJERES", nombre="Mujeres en cabeceras", grupo="Mujeres", zona="Urbana"),
        dict(id_serie="JUV_RURAL", nombre="Jóvenes en centros poblados y zona rural", grupo="Total", zona="Rural"),
        dict(id_serie="JUV_RURAL_HOMBRES", nombre="Hombres en zona rural", grupo="Hombres", zona="Rural"),
        dict(id_serie="JUV_RURAL_MUJERES", nombre="Mujeres en zona rural", grupo="Mujeres", zona="Rural")])
    series["fuente"] = "DANE, GEIH - Mercado laboral de la juventud (trimestre móvil)"
    guardar(d.round(4), "juventud", "datos.csv", ["fecha", "id_serie", "medida"])
    guardar(series, "juventud", "series.csv", ["id_serie"])
    u = d.fecha.max()
    print("Último trimestre:", u, "| ninis nacional:", round(d[(d.fecha == u) & (d.id_serie == "JUV_NACIONAL") & (d.medida == "pct_ninis")].valor.iloc[0], 2), "%")


if __name__ == "__main__":
    main()
