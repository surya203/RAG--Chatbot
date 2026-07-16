"""Add mock exams and attempts for Phase 6.

Revision ID: 012
Revises: 011
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mock_exams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("exam", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("mode", sa.String(length=20), nullable=False, server_default="full"),
        sa.Column("total_time_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column(
            "reading_passage_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reading_passages.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "listening_exercise_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("listening_exercises.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "writing_prompt_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("writing_prompts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "speaking_prompt_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("speaking_prompts.id", ondelete="SET NULL"),
            nullable=True,
        ),
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
    op.create_index("ix_mock_exams_exam", "mock_exams", ["exam"])
    op.create_index("ix_mock_exams_is_published", "mock_exams", ["is_published"])

    op.create_table(
        "mock_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "mock_exam_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("mock_exams.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("exam", sa.String(length=40), nullable=False),
        sa.Column("mock_title", sa.String(length=255), nullable=False),
        sa.Column("reading_answers", postgresql.JSONB(), nullable=True),
        sa.Column("listening_answers", postgresql.JSONB(), nullable=True),
        sa.Column("writing_essay", sa.Text(), nullable=True),
        sa.Column("speaking_transcript", sa.Text(), nullable=True),
        sa.Column("reading_score", sa.Integer(), nullable=True),
        sa.Column("reading_total", sa.Integer(), nullable=True),
        sa.Column("reading_percentage", sa.Float(), nullable=True),
        sa.Column("listening_score", sa.Integer(), nullable=True),
        sa.Column("listening_total", sa.Integer(), nullable=True),
        sa.Column("listening_percentage", sa.Float(), nullable=True),
        sa.Column("writing_band", sa.Float(), nullable=True),
        sa.Column("speaking_band", sa.Float(), nullable=True),
        sa.Column("section_results", postgresql.JSONB(), nullable=True),
        sa.Column("weak_topics", postgresql.JSONB(), nullable=True),
        sa.Column("overall_band", sa.Float(), nullable=True),
        sa.Column("overall_percentage", sa.Float(), nullable=True),
        sa.Column("points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("time_spent_seconds", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_mock_attempts_user_id", "mock_attempts", ["user_id"])
    op.create_index("ix_mock_attempts_mock_exam_id", "mock_attempts", ["mock_exam_id"])
    op.create_index("ix_mock_attempts_exam", "mock_attempts", ["exam"])


def downgrade() -> None:
    op.drop_table("mock_attempts")
    op.drop_table("mock_exams")
