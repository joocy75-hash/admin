'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAgentList, deleteAgent, type Agent } from '@/hooks/use-agents';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Network,
  Eye,
  Trash2,
  AlertCircle,
  Users,
} from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  teacher: '총판',
  sub_hq: '부본사',
  agent: '에이전트',
  sub_agent: '서브에이전트',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  suspended: 'secondary',
  banned: 'destructive',
};

export default function AgentsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const { data, loading, error, refetch } = useAgentList({
    page,
    page_size: 20,
    search: search || undefined,
    role: roleFilter || undefined,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleDelete = async (agent: Agent) => {
    if (!confirm(`${agent.username} (${agent.agent_code})을(를) 비활성화하시겠습니까?`)) return;
    try {
      await deleteAgent(agent.id);
      refetch();
    } catch {
      alert('삭제 실패');
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">에이전트 관리</h2>
          <p className="text-muted-foreground">에이전트 목록 및 트리 관리</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard/agents/tree')}>
            <Network className="h-4 w-4 mr-2" />
            트리 보기
          </Button>
          <Button onClick={() => router.push('/dashboard/agents/new')}>
            <Plus className="h-4 w-4 mr-2" />
            에이전트 추가
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
              <Input
                placeholder="아이디, 코드, 이메일 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <Button type="submit" variant="outline" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </form>
            <select
              className="border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-950"
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            >
              <option value="">전체 역할</option>
              <option value="admin">관리자</option>
              <option value="teacher">총판</option>
              <option value="sub_hq">부본사</option>
              <option value="agent">에이전트</option>
              <option value="sub_agent">서브에이전트</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
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
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">에이전트가 없습니다</p>
              <p className="text-sm">검색 조건을 변경하거나 새로 등록해주세요.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>코드</TableHead>
                    <TableHead>아이디</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">잔액</TableHead>
                    <TableHead className="text-right">하위</TableHead>
                    <TableHead>최근 로그인</TableHead>
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-mono text-xs">{agent.agent_code}</TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/agents/${agent.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {agent.username}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{ROLE_LABELS[agent.role] || agent.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[agent.status] || 'outline'}>
                          {agent.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(agent.balance).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{agent.children_count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {agent.last_login_at
                          ? new Date(agent.last_login_at).toLocaleDateString('ko-KR')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(agent)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  총 {data.total}건 중 {(page - 1) * data.page_size + 1}-
                  {Math.min(page * data.page_size, data.total)}건
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="flex items-center text-sm px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
