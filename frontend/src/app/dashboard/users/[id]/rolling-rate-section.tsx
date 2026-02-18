'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const GAME_CATEGORIES = ['casino', 'slot', 'holdem', 'sports', 'shooting', 'coin', 'minigame'];
const GAME_LABELS: Record<string, string> = {
  casino: '카지노', slot: '슬롯', holdem: '홀덤', sports: '스포츠',
  shooting: '슈팅', coin: '코인', minigame: '미니게임',
};
const HOLDEM_PROVIDERS = ['revolution', 'skycity', 'wild'];
const PROVIDER_LABELS: Record<string, string> = {
  revolution: '레볼루션', skycity: '스카이시티', wild: '와일드',
};

type RollingRate = {
  game_category: string;
  provider?: string | null;
  rolling_rate: number;
};

type Props = {
  rates: RollingRate[];
  onRateChange: (category: string, value: string, provider?: string) => void;
};

export default function RollingRateSection({ rates, onRateChange }: Props) {
  const getRollingRate = (category: string, provider?: string) => {
    return rates.find(
      (r) => r.game_category === category && (provider ? r.provider === provider : !r.provider)
    )?.rolling_rate ?? 0;
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">게임별 롤링율 (%)</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">게임</th>
                <th className="pb-2 font-medium text-center">롤링율 (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {GAME_CATEGORIES.map((cat) => (
                <tr key={cat}>
                  <td className="py-2 font-medium">{GAME_LABELS[cat]}</td>
                  <td className="py-2 text-center">
                    {cat === 'holdem' ? (
                      <div className="space-y-1">
                        {HOLDEM_PROVIDERS.map((prov) => (
                          <div key={prov} className="flex items-center justify-center gap-2">
                            <span className="text-xs text-muted-foreground w-20 text-right">{PROVIDER_LABELS[prov]}</span>
                            <Input
                              type="number"
                              className="w-20 h-7 text-center text-sm"
                              step="0.1"
                              min="0"
                              max="100"
                              defaultValue={getRollingRate(cat, prov)}
                              onBlur={(e) => onRateChange(cat, e.target.value, prov)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Input
                        type="number"
                        className="w-20 h-7 text-center text-sm mx-auto"
                        step="0.1"
                        min="0"
                        max="100"
                        defaultValue={getRollingRate(cat)}
                        onBlur={(e) => onRateChange(cat, e.target.value)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
