'use client';

import { useState } from 'react';
import { useTransactionList, approveTransaction, rejectTransaction } from '@/hooks/use-transactions';
import type { Transaction } from '@/hooks/use-transactions';
import { getTxExplorerUrl, getAddressExplorerUrl, getExplorerName, shortenHash } from '@/lib/blockchain';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/toast-provider';
import { AlertCircle, Receipt, ExternalLink, Copy, Check } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  deposit: '입금', withdrawal: '출금', adjustment: '조정', commission: '커미션',
};
const TYPE_COLORS: Record<string, string> = {
  deposit: 'bg-blue-100 text-blue-800',
  withdrawal: 'bg-red-100 text-red-800',
  adjustment: 'bg-purple-100 text-purple-800',
  commission: 'bg-green-100 text-green-800',
};
const STATUS_LABELS: Record<string, string> = {
  pending: '대기', approved: '승인', rejected: '거부',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function TxHashLink({ txHash, network }: { txHash: string; network?: string | null }) {
  const url = getTxExplorerUrl(txHash, network);
  const name = getExplorerName(network);
  return (
    <div className="flex items-center gap-1">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-blue-600 hover:text-blue-800 hover:underline"
          title={`${name}에서 확인`}
        >
          {shortenHash(txHash)}
        </a>
      ) : (
        <code className="text-xs font-mono text-muted-foreground">{shortenHash(txHash)}</code>
      )}
      <CopyButton text={txHash} />
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-blue-600">
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function TxDetailDialog({ tx, open, onClose }: { tx: Transaction | null; open: boolean; onClose: () => void }) {
  if (!tx) return null;
  const txUrl = getTxExplorerUrl(tx.tx_hash || '', tx.network);
  const addrUrl = getAddressExplorerUrl(tx.wallet_address || '', tx.network);
  const explorerName = getExplorerName(tx.network);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            거래 상세 #{tx.id}
            <Badge className={TYPE_COLORS[tx.type] || ''} variant="secondary">
              {TYPE_LABELS[tx.type] || tx.type}
            </Badge>
            <Badge className={STATUS_COLORS[tx.status] || ''} variant="secondary">
              {STATUS_LABELS[tx.status] || tx.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">회원</p>
              <p className="font-medium">{tx.user_username || `ID: ${tx.user_id}`}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">금액</p>
              <p className="font-mono font-bold text-lg">{Number(tx.amount).toLocaleString()} <span className="text-xs font-normal">{tx.coin_type || 'USDT'}</span></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">전 잔액</p>
              <p className="font-mono">{Number(tx.balance_before).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">후 잔액</p>
              <p className="font-mono">{Number(tx.balance_after).toLocaleString()}</p>
            </div>
          </div>

          {(tx.coin_type || tx.network) && (
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">블록체인 정보</p>
              <div className="grid grid-cols-2 gap-2">
                {tx.coin_type && (
                  <div>
                    <p className="text-xs text-muted-foreground">코인</p>
                    <Badge variant="outline">{tx.coin_type}</Badge>
                  </div>
                )}
                {tx.network && (
                  <div>
                    <p className="text-xs text-muted-foreground">네트워크</p>
                    <Badge variant="secondary">{tx.network}</Badge>
                  </div>
                )}
              </div>

              {tx.tx_hash && (
                <div>
                  <p className="text-xs text-muted-foreground">TX Hash</p>
                  <div className="flex items-center gap-1 mt-1">
                    <code className="text-xs font-mono break-all flex-1">{tx.tx_hash}</code>
                    <CopyButton text={tx.tx_hash} />
                  </div>
                  {txUrl && (
                    <a
                      href={txUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {explorerName}에서 확인
                    </a>
                  )}
                </div>
              )}

              {tx.wallet_address && (
                <div>
                  <p className="text-xs text-muted-foreground">지갑 주소</p>
                  <div className="flex items-center gap-1 mt-1">
                    <code className="text-xs font-mono break-all flex-1">{tx.wallet_address}</code>
                    <CopyButton text={tx.wallet_address} />
                  </div>
                  {addrUrl && (
                    <a
                      href={addrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {explorerName}에서 확인
                    </a>
                  )}
                </div>
              )}

              {tx.confirmations != null && (
                <div>
                  <p className="text-xs text-muted-foreground">블록 확인</p>
                  <p className="font-mono">{tx.confirmations} confirmations</p>
                </div>
              )}
            </div>
          )}

          {tx.memo && (
            <div>
              <p className="text-xs text-muted-foreground">메모</p>
              <p>{tx.memo}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground border-t pt-3">
            <div>
              <p>신청일</p>
              <p className="text-foreground">{new Date(tx.created_at).toLocaleString('ko-KR')}</p>
            </div>
            <div>
              <p>처리일</p>
              <p className="text-foreground">{tx.processed_at ? new Date(tx.processed_at).toLocaleString('ko-KR') : '-'}</p>
            </div>
            <div>
              <p>처리자</p>
              <p className="text-foreground">{tx.processed_by_username || '-'}</p>
            </div>
            <div>
              <p>UUID</p>
              <p className="text-foreground font-mono">{shortenHash(tx.uuid)}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TransactionsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmDesc, setConfirmDesc] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const openConfirm = (title: string, desc: string, action: () => void) => {
    setConfirmTitle(title);
    setConfirmDesc(desc);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  const { data, loading, error, refetch } = useTransactionList({
    page,
    page_size: 20,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    user_id: userIdFilter ? Number(userIdFilter) : undefined,
  });

  const handleApprove = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    openConfirm('거래 승인', '이 거래를 승인하시겠습니까?', async () => {
      try {
        await approveTransaction(id);
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '승인 실패');
      }
    });
  };

  const handleReject = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    openConfirm('거래 거부', '이 거래를 거부하시겠습니까?', async () => {
      try {
        await rejectTransaction(id);
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '거부 실패');
      }
    });
  };

  return (
    <div className="space-y-6">
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmAction?.(); setConfirmOpen(false); }}>
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TxDetailDialog tx={selectedTx} open={!!selectedTx} onClose={() => setSelectedTx(null)} />

      <h1 className="text-2xl font-bold">입출금 관리</h1>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-blue-600 dark:text-blue-400">전체 건수</p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{data.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-green-600 dark:text-green-400">총 금액 (필터)</p>
              <p className="text-xl font-bold text-green-700 dark:text-green-300">{Number(data.total_amount).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">현재 페이지</p>
              <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">{data.items.length}건</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
        >
          <option value="">전체 유형</option>
          <option value="deposit">입금</option>
          <option value="withdrawal">출금</option>
          <option value="adjustment">조정</option>
          <option value="commission">커미션</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
        >
          <option value="">전체 상태</option>
          <option value="pending">대기중</option>
          <option value="approved">승인</option>
          <option value="rejected">거부</option>
        </select>
        <Input
          type="number"
          value={userIdFilter}
          onChange={(e) => { setUserIdFilter(e.target.value); setPage(1); }}
          placeholder="회원 ID"
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
          <Receipt className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">거래 내역이 없습니다</p>
          <p className="text-sm">조건을 변경해주세요.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>회원</TableHead>
                <TableHead>유형</TableHead>
                <TableHead className="text-center">코인</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead className="text-right">전 잔액</TableHead>
                <TableHead className="text-right">후 잔액</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>TX Hash</TableHead>
                <TableHead>일시</TableHead>
                <TableHead>액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((tx) => (
                <TableRow key={tx.id} className="cursor-pointer" onClick={() => setSelectedTx(tx)}>
                  <TableCell className="text-muted-foreground">{tx.id}</TableCell>
                  <TableCell className="font-medium">
                    {tx.user_username || tx.user_id}
                  </TableCell>
                  <TableCell>
                    <Badge className={TYPE_COLORS[tx.type] || 'bg-gray-100 text-gray-800'} variant="secondary">
                      {TYPE_LABELS[tx.type] || tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {tx.coin_type ? (
                      <span className="text-xs">{tx.coin_type}{tx.network ? ` (${tx.network})` : ''}</span>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium font-mono">
                    {Number(tx.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono">
                    {Number(tx.balance_before).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono">
                    {Number(tx.balance_after).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[tx.status] || 'bg-gray-100 text-gray-800'} variant="secondary">
                      {STATUS_LABELS[tx.status] || tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {tx.tx_hash ? (
                      <TxHashLink txHash={tx.tx_hash} network={tx.network} />
                    ) : (
                      <span className="text-xs text-muted-foreground">{tx.memo ? shortenHash(tx.memo, 10, 0) : '-'}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {tx.status === 'pending' ? (
                      <div className="flex gap-1">
                        <Button size="sm" className="h-6 text-xs px-2" onClick={(e) => handleApprove(e, tx.id)}>
                          승인
                        </Button>
                        <Button variant="destructive" size="sm" className="h-6 text-xs px-2" onClick={(e) => handleReject(e, tx.id)}>
                          거부
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {tx.processed_by_username || '-'}
                      </span>
                    )}
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
          <p className="text-sm text-muted-foreground">총 {data.total}건</p>
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
