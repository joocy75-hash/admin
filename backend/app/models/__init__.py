# Import all models so Alembic can discover them via SQLModel.metadata
from app.models.admin_user import AdminUser, AdminUserTree  # noqa: F401
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
from app.models.user_bank_account import UserBankAccount  # noqa: F401
from app.models.user_betting_permission import UserBettingPermission  # noqa: F401
from app.models.user_game_rolling_rate import UserGameRollingRate  # noqa: F401
from app.models.user_login_history import UserLoginHistory  # noqa: F401
from app.models.user_null_betting_config import UserNullBettingConfig  # noqa: F401
