"""
Utilidades compartidas por los programas que descargan los datos.

- bajar(): descarga con reintentos; si el servidor pide esperar (error 429), espera lo que indique.
- soql(): consulta a datos.gov.co (Socrata) y devuelve un DataFrame.
- guardar(): escribe un CSV en formato largo, ordenado y sin duplicados.
"""
import io
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
DATOS = RAIZ / "datos"
UA = {"User-Agent": "Mozilla/5.0 (indicadores-educativos)"}


def bajar(url, intentos=6, timeout=180):
    for i in range(intentos):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if i == intentos - 1:
                raise RuntimeError(f"No se pudo descargar {url}: {e}") from e
            espera = 10 * (i + 1)
            if isinstance(e, urllib.error.HTTPError) and e.code == 429:
                try:
                    espera = max(int(e.headers.get("Retry-After", 0)), 30 * (i + 1))
                except ValueError:
                    espera = 30 * (i + 1)
            print(f"  reintento {i + 1} en {espera}s ({e})")
            time.sleep(espera)


def soql(conjunto, **params):
    """Consulta un conjunto de datos de datos.gov.co. params = select, where, group, order, limit (sin el $)."""
    params.setdefault("limit", 500000)
    q = urllib.parse.urlencode({f"${k}": v for k, v in params.items()})
    return pd.read_csv(io.BytesIO(bajar(f"https://www.datos.gov.co/resource/{conjunto}.csv?{q}", timeout=300)), dtype=str)


def guardar(df, carpeta, nombre, claves):
    carpeta = DATOS / carpeta
    carpeta.mkdir(parents=True, exist_ok=True)
    if df.duplicated(claves).any():
        raise RuntimeError(f"{carpeta.name}/{nombre}: filas repetidas en {claves}")
    df.sort_values(claves).to_csv(carpeta / nombre, index=False, encoding="utf-8", float_format="%.12g")
    print(f"  {carpeta.name}/{nombre}: {len(df):,} filas")
