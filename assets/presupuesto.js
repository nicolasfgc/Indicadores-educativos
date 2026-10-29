// Pestaña: Presupuesto del sector educación — cómo va, en qué se gasta, la historia y el detalle
registrar("presupuesto", (() => {
  // filas de entidades.json: [fecha, entidad, tipo, aprop, comp, oblig, pagos, Δaprop, Δcomp, Δoblig, Δpagos] (millones de pesos)
  const A = 3, C = 4, O = 5, P = 6, DA = 7, DC = 8;
  const LETRA = {F: 0, I: 1};
  const st = {d: null, h: null, porFecha: {}, mes: null, tipo: "todos", medida: "pct_oblig", nodo: {nivel: "total"},
              hTipo: "Total sin deuda", hPrecios: "constantes", dMed: "apropiacion_vigente"};
  const MED = {
    pct_oblig: {t: "% ejecutado (obligaciones / apropiación)", f: s => s[A] ? s[O] / s[A] * 100 : null},
    pct_comp: {t: "% comprometido (compromisos / apropiación)", f: s => s[A] ? s[C] / s[A] * 100 : null},
    comp_mes: {t: "Comprometido en el mes", f: s => s[DC], plata: true},
    aprop: {t: "Apropiación vigente", f: s => s[A], plata: true}};
  const vacio = () => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  function sumar(dst, f, off = 0) { for (let k = A; k <= 10; k++) dst[k] += f[k + off]; return dst; }
  const tipoOk = t => st.tipo === "todos" || +st.tipo === t;
  const nombreEnt = ei => st.d.entidades[ei][1];
  // nombres más cortos y legibles para las entidades
  const nombreCorto = ei => { const n = nombreEnt(ei);
    if (/MINISTERIO EDUCACION/i.test(n)) return "Ministerio de Educación";
    if (/ALIMENTACION ESCOLAR/i.test(n)) return "Alimentación escolar (PAE)";
    return titulo(n.replace(/^UNIVERSIDADES P[ÚU]BLICAS - /i, "")); };
  const rubros = anio => json(`web/presupuesto/rubros_${anio}.json`);
  const anios = () => [...new Set(st.d.fechas.map(f => f.slice(0, 4)))].sort();

  async function iniciar() {
    [st.d, st.h, st.dest] = await Promise.all([json("web/presupuesto/entidades.json"), json("web/presupuesto/historico.json"), json("web/presupuesto/destinos.json")]);
    for (const f of st.d.filas) (st.porFecha[st.d.fechas[f[0]]] ??= []).push(f);
    st.ult = st.mes = st.d.fechas.at(-1);
    periodo("pre-periodo", st.d.fechas, st.mes, f => { st.mes = f; detalle(); });
    seg("pre-tipo", x => { st.tipo = x; render(); });
    seg("pre-medida", x => { st.medida = x; detalle(); });
    $("pre-ultima").textContent = "Último dato: " + etqMesLargo(st.ult);
    seg("pre-dmed", x => { st.dMed = x; destinos(); });
    seg("preh-tipo", x => { st.hTipo = x; historico(); });
    seg("preh-precios", x => { st.hPrecios = x; historico(); });
    aviso();
  }

  // aviso sobre el rezago y los meses que el Ministerio no publicó
  function aviso() {
    const falt = st.d.faltantes || [];
    let t = `<strong>Sobre estos datos:</strong> el Ministerio de Hacienda publica la ejecución de cada mes a comienzos del mes siguiente, así que el último dato disponible es ${etqMesLargo(st.ult)}.`;
    if (falt.length) {
      // meses publicados justo después de un hueco, dentro del mismo año: su "comprometido en el mes" acumula los meses faltantes
      const fs = st.d.fechas, despues = fs.filter((f, k) => k > 0 && fs[k - 1].slice(0, 4) === f.slice(0, 4) && mesesCompletos([fs[k - 1], f]).length > 2);
      t += ` Además, <strong>el Ministerio no ha publicado ${listaMeses(falt)}</strong>. En las gráficas esos meses aparecen vacíos` +
        (despues.length ? `, y lo comprometido en ${listaMeses(despues)} incluye también lo de los meses que faltan.` : ".");
    }
    const siif = st.d.desde_siif || [];
    if (siif.length) t += ` ${listaMeses(siif).replace(/^./, c => c.toUpperCase())} no ${siif.length > 1 ? "están" : "está"} en la base de datos abiertos del Ministerio; ` +
      `se ${siif.length > 1 ? "tomaron" : "tomó"} del mismo reporte del SIIF que el Ministerio publica en el Portal de Transparencia Económica.`;
    $("pre-aviso").innerHTML = t;
  }

  // ---------------------------------------------------------- agregaciones
  // hijos del nodo en una fecha: [{id, n, s}]
  async function hijos(fecha, nodo = st.nodo) {
    const grupos = new Map();
    const add = (k, n, f, off = 0) => { if (!grupos.has(k)) grupos.set(k, {id: k, n, s: vacio()}); sumar(grupos.get(k).s, f, off); };
    const filas = (st.porFecha[fecha] || []).filter(f => tipoOk(f[2]));
    if (nodo.nivel === "total") filas.forEach(f => add(f[1], nombreCorto(f[1]), f));
    else {
      const R = await rubros(fecha.slice(0, 4)), mi = R.fechas.indexOf(fecha);
      for (const r of R.filas) {
        if (r[0] !== mi) continue;
        const info = R.rubros[r[1]]; if (!info || info[0] !== nodo.ent || !tipoOk(LETRA[info[1]])) continue;
        if (nodo.nivel === "entidad") add(info[2], titulo(info[2]), r, -1);
        else if (info[2] === nodo.prog) add("r" + r[1], titulo(info[4]) + (info[5] && info[5] !== info[4] ? " · " + titulo(info[5]) : ""), r, -1);
      }
    }
    return [...grupos.values()];
  }
  const total = lista => lista.reduce((acc, g) => sumar(acc, g.s), vacio());
  // totales del nodo actual para todos los meses (para las series de tiempo)
  async function totalesNodo(nodo = st.nodo) {
    const out = {};
    if (nodo.nivel === "total") {
      for (const f of st.d.fechas) {
        const s = vacio();
        for (const r of st.porFecha[f] || []) if (tipoOk(r[2])) sumar(s, r);
        out[f] = s;
      }
      return out;
    }
    for (const a of anios()) {
      const R = await rubros(a);
      R.fechas.forEach(f => out[f] = vacio());
      for (const r of R.filas) {
        const info = R.rubros[r[1]]; if (!info || info[0] !== nodo.ent || !tipoOk(LETRA[info[1]])) continue;
        if (nodo.nivel === "programa" && info[2] !== nodo.prog) continue;
        sumar(out[R.fechas[r[0]]], r, -1);
      }
    }
    return out;
  }
  function nombreNodo(n = st.nodo) {
    if (n.nivel === "total") return "el sector educación";
    if (n.nivel === "entidad") return nombreCorto(n.ent);
    return titulo(n.prog);
  }
  function pasosNodo() {
    const n = st.nodo, p = [{t: "Todo el sector educación", nodo: {nivel: "total"}}];
    if (n.ent != null) p.push({t: nombreCorto(n.ent), nodo: {nivel: "entidad", ent: n.ent}});
    if (n.prog) p.push({t: titulo(n.prog), nodo: n});
    return p;
  }
  function bajar(g) {
    const n = st.nodo;
    if (n.nivel === "total") st.nodo = {nivel: "entidad", ent: g.id};
    else if (n.nivel === "entidad") st.nodo = {nivel: "programa", ent: n.ent, prog: g.id};
    else return;
    detalle().then(() => irA("pre-paso4"));
  }

  // ---------------------------------------------------------- secciones
  function kpis(p, s, f) {
    const fs = st.d.fechas, mesAnt = fs[fs.indexOf(f) - 1];
    $(p + "1").textContent = plata(s[A]);
    $(p + "1d").innerHTML = Math.abs(s[DA]) >= Math.max(1000, Math.abs(s[A]) * 0.001) ? `${s[DA] > 0 ? "+" : ""}${plata(s[DA])} frente al mes anterior` : "prácticamente igual al mes anterior";
    $(p + "2").textContent = s[A] ? fmt(s[C] / s[A] * 100, 1) + "%" : "–";
    $(p + "2d").textContent = `${plata(s[C])} comprometidos`;
    $(p + "3").textContent = s[A] ? fmt(s[O] / s[A] * 100, 1) + "%" : "–";
    $(p + "3d").textContent = `${plata(s[O])} obligados · ${plata(s[P])} pagados`;
    $(p + "4").textContent = plata(s[DC]);
    $(p + "4d").textContent = !mesAnt || mesAnt.slice(0, 4) !== f.slice(0, 4) ? `comprometido en ${etqMes(f)}`
      : mesesCompletos([mesAnt, f]).length > 2 ? `comprometido entre ${etqMes(mesAnt)} y ${etqMes(f)} (faltan meses en la fuente)` : `comprometido en ${etqMes(f)}`;
  }
  // curva del % ejecutado de un año frente al anterior
  function curva(canvasId, txtId, tot, anio, nombre) {
    const ant = String(+anio - 1);
    const c = a => MESES.map((m, i) => { const f = `${a}-${String(i + 1).padStart(2, "0")}-01`; return tot[f] && tot[f][A] ? tot[f][O] / tot[f][A] * 100 : null; });
    const ca = c(anio), cp = c(ant);
    const ds = [{label: anio, data: ca, color: css("--grafica"), ancho: 3}];
    if (cp.some(x => x != null)) ds.unshift({label: ant, data: cp, color: css("--muted"), dash: [4, 3]});
    dibujar(canvasId, {type: "line", data: {labels: MESES, datasets: ds.map(d => ({label: d.label, data: d.data, borderColor: d.color, backgroundColor: d.color, borderDash: d.dash || [], borderWidth: d.ancho || 2, pointRadius: 3, tension: .2, spanGaps: false, hidden: !!ocultas[canvasId]?.has(d.label)}))},
      options: {responsive: true, maintainAspectRatio: false, interaction: {mode: "index", intersect: false}, plugins: {legend: leyendaRecordada(canvasId), gobiernos: {activo: false},
        tooltip: {callbacks: {label: c => `${c.dataset.label}: ${c.raw == null ? "sin dato" : fmt(c.raw, 1) + "%"}`}}},
        scales: {x: {grid: {display: false}, ticks: {color: css("--muted")}}, y: {beginAtZero: true, grid: {color: css("--line")}, ticks: {color: css("--muted"), callback: v => v + "%"}}}}});
    let mi = 11; while (mi > 0 && ca[mi] == null) mi--;
    const a1 = ca[mi], a0 = cp[mi];
    $(txtId).innerHTML = a1 == null ? "" : `A ${MESES_L[mi]} de ${anio}, ${nombre} lleva <strong>${fmt(a1, 1)}% ejecutado</strong>` +
      (a0 != null ? `. A la misma altura de ${ant} llevaba ${fmt(a0, 1)}%: <strong>${Math.abs(a1 - a0) < 0.5 ? "va al mismo ritmo" : a1 > a0 ? "va más rápido" : "va más lento"}</strong> que el año pasado (${fmt(Math.abs(a1 - a0), 1)} puntos de diferencia).` : ".");
  }

  async function render() {
    // 1 · cómo vamos: siempre el último mes publicado, todo el sector
    const tot = await totalesNodo({nivel: "total"}), f = st.ult, anio = f.slice(0, 4);
    const quien = st.tipo === "todos" ? "el presupuesto de educación" : `el gasto de ${st.d.tipos[+st.tipo].toLowerCase()} en educación`;
    $("pre-paso1-t").textContent = `Así va ${quien} a ${etqMesLargo(f)}`;
    kpis("pre-k", tot[f], f);
    $("pre-curva-t").textContent = `¿Cómo ha ido ${anio} frente a ${+anio - 1}?`;
    curva("pre-curva", "pre-curva-txt", tot, anio, quien);
    destinos();
    historico();
    evolucion(tot);
    await detalle();
  }

  // ¿en qué se va la plata? (último mes publicado, todo el sector)
  function destinos() {
    const D = st.dest, i = D.fechas.indexOf(st.ult), m = st.dMed;
    const items = D.destinos.map((n, k) => ({id: k, n, v: D.valores[k][m][i], ap: D.valores[k].apropiacion_vigente[i], ob: D.valores[k].obligaciones[i]}));
    const tot = items.reduce((a, x) => a + x.v, 0);
    barras("pre-dest", items.slice().sort((a, b) => b.v - a.v), {fmtValor: x => `${plata(x)} (${fmt(x / tot * 100, 0)}%)`, alto: 34,
      colores: () => css("--grafica"), alClic: x => destinoTiempo(x.id)});
    const o = items.slice().sort((a, b) => b.ap - a.ap), top = o[0], top2 = o[1];
    const lentos = items.filter(x => x.ap > 0).map(x => ({...x, p: x.ob / x.ap * 100})).sort((a, b) => a.p - b.p);
    $("pre-dest-txt").innerHTML = `De cada 100 pesos del presupuesto de educación de ${st.ult.slice(0, 4)}, <strong>${fmt(top.ap / items.reduce((a, x) => a + x.ap, 0) * 100, 0)} van a ${top.n.toLowerCase()}</strong>: ` +
      (top.id === 0 ? `es la plata que la Nación gira a departamentos y municipios (el Sistema General de Participaciones) para pagar a los maestros y sostener los colegios públicos. ` : "") +
      `Le siguen ${top2.n.toLowerCase()} (${plata(top2.ap)}). Lo que va más atrasado a ${etqMesLargo(st.ult)}: ${lentos[0].n.toLowerCase()}, con ${fmt(lentos[0].p, 1)}% ejecutado.`;
  }
  function destinoTiempo(k) {
    const D = st.dest, F = mesesCompletos(D.fechas), v = D.valores[k];
    const at = (arr, f) => { const i = D.fechas.indexOf(f); return i < 0 ? null : arr[i]; };
    const pct = F.map(f => { const a = at(v.apropiacion_vigente, f), o = at(v.obligaciones, f); return a ? o / a * 100 : null; });
    enElTiempo("pre-dest-tiempo", `${D.destinos[k]}: ejecución mes a mes`, F, [{label: "% ejecutado acumulado del año", data: pct, color: css("--grafica"), ancho: 2.5}],
      {fmtValor: x => x == null ? "sin dato" : fmt(x, 1) + "%", eje0: true, nota: "La línea vuelve a cero cada enero, cuando arranca un presupuesto nuevo. Toca otra barra para cambiar."});
  }

  function historico() {
    const H = st.h, datos = H.tipos[st.hTipo];
    // el último año va solo hasta el último mes publicado: se deja por fuera (el año en curso está arriba)
    const n = st.d.fechas.at(-1).slice(0, 4) === String(H.anios.at(-1)) ? H.anios.length - 1 : H.anios.length;
    const an = H.anios.slice(0, n).map(String);
    const ser = m => (datos[m]?.[st.hPrecios] || []).slice(0, n).map(v => v == null ? null : v * 1000);
    const ap = ser("apropiacion"), ob = ser("obligaciones");
    const pct = ap.map((a, i) => a && ob[i] != null ? ob[i] / a * 100 : null);
    serie("preh-montos", an, [{label: "Presupuesto (apropiación)", data: ap, color: css("--muted")}, {label: "Ejecutado (obligaciones)", data: ob, color: css("--grafica"), ancho: 2.5}],
      {fmtValor: x => plata(x, 1), despues: (i0, i1) => {
        const a0 = ap[i0], a1 = ap[i1], cr = (Math.pow(a1 / a0, 1 / Math.max(1, i1 - i0)) - 1) * 100;
        const tramo = pct.slice(i0, i1 + 1).filter(x => x != null), prom = tramo.reduce((a, b) => a + b, 0) / tramo.length;
        $("preh-txt").innerHTML = `Entre <strong>${an[i0]}</strong> y <strong>${an[i1]}</strong> el presupuesto de educación pasó de ${plata(a0)} a <strong>${plata(a1)}</strong>` +
          `${st.hPrecios === "constantes" ? " (en pesos de hoy, ya descontada la inflación)" : ""}: creció en promedio <strong>${fmt(cr, 1)}% al año</strong>. ` +
          `En promedio se ejecutó el ${fmt(prom, 1)}% de lo que se tenía. El año en curso no aparece porque todavía no termina.`;
      }});
  }

  function evolucion(tot) {
    const F = mesesCompletos(st.d.fechas);
    const pctE = F.map(f => tot[f] && tot[f][A] ? tot[f][O] / tot[f][A] * 100 : null);
    const comp = F.map(f => tot[f] ? tot[f][DC] : null);
    serie("pre-evo", F, [{label: "% ejecutado acumulado del año", data: pctE, color: css("--grafica"), ancho: 2.5},
                         {label: "Comprometido en el mes", data: comp, tipo: "bar", eje: "y2", color: css("--s4"), colores: comp.map(x => x < 0 ? css("--rojo") : css("--s4"))}],
      {fmtValor: x => x == null ? "sin dato" : fmt(x, 1) + "%", fmtValor2: x => x == null ? "sin dato" : plata(x), eje0: true, atajos: [["Año en curso", "ytd"], ["1 año", 12], ["3 años", 36], ["Todo", 0]]});
  }

  async function detalle() {
    const f = st.mes, n = st.nodo, lista = await hijos(f);
    const nivelSig = {total: "entidad", entidad: "programa o cuenta", programa: "rubro"}[n.nivel];
    const M = MED[st.medida];
    migas("pre-migas", pasosNodo(), p => { st.nodo = p.nodo; detalle().then(() => irA("pre-paso4")); });
    $("pre-bar-t").textContent = n.nivel === "total" ? `Por entidad, ${etqMesLargo(f)}` : `${titulo(nombreNodo())}, ${etqMesLargo(f)}`;
    // resumen del nivel elegido (sector, entidad o programa)
    $("pre-nodo").hidden = n.nivel === "total";
    if (n.nivel !== "total") {
      const tot = await totalesNodo();
      kpis("pre-n", tot[f] || total(lista), f);
      $("pre-ncurva-t").textContent = `${titulo(nombreNodo())}: ejecución de ${f.slice(0, 4)} frente a ${+f.slice(0, 4) - 1}`;
      curva("pre-ncurva", "pre-ncurva-txt", tot, f.slice(0, 4), nombreNodo());
    }
    $("pre-bar-h").textContent = `${M.t} de cada ${nivelSig}.` + (n.nivel === "programa" ? "" : ` Toca una barra o “Ver detalle” para entrar.`);
    const items = lista.map(g => ({id: g.id, n: g.n, v: M.f(g.s)})).filter(x => x.v != null && (st.medida.startsWith("pct") || x.v !== 0)).sort((a, b) => b.v - a.v);
    barras("pre-bar", items.slice(0, 60), {etiqueta: M.t, alClic: n.nivel === "programa" ? null : bajar, fmtValor: M.plata ? (x => plata(x)) : (x => fmt(x, 1) + "%"),
      colores: x => x.v < 0 ? css("--rojo") : css("--grafica")});
    $("pre-bar-nota").textContent = items.length > 60 ? `Se muestran los 60 más grandes de ${items.length}. La tabla tiene todos.` : "";
    const filas = lista.slice().sort((a, b) => b.s[A] - a.s[A]);
    const pct = (x, y) => y ? fmt(x / y * 100, 1) + "%" : "–";
    $("pre-tabla").innerHTML = `<thead><tr><th>${titulo(nivelSig)}</th><th>Presupuesto</th><th>Comprometido</th><th>%</th><th>Obligado</th><th>%</th><th>Pagado</th><th>Comprometido en el mes</th><th></th></tr></thead><tbody>` +
      filas.map((g, i) => `<tr><td>${g.n}</td><td>${plata(g.s[A])}</td><td>${plata(g.s[C])}</td><td>${pct(g.s[C], g.s[A])}</td><td>${plata(g.s[O])}</td><td>${pct(g.s[O], g.s[A])}</td><td>${plata(g.s[P])}</td>
        <td class="${g.s[DC] < 0 ? "pos" : ""}">${plata(g.s[DC])}</td><td class="acciones">${n.nivel === "programa" ? "" : `<button class="ver" data-i="${i}">Ver detalle ›</button>`}</td></tr>`).join("") + "</tbody>";
    $("pre-tabla").querySelectorAll("button.ver").forEach(b => b.onclick = () => bajar(filas[+b.dataset.i]));
  }
  return {iniciar, render};
})());
