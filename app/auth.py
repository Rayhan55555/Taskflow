"""Authentication & Cryptographic Security Module.

Enforces:
1. Bcrypt salted password hashing with adaptive work factor.
2. Cryptographic JWT signing using HS256 with strict claim verification.
3. FastAPI dependency for token extraction and active user validation.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import TokenPayload


# Password hashing configuration (bcrypt with work factor 12)
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,
)

# OAuth2 scheme for Swagger UI & Authorization header parsing
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=True,
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify that a plaintext candidate matches a bcrypt salted hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Compute secure bcrypt salted hash for a password."""
    return pwd_context.hash(password)


def create_access_token(
    user_id: uuid.UUID,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Issue a cryptographically signed JWT access token.
    
    Claims embedded:
    - sub: String representation of the user's UUID
    - exp: UTC expiration timestamp
    - iat: UTC issuance timestamp
    - type: Strict token type ("access")
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": str(user_id),
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
        "type": "access",
    }

    encoded_jwt = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI Dependency: Extract, decode, and authenticate current user from Bearer JWT.
    
    Validation Checks:
    1. Signature integrity and algorithm validation (HS256).
    2. Expiration timeframe check (PyJWT auto-checks 'exp').
    3. Token type check (must equal 'access').
    4. Subject UUID parsing.
    5. Database existence check for active user status.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        decoded_payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["exp", "sub", "iat"]},
        )
        token_data = TokenPayload(**decoded_payload)

        # Enforce token purpose
        if token_data.type != "access":
            raise credentials_exception

        user_uuid = uuid.UUID(token_data.sub)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (jwt.PyJWTError, ValueError):
        raise credentials_exception

    # Query user through privileged connection with explicit active check
    user = db.scalar(
        select(User).where(User.id == user_uuid, User.is_active.is_(True))
    )
    if user is None:
        raise credentials_exception

    return user
