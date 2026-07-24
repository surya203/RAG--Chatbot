"""Add generation_sources table for admin PDF → Generate history.

Revision ID: 015
Revises: 014
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "generation_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "uploaded_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("stored_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("exam", sa.String(length=40), nullable=False),
        sa.Column(
            "features",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "created_items",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("source_chars", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "errors",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_generation_sources_uploaded_by", "generation_sources", ["uploaded_by"]
    )
    op.create_index("ix_generation_sources_exam", "generation_sources", ["exam"])
    op.create_index(
        "ix_generation_sources_created_at", "generation_sources", ["created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_generation_sources_created_at", table_name="generation_sources")
    op.drop_index("ix_generation_sources_exam", table_name="generation_sources")
    op.drop_index("ix_generation_sources_uploaded_by", table_name="generation_sources")
    op.drop_table("generation_sources")
