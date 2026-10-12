export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const fmtNum = (n: number | string | null | undefined, digits = 2) =>
  Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits })

export const fmtDate = (d: string) =>
  new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Same formula as the database (rate per 1000 x qty / 1000, 4dp). Display only; the server is authoritative. */
export const priceFor = (ratePer1000: number, qty: number) =>
  Math.round(((ratePer1000 * qty) / 1000) * 10000) / 10000

export const isValidUrl = (s: string) => /^https?:\/\/[^\s]{3,2000}$/i.test(s.trim())

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => {
    let s = v == null ? '' : String(v)
    // neutralise spreadsheet formula injection
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
}

export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export const errMsg = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as any).message) : 'Something went wrong'
