/**
 * A real toggle switch (not a checkbox square) — pure CSS via peer-*, no client JS needed.
 * Uncontrolled in forms (name/defaultChecked); pass checked/onChange to drive it from client state.
 */
export function Switch({
  name,
  label,
  description,
  defaultChecked,
  checked,
  disabled,
  onChange,
}: {
  name?: string;
  label: string;
  // A line under the label — what the switch does, or what its current state means.
  description?: React.ReactNode;
  defaultChecked?: boolean;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-4 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-neutral-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          role="switch"
          name={name}
          defaultChecked={defaultChecked}
          checked={checked}
          disabled={disabled}
          onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-neutral-200 transition-colors peer-checked:bg-neutral-900 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
