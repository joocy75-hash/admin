'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  useSettlement,
  confirmSettlement,
  rejectSettlement,
  paySettlement,
} from '@/hooks/use-settlements';

const STATUS_LABELS: Record<string, string> = {
  draft: '초안',
  confirmed: '확인됨',
  paid: '지급완료',
  rejected: '거부',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function SettlementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const settlementId = Number(params.id);
  const { data: settlement, loading } = useSettlement(settlementId);

  const handleConfirm = async () => {
    if (!confirm('이 정산을 확인하시겠습니까?')) return;
    try {
      await confirmSettlement(settlementId);
      router.refresh();
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : '확인 처리 실패');
    }
  };

  const handleReject = async () => {
    if (!confirm('이 정산을 거부하시겠습니까? 원장 내역이 해제됩니다.')) return;
    try {
      await rejectSettlement(settlementId, '관리자에 의해 거부됨');
      router.refresh();
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : '거부 처리 실패');
    }
  };

  const handlePay = async () => {
    if (!confirm('이 정산을 지급하시겠습니까? 에이전트 잔액이 업데이트됩니다.')) return;
    try {
      await paySettlement(settlementId);
      router.refresh();
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : '지급 처리 실패');
    }
  };

  if (loading) return <p className="text-gray-500">로딩 중...</p>;
  if (!settlement) return <p className="text-red-500">정산을 찾을 수 없습니다</p>;

  const formatDate = (dt: string) =>
    new Date(dt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const formatDateTime = (dt: string | null) =>
    dt ? new Date(dt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '-';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">정산 #{settlement.id}</h1>
          <p className="text-sm text-gray-500">
            {settlement.agent_username} ({settlement.agent_code}) /
            {formatDate(settlement.period_start)} ~ {formatDate(settlement.period_end)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${STATUS_COLORS[settlement.status] || 'bg-gray-100'}`}>
            {STATUS_LABELS[settlement.status] || settlement.status}
          </span>
          <button
            onClick={() => router.push('/dashboard/settlements')}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            목록으로
          </button>
        </div>
      </div>

      {/* Amount cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <p className="text-xs text-blue-600">롤링</p>
          <p className="text-xl font-bold text-blue-800">
            {Number(settlement.rolling_total).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border bg-red-50 p-4">
          <p className="text-xs text-red-600">루징</p>
          <p className="text-xl font-bold text-red-800">
            {Number(settlement.losing_total).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border bg-gray-50 p-4">
          <p className="text-xs text-gray-600">공제액</p>
          <p className="text-xl font-bold text-gray-800">
            {Number(settlement.deductions).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-xs text-green-600">순합계</p>
          <p className="text-2xl font-bold text-green-800">
            {Number(settlement.net_total).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-lg border bg-white p-6 dark:bg-gray-900 dark:border-gray-700">
        <h2 className="mb-4 font-medium text-gray-700 dark:text-gray-300">상세 정보</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">총합계</dt>
            <dd className="font-medium">{Number(settlement.gross_total).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">입금 합계</dt>
            <dd className="font-medium">{Number(settlement.deposit_total).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">생성일</dt>
            <dd>{formatDateTime(settlement.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">확인자</dt>
            <dd>{settlement.confirmed_by_username || '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">확인일</dt>
            <dd>{formatDateTime(settlement.confirmed_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">지급일</dt>
            <dd>{formatDateTime(settlement.paid_at)}</dd>
          </div>
          {settlement.memo && (
            <div className="col-span-2">
              <dt className="text-xs text-gray-500 dark:text-gray-400">메모</dt>
              <dd className="text-gray-600">{settlement.memo}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {settlement.status === 'draft' && (
          <>
            <button
              onClick={handleConfirm}
              className="rounded-md bg-blue-600 px-6 py-2 text-sm text-white hover:bg-blue-700"
            >
              확인
            </button>
            <button
              onClick={handleReject}
              className="rounded-md bg-red-600 px-6 py-2 text-sm text-white hover:bg-red-700"
            >
              거부
            </button>
          </>
        )}
        {settlement.status === 'confirmed' && (
          <button
            onClick={handlePay}
            className="rounded-md bg-green-600 px-6 py-2 text-sm text-white hover:bg-green-700"
          >
            지급 처리
          </button>
        )}
      </div>
    </div>
  );
}
