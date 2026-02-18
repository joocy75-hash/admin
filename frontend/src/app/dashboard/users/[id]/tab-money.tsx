'use client';

import { useUserMoneyLogs } from '@/hooks/use-user-detail';
import { Wallet } from 'lucide-react';
import LogList from './tab-log-list';

const TYPE_LABELS: Record<string, string> = {
  deposit: '입금', withdrawal: '출금', adjustment: '조정', bet: '베팅',
  win: '당첨', commission: '커미션', bonus: '보너스', transfer: '이체',
};

type Props = { userId: number };

export default function TabMoney({ userId }: Props) {
  return (
    <LogList
      userId={userId}
      useFetch={useUserMoneyLogs}
      typeLabels={TYPE_LABELS}
      summaryItems={(s) => [
        { label: '현재 잔액', value: s.current_balance ?? 0, color: 'blue' },
        { label: '총 지급 (+)', value: s.total_credit ?? 0, color: 'green' },
        { label: '총 회수 (-)', value: s.total_debit ?? 0, color: 'red' },
      ]}
      columnLabels={{ amount: '금액', before: '전 잔액', after: '후 잔액' }}
      emptyIcon={Wallet}
      emptyMessage="머니 변동 내역이 없습니다"
    />
  );
}
