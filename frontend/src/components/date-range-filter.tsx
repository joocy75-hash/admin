'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const DEFAULT_PRESETS = [
  { label: '오늘', days: 0 },
  { label: '어제', days: 1 },
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
];

function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }

type Props = {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  presets?: { label: string; days: number }[];
};

export default function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  presets = DEFAULT_PRESETS,
}: Props) {
  const applyPreset = (days: number) => {
    const now = new Date();
    if (days === 0) {
      onDateFromChange(toDateStr(now));
      onDateToChange(toDateStr(now));
    } else if (days === 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      onDateFromChange(toDateStr(d));
      onDateToChange(toDateStr(d));
    } else {
      const from = new Date(now);
      from.setDate(from.getDate() - days);
      onDateFromChange(toDateStr(from));
      onDateToChange(toDateStr(now));
    }
  };

  return (
    <>
      {presets.map((p) => (
        <Button key={p.label} variant="outline" size="sm" onClick={() => applyPreset(p.days)}>{p.label}</Button>
      ))}
      <Input type="date" className="w-36 h-8 text-sm" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} />
      <span className="text-muted-foreground">~</span>
      <Input type="date" className="w-36 h-8 text-sm" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} />
    </>
  );
}
