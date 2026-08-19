/**
 * Prueba de las fórmulas de scoring con casos conocidos, SIN llamar a Yahoo.
 * Corre con: node scripts/test-scoring.js
 */
const {
  scoreDividendoAccion,
  scoreDividendoFondo,
  scoreCrecimientoAccion,
} = require("./fetch-data.js");

const casos = [
  {
    nombre: "CHILE (banco sólido, yield alto, payout razonable, poca deuda)",
    fn: () =>
      scoreDividendoAccion({ dividendYieldPct: 7.66, payoutRatioPct: 71, debtToEquity: 45 }),
    esperado: "alto (8-9)",
  },
  {
    nombre: "SQM-B (yield altísimo pero payout excesivo -> riesgo)",
    fn: () =>
      scoreDividendoAccion({ dividendYieldPct: 10.1, payoutRatioPct: 130, debtToEquity: 60 }),
    esperado: "medio (penaliza payout > 100%)",
  },
  {
    nombre: "Acción sin dividendo (yield 0, payout 0)",
    fn: () => scoreDividendoAccion({ dividendYieldPct: 0, payoutRatioPct: 0, debtToEquity: 40 }),
    esperado: "bajo",
  },
  {
    nombre: "Acción con datos faltantes (todo null)",
    fn: () =>
      scoreDividendoAccion({ dividendYieldPct: null, payoutRatioPct: null, debtToEquity: null }),
    esperado: "neutral (~5)",
  },
  {
    nombre: "Fondo CFINRENTAS (yield 6%, sin más datos)",
    fn: () => scoreDividendoFondo({ dividendYieldPct: 6.0 }),
    esperado: "medio-alto",
  },
  {
    nombre: "Crecimiento: empresa creciendo fuerte (utilidades +25%, ingresos +15%, ROE 20%)",
    fn: () =>
      scoreCrecimientoAccion({ earningsGrowthPct: 25, revenueGrowthPct: 15, roePct: 20 }),
    esperado: "alto (7-9)",
  },
  {
    nombre: "Crecimiento: empresa contrayéndose (utilidades -20%, ingresos -5%, ROE 4%)",
    fn: () =>
      scoreCrecimientoAccion({ earningsGrowthPct: -20, revenueGrowthPct: -5, roePct: 4 }),
    esperado: "bajo (2-4)",
  },
];

console.log("=== Test de fórmulas de scoring (datos simulados) ===\n");
let ok = true;
for (const caso of casos) {
  const resultado = caso.fn();
  const enRango0a10 = resultado === null || (resultado >= 0 && resultado <= 10);
  if (!enRango0a10) ok = false;
  console.log(
    `${caso.nombre}\n  -> resultado: ${resultado}  |  esperado: ${caso.esperado}  |  rango válido: ${enRango0a10 ? "sí" : "NO ⚠️"}\n`
  );
}
console.log(ok ? "✓ Todos los resultados están en rango [0,10]." : "⚠️ Hay resultados fuera de rango, revisar.");
