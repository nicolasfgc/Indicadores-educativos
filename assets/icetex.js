// Pestaña: ICETEX — créditos para estudiar: cuántos se entregan, a quién y cómo se están pagando
registrar("icetex", (() => {
  const st = {d: null, dim: "nivel", tipo: "nuevos", per: null, mora: "pct", dmed: "pct"};
  const DIM = {nivel: "Nivel de estudios", estrato: "Estrato", sector_ies: "Tipo de institución", sexo: "Sexo"};
  // "2025-1" -> "2025-01-01"; "2025-2" -> "2025-07-01" (para usar las gráficas de series de tiempo)
  const aFecha = p => `${p.slice(0, 4)}-${p.endsWith("1") ? "01" : "07"}-01`;
  const etqSem = f => `${f.slice(5, 7) === "01" ? "1.er" : "2.º"} semestre ${f.slice(0, 4)}`;
  const etqP = p => `${p.endsWith("1") ? "primer" : "segundo"} semestre de ${p.slice(0, 4)}`;
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
    // año y semestre por separado
    const sa = $("ice-anio"), ss = $("ice-sem");
    const anios = [...new Set(st.d.periodos.map(p => p.slice(0, 4)))].reverse();
    opciones(sa, anios.map(a => [a, a]), st.per.slice(0, 4));
    const semestres = () => { const ps = st.d.periodos.filter(p => p.startsWith(sa.value));
      if (!ps.includes(st.per)) st.per = ps.find(p => p.slice(-1) === st.per.slice(-1)) || ps.at(-1);
      opciones(ss, ps.map(p => [p.slice(-1), p.endsWith("1") ? "Primer semestre" : "Segundo semestre"]), st.per.slice(-1)); };
    semestres();
    sa.onchange = () => { semestres(); quienes(); };
    ss.onchange = () => { st.per = `${sa.value}-${ss.value}`; quienes(); };
    // mapa: cualquier trimestre
    st.fDep = st.d.fechas.at(-1);
    periodo("ice-dep-per", st.d.fechas, st.fDep, f => { st.fDep = f; deptos(); });
    $("ice-dep-per").querySelectorAll(".lbl")[1].textContent = "Corte a";
  }

  function entregas() {
    const P = st.d.periodos, F = P.map(aFecha), N = st.d.creditos.nuevos.total.Total, R = st.d.creditos.renovados.total.Total;
    serie("ice-ent", F, [{label: "Créditos nuevos", data: N, tipo: "bar", color: css("--grafica")}, {label: "Renovaciones", data: R, color: css("--muted"), ancho: 2, eje: "y2"}],
      {fmtValor: x => fmt(x, 0), fmtValor2: x => fmt(x, 0), fmtX: etqSem, gobiernos: true, eje0: true, atajos: [["3 años", 6], ["5 años", 10], ["Todo", 0]], inicio: 10, despues: (i0, i1) => {
        const k = i1, k2 = k - 2, n = N[k], n2 = N[k2];
        const prom = N.slice(Math.max(0, k - 9), k - 1).filter(x => x != null), pr = prom.reduce((a, b) => a + b, 0) / (prom.length || 1);
        let txt = `En el <strong>${etqP(P[k])}</strong> el ICETEX entregó <strong>${fmt(n, 0)} créditos nuevos</strong>` +
          (n2 != null ? `, ${n < n2 ? fmt((1 - n / n2) * 100, 0) + "% menos" : fmt((n / n2 - 1) * 100, 0) + "% más"} que en el mismo semestre del año anterior (${fmt(n2, 0)})` : "") + `. ` +
          `Además renovó ${fmt(R[k], 0)} créditos de estudiantes que ya lo tenían (cada semestre hay que renovarlo para que siga pagando la matrícula). `;
        if (n < pr * 0.5) txt += `<strong>Es una caída muy fuerte</strong>: en los años anteriores el promedio era de unos ${fmt(pr / 1000, 0)} mil créditos nuevos por semestre. Coincide con los recortes de recursos del ICETEX y el fin de los subsidios a la tasa de interés en 2025, que dejaron a miles de estudiantes sin crédito para empezar a estudiar.`;
        $("ice-ent-txt").innerHTML = txt;
      }});
  }

  function quienes() {
    const P = st.d.periodos, k = P.indexOf(st.per), D = st.d.creditos[st.tipo][st.dim] || {};
    const k2 = P.indexOf(`${+st.per.slice(0, 4) - 1}${st.per.slice(4)}`);   // mismo semestre del año anterior
    const NOM = {Privado: "Instituciones privadas", Oficial: "Instituciones públicas", "No aplica (exterior)": "Estudios en el exterior"};
    let items = Object.entries(D).map(([c, v]) => ({id: c, n: NOM[c] || c, v: v[k], ant: k2 >= 0 ? v[k2] : null})).filter(x => x.v);
    if (st.dim === "estrato") items.sort((a, b) => a.n.localeCompare(b.n)); else items.sort((a, b) => b.v - a.v);
    const tot = items.reduce((a, x) => a + x.v, 0), totAnt = k2 >= 0 ? Object.values(D).reduce((a, v) => a + (v[k2] || 0), 0) : 0;
    const quien = st.tipo === "nuevos" ? "créditos nuevos" : "renovaciones";
    $("ice-q-t").textContent = `${st.tipo === "nuevos" ? "Créditos nuevos" : "Renovaciones"} por ${DIM[st.dim].toLowerCase()}, ${etqP(st.per)}`;
    barras("ice-q", items, {fmtValor: x => `${fmt(x, 0)} (${fmt(x / tot * 100, 0)}%)`, alto: 30, colores: () => css("--grafica")});
    const top = items.slice().sort((a, b) => b.v - a.v)[0];
    const parte = (lista, t) => lista.reduce((a, x) => a + x, 0) / t * 100;
    let txt = top ? `En el ${etqP(st.per)} hubo ${fmt(tot, 0)} ${quien}` + (totAnt ? ` (en el mismo semestre del año anterior, ${fmt(totAnt, 0)})` : "") + `. ` +
      (["nivel", "estrato"].includes(st.dim) ? `El grupo más grande es <strong>${top.n.toLowerCase()}</strong>, con ${fmt(top.v / tot * 100, 0)}%. ` : "") : "";
    if (st.dim === "estrato") { const f = x => /Estrato [123]$/.test(x.n), b = parte(items.filter(f).map(x => x.v), tot);
      txt += `<strong>${fmt(b, 0)} de cada 100</strong> son de estratos 1, 2 y 3: el ICETEX financia sobre todo a familias de ingresos bajos y medios. ` +
        (totAnt ? `Un año antes eran ${fmt(parte(items.filter(f).map(x => x.ant || 0), totAnt), 0)} de cada 100.` : ""); }
    if (st.dim === "sector_ies") { const priv = items.find(x => /privad/i.test(x.n));
      if (priv) txt += `${fmt(priv.v / tot * 100, 0)} de cada 100 son para estudiar en instituciones privadas, donde la matrícula es mucho más cara que en las públicas` + (totAnt && priv.ant ? `; un año antes eran ${fmt(priv.ant / totAnt * 100, 0)}.` : "."); }
    if (st.dim === "sexo") { const m = items.find(x => /fem|mujer/i.test(x.n)); if (m) txt += `${fmt(m.v / tot * 100, 0)} de cada 100 son mujeres.`; }
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
          `Entre quienes ya terminaron y están pagando, ${fmt(pp, 1)}% tienen cuotas atrasadas; entre quienes todavía estudian, ${fmt(pe, 1)}%. Lo que está vencido suma ${plata(sm)}.`;
        if (st.d.atipicos.length) txt += ` En ${st.d.atipicos.map(f => etqCorte(f)).join(" y ")} el número de créditos de la fuente tiene un salto que no es creíble (cae y se recupera al trimestre siguiente), así que ese dato se dejó vacío.`;
        $("ice-cart-txt").innerHTML = txt;
      }});
  }

  const nomDep = n => { const t = titulo(n); return t.charAt(0).toUpperCase() + t.slice(1); };
  function deptos() {
    const i = st.d.fechas.indexOf(st.fDep), F = etqCorte(st.fDep), H = st.d.deptos_hist, N = st.d.nombres_dep;
    const cr = c => H[c]?.creditos[i], pc = c => H[c]?.pct[i];
    const lista = Object.keys(H).filter(c => cr(c) >= 100);
    const dudoso = c => pc(c) != null && pc(c) < 2;
    const valores = {}, nombres = {};
    lista.forEach(c => { valores[c] = st.dmed === "pct" ? pc(c) : cr(c); nombres[c] = nomDep(N[c]); });
    $("ice-dep-t").textContent = st.dmed === "pct" ? `Créditos con cuotas atrasadas por departamento, ${F}` : `Créditos vivos por departamento, ${F}`;
    mapa("ice-dep", valores, nombres, {
      fmtValor: st.dmed === "pct" ? (x => fmt(x, 1) + "%") : (x => fmt(x, 0)), mayorEsMejor: st.dmed !== "pct", log: st.dmed !== "pct",
      dudoso: c => st.dmed === "pct" && dudoso(c),
      extra: c => H[c] ? `${fmt(cr(c), 0)} créditos · ${fmt(pc(c), 1)}% atrasados · saldo ${plata(H[c].saldo[i])}` : "",
      nacional: st.dmed === "pct" ? {n: "Colombia", v: pct("todas", i)} : null,
      alClic: depTiempo});
    const normales = lista.filter(c => !dudoso(c) && pc(c) != null).sort((a, b) => pc(b) - pc(a)), raros = lista.filter(dudoso);
    const may = lista.slice().sort((a, b) => cr(b) - cr(a))[0];
    if (!normales.length) { $("ice-dep-txt").textContent = "Sin datos para este trimestre."; return; }
    $("ice-dep-txt").innerHTML = `La proporción de créditos atrasados más alta está en <strong>${nombres[normales[0]]}</strong> (${fmt(pc(normales[0]), 1)}%) y la más baja en <strong>${nombres[normales.at(-1)]}</strong> (${fmt(pc(normales.at(-1)), 1)}%). ` +
      `${nombres[may]} es donde más créditos hay: ${fmt(cr(may), 0)}. ` +
      (raros.length ? `<strong>Ojo:</strong> ${listaY(raros.map(c => nombres[c]))} aparecen en la fuente casi sin créditos atrasados (menos de 2%), algo poco creíble frente al resto del país; puede ser un problema en cómo el ICETEX reporta esos departamentos. En el mapa de atrasos van en gris. ` : "") +
      `Solo se incluyen los departamentos con al menos 100 créditos, según dónde vive quien tiene el crédito.`;
  }
  function depTiempo(k) {
    const F = st.d.fechas.map(trim), d = [k, st.d.nombres_dep[k]];
    enElTiempo("ice-dep-tiempo", `Créditos con cuotas atrasadas en ${nomDep(d[1])}`, F,
      [{label: "Colombia", data: F.map((f, i) => pct("todas", i)), color: css("--muted"), ancho: 1.6}, {label: nomDep(d[1]), data: st.d.deptos_hist[k]?.pct || [], color: css("--grafica"), ancho: 2.5}],
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
