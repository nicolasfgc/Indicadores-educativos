"""
Convierte el mapa de departamentos (fuentes/mapa/departamentos.geojson, Marco Geoestadístico Nacional del DANE 2018,
copia simplificada de github.com/caticoa3/colombia_mapa) en trazos SVG listos para la página: web/mapa.json.

San Andrés, Providencia y Santa Catalina se dibujan ampliados en un recuadro, porque a escala real no se verían.
Uso:  python scripts/mapa.py
"""
import json
import math
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
ANCHO = 600
ISLAS = "88"


def anillos(geom):
    return geom["coordinates"] if geom["type"] == "Polygon" else [r for p in geom["coordinates"] for r in p]


def main():
    g = json.loads((RAIZ / "fuentes" / "mapa" / "departamentos.geojson").read_text(encoding="utf-8"))
    feats = {f["properties"]["DPTO_CCDGO"]: f for f in g["features"]}
    k = math.cos(math.radians(4.5))   # corrección por latitud: Colombia está cerca del ecuador
    pts = [p for c, f in feats.items() if c != ISLAS for r in anillos(f["geometry"]) for p in r]
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    esc = ANCHO / ((x1 - x0) * k)
    alto = round((y1 - y0) * esc)

    def trazo(rings, f):
        partes = []
        for r in rings:
            xy = [f(p) for p in r]
            # quita puntos repetidos tras redondear
            limpio = [xy[0]] + [q for a, q in zip(xy, xy[1:]) if q != a]
            if len(limpio) >= 3:
                partes.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in limpio) + "Z")
        return "".join(partes)

    out = {"ancho": ANCHO, "alto": alto, "deptos": {}}
    for c, f in feats.items():
        if c == ISLAS:
            continue
        out["deptos"][c] = trazo(anillos(f["geometry"]), lambda p: ((p[0] - x0) * k * esc, (y1 - p[1]) * esc))
    # recuadro para las islas, arriba a la izquierda
    rs = anillos(feats[ISLAS]["geometry"])
    ip = [p for r in rs for p in r]
    ix0, ix1, iy0, iy1 = min(p[0] for p in ip), max(p[0] for p in ip), min(p[1] for p in ip), max(p[1] for p in ip)
    caja = 90
    ie = (caja - 16) / max((ix1 - ix0) * k, iy1 - iy0)
    cx, cy = 10 + (caja - (ix1 - ix0) * k * ie) / 2, 10 + (caja - (iy1 - iy0) * ie) / 2
    out["deptos"][ISLAS] = trazo(rs, lambda p: (cx + (p[0] - ix0) * k * ie, cy + (iy1 - p[1]) * ie))
    out["recuadro"] = [10, 10, caja, caja]
    p = RAIZ / "web" / "mapa.json"
    p.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  mapa.json: {p.stat().st_size / 1024:,.0f} KB ({len(out['deptos'])} departamentos, {ANCHO}x{alto})")


if __name__ == "__main__":
    main()
