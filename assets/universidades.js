// Pestaña: Educación superior — universidades, instituciones técnicas y tecnológicas (SNIES, anual)
registrar("universidades", (() => {
  const st = {d: null, desg: "sector", dmapa: "n", aIes: null, aArea: null, aDep: null};
  // agrupación sencilla de los niveles de formación
  const NIVEL = {"Formación técnica profesional": "Técnico profesional", "Tecnológico": "Tecnológico", "Universitario": "Universitario (carrera profesional)",
                 "Especialización universitaria": "Posgrado", "Especialización técnico profesional": "Posgrado", "Especialización tecnológica": "Posgrado",
                 "Especialización médico quirúrgica": "Posgrado", "Maestría": "Posgrado", "Doctorado": "Posgrado"};
  const DESG = {
    sector: {t: "en instituciones públicas y privadas", orden: ["Pública", "Privada"], nombres: {"Pública": "Públicas", "Privada": "Privadas"}},
    nivel: {t: "por nivel de formación", orden: ["Técnico profesional", "Tecnológico", "Universitario (carrera profesional)", "Posgrado"]},
    modalidad: {t: "por modalidad", orden: ["Presencial", "Virtual", "A distancia", "Combinada (presencial, virtual o dual)"]},
    sexo: {t: "mujeres y hombres", orden: ["Mujeres", "Hombres"]}};
  // la explicación que acompaña a cada forma de ver la gráfica
  const EXP = {
    sector: [["Públicas", "Las financia el Estado: universidades públicas, institutos técnicos y tecnológicos oficiales y el SENA. La matrícula es gratuita o muy barata."],
             ["Privadas", "Universidades, instituciones universitarias y técnicas privadas. Se financian sobre todo con lo que pagan los estudiantes."],
             ["Ojo con el SENA", "Cuenta como institución pública de educación superior por sus programas técnicos y tecnológicos, y es la más grande del país."]],
    nivel: [["Técnico y tecnológico", "Programas cortos, de dos a tres años, para un oficio específico. El SENA es el que más estudiantes tiene."],
            ["Universitario", "Las carreras profesionales, de cuatro a cinco años."],
            ["Posgrado", "Especializaciones, maestrías y doctorados, que se estudian después de una carrera."]],
    modalidad: [["Presencial", "Clases en un salón, en la sede de la institución."],
                ["Virtual", "Todo por internet, desde cualquier lugar."],
                ["A distancia y combinada", "A distancia: el estudiante trabaja por su cuenta con tutorías periódicas. Combinada: mezcla clases presenciales, virtuales o en una empresa (dual)."]],
    sexo: []};
  const mill = x => x == null ? "sin dato" : x >= 1e6 ? fmt(x / 1e6, 2) + " millones" : x >= 1e4 ? fmt(x / 1000, 0) + " mil" : fmt(x, 0);
  const pct = x => fmt(x, 0) + "%";
  const sumaPor = (obj, mapa) => { const out = {}; for (const [k, v] of Object.entries(obj)) { const g = mapa[k] || k; out[g] = out[g] ? out[g].map((x, i) => (x || 0) + (v[i] || 0)) : v.slice(); } return out; };
  const ies = n => titulo(n).replace(/-[a-z]+-$/i, "").replace(/ -([a-z]+)$/i, "").replace(/\bSena\b/i, "SENA").replace(/\bUnad\b/i, "UNAD").replace(/\bCun\b/i, "CUN");

  async function iniciar() {
    st.d = await json("web/superior.json");
    seg("uni-desg", x => { st.desg = x; matricula(); });
    seg("uni-dmapa", x => { st.dmapa = x; deptos(); });
    // selectores de año: así se puede ver cómo cambia cada cosa de un año a otro
    const A = st.d.anios.slice().reverse().map(a => [a, a]);
    st.aIes = st.aArea = st.aDep = String(st.d.anios.at(-1));
    for (const [id, k, f] of [["uni-ies-anio", "aIes", instituciones], ["uni-area-anio", "aArea", areas], ["uni-dep-anio", "aDep", deptos]]) {
      opciones($(id), A, st[k]); $(id).onchange = () => { st[k] = $(id).value; f(); };
    }
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
    $("uni-mat-exp").innerHTML = EXP[st.desg].map(([t, d]) => `<div><strong>${t}</strong><span>${d}</span></div>`).join("");
    serie("uni-mat", A, series, {fmtValor: mill, eje0: true, despues: (i0, i1) => {
      const t = T.total, c = t[i1] - t[i0];
      let txt = `En <strong>${A[i1]}</strong> había <strong>${mill(t[i1])}</strong> de personas estudiando una carrera técnica, tecnológica, universitaria o un posgrado` +
        (i1 > i0 ? `, ${mill(Math.abs(c))} ${c >= 0 ? "más" : "menos"} que en ${A[i0]} (${c >= 0 ? "+" : "−"}${fmt(Math.abs(c / t[i0] * 100), 1)}%)` : "") + `. `;
      if (st.desg === "sector") txt += `<strong>${pct(G["Pública"][i1] / t[i1] * 100)} estudian en instituciones públicas</strong>` + (i1 > i0 ? `; en ${A[i0]} eran ${pct(G["Pública"][i0] / t[i0] * 100)}. En ese tiempo las públicas ${G["Pública"][i1] >= G["Pública"][i0] ? "ganaron " + mill(G["Pública"][i1] - G["Pública"][i0]) : "perdieron " + mill(G["Pública"][i0] - G["Pública"][i1])} estudiantes y las privadas ${G["Privada"][i1] >= G["Privada"][i0] ? "ganaron " + mill(G["Privada"][i1] - G["Privada"][i0]) : "perdieron " + mill(G["Privada"][i0] - G["Privada"][i1])}. ` : ". ");
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
    const y = st.aIes, L = st.d.ies[y] || [], A = st.d.anios, prev = A[A.indexOf(+y) - 1];
    $("uni-ies-t").textContent = `Las 20 instituciones con más estudiantes, ${y}`;
    barras("uni-ies", L.map(x => ({id: x[0], n: ies(x[0]), v: x[3], sec: x[1], ant: x[4]})), {alto: 24,
      fmtValor: (v, x) => mill(v), colores: x => x.sec === "Pública" ? css("--grafica") : css("--s3")});
    const pub = L.filter(x => x[1] === "Pública").length, tot = st.d.matriculados.total[A.indexOf(+y)], suma = L.reduce((s, x) => s + x[3], 0);
    const conAnt = L.filter(x => x[4] >= 10000).map(x => [x, x[3] / x[4] - 1]).sort((p, q) => q[1] - p[1]);
    let txt = `En rosado, las públicas (${pub} de las 20); en morado, las privadas. Entre las 20 reúnen <strong>${pct(suma / tot * 100)} de todos los estudiantes</strong> del país. `;
    const dos = L.slice(0, 2).map(x => ies(x[0]));
    if (/SENA/.test(dos[0])) txt += `La más grande es el <strong>SENA</strong>, que ofrece programas técnicos y tecnológicos gratuitos en todo el país${/UNAD/.test(dos[1]) ? `; le sigue la <strong>UNAD</strong>, la universidad pública a distancia y virtual` : ""}. `;
    if (prev && conAnt.length) txt += `Frente a ${prev}, la que más creció fue ${ies(conAnt[0][0][0])} (+${fmt(conAnt[0][1] * 100, 0)}%)` +
      (conAnt.at(-1)[1] < 0 ? ` y la que más estudiantes perdió fue ${ies(conAnt.at(-1)[0][0])} (−${fmt(Math.abs(conAnt.at(-1)[1]) * 100, 0)}%).` : ".");
    $("uni-ies-txt").innerHTML = txt;
  }

  function areas() {
    const A = st.d.anios, k = A.indexOf(+st.aArea), R = st.d.areas;
    const items = Object.entries(R).map(([n, v]) => ({id: n, n, v: v[k], ant: k > 0 ? v[k - 1] : null})).filter(x => x.v).sort((a, b) => b.v - a.v);
    const tot = items.reduce((s, x) => s + x.v, 0);
    $("uni-area-t").textContent = `Qué estudian: carreras de pregrado por área, ${A[k]}`;
    barras("uni-area", items, {fmtValor: x => `${mill(x)} (${pct(x / tot * 100)})`, alto: 30, colores: () => css("--grafica")});
    const camb = items.filter(x => x.ant).map(x => [x, x.v / x.ant - 1]).sort((a, b) => b[1] - a[1]);
    const sig = v => `${v >= 0 ? "+" : "−"}${fmt(Math.abs(v) * 100, 1)}%`;
    $("uni-area-txt").innerHTML = `El área con más estudiantes es <strong>${items[0].n.toLowerCase()}</strong>, con ${pct(items[0].v / tot * 100)} de los de pregrado, seguida de ${items[1].n.toLowerCase()} (${pct(items[1].v / tot * 100)}). ` +
      (camb.length ? `Frente a ${A[k - 1]}, ` + (camb[0][1] >= 0 ? `la que más creció fue ${camb[0][0].n.toLowerCase()} (${sig(camb[0][1])})` : `todas las áreas perdieron estudiantes; la que menos cayó fue ${camb[0][0].n.toLowerCase()} (${sig(camb[0][1])})`) +
        (camb.at(-1)[1] < 0 ? ` y la que más cayó, ${camb.at(-1)[0].n.toLowerCase()} (${sig(camb.at(-1)[1])}). ` : ` y la que menos creció, ${camb.at(-1)[0].n.toLowerCase()} (${sig(camb.at(-1)[1])}). `) : "");
  }

  async function deptos() {
    const A = st.d.anios, k = A.indexOf(+st.aDep), D = st.d.deptos, P = st.d.deptos_publica, y = A[k];
    const M = await json("web/mapa.json"), nombres = {}, valores = {};
    const nombresDep = (await json("web/colegios.json")).nombres;
    for (const c of Object.keys(M.deptos)) {
      const n = nombresDep[c] || c; nombres[c] = /San Andr/i.test(n) ? "San Andrés" : /[a-z]/.test(n) ? n : titulo(n).replace(/^Capital /, "");
      const t = D[c]?.[k];
      valores[c] = st.dmapa === "n" ? t ?? null : t ? (P[c]?.[k] || 0) / t * 100 : null;
    }
    // en departamentos con pocos estudiantes el % en públicas depende de una o dos instituciones: se dejan por fuera del ranking
    const grande = c => (D[c]?.[k] || 0) >= 10000;
    $("uni-dep-t").textContent = st.dmapa === "n" ? `Estudiantes de educación superior por departamento, ${y}` : `Porcentaje de estudiantes en instituciones públicas, ${y}`;
    mapa("uni-dep", valores, nombres, {fmtValor: st.dmapa === "n" ? mill : (x => fmt(x, 0) + "%"), mayorEsMejor: true, log: st.dmapa === "n",
      enRanking: st.dmapa === "n" ? null : grande,
      extra: c => D[c]?.[k] ? `${mill(D[c][k])} estudiantes · ${fmt((P[c]?.[k] || 0) / D[c][k] * 100, 0)}% en públicas` : "",
      alClic: c => enElTiempo("uni-dep-tiempo", `Estudiantes de educación superior en ${nombres[c]}`, A.map(String),
        [{label: "Total", data: D[c] || [], color: css("--grafica"), ancho: 2.5}, {label: "En instituciones públicas", data: P[c] || [], color: css("--s3"), ancho: 2}],
        {fmtValor: mill, eje0: true, nota: "Según el departamento donde se ofrece el programa. Toca otro departamento para cambiarlo."})});
    const tot = st.d.matriculados.total[k];
    if (st.dmapa === "n") {
      const o = Object.entries(valores).filter(x => x[1] != null).sort((a, b) => b[1] - a[1]), top3 = o.slice(0, 3).reduce((s, x) => s + x[1], 0);
      $("uni-dep-txt").innerHTML = `<strong>${nombres[o[0][0]]}</strong> tiene ${pct(o[0][1] / tot * 100)} de los estudiantes del país, y junto con ${nombres[o[1][0]]} y ${nombres[o[2][0]]} suman ${pct(top3 / tot * 100)}. ` +
        `Los colores van en escala logarítmica para que se distingan también los departamentos pequeños. ` +
        `Cada estudiante se cuenta en el departamento donde se ofrece su programa; en los programas virtuales eso suele ser la ciudad sede de la institución, así que las ciudades grandes aparecen con más estudiantes de los que realmente viven allí.`;
    } else {
      const o = Object.entries(valores).filter(x => x[1] != null && grande(x[0])).sort((a, b) => b[1] - a[1]);
      $("uni-dep-txt").innerHTML = `Entre los departamentos con más de 10.000 estudiantes, donde más pesan las instituciones públicas es <strong>${nombres[o[0][0]]}</strong> (${fmt(o[0][1], 0)}%) y donde menos, <strong>${nombres[o.at(-1)[0]]}</strong> (${fmt(o.at(-1)[1], 0)}%), donde la oferta privada es más grande. ` +
        `Los departamentos pequeños quedan por fuera de la comparación: allí suele haber una o dos instituciones, casi siempre públicas (una universidad departamental o el SENA), así que un porcentaje alto no dice mucho.`;
    }
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
