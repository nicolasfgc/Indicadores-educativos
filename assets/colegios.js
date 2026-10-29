// Pestaña: Colegios — matrícula, cobertura, deserción y departamentos (datos anuales del Ministerio de Educación)
registrar("colegios", (() => {
  const st = {d: null, desg: "nivel", cob: "neta", sal: "desercion", dInd: "cobertura_neta", dAnio: null};
  const DESG = {
    nivel: {orden: ["Preescolar", "Primaria", "Secundaria", "Media", "Adultos y otros programas"], t: "por nivel"},
    sector: {orden: ["Público", "Privado"], t: "en colegios públicos y privados", nombres: {"Público": "Colegios públicos", "Privado": "Colegios privados"}},
    zona: {orden: ["Urbana", "Rural"], t: "en zonas urbanas y rurales", nombres: {Urbana: "Zona urbana", Rural: "Zona rural"}},
    sexo: {orden: ["Femenino", "Masculino"], t: "mujeres y hombres", nombres: {Femenino: "Mujeres", Masculino: "Hombres"}}};
  const IND = {
    cobertura_neta: {t: "Cobertura neta", h: "De cada 100 niños y jóvenes de 5 a 16 años, cuántos están matriculados en el nivel que corresponde a su edad.", alto: true},
    cobertura_neta_media: {t: "Cobertura neta en media (10.º y 11.º)", h: "De cada 100 jóvenes de 15 y 16 años, cuántos están en décimo u once.", alto: true},
    cobertura_neta_transicion: {t: "Cobertura neta en transición", h: "De cada 100 niños de 5 años, cuántos están en transición (el último año de preescolar).", alto: true},
    desercion: {t: "Deserción", h: "De cada 100 estudiantes, cuántos se salieron del colegio durante el año.", alto: false},
    repitencia: {t: "Repitencia", h: "De cada 100 estudiantes, cuántos están repitiendo el año.", alto: false}};
  const I = (m, dep = "00") => st.d.indicadores[m]?.[dep] || [];
  const nombre = c => { if (c === "00") return "Colombia"; const n = st.d.nombres[c] || c; return /[a-z]/.test(n) ? n : titulo(n).replace(/^Capital /, ""); };
  const pctTxt = x => fmt(x, 1) + "%";
  const mill = x => fmt(x / 1e6, x % 1e6 === 0 ? 0 : 2) + " millones";

  async function iniciar() {
    st.d = await json("web/colegios.json");
    st.dAnio = String(st.d.anios_ind.at(-1));
    seg("col-desg", x => { st.desg = x; matricula(); });
    seg("col-cob", x => { st.cob = x; cobertura(); });
    seg("col-sal", x => { st.sal = x; salida(); });
    const sel = $("col-dind");
    opciones(sel, Object.entries(IND).map(([k, v]) => [k, v.t]), st.dInd);
    sel.onchange = () => { st.dInd = sel.value; deptos(); };
    const sa = $("col-danio");
    opciones(sa, st.d.anios_ind.slice().reverse().map(a => [a, a]), st.dAnio);
    sa.onchange = () => { st.dAnio = sa.value; deptos(); };
  }

  function matricula() {
    const M = st.d.matricula, A = st.d.anios.map(String), D = DESG[st.desg];
    const pal = DISTINTOS();
    const series = [{label: "Total", data: M.total, color: css("--muted"), ancho: 1.6, dash: [4, 3]}].concat(
      D.orden.filter(k => M[st.desg][k]).map((k, i) => ({label: D.nombres?.[k] || k, data: M[st.desg][k], color: pal[i], ancho: 2.5})));
    $("col-mat-t").textContent = `Estudiantes matriculados ${D.t}`;
    serie("col-mat", A, series, {fmtValor: x => x == null ? "sin dato" : mill(x), eje0: true, despues: (i0, i1) => {
      const t = M.total; let a = i1; while (a > i0 && t[a] == null) a--; let b = i0; while (b < a && t[b] == null) b++;
      const cambio = t[a] - t[b], partes = D.orden.filter(k => M[st.desg][k]).map(k => [D.nombres?.[k] || k, M[st.desg][k][a]]);
      let txt = `En <strong>${A[a]}</strong> había <strong>${mill(t[a])}</strong> de estudiantes en preescolar, primaria, secundaria y media. ` +
        (a > b ? `Eso es ${fmt(Math.abs(cambio) / 1000, 0)} mil ${cambio < 0 ? "menos" : "más"} que en ${A[b]} (${cambio < 0 ? "−" : "+"}${fmt(Math.abs(cambio / t[b] * 100), 1)}%). ` : "");
      if (st.desg === "sector") txt += `De cada 100, <strong>${fmt(partes[0][1] / t[a] * 100, 0)} estudian en colegios públicos</strong>. `;
      if (st.desg === "zona") txt += `De cada 100, ${fmt(partes[1][1] / t[a] * 100, 0)} estudian en zonas rurales. `;
      if (st.desg === "nivel") txt += `La primaria es el nivel más grande (${mill(M.nivel.Primaria[a])}); la media, la de los últimos dos años, apenas ${mill(M.nivel.Media[a])}: muchos se quedan en el camino. `;
      txt += cambio < 0 ? `La caída se explica sobre todo porque en Colombia nacen cada vez menos niños: hay menos población en edad escolar. Por eso, más que el número, importa la cobertura (abajo). ` : "";
      txt += A.includes("2018") && M.total[A.indexOf("2018")] == null && i0 <= A.indexOf("2018") && i1 >= A.indexOf("2018") ? "El Ministerio no publicó en datos abiertos la matrícula de 2018: por eso entre 2017 y 2019 la línea va directo, sin ese dato." : "";
      $("col-mat-txt").innerHTML = txt;
    }});
  }

  function cobertura() {
    const A = st.d.anios_ind.map(String), pre = st.cob === "neta" ? "cobertura_neta" : "cobertura_bruta", pal = DISTINTOS();
    const niv = [["_transicion", "Transición"], ["_primaria", "Primaria"], ["_secundaria", "Secundaria"], ["_media", "Media"]];
    const series = [{label: "Total", data: I(pre), color: css("--grafica"), ancho: 3}].concat(niv.map(([s, t], i) => ({label: t, data: I(pre + s), color: pal[i + 1], ancho: 2})));
    serie("col-cob-g", A, series, {fmtValor: pctTxt, referencias: st.cob === "bruta" ? [{y: 100, t: "100%"}] : [], despues: (i0, i1) => {
      const t = I(pre), m = I(pre + "_media"), tr = I(pre + "_transicion");
      $("col-cob-txt").innerHTML = st.cob === "neta"
        ? `En <strong>${A[i1]}</strong>, <strong>${fmt(t[i1], 1)} de cada 100</strong> niños y jóvenes de 5 a 16 años estaban estudiando en el nivel que les corresponde por su edad. ` +
          `El punto débil es la media: solo <strong>${fmt(m[i1], 1)} de cada 100</strong> jóvenes de 15 y 16 años están en décimo u once; muchos ya se salieron o van atrasados. ` +
          `En transición (5 años) la cobertura es ${fmt(tr[i1], 1)}%. ` +
          (i0 <= A.indexOf("2018") && i1 >= A.indexOf("2018") && A.indexOf("2018") > 0 ? "El salto de 2018 no es una mejora real: ese año cambiaron las proyecciones de población del DANE con las que se calcula el indicador." : "")
        : `La cobertura bruta compara a todos los matriculados en un nivel, tengan la edad que tengan, con la población en edad de estar en él. Pasa de 100% cuando hay muchos estudiantes mayores de lo esperado (por ejemplo, que repitieron años). ` +
          `En ${A[i1]} fue ${fmt(t[i1], 1)}%; en media, ${fmt(m[i1], 1)}%.`;
    }});
  }

  function salida() {
    const A = st.d.anios_ind.map(String), pal = DISTINTOS(), m = st.sal;
    const series = m === "desercion"
      ? [{label: "Total", data: I("desercion"), color: css("--grafica"), ancho: 3}].concat([["_primaria", "Primaria"], ["_secundaria", "Secundaria"], ["_media", "Media"]].map(([s, t], i) => ({label: t, data: I("desercion" + s), color: pal[i + 1], ancho: 2})))
      : [{label: "Repitencia", data: I("repitencia"), color: css("--grafica"), ancho: 3}, {label: "Reprobación", data: I("reprobacion"), color: pal[1], ancho: 2}];
    serie("col-sal-g", A, series, {fmtValor: pctTxt, eje0: true, despues: (i0, i1) => {
      const d = I("desercion"), s = I("desercion_secundaria"), r = I("repitencia");
      const est = st.d.matricula.total[st.d.anios.indexOf(+A[i1])];
      $("col-sal-txt").innerHTML = m === "desercion"
        ? `En <strong>${A[i1]}</strong>, <strong>${fmt(d[i1], 2)} de cada 100 estudiantes</strong> se salieron del colegio durante el año` + (est ? ` (del orden de ${fmt(d[i1] / 100 * est / 1000, 0)} mil niños y jóvenes)` : "") + `. ` +
          `Donde más pasa es en secundaria (${fmt(s[i1], 2)}%), cuando muchos empiezan a trabajar o se van por problemas económicos. ` +
          (i1 > i0 ? `En ${A[i0]} la deserción era ${fmt(d[i0], 2)}%.` : "")
        : `En <strong>${A[i1]}</strong>, ${fmt(r[i1], 1)} de cada 100 estudiantes estaban repitiendo el año. Desde la pandemia la repitencia y la reprobación subieron con fuerza: ` +
          `en 2019 la repitencia era ${fmt(r[A.indexOf("2019")], 1)}%. Repetir años aumenta el riesgo de que un estudiante termine abandonando el colegio.`;
    }});
  }

  function deptos() {
    const A = st.d.anios_ind.map(String), k = A.indexOf(st.dAnio), m = st.dInd, D = IND[m];
    const items = Object.keys(st.d.indicadores[m] || {}).map(c => ({id: c, n: nombre(c), v: I(m, c)[k], resaltar: c === "00"})).filter(x => x.v != null)
      .sort((a, b) => D.alto ? b.v - a.v : a.v - b.v);
    $("col-dep-t").textContent = `${D.t} por departamento, ${st.dAnio}`;
    $("col-dep-h").textContent = D.h + (D.alto ? " Ordenado de mayor a menor." : " Ordenado de menor (mejor) a mayor.") + " Toca un departamento para verlo en el tiempo.";
    barras("col-dep", items, {fmtValor: pctTxt, alto: 22, colores: x => x.resaltar ? css("--muted") : css("--grafica"), alClic: x => deptoTiempo(x.id)});
    const sinNac = items.filter(x => !x.resaltar), mejor = sinNac[0], peor = sinNac.at(-1), nac = items.find(x => x.resaltar);
    $("col-dep-txt").innerHTML = `${D.alto ? "La más alta" : "La más baja"}: <strong>${mejor.n}</strong> (${pctTxt(mejor.v)}). ${D.alto ? "La más baja" : "La más alta"}: <strong>${peor.n}</strong> (${pctTxt(peor.v)}). ` +
      (nac ? `El dato de Colombia (en gris) es un promedio de los departamentos ponderado por su población de 5 a 16 años, calculado por esta página porque el conjunto de datos no trae el total nacional.` : "");
  }
  function deptoTiempo(c) {
    const A = st.d.anios_ind.map(String), m = st.dInd;
    const series = [{label: nombre(c), data: I(m, c), color: css("--grafica"), ancho: 2.5}];
    if (c !== "00") series.unshift({label: "Colombia", data: I(m), color: css("--muted"), ancho: 1.6});
    enElTiempo("col-dep-tiempo", `${IND[m].t} en ${nombre(c)}`, A, series, {fmtValor: pctTxt, nota: "Toca otro departamento para cambiarlo."});
  }

  function render() {
    const M = st.d.matricula, A = st.d.anios, a = A.length - 1;
    let b = a - 1; while (b > 0 && M.total[b] == null) b--;
    $("col-ultima").textContent = `Matrícula: ${A[a]} · Indicadores: ${st.d.anios_ind.at(-1)}`;
    $("col-k1").textContent = mill(M.total[a]).replace(" millones", " M");
    const c = M.total[a] - M.total[b];
    $("col-k1d").innerHTML = `${c < 0 ? "−" : "+"}${fmt(Math.abs(c) / 1000, 0)} mil frente a ${A[b]}`;
    $("col-k2").textContent = fmt(M.sector["Público"][a] / M.total[a] * 100, 0) + "%";
    $("col-k2d").textContent = `en colegios públicos (${A[a]})`;
    const ai = st.d.anios_ind, cn = I("cobertura_neta"), de = I("desercion"), n = ai.length - 1;
    $("col-k3").textContent = pctTxt(cn[n]);
    $("col-k3d").textContent = `cobertura neta ${ai[n]} (${fmt(I("cobertura_neta_media")[n], 0)}% en media)`;
    $("col-k4").textContent = fmt(de[n], 2) + "%";
    $("col-k4d").innerHTML = `<span class="${clsSigno(de[n] - de[n - 1])}">${de[n] >= de[n - 1] ? "▲" : "▼"} ${fmt(Math.abs(de[n] - de[n - 1]), 2)} pts</span> vs ${ai[n - 1]}`;
    matricula(); cobertura(); salida(); deptos();
  }
  return {iniciar, render};
})());
