/**
 * Imprime, en la última línea de stdout, los config plugins efectivos del mobile en
 * `argv[2]`: los de app.json más los que agrega app.config.js con el env recibido.
 * Proceso aparte porque app.config.js lee el env y hace dotenv al cargarse.
 */
const { existsSync } = require('node:fs');
const path = require('node:path');

const dir = path.resolve(process.argv[2]);
const { expo } = require(path.join(dir, 'app.json'));
const rutaConfig = path.join(dir, 'app.config.js');
const exportado = existsSync(rutaConfig) ? require(rutaConfig) : expo;
const config = typeof exportado === 'function' ? exportado({ config: expo }) : exportado;
process.stdout.write(`\n${JSON.stringify(config.plugins ?? [])}\n`);
