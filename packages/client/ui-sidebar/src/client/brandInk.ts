/**
 * Duty-hours ink for the sidebar brand mark.
 *
 * The brand mark is the sidebar's only always-visible brand signal, so it also
 * reports whether the local clock is inside the working window: Mon–Fri
 * 09:00–12:00 and 14:00–18:00, read in the machine's own zone. No zone is
 * configured for the decision because the reader compares it against their own
 * clock, and the shell re-checks only at window edges rather than polling.
 * The state names the mark carries; the colors live with the rest of the seat's
 * ink in `SidebarRoot.module.css`.
 */
import { useEffect, useState } from 'react'

/** Ink state inside a working window (red). */
export const BRAND_INK_DUTY = 'duty'

/** Ink state outside every working window (green). */
export const BRAND_INK_OFF = 'off'

/** Either brand-mark ink state. */
export type BrandInk = typeof BRAND_INK_DUTY | typeof BRAND_INK_OFF

/** Working windows as `[startMinute, endMinute)` of the local day. */
const DUTY_WINDOWS: readonly (readonly [number, number])[] = [
  [9 * 60, 12 * 60],
  [14 * 60, 18 * 60],
]

/** Minute-of-day values at which the ink can change, so the timer wakes at window edges instead of polling. */
const INK_BOUNDARIES: readonly number[] = [9 * 60, 12 * 60, 14 * 60, 18 * 60]

/** Re-check delay floor, so a boundary that just passed cannot spin the timer. */
const MIN_RECHECK_MS = 1_000

/**
 * Report whether an instant falls inside a weekday working window.
 * @param now - instant to classify, in the machine's local zone.
 * @returns true inside 09:00–12:00 or 14:00–18:00 on Monday through Friday.
 */
export function isDutyTime(now: Date): boolean {
  const weekday = now.getDay()
  if (weekday === 0 || weekday === 6) return false
  const minute = now.getHours() * 60 + now.getMinutes()
  return DUTY_WINDOWS.some(([start, end]) => minute >= start && minute < end)
}

/**
 * Resolve the ink state an instant calls for.
 * @param now - instant to classify.
 * @returns {@link BRAND_INK_DUTY} inside a working window, else {@link BRAND_INK_OFF}.
 */
export function brandMarkInk(now: Date): BrandInk {
  return isDutyTime(now) ? BRAND_INK_DUTY : BRAND_INK_OFF
}

/**
 * Measure how long the current ink stays valid.
 * @param now - reference instant.
 * @returns milliseconds until the next window edge or local midnight, never below {@link MIN_RECHECK_MS}.
 */
export function msUntilInkChange(now: Date): number {
  const minute = now.getHours() * 60 + now.getMinutes()
  // Past the last edge the next change is the following midnight, which also
  // carries the weekday transition.
  const boundary = INK_BOUNDARIES.find(candidate => candidate > minute) ?? 24 * 60
  const target = new Date(now)
  // Hour 24 normalizes to the next local midnight, so an exact edge stays
  // exact across a DST shift instead of adding fixed milliseconds.
  target.setHours(Math.floor(boundary / 60), boundary % 60, 0, 0)
  return Math.max(MIN_RECHECK_MS, target.getTime() - now.getTime())
}

/**
 * Track the ink state for the current instant, refreshing it at each window
 * edge so a sidebar left open across a boundary recolors on its own.
 * @returns the state the mark should carry right now.
 */
export function useBrandMarkInk(): BrandInk {
  const [ink, setInk] = useState<BrandInk>(() => brandMarkInk(new Date()))
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = (): void => {
      const now = new Date()
      setInk(brandMarkInk(now))
      timer = setTimeout(schedule, msUntilInkChange(now))
    }
    schedule()
    return () => { clearTimeout(timer) }
  }, [])
  return ink
}
