// Pestaña: Calidad — qué tanto aprenden: Saber 11, Saber Pro (ICFES) y PISA (OCDE)
registrar("calidad", (() => {
  const st = {d: null, prueba: "Matemáticas", brecha: "nse", dmed: "global", danio: null, pisa: "Matemáticas"};
  const PRUEBAS = ["Matemáticas", "Lectura crítica", "Ciencias naturales", "Sociales y ciudadanas", "Inglés"];
  const NSE = {"1": "Nivel socioeconómico 1 (el más bajo)", "2": "Nivel 2", "3": "Nivel 3", "4": "Nivel 4 (el más alto)"};
  const p1 = x => x == null ? "sin dato" : fmt(x, 1);

  async function iniciar() {
    st.d = await json("web/calidad.json");
    st.danio = String(st.d.s11.anios.at(-1));
    seg("cal-prueba", x => { st.prueba = x; niveles(); });
    seg("cal-brecha", x => { st.brecha = x; brechas(); });
    seg("cal-pisa", x => { st.pisa = x; pisa(); });
    const sm = $("cal-dmed"); opciones(sm, [["global", "Puntaje global (0 a 500)"], ...PRUEBAS.map(p => [p, p + " (0 a 100)"])], st.dmed);
    sm.onchange = () => { st.dmed = sm.value; deptos(); };
    const sa = $("cal-danio"); opciones(sa, st.d.s11.anios.slice().reverse().map(a => [a, a]), st.danio);
    sa.onchange = () => { st.danio = sa.value; deptos(); };
  }

  function saber11() {
    const S = st.d.s11, A = S.anios.map(String), G = S.global;
    serie("cal-s11", A, [{label: "Colegios privados", data: G["Privado"], color: css("--s3"), ancho: 2}, {label: "Colegios públicos", data: G["Público"], color: css("--s2"), ancho: 2},
      {label: "Total", data: G["Total"], color: css("--grafica"), ancho: 3}], {fmtValor: p1, despues: (i0, i1) => {
        const t = G.Total, b = G["Privado"][i1] - G["Público"][i1], mn = Math.min(...t.slice(i0, i1 + 1)), amn = A[t.indexOf(mn)];
        $("cal-s11-txt").innerHTML = `En <strong>${A[i1]}</strong> el puntaje promedio de Saber 11 fue <strong>${p1(t[i1])} sobre 500</strong>` +
          (i1 > i0 ? `; en ${A[i0]} había sido ${p1(t[i0])}` : "") + `. ${amn !== A[i1] && amn !== A[i0] ? `El punto más bajo del periodo fue ${amn} (${p1(mn)}). ` : ""}` +
          `Los colegios privados sacan en promedio <strong>${p1(b)} puntos más</strong> que los públicos. Una parte de esa diferencia no es del colegio sino de las familias: los estudiantes de los privados suelen venir de hogares con más recursos (ver las brechas, abajo).`;
      }});
  }

  function pruebas() {
    const S = st.d.s11, A = S.anios.map(String), pal = DISTINTOS();
    serie("cal-pru", A, PRUEBAS.filter(p => S.pruebas[p]).map((p, i) => ({label: p, data: S.pruebas[p].Total, color: pal[i], ancho: 2.2})), {fmtValor: p1, despues: (i0, i1) => {
      const ult = PRUEBAS.filter(p => S.pruebas[p]).map(p => [p, S.pruebas[p].Total[i1], S.pruebas[p].Total[i0]]).sort((a, b) => b[1] - a[1]);
      $("cal-pru-txt").innerHTML = `Cada prueba va de 0 a 100. En ${A[i1]} la mejor fue <strong>${ult[0][0].toLowerCase()}</strong> (${p1(ult[0][1])}) y la más floja, <strong>${ult.at(-1)[0].toLowerCase()}</strong> (${p1(ult.at(-1)[1])}). ` +
        (i1 > i0 ? `Frente a ${A[i0]}: ${ult.map(x => `${x[0].toLowerCase()} ${x[1] >= x[2] ? "+" : "−"}${p1(Math.abs(x[1] - x[2]))}`).join(", ")}.` : "");
    }});
  }

  function niveles() {
    const S = st.d.s11, A = S.anios, k = A.length - 1, p = st.prueba;
    const nv = Object.keys(S.niveles).filter(m => m.startsWith(p + "|")).sort();
    const pal = [css("--rojo"), css("--naranja"), css("--s5"), css("--verde"), css("--s4")];
    const etiquetas = A.map(String);
    dibujar("cal-niv", {type: "bar", data: {labels: etiquetas, datasets: nv.map((m, i) => ({label: m.split("|")[1], data: S.niveles[m], backgroundColor: pal[i] || css("--grafica"), borderRadius: 3}))},
      options: {responsive: true, maintainAspectRatio: false, plugins: {legend: leyendaRecordada("cal-niv"), gobiernos: {activo: false}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${fmt(c.raw, 1)}%`}}},
        scales: {x: {stacked: true, grid: {display: false}, ticks: {color: css("--muted")}}, y: {stacked: true, max: 100, grid: {color: css("--line")}, ticks: {color: css("--muted"), callback: v => v + "%"}}}}});
    const bajo = S.niveles[nv[0]], alto = S.niveles[nv.at(-1)];
    $("cal-niv-txt").innerHTML = `En ${A[k]}, <strong>${fmt(bajo[k], 0)} de cada 100</strong> estudiantes quedaron en el nivel 1 de ${p.toLowerCase()}, el más bajo: no logran lo mínimo que se espera al terminar el colegio. ` +
      `Solo ${fmt(alto[k], 0)} de cada 100 llegaron al nivel más alto. ` + (p === "Inglés" ? "En inglés los niveles siguen el Marco Común Europeo: el nivel 1 (A−) es apenas un inglés muy básico." : "");
  }

  function brechas() {
    const S = st.d.s11, A = S.anios.map(String), pal = DISTINTOS(), b = st.brecha;
    const fuente = b === "nse" ? S.nse : b === "zona" ? S.zona : S.genero;
    const orden = b === "nse" ? ["1", "2", "3", "4"] : b === "zona" ? ["Privados", "Públicos urbanos", "Públicos rurales"] : ["Mujeres", "Hombres"];
    const nombre = k => b === "nse" ? NSE[k] : b === "zona" ? "Colegios " + k.toLowerCase() : k;
    serie("cal-bre", A, orden.filter(k => fuente[k]).map((k, i) => ({label: nombre(k), data: fuente[k], color: pal[i], ancho: 2.5})), {fmtValor: p1, despues: (i0, i1) => {
      let txt = "";
      if (b === "nse") { const d = fuente["4"][i1] - fuente["1"][i1];
        txt = `Es la brecha más grande: en ${A[i1]} los estudiantes del nivel socioeconómico más alto sacaron en promedio <strong>${p1(d)} puntos más</strong> que los del más bajo (${p1(fuente["4"][i1])} frente a ${p1(fuente["1"][i1])}). El ICFES calcula este nivel con la educación de los padres y los bienes y servicios del hogar, como computador e internet.`; }
      if (b === "zona" && fuente["Públicos rurales"]) txt = `En ${A[i1]} los colegios públicos rurales promediaron ${p1(fuente["Públicos rurales"][i1])}, frente a ${p1(fuente["Públicos urbanos"][i1])} de los urbanos y ${p1(fuente["Privados"][i1])} de los privados: <strong>estudiar en el campo sigue siendo una desventaja</strong>.`;
      if (b === "genero") txt = `En ${A[i1]} los hombres sacaron ${p1(fuente.Hombres[i1] - fuente.Mujeres[i1])} puntos más que las mujeres en promedio.`;
      $("cal-bre-txt").innerHTML = txt;
    }});
  }

  async function deptos() {
    const S = st.d.s11, k = S.anios.indexOf(+st.danio), D = S.deptos[st.dmed] || {}, nac = st.dmed === "global" ? S.global.Total : S.pruebas[st.dmed]?.Total;
    const M = await json("web/mapa.json"), nd = (await json("web/colegios.json")).nombres, nombres = {}, valores = {};
    for (const c of Object.keys(M.deptos)) {
      const n = nd[c] || c; nombres[c] = /San Andr/i.test(n) ? "San Andrés" : /[a-z]/.test(n) ? n : titulo(n).replace(/^Capital /, "");
      valores[c] = D[c]?.[k] ?? null;
    }
    $("cal-dep-t").textContent = `Saber 11 por departamento, ${st.danio}`;
    mapa("cal-dep", valores, nombres, {fmtValor: p1, mayorEsMejor: true, nacional: nac ? {n: "Colombia", v: nac[k]} : null,
      alClic: c => enElTiempo("cal-dep-tiempo", `${st.dmed === "global" ? "Puntaje global" : st.dmed} en ${nombres[c]}`, S.anios.map(String),
        [{label: "Colombia", data: nac || [], color: css("--muted"), ancho: 1.6}, {label: nombres[c], data: D[c] || [], color: css("--grafica"), ancho: 2.5}],
        {fmtValor: p1, nota: "Calendario A. Toca otro departamento para cambiarlo."})});
    const o = Object.entries(valores).filter(x => x[1] != null).sort((a, b) => b[1] - a[1]);
    $("cal-dep-txt").innerHTML = `El mejor promedio lo tiene <strong>${nombres[o[0][0]]}</strong> (${p1(o[0][1])}) y el más bajo <strong>${nombres[o.at(-1)[0]]}</strong> (${p1(o.at(-1)[1])}). ` +
      `La brecha entre departamentos refleja diferencias de recursos, de ruralidad y de calidad de los colegios.`;
  }

  function saberPro() {
    const P = st.d.pro; if (!P) return;
    const A = P.anios.map(String), G = P.global, pal = DISTINTOS();
    serie("cal-pro", A, [{label: "Instituciones privadas", data: G["Privado"], color: css("--s3"), ancho: 2}, {label: "Instituciones públicas", data: G["Público"], color: css("--s2"), ancho: 2},
      {label: "Total", data: G.Total, color: css("--grafica"), ancho: 3}], {fmtValor: p1, despues: (i0, i1) => {
        const pr = Object.entries(P.pruebas).map(([m, v]) => [m, v.Total?.[i1], v.Total?.[i0]]).filter(x => x[1] != null).sort((a, b) => a[1] - b[1]);
        $("cal-pro-txt").innerHTML = `Saber Pro lo presentan quienes están terminando una carrera universitaria. Su escala se fijó para que el promedio de 2016 fuera 150. ` +
          `En <strong>${A[i1]}</strong> el promedio fue <strong>${p1(G.Total[i1])}</strong>` + (i1 > i0 ? ` (en ${A[i0]}: ${p1(G.Total[i0])})` : "") + `. ` +
          `A diferencia del colegio, <strong>aquí las instituciones públicas superan a las privadas</strong> (${p1(G["Público"][i1])} frente a ${p1(G["Privado"][i1])}): muchas universidades públicas tienen exámenes de admisión exigentes y reciben a los estudiantes con mejores resultados. ` +
          (pr.length ? `La prueba genérica más floja: ${pr[0][0].toLowerCase()} (${p1(pr[0][1])}); la mejor: ${pr.at(-1)[0].toLowerCase()} (${p1(pr.at(-1)[1])}).` : "");
      }});
  }

  function pisa() {
    const P = st.d.pisa, A = P.anios.map(String), m = st.pisa, c = P.valores.Colombia[m], o = P.valores["Promedio OCDE"][m];
    dibujar("cal-pisa-g", {type: "bar", data: {labels: A, datasets: [{label: "Colombia", data: c, backgroundColor: css("--grafica"), borderRadius: 6}, {label: "Promedio de la OCDE", data: o, backgroundColor: css("--chip"), borderRadius: 6}]},
      options: {responsive: true, maintainAspectRatio: false, plugins: {legend: leyendaRecordada("cal-pisa-g"), gobiernos: {activo: false}, tooltip: {callbacks: {label: x => `${x.dataset.label}: ${x.raw}`}}},
        scales: {x: {grid: {display: false}, ticks: {color: css("--muted")}}, y: {min: 300, grid: {color: css("--line")}, ticks: {color: css("--muted")}}}}});
    const k = A.length - 1, gap = o[k] - c[k];
    $("cal-pisa-txt").innerHTML = `En PISA ${A[k]}, Colombia sacó <strong>${c[k]} puntos en ${m.toLowerCase()}</strong>, ${gap} por debajo del promedio de los países de la OCDE (${o[k]}). ` +
      `La OCDE suele estimar que entre 20 y 30 puntos equivalen a un año de escolaridad, así que la diferencia es de <strong>varios años de aprendizaje</strong>. ` +
      `Frente a ${A[0]} Colombia ${c[k] > c[0] ? `mejoró ${c[k] - c[0]} puntos` : `perdió ${c[0] - c[k]} puntos`}, mientras el promedio de la OCDE cayó ${o[0] - o[k]}. ` +
      `Los resultados de PISA 2025 saldrán a finales de 2026; cuando se publiquen se agregarán aquí.`;
  }

  function render() {
    const S = st.d.s11, k = S.anios.length - 1, t = S.global.Total;
    $("cal-ultima").textContent = `Saber 11: ${S.anios[k]} · PISA: ${st.d.pisa.anios.at(-1)}`;
    $("cal-k1").textContent = p1(t[k]);
    $("cal-k1d").innerHTML = `<span class="${t[k] >= t[k - 1] ? "" : "pos"}">${t[k] >= t[k - 1] ? "▲" : "▼"} ${p1(Math.abs(t[k] - t[k - 1]))}</span> vs ${S.anios[k - 1]} · sobre 500`;
    $("cal-k2").textContent = p1(S.global["Privado"][k] - S.global["Público"][k]);
    $("cal-k2d").textContent = "puntos de ventaja de los colegios privados";
    $("cal-k3").textContent = fmt(S.niveles["Matemáticas|Nivel 1"][k], 0) + "%";
    $("cal-k3d").textContent = `en el nivel más bajo de matemáticas (${S.anios[k]})`;
    const P = st.d.pisa, pk = P.anios.length - 1;
    $("cal-k4").textContent = P.valores.Colombia["Matemáticas"][pk];
    $("cal-k4d").textContent = `PISA matemáticas ${P.anios[pk]} · OCDE: ${P.valores["Promedio OCDE"]["Matemáticas"][pk]}`;
    saber11(); pruebas(); niveles(); brechas(); deptos(); saberPro(); pisa();
  }
  return {iniciar, render};
})());
