'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  type Agent,
  useAgentCommissionRates, useSubAgentRates, setAgentCommissionRate,
  type AgentCommissionRate,
} from '@/hooks/use-agents';
import { useToast } from '@/components/toast-provider';
import { Percent } from 'lucide-react';

const GAME_CATEGORIES = ['casino', 'slot', 'holdem', 'sports', 'shooting', 'coin', 'mini_game'];
const GAME_LABELS: Record<string, string> = {
  casino: '카지노',
  slot: '슬롯',
  holdem: '홀덤',
  sports: '스포츠',
  shooting: '슈팅',
  coin: '코인',
  mini_game: '미니게임',
};

type Props = {
  agentId: number;
  agent: Agent;
};

export default function CommissionRateTab({ agentId, agent }: Props) {
  const toast = useToast();
  const { rates, loading, refetch } = useAgentCommissionRates(agentId);
  const { rates: subRates, loading: subLoading, refetch: subRefetch } = useSubAgentRates(agentId);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const getRate = (category: string, type: string): number => {
    const found = rates.find((r) => r.game_category === category && r.commission_type === type);
    return found ? Number(found.rate) : 0;
  };

  const handleRateChange = async (category: string, type: string, value: string) => {
    const rate = parseFloat(value);
    if (isNaN(rate) || rate < 0 || rate > 100) return;
    const key = `${category}-${type}`;
    setSavingKey(key);
    try {
      await setAgentCommissionRate(agentId, category, type, rate);
      refetch();
      subRefetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '요율 변경 실패');
    } finally {
      setSavingKey(null);
    }
  };

  const subAgentMap = new Map<number, { username: string; agent_code: string; rates: AgentCommissionRate[] }>();
  for (const sr of subRates) {
    if (!subAgentMap.has(sr.agent_id)) {
      subAgentMap.set(sr.agent_id, {
        username: sr.agent_username || '',
        agent_code: sr.agent_code || '',
        rates: [],
      });
    }
    subAgentMap.get(sr.agent_id)!.rates.push(sr);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-4 w-4" />
            본인 커미션 요율 (게임별)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            하부 에이전트에게 본인 요율 이하로 자유롭게 배분 가능
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-4 text-center text-muted-foreground">로딩 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 text-left font-medium w-32">게임</th>
                    <th className="pb-2 text-center font-medium">롤링 (%)</th>
                    <th className="pb-2 text-center font-medium">죽장/루징 (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {GAME_CATEGORIES.map((cat) => (
                    <tr key={cat}>
                      <td className="py-2.5 font-medium">{GAME_LABELS[cat]}</td>
                      <td className="py-2.5 text-center">
                        <Input
                          type="number"
                          className="w-20 h-7 text-center text-sm mx-auto"
                          step="0.01"
                          min="0"
                          max="100"
                          defaultValue={getRate(cat, 'rolling')}
                          key={`rolling-${cat}-${rates.length}`}
                          disabled={savingKey === `${cat}-rolling`}
                          onBlur={(e) => handleRateChange(cat, 'rolling', e.target.value)}
                        />
                      </td>
                      <td className="py-2.5 text-center">
                        <Input
                          type="number"
                          className="w-20 h-7 text-center text-sm mx-auto"
                          step="0.01"
                          min="0"
                          max="100"
                          defaultValue={getRate(cat, 'losing')}
                          key={`losing-${cat}-${rates.length}`}
                          disabled={savingKey === `${cat}-losing`}
                          onBlur={(e) => handleRateChange(cat, 'losing', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">하부 에이전트 배분 현황</CardTitle>
          <p className="text-xs text-muted-foreground">
            직속 하부 에이전트에게 배분한 커미션 요율 현황
          </p>
        </CardHeader>
        <CardContent>
          {subLoading ? (
            <div className="py-4 text-center text-muted-foreground">로딩 중...</div>
          ) : subAgentMap.size === 0 ? (
            <div className="py-4 text-center text-muted-foreground">하부 에이전트가 없거나 배분된 요율이 없습니다</div>
          ) : (
            <div className="space-y-4">
              {Array.from(subAgentMap.entries()).map(([childId, child]) => (
                <div key={childId} className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-mono text-xs text-muted-foreground">{child.agent_code}</span>
                    <span className="font-medium text-sm">{child.username}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {child.rates.map((r) => (
                      <div key={r.id} className="flex items-center justify-between px-2 py-1 rounded bg-muted/50 text-xs">
                        <span>{GAME_LABELS[r.game_category] || r.game_category} ({r.commission_type === 'rolling' ? '롤링' : '죽장'})</span>
                        <Badge variant="secondary" className="ml-1">{Number(r.rate)}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
