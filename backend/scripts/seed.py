"""Seed script: creates super_admin, default roles, and permissions."""

import sys
from pathlib import Path

# Ensure project root is on PYTHONPATH
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import bcrypt
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import create_engine, text
from sqlmodel import Session

from app.config import settings
from app.models.admin_user import AdminUser, AdminUserTree
from app.models.bet_record import BetRecord
from app.models.inquiry import Inquiry, InquiryReply
from app.models.message import Message
from app.models.money_log import MoneyLog
from app.models.point_log import PointLog
from app.models.role import AdminUserRole, Permission, Role, RolePermission
from app.models.user import User, UserTree
from app.models.user_wallet_address import UserWalletAddress
from app.models.user_betting_permission import UserBettingPermission
from app.models.user_game_rolling_rate import UserGameRollingRate
from app.models.user_login_history import UserLoginHistory
from app.models.user_null_betting_config import UserNullBettingConfig
from app.models.vip_level import VipLevel
from app.models.transaction_limit import TransactionLimit
from app.models.betting_limit import BettingLimit
from app.models.promotion import Promotion


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

ROLES = [
    {"name": "super_admin", "guard": "admin", "description": "Full system access", "is_system": True},
    {"name": "admin", "guard": "admin", "description": "Administrative access", "is_system": True},
    {"name": "teacher", "guard": "admin", "description": "Top-level agent", "is_system": False},
    {"name": "sub_hq", "guard": "admin", "description": "Sub headquarters", "is_system": False},
    {"name": "agent", "guard": "admin", "description": "Agent", "is_system": False},
    {"name": "sub_agent", "guard": "admin", "description": "Sub agent", "is_system": False},
]

PERMISSION_MODULES = {
    "dashboard": ["view"],
    "agents": ["view", "create", "update", "delete", "tree"],
    "users": ["view", "create", "update", "delete", "balance"],
    "commission": ["view", "create", "update", "delete", "settle"],
    "settlement": ["view", "create", "confirm", "reject", "pay"],
    "transaction": ["view", "create", "approve", "reject", "export"],
    "game": ["view", "create", "update", "delete"],
    "game_provider": ["view", "create", "update", "delete"],
    "report": ["view", "export"],
    "audit_log": ["view", "export"],
    "setting": ["view", "update"],
    "announcement": ["view", "create", "update", "delete"],
    "role": ["view", "create", "update", "delete", "assign"],
    "fraud": ["view", "update"],
    "monitoring": ["view"],
    "notification": ["view"],
    "partner": ["view"],
}

GAME_CATEGORIES = ["casino", "slot", "holdem", "sports", "shooting", "coin", "minigame"]


