import fs from "fs"
import path from "path"
import { listAbilityNamesOfSource, listPokemonInfoRows } from "@/server/db/queries/listModelSource"
import { INFO_SOURCES } from "@/server/pokemon-info/sources"
import { fitModel } from "@/server/pokemon-model/fit"
import { pokemonModelSchema } from "@/server/pokemon-model/schema"
import { runScript } from "./utils/runQueueCli"

const MODEL_PATH = path.resolve("src/server/pokemon-model/model.json")

// Fewer base pokemon means pokemon_info is not downloaded yet; the fit would be meaningless
const MIN_POKEMON = 500

runScript(async () => {
  const [rows, abilityNames] = await Promise.all([
    listPokemonInfoRows(INFO_SOURCES.pokeapi),
    listAbilityNamesOfSource(INFO_SOURCES.pokeapi)
  ])

  const model = pokemonModelSchema.parse(fitModel(rows, abilityNames, new Date().toISOString()))
  const { sourceCounts, classes, evolution } = model

  console.log(`Pokemon: ${sourceCounts.pokemon}, forms: ${sourceCounts.forms}, abilities: ${sourceCounts.abilities}`)
  console.log(`Evolution lines: ${sourceCounts.lines2} of 2, ${sourceCounts.lines3} of 3`)

  for (const [key, { count, bst, experience }] of Object.entries(classes)) {
    const ks = experience.map(({ value, p }) => `${value}×${Math.round(p * 100)}%`).join(" ")
    const tier = `BST ${bst.min}-${bst.max} (mean ${Math.round(bst.mean)})`

    console.log(`  ${key.padEnd(16)} n=${String(count).padStart(4)}  ${tier}  k: ${ks}`)
  }

  for (const [step, { bstRatio }] of Object.entries(evolution.steps)) {
    console.log(`  ${step}: BST ×${bstRatio.median.toFixed(2)} ± ${bstRatio.sd.toFixed(2)}`)
  }

  if (sourceCounts.pokemon < MIN_POKEMON) {
    throw new Error(`Only ${sourceCounts.pokemon} pokemon in pokemon_info (need ${MIN_POKEMON}); run npm run pokemon:info first. `
      + "model.json is left unchanged")
  }

  fs.writeFileSync(MODEL_PATH, `${JSON.stringify(model, null, 2)}\n`)
  console.log(`Written ${path.relative(process.cwd(), MODEL_PATH)}`)
})
