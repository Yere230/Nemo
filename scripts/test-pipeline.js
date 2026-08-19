/**
 * Simula el módulo yahoo-finance2 para probar fetchOne() de punta a punta
 * (parseo de campos + armado del objeto de salida) sin tocar la red.
 * Corre con: node scripts/test-pipeline.js
 */
const Module = require("module");
const originalRequire = Module.prototype.require;

// Respuestas falsas realistas, imitando lo que devolvería Yahoo para CHILE
// (acción) y CFINRENTAS (fondo).
const fakeResponses = {
  "CHILE.SN": {
    quote: { regularMarketPrice: 104.5, currency: "CLP", regularMarketChangePercent: 1.2 },
    summary: {
      summaryDetail: {
        dividendYield: 0.0766,
        payoutRatio: 0.71,
        fiftyTwoWeekLow: 88.2,
        fiftyTwoWeekHigh: 112.4,
        exDividendDate: "2026-04-15T00:00:00.000Z",
        currency: "CLP",
      },
      financialData: {
        debtToEquity: 45.2,
        earningsGrowth: 0.051,
        revenueGrowth: 0.032,
        returnOnEquity: 0.184,
      },
    },
  },
  "CFINRENTAS.SN": {
    quote: { regularMarketPrice: 2198, currency: "CLP", regularMarketChangePercent: -0.3 },
    summary: {
      summaryDetail: { dividendYield: 0.06, currency: "CLP" },
      financialData: {},
    },
  },
  "ITAUCORP.SN": null, // simula un ticker que falla, como advertimos que podría pasar
};

Module.prototype.require = function (id) {
  if (id === "yahoo-finance2") {
    return {
      default: {
        quote: async (symbol) => {
          const fake = fakeResponses[symbol];
          if (!fake) throw new Error("Quote not found (símbolo simulado no existe)");
          return fake.quote;
        },
        quoteSummary: async (symbol) => {
          const fake = fakeResponses[symbol];
          if (!fake) throw new Error("Quote not found (símbolo simulado no existe)");
          return fake.summary;
        },
      },
    };
  }
  return originalRequire.apply(this, arguments);
};

const { fetchOne } = require("./fetch-data.js");
Module.prototype.require = originalRequire; // restaurar

async function run() {
  console.log("=== Test de pipeline completo (fetchOne) con datos simulados ===\n");

  const chile = await fetchOne({
    nemo: "CHILE",
    yahoo: "CHILE.SN",
    name: "Banco de Chile",
    sector: "Banca",
    category: "accion",
    ipsa: true,
  });
  console.log("CHILE (acción, debería tener scoreDividendo y scoreCrecimiento):");
  console.log(JSON.stringify(chile, null, 2));

  const fondo = await fetchOne({
    nemo: "CFINRENTAS",
    yahoo: "CFINRENTAS.SN",
    name: "F.I. Independencia Rentas Inmobiliarias",
    sector: "Renta inmobiliaria",
    category: "fondo",
    ipsa: false,
  });
  console.log("\nCFINRENTAS (fondo, scoreCrecimiento debe ser null):");
  console.log(JSON.stringify(fondo, null, 2));

  const roto = await fetchOne({
    nemo: "ITAUCORP",
    yahoo: "ITAUCORP.SN",
    name: "Itaú Corpbanca",
    sector: "Banca",
    category: "accion",
    ipsa: true,
  });
  console.log("\nITAUCORP (simulando fallo de red/símbolo, debe capturar el error sin explotar):");
  console.log(JSON.stringify(roto, null, 2));

  const checks = [
    ["CHILE tiene precio", chile.price === 104.5],
    ["CHILE dividendYieldPct ~7.66", chile.dividendYieldPct === 7.66],
    ["CHILE payoutRatioPct ~71", chile.payoutRatioPct === 71],
    ["CHILE tiene scoreDividendo numérico", typeof chile.scoreDividendo === "number"],
    ["CHILE tiene scoreCrecimiento numérico", typeof chile.scoreCrecimiento === "number"],
    ["Fondo tiene scoreDividendo numérico", typeof fondo.scoreDividendo === "number"],
    ["Fondo NO tiene scoreCrecimiento (null)", fondo.scoreCrecimiento === null],
    ["Ticker roto no lanza excepción y queda con error", typeof roto.error === "string"],
    ["Ticker roto no tiene score", roto.scoreDividendo === undefined],
  ];

  console.log("\n=== Resultado de checks ===");
  let allOk = true;
  for (const [desc, pass] of checks) {
    console.log(`${pass ? "✓" : "✗ FALLA"}  ${desc}`);
    if (!pass) allOk = false;
  }
  console.log(allOk ? "\n✓ Pipeline funcionando correctamente." : "\n⚠️ Hay checks fallidos, revisar.");
}

run();
