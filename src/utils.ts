export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  wait: number,
): (...args: Args) => void {
  let timer: number | undefined;
  return (...args: Args) => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

const numberFormatter = new Intl.NumberFormat('en-US');

export function formatNumber(n: number): string {
  return numberFormatter.format(n);
}

const DURATION_UNITS: [seconds: number, name: string][] = [
  [604800, 'week'],
  [86400, 'day'],
  [3600, 'hour'],
  [60, 'minute'],
  [1, 'second'],
];

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'Never';
  for (const [unitSeconds, name] of DURATION_UNITS) {
    if (seconds >= unitSeconds) {
      const value = Math.round(seconds / unitSeconds);
      return `${value} ${name}${value === 1 ? '' : 's'}`;
    }
  }
  return `${seconds}s`;
}

export function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
