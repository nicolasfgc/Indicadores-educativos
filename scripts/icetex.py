"""
ICETEX - créditos educativos, en datos.gov.co.

1. Cartera (dugh-vkir, trimestral): cuántos créditos tiene vivos el ICETEX, cuántos están al día y cuántos en mora,
   por departamento y por "época" (ESTUDIOS = el estudiante aún estudia; AMORTIZACION = ya está pagando).
2. Créditos nuevos (26bn-e42j) y renovaciones (nvcf-b8a3), por semestre, con el nivel de formación,
   el estrato, el sexo y si la institución es pública o privada.

Salida (formato largo):
  datos/icetex/cartera.csv   fecha | depto | epoca | medida | valor   (depto = TOTAL para el país)
       medidas: creditos, al_dia, en_mora, mora_mayor, saldo_total, saldo_mora (pesos)
  datos/icetex/creditos.csv  periodo | tipo (nuevos/renovados) | dimension | categoria | valor
       dimension: total, nivel, estrato, sexo, sector_ies, departamento

Uso:  python scripts/icetex.py
"""
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import guardar, soql  # noqa: E402

NIVELES = {  # agrupación sencilla de los niveles de formación
    "Universitario": "Pregrado universitario", "Tecnológico": "Técnico o tecnológico",
    "Formación técnica profesional": "Técnico o tecnológico", "Formació técnica profesional": "Técnico o tecnológico",
    "Normalista": "Técnico o tecnológico", "Especialización universitaria": "Posgrado", "Maestría": "Posgrado",
    "Doctorado": "Posgrado", "Especialización médico quirurgica": "Posgrado", "Especialización tecnológica": "Posgrado",
    "Especialización técnico profesional": "Posgrado", "Exterior": "Estudios en el exterior",
    "Educación continuada": "Otros"}


# nombres de departamento: la fuente los escribe de varias formas (con y sin tildes, sin espacios, con capitales)
DEPTOS = ["AMAZONAS", "ANTIOQUIA", "ARAUCA", "ATLÁNTICO", "BOGOTÁ", "BOLÍVAR", "BOYACÁ", "CALDAS", "CAQUETÁ", "CASANARE", "CAUCA",
          "CESAR", "CHOCÓ", "CÓRDOBA", "CUNDINAMARCA", "GUAINÍA", "GUAVIARE", "HUILA", "LA GUAJIRA", "MAGDALENA", "META", "NARIÑO",
          "NORTE DE SANTANDER", "PUTUMAYO", "QUINDÍO", "RISARALDA", "SAN ANDRÉS", "SANTANDER", "SUCRE", "TOLIMA", "VALLE DEL CAUCA",
          "VAUPÉS", "VICHADA", "EXTRANJERO"]
llave = lambda x: re.sub(r"[^A-Z]", "", unicodedata.normalize("NFKD", str(x).upper()).encode("ascii", "ignore").decode())
CANON = {llave(d): d for d in DEPTOS}
CANON.update({"DISTRITOCAPITAL": "BOGOTÁ", "BOGOTADC": "BOGOTÁ", "CARTAGENA": "BOLÍVAR", "YOPAL": "CASANARE", "GUAJIRA": "LA GUAJIRA",
              "ARCHIPIELAGODESANANDRESPROVIDENCIAYSANTACATALINA": "SAN ANDRÉS"})


def depto(s):
    return s.map(lambda x: CANON.get(llave(x), "SIN DATO"))


def pesos(s):
    return pd.to_numeric(s.str.replace(r"[$,\s]", "", regex=True), errors="coerce").fillna(0)


def cartera():
    d = soql("dugh-vkir")
    d["fecha"] = d.fecha_corte.str[:10]
    d["epoca"] = d.epoca_cartera.str.upper().str.strip().map({"ESTUDIOS": "estudios", "AMORTIZACION": "pagando"})
    d["depto"] = depto(d.deptoresidencia)
    for c, n in [("total_creditos", "creditos"), ("cantidad_creditos_al_dia", "al_dia"),
                 ("cantidad_creditos_con_mora", "con_mora"), ("cantidad_creditos_mora_mayor", "mora_mayor")]:
        d[n] = pd.to_numeric(d[c], errors="coerce").fillna(0)
    d["en_mora"] = d.con_mora + d.mora_mayor
    d["saldo_total"], d["saldo_mora"] = pesos(d.saldo_total), pesos(d.saldo_mora)
    med = ["creditos", "al_dia", "en_mora", "mora_mayor", "saldo_total", "saldo_mora"]
    g = d.groupby(["fecha", "depto", "epoca"], as_index=False)[med].sum()
    pais = g.groupby(["fecha", "epoca"], as_index=False)[med].sum().assign(depto="TOTAL")
    todo = pd.concat([g, pais])
    ambos = todo.groupby(["fecha", "depto"], as_index=False)[med].sum().assign(epoca="todas")
    todo = pd.concat([todo, ambos]).melt(["fecha", "depto", "epoca"], var_name="medida", value_name="valor")
    guardar(todo, "icetex", "cartera.csv", ["fecha", "depto", "epoca", "medida"])
    u = todo[(todo.fecha == todo.fecha.max()) & (todo.depto == "TOTAL") & (todo.epoca == "todas")].set_index("medida").valor
    print(f"  cartera {todo.fecha.max()}: {u.creditos:,.0f} créditos, {u.en_mora / u.creditos:.1%} en mora")


def creditos():
    partes = []
    for conj, tipo, per, val, dep in [("26bn-e42j", "nuevos", "periodo_otorgamiento", "numero_de_nuevos_beneficiarios", "departamento_de_origen"),
                                      ("nvcf-b8a3", "renovados", "periodo_renovacion", "numero_de_renovaciones", "departamento_de_origen")]:
        d = soql(conj)
        d["valor"] = pd.to_numeric(d[val], errors="coerce").fillna(0)
        d["periodo"] = d[per].str.strip()
        d["nivel"] = d.nivel_de_formacion.str.strip().map(NIVELES).fillna("Otros")
        d["estrato"] = "Estrato " + d.estrato_socio_economico.fillna("sin dato").str.strip()
        d["sexo"] = d.sexo_al_nacer.fillna("Sin dato").str.strip().str.capitalize()
        d["sector_ies"] = d.sector_ies.fillna("N/A").str.strip().str.capitalize().replace({"N/a": "No aplica (exterior)"})
        d["departamento"] = depto(d[dep])
        d["total"] = "Total"
        for dim in ["total", "nivel", "estrato", "sexo", "sector_ies", "departamento"]:
            g = d.groupby(["periodo", dim], as_index=False).valor.sum().rename(columns={dim: "categoria"})
            partes.append(g.assign(tipo=tipo, dimension=dim))
    c = pd.concat(partes)[["periodo", "tipo", "dimension", "categoria", "valor"]]
    guardar(c, "icetex", "creditos.csv", ["periodo", "tipo", "dimension", "categoria"])
    t = c[c.dimension == "total"].pivot(index="periodo", columns="tipo", values="valor").tail(4)
    print(t.to_string())


def main():
    cartera()
    creditos()


if __name__ == "__main__":
    main()
