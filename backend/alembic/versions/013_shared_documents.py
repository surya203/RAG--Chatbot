"""Add is_shared flag for admin-uploaded study materials.

Revision ID: 013
Revises: 012
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column(
            "is_shared",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index("ix_documents_is_shared", "documents", ["is_shared"])


def downgrade() -> None:
    op.drop_index("ix_documents_is_shared", table_name="documents")
    op.drop_column("documents", "is_shared")
