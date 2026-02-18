# Import all models so Alembic can discover them via SQLModel.metadata
from app.models.admin_user import AdminUser, AdminUserTree  # noqa: F401
from app.models.agent_commission_rate import AgentCommissionRate  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.bet_record import BetRecord  # noqa: F401
from app.models.commission import (  # noqa: F401
    AgentCommissionOverride,
    CommissionLedger,
    CommissionPolicy,
)
from app.models.game import Game, GameProvider, GameRound  # noqa: F401
from app.models.inquiry import Inquiry, InquiryReply  # noqa: F401
from app.models.message import Message  # noqa: F401
from app.models.money_log import MoneyLog  # noqa: F401
from app.models.point_log import PointLog  # noqa: F401
from app.models.role import (  # noqa: F401
    AdminUserRole,
    Permission,
    Role,
    RolePermission,
)
from app.models.setting import AgentSalaryConfig, Announcement, Setting  # noqa: F401
from app.models.settlement import Settlement  # noqa: F401
from app.models.transaction import Transaction  # noqa: F401
from app.models.user import User, UserTree  # noqa: F401
from app.models.user_bank_account import UserBankAccount  # noqa: F401  # legacy, kept for migration
from app.models.user_wallet_address import UserWalletAddress  # noqa: F401
from app.models.user_betting_permission import UserBettingPermission  # noqa: F401
from app.models.user_game_rolling_rate import UserGameRollingRate  # noqa: F401
from app.models.user_login_history import UserLoginHistory  # noqa: F401
from app.models.user_null_betting_config import UserNullBettingConfig  # noqa: F401
from app.models.vip_level import VipLevel, UserLevelHistory  # noqa: F401
from app.models.transaction_limit import TransactionLimit  # noqa: F401
from app.models.betting_limit import BettingLimit  # noqa: F401
from app.models.promotion import Coupon, Promotion, UserCoupon, UserPromotion  # noqa: F401
from app.models.agent_salary_payment import AgentSalaryPayment  # noqa: F401
from app.models.notification import AdminNotification  # noqa: F401
from app.models.fraud_alert import FraudAlert, FraudRule  # noqa: F401
from app.models.ip_restriction import IpRestriction  # noqa: F401
from app.models.admin_memo import AdminMemo  # noqa: F401
from app.models.kyc_document import KycDocument  # noqa: F401
