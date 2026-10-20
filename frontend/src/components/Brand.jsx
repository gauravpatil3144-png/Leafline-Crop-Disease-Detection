import { Leaf } from "lucide-react";
import { Link } from "react-router-dom";

export default function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark">
        <Leaf size={18} strokeWidth={2.4} />
      </span>
      <span>
        leafline<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
