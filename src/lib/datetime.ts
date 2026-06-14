/**
 * Format a timestamp as a **local** ISO-like date-time with a space between the
 * date and time: `YYYY-MM-DD HH:mm:ss` (not the `T` separator, not UTC).
 */
export function formatLocalDateTime(at: number): string {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}
