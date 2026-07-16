"""Add speaking prompts and attempts for Phase 2.

Revision ID: 008
Revises: 007
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "speaking_prompts",
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
        sa.Column("cue_points", sa.Text(), nullable=True),
        sa.Column("model_answer", sa.Text(), nullable=True),
        sa.Column("topic", sa.String(length=120), nullable=True),
        sa.Column("prep_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("speak_seconds", sa.Integer(), nullable=False, server_default="120"),
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
    op.create_index("ix_speaking_prompts_exam", "speaking_prompts", ["exam"])
    op.create_index("ix_speaking_prompts_published", "speaking_prompts", ["is_published"])

    op.create_table(
        "speaking_attempts",
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
            sa.ForeignKey("speaking_prompts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("exam", sa.String(length=40), nullable=False),
        sa.Column("task_type", sa.String(length=60), nullable=False),
        sa.Column("prompt_text", sa.Text(), nullable=False),
        sa.Column("transcript", sa.Text(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("overall_band", sa.Float(), nullable=True),
        sa.Column("feedback", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_speaking_attempts_user_id", "speaking_attempts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_speaking_attempts_user_id", table_name="speaking_attempts")
    op.drop_table("speaking_attempts")
    op.drop_index("ix_speaking_prompts_published", table_name="speaking_prompts")
    op.drop_index("ix_speaking_prompts_exam", table_name="speaking_prompts")
    op.drop_table("speaking_prompts")
