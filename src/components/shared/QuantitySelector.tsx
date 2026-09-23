'use client'

export function QuantitySelector({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (value: number) => void }) {
  const safeMax = Math.max(min, max)
  return (
    <div className="deba-cart-quantity" aria-label="اختيار الكمية">
      <button type="button" aria-label="تقليل الكمية" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <input type="number" min={min} max={safeMax} value={value} aria-label="الكمية" onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(Math.min(safeMax, Math.max(min, Math.floor(next)))) }} />
      <button type="button" aria-label="زيادة الكمية" disabled={value >= safeMax} onClick={() => onChange(Math.min(safeMax, value + 1))}>+</button>
    </div>
  )
}