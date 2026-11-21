import { POLICIES } from "@/lib/redaction";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OPTIONS = [POLICIES.balanced, POLICIES.strict, POLICIES.custom];

/**
 * Single protection-policy control (Balanced / Strict / Custom). The policy
 * configures the shared detector registry — it does not switch redaction
 * engines. Custom defers category enable/disable to the findings list, where
 * every detected category stays reviewable.
 *
 * Mobile renders a compact dropdown; desktop (sm+) keeps the three-button
 * radiogroup. Both drive the same `onChange(id)` handler.
 */
export default function PolicySelector({ policy, onChange }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <p className="cs-mono text-[10px] text-muted-foreground">Protection policy</p>

      {/* Mobile: compact dropdown */}
      <Select value={policy} onValueChange={onChange}>
        <SelectTrigger className="mt-2 h-9 border-white/[0.08] bg-white/[0.03] text-[12.5px] sm:hidden" aria-label="Protection policy">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((option) => (
            <SelectItem key={option.id} value={option.id} className="text-[12.5px]">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Desktop: three-button radiogroup */}
      <div role="radiogroup" aria-label="Protection policy" className="mt-2 hidden grid-cols-3 gap-1.5 sm:grid">
        {OPTIONS.map((option) => {
          const active = policy === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.id)}
              className={
                "rounded-lg border px-2 py-2 text-left transition-colors " +
                (active
                  ? "border-primary/40 bg-primary/[0.08] text-foreground"
                  : "border-white/[0.07] bg-white/[0.02] text-muted-foreground hover:text-foreground")
              }
            >
              <span className="block text-[12px] font-medium">{option.label}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {POLICIES[policy]?.description || POLICIES.balanced.description}
      </p>
    </div>
  );
}