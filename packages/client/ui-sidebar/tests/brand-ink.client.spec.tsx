// @vitest-environment jsdom
/**
 * Duty-hours ink contracts for the sidebar brand mark: the window rule, the
 * delay to the next edge, and the live refresh the shell mounts. Instants are
 * built from local wall-clock fields, so the cases read the same in every zone.
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BRAND_INK_DUTY, BRAND_INK_OFF, brandMarkInk, isDutyTime, msUntilInkChange, useBrandMarkInk,
} from '../src/client/brandInk.ts'

/** Instant on Monday 2026-01-05 (a weekday), stated as local wall-clock fields. */
function monday(hour: number, minute = 0, second = 0, ms = 0): Date {
  return new Date(2026, 0, 5, hour, minute, second, ms)
}

/** Reports whatever the hook currently calls for. */
function InkProbe() {
  return <span data-testid="ink">{useBrandMarkInk()}</span>
}

describe('isDutyTime', () => {
  it('opens and closes both weekday windows on the minute', () => {
    expect(isDutyTime(monday(8, 59))).toBe(false)
    expect(isDutyTime(monday(9, 0))).toBe(true)
    expect(isDutyTime(monday(11, 59))).toBe(true)
    expect(isDutyTime(monday(12, 0))).toBe(false)
    expect(isDutyTime(monday(13, 59))).toBe(false)
    expect(isDutyTime(monday(14, 0))).toBe(true)
    expect(isDutyTime(monday(17, 59))).toBe(true)
    expect(isDutyTime(monday(18, 0))).toBe(false)
    expect(isDutyTime(monday(23, 59))).toBe(false)
  })

  it('keeps the weekend on the off ink all day', () => {
    expect(isDutyTime(new Date(2026, 0, 3, 10, 0))).toBe(false)
    expect(isDutyTime(new Date(2026, 0, 4, 15, 0))).toBe(false)
  })
})

describe('brandMarkInk', () => {
  it('names the state each side of the window', () => {
    expect(brandMarkInk(monday(10, 0))).toBe(BRAND_INK_DUTY)
    expect(brandMarkInk(monday(20, 0))).toBe(BRAND_INK_OFF)
  })
})

describe('msUntilInkChange', () => {
  it('waits for the next edge between windows', () => {
    expect(msUntilInkChange(monday(8, 0))).toBe(60 * 60 * 1000)
    expect(msUntilInkChange(monday(12, 30))).toBe(90 * 60 * 1000)
  })

  it('waits for local midnight past the last edge, covering the weekday change', () => {
    expect(msUntilInkChange(monday(19, 0))).toBe(5 * 60 * 60 * 1000)
  })

  it('floors a just-passed edge so the timer cannot spin', () => {
    expect(msUntilInkChange(monday(8, 59, 59, 500))).toBe(1_000)
  })
})

describe('useBrandMarkInk', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(monday(8, 0))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('recolors at the edge with no other render trigger', () => {
    render(<InkProbe />)
    expect(screen.getByTestId('ink').textContent).toBe(BRAND_INK_OFF)
    act(() => { vi.advanceTimersByTime(60 * 60 * 1000) })
    expect(screen.getByTestId('ink').textContent).toBe(BRAND_INK_DUTY)
  })
})
