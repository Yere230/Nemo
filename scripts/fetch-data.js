/**
 * Nemo — Motor de datos
 * ---------------------
 * Recorre el universo de 35 tickers (data/tickers.json), consulta Yahoo Finance
 * y calcula un score automático (0-10) de "dividendos" y "crecimiento" por
 * reglas simples (NO usa IA — eso es un paso manual aparte, ver consola IA).
 *
 * Salida: data/stocks.json
 *
 * NOTA IMPORTANTE SOBRE ESCALAS DE YAHOO:
 * La API no documentada de Yahoo devuelve algunos campos como fracción
 * (0.071 = 7.1%) y otros ya multiplicados por 100. Según el comportamiento
 * conocido de esta API:
 *   - dividendYield, payoutRatio, earningsGrowth, revenueGrowth,
 *     returnOnEquity  -> vienen como FRACCIÓN (hay que *100 para %)
 *   - debtToEquity    -> viene YA en escala de porcentaje (NO multiplicar)
 * Si al correr esto por primera vez ves números que no calzan con la realidad
 * (ej: un dividend yield de 766% en vez de 7,66%), ajusta las constantes
 * SCALE_* de más abajo. Es la única parte del script sensible a este supuesto.
 */

const fs = require("fs");
const path = require("path");
const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance();

const SCALE_FRACTION_FIELDS = true; // ver nota arriba
const TICKERS_PATH = path.join(__dirname, "..", "data", "tickers.json");
const OUTPUT_PATH = path.join(__dirname, "..", "data", "stocks.json");
const DELAY_MS = 250; // pausa entre requests para no saturar la API

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pct(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const v = SCALE_FRACTION_FIELDS ? value * 100 : value;
  return Math.round(v * 100) / 100;
}

