import { useState } from "react";
import { SlidersHorizontal, Sparkles } from "lucide-react";
import {
  AnalyticsCategoryGroupSchema,
  IncidentCategorySchema,
  IncidentSourceSchema,
} from "@wr/shared";
import type { AnalyticsFilter, AnalyticsOptions } from "@wr/shared";
import {
  isCategoryGroup,
  isDatePreset,
  presetDateRange,
} from "../lib/filters.js";

const presetLabels: Record<AnalyticsFilter["preset"], string> = {
  LAST_7_DAYS: "Last 7 days",
  LAST_30_DAYS: "Last 30 days",
  LAST_90_DAYS: "Last 90 days",
  LAST_6_MONTHS: "Last 6 months",
  LAST_12_MONTHS: "Last 12 months",
  CUSTOM: "Custom range",
};

export function FilterBar({
  filter,
  options,
  onChange,
  onGenerate,
  pending,
  error,
}: {
  filter: AnalyticsFilter;
  options: AnalyticsOptions;
  onChange: (patch: Partial<AnalyticsFilter>) => void;
  onGenerate: () => void;
  pending: boolean;
  error: string;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [validationError, setValidationError] = useState("");
  const types = filter.types.join(",");
  const sources = filter.sources.join(",");

  function generate() {
    setValidationError("");
    if (filter.from > filter.to) {
      setValidationError("End date must be on or after start date.");
      return;
    }
    const span =
      (Date.parse(`${filter.to}T00:00:00Z`) -
        Date.parse(`${filter.from}T00:00:00Z`)) /
      86_400_000;
    if (!Number.isFinite(span) || span > 731) {
      setValidationError("Choose a valid date range of 2 years or less.");
      return;
    }
    onGenerate();
  }

  return (
    <section className="an-filter-panel" aria-label="Report filters">
      <div className="an-filter-heading">
        <div>
          <p className="an-overline">REPORT PARAMETERS</p>
          <h2>Filters</h2>
        </div>
        <button
          type="button"
          className="an-button an-button-quiet"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((value) => !value)}
        >
          <SlidersHorizontal size={16} />
          {moreOpen ? "Fewer filters" : "More filters"}
        </button>
      </div>
      <div className="an-filter-grid">
        <label>
          Park
          <select
            aria-label="Park"
            value={filter.parkId}
            onChange={(event) => onChange({ parkId: event.target.value })}
          >
            {options.allowedParks.map((park) => (
              <option key={park.id} value={park.id}>
                {park.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date range
          <select
            aria-label="Date range"
            value={filter.preset}
            onChange={(event) => {
              if (!isDatePreset(event.target.value)) return;
              onChange({
                preset: event.target.value,
                ...(event.target.value === "CUSTOM"
                  ? {}
                  : presetDateRange(event.target.value)),
              });
            }}
          >
            {Object.entries(presetLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            aria-label="Category"
            value={filter.categoryGroup}
            onChange={(event) => {
              if (isCategoryGroup(event.target.value))
                onChange({ categoryGroup: event.target.value });
            }}
          >
            {AnalyticsCategoryGroupSchema.options.map((group) => (
              <option key={group} value={group}>
                {group === "ALL"
                  ? "All categories"
                  : group.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <div className="an-filter-action">
          <button
            type="button"
            className="an-button an-button-primary"
            onClick={generate}
            disabled={pending}
          >
            <Sparkles size={16} />
            {pending ? "Compiling…" : "Generate report"}
          </button>
        </div>
      </div>
      {filter.preset === "CUSTOM" && (
        <div className="an-filter-grid an-filter-dates">
          <label>
            From
            <input
              aria-label="From date"
              type="date"
              value={filter.from}
              max={filter.to}
              onChange={(event) => {
                if (event.target.value)
                  onChange({ from: event.target.value, preset: "CUSTOM" });
              }}
            />
          </label>
          <label>
            To
            <input
              aria-label="To date"
              type="date"
              value={filter.to}
              min={filter.from}
              onChange={(event) => {
                if (event.target.value)
                  onChange({ to: event.target.value, preset: "CUSTOM" });
              }}
            />
          </label>
        </div>
      )}
      {moreOpen && (
        <div className="an-filter-grid an-filter-more">
          <label>
            Incident types
            <select
              aria-label="Incident types"
              multiple
              value={types ? types.split(",") : []}
              onChange={(event) =>
                onChange({
                  types: Array.from(
                    event.currentTarget.selectedOptions,
                    (option) => option.value,
                  ) as AnalyticsFilter["types"],
                })
              }
            >
              {IncidentCategorySchema.options.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <small>Use Ctrl or Command to select more than one.</small>
          </label>
          <label>
            Sources
            <select
              aria-label="Incident sources"
              multiple
              value={sources ? sources.split(",") : []}
              onChange={(event) =>
                onChange({
                  sources: Array.from(
                    event.currentTarget.selectedOptions,
                    (option) => option.value,
                  ) as AnalyticsFilter["sources"],
                })
              }
            >
              {IncidentSourceSchema.options.map((source) => (
                <option key={source} value={source}>
                  {source.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sector
            <select
              aria-label="Sector"
              value={filter.sectorId ?? ""}
              onChange={(event) =>
                onChange({ sectorId: event.target.value || null })
              }
            >
              <option value="">All sectors</option>
              {options.sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
            </select>
          </label>
          <label className="an-checkbox-label">
            <input
              type="checkbox"
              checked={filter.includeRejected}
              onChange={(event) =>
                onChange({ includeRejected: event.target.checked })
              }
            />
            Include rejected incidents
          </label>
        </div>
      )}
      {(validationError || error) && (
        <p className="an-filter-error" role="alert">
          {validationError || error}
        </p>
      )}
    </section>
  );
}
