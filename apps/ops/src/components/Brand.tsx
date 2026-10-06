import { Leaf } from "lucide-react";
import { Link } from "react-router-dom";
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      to="/"
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="Wana Rakshaka home"
    >
      <span className="brand-icon">
        <Leaf size={25} strokeWidth={1.6} />
      </span>
      <span>
        <strong>
          Wana Rakshaka<span className="brand-dot">.</span>
        </strong>
        <small>WILDLIFE GUARDIAN</small>
      </span>
    </Link>
  );
}
