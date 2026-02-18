'use client';

import { useParams } from 'next/navigation';
import { UserDetailContent } from '@/components/user-detail-content';

export default function UserDetailPage() {
  const params = useParams();
  const userId = Number(params.id);

  return (
    <div className="space-y-6">
      <UserDetailContent userId={userId} />
    </div>
  );
}
