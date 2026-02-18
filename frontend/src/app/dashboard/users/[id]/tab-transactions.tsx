'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTransactionList } from '@/hooks/use-transactions';

const TYPE_LABELS: Record<string, string> = {
  deposit: '입금', withdrawal: '출금', adjustment: '조정',
};
const STATUS_LABELS: Record<string, string> = {
  pending: '대기', approved: '승인', rejected: '거부', completed: '완료',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
};

function formatKRW(n: number) { return '\u20A9' + Number(n).toLocaleString('ko-KR'); }

type Props = { userId: number };

export default function TabTransactions({ userId }: Props) {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  const { data: depositData, loading: depositLoading } = useTransactionList({
    user_id: userId,
    type: 'deposit',
    page,
    page_size: 10,
  });

  const { data: withdrawalData, loading: withdrawalLoading } = useTransactionList({
    user_id: userId,
    type: 'withdrawal',
    page: 1,
    page_size: 10,
  });

  return (
    <div className="space-y-6">
      {/* Deposit List */}
      <Card>
        <CardHeader><CardTitle className="text-base">입금 신청 내역</CardTitle></CardHeader>
        <CardContent className="p-0">
          {depositLoading ? (
            <div className="p-8 text-center text-muted-foreground">로딩 중...</div>
          ) : !depositData?.items.length ? (
            <div className="p-8 text-center text-muted-foreground">입금 내역이 없습니다</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-right">금액</th>
                    <th className="px-4 py-2 text-center">상태</th>
                    <th className="px-4 py-2 text-left">메모</th>
                    <th className="px-4 py-2 text-left">처리자</th>
                    <th className="px-4 py-2 text-left">신청일</th>
                    <th className="px-4 py-2 text-left">처리일</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {depositData.items.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 text-right font-mono text-blue-600">{formatKRW(tx.amount)}</td>
                      <td className="px-4 py-2 text-center">
                        <Badge className={STATUS_COLORS[tx.status] || ''} variant="secondary">
                          {STATUS_LABELS[tx.status] || tx.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{tx.memo || '-'}</td>
                      <td className="px-4 py-2 text-muted-foreground">{tx.processed_by_username || '-'}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString('ko-KR')}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{tx.processed_at ? new Date(tx.processed_at).toLocaleString('ko-KR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal List */}
      <Card>
        <CardHeader><CardTitle className="text-base">출금 신청 내역</CardTitle></CardHeader>
        <CardContent className="p-0">
          {withdrawalLoading ? (
            <div className="p-8 text-center text-muted-foreground">로딩 중...</div>
          ) : !withdrawalData?.items.length ? (
            <div className="p-8 text-center text-muted-foreground">출금 내역이 없습니다</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-right">금액</th>
                    <th className="px-4 py-2 text-center">상태</th>
                    <th className="px-4 py-2 text-left">메모</th>
                    <th className="px-4 py-2 text-left">처리자</th>
                    <th className="px-4 py-2 text-left">신청일</th>
                    <th className="px-4 py-2 text-left">처리일</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {withdrawalData.items.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 text-right font-mono text-red-600">{formatKRW(tx.amount)}</td>
                      <td className="px-4 py-2 text-center">
                        <Badge className={STATUS_COLORS[tx.status] || ''} variant="secondary">
                          {STATUS_LABELS[tx.status] || tx.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{tx.memo || '-'}</td>
                      <td className="px-4 py-2 text-muted-foreground">{tx.processed_by_username || '-'}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString('ko-KR')}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{tx.processed_at ? new Date(tx.processed_at).toLocaleString('ko-KR') : '-'}</td>
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
