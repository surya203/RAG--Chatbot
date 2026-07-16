"""Add roles, exam profiles, writing prompts and attempts.

Revision ID: 007
Revises: 006
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "role",
            sa.String(length=20),
            nullable=False,
            server_default="student",
        ),
    )

    op.create_table(
        "exam_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("target_exam", sa.String(length=40), nullable=False),
        sa.Column("target_score", sa.String(length=20), nullable=True),
        sa.Column("exam_date", sa.Date(), nullable=True),
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
    op.create_index("ix_exam_profiles_user_id", "exam_profiles", ["user_id"])

    op.create_table(
        "writing_prompts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("exam", sa.String(length=40), nullable=False),
        sa.Column("task_type", sa.String(length=60), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("prompt_text", sa.Text(), nullable=False),
        sa.Column("topic", sa.String(length=120), nullable=True),
        sa.Column("time_limit_minutes", sa.Integer(), nullable=False, server_default="40"),
        sa.Column("min_words", sa.Integer(), nullable=True),
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
    op.create_index("ix_writing_prompts_exam", "writing_prompts", ["exam"])
    op.create_index("ix_writing_prompts_published", "writing_prompts", ["is_published"])

    op.create_table(
        "writing_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "prompt_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("writing_prompts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("exam", sa.String(length=40), nullable=False),
        sa.Column("task_type", sa.String(length=60), nullable=False),
        sa.Column("prompt_text", sa.Text(), nullable=False),
        sa.Column("essay_text", sa.Text(), nullable=False),
        sa.Column("word_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("time_spent_seconds", sa.Integer(), nullable=True),
        sa.Column("overall_band", sa.Float(), nullable=True),
        sa.Column("feedback", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_writing_attempts_user_id", "writing_attempts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_writing_attempts_user_id", table_name="writing_attempts")
    op.drop_table("writing_attempts")
    op.drop_index("ix_writing_prompts_published", table_name="writing_prompts")
    op.drop_index("ix_writing_prompts_exam", table_name="writing_prompts")
    op.drop_table("writing_prompts")
    op.drop_index("ix_exam_profiles_user_id", table_name="exam_profiles")
    op.drop_table("exam_profiles")
    op.drop_column("users", "role")
