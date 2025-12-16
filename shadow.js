const figlet = require("figlet");
const readline = require("readline");

const COLORS = [
  "\x1b[91m", // merah
  "\x1b[93m", // kuning
  "\x1b[92m", // hijau
  "\x1b[96m", // cyan
  "\x1b[94m", // biru
  "\x1b[95m", // ungu
];
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function colorLineByChar(line, offset = 0) {
  return line
    .split("")
    .map((ch, i) => COLORS[(i + offset) % COLORS.length] + BOLD + ch + RESET)
    .join("");
}

function animateColorOnly(lines, footerText) {
  let shift = 0;
  const totalLines = lines.length;
  const baseY = 0;

  console.log("\n".repeat(totalLines + 2));

  setInterval(() => {
    readline.cursorTo(process.stdout, 0, baseY);

    for (let i = 0; i < totalLines; i++) {
      readline.cursorTo(process.stdout, 0, baseY + i);
      process.stdout.write(colorLineByChar(lines[i], shift) + "\n");
    }

    readline.cursorTo(process.stdout, 0, baseY + totalLines);
    process.stdout.write(colorLineByChar(footerText, shift));

    shift = (shift + 1) % COLORS.length;
  }, 150);
}

(async () => {
  console.clear();

  const ascii = figlet.textSync("UBOT KINGS", {
    font: "Standard",
    horizontalLayout: "default",
    verticalLayout: "default",
  });

  const lines = ascii.split("\n");
  const footer = "VERSION : 2.0.0";

  animateColorOnly(lines, footer);

  setInterval(() => {}, 1000);