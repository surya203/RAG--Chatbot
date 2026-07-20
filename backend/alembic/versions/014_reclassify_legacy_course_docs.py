"""Reclassify legacy student course uploads as admin shared library.

Revision ID: 014
Revises: 013
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Course subjects uploaded by students before admin/shared split.
LEGACY_COURSE_SUBJECTS = ("Professional Responsibility",)


def upgrade() -> None:
    conn = op.get_bind()

    admin_row = conn.execute(
        sa.text("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1")
    ).fetchone()
    if not admin_row:
        return
    admin_id = admin_row[0]

    student_ids = [
        row[0]
        for row in conn.execute(
            sa.text("SELECT id FROM users WHERE role = 'student'")
        ).fetchall()
    ]
    if not student_ids:
        return

    for subject in LEGACY_COURSE_SUBJECTS:
        legacy = conn.execute(
            sa.text(
                """
                SELECT id, original_name
                FROM documents
                WHERE user_id = ANY(:student_ids)
                  AND is_shared = false
                  AND subject = :subject
                """
            ),
            {"student_ids": student_ids, "subject": subject},
        ).fetchall()

        for doc_id, original_name in legacy:
            existing = conn.execute(
                sa.text(
                    """
                    SELECT id FROM documents
                    WHERE is_shared = true
                      AND original_name = :name
                    LIMIT 1
                    """
                ),
                {"name": original_name},
            ).fetchone()

            if existing:
                conn.execute(
                    sa.text("DELETE FROM documents WHERE id = :id"),
                    {"id": doc_id},
                )
            else:
                conn.execute(
                    sa.text(
                        """
                        UPDATE documents
                        SET is_shared = true, user_id = :admin_id
                        WHERE id = :id
                        """
                    ),
                    {"admin_id": admin_id, "id": doc_id},
                )


def downgrade() -> None:
    # Data migration — no safe automatic rollback.
    pass
