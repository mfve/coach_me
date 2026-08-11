import { Loader2 } from "lucide-react";

export default function Spinner({ label, size = 14 }: { label?: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Loader2 size={size} className="animate-spin" />
      {label}
    </span>
  );
}
