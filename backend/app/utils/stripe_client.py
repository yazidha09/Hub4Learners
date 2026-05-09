"""Thin Stripe wrapper. Reads keys from env at first use so the boot
sequence can warn (but not crash) when keys are missing."""
import os
from typing import Optional

import stripe

_initialized = False


def _init() -> bool:
    """Configure the Stripe SDK from env. Returns True if a secret key is present."""
    global _initialized
    if _initialized:
        return bool(stripe.api_key)
    secret = os.getenv("Stripe_secret_key") or os.getenv("STRIPE_SECRET_KEY")
    if secret:
        stripe.api_key = secret
    _initialized = True
    return bool(stripe.api_key)


def get_publishable_key() -> Optional[str]:
    return os.getenv("Stripe_publishable_key") or os.getenv("STRIPE_PUBLISHABLE_KEY")


def create_checkout_session(
    *,
    course_id: str,
    course_title: str,
    course_thumbnail_url: Optional[str],
    price_usd: float,
    student_id: str,
    student_email: Optional[str],
    success_url: str,
    cancel_url: str,
):
    if not _init():
        raise RuntimeError("Stripe secret key is not configured. Set Stripe_secret_key in backend/.env")

    images = [course_thumbnail_url] if course_thumbnail_url else []
    amount_cents = int(round(price_usd * 100))
    session = stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "usd",
                "unit_amount": amount_cents,
                "product_data": {
                    "name": course_title,
                    "images": images,
                },
            },
            "quantity": 1,
        }],
        customer_email=student_email,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "course_id": course_id,
            "student_id": student_id,
        },
    )
    return session


def retrieve_session(session_id: str):
    if not _init():
        raise RuntimeError("Stripe secret key is not configured. Set Stripe_secret_key in backend/.env")
    return stripe.checkout.Session.retrieve(session_id)
