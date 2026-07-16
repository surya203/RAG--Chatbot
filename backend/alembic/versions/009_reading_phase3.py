"""Add reading passages, questions, and attempts for Phase 3.

Revision ID: 009
Revises: 008
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reading_passages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("exam", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("passage_text", sa.Text(), nullable=False),
        sa.Column("topic", sa.String(length=120), nullable=True),
        sa.Column("difficulty", sa.String(length=20), nullable=False, server_default="medium"),
        sa.Column("time_limit_minutes", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("strategy_tip", sa.Text(), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_reading_passages_exam", "reading_passages", ["exam"])
    op.create_index("ix_reading_passages_published", "reading_passages", ["is_published"])

    op.create_table(
        "reading_questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "passage_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reading_passages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("question_type", sa.String(length=40), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("options", postgresql.JSONB(), nullable=True),
        sa.Column("correct_answer", sa.String(length=500), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
    )
    op.create_index("ix_reading_questions_passage_id", "reading_questions", ["passage_id"])

    op.create_table(
        "reading_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "passage_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reading_passages.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("exam", sa.String(length=40), nullable=False),
        sa.Column("passage_title", sa.String(length=255), nullable=False),
        sa.Column("answers", postgresql.JSONB(), nullable=False),
        sa.Column("results", postgresql.JSONB(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("percentage", sa.Float(), nullable=False, server_default="0"),
        sa.Column("time_spent_seconds", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_reading_attempts_user_id", "reading_attempts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_reading_attempts_user_id", table_name="reading_attempts")
    op.drop_table("reading_attempts")
    op.drop_index("ix_reading_questions_passage_id", table_name="reading_questions")
    op.drop_table("reading_questions")
    op.drop_index("ix_reading_passages_published", table_name="reading_passages")
    op.drop_index("ix_reading_passages_exam", table_name="reading_passages")
    op.drop_table("reading_passages")
