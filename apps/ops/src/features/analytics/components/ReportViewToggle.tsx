import { Link } from "react-router-dom";
import { Map, TableProperties } from "lucide-react";

export function ReportViewToggle({
  spatial = false,
  search,
}: {
  spatial?: boolean;
  search: string;
}) {
  return (
    <nav
      className={`an-view-toggle ${spatial ? "is-spatial" : "is-tabular"}`}
      aria-label="Report view"
    >
      <Link
        className="an-view-link"
        to={{ pathname: "/analytics", search }}
        aria-current={spatial ? undefined : "page"}
      >
        <TableProperties size={16} aria-hidden="true" /> Tabular view
      </Link>
      <Link
        className="an-view-link"
        to={{ pathname: "/analytics/map", search }}
        aria-current={spatial ? "page" : undefined}
      >
        <Map size={16} aria-hidden="true" /> Spatial view
      </Link>
    </nav>
  );
}
