// Pestaña: Educación superior — universidades, instituciones técnicas y tecnológicas (SNIES, anual)
registrar("universidades", (() => {
  const st = {d: null, desg: "sector", dmapa: "n"};
  // agrupación sencilla de los niveles de formación
  const NIVEL = {"Formación técnica profesional": "Técnico profesional", "Tecnológico": "Tecnológico", "Universitario": "Universitario (carrera profesional)",
                 "Especialización universitaria": "Posgrado", "Especialización técnico profesional": "Posgrado", "Especialización tecnológica": "Posgrado",
                 "Especialización médico quirúrgica": "Posgrado", "Maestría": "Posgrado", "Doctorado": "Posgrado"};
  const DESG = {
    sector: {t: "en instituciones públicas y privadas", orden: ["Pública", "Privada"], nombres: {"Pública": "Públicas", "Privada": "Privadas"}},
    nivel: {t: "por nivel de formación", orden: ["Técnico profesional", "Tecnológico", "Universitario (carrera profesional)", "Posgrado"]},
    modalidad: {t: "por modalidad", orden: ["Presencial", "Virtual", "A distancia", "Combinada (presencial, virtual o dual)"]},
    sexo: {t: "mujeres y hombres", orden: ["Mujeres", "Hombres"]}};
  const mill = x => x == null ? "sin dato" : x >= 1e6 ? fmt(x / 1e6, 2) + " millones" : x >= 1e4 ? fmt(x / 1000, 0) + " mil" : fmt(x, 0);
  const pct = x => fmt(x, 0) + "%";
  const sumaPor = (obj, mapa) => { const out = {}; for (const [k, v] of Object.entries(obj)) { const g = mapa[k] || k; out[g] = out[g] ? out[g].map((x, i) => (x || 0) + (v[i] || 0)) : v.slice(); } return out; };
  const ies = n => titulo(n).replace(/-[a-z]+-$/i, "").replace(/ -([a-z]+)$/i, "").replace(/\bSena\b/i, "SENA").replace(/\bUnad\b/i, "UNAD").replace(/\bCun\b/i, "CUN");

  async function iniciar() {
    st.d = await json("web/superior.json");
    seg("uni-desg", x => { st.desg = x; matricula(); });
    seg("uni-dmapa", x => { st.dmapa = x; deptos(); });
  }

  function grupos(tipo) {
    const T = st.d[tipo];
    return {sector: T.sector, nivel: sumaPor(T.nivel_formacion, NIVEL), modalidad: T.modalidad, sexo: T.sexo}[st.desg];
  }

  function matricula() {
    const A = st.d.anios.map(String), T = st.d.matriculados, D = DESG[st.desg], G = grupos("matriculados"), pal = DISTINTOS();
    const series = [{label: "Total", data: T.total, color: css("--muted"), ancho: 1.6, dash: [4, 3]}].concat(
      D.orden.filter(k => G[k]).map((k, i) => ({label: D.nombres?.[k] || k, data: G[k], color: pal[i], ancho: 2.5})));
    $("uni-mat-t").textContent = `Estudiantes de educación superior ${D.t}`;
    serie("uni-mat", A, series, {fmtValor: mill, eje0: true, despues: (i0, i1) => {
      const t = T.total, c = t[i1] - t[i0];
      let txt = `En <strong>${A[i1]}</strong> había <strong>${mill(t[i1])}</strong> de personas estudiando una carrera técnica, tecnológica, universitaria o un posgrado` +
        (i1 > i0 ? `, ${mill(Math.abs(c))} ${c >= 0 ? "más" : "menos"} que en ${A[i0]} (${c >= 0 ? "+" : "−"}${fmt(Math.abs(c / t[i0] * 100), 1)}%)` : "") + `. `;
      if (st.desg === "sector") txt += `<strong>${pct(G["Pública"][i1] / t[i1] * 100)} estudian en instituciones públicas</strong>. Ojo: entre las públicas está el SENA, que por sí solo tiene casi medio millón de estudiantes en programas técnicos y tecnológicos. `;
      if (st.desg === "nivel") txt += `${pct(G["Universitario (carrera profesional)"][i1] / t[i1] * 100)} están en una carrera universitaria, ${pct((G["Tecnológico"][i1] + G["Técnico profesional"][i1]) / t[i1] * 100)} en programas técnicos o tecnológicos y ${pct(G["Posgrado"][i1] / t[i1] * 100)} en posgrados. `;
      if (st.desg === "modalidad" && G["Virtual"]) txt += `La educación virtual ya reúne a ${pct(G["Virtual"][i1] / t[i1] * 100)} de los estudiantes` + (G["Virtual"][i0] ? `; en ${A[i0]} era ${pct(G["Virtual"][i0] / t[i0] * 100)}` : "") + `. `;
      if (st.desg === "sexo") txt += `${pct(G["Mujeres"][i1] / t[i1] * 100)} son mujeres. `;
      $("uni-mat-txt").innerHTML = txt;
    }});
  }

  function flujo() {
    const A = st.d.anios.map(String), N = st.d.primer_curso.total, G = st.d.graduados.total;
    serie("uni-flujo", A, [{label: "Nuevos estudiantes (primer curso)", data: N, color: css("--grafica"), ancho: 2.5}, {label: "Graduados", data: G, color: css("--s3"), ancho: 2.5}],
      {fmtValor: mill, eje0: true, despues: (i0, i1) => {
        let k = i1; while (k > i0 && (N[k] == null || G[k] == null)) k--;
        $("uni-flujo-txt").innerHTML = `En <strong>${A[k]}</strong> entraron por primera vez a un programa <strong>${mill(N[k])}</strong> de personas y se graduaron <strong>${mill(G[k])}</strong>. ` +
          `Que entren muchos más de los que se gradúan es normal (una carrera dura varios años), pero también refleja que muchos abandonan antes de terminar. ` +
          `Los nuevos y los graduados suman los dos semestres del año.`;
      }});
  }

  function instituciones() {
    const L = st.d.ies, a = st.d.anios.at(-1), b = st.d.anios.at(-2);
    $("uni-ies-t").textContent = `Las 20 instituciones con más estudiantes, ${a}`;
    barras("uni-ies", L.map(x => ({id: x[0], n: ies(x[0]), v: x[3], sec: x[1], ant: x[4]})), {fmtValor: x => mill(x), alto: 24,
      colores: x => x.sec === "Pública" ? css("--grafica") : css("--s3")});
    const pub = L.filter(x => x[1] === "Pública").length;
    const crec = L.filter(x => x[4] >= 10000).map(x => [x, x[3] / x[4] - 1]).sort((p, q) => q[1] - p[1])[0];
    $("uni-ies-txt").innerHTML = `En rosado, las públicas (${pub} de las 20); en morado, las privadas. Las dos más grandes son públicas y casi no tienen sedes tradicionales: ` +
      `el <strong>SENA</strong>, con programas técnicos y tecnológicos gratuitos, y la <strong>UNAD</strong>, universidad a distancia y virtual. ` +
      (crec && b ? `La que más creció frente a ${b} fue ${ies(crec[0][0])} (+${fmt(crec[1] * 100, 0)}%).` : "");
  }

  function areas() {
    const A = st.d.anios, k = A.length - 1, k0 = 0, R = st.d.areas;
    const items = Object.entries(R).map(([n, v]) => ({id: n, n, v: v[k], v0: v[k0]})).filter(x => x.v).sort((a, b) => b.v - a.v);
    const tot = items.reduce((s, x) => s + x.v, 0);
    $("uni-area-t").textContent = `Qué estudian: carreras de pregrado por área, ${A[k]}`;
    barras("uni-area", items, {fmtValor: x => `${mill(x)} (${pct(x / tot * 100)})`, alto: 30, colores: () => css("--grafica")});
    const sube = items.filter(x => x.v0).map(x => [x, x.v / x.v0 - 1]).sort((a, b) => b[1] - a[1]);
    $("uni-area-txt").innerHTML = `El área con más estudiantes es <strong>${items[0].n.toLowerCase()}</strong>: ${pct(items[0].v / tot * 100)} de los de pregrado. ` +
      (sube.length && A[k0] !== A[k] ? `Desde ${A[k0]}, la que más creció es ${sube[0][0].n.toLowerCase()} (${sube[0][1] >= 0 ? "+" : "−"}${fmt(Math.abs(sube[0][1]) * 100, 0)}%) y la que menos, ${sube.at(-1)[0].n.toLowerCase()} (${sube.at(-1)[1] >= 0 ? "+" : "−"}${fmt(Math.abs(sube.at(-1)[1]) * 100, 0)}%).` : "");
  }

  async function deptos() {
    const A = st.d.anios, k = A.length - 1, D = st.d.deptos, P = st.d.deptos_publica;
    const M = await json("web/mapa.json"), nombres = {}, valores = {};
    const nombresDep = (await json("web/colegios.json")).nombres;
    for (const c of Object.keys(M.deptos)) {
      const n = nombresDep[c] || c; nombres[c] = /San Andr/i.test(n) ? "San Andrés" : /[a-z]/.test(n) ? n : titulo(n).replace(/^Capital /, "");
      const t = D[c]?.[k];
      valores[c] = st.dmapa === "n" ? t ?? null : t ? (P[c]?.[k] || 0) / t * 100 : null;
    }
    $("uni-dep-t").textContent = st.dmapa === "n" ? `Estudiantes de educación superior por departamento, ${A[k]}` : `Porcentaje en instituciones públicas por departamento, ${A[k]}`;
    mapa("uni-dep", valores, nombres, {fmtValor: st.dmapa === "n" ? mill : (x => fmt(x, 1) + "%"), mayorEsMejor: true, log: st.dmapa === "n",
      extra: k2 => D[k2] ? `${mill(D[k2][k])} estudiantes · ${fmt((P[k2]?.[k] || 0) / D[k2][k] * 100, 0)}% en públicas` : "",
      alClic: c => enElTiempo("uni-dep-tiempo", `Estudiantes de educación superior en ${nombres[c]}`, A.map(String),
        [{label: "Total", data: D[c] || [], color: css("--grafica"), ancho: 2.5}, {label: "En instituciones públicas", data: P[c] || [], color: css("--s3"), ancho: 2}],
        {fmtValor: mill, eje0: true, nota: "Según el departamento donde se ofrece el programa. Toca otro departamento para cambiarlo."})});
    const orden = Object.entries(valores).filter(x => x[1] != null).sort((a, b) => b[1] - a[1]);
    $("uni-dep-txt").innerHTML = st.dmapa === "n"
      ? `<strong>${nombres[orden[0][0]]}</strong> concentra ${pct(orden[0][1] / st.d.matriculados.total[k] * 100)} de los estudiantes del país. Se cuentan según el departamento donde se ofrece el programa; los programas virtuales quedan en la sede de la institución, lo que infla las ciudades donde están las grandes universidades virtuales.`
      : `Donde más pesan las instituciones públicas es ${nombres[orden[0][0]]} (${fmt(orden[0][1], 0)}%); donde menos, ${nombres[orden.at(-1)[0]]} (${fmt(orden.at(-1)[1], 0)}%).`;
  }

  function render() {
    const A = st.d.anios, k = A.length - 1, T = st.d.matriculados;
    $("uni-ultima").textContent = "Último dato: " + A[k];
    $("uni-k1").textContent = mill(T.total[k]).replace(" millones", " M");
    $("uni-k1d").innerHTML = k > 0 && T.total[k - 1] ? `${T.total[k] >= T.total[k - 1] ? "+" : "−"}${fmt(Math.abs(T.total[k] / T.total[k - 1] - 1) * 100, 1)}% frente a ${A[k - 1]}` : "";
    $("uni-k2").textContent = pct(T.sector["Pública"][k] / T.total[k] * 100);
    $("uni-k2d").textContent = "en instituciones públicas";
    $("uni-k3").textContent = mill(st.d.primer_curso.total[k]);
    $("uni-k3d").textContent = `nuevos estudiantes en ${A[k]}`;
    $("uni-k4").textContent = mill(st.d.graduados.total[k]);
    $("uni-k4d").textContent = `graduados en ${A[k]}`;
    matricula(); flujo(); instituciones(); areas(); deptos();
  }
  return {iniciar, render};
})());
