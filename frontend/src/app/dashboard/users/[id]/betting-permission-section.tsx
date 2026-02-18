'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const GAME_CATEGORIES = ['casino', 'slot', 'holdem', 'sports', 'shooting', 'coin', 'minigame'];
const GAME_LABELS: Record<string, string> = {
  casino: '카지노', slot: '슬롯', holdem: '홀덤', sports: '스포츠',
  shooting: '슈팅', coin: '코인', minigame: '미니게임',
};

type Permission = {
  game_category: string;
  is_allowed: boolean;
};

type Props = {
  permissions: Permission[];
  onToggle: (category: string, currentAllow: boolean) => void;
};

export default function BettingPermissionSection({ permissions, onToggle }: Props) {
  const getPermission = (category: string) => {
    return permissions.find((p) => p.game_category === category)?.is_allowed ?? true;
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">베팅 권한 설정</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {GAME_CATEGORIES.map((cat) => {
            const allowed = getPermission(cat);
            return (
              <button
                key={cat}
                onClick={() => onToggle(cat, allowed)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                  allowed
                    ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                }`}
              >
                <span className="text-sm font-medium">{GAME_LABELS[cat]}</span>
                <Badge className={allowed ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'} variant="secondary">
                  {allowed ? '허용' : '차단'}
                </Badge>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
