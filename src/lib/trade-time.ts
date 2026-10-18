/** Shared wall-clock input for executions and missed opportunities. Stored values remain UTC. */
const nyFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function toNyLocal(iso: string): string {
  const p = Object.fromEntries(
    nyFormatter.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function nyLocalToIso(local: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) throw new Error("Vui lòng nhập ngày giờ New York hợp lệ.");
  const [, y, m, d, h, min] = match.map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  // Inspect both sides of a DST transition; repeated fall-back times use the earlier occurrence.
  const candidates = [-86400000, 0, 86400000]
    .map((delta) => {
      const instant = guess + delta;
      const wall = toNyLocal(new Date(instant).toISOString());
      const offset = Date.parse(`${wall}:00Z`) - instant;
      return guess - offset;
    })
    .filter((instant) => toNyLocal(new Date(instant).toISOString()) === local);
  if (!candidates.length)
    throw new Error(
      "Giờ này không tồn tại tại New York do chuyển giờ mùa hè. Vui lòng chọn giờ khác.",
    );
  return new Date(Math.min(...candidates)).toISOString();
}
