"""
Indicadores de los colegios por departamento - Ministerio de Educación, en datos.gov.co (ji8i-4anb). Anual, desde 2011.

Cobertura (cuántos niños en edad de estudiar están matriculados), deserción (cuántos se salen del colegio durante
el año), aprobación, reprobación y repitencia, por departamento.

El conjunto no trae el dato del país; aquí se estima como el promedio de los departamentos ponderado por su
población de 5 a 16 años. Es una aproximación (el Ministerio calcula el nacional con los totales).

Algunas columnas de este conjunto vienen corridas (por ejemplo, aprobación de transición o reprobación de primaria
tienen valores imposibles); por eso solo se usan las columnas que pasan un control de rango.

Salida: datos/indicadores/datos.csv  anio | depto | nombre | medida | valor   (depto = 00 para el estimado nacional)
Uso:  python scripts/indicadores.py
"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import guardar, soql  # noqa: E402

MEDIDAS = ["cobertura_neta", "cobertura_neta_transicion", "cobertura_neta_primaria", "cobertura_neta_secundaria",
           "cobertura_neta_media", "cobertura_bruta", "cobertura_bruta_transicion", "cobertura_bruta_primaria",
           "cobertura_bruta_secundaria", "cobertura_bruta_media", "desercion", "desercion_transicion",
           "desercion_primaria", "desercion_secundaria", "desercion_media", "aprobacion", "reprobacion", "repitencia",
           "tamano_promedio_grupo", "sedes_conectadas_a_internet"]
TOPE = {"desercion": 30, "reprobacion": 40, "repitencia": 40}  # valores por encima son errores del conjunto


def main():
    d = soql("ji8i-4anb")
    d["anio"] = d.ano.astype(int)
    d["depto"] = d.c_digo_departamento.str.zfill(2)
    d["nombre"] = d.departamento.str.strip()
    d["pob"] = pd.to_numeric(d.poblacion_5_16, errors="coerce")
    largo = d.melt(["anio", "depto", "nombre", "pob"], MEDIDAS, var_name="medida", value_name="valor")
    largo["valor"] = pd.to_numeric(largo.valor, errors="coerce")
    tope = largo.medida.map(lambda m: next((v for k, v in TOPE.items() if m.startswith(k)), 400))
    malos = (largo.valor < 0) | (largo.valor > tope)
    if malos.any():
        print(f"  {malos.sum()} valores fuera de rango descartados")
    largo = largo[~malos & largo.valor.notna()]
    pond = largo.assign(vp=largo.valor * largo.pob).groupby(["anio", "medida"])
    nac = (pond.vp.sum() / pond.pob.sum()).rename("valor").reset_index().assign(depto="00", nombre="Colombia (estimado)")
    out = pd.concat([largo.drop(columns="pob"), nac])[["anio", "depto", "nombre", "medida", "valor"]]
    out["valor"] = out.valor.round(2)
    pob = d[["anio", "depto", "nombre", "pob"]].rename(columns={"pob": "valor"}).assign(medida="poblacion_5_16")
    out = pd.concat([out, pob])
    guardar(out, "indicadores", "datos.csv", ["anio", "depto", "medida"])
    u = nac[nac.anio == nac.anio.max()].set_index("medida").valor
    print(f"  {nac.anio.max()}: cobertura neta {u.cobertura_neta:.1f}%, deserción {u.desercion:.2f}%")


if __name__ == "__main__":
    main()
