"""Add vocabulary SRS cards and user progress for Phase 5.

Revision ID: 011
Revises: 010
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vocab_cards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("exam", sa.String(length=40), nullable=False),
        sa.Column("topic", sa.String(length=60), nullable=False, server_default="general"),
        sa.Column("word", sa.String(length=120), nullable=False),
        sa.Column("definition", sa.Text(), nullable=False),
        sa.Column("example_sentence", sa.Text(), nullable=True),
        sa.Column("collocations", postgresql.JSONB(), nullable=True),
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
    op.create_index("ix_vocab_cards_exam", "vocab_cards", ["exam"])
    op.create_index("ix_vocab_cards_topic", "vocab_cards", ["topic"])
    op.create_index("ix_vocab_cards_is_published", "vocab_cards", ["is_published"])

    op.create_table(
        "vocab_user_progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "card_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vocab_cards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ease_factor", sa.Float(), nullable=False, server_default="2.5"),
        sa.Column("interval_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("repetitions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="new"),
        sa.Column(
            "next_review_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_reviews", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("user_id", "card_id", name="uq_vocab_user_card"),
    )
    op.create_index("ix_vocab_user_progress_user_id", "vocab_user_progress", ["user_id"])
    op.create_index("ix_vocab_user_progress_card_id", "vocab_user_progress", ["card_id"])
    op.create_index(
        "ix_vocab_user_progress_next_review_at",
        "vocab_user_progress",
        ["next_review_at"],
    )


def downgrade() -> None:
    op.drop_table("vocab_user_progress")
    op.drop_table("vocab_cards")
