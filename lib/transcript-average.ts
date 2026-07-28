export function calculateTranscriptAverage(
  entries: Array<{ credits: number | null; score: number }>,
) {
  if (entries.length === 0) return null;
  const hasCredits = entries.every((entry) => entry.credits !== null);
  const totalWeight = hasCredits
    ? entries.reduce((total, entry) => total + (entry.credits ?? 0), 0)
    : entries.length;
  const weightedTotal = entries.reduce(
    (total, entry) => total + entry.score * (entry.credits ?? 1),
    0,
  );
  return Math.round((weightedTotal / totalWeight) * 100) / 100;
}
