export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatPace(minutesPerMile: number): string {
  const minutes = Math.floor(minutesPerMile);
  const seconds = Math.round((minutesPerMile - minutes) * 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}/mi`;
}

export function formatDuration(totalMinutes: number, showHours: boolean = true): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return "0m";
  }

  const totalSeconds = Math.round(totalMinutes * 60);

  if (!showHours) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (secs === 0) {
      return `${mins}m`;
    }
    if (mins === 0) {
      return `${secs}s`;
    }
    return `${mins}m ${secs}s`;
  }

  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hrs === 0) {
    if (secs === 0) {
      return `${mins}m`;
    }
    if (mins === 0) {
      return `${secs}s`;
    }
    return `${mins}m ${secs}s`;
  }

  if (secs === 0) {
    return `${hrs}h ${mins}m`;
  }

  return `${hrs}h ${mins}m ${secs}s`;
}

export function toKm(miles: number): number {
  return Number((miles * 1.60934).toFixed(2));
}

export function isDateInCurrentWeek(input: string): boolean {
  const date = new Date(input);
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  return date >= weekStart && date < weekEnd;
}

export function isDateInCurrentMonth(input: string): boolean {
  const date = new Date(input);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}
