"""Tests for native JWT authentication and authorization."""

from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

from shared import security
from shared.config import settings


def _token(**claims):
    payload = {
        "sub": "user-1",
        "email": "user@example.com",
        "company_id": "company-1",
        "role": "admin",
        "full_name": "Test User",
        "store_id": None,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        **claims,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@pytest.fixture
def fake_db(monkeypatch, fake_client):
    monkeypatch.setattr(security, "get_db", lambda *_args: fake_client)
    return fake_client


class TestExtractBearerToken:
    def test_extracts_bearer_token(self):
        assert security._extract_bearer_token("Bearer abc123") == "abc123"

    @pytest.mark.parametrize("header", [None, "", "abc123", "Bearer "])
    def test_rejects_missing_or_malformed_header(self, header):
        with pytest.raises(HTTPException) as exc:
            security._extract_bearer_token(header)
        assert exc.value.status_code == 401


class TestGetCurrentUser:
    async def test_loads_native_jwt_claims_and_service_database(self, fake_db):
        user = await security.get_current_user(f"Bearer {_token()}")
        assert user.id == "user-1"
        assert user.email == "user@example.com"
        assert user.company_id == "company-1"
        assert user.role == "admin"
        assert user.client is fake_db

    async def test_rejects_invalid_jwt(self, fake_db):
        with pytest.raises(HTTPException) as exc:
            await security.get_current_user("Bearer invalid-token")
        assert exc.value.status_code == 401

    async def test_requires_company(self, fake_db):
        with pytest.raises(HTTPException) as exc:
            await security.get_current_user_with_company(
                f"Bearer {_token(company_id=None)}"
            )
        assert exc.value.status_code == 403

    async def test_requires_admin_role(self, fake_db):
        with pytest.raises(HTTPException) as exc:
            await security.require_admin(f"Bearer {_token(role='operador')}")
        assert exc.value.status_code == 403

    async def test_accepts_admin(self, fake_db):
        user = await security.require_admin(f"Bearer {_token()}")
        assert user.role == "admin"
