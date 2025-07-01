import fs from "fs"
import path from "path"
import sharp from "sharp"

const pngPokemonDir = path.resolve("./src/server/tmp/pokemon")
const pngPokemonShinyDir = path.resolve("./src/server/tmp/pokemon/shiny")

const webpImgDir = path.resolve("./public/assets/pokemon/images")
const webpImgThumbnailDir = path.resolve("./public/assets/pokemon/thumbnails")

async function convertToWebp({
  inputPath,
  outputPath,
  outputMiniPath
}: {
  inputPath: string
  outputPath: string
  outputMiniPath: string
}) {
  const ret = await sharp(inputPath)
    .webp({ quality: 100 })
    .toFile(outputPath)

  await sharp(outputPath)
    .resize({ width: 10 })
    .toFile(outputMiniPath)

  return ret
}

async function prepareWebpImages(rawImgPath: string, postfix?: string): Promise<void> {
  const files = fs.readdirSync(rawImgPath).filter(file => file.endsWith(".png"))

  for (const file of files) {
    const fileName = path.parse(file).name
    const fileNameSmall = `${path.parse(file).name}.thumbnail`

    const inputPath = path.join(rawImgPath, file)
    const outputPath = path.join(webpImgDir, `${fileName}${postfix ? `.${postfix}` : ""}.webp`)
    const outputMiniPath = path.join(webpImgThumbnailDir, `${fileNameSmall}${postfix ? `.${postfix}` : ""}.webp`)

    try {
      await convertToWebp({
        inputPath,
        outputPath,
        outputMiniPath
      })
    }
    catch (err) {
      console.error(`Failed to convert ${file}: ${(err as Error).message}`)
    }
  }
}

(async () => {
  fs.mkdirSync(webpImgDir, {
    recursive: true
  })

  fs.mkdirSync(webpImgThumbnailDir, {
    recursive: true
  })

  if (fs.existsSync(pngPokemonDir)) {
    await prepareWebpImages(pngPokemonDir)
  }
  else {
    console.log(`Path ${pngPokemonDir} don't exists`)
  }

  if (fs.existsSync(pngPokemonShinyDir)) {
    await prepareWebpImages(pngPokemonShinyDir, "shiny")
  }
  else {
    console.log(`Path ${pngPokemonShinyDir} don't exists`)
  }
})()
