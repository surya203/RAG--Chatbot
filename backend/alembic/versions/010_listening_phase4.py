"""Add listening exercises, questions, and attempts for Phase 4.

Revision ID: 010
Revises: 009
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "listening_exercises",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("exam", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("audio_filename", sa.String(length=255), nullable=False),
        sa.Column("audio_content_type", sa.String(length=80), nullable=False),
        sa.Column("transcript", sa.Text(), nullable=False),
        sa.Column("vocabulary", postgresql.JSONB(), nullable=True),
        sa.Column("topic", sa.String(length=120), nullable=True),
        sa.Column("difficulty", sa.String(length=20), nullable=False, server_default="medium"),
        sa.Column("time_limit_minutes", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("replay_limit", sa.Integer(), nullable=False, server_default="2"),
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
    op.create_index("ix_listening_exercises_exam", "listening_exercises", ["exam"])
    op.create_index("ix_listening_exercises_published", "listening_exercises", ["is_published"])

    op.create_table(
        "listening_questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "exercise_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("listening_exercises.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("question_type", sa.String(length=40), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("options", postgresql.JSONB(), nullable=True),
        sa.Column("correct_answer", sa.String(length=500), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
    )
    op.create_index("ix_listening_questions_exercise_id", "listening_questions", ["exercise_id"])

    op.create_table(
        "listening_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "exercise_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("listening_exercises.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("exam", sa.String(length=40), nullable=False),
        sa.Column("exercise_title", sa.String(length=255), nullable=False),
        sa.Column("answers", postgresql.JSONB(), nullable=False),
        sa.Column("results", postgresql.JSONB(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("percentage", sa.Float(), nullable=False, server_default="0"),
        sa.Column("replays_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("time_spent_seconds", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_listening_attempts_user_id", "listening_attempts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_listening_attempts_user_id", table_name="listening_attempts")
    op.drop_table("listening_attempts")
    op.drop_index("ix_listening_questions_exercise_id", table_name="listening_questions")
    op.drop_table("listening_questions")
    op.drop_index("ix_listening_exercises_published", table_name="listening_exercises")
    op.drop_index("ix_listening_exercises_exam", table_name="listening_exercises")
    op.drop_table("listening_exercises")
