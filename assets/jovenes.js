// Pestaña: Jóvenes de 15 a 28 años — estudio y trabajo (DANE, mensual en trimestre móvil)
registrar("jovenes", (() => {
  const st = {d: null, ind: "td", zona: "NACIONAL"};
  const IND = {td: "Desempleo juvenil", to: "Ocupación juvenil", tgp: "Participación laboral juvenil"};
  const CON_ART = {td: "el desempleo juvenil", to: "la ocupación juvenil", tgp: "la participación laboral juvenil"};
  const IND_EXPL = {td: "De cada 100 jóvenes que buscan trabajo, cuántos no lo encuentran.",
    to: "De cada 100 jóvenes de 15 a 28 años, cuántos tienen trabajo.",
    tgp: "De cada 100 jóvenes de 15 a 28 años, cuántos trabajan o están buscando trabajo (el resto estudia, cuida a otros o no busca)."};
  const ZONA = {NACIONAL: "todo el país", CABECERAS: "las zonas urbanas", RURAL: "el campo (centros poblados y rural disperso)"};
  const v = (id, m) => st.d.valores[id]?.[m] || [];
  const at = (id, m, f) => v(id, m)[st.d.fechas.indexOf(f)];
  const hace = (f, n) => st.d.fechas[st.d.fechas.indexOf(f) - n];

  async function iniciar() {
    st.d = await json("web/juventud.json");
    const p = v("JUV_NACIONAL", "pct_ninis");
    let u = st.d.fechas.length - 1; while (p[u] == null) u--;
    st.ult = st.d.fechas[u];
    $("jov-ultima").textContent = "Último dato: " + etqTrim(st.ult);
    seg("jov-ind", x => { st.ind = x; trabajo(); });
    seg("jov-zona", x => { st.zona = x; trabajo(); });
  }

  function ninis() {
    const F = st.d.fechas, t = v("JUV_NACIONAL", "pct_ninis"), m = v("JUV_NACIONAL_MUJERES", "pct_ninis"), h = v("JUV_NACIONAL_HOMBRES", "pct_ninis");
    serie("jov-ninis", F, [{label: "Mujeres", data: m, color: css("--s2"), ancho: 2}, {label: "Hombres", data: h, color: css("--s3"), ancho: 2}, {label: "Total", data: t, color: css("--grafica"), ancho: 3}],
      {fmtValor: x => fmt(x, 1) + "%", fmtX: etqTrim, despues: (i0, i1) => {
        let k = i1; while (k > i0 && t[k] == null) k--;
        const f = F[k], k12 = k - 12, n = at("JUV_NACIONAL", "ninis", f);
        const tramo = t.slice(i0, k + 1).map((x, j) => [x, F[i0 + j]]).filter(x => x[0] != null);
        const mx = tramo.reduce((a, b) => b[0] > a[0] ? b : a), mn = tramo.reduce((a, b) => b[0] < a[0] ? b : a);
        $("jov-ninis-txt").innerHTML = `En el trimestre <strong>${etqTrim(f)}</strong>, <strong>${fmt(t[k], 1)} de cada 100 jóvenes</strong> no estudiaban ni trabajaban: unos ${fmt(n / 1000, 2)} millones de personas. ` +
          (k12 >= 0 && t[k12] != null ? `Un año antes eran ${fmt(t[k12], 1)} de cada 100: <strong>${Math.abs(t[k] - t[k12]) < 0.3 ? "casi igual" : t[k] < t[k12] ? "mejoró" : "empeoró"}</strong>. ` : "") +
          `La diferencia entre mujeres y hombres es grande: <strong>${fmt(m[k], 1)}% de las mujeres</strong> frente a ${fmt(h[k], 1)}% de los hombres. Muchas de ellas están dedicadas a oficios del hogar o al cuidado de otros, un trabajo que no se paga. ` +
          `En el periodo elegido, lo más alto fue ${fmt(mx[0], 1)}% (${etqTrim(mx[1])}) y lo más bajo ${fmt(mn[0], 1)}% (${etqTrim(mn[1])}). ` +
          `Ojo: el indicador sube cada comienzo de año, cuando terminan las clases y muchos contratos, así que lo justo es comparar con el mismo trimestre del año anterior.`;
      }});
  }

  function trabajo() {
    const F = st.d.fechas, z = st.zona, i = st.ind;
    const t = v("JUV_" + z, i), m = v(`JUV_${z}_MUJERES`, i), h = v(`JUV_${z}_HOMBRES`, i);
    $("jov-trab-t").textContent = `${IND[i]} en ${ZONA[z]}`;
    $("jov-trab-h").textContent = IND_EXPL[i];
    serie("jov-trab", F, [{label: "Mujeres", data: m, color: css("--s2"), ancho: 2}, {label: "Hombres", data: h, color: css("--s3"), ancho: 2}, {label: "Total", data: t, color: css("--grafica"), ancho: 3}],
      {fmtValor: x => fmt(x, 1) + "%", fmtX: etqTrim, despues: (i0, i1) => {
        let k = i1; while (k > i0 && t[k] == null) k--;
        const f = F[k], k12 = k - 12, d = k12 >= 0 ? t[k] - t[k12] : null;
        const bien = i === "td" ? d < 0 : d > 0;
        $("jov-trab-txt").innerHTML = `En <strong>${etqTrim(f)}</strong> ${CON_ART[i]} en ${ZONA[z]} fue <strong>${fmt(t[k], 1)}%</strong>` +
          (d != null ? `, ${Math.abs(d) < 0.3 ? "casi igual que" : `${fmt(Math.abs(d), 1)} puntos ${d > 0 ? "más" : "menos"} que`} un año antes` + (Math.abs(d) >= 0.3 ? ` (<strong>${bien ? "mejoró" : "empeoró"}</strong>)` : "") : "") + `. ` +
          `Mujeres: ${fmt(m[k], 1)}%; hombres: ${fmt(h[k], 1)}%. ` +
          (i === "td" ? "El desempleo de los jóvenes suele ser casi el doble del de toda la población: les cuesta más conseguir el primer empleo." : "");
      }});
  }

  function render() {
    const f = st.ult, f12 = hace(f, 12);
    const p = at("JUV_NACIONAL", "pct_ninis", f), p12 = at("JUV_NACIONAL", "pct_ninis", f12);
    $("jov-k1").textContent = fmt(p, 1) + "%";
    $("jov-k1d").innerHTML = p12 == null ? "" : `<span class="${clsSigno(p - p12)}">${p >= p12 ? "▲" : "▼"} ${fmt(Math.abs(p - p12), 1)} pts</span> vs ${etqTrim(f12)}`;
    const n = at("JUV_NACIONAL", "ninis", f), n12 = at("JUV_NACIONAL", "ninis", f12);
    $("jov-k2").textContent = fmt(n / 1000, 2) + " M";
    $("jov-k2d").innerHTML = n12 == null ? "" : `${n <= n12 ? fmt(n12 - n, 0) + " mil menos" : fmt(n - n12, 0) + " mil más"} que un año antes`;
    const d = at("JUV_NACIONAL", "td", f), d12 = at("JUV_NACIONAL", "td", f12);
    $("jov-k3").textContent = fmt(d, 1) + "%";
    $("jov-k3d").innerHTML = d12 == null ? "" : `<span class="${clsSigno(d - d12)}">${d >= d12 ? "▲" : "▼"} ${fmt(Math.abs(d - d12), 1)} pts</span> vs ${etqTrim(f12)}`;
    const o = at("JUV_NACIONAL", "ocupados", f), o12 = at("JUV_NACIONAL", "ocupados", f12);
    $("jov-k4").textContent = fmt(o / 1000, 2) + " M";
    $("jov-k4d").innerHTML = o12 == null ? "" : `${o >= o12 ? "+" : "−"}${fmt(Math.abs(o - o12), 0)} mil en un año`;
    ninis(); trabajo();
  }
  return {iniciar, render};
})());
