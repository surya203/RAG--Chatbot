"""Add status and source_text to generation_sources for stepwise generate.

Revision ID: 016
Revises: 015
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "generation_sources",
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="ready",
        ),
    )
    op.add_column(
        "generation_sources",
        sa.Column("source_text", sa.Text(), nullable=True),
    )
    op.create_index("ix_generation_sources_status", "generation_sources", ["status"])


def downgrade() -> None:
    op.drop_index("ix_generation_sources_status", table_name="generation_sources")
    op.drop_column("generation_sources", "source_text")
    op.drop_column("generation_sources", "status")