function round1(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Score de dividendos (0-10) para acciones.
 * 40% yield actual, 35% sanidad del payout ratio, 25% nivel de deuda.
 */
function scoreDividendoAccion({ dividendYieldPct, payoutRatioPct, debtToEquity }) {
  const yieldScore =
    dividendYieldPct === null ? 5 : clamp((dividendYieldPct / 12) * 10, 0, 10);

  let payoutScore = 5; // neutral si no hay dato
  if (payoutRatioPct !== null) {
    if (payoutRatioPct <= 0) payoutScore = 3;
    else if (payoutRatioPct <= 30) payoutScore = 6;
    else if (payoutRatioPct <= 75) payoutScore = 10;
    else if (payoutRatioPct <= 100) payoutScore = 6;
    else payoutScore = 2; // paga más de lo que gana -> riesgo
  }

  let debtScore = 5; // neutral si no hay dato
  if (debtToEquity !== null) {
    if (debtToEquity < 50) debtScore = 10;
    else if (debtToEquity < 100) debtScore = 7;
    else if (debtToEquity < 200) debtScore = 4;
    else debtScore = 2;
  }

  return round1(yieldScore * 0.4 + payoutScore * 0.35 + debtScore * 0.25);
}

/** Score de dividendos (0-10) para fondos/ETF: solo importa el yield de distribución. */
function scoreDividendoFondo({ dividendYieldPct }) {
  if (dividendYieldPct === null) return null;
  return round1(clamp((dividendYieldPct / 10) * 10, 0, 10));
}

/**
 * Score de crecimiento (0-10) para acciones.
 * 40% crecimiento de utilidades, 30% crecimiento de ingresos, 30% ROE.
 */
function scoreCrecimientoAccion({ earningsGrowthPct, revenueGrowthPct, roePct }) {
  const earnScore =
    earningsGrowthPct === null ? 5 : clamp(5 + earningsGrowthPct / 10, 0, 10);
  const revScore =
    revenueGrowthPct === null ? 5 : clamp(5 + revenueGrowthPct / 10, 0, 10);
  const roeScore = roePct === null ? 5 : clamp((roePct / 35) * 10, 0, 10);

  return round1(earnScore * 0.4 + revScore * 0.3 + roeScore * 0.3);
}

async function fetchOne(entry) {
  const base = {
    nemo: entry.nemo,
    name: entry.name,
    sector: entry.sector,
    category: entry.category,
    ipsa: entry.ipsa,
  };

  try {
    const modules =
      entry.category === "accion"
        ? ["summaryDetail", "financialData", "defaultKeyStatistics", "calendarEvents"]
        : ["summaryDetail", "defaultKeyStatistics"];

    const [quote, summary] = await Promise.all([
      yahooFinance.quote(entry.yahoo),
      yahooFinance.quoteSummary(entry.yahoo, { modules }),
    ]);

    const sd = summary.summaryDetail || {};
    const fd = summary.financialData || {};

    const dividendYieldPct = pct(sd.dividendYield ?? sd.trailingAnnualDividendYield ?? null);
    const payoutRatioPct = pct(sd.payoutRatio ?? null);
    const debtToEquity = fd.debtToEquity ?? null; // ya en escala %, no tocar
    const earningsGrowthPct = pct(fd.earningsGrowth ?? null);
    const revenueGrowthPct = pct(fd.revenueGrowth ?? null);
    const roePct = pct(fd.returnOnEquity ?? null);

    let scoreDividendo, scoreCrecimiento;
    if (entry.category === "accion") {
      scoreDividendo = scoreDividendoAccion({ dividendYieldPct, payoutRatioPct, debtToEquity });
      scoreCrecimiento = scoreCrecimientoAccion({ earningsGrowthPct, revenueGrowthPct, roePct });
    } else {
      scoreDividendo = scoreDividendoFondo({ dividendYieldPct });
      scoreCrecimiento = null; // no aplica a fondos/ETF en v1
    }

    return {
      ...base,
      price: quote.regularMarketPrice ?? null,
      currency: quote.currency ?? sd.currency ?? "CLP",
      change: quote.regularMarketChangePercent ?? null,
      dividendYieldPct,
      payoutRatioPct,
      debtToEquity,
      earningsGrowthPct,
      revenueGrowthPct,
      roePct,
      fiftyTwoWeekLow: sd.fiftyTwoWeekLow ?? null,
      fiftyTwoWeekHigh: sd.fiftyTwoWeekHigh ?? null,
      exDividendDate: sd.exDividendDate ?? null,
      scoreDividendo,
      scoreCrecimiento,
      error: null,
    };
  } catch (err) {
    return {
      ...base,
      error: err.message || "Error desconocido al consultar Yahoo Finance",
    };
  }
}

async function main() {
  const config = JSON.parse(fs.readFileSync(TICKERS_PATH, "utf-8"));
  const results = [];
  const failed = [];

  for (const entry of config.tickers) {
    process.stdout.write(`Consultando ${entry.nemo}... `);
    const result = await fetchOne(entry);
    if (result.error) {
      failed.push({ nemo: entry.nemo, error: result.error });
      console.log(`ERROR: ${result.error}`);
    } else {
      console.log("OK");
    }
    results.push(result);
    await sleep(DELAY_MS);
  }

  const output = {
    lastUpdated: new Date().toISOString(),
    source: "Yahoo Finance",
    totalTickers: config.tickers.length,
    failedCount: failed.length,
    failedTickers: failed,
    stocks: results,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log("\n--- Resumen ---");
  console.log(`OK: ${results.length - failed.length}/${config.tickers.length}`);
  if (failed.length) {
    console.log("Fallaron:", failed.map((f) => f.nemo).join(", "));
  }
  console.log(`Guardado en ${OUTPUT_PATH}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fallo general del script:", err);
    process.exit(1);
  });
}

module.exports = {
  pct,
  round1,
  clamp,
  scoreDividendoAccion,
  scoreDividendoFondo,
  scoreCrecimientoAccion,
  fetchOne,
};
