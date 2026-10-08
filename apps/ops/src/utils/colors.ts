export function getSeverityColor(severity: string): string {
  if (severity === 'CRITICAL') return '#B91C1C';
  if (severity === 'HIGH') return '#B45309';
  if (severity === 'MEDIUM') return '#D97706';
  return '#1D4ED8';
}
export function getSeverityBgColor(severity: string): string {
  if (severity === 'CRITICAL') return 'bg-[#B91C1C]';
  if (severity === 'HIGH') return 'bg-[#B45309]';
  if (severity === 'MEDIUM') return 'bg-[#D97706]';
  return 'bg-[#1D4ED8]';
}
