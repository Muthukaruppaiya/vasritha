import fs from "node:fs";

/**
 * String.replace treats $$ in the replacement as a single $.
 * Use a function replacer to write literal dollar-quotes.
 */
const path = "db/local/optimize_v1.sql";
const dollar = String.fromCharCode(36);
const endTag = ["end ", dollar, dollar, ";"].join("");

let s = fs.readFileSync(path, "utf8");
s = s.replace(/end \u0024+;\r?/g, () => endTag + "\n");
fs.writeFileSync(path, s);

const text = fs.readFileSync(path, "utf8");
console.log("ok", text.includes(endTag));
console.log(JSON.stringify(text.split(/\n/)[12]));
