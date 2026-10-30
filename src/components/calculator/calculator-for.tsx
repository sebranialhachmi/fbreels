import { EosCalculator } from './eos-calculator';
import { REASONS, type Reason } from '@/lib/calc/eos';
import type { CalcPreset } from '@/lib/pages';

const PRESETS: Record<CalcPreset, { reasons: readonly Reason[]; defaultReason: Reason }> = {
  general: { reasons: REASONS, defaultReason: 'employer_termination' },
  resignation: {
    reasons: ['resignation', 'marriage_childbirth_art87', 'worker_leave_art81'],
    defaultReason: 'resignation',
  },
  termination: {
    reasons: ['employer_termination', 'contract_end', 'retirement', 'dismissal_art80'],
    defaultReason: 'employer_termination',
  },
};

export function CalculatorFor({ preset = 'general' }: { preset?: CalcPreset }) {
  const p = PRESETS[preset];
  return <EosCalculator reasons={p.reasons} defaultReason={p.defaultReason} />;
}
