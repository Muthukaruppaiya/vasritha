const sharp = require("sharp");
const fs = require("fs");

const icons = [
  '<g><path d="M6 3c10 2 14 18 10 36"/><path d="M16 4c12 3 16 20 10 38"/><path d="M3 38h28"/><circle cx="11" cy="14" r="1.6"/></g>',
  '<g><path d="M12 2v5"/><path d="M6 7h12l2 8H4z"/><path d="M4 15h16l2 8H2z"/><path d="M5 23l-2 22h8l3-12 3 12h8l-2-22"/></g>',
  '<g><ellipse cx="14" cy="6" rx="12" ry="5"/><path d="M2 6v24c0 3 5 5 12 5s12-2 12-5V6"/><ellipse cx="14" cy="30" rx="12" ry="5"/><path d="M6 14h16M6 20h16"/><path d="M26 8c10 3 14 0 18-4"/></g>',
  '<g><path d="M16 2L4 38h24z"/><path d="M16 2L8 38M16 2L12 38M16 2L20 38M16 2L24 38"/><path d="M8 28h16"/></g>',
  '<g><path d="M8 2h16v12H8z"/><path d="M5 6l-3 4h7"/><path d="M27 6l3 4h-7"/><path d="M8 14l-2 18 5 14h7l-3-14 3-18"/><path d="M24 14l2 18-5 14h-7l3-14-3-18"/></g>',
  '<g><circle cx="16" cy="4" r="3"/><path d="M16 7v4"/><path d="M4 16c6-5 18-5 24 0"/><path d="M6 16h20l4 24H2z"/><path d="M9 26h14"/></g>',
  '<g><path d="M4 4l28 24"/><circle cx="3" cy="3" r="3"/><path d="M32 28c6 4 2 10-4 6"/></g>',
  '<g><path d="M2 6c8 4 16 4 24 0"/><path d="M2 14c8 4 16 4 24 0"/><path d="M2 22c8 4 16 4 24 0"/><path d="M8 2v28M16 4v28M24 2v28"/></g>',
  '<g><path d="M4 12c10-8 24-8 34 0"/><path d="M4 12v28c10 8 24 8 34 0V12"/><path d="M4 22c10 5 24 5 34 0"/></g>',
  '<g><path d="M2 8c10-6 20 4 30 0"/><path d="M8 14h20v10H8z"/><path d="M8 24l-2 22h10l3-12 3 12h10l-2-22"/></g>',
  '<g><circle cx="14" cy="5" r="4"/><path d="M14 9v4"/><path d="M4 14c6-3 14-3 20 0"/><path d="M2 16c3 10 3 22 2 34h10l4-16 4 16h10c-1-12-1-24 2-34"/><path d="M6 28c5 2 13 2 18 0"/></g>',
  '<g><path d="M4 4c8 4 8 14 0 22"/><path d="M12 2c10 4 10 18 0 26"/><path d="M20 4c8 4 8 14 0 22"/><path d="M3 26v10M9 28v10M15 26v10M21 28v10"/></g>'
];

const size = 720;
const cell = 36;
const cols = Math.floor(size / cell);
const rows = Math.floor(size / cell);

let symbols = "";
icons.forEach((icon, i) => {
  symbols += `<symbol id="i${i}" viewBox="0 0 40 42" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${icon}</symbol>`;
});

let body = "";
let n = 0;
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const icon = n % icons.length;
    const x = c * cell + ((r % 2) * 8) + ((n * 7) % 6);
    const y = r * cell + ((c % 2) * 6) + ((n * 5) % 5);
    const rot = ((n * 17) % 34) - 17;
    const sc = 0.72 + ((n * 13) % 16) / 100;
    const op = 0.5 + ((n * 11) % 16) / 100;
    body += `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${sc.toFixed(2)})" opacity="${op.toFixed(2)}" color="#6a3f2c"><use href="#i${icon}" width="40" height="42"/></g>`;
    n += 1;

    const icon2 = (n + 4) % icons.length;
    const x2 = x + 14 + ((n * 3) % 6);
    const y2 = y + 12 + ((n * 2) % 5);
    const rot2 = ((n * 23) % 40) - 20;
    body += `<g transform="translate(${x2} ${y2}) rotate(${rot2}) scale(0.58)" opacity="0.4" color="#85553a"><use href="#i${icon2}" width="40" height="42"/></g>`;

    if (n % 2 === 0) {
      const icon3 = (n + 7) % icons.length;
      const x3 = x + 6 + ((n * 5) % 10);
      const y3 = y + 22 + ((n * 3) % 8);
      body += `<g transform="translate(${x3} ${y3}) rotate(${((n * 29) % 30) - 15}) scale(0.5)" opacity="0.32" color="#7a4e34"><use href="#i${icon3}" width="40" height="42"/></g>`;
    }
  }
}

for (let i = 0; i < 420; i++) {
  const x = (i * 47) % size;
  const y = (i * 89) % size;
  body += `<circle cx="${x}" cy="${y}" r="1.2" fill="#6a3f2c" opacity="0.28"/>`;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${symbols}</defs>
  <rect width="100%" height="100%" fill="none"/>
  ${body}
</svg>`;

fs.writeFileSync("apps/web/public/boutique-pattern.svg", svg);

sharp(Buffer.from(svg), { density: 180 })
  .resize(size, size)
  .png()
  .toFile("apps/web/public/boutique-pattern.png")
  .then(() => {
    console.log("dense tile ready", { cells: cols * rows, placed: n * 2 });
  });
