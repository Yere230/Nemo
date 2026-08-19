# Nemo — Motor de datos (Fase 1)

Bitácora personal de dividendos e inversión para la Bolsa de Santiago.
Esta primera fase es solo el **motor de datos**: el script que consulta
Yahoo Finance para los 35 instrumentos y calcula un score automático de
dividendos y de crecimiento. El dashboard visual (frontend) es la fase
siguiente.

## Qué hay en esta carpeta

```
data/tickers.json      -> lista maestra de los 35 instrumentos a seguir
scripts/fetch-data.js  -> consulta Yahoo Finance y calcula los scores
scripts/test-scoring.js    -> prueba las fórmulas con casos simulados
scripts/test-pipeline.js   -> prueba el flujo completo simulando a Yahoo
.github/workflows/update-data.yml -> corre fetch-data.js solo, todos los
                                      días hábiles, y sube el resultado
```

## Cómo probarlo en tu repositorio real

1. Sube esta carpeta completa a un repositorio nuevo en GitHub (o al que
   uses para Nemo).
2. En GitHub, ve a la pestaña **Actions** del repositorio → deberías ver
   el workflow "Actualizar datos de mercado".
3. Ejecútalo manualmente: botón **Run workflow** (no hace falta esperar
   al cron automático).
4. Cuando termine (1-2 minutos), revisa los logs del paso "Ejecutar motor
   de datos": ahí vas a ver ticker por ticker si dio OK o ERROR.
5. Si todo salió bien, el archivo `data/stocks.json` va a aparecer
   actualizado en el repo (con commit automático de "nemo-bot").

## Qué revisar en la primera corrida real

Como no pude probar contra Yahoo Finance de verdad (mi entorno de pruebas
no tiene salida a internet hacia ese sitio), hay 2 cosas puntuales que
te pido confirmar cuando corras esto por primera vez:

- **ITAUCORP**: marqué este ticker con `"verify": true` en
  `tickers.json` porque no estoy 100% seguro de que el símbolo en Yahoo
  sea exactamente `ITAUCORP.SN`. Si sale con error en los logs, avísame
  y le buscamos el símbolo correcto.
- **Escalas de porcentaje**: si algún número se ve absurdo (ej. un
  dividend yield de "766%" en vez de "7,66%"), es un tema de escala de
  la API de Yahoo — está todo centralizado en la constante
  `SCALE_FRACTION_FIELDS` al inicio de `fetch-data.js`, así que se
  arregla en un solo lugar.

Cuando confirmes que corrió bien (o me pegues los logs si algo falla),
seguimos con el dashboard que consume este `stocks.json`.
