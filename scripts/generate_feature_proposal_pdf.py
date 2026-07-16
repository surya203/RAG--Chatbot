"""Generate manager-ready Exam Prep Chatbot feature proposal PDF."""

from datetime import date
import os

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY

OUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "Exam_Prep_Chatbot_Feature_Proposal.pdf",
)

PAGE_W, PAGE_H = A4
PRIMARY = HexColor("#0F3D5E")
ACCENT = HexColor("#1A6B8A")
LIGHT_BG = HexColor("#F0F5F8")
BORDER = HexColor("#D0DCE5")
TEXT = HexColor("#1A2B33")
MUTED = HexColor("#5A6F7A")


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=28,
            textColor=PRIMARY,
            alignment=TA_CENTER,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverSub",
            fontName="Helvetica",
            fontSize=12,
            leading=16,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SectionH",
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            textColor=PRIMARY,
            spaceBefore=14,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SubH",
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=ACCENT,
            spaceBefore=10,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            fontName="Helvetica",
            fontSize=9.5,
            leading=13.5,
            textColor=TEXT,
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="FeatBullet",
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=TEXT,
            leftIndent=12,
            spaceAfter=3,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableCell",
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=TEXT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableHeader",
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=white,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Caption",
            fontName="Helvetica-Oblique",
            fontSize=8,
            leading=11,
            textColor=MUTED,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="FooterNote",
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=MUTED,
            alignment=TA_CENTER,
        )
    )
    return styles


def make_table(data, col_widths):
    table = Table(data, colWidths=col_widths)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, LIGHT_BG]),
                ("BOX", (0, 0), (-1, -1), 0.75, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def add_page_number(canvas, doc_):
    canvas.saveState()
    page = canvas.getPageNumber()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 10 * mm, "Exam Prep Chatbot - Feature Proposal")
    canvas.drawRightString(PAGE_W - 20 * mm, 10 * mm, f"Page {page}")
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.4)
    canvas.line(20 * mm, 14 * mm, PAGE_W - 20 * mm, 14 * mm)
    canvas.restoreState()


