'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserTree } from '@/hooks/use-users';
import type { UserDetailData } from '@/hooks/use-user-detail';
import { Users, Link, UserX } from 'lucide-react';
import { formatAmount } from '@/lib/utils';

const RANK_LABELS: Record<string, string> = {
  sub_hq: '부본사', distributor: '총판', agency: '대리점',
};

type Props = {
  userId: number;
  detail: UserDetailData;
};

export default function TabReferral({ userId, detail }: Props) {
  const { nodes, loading } = useUserTree(userId);
  const user = detail.user;

  const directChildren = nodes.filter((n) => n.referrer_id === userId);

  return (
    <div className="space-y-4">
      {/* Referral Code */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
          <CardContent className="pt-6">
            <p className="text-xs text-green-600 dark:text-green-400">본인 추천 코드</p>
            <div className="flex items-center gap-2 mt-1">
              <Link className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-lg font-bold text-green-700 dark:text-green-300">{user.username}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">추천인</p>
            <span className="text-lg mt-1 block">{user.referrer_username || '없음'}</span>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
          <CardContent className="pt-6">
            <p className="text-xs text-blue-600 dark:text-blue-400">하부 회원 수</p>
            <div className="flex items-center gap-2 mt-1">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{user.direct_referral_count}명</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900">
          <CardContent className="pt-6">
            <p className="text-xs text-purple-600 dark:text-purple-400">전체 하위 회원</p>
            <span className="text-lg font-bold text-purple-700 dark:text-purple-300 mt-1 block">{nodes.length > 0 ? nodes.length - 1 : 0}명</span>
          </CardContent>
        </Card>
      </div>

      {/* Rolling/Losing Settings */}
      <Card>
        <CardHeader><CardTitle className="text-base">추천인 수익 설정</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {detail.game_rolling_rates.length > 0 ? (
              detail.game_rolling_rates.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-2 rounded border">
                  <span className="text-sm">{r.game_category}{r.provider ? ` (${r.provider})` : ''}</span>
                  <Badge className="bg-blue-100 text-blue-800" variant="secondary">{r.rolling_rate}%</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground col-span-2">설정된 롤링율이 없습니다</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Direct Referral List */}
      <Card>
        <CardHeader><CardTitle className="text-base">직접 추천 회원 목록</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : directChildren.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <UserX className="h-10 w-10 mb-3" />
              <p className="text-base font-medium">직접 추천 회원이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left">아이디</th>
                    <th className="px-4 py-2 text-center">등급</th>
                    <th className="px-4 py-2 text-center">상태</th>
                    <th className="px-4 py-2 text-right">잔액</th>
                    <th className="px-4 py-2 text-right">포인트</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {directChildren.map((child) => (
                    <tr key={child.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{child.username}</td>
                      <td className="px-4 py-2 text-center">
                        <Badge variant="secondary">{RANK_LABELS[child.rank] || child.rank}</Badge>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Badge className={child.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'} variant="secondary">
                          {child.status === 'active' ? '활성' : '정지'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{formatAmount(child.balance)}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatAmount(child.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
