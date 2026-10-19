import fs from "fs"
import path from "path"
import sharp from "sharp"

// public/assets/pokeball.webp is only 50px wide, so the PWA icons are rendered from a vector pokeball instead.
// One-off script: npm run icons

const outDir = path.resolve("./public/icons")
const BACKGROUND = "#0a0a0a"

/**
 * @param scale share of the canvas the pokeball diameter takes (maskable icons must keep it inside the 80% safe zone)
 * @param background solid fill; omit for a transparent icon
 */
function pokeballSvg(scale: number, background?: string) {
  const s = (scale * 256) / 240

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      ${background ? `<rect width="512" height="512" fill="${background}"/>` : ""}
      <g transform="translate(256 256) scale(${s})">
        <circle r="228" fill="#fff"/>
        <path d="M-228 0 A228 228 0 0 1 228 0 Z" fill="#e3350d"/>
        <rect x="-228" y="-14" width="456" height="28" fill="#111"/>
        <circle r="228" fill="none" stroke="#111" stroke-width="24"/>
        <circle r="72" fill="#111"/>
        <circle r="46" fill="#fff"/>
      </g>
    </svg>
  `
}

const icons: { file: string, size: number, scale: number, background?: string }[] = [
  { file: "icon-192.png", size: 192, scale: 0.92 },
  { file: "icon-512.png", size: 512, scale: 0.92 },
  { file: "icon-maskable-512.png", size: 512, scale: 0.6, background: BACKGROUND },
  // iOS ignores transparency and does not support maskable icons
  { file: "apple-touch-icon.png", size: 180, scale: 0.78, background: BACKGROUND }
]

async function generatePwaIcons() {
  fs.mkdirSync(outDir, { recursive: true })

  for (const { file, size, scale, background } of icons) {
    await sharp(Buffer.from(pokeballSvg(scale, background)))
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, file))

    console.log(`${file} ${size}x${size}`)
  }
}

generatePwaIcons()
