'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUserTree } from '@/hooks/use-users';
import { ArrowLeft, Search } from 'lucide-react';

const Tree = dynamic(() => import('react-d3-tree').then((m) => m.default), {
  ssr: false,
  loading: () => <div className="h-[600px] flex items-center justify-center text-muted-foreground">트리 로딩 중...</div>,
});

const RANK_COLORS: Record<string, string> = {
  sub_hq: '#ef4444',
  distributor: '#f59e0b',
  agency: '#10b981',
};

const RANK_LABELS: Record<string, string> = {
  sub_hq: '부본사',
  distributor: '총판',
  agency: '대리점',
};

type TreeNodeData = {
  name: string;
  attributes?: Record<string, string>;
  children?: TreeNodeData[];
  _raw?: { id: number; rank: string; status: string };
};

export default function UserTreePage() {
  const router = useRouter();
  const [rootId, setRootId] = useState<number | null>(null);
  const [rootInput, setRootInput] = useState('');

  const { nodes, loading } = useUserTree(rootId);

  const treeData = useMemo(() => {
    if (nodes.length === 0) return null;

    const nodeMap = new Map<number, TreeNodeData>();
    for (const n of nodes) {
      nodeMap.set(n.id, {
        name: n.username,
        attributes: {
          rank: RANK_LABELS[n.rank] || n.rank,
          bal: n.balance.toLocaleString(),
        },
        children: [],
        _raw: { id: n.id, rank: n.rank, status: n.status },
      });
    }

    let root: TreeNodeData | null = null;
    for (const n of nodes) {
      const node = nodeMap.get(n.id)!;
      if (n.referrer_id && nodeMap.has(n.referrer_id)) {
        nodeMap.get(n.referrer_id)!.children!.push(node);
      } else if (rootId && n.id === rootId) {
        root = node;
      }
    }

    // If no explicit root matched, use first node
    if (!root && nodes.length > 0) {
      root = nodeMap.get(nodes[0].id) || null;
    }

    return root;
  }, [nodes, rootId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(rootInput);
    if (val > 0) setRootId(val);
  };

  const renderNodeLabel = ({ nodeDatum }: { nodeDatum: TreeNodeData }) => {
    const raw = nodeDatum._raw;
    const color = raw ? RANK_COLORS[raw.rank] || '#6b7280' : '#6b7280';
    const isInactive = raw?.status !== 'active';

    return (
      <g>
        <circle r={22} fill={color} opacity={isInactive ? 0.4 : 1} stroke={isInactive ? '#d1d5db' : color} strokeWidth={2} />
        <text fill="white" strokeWidth="0" fontSize="9" textAnchor="middle" dy="3" fontWeight="bold">
          {nodeDatum.attributes?.rank}
        </text>
        <text fill={isInactive ? '#9ca3af' : '#111827'} strokeWidth="0" fontSize="12" textAnchor="middle" dy="-32" fontWeight="600">
          {nodeDatum.name}
        </text>
        <text fill="#6b7280" strokeWidth="0" fontSize="9" textAnchor="middle" dy="42">
          {nodeDatum.attributes?.bal}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">회원 트리</h2>
            <p className="text-muted-foreground">추천인 기반 다단계 구조 시각화</p>
          </div>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="number"
            min="1"
            className="w-40"
            value={rootInput}
            onChange={(e) => setRootInput(e.target.value)}
            placeholder="회원 ID 입력"
          />
          <Button type="submit" variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Legend */}
      <div className="flex gap-6 flex-wrap">
        {Object.entries(RANK_COLORS).map(([rank, color]) => (
          <div key={rank} className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
            <span className="font-medium">{RANK_LABELS[rank]}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {!rootId ? (
            <div className="h-[600px] flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <p className="text-lg">회원 ID를 입력하여 트리를 조회하세요</p>
                <p className="text-sm">해당 회원을 루트로 하위 추천 구조가 표시됩니다</p>
              </div>
            </div>
          ) : loading ? (
            <div className="h-[600px] flex items-center justify-center text-muted-foreground">로딩 중...</div>
          ) : !treeData ? (
            <div className="h-[600px] flex items-center justify-center text-muted-foreground">트리 데이터가 없습니다</div>
          ) : (
            <div className="h-[600px] w-full">
              <Tree
                data={treeData}
                orientation="vertical"
                pathFunc="step"
                translate={{ x: 400, y: 60 }}
                separation={{ siblings: 1.5, nonSiblings: 2 }}
                nodeSize={{ x: 180, y: 120 }}
                renderCustomNodeElement={(rd3tProps: any) => renderNodeLabel(rd3tProps)}
                onNodeClick={(node: any) => {
                  const raw = node.data?._raw;
                  if (raw?.id) router.push(`/dashboard/users/${raw.id}`);
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
