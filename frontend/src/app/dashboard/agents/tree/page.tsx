'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAgentTree } from '@/hooks/use-agents';
import { ArrowLeft, Search } from 'lucide-react';

// Dynamically import react-d3-tree (SSR incompatible)
const Tree = dynamic(() => import('react-d3-tree').then((m) => m.default), {
  ssr: false,
  loading: () => <div className="h-[600px] flex items-center justify-center text-muted-foreground">트리 로딩 중...</div>,
});

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#ef4444',
  admin: '#3b82f6',
  teacher: '#8b5cf6',
  sub_hq: '#f59e0b',
  agent: '#10b981',
  sub_agent: '#6b7280',
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'SA',
  admin: 'ADM',
  teacher: 'TCH',
  sub_hq: 'SHQ',
  agent: 'AGT',
  sub_agent: 'SAG',
};

type TreeNode = {
  name: string;
  attributes?: Record<string, string>;
  children?: TreeNode[];
  nodeSvgShape?: Record<string, unknown>;
  _raw?: { id: number; role: string; status: string };
};

export default function AgentTreePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rootParam = searchParams.get('root');

  const [rootId, setRootId] = useState<number>(rootParam ? parseInt(rootParam) : 1);
  const [rootInput, setRootInput] = useState(String(rootId));

  const { nodes, loading } = useAgentTree(rootId);

  const treeData = useMemo(() => {
    if (nodes.length === 0) return null;

    // Build tree from flat list
    const nodeMap = new Map<number, TreeNode>();
    for (const n of nodes) {
      nodeMap.set(n.id, {
        name: `${n.username}`,
        attributes: {
          code: n.agent_code,
          role: ROLE_LABELS[n.role] || n.role,
          bal: n.balance.toLocaleString(),
        },
        children: [],
        _raw: { id: n.id, role: n.role, status: n.status },
      });
    }

    let root: TreeNode | null = null;
    for (const n of nodes) {
      const node = nodeMap.get(n.id)!;
      if (n.parent_id && nodeMap.has(n.parent_id)) {
        nodeMap.get(n.parent_id)!.children!.push(node);
      } else if (n.id === rootId) {
        root = node;
      }
    }

    return root;
  }, [nodes, rootId]);

  const handleRootChange = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(rootInput);
    if (val > 0) setRootId(val);
  };

  const renderNodeLabel = ({ nodeDatum }: { nodeDatum: TreeNode }) => {
    const raw = nodeDatum._raw;
    const color = raw ? ROLE_COLORS[raw.role] || '#6b7280' : '#6b7280';
    const isInactive = raw?.status !== 'active';

    return (
      <g>
        <circle r={18} fill={color} opacity={isInactive ? 0.4 : 1} />
        <text
          fill="white"
          strokeWidth="0"
          fontSize="9"
          textAnchor="middle"
          dy="3"
          fontWeight="bold"
        >
          {nodeDatum.attributes?.role}
        </text>
        <text
          fill={isInactive ? '#9ca3af' : '#111827'}
          strokeWidth="0"
          fontSize="11"
          textAnchor="middle"
          dy="-28"
          fontWeight="600"
        >
          {nodeDatum.name}
        </text>
        <text
          fill="#6b7280"
          strokeWidth="0"
          fontSize="9"
          textAnchor="middle"
          dy="38"
        >
          {nodeDatum.attributes?.code}
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
            <h2 className="text-2xl font-bold tracking-tight">에이전트 트리</h2>
            <p className="text-muted-foreground">계층 구조 시각화</p>
          </div>
        </div>
        <form onSubmit={handleRootChange} className="flex gap-2">
          <Input
            type="number"
            min="1"
            className="w-32"
            value={rootInput}
            onChange={(e) => setRootInput(e.target.value)}
            placeholder="Root ID"
          />
          <Button type="submit" variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap">
        {Object.entries(ROLE_COLORS).map(([role, color]) => (
          <div key={role} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span>
              {
                {
                  super_admin: '슈퍼관리자',
                  admin: '관리자',
                  teacher: '총판',
                  sub_hq: '부본사',
                  agent: '에이전트',
                  sub_agent: '서브에이전트',
                }[role]
              }
            </span>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="h-[600px] flex items-center justify-center text-muted-foreground">
              로딩 중...
            </div>
          ) : !treeData ? (
            <div className="h-[600px] flex items-center justify-center text-muted-foreground">
              트리 데이터가 없습니다
            </div>
          ) : (
            <div className="h-[600px] w-full">
              <Tree
                data={treeData}
                orientation="vertical"
                pathFunc="step"
                translate={{ x: 400, y: 60 }}
                separation={{ siblings: 1.5, nonSiblings: 2 }}
                nodeSize={{ x: 160, y: 120 }}
                renderCustomNodeElement={(rd3tProps: any) => renderNodeLabel(rd3tProps)}
                onNodeClick={(node: any) => {
                  const raw = node.data?._raw;
                  if (raw?.id) {
                    router.push(`/dashboard/agents/${raw.id}`);
                  }
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
