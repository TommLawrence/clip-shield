/**
 * Deterministic exposure assessment.
 *
 * The score is computed from the redaction findings only — never from a model,
 * never from the AI response — so it is reproducible and explainable.
 */
import { CATEGORIES } from "./redaction.js";

const BANDS = [
  { max: 19, label: "Minimal exposure", tone: "emerald" },
  { max: 44, label: "Elevated exposure", tone: "amber" },
  { max: 69, label: "High exposure", tone: "orange" },
  { max: 100, label: "Severe exposure", tone: "rose" },
];

export function bandFor(score) {
  return BANDS.find((band) => score <= band.max) || BANDS[BANDS.length - 1];
}

export function assessExposure(findings = []) {
  const included = findings.filter((finding) => finding.include);

  const grouped = new Map();
  for (const finding of included) {
    const current = grouped.get(finding.category) || { category: finding.category, count: 0 };
    current.count += 1;
    grouped.set(finding.category, current);
  }

  const factors = [...grouped.values()]
    .map(({ category, count }) => {
      const meta = CATEGORIES[category];
      const base = meta.weight * count;
      const repetition = Math.round(meta.weight * 0.2 * (count - 1));
      return {
        category,
        label: meta.label,
        severity: meta.severity,
        count,
        weight: meta.weight,
        points: base + repetition,
        explanation:
          count > 1
            ? `${count} × ${meta.label.toLowerCase()} (${meta.weight} pts each, +${repetition} repetition)`
            : `1 × ${meta.label.toLowerCase()} (${meta.weight} pts)`,
      };
    })
    .sort((a, b) => b.points - a.points);

  const rawPoints = factors.reduce((total, factor) => total + factor.points, 0);
  const diversityBonus = Math.max(0, factors.length - 1) * 2;
  const score = Math.min(100, Math.round(rawPoints + diversityBonus));
  const band = bandFor(score);

  return {
    score,
    band,
    rawPoints,
    diversityBonus,
    factors,
    categoryCount: factors.length,
    maskedCount: included.length,
    explanation: factors.length
      ? `Weighted sum of ${included.length} finding${included.length === 1 ? "" : "s"} across ${factors.length} categor${factors.length === 1 ? "y" : "ies"}.`
      : "No sensitive patterns are currently masked.",
  };
}

export const EXPOSURE_TONE_CLASSES = {
  emerald: { text: "text-emerald-300", border: "border-emerald-400/25", bg: "bg-emerald-400/10", stroke: "hsl(160 84% 45%)" },
  amber: { text: "text-amber-300", border: "border-amber-400/25", bg: "bg-amber-400/10", stroke: "hsl(38 92% 60%)" },
  orange: { text: "text-orange-300", border: "border-orange-400/25", bg: "bg-orange-400/10", stroke: "hsl(24 95% 58%)" },
  rose: { text: "text-rose-300", border: "border-rose-400/25", bg: "bg-rose-400/10", stroke: "hsl(350 89% 60%)" },
};