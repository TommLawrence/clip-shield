import { EXPOSURE_TONE_CLASSES } from "@/lib/risk-engine";
import { cn } from "@/lib/utils";

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ExposureScore({ exposure }) {
  const tone = EXPOSURE_TONE_CLASSES[exposure.band.tone] || EXPOSURE_TONE_CLASSES.emerald;
  const offset = CIRCUMFERENCE - (exposure.score / 100) * CIRCUMFERENCE;

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[112px] w-[112px] shrink-0">
        <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90" role="img" aria-label={`Exposure score ${exposure.score} of 100`}>
          <circle cx="52" cy="52" r={RADIUS} fill="none" stroke="hsl(220 10% 16%)" strokeWidth="7" />
          <circle
            cx="52"
            cy="52"
            r={RADIUS}
            fill="none"
            stroke={tone.stroke}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="font-heading text-[26px] font-semibold leading-none tracking-[-0.02em] text-foreground">
              {exposure.score}
            </div>
            <div className="cs-mono mt-1 text-[9px] text-muted-foreground">/ 100</div>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]", tone.border, tone.bg, tone.text)}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {exposure.band.label}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{exposure.explanation}</p>
        <p className="mt-1.5 hidden font-mono text-[10.5px] text-muted-foreground/80 sm:block">
          {exposure.rawPoints} base pts + {exposure.diversityBonus} diversity
        </p>
      </div>
    </div>
  );
}