def seed():
    engine = create_engine(settings.DATABASE_URL_SYNC, echo=False)

    with Session(engine) as session:
        # Check if already seeded
        existing = session.exec(
            text("SELECT count(*) FROM admin_users")
        ).scalar()
        if existing and existing > 0:
            print(f"DB already has {existing} admin users. Skipping seed.")
            return

        # 1. Create roles
        role_map = {}
        for r in ROLES:
            role = Role(**r)
            session.add(role)
            session.flush()
            role_map[r["name"]] = role.id
            print(f"  Role: {r['name']} (id={role.id})")

        # 2. Create permissions
        perm_ids = []
        for module, actions in PERMISSION_MODULES.items():
            for action in actions:
                perm = Permission(
                    name=f"{module}.{action}",
                    module=module,
                    guard="admin",
                    description=f"{action} {module}",
                )
                session.add(perm)
                session.flush()
                perm_ids.append(perm.id)

        print(f"  Permissions: {len(perm_ids)} created")

        # 3. Assign all permissions to super_admin role
        for pid in perm_ids:
            session.add(RolePermission(role_id=role_map["super_admin"], permission_id=pid))

        # 4. Assign subset to admin role (exclude role management)
        for pid in perm_ids:
            perm = session.get(Permission, pid)
            if perm and perm.module != "role":
                session.add(RolePermission(role_id=role_map["admin"], permission_id=pid))

        # 5. Create super_admin user
        admin = AdminUser(
            username="superadmin",
            email="admin@admin-panel.local",
            password_hash=hash_password("admin1234!"),
            role="super_admin",
            parent_id=None,
            depth=0,
            agent_code="SA0001",
            status="active",
        )
        session.add(admin)
        session.flush()
        print(f"  SuperAdmin: id={admin.id}, username=superadmin")

        # 6. Assign super_admin role
        session.add(AdminUserRole(admin_user_id=admin.id, role_id=role_map["super_admin"]))

        # 7. Closure table self-reference
        session.add(AdminUserTree(ancestor_id=admin.id, descendant_id=admin.id, depth=0))

        # 8. Create sample users
        now = datetime.now(timezone.utc)
        user1 = User(
            username="testuser1",
            nickname="tester1",
            real_name="Kim Cheolsu",
            phone="010-1234-5678",
            email="testuser1@example.com",
            password_hash=hash_password("user1234!"),
            registration_ip="192.168.1.100",
            balance=Decimal("500000"),
            points=Decimal("15000"),
            total_deposit=Decimal("2000000"),
            total_withdrawal=Decimal("500000"),
            total_bet=Decimal("3500000"),
            total_win=Decimal("3200000"),
            login_count=42,
            last_login_at=now - timedelta(hours=2),
            last_login_ip="192.168.1.100",
            last_deposit_at=now - timedelta(days=1),
            last_bet_at=now - timedelta(hours=3),
            status="active",
            level=3,
        )
        user2 = User(
            username="testuser2",
            nickname="tester2",
            real_name="Lee Younghee",
            phone="010-9876-5432",
            email="testuser2@example.com",
            password_hash=hash_password("user1234!"),
            registration_ip="10.0.0.55",
            balance=Decimal("120000"),
            points=Decimal("3000"),
            total_deposit=Decimal("800000"),
            total_withdrawal=Decimal("200000"),
            total_bet=Decimal("1200000"),
            total_win=Decimal("900000"),
            login_count=15,
            last_login_at=now - timedelta(days=1),
            last_login_ip="10.0.0.55",
            last_deposit_at=now - timedelta(days=3),
            last_bet_at=now - timedelta(days=1),
            status="active",
            level=2,
        )
        session.add(user1)
        session.add(user2)
        session.flush()
        print(f"  User: id={user1.id}, username=testuser1")
        print(f"  User: id={user2.id}, username=testuser2")

        # User tree self-references
        session.add(UserTree(ancestor_id=user1.id, descendant_id=user1.id, depth=0))
        session.add(UserTree(ancestor_id=user2.id, descendant_id=user2.id, depth=0))

        # 9. Login history
        login_records = [
            UserLoginHistory(user_id=user1.id, login_ip="192.168.1.100", user_agent="Mozilla/5.0 Chrome/120", device_type="web", os="Windows 11", browser="Chrome", country="KR", city="Seoul", login_at=now - timedelta(hours=2)),
            UserLoginHistory(user_id=user1.id, login_ip="192.168.1.100", user_agent="Mozilla/5.0 Chrome/120", device_type="web", os="Windows 11", browser="Chrome", country="KR", city="Seoul", login_at=now - timedelta(days=1), logout_at=now - timedelta(days=1) + timedelta(hours=3)),
            UserLoginHistory(user_id=user1.id, login_ip="10.0.0.1", user_agent="Mozilla/5.0 Safari/17", device_type="mobile", os="iOS 17", browser="Safari", country="KR", city="Busan", login_at=now - timedelta(days=3), logout_at=now - timedelta(days=3) + timedelta(hours=1)),
            UserLoginHistory(user_id=user2.id, login_ip="10.0.0.55", user_agent="Mozilla/5.0 Chrome/120", device_type="web", os="macOS 14", browser="Chrome", country="KR", city="Seoul", login_at=now - timedelta(days=1)),
            UserLoginHistory(user_id=user2.id, login_ip="172.16.0.10", user_agent="Mozilla/5.0 Firefox/121", device_type="tablet", os="Android 14", browser="Firefox", country="KR", city="Incheon", login_at=now - timedelta(days=5), logout_at=now - timedelta(days=5) + timedelta(hours=2)),
        ]
        for lr in login_records:
            session.add(lr)

        # 10. Wallet addresses (crypto)
        session.add(UserWalletAddress(user_id=user1.id, coin_type="USDT", network="TRC20", address="TN7hAk3VrFQmPzYYBMNiXLmRbwYdEj4k7p", label="메인 지갑", is_primary=True, status="active"))
        session.add(UserWalletAddress(user_id=user1.id, coin_type="ETH", network="ERC20", address="0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18", label="ETH 지갑", is_primary=False, status="active"))
        session.add(UserWalletAddress(user_id=user2.id, coin_type="USDT", network="TRC20", address="TPYmHEhy5n8TCEfYGqW2rPxsghSfzghPDn", label="기본 지갑", is_primary=True, status="active"))

        # 11. Betting permissions (all categories for user1)
        for cat in GAME_CATEGORIES:
            session.add(UserBettingPermission(user_id=user1.id, game_category=cat, is_allowed=True))
            session.add(UserBettingPermission(user_id=user2.id, game_category=cat, is_allowed=cat != "shooting"))

        # 12. Null betting configs
        session.add(UserNullBettingConfig(user_id=user1.id, game_category="casino", every_n_bets=0, inherit_to_children=False))
        session.add(UserNullBettingConfig(user_id=user1.id, game_category="slot", every_n_bets=0, inherit_to_children=False))

        # 13. Game rolling rates
        rolling_rates = [
            (user1.id, "casino", None, Decimal("0.50")),
            (user1.id, "slot", None, Decimal("0.30")),
            (user1.id, "holdem", "revolution", Decimal("0.40")),
            (user1.id, "holdem", "skycity", Decimal("0.35")),
            (user1.id, "sports", None, Decimal("0.20")),
            (user2.id, "casino", None, Decimal("0.40")),
            (user2.id, "slot", None, Decimal("0.25")),
        ]
        for uid, cat, prov, rate in rolling_rates:
            session.add(UserGameRollingRate(user_id=uid, game_category=cat, provider=prov, rolling_rate=rate))

        # 14. Bet records
        bet_records = [
            BetRecord(user_id=user1.id, game_category="casino", provider="evolution", game_name="Lightning Roulette", round_id="EVL-20260218-001", bet_amount=Decimal("50000"), win_amount=Decimal("120000"), profit=Decimal("70000"), status="settled", bet_at=now - timedelta(hours=3), settled_at=now - timedelta(hours=3) + timedelta(minutes=2)),
            BetRecord(user_id=user1.id, game_category="casino", provider="evolution", game_name="Blackjack VIP", round_id="EVL-20260218-002", bet_amount=Decimal("100000"), win_amount=Decimal("0"), profit=Decimal("-100000"), status="settled", bet_at=now - timedelta(hours=4), settled_at=now - timedelta(hours=4) + timedelta(minutes=5)),
            BetRecord(user_id=user1.id, game_category="slot", provider="pragmatic", game_name="Gates of Olympus", round_id="PG-20260218-001", bet_amount=Decimal("10000"), win_amount=Decimal("45000"), profit=Decimal("35000"), status="settled", bet_at=now - timedelta(hours=5), settled_at=now - timedelta(hours=5) + timedelta(seconds=30)),
            BetRecord(user_id=user1.id, game_category="holdem", provider="revolution", game_name="Texas Holdem", round_id="REV-20260218-001", bet_amount=Decimal("200000"), win_amount=Decimal("380000"), profit=Decimal("180000"), status="settled", bet_at=now - timedelta(days=1), settled_at=now - timedelta(days=1) + timedelta(minutes=15)),
            BetRecord(user_id=user1.id, game_category="sports", game_name="EPL Match", round_id="SPT-20260218-001", bet_amount=Decimal("30000"), win_amount=Decimal("0"), profit=Decimal("-30000"), status="settled", bet_at=now - timedelta(days=2), settled_at=now - timedelta(days=2) + timedelta(hours=2)),
            BetRecord(user_id=user2.id, game_category="casino", provider="evolution", game_name="Baccarat", round_id="EVL-20260218-003", bet_amount=Decimal("20000"), win_amount=Decimal("38000"), profit=Decimal("18000"), status="settled", bet_at=now - timedelta(days=1), settled_at=now - timedelta(days=1) + timedelta(minutes=1)),
            BetRecord(user_id=user2.id, game_category="slot", provider="habanero", game_name="Hot Hot Fruit", round_id="HAB-20260218-001", bet_amount=Decimal("5000"), win_amount=Decimal("0"), profit=Decimal("-5000"), status="settled", bet_at=now - timedelta(days=1), settled_at=now - timedelta(days=1) + timedelta(seconds=20)),
            BetRecord(user_id=user1.id, game_category="casino", provider="evolution", game_name="Crazy Time", round_id="EVL-20260218-004", bet_amount=Decimal("25000"), win_amount=Decimal("0"), profit=Decimal("0"), status="pending", bet_at=now - timedelta(minutes=10)),
        ]
        for br in bet_records:
            session.add(br)

        # 15. Money logs
        money_logs = [
            MoneyLog(user_id=user1.id, type="deposit", amount=Decimal("1000000"), balance_before=Decimal("0"), balance_after=Decimal("1000000"), description="First deposit"),
            MoneyLog(user_id=user1.id, type="game_start", amount=Decimal("-50000"), balance_before=Decimal("1000000"), balance_after=Decimal("950000"), description="Casino bet"),
            MoneyLog(user_id=user1.id, type="game_end", amount=Decimal("120000"), balance_before=Decimal("950000"), balance_after=Decimal("1070000"), description="Casino win"),
            MoneyLog(user_id=user1.id, type="withdrawal", amount=Decimal("-500000"), balance_before=Decimal("1070000"), balance_after=Decimal("570000"), description="Withdrawal request"),
            MoneyLog(user_id=user1.id, type="deposit", amount=Decimal("1000000"), balance_before=Decimal("570000"), balance_after=Decimal("1570000"), description="Second deposit"),
            MoneyLog(user_id=user2.id, type="deposit", amount=Decimal("500000"), balance_before=Decimal("0"), balance_after=Decimal("500000"), description="First deposit"),
            MoneyLog(user_id=user2.id, type="game_start", amount=Decimal("-20000"), balance_before=Decimal("500000"), balance_after=Decimal("480000"), description="Casino bet"),
            MoneyLog(user_id=user2.id, type="game_end", amount=Decimal("38000"), balance_before=Decimal("480000"), balance_after=Decimal("518000"), description="Casino win"),
            MoneyLog(user_id=user2.id, type="withdrawal", amount=Decimal("-200000"), balance_before=Decimal("518000"), balance_after=Decimal("318000"), description="Withdrawal"),
            MoneyLog(user_id=user2.id, type="deposit", amount=Decimal("300000"), balance_before=Decimal("318000"), balance_after=Decimal("618000"), description="Second deposit"),
        ]
        for i, ml in enumerate(money_logs):
            ml.created_at = now - timedelta(days=10) + timedelta(days=i)
            session.add(ml)

        # 16. Point logs
        point_logs = [
            PointLog(user_id=user1.id, type="rolling", amount=Decimal("5000"), balance_before=Decimal("0"), balance_after=Decimal("5000"), description="Casino rolling commission"),
            PointLog(user_id=user1.id, type="rolling", amount=Decimal("3000"), balance_before=Decimal("5000"), balance_after=Decimal("8000"), description="Slot rolling commission"),
            PointLog(user_id=user1.id, type="attendance", amount=Decimal("1000"), balance_before=Decimal("8000"), balance_after=Decimal("9000"), description="Daily attendance"),
            PointLog(user_id=user1.id, type="convert", amount=Decimal("-5000"), balance_before=Decimal("9000"), balance_after=Decimal("4000"), description="Point to cash conversion"),
            PointLog(user_id=user1.id, type="event", amount=Decimal("10000"), balance_before=Decimal("4000"), balance_after=Decimal("14000"), description="Welcome event bonus"),
            PointLog(user_id=user2.id, type="rolling", amount=Decimal("2000"), balance_before=Decimal("0"), balance_after=Decimal("2000"), description="Casino rolling commission"),
            PointLog(user_id=user2.id, type="attendance", amount=Decimal("1000"), balance_before=Decimal("2000"), balance_after=Decimal("3000"), description="Daily attendance"),
        ]
        for i, pl in enumerate(point_logs):
            pl.created_at = now - timedelta(days=7) + timedelta(days=i)
            session.add(pl)

        # 17. Inquiries
        inq1 = Inquiry(user_id=user1.id, title="Withdrawal delay", content="My withdrawal request from 3 days ago is still pending. Please check.", status="answered")
        session.add(inq1)
        session.flush()
        session.add(InquiryReply(inquiry_id=inq1.id, admin_user_id=admin.id, content="Your withdrawal has been processed. Please check your bank account."))

        inq2 = Inquiry(user_id=user2.id, title="Account verification", content="How can I verify my account for higher withdrawal limits?", status="pending")
        session.add(inq2)

        # 18. Messages
        session.add(Message(sender_type="admin", sender_id=admin.id, receiver_type="user", receiver_id=user1.id, title="Welcome bonus", content="Welcome! Your 10,000 point bonus has been applied.", is_read=True, read_at=now - timedelta(days=5)))
        session.add(Message(sender_type="user", sender_id=user1.id, receiver_type="admin", receiver_id=admin.id, title="Thank you", content="Thanks for the bonus!", is_read=True, read_at=now - timedelta(days=4)))

        # 19. VIP Levels
        vip_levels = [
            VipLevel(level=1, name="Bronze", min_total_deposit=Decimal("0"), min_total_bet=Decimal("0"), rolling_bonus_rate=Decimal("0.10"), losing_bonus_rate=Decimal("1.00"), deposit_limit_daily=Decimal("5000"), withdrawal_limit_daily=Decimal("3000"), withdrawal_limit_monthly=Decimal("50000"), max_single_bet=Decimal("500"), color="#CD7F32", icon="bronze", sort_order=1, is_active=True, created_at=now, updated_at=now),
            VipLevel(level=2, name="Silver", min_total_deposit=Decimal("1000"), min_total_bet=Decimal("5000"), rolling_bonus_rate=Decimal("0.20"), losing_bonus_rate=Decimal("2.00"), deposit_limit_daily=Decimal("10000"), withdrawal_limit_daily=Decimal("5000"), withdrawal_limit_monthly=Decimal("100000"), max_single_bet=Decimal("1000"), color="#C0C0C0", icon="silver", sort_order=2, is_active=True, created_at=now, updated_at=now),
            VipLevel(level=3, name="Gold", min_total_deposit=Decimal("5000"), min_total_bet=Decimal("25000"), rolling_bonus_rate=Decimal("0.30"), losing_bonus_rate=Decimal("3.00"), deposit_limit_daily=Decimal("50000"), withdrawal_limit_daily=Decimal("20000"), withdrawal_limit_monthly=Decimal("500000"), max_single_bet=Decimal("5000"), color="#FFD700", icon="gold", sort_order=3, is_active=True, created_at=now, updated_at=now),
            VipLevel(level=4, name="Platinum", min_total_deposit=Decimal("20000"), min_total_bet=Decimal("100000"), rolling_bonus_rate=Decimal("0.50"), losing_bonus_rate=Decimal("5.00"), deposit_limit_daily=Decimal("200000"), withdrawal_limit_daily=Decimal("100000"), withdrawal_limit_monthly=Decimal("2000000"), max_single_bet=Decimal("20000"), color="#E5E4E2", icon="platinum", sort_order=4, is_active=True, created_at=now, updated_at=now),
            VipLevel(level=5, name="Diamond", min_total_deposit=Decimal("100000"), min_total_bet=Decimal("500000"), rolling_bonus_rate=Decimal("1.00"), losing_bonus_rate=Decimal("10.00"), deposit_limit_daily=Decimal("1000000"), withdrawal_limit_daily=Decimal("500000"), withdrawal_limit_monthly=Decimal("10000000"), max_single_bet=Decimal("100000"), color="#B9F2FF", icon="diamond", sort_order=5, is_active=True, created_at=now, updated_at=now),
        ]
        for vl in vip_levels:
            session.add(vl)
        print(f"  VIP Levels: {len(vip_levels)} created")

        # 20. Default Transaction Limits (global)
        tx_limits = [
            TransactionLimit(scope_type="global", scope_id=0, tx_type="deposit", min_amount=Decimal("10"), max_amount=Decimal("100000"), daily_limit=Decimal("500000"), daily_count=10, monthly_limit=Decimal("5000000"), is_active=True, updated_at=now),
            TransactionLimit(scope_type="global", scope_id=0, tx_type="withdrawal", min_amount=Decimal("50"), max_amount=Decimal("50000"), daily_limit=Decimal("200000"), daily_count=5, monthly_limit=Decimal("2000000"), is_active=True, updated_at=now),
        ]
        for tl in tx_limits:
            session.add(tl)
        print(f"  Transaction Limits: {len(tx_limits)} created")

        # 21. Default Betting Limits (global)
        for cat in GAME_CATEGORIES:
            session.add(BettingLimit(scope_type="global", scope_id=0, game_category=cat, min_bet=Decimal("1"), max_bet=Decimal("10000"), max_daily_loss=Decimal("100000"), is_active=True, updated_at=now))
        print(f"  Betting Limits: {len(GAME_CATEGORIES)} created (global)")

        # 22. Sample Promotions
        promos = [
            Promotion(name="신규 가입 보너스", type="first_deposit", description="첫 입금 시 100% 보너스 지급", bonus_type="percent", bonus_value=Decimal("100"), min_deposit=Decimal("100"), max_bonus=Decimal("500"), wagering_multiplier=5, target="new_users", max_claims_per_user=1, is_active=True, priority=10, starts_at=now - timedelta(days=30), ends_at=now + timedelta(days=365), created_by=admin.id, created_at=now, updated_at=now),
            Promotion(name="재충전 보너스 20%", type="reload", description="재입금 시 20% 보너스", bonus_type="percent", bonus_value=Decimal("20"), min_deposit=Decimal("50"), max_bonus=Decimal("200"), wagering_multiplier=3, target="all", max_claims_per_user=0, is_active=True, priority=5, starts_at=now - timedelta(days=7), ends_at=now + timedelta(days=90), created_by=admin.id, created_at=now, updated_at=now),
            Promotion(name="주말 캐시백 10%", type="cashback", description="주말 순손실의 10% 캐시백", bonus_type="percent", bonus_value=Decimal("10"), max_bonus=Decimal("1000"), wagering_multiplier=1, target="all", max_claims_per_user=0, is_active=True, priority=3, starts_at=now - timedelta(days=14), created_by=admin.id, created_at=now, updated_at=now),
            Promotion(name="출석 체크 이벤트", type="attendance", description="매일 출석 시 포인트 지급", bonus_type="fixed", bonus_value=Decimal("10"), wagering_multiplier=1, target="all", max_claims_per_user=0, is_active=True, priority=1, created_by=admin.id, created_at=now, updated_at=now),
        ]
        for p in promos:
            session.add(p)
        print(f"  Promotions: {len(promos)} created")

        session.commit()
        print("\nSeed completed successfully!")
        print("  Login: superadmin / [see .env or deployment docs]")
        print("  Sample users: testuser1, testuser2")
        print("  VIP Levels: Bronze → Diamond (5 tiers)")
        print("  Promotions: 4 active")


if __name__ == "__main__":
    seed()
