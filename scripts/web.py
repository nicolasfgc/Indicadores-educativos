"""
Prepara versiones livianas de los datos para el explorador web (carpeta web/).

Los CSV de datos/ son la fuente completa para quien quiera descargar; estos JSON solo
tienen lo que la página muestra, en el formato más compacto posible, para que cargue rápido.
Se regenera en cada corrida de la tarea automática.

Uso:  python scripts/web.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mapa  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
DATOS = RAIZ / "datos"
WEB = RAIZ / "web"


def guardar(nombre, obj):
    p = WEB / nombre
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(f"  {nombre}: {p.stat().st_size / 1024:,.0f} KB")


def limpiar(v, dec=2):
    return None if v is None or (isinstance(v, float) and np.isnan(v)) else round(float(v), dec)


def lista(s, claves, dec=2):
    return [limpiar(s.get(k), dec) for k in claves]


# ---------------------------------------------------------------- jóvenes (GEIH, mensual)
def juventud():
    d = pd.read_csv(DATOS / "juventud" / "datos.csv")
    s = pd.read_csv(DATOS / "juventud" / "series.csv", dtype=str)
    fechas = sorted(d.fecha.unique())
    valores = {}
    for (sid, med), g in d.groupby(["id_serie", "medida"]):
        valores.setdefault(sid, {})[med] = lista(g.set_index("fecha").valor, fechas, 2)
    guardar("juventud.json", {"fechas": fechas, "series": s[["id_serie", "nombre", "grupo", "zona"]].values.tolist(), "valores": valores})


# ---------------------------------------------------------------- presupuesto del sector
VAL = ["apropiacion_vigente", "compromisos", "obligaciones", "pagos",
       "cambio_mes_apropiacion_vigente", "cambio_mes_compromisos", "cambio_mes_obligaciones", "cambio_mes_pagos"]
# "¿En qué se va la plata?": cada rubro se clasifica en un destino que cualquiera entiende
DESTINOS = ["Colegios públicos: pago de docentes y funcionamiento", "Pensiones y prestaciones de los maestros",
            "Universidades y educación superior pública", "Alimentación escolar (PAE)",
            "Inversión en colegios: infraestructura y calidad", "Ministerio y otros gastos"]


def destino(r):
    t = " ".join([r.nombre_2, r.nombre_3, r.nombre_4, r.nombre_5]).upper()
    if "SISTEMA GENERAL DE PARTICIPACIONES" in r.nombre_4.upper() and "DISTINTAS" not in r.nombre_4.upper():
        return 0
    if "MAGISTERIO" in t or "PASIVO PENSIONAL" in t:
        return 1
    if r.codigo_entidad == "22-46-00" or "ALIMENTACIÓN ESCOLAR" in t:
        return 3
    if r.codigo_entidad != "22-01-01" or "SUPERIOR" in t or "UNIVERSIDAD" in t:
        return 2
    if r.nombre_1.startswith("INVERSI") and any(x in t for x in ["BÁSICA", "PRESCOLAR", "PREESCOLAR", "INICIAL", "TERRITORIALES", "AMBIENTES EDUCATIVOS", "ESPACIOS DE APRENDIZAJE"]):
        return 4
    return 5


def presupuesto():
    carpeta = DATOS / "presupuesto"
    ent = pd.read_csv(carpeta / "entidades.csv", dtype=str)
    rub = pd.read_csv(carpeta / "rubros.csv", dtype=str).fillna("")
    rub["id_rubro"] = rub.id_rubro.astype(int)
    rub["destino"] = [destino(r) for r in rub.itertuples()]
    tipos = ["FUNCIONAMIENTO", "INVERSION"]
    r = pd.read_csv(carpeta / "resumen.csv", dtype={"codigo_entidad": str})
    r = r[r.vigencia == "Vigencia actual"]
    fechas = sorted(r.fecha.unique())
    # el Ministerio primero, luego las demás entidades en orden alfabético
    lista_ent = ent.assign(o=ent.codigo_entidad.ne("22-01-01")).sort_values(["o", "entidad"]).reset_index(drop=True)
    idx_ent = {c: i for i, c in enumerate(lista_ent.codigo_entidad)}
    idx_tipo = {t: i for i, t in enumerate(tipos)}
    filas = []
    for x in r.itertuples():
        if x.codigo_entidad not in idx_ent or x.tipo_gasto not in idx_tipo:
            continue
        filas.append([fechas.index(x.fecha), idx_ent[x.codigo_entidad], idx_tipo[x.tipo_gasto]] +
                     [int(round(getattr(x, v) / 1e6)) for v in VAL])  # millones de pesos
    todos = pd.date_range(fechas[0], fechas[-1], freq="MS").strftime("%Y-%m-%d").tolist()
    faltantes = [f for f in todos if f not in fechas]
    reg = carpeta / "meses_siif.csv"
    desde_siif = [f for f in pd.read_csv(reg, dtype=str).fecha if f in fechas] if reg.exists() else []
    guardar("presupuesto/entidades.json", {"fechas": fechas, "faltantes": faltantes, "desde_siif": desde_siif, "tipos": ["Funcionamiento", "Inversión"],
                                           "entidades": lista_ent[["codigo_entidad", "entidad", "sector"]].values.tolist(),
                                           "destinos": DESTINOS, "campos": VAL, "filas": filas})
    for p in sorted(carpeta.glob("gastos_*.csv")):
        anio = p.stem.split("_")[1]
        h = pd.read_csv(p, dtype={"recurso": str})
        h = h[h.vigencia == "Vigencia actual"]
        g = h.groupby(["fecha", "id_rubro"], as_index=False)[VAL].sum()
        meses = sorted(g.fecha.unique())
        ids = sorted(g.id_rubro.unique())
        info = rub.set_index("id_rubro").loc[ids]
        filas = [[meses.index(x.fecha), int(x.id_rubro)] + [int(round(getattr(x, v) / 1e6)) for v in VAL] for x in g.itertuples()]
        rubros = {int(i): [idx_ent.get(z.codigo_entidad, -1), z.nombre_1[:1], z.nombre_2, z.nombre_3, z.nombre_4, z.nombre_5, int(z.destino)]
                  for i, z in info.iterrows()}
        guardar(f"presupuesto/rubros_{anio}.json", {"fechas": meses, "campos": VAL, "rubros": rubros, "filas": filas})
    # destinos mes a mes (para "¿en qué se va la plata?")
    partes = []
    for p in sorted(carpeta.glob("gastos_*.csv")):
        h = pd.read_csv(p, dtype={"recurso": str})
        h = h[h.vigencia == "Vigencia actual"].merge(rub[["id_rubro", "destino"]], on="id_rubro")
        partes.append(h.groupby(["fecha", "destino"], as_index=False)[["apropiacion_vigente", "compromisos", "obligaciones"]].sum())
    dd = pd.concat(partes)
    out = {"fechas": fechas, "destinos": DESTINOS, "valores": {}}
    for k in range(len(DESTINOS)):
        s = dd[dd.destino == k].set_index("fecha")
        out["valores"][k] = {m: [int(round(s[m].get(f, 0) / 1e6)) for f in fechas] for m in ["apropiacion_vigente", "compromisos", "obligaciones"]}
    guardar("presupuesto/destinos.json", out)


def presupuesto_historico():
    s = pd.read_csv(DATOS / "presupuesto_historico" / "educacion.csv")
    anios = sorted(s.anio.unique().tolist())
    out = {"anios": anios, "tipos": {}}
    for (tipo, med, pr), g in s.groupby(["tipo_gasto", "medida", "precios"]):
        out["tipos"].setdefault(tipo, {}).setdefault(med, {})[pr] = lista(g.set_index("anio").valor, anios, 1)
    guardar("presupuesto/historico.json", out)


# ---------------------------------------------------------------- ICETEX
# códigos DANE de los departamentos, para ubicarlos en el mapa
COD_DEPTO = {"ANTIOQUIA": "05", "ATLÁNTICO": "08", "BOGOTÁ": "11", "BOLÍVAR": "13", "BOYACÁ": "15", "CALDAS": "17", "CAQUETÁ": "18",
             "CAUCA": "19", "CESAR": "20", "CÓRDOBA": "23", "CUNDINAMARCA": "25", "CHOCÓ": "27", "HUILA": "41", "LA GUAJIRA": "44",
             "MAGDALENA": "47", "META": "50", "NARIÑO": "52", "NORTE DE SANTANDER": "54", "QUINDÍO": "63", "RISARALDA": "66",
             "SANTANDER": "68", "SUCRE": "70", "TOLIMA": "73", "VALLE DEL CAUCA": "76", "ARAUCA": "81", "CASANARE": "85",
             "PUTUMAYO": "86", "SAN ANDRÉS": "88", "AMAZONAS": "91", "GUAINÍA": "94", "GUAVIARE": "95", "VAUPÉS": "97", "VICHADA": "99"}
def icetex():
    c = pd.read_csv(DATOS / "icetex" / "cartera.csv")
    fechas = sorted(c.fecha.unique())
    nac = c[c.depto == "TOTAL"]
    cart = {}
    for (ep, med), g in nac.groupby(["epoca", "medida"]):
        cart.setdefault(ep, {})[med] = lista(g.set_index("fecha").valor, fechas, 0)
    # un trimestre con un salto imposible en el número de créditos (cae más de 25% y se recupera al siguiente) se marca
    atipicos = []
    for ep in ["pagando", "estudios", "todas"]:
        v = cart[ep]["creditos"]
        for i in range(1, len(v) - 1):
            if v[i] and v[i - 1] and v[i + 1] and v[i] < 0.75 * v[i - 1] and v[i + 1] > 0.9 * v[i - 1]:
                atipicos.append(fechas[i])
    atipicos = sorted(set(atipicos))
    for ep in cart:
        for med in ["creditos", "al_dia", "en_mora", "mora_mayor"]:
            cart[ep][med] = [None if f in atipicos else x for f, x in zip(fechas, cart[ep][med])]
    u = c[(c.fecha == fechas[-1]) & (c.depto != "TOTAL") & (c.epoca == "todas")].pivot(index="depto", columns="medida", values="valor")
    deptos = [[COD_DEPTO[d], d, int(x.creditos), int(x.en_mora), round(x.saldo_total / 1e6)] for d, x in u.iterrows() if d in COD_DEPTO and x.creditos > 0]
    # % de créditos con cuotas atrasadas de cada departamento, trimestre a trimestre (para verlo en el tiempo)
    t = c[(c.epoca == "todas") & c.depto.isin(COD_DEPTO)].pivot_table(index=["depto", "fecha"], columns="medida", values="valor")
    t["pct"] = t.en_mora / t.creditos * 100
    deptos_hist = {COD_DEPTO[d]: lista(g.droplevel(0).pct, fechas, 1) for d, g in t.groupby(level=0)}
    cr = pd.read_csv(DATOS / "icetex" / "creditos.csv")
    periodos = sorted(cr.periodo.unique())
    creditos = {}
    for (tipo, dim, cat), g in cr.groupby(["tipo", "dimension", "categoria"]):
        creditos.setdefault(tipo, {}).setdefault(dim, {})[cat] = lista(g.set_index("periodo").valor, periodos, 0)
    guardar("icetex.json", {"fechas": fechas, "atipicos": atipicos, "cartera": cart, "deptos": deptos, "deptos_hist": deptos_hist, "periodos": periodos, "creditos": creditos})


# ---------------------------------------------------------------- colegios (anual)
def colegios():
    m = pd.read_csv(DATOS / "matricula" / "datos.csv", dtype={"depto": str})
    sx = pd.read_csv(DATOS / "matricula" / "sexo.csv")
    nombres = dict(pd.read_csv(DATOS / "matricula" / "deptos.csv", dtype=str).values)
    anios = sorted(int(a) for a in m.anio.unique())
    todos = list(range(anios[0], anios[-1] + 1))   # los años sin dato quedan como hueco
    tot = lambda g: lista(g.groupby("anio").matricula.sum(), todos, 0)
    mat = {"total": tot(m),
           "nivel": {k: tot(g) for k, g in m.groupby("nivel")},
           "sector": {k: tot(g) for k, g in m.groupby("sector")},
           "zona": {k: tot(g) for k, g in m.groupby("zona")},
           "sexo": {k: lista(g.groupby("anio").matricula.sum(), todos, 0) for k, g in sx.groupby("sexo")},
           "deptos": {d: tot(g) for d, g in m.groupby("depto")},
           "deptos_publico": {d: tot(g) for d, g in m[m.sector == "Público"].groupby("depto")}}
    i = pd.read_csv(DATOS / "indicadores" / "datos.csv", dtype={"depto": str})
    ai = sorted(int(a) for a in i.anio.unique())
    ind = {}
    for (med, dep), g in i.groupby(["medida", "depto"]):
        ind.setdefault(med, {})[dep] = lista(g.set_index("anio").valor, ai, 2)
    nombres_i = dict(i.drop_duplicates("depto", keep="last")[["depto", "nombre"]].values)
    guardar("colegios.json", {"anios": todos, "matricula": mat, "nombres": {**nombres, **nombres_i},
                              "anios_ind": ai, "indicadores": ind})


# ---------------------------------------------------------------- resumen
def resumen():
    out = {}
    d = pd.read_csv(DATOS / "juventud" / "datos.csv")
    n = d[d.id_serie == "JUV_NACIONAL"].pivot(index="fecha", columns="medida", values="valor")
    f = n.pct_ninis.dropna().index.max()
    f_ant = f"{int(f[:4]) - 1}{f[4:]}"
    serie = n.pct_ninis.dropna().iloc[-37:]
    out["ninis"] = {"fecha": f, "pct": limpiar(n.pct_ninis[f]), "miles": limpiar(n.ninis[f], 0), "pct_ant": limpiar(n.pct_ninis.get(f_ant)),
                    "serie": [serie.index.tolist(), [limpiar(x) for x in serie]]}
    f2 = n.td.dropna().index.max()
    serie = n.td.dropna().iloc[-37:]
    out["td"] = {"fecha": f2, "v": limpiar(n.td[f2]), "ant": limpiar(n.td.get(f"{int(f2[:4]) - 1}{f2[4:]}")),
                 "serie": [serie.index.tolist(), [limpiar(x) for x in serie]]}
    r = pd.read_csv(DATOS / "presupuesto" / "resumen.csv")
    r = r[r.vigencia == "Vigencia actual"].groupby("fecha")[["apropiacion_vigente", "compromisos", "obligaciones"]].sum()
    fu = r.index.max()
    pct = (r.obligaciones / r.apropiacion_vigente * 100)
    ant = f"{int(fu[:4]) - 1}{fu[4:]}"
    anio = [x for x in r.index if x[:4] == fu[:4]]
    out["presupuesto"] = {"fecha": fu, "aprop": round(r.apropiacion_vigente[fu] / 1e6), "pct": limpiar(pct[fu], 1), "pct_ant": limpiar(pct.get(ant), 1),
                          "serie": [anio, [limpiar(pct[x], 1) for x in anio]],
                          "serie_ant": [limpiar(pct.get(f"{int(x[:4]) - 1}{x[4:]}"), 1) for x in anio]}
    c = pd.read_csv(DATOS / "icetex" / "cartera.csv")
    c = c[(c.depto == "TOTAL") & (c.epoca == "todas")].pivot(index="fecha", columns="medida", values="valor")
    c["pct"] = c.en_mora / c.creditos * 100
    fc = c.index.max()
    cr = pd.read_csv(DATOS / "icetex" / "creditos.csv")
    nuevos = cr[(cr.tipo == "nuevos") & (cr.dimension == "total")].set_index("periodo").valor.sort_index()
    out["icetex"] = {"fecha": fc, "creditos": int(c.creditos[fc]), "pct_mora": limpiar(c.pct[fc], 1),
                     "nuevos": [nuevos.index.tolist()[-8:], [int(x) for x in nuevos.iloc[-8:]]]}
    m = pd.read_csv(DATOS / "matricula" / "datos.csv").groupby("anio").matricula.sum()
    ua = int(m.index.max())
    out["matricula"] = {"anio": ua, "v": int(m[ua]), "ant": int(m.get(ua - 1, 0)) or None, "inicio": [int(m.index.min()), int(m.iloc[0])],
                        "serie": [[int(a) for a in m.index], [int(x) for x in m]]}
    i = pd.read_csv(DATOS / "indicadores" / "datos.csv", dtype={"depto": str})
    i = i[(i.depto == "00") & (i.medida == "desercion")].set_index("anio").valor
    out["desercion"] = {"anio": int(i.index.max()), "v": limpiar(i.iloc[-1]), "ant": limpiar(i.iloc[-2]),
                        "serie": [[int(a) for a in i.index], [limpiar(x) for x in i]]}
    s11 = DATOS / "icfes" / "saber11.csv"
    if s11.exists():
        x = pd.read_csv(s11, dtype={"categoria": str})
        n = x[(x.grupo == "nacional")]
        g = n[n.medida == "global"].pivot_table(index="anio", columns="sector", values="valor")
        nb = n[(n.medida == "Matemáticas|Nivel 1") & (n.sector == "Total")].set_index("anio").valor
        pz = pd.read_csv(DATOS / "pisa" / "pisa.csv")
        ua = pz.anio.max()
        pm = pz[(pz.anio == ua) & (pz.materia == "Matemáticas")].set_index("pais").puntaje
        out["saber11"] = {"anios": [int(a) for a in g.index], "v": [limpiar(v, 1) for v in g.Total],
                          "brecha": limpiar(g["Privado"].iloc[-1] - g["Público"].iloc[-1], 1), "mat_bajo": limpiar(nb.iloc[-1], 1),
                          "pisa": [int(ua), int(pm["Colombia"]), int(pm["Promedio OCDE"])]}
    sup = DATOS / "superior" / "datos.csv"
    if sup.exists():
        x = pd.read_csv(sup)
        m = x[(x.tipo == "matriculados") & (x.semestre == 2)]
        t = m.groupby("anio").valor.sum()
        ua = int(t.index.max())
        out["superior"] = {"anios": [int(a) for a in t.index], "v": [int(v) for v in t],
                           "pub": limpiar(m[(m.anio == ua) & (m.sector == "Pública")].valor.sum() / t[ua] * 100, 1),
                           "grad": int(x[(x.tipo == "graduados") & (x.anio == ua)].valor.sum())}
    guardar("resumen.json", out)


# ---------------------------------------------------------------- educación superior (SNIES, anual)
def superior():
    c = DATOS / "superior"
    if not (c / "datos.csv").exists():
        return
    d = pd.read_csv(c / "datos.csv")
    # cifra anual: matriculados = segundo semestre (el corte más completo del año); nuevos y graduados = suma de los dos semestres
    def anual(x):
        m = x[(x.tipo == "matriculados") & (x.semestre == 2)]
        o = x[x.tipo != "matriculados"]
        return pd.concat([m, o])
    d = anual(d)
    anios = sorted(int(a) for a in d.anio.unique())
    out = {"anios": anios}
    for tipo in ["matriculados", "primer_curso", "graduados"]:
        x = d[d.tipo == tipo]
        t = {"total": lista(x.groupby("anio").valor.sum(), anios, 0)}
        for dim in ["sector", "nivel_academico", "nivel_formacion", "modalidad", "sexo"]:
            t[dim] = {k: lista(g.groupby("anio").valor.sum(), anios, 0) for k, g in x.groupby(dim) if k != "Sin dato"}
        t["sector_nivel"] = {f"{a}|{b}": lista(g.groupby("anio").valor.sum(), anios, 0) for (a, b), g in x.groupby(["sector", "nivel_academico"])}
        out[tipo] = t
    dp = anual(pd.read_csv(c / "deptos.csv", dtype={"depto": str}))
    dp = dp[dp.tipo == "matriculados"]
    out["deptos"] = {k: lista(g.groupby("anio").valor.sum(), anios, 0) for k, g in dp.groupby("depto") if k in mapa_codigos()}
    out["deptos_publica"] = {k: lista(g.groupby("anio").valor.sum(), anios, 0) for k, g in dp[dp.sector == "Pública"].groupby("depto") if k in mapa_codigos()}
    ar = anual(pd.read_csv(c / "areas.csv"))
    ar = ar[(ar.tipo == "matriculados") & (ar.nivel_academico == "Pregrado") & ~ar.area.isin(["Sin dato", "Sin información", "Sin informacion"])]
    out["areas"] = {k: lista(g.groupby("anio").valor.sum(), anios, 0) for k, g in ar.groupby("area")}
    ies = anual(pd.read_csv(c / "ies.csv"))
    ies = ies[ies.tipo == "matriculados"]
    u, a = anios[-1], anios[-2] if len(anios) > 1 else None
    tot = ies.groupby(["anio", "cod_ies"]).valor.sum()
    info = ies[ies.anio == u].groupby("cod_ies").agg(ies=("ies", "first"), sector=("sector", "first"), caracter=("caracter", "first"))
    top = tot.loc[u].sort_values(ascending=False).head(20)
    out["ies"] = [[info.ies[k], info.sector[k], info.caracter[k], int(v), int(tot.get((a, k), 0)) if a else None] for k, v in top.items()]
    guardar("superior.json", out)


def mapa_codigos():
    return set(COD_DEPTO.values())


# ---------------------------------------------------------------- calidad: ICFES y PISA
def calidad():
    out = {}
    for nombre, archivo in [("s11", "saber11.csv"), ("pro", "saberpro.csv")]:
        p = DATOS / "icfes" / archivo
        if not p.exists():
            continue
        d = pd.read_csv(p, dtype={"categoria": str})
        anios = sorted(int(a) for a in d.anio.unique())
        serie = lambda x: lista(x.groupby("anio").valor.mean(), anios, 1)
        n = d[d.grupo == "nacional"]
        r = {"anios": anios,
             "global": {s: serie(g) for s, g in n[n.medida == "global"].groupby("sector")},
             "pruebas": {m: {s: serie(g) for s, g in x.groupby("sector")} for m, x in n[(n.medida != "global") & ~n.medida.str.contains("|", regex=False)].groupby("medida")},
             "niveles": {m: serie(x) for m, x in n[n.medida.str.contains("|", regex=False) & (n.sector == "Total")].groupby("medida")},
             "nse": {c: serie(g) for c, g in d[(d.grupo == "nse") & (d.medida == "global")].groupby("categoria")},
             "genero": {c: serie(g) for c, g in d[(d.grupo == "genero") & (d.medida == "global")].groupby("categoria")},
             "zona": {c: serie(g) for c, g in d[(d.grupo == "sector_zona") & (d.medida == "global")].groupby("categoria")}}
        dep = d[(d.grupo == "depto") & (d.sector == "Total")]
        r["deptos"] = {m: {c: serie(g) for c, g in x.groupby("categoria")} for m, x in dep.groupby("medida")}
        out[nombre] = r
    pz = pd.read_csv(DATOS / "pisa" / "pisa.csv")
    pa = sorted(int(a) for a in pz.anio.unique())
    out["pisa"] = {"anios": pa, "valores": {p: {m: lista(g.set_index("anio").puntaje, pa, 0) for m, g in x.groupby("materia")} for p, x in pz.groupby("pais")}}
    guardar("calidad.json", out)


def main():
    print("Preparando datos para la web:")
    juventud()
    mapa.main()
    presupuesto()
    presupuesto_historico()
    icetex()
    colegios()
    superior()
    calidad()
    resumen()


if __name__ == "__main__":
    main()
