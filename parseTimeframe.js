// parseTimeframe.js

export default function parseTimeframe(timeframeArg) {
  const now = new Date();

  // Default to "last hour" if unspecified
  if (!timeframeArg) {
    return new Date(now.getTime() - 60 * 60 * 1000);
  }

  const lower = timeframeArg.toLowerCase().trim();

  if (lower.includes('last hour')) {
    return new Date(now.getTime() - 60 * 60 * 1000);
  } else if (lower.includes('this morning')) {
    const thisMorning = new Date(now);
    thisMorning.setHours(6, 0, 0, 0); // define "morning" as 6AM
    return thisMorning;
  } else if (lower.includes('last day')) {
    // 24 hours ago
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  // Fallback
  return new Date(now.getTime() - 60 * 60 * 1000);
}