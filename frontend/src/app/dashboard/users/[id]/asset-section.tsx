'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Wallet, Star, TrendingUp, TrendingDown } from 'lucide-react';

function formatUSDT(amount: number): string {
  return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDT';
}

type Props = {
  balance: number;
  points: number;
  totalDeposit: number;
  totalWithdrawal: number;
};

export default function AssetSection({ balance, points, totalDeposit, totalWithdrawal }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400"><Wallet className="h-4 w-4" />잔액</div>
          <p className="text-2xl font-bold mt-1 text-blue-700 dark:text-blue-300">{formatUSDT(balance)}</p>
        </CardContent>
      </Card>
      <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400"><Star className="h-4 w-4" />포인트</div>
          <p className="text-2xl font-bold mt-1 text-purple-700 dark:text-purple-300">{formatUSDT(points)}</p>
        </CardContent>
      </Card>
      <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"><TrendingUp className="h-4 w-4" />총 입금액</div>
          <p className="text-2xl font-bold mt-1 text-green-700 dark:text-green-300">{formatUSDT(totalDeposit)}</p>
        </CardContent>
      </Card>
      <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"><TrendingDown className="h-4 w-4" />총 출금액</div>
          <p className="text-2xl font-bold mt-1 text-red-700 dark:text-red-300">{formatUSDT(totalWithdrawal)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
