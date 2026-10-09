import { useCountUp } from "../hooks/useCountUp.js";

export function KpiValue({
  value,
  suffix = "",
  decimals = 0,
  unavailable = "Not configured",
}: {
  value: number | null;
  suffix?: string;
  decimals?: number;
  unavailable?: string;
}) {
  const displayed = useCountUp(value);
  const format = new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const label =
    value === null ? unavailable : `${format.format(value)}${suffix}`;
  return (
    <strong className="an-kpi-value" aria-label={label}>
      <span aria-hidden="true">
        {value === null ? unavailable : `${format.format(displayed)}${suffix}`}
      </span>
      <span className="an-sr-only">{label}</span>
    </strong>
  );
}
