'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useGameRoundList, useGameList } from '@/hooks/use-games';

const RESULT_LABELS: Record<string, string> = {
  win: '승리', lose: '패배', draw: '무승부', push: '푸시',
};

export default function GameRoundsPage() {
  const [gameFilter, setGameFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: gamesData } = useGameList({ page_size: 100 });

  const { data, loading } = useGameRoundList({
    page,
    page_size: 20,
    game_id: gameFilter ? Number(gameFilter) : undefined,
    user_id: userFilter ? Number(userFilter) : undefined,
    result: resultFilter || undefined,
  });

  const totalBet = data?.items.reduce((sum, r) => sum + Number(r.bet_amount), 0) || 0;
  const totalWin = data?.items.reduce((sum, r) => sum + Number(r.win_amount), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">게임 라운드 조회</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">전체 게임 라운드 기록을 조회합니다.</p>
        </div>
        <Link href="/dashboard/games">
          <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800">
            게임 목록
          </button>
        </Link>
      </div>

      {/* Summary Cards */}
      {data && data.items.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-4 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">페이지 총 베팅금</p>
            <p className="text-xl font-bold mt-1">{totalBet.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-4 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">페이지 총 당첨금</p>
            <p className="text-xl font-bold mt-1">{totalWin.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-4 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">수익 (베팅-당첨)</p>
            <p className={`text-xl font-bold mt-1 ${totalBet - totalWin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(totalBet - totalWin).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={gameFilter}
          onChange={(e) => { setGameFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
        >
          <option value="">전체 게임</option>
          {gamesData?.items.map((g) => (
            <option key={g.id} value={g.id}>{g.name} ({g.code})</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="유저 ID"
          value={userFilter}
          onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm w-32 dark:bg-gray-900 dark:border-gray-700"
        />
        <select
          value={resultFilter}
          onChange={(e) => { setResultFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
        >
          <option value="">전체 결과</option>
          <option value="win">승리</option>
          <option value="lose">패배</option>
          <option value="draw">무승부</option>
          <option value="push">푸시</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">라운드 ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">게임</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">유저</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">베팅금</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">당첨금</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">결과</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">시작</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">종료</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {data?.items.map((round) => (
                <tr key={round.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">
                    {round.round_id}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {round.game_name ? (
                      <Link href={`/dashboard/games/${round.game_id}`} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                        {round.game_name}
                      </Link>
                    ) : (
                      <span className="text-gray-400">#{round.game_id}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {round.user_username ? (
                      <Link href={`/dashboard/users/${round.user_id}`} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                        {round.user_username}
                      </Link>
                    ) : (
                      <span className="text-gray-400">#{round.user_id}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono">
                    {Number(round.bet_amount).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono">
                    {Number(round.win_amount).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      round.result === 'win' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                      round.result === 'lose' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {RESULT_LABELS[round.result] || round.result}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {round.started_at ? new Date(round.started_at).toLocaleString('ko-KR') : '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {round.ended_at ? new Date(round.ended_at).toLocaleString('ko-KR') : '-'}
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    게임 라운드가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">전체: {data.total}건</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-700"
            >
              이전
            </button>
            <span className="px-3 py-1 text-sm">
              {data.page} / {Math.ceil(data.total / data.page_size)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(data.total / data.page_size)}
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-700"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
