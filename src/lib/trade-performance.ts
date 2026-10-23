/** Win rate excludes breakeven trades (Actual R = 0). */
export function tradeWinRate(trades: readonly { actualRr: number }[]): number | null {
  const decided = trades.filter((trade) => trade.actualRr > 0 || trade.actualRr < 0);
  if (!decided.length) return null;
  return (decided.filter((trade) => trade.actualRr > 0).length / decided.length) * 100;
}