def main():
    styles = build_styles()
    doc = SimpleDocTemplate(
        OUT_PATH,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )
    story = []

    # Cover
    story.append(Spacer(1, 40))
    story.append(Paragraph("FEATURE PROPOSAL", styles["CoverSub"]))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Exam Preparation Chatbot", styles["CoverTitle"]))
    story.append(
        Paragraph("IELTS · TOEFL iBT · PTE Academic", styles["CoverSub"])
    )
    story.append(Spacer(1, 10))
    story.append(
        HRFlowable(
            width="60%",
            thickness=1.5,
            color=PRIMARY,
            spaceBefore=4,
            spaceAfter=12,
            hAlign="CENTER",
        )
    )
    story.append(
        Paragraph(
            "Product feature roadmap to evolve the existing RAG Chatbot into a "
            "full-fledged<br/>English proficiency exam preparation platform for students.",
            styles["CoverSub"],
        )
    )
    story.append(Spacer(1, 20))

    meta_data = [
        [
            Paragraph("<b>Document Type</b>", styles["TableCell"]),
            Paragraph(
                "Feature Proposal for Managerial Approval", styles["TableCell"]
            ),
        ],
        [
            Paragraph("<b>Prepared For</b>", styles["TableCell"]),
            Paragraph("Management / Product Approval", styles["TableCell"]),
        ],
        [
            Paragraph("<b>Date</b>", styles["TableCell"]),
            Paragraph(date.today().strftime("%d %B %Y"), styles["TableCell"]),
        ],
        [
            Paragraph("<b>Current Product</b>", styles["TableCell"]),
            Paragraph(
                "Multi-user RAG Study Chatbot (PDF Q&amp;A, Summaries, Quizzes)",
                styles["TableCell"],
            ),
        ],
        [
            Paragraph("<b>Proposed Direction</b>", styles["TableCell"]),
            Paragraph(
                "Exam-focused prep platform for IELTS, TOEFL iBT &amp; PTE Academic",
                styles["TableCell"],
            ),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[140, 320])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
                ("BOX", (0, 0), (-1, -1), 0.75, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 28))
    story.append(
        Paragraph(
            "<b>Purpose of this document:</b> To seek formal approval on the "
            "proposed feature set and phased delivery plan before implementation begins.",
            styles["Body"],
        )
    )

    # 1
    story.append(Paragraph("1. Executive Summary", styles["SectionH"]))
    story.append(
        HRFlowable(
            width="100%", thickness=0.6, color=BORDER, spaceBefore=0, spaceAfter=8
        )
    )
    story.append(
        Paragraph(
            "The current chatbot already supports PDF upload, AI Q&amp;A with source "
            "citations, study summaries, quizzes, and a leaderboard. These capabilities "
            "form a strong foundation for notes and light practice, but students preparing "
            "for high-stakes English exams (IELTS, TOEFL iBT, PTE Academic) need structured "
            "skill practice, timed mocks, and scoring aligned to official band descriptors.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "This proposal recommends evolving the product into an exam preparation "
            "platform that helps students practice Listening, Reading, Writing, and "
            "Speaking with AI feedback, track weak areas, and follow a personalized "
            "study plan until exam day.",
            styles["Body"],
        )
    )

    # 2
    story.append(Paragraph("2. Target Users &amp; Use Cases", styles["SectionH"]))
    story.append(
        HRFlowable(
            width="100%", thickness=0.6, color=BORDER, spaceBefore=0, spaceAfter=8
        )
    )
    for item in [
        "Students preparing for IELTS Academic / General Training, TOEFL iBT, or PTE Academic.",
        "Learners who need daily practice, score improvement guidance, and mock exam readiness.",
        "Users who already upload study materials and want exam-specific coaching beyond generic document Q&amp;A.",
        "Later optional expansion: coaching institutes / teachers assigning practice and monitoring progress.",
    ]:
        story.append(Paragraph(f"• {item}", styles["FeatBullet"]))

    # 3
    story.append(
        Paragraph(
            "3. Current Product Baseline (Already Built)", styles["SectionH"]
        )
    )
    story.append(
        HRFlowable(
            width="100%", thickness=0.6, color=BORDER, spaceBefore=0, spaceAfter=8
        )
    )
    story.append(
        Paragraph(
            "The following capabilities already exist and can be reused or extended:",
            styles["Body"],
        )
    )
    baseline = [
        [
            Paragraph("<b>Area</b>", styles["TableHeader"]),
            Paragraph("<b>Existing Capability</b>", styles["TableHeader"]),
        ],
        [
            Paragraph("Authentication", styles["TableCell"]),
            Paragraph(
                "Register, login, password reset, protected routes",
                styles["TableCell"],
            ),
        ],
        [
            Paragraph("Knowledge Base", styles["TableCell"]),
            Paragraph(
                "PDF upload, subject tagging, ingest status, preview, reprocess",
                styles["TableCell"],
            ),
        ],
        [
            Paragraph("RAG Chat", styles["TableCell"]),
            Paragraph(
                "Streaming Q&amp;A, citations, conversation history, voice I/O",
                styles["TableCell"],
            ),
        ],
        [
            Paragraph("Study Aids", styles["TableCell"]),
            Paragraph(
                "6 summary types, quizzes (MCQ/T-F/fill-blank), scoring, leaderboard",
                styles["TableCell"],
            ),
        ],
        [
            Paragraph("Platform", styles["TableCell"]),
            Paragraph(
                "Per-user data isolation, health checks, Render/Vercel deploy configs",
                styles["TableCell"],
            ),
        ],
    ]
    story.append(make_table(baseline, [110, 350]))
    story.append(
        Paragraph(
            "Gap: Current quizzes and chat are general study tools, not exam-skill "
            "structured practice with band-aligned scoring.",
            styles["Caption"],
        )
    )

    # 4
    story.append(
        Paragraph(
            "4. Proposed Features for Full Exam Preparation Product",
            styles["SectionH"],
        )
    )
    story.append(
        HRFlowable(
            width="100%", thickness=0.6, color=BORDER, spaceBefore=0, spaceAfter=8
        )
    )

    sections = [
        (
            "4.1 Exam &amp; Skill Framework",
            [
                "Exam profile: student selects target exam (IELTS Academic/General, TOEFL iBT, PTE Academic).",
                "Target score setup (e.g., IELTS 7.0, TOEFL 100, PTE 79) and exam date.",
                "Skill navigation: Listening, Reading, Writing, Speaking (plus PTE integrated tasks).",
                "Exam-specific question types rather than only generic MCQs.",
            ],
        ),
        (
            "4.2 Writing Coach (High Priority)",
            [
                "Practice prompts mapped to exam tasks (IELTS Task 1/2, TOEFL Independent/Integrated, PTE Essay / Summarize Written Text).",
                "Timed writing sessions that simulate exam conditions.",
                "AI scoring against band descriptors (Task Response, Coherence, Lexical Resource, Grammar).",
                "Actionable feedback: estimated score, strengths, top 3 improvement points, and a sample improved paragraph.",
                "Essay history with improvement trends over time.",
            ],
        ),
        (
            "4.3 Speaking Coach",
            [
                "Exam-style prompts (cue cards, independent, integrated tasks).",
                "Microphone recording with automatic transcript generation.",
                "Feedback on fluency, coherence, vocabulary, and grammar; optional pronunciation cues.",
                "Timed speaking (e.g., IELTS Part 2: 1 min prep + 2 min speak).",
                "Model answer scripts/audio for guided improvement.",
            ],
        ),
        (
            "4.4 Reading Practice",
            [
                "Passages by exam with question types such as True/False/Not Given, matching headings, detail, and inference.",
                "Timed reading sections with scoring and explanations.",
                "Strategy tips per question type.",
                "Ask-about-this-passage support using existing RAG chat for deeper understanding.",
            ],
        ),
        (
            "4.5 Listening Practice",
            [
                "Audio-based practice with exam-style questions.",
                "Replay policies (limited or once-only) to better match real exam constraints.",
                "Transcript reveal after attempt and vocabulary extraction from audio content.",
            ],
        ),
        (
            "4.6 Vocabulary &amp; Grammar (Exam-Focused)",
            [
                "Academic word lists and topic banks (education, environment, technology, health, etc.).",
                "Spaced-repetition flashcards for long-term retention.",
                "Collocation and paraphrasing drills for Writing &amp; Speaking.",
                "Personalized grammar drills based on errors found in the student's essays/transcripts.",
            ],
        ),
        (
            "4.7 Full Mock Exams",
            [
                "Full or section-wise mocks with real exam timing.",
                "Auto-score for objective sections; AI band estimates for Writing and Speaking.",
                "Score report by skill and weak topic analysis.",
                "Comparison with previous mock attempts.",
            ],
        ),
        (
            "4.8 Study Plan &amp; Progress Tracking",
            [
                "Days-to-exam countdown and weekly personalized plan.",
                "Daily goals and streak tracking for consistency.",
                "Dashboard with estimated overall band and skill breakdown.",
                "Weak-area recommendations (e.g., focus on TFNG and Task 2 coherence).",
            ],
        ),
        (
            "4.9 Model Answers &amp; Strategy Content",
            [
                "Band comparison samples (e.g., Band 6 vs 7 vs 8 essays/speeches).",
                "Strategy lessons for each major question type.",
                "Light templates with guidance to avoid over-reliance on rigid memorized structures.",
                "Convert existing summary tools into exam strategy notes per topic where suitable.",
            ],
        ),
        (
            "4.10 Motivation &amp; Community (Optional)",
            [
                "Extend current leaderboard by exam and skill (Writing points, mock attempts).",
                "Weekly challenges and peer comparison.",
                "Later: study groups and shared topic banks; institute/teacher mode.",
            ],
        ),
    ]

    for title, bullets in sections:
        story.append(Paragraph(title, styles["SubH"]))
        for b in bullets:
            story.append(Paragraph(f"• {b}", styles["FeatBullet"]))

    # 5
    story.append(
        Paragraph("5. Premium / Later Enhancements", styles["SectionH"])
    )
    story.append(
        HRFlowable(
            width="100%", thickness=0.6, color=BORDER, spaceBefore=0, spaceAfter=8
        )
    )
    for item in [
        "Multi-language UI for instructions (practice answers remain in English).",
        "Teacher / institute dashboard for assigning work and viewing reports.",
        "Licensed official-style practice packs where rights allow.",
        "Mobile-first PWA and offline vocabulary packs.",
        "Clear score disclaimer: AI estimates are guidance, not official exam scores.",
    ]:
        story.append(Paragraph(f"• {item}", styles["FeatBullet"]))

    # 6
    story.append(
        Paragraph("6. Recommended Phased Delivery Plan", styles["SectionH"])
    )
    story.append(
        HRFlowable(
            width="100%", thickness=0.6, color=BORDER, spaceBefore=0, spaceAfter=8
        )
    )
    story.append(
        Paragraph(
            "Suggested approach: start with <b>IELTS Academic</b> (largest demand), "
            "then map the same skills to TOEFL iBT and PTE Academic.",
            styles["Body"],
        )
    )

    phases = [
        [
            Paragraph("<b>Phase</b>", styles["TableHeader"]),
            Paragraph("<b>Focus</b>", styles["TableHeader"]),
            Paragraph("<b>Business Rationale</b>", styles["TableHeader"]),
        ],
        [
            Paragraph("Phase 1", styles["TableCell"]),
            Paragraph(
                "Exam profile + Writing Coach with band-aligned scored feedback",
                styles["TableCell"],
            ),
            Paragraph(
                "Highest student pain point; strong LLM fit; quick visible value",
                styles["TableCell"],
            ),
        ],
        [
            Paragraph("Phase 2", styles["TableCell"]),
            Paragraph(
                "Speaking practice with recording + scored feedback",
                styles["TableCell"],
            ),
            Paragraph(
                "Key differentiator vs generic PDF chatbots",
                styles["TableCell"],
            ),
        ],
        [
            Paragraph("Phase 3", styles["TableCell"]),
            Paragraph(
                "Reading modules + timed quizzes by exam question type",
                styles["TableCell"],
            ),
            Paragraph(
                "Extends existing quiz engine with exam specificity",
                styles["TableCell"],
            ),
        ],
        [
            Paragraph("Phase 4", styles["TableCell"]),
            Paragraph(
                "Listening practice + audio pipeline",
                styles["TableCell"],
            ),
            Paragraph(
                "Completes the four-skill prep loop (needs media infra)",
                styles["TableCell"],
            ),
        ],
        [
            Paragraph("Phase 5", styles["TableCell"]),
            Paragraph(
                "Vocabulary SRS + study plan + progress dashboard",
                styles["TableCell"],
            ),
            Paragraph(
                "Increases daily engagement and retention",
                styles["TableCell"],
            ),
        ],
        [
            Paragraph("Phase 6", styles["TableCell"]),
            Paragraph(
                "Full mocks + exam-wise leaderboard",
                styles["TableCell"],
            ),
            Paragraph(
                'Positions product as "exam-ready", not just a study chatbot',
                styles["TableCell"],
            ),
        ],
    ]
    story.append(make_table(phases, [55, 205, 200]))

    # 7
    story.append(
        Paragraph(
            "7. Product Positioning Recommendation", styles["SectionH"]
        )
    )
    story.append(
        HRFlowable(
            width="100%", thickness=0.6, color=BORDER, spaceBefore=0, spaceAfter=8
        )
    )
    story.append(
        Paragraph(
            'Avoid launching as "generic RAG chatbot for all exams" at once. '
            "Position as an <b>AI Exam Coach</b> that:",
            styles["Body"],
        )
    )
    for item in [
        "Starts with IELTS Academic four-skill prep.",
        "Reuses architecture for TOEFL iBT and PTE (same skills, different task formats).",
        'Keeps the existing PDF knowledge base as a "study materials + ask anything" companion layer.',
    ]:
        story.append(Paragraph(f"• {item}", styles["FeatBullet"]))

    # 8
    story.append(Paragraph("8. Approval Request", styles["SectionH"]))
    story.append(
        HRFlowable(
            width="100%", thickness=0.6, color=BORDER, spaceBefore=0, spaceAfter=8
        )
    )
    story.append(
        Paragraph(
            "Management approval is requested for the following:",
            styles["Body"],
        )
    )
    for item in [
        "Accept the proposed feature scope for transforming the chatbot into an exam preparation platform.",
        "Approve the phased delivery order (Phase 1 to Phase 6), starting with IELTS Writing Coach.",
        "Authorize detailed technical design and implementation planning for the approved phases.",
    ]:
        story.append(Paragraph(f"• {item}", styles["FeatBullet"]))

    story.append(Spacer(1, 16))
    approval = [
        [
            Paragraph("<b>Decision</b>", styles["TableHeader"]),
            Paragraph("<b>Select</b>", styles["TableHeader"]),
            Paragraph("<b>Comments / Conditions</b>", styles["TableHeader"]),
        ],
        [
            Paragraph("Approved as proposed", styles["TableCell"]),
            Paragraph("[ ]", styles["TableCell"]),
            Paragraph("", styles["TableCell"]),
        ],
        [
            Paragraph("Approved with changes", styles["TableCell"]),
            Paragraph("[ ]", styles["TableCell"]),
            Paragraph("", styles["TableCell"]),
        ],
        [
            Paragraph("Deferred / Needs revision", styles["TableCell"]),
            Paragraph("[ ]", styles["TableCell"]),
            Paragraph("", styles["TableCell"]),
        ],
    ]
    at = make_table(approval, [160, 60, 240])
    at.setStyle(
        TableStyle(
            [
                ("ALIGN", (1, 1), (1, -1), "CENTER"),
                ("TOPPADDING", (0, 1), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 8),
            ]
        )
    )
    story.append(at)

    story.append(Spacer(1, 22))
    sign = [
        [
            Paragraph(
                "<b>Prepared by</b><br/><br/>________________________"
                "<br/>Name / Role<br/>Date: __________",
                styles["TableCell"],
            ),
            Paragraph(
                "<b>Approved by</b><br/><br/>________________________"
                "<br/>Manager / Stakeholder<br/>Date: __________",
                styles["TableCell"],
            ),
        ],
    ]
    st = Table(sign, colWidths=[230, 230])
    st.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.75, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
            ]
        )
    )
    story.append(st)

    story.append(Spacer(1, 24))
    story.append(
        Paragraph(
            "Confidential - For internal review and approval only. "
            "AI band estimates are indicative and not official exam scores.",
            styles["FooterNote"],
        )
    )

    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"Wrote: {OUT_PATH}")
    print(f"Size KB: {round(os.path.getsize(OUT_PATH) / 1024, 1)}")


if __name__ == "__main__":
    main()
