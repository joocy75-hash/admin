"""Notification templates for Telegram alerts."""

from decimal import Decimal

from app.services.telegram_service import notify


def notify_deposit_request(username: str, amount: Decimal, coin_type: str) -> None:
    notify(f"<b>입금 신청</b>\n회원: {username}\n금액: {amount} {coin_type}")


def notify_withdrawal_request(username: str, amount: Decimal, coin_type: str) -> None:
    notify(f"<b>출금 신청</b>\n회원: {username}\n금액: {amount} {coin_type}")


def notify_transaction_approved(tx_type: str, username: str, amount: Decimal, coin_type: str) -> None:
    label = "입금" if tx_type == "deposit" else "출금"
    notify(f"<b>{label} 승인</b>\n회원: {username}\n금액: {amount} {coin_type}")


def notify_transaction_rejected(tx_type: str, username: str, amount: Decimal, reason: str = "") -> None:
    label = "입금" if tx_type == "deposit" else "출금"
    msg = f"<b>{label} 거부</b>\n회원: {username}"
    if reason:
        msg += f"\n사유: {reason}"
    notify(msg)


def notify_large_transaction(tx_type: str, username: str, amount: Decimal, coin_type: str, threshold: Decimal = Decimal("10000")) -> None:
    if amount >= threshold:
        label = "입금" if tx_type == "deposit" else "출금"
        notify(f"<b>대규모 {label} 감지</b>\n회원: {username}\n금액: {amount} {coin_type}")


def notify_new_user(username: str) -> None:
    notify(f"<b>신규 회원 가입</b>\n아이디: {username}")
