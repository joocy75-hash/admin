'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSettlementList } from '@/hooks/use-settlements';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AlertCircle, Calculator } from 'lucide-react';

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

export default function SettlementsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [agentIdFilter, setAgentIdFilter] = useState('');

  const { data, loading, error, refetch } = useSettlementList({
    page,
    page_size: 20,
    status: statusFilter || undefined,
    agent_id: agentIdFilter ? Number(agentIdFilter) : undefined,
  });

  const formatDate = (dt: string) =>
    new Date(dt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">정산 관리</h1>
        <Link href="/dashboard/settlements/new">
          <Button>+ 정산 등록</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
        >
          <option value="">전체 상태</option>
          <option value="draft">초안</option>
          <option value="confirmed">확인됨</option>
          <option value="paid">지급완료</option>
          <option value="rejected">거부</option>
        </select>
        <Input
          type="number"
          value={agentIdFilter}
          onChange={(e) => { setAgentIdFilter(e.target.value); setPage(1); }}
          placeholder="에이전트 ID"
          className="w-32 h-9"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-destructive">
          <AlertCircle className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">데이터를 불러오지 못했습니다</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={refetch}>다시 시도</Button>
        </div>
      ) : data?.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Calculator className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">정산 내역이 없습니다</p>
          <p className="text-sm">조건을 변경하거나 새로 등록해주세요.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>에이전트</TableHead>
                <TableHead>기간</TableHead>
                <TableHead className="text-right">롤링</TableHead>
                <TableHead className="text-right">루징</TableHead>
                <TableHead className="text-right">순합계</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>생성일</TableHead>
                <TableHead>관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground">{s.id}</TableCell>
                  <TableCell>
                    <span className="font-medium">{s.agent_username}</span>
                    {s.agent_code && <span className="ml-1 text-xs text-muted-foreground">({s.agent_code})</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(s.period_start)} ~ {formatDate(s.period_end)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(s.rolling_total).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(s.losing_total).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {Number(s.net_total).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-800'} variant="secondary">
                      {STATUS_LABELS[s.status] || s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(s.created_at)}
                  </TableCell>
                  <TableCell>
                    <Link href={`/dashboard/settlements/${s.id}`}>
                      <Button variant="ghost" size="xs">상세</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">전체: {data.total}건</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))}>
              이전
            </Button>
            <span className="flex items-center text-sm text-muted-foreground">
              {data.page} / {Math.ceil(data.total / data.page_size)}
            </span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / data.page_size)} onClick={() => setPage(page + 1)}>
              다음
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
