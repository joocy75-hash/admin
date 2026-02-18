'use client';

import { useUserPointLogs } from '@/hooks/use-user-detail';
import { Star } from 'lucide-react';
import LogList from './tab-log-list';

const TYPE_LABELS: Record<string, string> = {
  grant: '지급', revoke: '회수', rolling: '롤링', losing: '루징',
  convert: '전환', attendance: '출석', event: '이벤트', usage: '사용',
};

type Props = { userId: number };

export default function TabPoints({ userId }: Props) {
  return (
    <LogList
      userId={userId}
      useFetch={useUserPointLogs}
      typeLabels={TYPE_LABELS}
      summaryItems={(s) => [
        { label: '현재 포인트', value: s.current_points ?? 0, color: 'purple' },
        { label: '총 지급 (+)', value: s.total_credit ?? 0, color: 'green' },
        { label: '총 회수/사용 (-)', value: s.total_debit ?? 0, color: 'red' },
      ]}
      columnLabels={{ amount: '포인트', before: '전 포인트', after: '후 포인트' }}
      emptyIcon={Star}
      emptyMessage="포인트 변동 내역이 없습니다"
    />
  );
}
