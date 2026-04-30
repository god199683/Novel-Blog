"use client";

interface ToggleSwitchProps {
  active: boolean;
  onChange?: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export default function ToggleSwitch({
  active,
  onChange,
  label,
  description,
  disabled,
}: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--space-fg-muted)" }}
          >
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange?.(!active)}
        className={`toggle-switch ${active ? "active" : ""}`}
        aria-label={label}
      />
    </div>
  );
}
