# Educación en Colombia en datos

Explorador abierto de los indicadores de educación en Colombia, con explicaciones en lenguaje sencillo para que cualquiera entienda cómo va el país.

**Página:** https://nicolasfgc.github.io/Indicadores-educativos/

Hecho por **Nicolás González** · [nicolasfgcht@gmail.com](mailto:nicolasfgcht@gmail.com) · [LinkedIn](https://www.linkedin.com/in/nicolas-gonzalezc/). Proyecto hermano: [Economía colombiana en datos](https://github.com/nicolasfgc/Indicadores-economia-colombiana).

## Qué tiene

La educación se mide sobre todo una vez al año, así que la página combina un **pulso frecuente** con una **foto anual**:

| Pestaña | Qué muestra | Frecuencia | Fuente |
|---|---|---|---|
| Jóvenes | Jóvenes de 15 a 28 años que ni estudian ni trabajan; desempleo, ocupación y participación juvenil, por sexo y zona | Mensual (trimestre móvil), desde 2007 | DANE, GEIH |
| Presupuesto | Ejecución del presupuesto del sector educación, en qué se gasta, entidad por entidad y la historia desde 2000 | Mensual, desde 2019 | Ministerio de Hacienda |
| Créditos ICETEX | Créditos nuevos y renovados; cartera y mora | Semestral y trimestral | ICETEX |
| Colegios | Matrícula, cobertura, deserción y repitencia, por departamento | Anual | Ministerio de Educación |

El detalle de cada archivo está en [`datos/catalogo.csv`](datos/catalogo.csv).

## Cómo funciona

- `scripts/` descarga y ordena cada fuente (`juventud.py`, `presupuesto.py`, `icetex.py`, `matricula.py`, `indicadores.py`) y `web.py` prepara archivos livianos para la página en `web/`.
- `.github/workflows/actualizar-datos.yml` corre todo cada día a las 10 a. m. (hora Colombia) y guarda solo si hay datos nuevos.
- La página (`index.html` y `assets/`) es estática y se publica con GitHub Pages.

## Notas sobre los datos

- **Presupuesto:** cuando el Ministerio de Hacienda deja un mes sin publicar en datos abiertos, se completa con el reporte del SIIF del Portal de Transparencia Económica, que se descarga a mano y se guarda en `fuentes/siif/AAAA-MM.xlsx` (ese portal bloquea robots). La página avisa qué meses vienen de ahí. El histórico desde 2000 también viene de archivos descargados a mano de Hacienda.
- **Matrícula:** el año 2018 no está en el conjunto de datos abiertos del Ministerio de Educación.
- **Indicadores de colegios:** el conjunto solo trae departamentos; el dato nacional es un promedio ponderado por la población de 5 a 16 años, calculado aquí. Algunas columnas de la fuente vienen corridas y se descartan valores imposibles.
- **ICETEX:** en junio de 2025 la fuente trae un salto no creíble en el número de créditos (se deja vacío) y algunos departamentos aparecen casi sin mora; la página lo señala.
- **Pendiente:** matrícula en educación superior (SNIES) y resultados de las pruebas Saber 11 (ICFES).

## Correr a mano

```bash
pip install -r requirements.txt
python scripts/juventud.py && python scripts/presupuesto.py && python scripts/icetex.py
python scripts/matricula.py && python scripts/indicadores.py && python scripts/web.py
python -m http.server   # y abrir http://localhost:8000
```
