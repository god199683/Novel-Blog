"use client";

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

export default function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: StatCardProps) {
  return (
    <div
      className="card-hover rounded-xl p-5 border"
      style={{
        background: "var(--space-card)",
        borderColor: "var(--space-border)",
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm" style={{ color: "var(--space-fg-muted)" }}>
          {label}
        </span>
      </div>
      <p
        className="text-3xl font-bold"
        style={{ color: color ?? "var(--space-accent)" }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: "var(--space-fg-soft)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
