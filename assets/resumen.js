// Pestaña: Resumen — el dato clave de cada tema y qué significa
registrar("resumen", (() => {
  let R = null;
  const pct = (x, d = 1) => fmt(x, d) + "%";

  function mini(id, etiquetas, valores, color, tipo = "line") {
    dibujar(id, {type: tipo, data: {labels: etiquetas, datasets: [{data: valores, borderColor: color || css("--grafica"), backgroundColor: color || css("--grafica"), borderWidth: 2, pointRadius: 0, tension: .3, fill: false, borderRadius: 3, spanGaps: true}]},
      options: {responsive: true, maintainAspectRatio: false, animation: false, plugins: {legend: {display: false}, tooltip: {enabled: false}, gobiernos: {activo: false}},
        scales: {x: {display: false}, y: {display: true, grid: {color: css("--line")}, ticks: {color: css("--muted"), maxTicksLimit: 3, font: {size: 10}, callback: v => Math.abs(v) >= 1e6 ? fmt(v / 1e6, 0) + " M" : Math.abs(v) >= 1e3 ? fmt(v / 1e3, 0) + " mil" : fmt(v, 0)}}}}});
  }

  async function iniciar() { R = await json("web/resumen.json"); }

  function render() {
    // --- ninis
    const N = R.ninis;
    $("res-nin-num").textContent = pct(N.pct);
    $("res-nin-cambio").textContent = `${etqTrim(N.fecha)} · jóvenes de 15 a 28 años`;
    $("res-nin-txt").innerHTML = `<strong>${fmt(N.pct, 0)} de cada 100 jóvenes no estudian ni trabajan</strong>: unos ${fmt(N.miles / 1000, 2)} millones de personas. ` +
      (N.pct_ant != null ? `En el mismo trimestre del año pasado eran ${pct(N.pct_ant)}: ${Math.abs(N.pct - N.pct_ant) < 0.3 ? "casi igual" : N.pct < N.pct_ant ? "<strong>mejoró</strong>" : "<strong>empeoró</strong>"}. ` : "") +
      `Es uno de los datos que mejor muestra si los jóvenes tienen oportunidades.`;
    mini("res-nin-g", N.serie[0], N.serie[1], css("--s1"));

    // --- desempleo juvenil
    const T = R.td;
    $("res-td-num").textContent = pct(T.v);
    $("res-td-cambio").textContent = `${etqTrim(T.fecha)} · hace un año: ${pct(T.ant)}`;
    $("res-td-txt").innerHTML = `De cada 100 jóvenes que buscan trabajo, <strong>${fmt(T.v, 0)} no lo encuentran</strong>. ` +
      `El desempleo de los jóvenes suele ser casi el doble del de toda la población: conseguir el primer empleo es lo más difícil.`;
    mini("res-td-g", T.serie[0], T.serie[1], css("--s2"));

    // --- presupuesto
    const B = R.presupuesto;
    $("res-pre-num").textContent = pct(B.pct);
    $("res-pre-cambio").textContent = `${etqMesLargo(B.fecha)} · ejecutado del presupuesto de educación`;
    $("res-pre-txt").innerHTML = `El sector educación tiene <strong>${plata(B.aprop)}</strong> para este año, el más grande del presupuesto nacional después de la deuda. ` +
      `Ya se ha ejecutado el ${pct(B.pct)}` + (B.pct_ant != null ? `; a la misma altura del año pasado iba en ${pct(B.pct_ant)}: <strong>${Math.abs(B.pct - B.pct_ant) < 0.5 ? "va al mismo ritmo" : B.pct > B.pct_ant ? "va más rápido" : "va más lento"}</strong>.` : ".");
    mini("res-pre-g", B.serie[0], B.serie[1], css("--s3"));

    // --- ICETEX
    const I = R.icetex, nv = I.nuevos[1], k = nv.length - 1;
    $("res-ice-num").textContent = fmt(nv[k], 0);
    $("res-ice-cambio").textContent = `créditos nuevos en el ${I.nuevos[0][k].endsWith("1") ? "1.er" : "2.º"} semestre de ${I.nuevos[0][k].slice(0, 4)}`;
    $("res-ice-txt").innerHTML = `Un año antes se habían entregado ${fmt(nv[k - 2], 0)}: ` +
      (nv[k] < nv[k - 2] * 0.6 ? `<strong>la entrega de créditos para empezar a estudiar se desplomó</strong>. ` : nv[k] < nv[k - 2] ? "bajó. " : "subió. ") +
      `Hoy hay ${fmt(I.creditos / 1000, 0)} mil créditos vivos y <strong>${fmt(I.pct_mora, 0)} de cada 100 tienen cuotas atrasadas</strong>.`;
    mini("res-ice-g", I.nuevos[0], nv, css("--grafica"), "bar");

    // --- matrícula
    const M = R.matricula, cm = M.v - M.ant;
    $("res-mat-num").textContent = fmt(M.v / 1e6, 2) + " M";
    $("res-mat-cambio").textContent = `${M.anio} · estudiantes en colegios`;
    $("res-mat-txt").innerHTML = `Hay ${fmt(M.v / 1e6, 2)} millones de niños y jóvenes matriculados en preescolar, primaria, secundaria y media, ` +
      `<strong>${fmt(Math.abs(cm) / 1000, 0)} mil ${cm < 0 ? "menos" : "más"} que el año anterior</strong>. En ${M.inicio[0]} eran ${fmt(M.inicio[1] / 1e6, 2)} millones: ` +
      `la caída viene sobre todo de que nacen menos niños.`;
    mini("res-mat-g", M.serie[0].map(String), M.serie[1], css("--s4"));

    // --- deserción
    const D = R.desercion;
    $("res-des-num").textContent = pct(D.v, 2);
    $("res-des-cambio").textContent = `${D.anio} · estudiantes que se salieron del colegio`;
    $("res-des-txt").innerHTML = `De cada 100 estudiantes, <strong>${fmt(D.v, 1)} abandonaron el colegio</strong> durante ${D.anio}; el año anterior fueron ${fmt(D.ant, 1)}. ` +
      `Es el último año que ha publicado el Ministerio de Educación: estos indicadores salen con más de un año de rezago.`;
    mini("res-des-g", D.serie[0].map(String), D.serie[1], css("--s6"));
  }
  return {iniciar, render};
})());
