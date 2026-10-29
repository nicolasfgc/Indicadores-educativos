// Pestaña: ICETEX — créditos para estudiar: cuántos se entregan, a quién y cómo se están pagando
registrar("icetex", (() => {
  const st = {d: null, dim: "nivel", tipo: "nuevos", per: null, mora: "pct", dmed: "pct"};
  const DIM = {nivel: "Nivel de estudios", estrato: "Estrato", sector_ies: "Tipo de institución", sexo: "Sexo"};
  // "2025-1" -> "2025-01-01"; "2025-2" -> "2025-07-01" (para usar las gráficas de series de tiempo)
  const aFecha = p => `${p.slice(0, 4)}-${p.endsWith("1") ? "01" : "07"}-01`;
  const etqSem = f => `${f.slice(5, 7) === "01" ? "1.er" : "2.º"} semestre ${f.slice(0, 4)}`;
  const etqP = p => etqSem(aFecha(p));
  const trim = f => f.slice(0, 8) + "01";   // fecha de corte (fin de trimestre) -> mes
  const etqCorte = f => `${MESES_L[+f.slice(5, 7) - 1]} de ${f.slice(0, 4)}`;
  const C = (ep, m) => st.d.cartera[ep][m];
  const pct = (ep, i) => { const c = C(ep, "creditos")[i], m = C(ep, "en_mora")[i]; return c ? m / c * 100 : null; };

  async function iniciar() {
    st.d = await json("web/icetex.json");
    st.per = st.d.periodos.at(-1);
    $("ice-ultima").textContent = `Cartera: ${etqCorte(st.d.fechas.at(-1))} · Créditos: ${etqP(st.per)}`;
    seg("ice-dim", x => { st.dim = x; quienes(); });
    seg("ice-tipo", x => { st.tipo = x; quienes(); });
    seg("ice-mora", x => { st.mora = x; cartera(); });
    seg("ice-dmed", x => { st.dmed = x; deptos(); });
    const s = $("ice-per");
    opciones(s, st.d.periodos.slice().reverse().map(p => [p, etqP(p)]), st.per);
    s.onchange = () => { st.per = s.value; quienes(); };
  }

  function entregas() {
    const P = st.d.periodos, F = P.map(aFecha), N = st.d.creditos.nuevos.total.Total, R = st.d.creditos.renovados.total.Total;
    serie("ice-ent", F, [{label: "Créditos nuevos", data: N, tipo: "bar", color: css("--grafica")}, {label: "Renovaciones", data: R, color: css("--muted"), ancho: 2, eje: "y2"}],
      {fmtValor: x => fmt(x, 0), fmtValor2: x => fmt(x, 0), fmtX: etqSem, gobiernos: true, eje0: true, atajos: [["3 años", 6], ["5 años", 10], ["Todo", 0]], inicio: 10, despues: (i0, i1) => {
        const k = i1, k2 = k - 2, n = N[k], n2 = N[k2];
        const prom = N.slice(Math.max(0, k - 9), k - 1).filter(x => x != null), pr = prom.reduce((a, b) => a + b, 0) / (prom.length || 1);
        let txt = `En el <strong>${etqSem(F[k])}</strong> el ICETEX entregó <strong>${fmt(n, 0)} créditos nuevos</strong>` +
          (n2 != null ? `, ${n < n2 ? fmt((1 - n / n2) * 100, 0) + "% menos" : fmt((n / n2 - 1) * 100, 0) + "% más"} que en el mismo semestre del año anterior (${fmt(n2, 0)})` : "") + `. ` +
          `Además renovó ${fmt(R[k], 0)} créditos de estudiantes que ya lo tenían (cada semestre hay que renovarlo para que siga pagando la matrícula). `;
        if (n < pr * 0.5) txt += `<strong>Es una caída muy fuerte</strong>: en los años anteriores el promedio era de unos ${fmt(pr / 1000, 0)} mil créditos nuevos por semestre. Coincide con los recortes de recursos del ICETEX y el fin de los subsidios a la tasa de interés en 2025, que dejaron a miles de estudiantes sin crédito para empezar a estudiar.`;
        $("ice-ent-txt").innerHTML = txt;
      }});
  }

  function quienes() {
    const P = st.d.periodos, k = P.indexOf(st.per), D = st.d.creditos[st.tipo][st.dim] || {};
    let items = Object.entries(D).map(([c, v]) => ({id: c, n: c, v: v[k]})).filter(x => x.v);
    if (st.dim === "estrato") items.sort((a, b) => a.n.localeCompare(b.n)); else items.sort((a, b) => b.v - a.v);
    const tot = items.reduce((a, x) => a + x.v, 0);
    $("ice-q-t").textContent = `${st.tipo === "nuevos" ? "Créditos nuevos" : "Renovaciones"} por ${DIM[st.dim].toLowerCase()}, ${etqP(st.per)}`;
    barras("ice-q", items, {fmtValor: x => `${fmt(x, 0)} (${fmt(x / tot * 100, 0)}%)`, alto: 30, colores: () => css("--grafica")});
    const top = items.slice().sort((a, b) => b.v - a.v)[0];
    let txt = top ? `De ${fmt(tot, 0)} ${st.tipo === "nuevos" ? "créditos nuevos" : "renovaciones"}, el grupo más grande es <strong>${top.n.toLowerCase()}</strong> (${fmt(top.v / tot * 100, 0)}%). ` : "";
    if (st.dim === "estrato") { const bajos = items.filter(x => /Estrato [123]$/.test(x.n)).reduce((a, x) => a + x.v, 0); txt += `<strong>${fmt(bajos / tot * 100, 0)} de cada 100</strong> son de estratos 1, 2 y 3: el ICETEX es, sobre todo, la forma de pagar la universidad de familias de ingresos bajos y medios.`; }
    if (st.dim === "sector_ies") txt += "La mayoría de los créditos se usan en universidades privadas, donde la matrícula es mucho más cara que en las públicas.";
    $("ice-q-txt").innerHTML = txt;
  }

  function cartera() {
    const F = st.d.fechas.map(trim), n = F.length;
    const ser = st.mora === "pct"
      ? [{label: "Ya pagando", data: F.map((f, i) => pct("pagando", i)), color: css("--s2"), ancho: 2},
         {label: "Todavía estudiando", data: F.map((f, i) => pct("estudios", i)), color: css("--s3"), ancho: 2},
         {label: "Total", data: F.map((f, i) => pct("todas", i)), color: css("--grafica"), ancho: 3}]
      : [{label: "Ya pagando", data: C("pagando", "creditos"), color: css("--s2"), ancho: 2},
         {label: "Todavía estudiando", data: C("estudios", "creditos"), color: css("--s3"), ancho: 2},
         {label: "Total", data: C("todas", "creditos"), color: css("--grafica"), ancho: 3}];
    serie("ice-cart", F, ser, {fmtValor: st.mora === "pct" ? (x => x == null ? "dato atípico" : fmt(x, 1) + "%") : (x => x == null ? "dato atípico" : fmt(x, 0)), eje0: st.mora !== "pct",
      fmtX: f => `${etqMes(f)}`, atajos: [["1 año", 4], ["3 años", 12], ["Todo", 0]], inicio: 12, despues: (i0, i1) => {
        let k = i1; while (k > i0 && pct("todas", k) == null) k--;
        const p = pct("todas", k), pp = pct("pagando", k), pe = pct("estudios", k), k4 = k - 4, p4 = k4 >= 0 ? pct("todas", k4) : null;
        const saldo = C("todas", "saldo_total")[k] / 1e6, sm = C("todas", "saldo_mora")[k] / 1e6;
        let txt = `A ${etqCorte(st.d.fechas[k])} el ICETEX tenía <strong>${fmt(C("todas", "creditos")[k], 0)} créditos vivos</strong>, que suman ${plata(saldo)}. ` +
          `<strong>${fmt(p, 1)} de cada 100 tienen al menos una cuota atrasada</strong>` + (p4 != null ? ` (un año antes, ${fmt(p4, 1)})` : "") + `. ` +
          `Entre quienes ya terminaron y están pagando, la mora es ${fmt(pp, 1)}%; entre quienes todavía estudian, ${fmt(pe, 1)}%. Lo que está vencido suma ${plata(sm)}.`;
        if (st.d.atipicos.length) txt += ` En ${st.d.atipicos.map(f => etqCorte(f)).join(" y ")} el número de créditos de la fuente tiene un salto que no es creíble (cae y se recupera al trimestre siguiente), así que ese dato se dejó vacío.`;
        $("ice-cart-txt").innerHTML = txt;
      }});
  }

  const nomDep = n => { const t = titulo(n); return t.charAt(0).toUpperCase() + t.slice(1); };
  function deptos() {
    const lista = st.d.deptos.filter(d => d[2] >= 100), F = etqCorte(st.d.fechas.at(-1));
    const pctD = d => d[3] / d[2] * 100, dudoso = d => pctD(d) < 2;
    const valores = {}, nombres = {}, info = {};
    lista.forEach(d => { valores[d[0]] = st.dmed === "pct" ? pctD(d) : d[2]; nombres[d[0]] = nomDep(d[1]); info[d[0]] = d; });
    $("ice-dep-t").textContent = st.dmed === "pct" ? `Créditos con cuotas atrasadas por departamento, ${F}` : `Créditos vivos por departamento, ${F}`;
    mapa("ice-dep", valores, nombres, {
      fmtValor: st.dmed === "pct" ? (x => fmt(x, 1) + "%") : (x => fmt(x, 0)), mayorEsMejor: st.dmed === "pct" ? false : true,
      dudoso: k => st.dmed === "pct" && dudoso(info[k]),
      extra: k => { const d = info[k]; return d ? `${fmt(d[2], 0)} créditos · ${fmt(pctD(d), 1)}% atrasados · saldo ${plata(d[4])}` : ""; },
      nacional: st.dmed === "pct" ? {n: "Colombia", v: pct("todas", st.d.fechas.length - 1)} : null,
      alClic: depTiempo});
    const normales = lista.filter(d => !dudoso(d)).sort((a, b) => pctD(b) - pctD(a)), raros = lista.filter(dudoso);
    const may = lista.slice().sort((a, b) => b[2] - a[2])[0];
    $("ice-dep-txt").innerHTML = `La mora más alta está en <strong>${nomDep(normales[0][1])}</strong> (${fmt(pctD(normales[0]), 1)}%) y la más baja en <strong>${nomDep(normales.at(-1)[1])}</strong> (${fmt(pctD(normales.at(-1)), 1)}%). ` +
      `El departamento con más créditos es ${nomDep(may[1])}: ${fmt(may[2], 0)}. ` +
      (raros.length ? `<strong>Ojo:</strong> ${listaY(raros.map(d => nomDep(d[1])))} aparecen en la fuente casi sin créditos atrasados (menos de 2%), algo poco creíble frente al resto del país; puede ser un problema en cómo el ICETEX reporta esos departamentos. En el mapa de mora van en gris. ` : "") +
      `Se muestran los departamentos con al menos 100 créditos, según dónde vive el beneficiario.`;
  }
  function depTiempo(k) {
    const F = st.d.fechas.map(trim), d = st.d.deptos.find(x => x[0] === k);
    enElTiempo("ice-dep-tiempo", `Créditos con cuotas atrasadas en ${nomDep(d[1])}`, F,
      [{label: "Colombia", data: F.map((f, i) => pct("todas", i)), color: css("--muted"), ancho: 1.6}, {label: nomDep(d[1]), data: st.d.deptos_hist[k] || [], color: css("--grafica"), ancho: 2.5}],
      {fmtValor: x => x == null ? "sin dato" : fmt(x, 1) + "%", eje0: true, atajos: [["1 año", 4], ["3 años", 12], ["Todo", 0]], inicio: 12, nota: "Porcentaje de créditos con al menos una cuota atrasada, al cierre de cada trimestre. Toca otro departamento para cambiarlo."});
  }

  function render() {
    const n = st.d.fechas.length - 1, P = st.d.periodos, k = P.length - 1, N = st.d.creditos.nuevos.total.Total;
    $("ice-k1").textContent = fmt(C("todas", "creditos")[n] / 1000, 0) + " mil";
    $("ice-k1d").textContent = `créditos vivos a ${etqCorte(st.d.fechas[n])}`;
    const p = pct("todas", n), p4 = pct("todas", n - 4);
    $("ice-k2").textContent = fmt(p, 1) + "%";
    $("ice-k2d").innerHTML = p4 == null ? "" : `<span class="${clsSigno(p - p4)}">${p >= p4 ? "▲" : "▼"} ${fmt(Math.abs(p - p4), 1)} pts</span> en un año`;
    $("ice-k3").textContent = fmt(N[k], 0);
    $("ice-k3d").innerHTML = N[k - 2] ? `<span class="${N[k] < N[k - 2] ? "pos" : ""}">${N[k] < N[k - 2] ? "−" : "+"}${fmt(Math.abs(N[k] / N[k - 2] - 1) * 100, 0)}%</span> vs ${etqP(P[k - 2])}` : "";
    $("ice-k4").textContent = plata(C("todas", "saldo_total")[n] / 1e6);
    $("ice-k4d").textContent = "lo que le deben al ICETEX";
    entregas(); quienes(); cartera(); deptos();
  }
  return {iniciar, render};
})());
