const fs = require("fs");

(async () => {
  const res = await fetch("https://api.frankfurter.app/latest?from=EUR");
  const data = await res.json();
  const file = "data/rates.json";
  const history = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
  if (!history.some(d => d.date === data.date)) history.push(data);
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(file, JSON.stringify(history, null, 2));
})();
