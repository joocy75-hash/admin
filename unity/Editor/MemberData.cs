using System;
using System.Collections.Generic;

namespace AdminPanel.Editor
{
    public enum MemberRank
    {
        Agency,      // 대리점
        Distributor, // 총판
        SubHQ        // 부본사
    }

    public enum MemberStatus
    {
        Active,
        Suspended,
        Banned
    }

    [Serializable]
    public class MemberData
    {
        public int Id;
        public string Username;
        public string RealName;
        public string Phone;
        public MemberRank Rank;
        public MemberStatus Status;
        public long Balance;
        public int Points;
        public int DirectReferralCount;
        public DateTime CreatedAt;

        public int ParentId; // -1 = root (no parent)
        public List<MemberData> Children = new List<MemberData>();

        public MemberData(
            int id,
            string username,
            string realName,
            string phone,
            MemberRank rank,
            MemberStatus status,
            long balance,
            int points,
            int parentId,
            DateTime createdAt)
        {
            Id = id;
            Username = username;
            RealName = realName;
            Phone = phone;
            Rank = rank;
            Status = status;
            Balance = balance;
            Points = points;
            ParentId = parentId;
            DirectReferralCount = 0;
            CreatedAt = createdAt;
        }

        public string RankLabel => Rank switch
        {
            MemberRank.SubHQ => "부본사",
            MemberRank.Distributor => "총판",
            MemberRank.Agency => "대리점",
            _ => "Unknown"
        };

        public string StatusLabel => Status switch
        {
            MemberStatus.Active => "활성",
            MemberStatus.Suspended => "정지",
            MemberStatus.Banned => "차단",
            _ => "Unknown"
        };
    }

    public static class MemberSampleData
    {
        public static List<MemberData> CreateSampleTree()
        {
            var now = DateTime.Now;
            var members = new List<MemberData>
            {
                new(1, "master01", "김본사", "010-1111-0001", MemberRank.SubHQ, MemberStatus.Active, 15000000, 3200, -1, now.AddDays(-120)),
                new(2, "dist_kim", "이총판", "010-2222-0002", MemberRank.Distributor, MemberStatus.Active, 8500000, 1800, 1, now.AddDays(-90)),
                new(3, "dist_park", "박총판", "010-3333-0003", MemberRank.Distributor, MemberStatus.Active, 6200000, 1200, 1, now.AddDays(-85)),
                new(4, "agent_a", "최대리A", "010-4444-0004", MemberRank.Agency, MemberStatus.Active, 2100000, 450, 2, now.AddDays(-60)),
                new(5, "agent_b", "정대리B", "010-5555-0005", MemberRank.Agency, MemberStatus.Active, 1800000, 320, 2, now.AddDays(-55)),
                new(6, "agent_c", "한대리C", "010-6666-0006", MemberRank.Agency, MemberStatus.Suspended, 900000, 150, 3, now.AddDays(-50)),
                new(7, "agent_d", "윤대리D", "010-7777-0007", MemberRank.Agency, MemberStatus.Active, 3200000, 680, 3, now.AddDays(-45)),
                new(8, "sub_lee", "이부본", "010-8888-0008", MemberRank.SubHQ, MemberStatus.Active, 22000000, 5100, -1, now.AddDays(-150)),
                new(9, "dist_cho", "조총판", "010-9999-0009", MemberRank.Distributor, MemberStatus.Active, 4800000, 900, 8, now.AddDays(-70)),
                new(10, "agent_e", "강대리E", "010-1010-0010", MemberRank.Agency, MemberStatus.Banned, 0, 0, 9, now.AddDays(-30)),
                new(11, "agent_f", "송대리F", "010-1111-0011", MemberRank.Agency, MemberStatus.Active, 1500000, 280, 9, now.AddDays(-25)),
                new(12, "agent_sub1", "임하위1", "010-1212-0012", MemberRank.Agency, MemberStatus.Active, 500000, 80, 4, now.AddDays(-20)),
                new(13, "agent_sub2", "오하위2", "010-1313-0013", MemberRank.Agency, MemberStatus.Active, 750000, 120, 4, now.AddDays(-15)),
            };

            return BuildTree(members);
        }

        public static List<MemberData> BuildTree(List<MemberData> flat)
        {
            var lookup = new Dictionary<int, MemberData>();
            foreach (var m in flat)
                lookup[m.Id] = m;

            var roots = new List<MemberData>();
            foreach (var m in flat)
            {
                if (m.ParentId < 0 || !lookup.ContainsKey(m.ParentId))
                {
                    roots.Add(m);
                }
                else
                {
                    lookup[m.ParentId].Children.Add(m);
                    lookup[m.ParentId].DirectReferralCount++;
                }
            }

            return roots;
        }
    }
}
