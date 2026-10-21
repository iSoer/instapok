import { memo, type CSSProperties } from "react"
import { twMerge } from "@lib/tailwind-merge"
import type { Stat } from "@shared/api/schema/pokemon/generated"
import { STEP } from "@lib/pokemon-generator/generatorState"
import { STAT_LABELS } from "./typeColors"

export type StatSliderPropsType = {
  stat: Stat
  value: number
  min: number
  max: number
  // Highest value the remaining budget allows; above it the track is blocked
  reachable: number
  locked: boolean
  color: string
  // Why the range is narrowed or fixed: "huge-power", "wonder-guard"
  reason?: string
  // In-battle multiplier of the stat (huge-power doubles Attack)
  multiplier?: number
  onChange: (stat: Stat, value: number) => void
}

const BLOCKED_TRACK = "repeating-linear-gradient(135deg, #262626 0 4px, #171717 4px 8px)"

export const StatSlider = memo(function StatSlider({
  stat,
  value,
  min,
  max,
  reachable,
  locked,
  color,
  reason,
  multiplier,
  onChange
}: StatSliderPropsType) {
  const span = Math.max(max - min, 1)
  const valuePercent = ((value - min) / span) * 100
  const reachablePercent = ((Math.max(reachable, value) - min) / span) * 100
  const blocked = !locked && reachable <= value && value < max
  const label = STAT_LABELS[stat]

  const style = {
    "--thumb-color": color,
    // Spent part, then what the budget still allows, then the blocked rest
    "background": `linear-gradient(to right, ${color} 0 ${valuePercent}%, ${color}55 ${valuePercent}% ${reachablePercent}%, `
      + `transparent ${reachablePercent}% 100%), ${BLOCKED_TRACK}`
  } as CSSProperties

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-8">
        <label htmlFor={`stat-${stat}`} className="text-sm font-light uppercase">
          {label}
        </label>
        <div className="flex items-baseline gap-6 tabular-nums">
          <span className="text-lg">{value}</span>
          {
            multiplier && multiplier !== 1 && (
              <span className="text-xs text-amber-300" title={`${reason}: ×${multiplier} in battle`}>
                {`→ ${Math.round(value * multiplier)} in battle`}
              </span>
            )
          }
        </div>
      </div>
      <input
        id={`stat-${stat}`}
        type="range"
        className="stat-range"
        min={min}
        max={max}
        step={STEP}
        value={value}
        disabled={locked}
        data-blocked={blocked}
        aria-valuetext={`${label} ${value}${blocked ? ", budget spent" : ""}`}
        style={style}
        onChange={event => onChange(stat, Number(event.currentTarget.value))}
      />
      <div className={twMerge("flex justify-between gap-8", "text-xs text-neutral-400")}>
        <span>
          {
            locked
              ? `Fixed at ${value} by ${reason}`
              : blocked
                ? "🔒 Budget spent: free points from another stat to raise it"
                : `Up to ${reachable}`
          }
        </span>
        <span className="tabular-nums">
          {`${min}–${max}`}
          {!locked && reason ? ` (capped by ${reason})` : ""}
        </span>
      </div>
    </div>
  )
})
