const fs = require('node:fs');
const path = require('node:path');
const ENDPOINT = 'https://open.er-api.com/v6/latest/EUR';
const DATA_FILE = path.resolve(__dirname, '../data/rates.json');

function parseEntry(json) {
  if (json.result !== 'success' || json.base_code !== 'EUR' ||
      !Number.isSafeInteger(json.time_last_update_unix) || json.time_last_update_unix <= 0 ||
      !json.rates || Array.isArray(json.rates) || json.rates.EUR !== 1 ||
      !Object.entries(json.rates).every(([code, rate]) => /^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0)) {
    throw new Error('Invalid exchange rate API response');
  }
  return { base: 'EUR', date: new Date(json.time_last_update_unix * 1000).toISOString().slice(0, 10), rates: json.rates };
}

async function updateRates({ file = DATA_FILE, dryRun = false, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(ENDPOINT, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Exchange rate API HTTP ${response.status}`);
  const entry = parseEntry(await response.json());
  const history = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  if (!Array.isArray(history) || !history.every(item => item && item.base === 'EUR' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.rates)) {
    throw new Error('Invalid existing rate history; refusing to overwrite');
  }
  if (history.some(item => item.date === entry.date)) return { changed: false, date: entry.date };
  if (history.some(item => item.date > entry.date)) throw new Error('API returned data older than the stored history');
  history.push(entry);
  if (!dryRun) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(history, null, 2) + '\n', { flag: 'wx' });
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  return { changed: true, date: entry.date };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--dry-run')) { console.error('Usage: node scripts/fetch.js [--dry-run]'); process.exitCode = 1; }
  else updateRates({ dryRun: args.includes('--dry-run') }).then(result => console.log(result)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { updateRates, parseEntry };
