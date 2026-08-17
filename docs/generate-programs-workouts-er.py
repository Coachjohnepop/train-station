#!/usr/bin/env python3
"""Generate docs/programs-workouts-exercises-er.pdf from the Train Station Prisma model."""

from pathlib import Path

from reportlab.lib.colors import Color, white
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

OUT = Path(__file__).resolve().parent / "programs-workouts-exercises-er.pdf"

NAVY = Color(0.12, 0.16, 0.28)
GOLD = Color(0.72, 0.55, 0.18)
GOLD_PALE = Color(0.96, 0.91, 0.76)
INK = Color(0.12, 0.12, 0.14)
MUTED = Color(0.38, 0.40, 0.45)
LINE = Color(0.55, 0.58, 0.64)
BOX = Color(0.97, 0.97, 0.98)
HEADER_PROG = Color(0.16, 0.28, 0.48)
HEADER_WORK = Color(0.28, 0.22, 0.14)
HEADER_EX = Color(0.18, 0.32, 0.26)
HEADER_LOG = Color(0.32, 0.18, 0.22)
HEADER_CYCLE = Color(0.22, 0.24, 0.36)


def try_fonts():
    for name, path in (
        ("TSSans", "/System/Library/Fonts/Supplemental/Arial.ttf"),
        ("TSSansBd", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    ):
        try:
            pdfmetrics.registerFont(TTFont(name, path))
        except Exception:
            return "Helvetica", "Helvetica-Bold"
    return "TSSans", "TSSansBd"


FONT, FONT_B = try_fonts()


def crow_one(c, x, y, dx, dy, size=7):
    """Draw a crow's-foot (many) or a single bar (one) at (x,y) pointing along (dx,dy)."""
    pass


def entity(c, x, y, w, h, title, fields, header):
    """Entity box. (x,y) is top-left in PDF coords converted: we pass bottom-left y."""
    r = 5
    c.setFillColor(BOX)
    c.setStrokeColor(NAVY)
    c.setLineWidth(0.9)
    c.roundRect(x, y, w, h, r, fill=1, stroke=1)
    head_h = 16
    c.setFillColor(header)
    c.roundRect(x, y + h - head_h, w, head_h, r, fill=1, stroke=0)
    c.rect(x, y + h - head_h, w, 6, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont(FONT_B, 8)
    c.drawString(x + 6, y + h - 11.5, title)
    c.setFillColor(INK)
    c.setFont(FONT, 6.6)
    ty = y + h - head_h - 11
    for line in fields:
        if ty < y + 5:
            break
        if line.startswith("PK "):
            c.setFont(FONT_B, 6.6)
            c.setFillColor(NAVY)
            c.drawString(x + 6, ty, line)
        elif line.startswith("FK "):
            c.setFont(FONT, 6.6)
            c.setFillColor(Color(0.35, 0.22, 0.05))
            c.drawString(x + 6, ty, line)
        else:
            c.setFont(FONT, 6.6)
            c.setFillColor(MUTED)
            c.drawString(x + 6, ty, line)
        ty -= 9
    return x + w / 2, y + h, x + w / 2, y, x, y + h / 2, x + w, y + h / 2


def line(c, x1, y1, x2, y2):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.85)
    c.line(x1, y1, x2, y2)


def label(c, x, y, text, align="c"):
    c.setFillColor(MUTED)
    c.setFont(FONT, 6)
    if align == "c":
        c.drawCentredString(x, y, text)
    elif align == "r":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)


def header_bar(c, W, H, title, subtitle):
    c.setFillColor(NAVY)
    c.rect(0, H - 42, W, 42, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(0, H - 44, W, 2.2, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont(FONT_B, 13)
    c.drawString(28, H - 22, title)
    c.setFont(FONT, 8)
    c.setFillColor(GOLD_PALE)
    c.drawString(28, H - 35, subtitle)
    c.setFillColor(GOLD)
    c.setFont(FONT_B, 8)
    c.drawRightString(W - 28, H - 24, "The Train Station")


def footer(c, W, page, total):
    c.setFillColor(MUTED)
    c.setFont(FONT, 7)
    c.drawString(28, 16, "Source of truth: prisma/schema.prisma  ·  Postgres")
    c.drawRightString(W - 28, 16, f"Page {page} of {total}")


def hline(c, x1, x2, y):
    line(c, x1, y, x2, y)


def vline(c, x, y1, y2):
    line(c, x, y1, x, y2)


def page_overview(c, W, H):
    header_bar(
        c,
        W,
        H,
        "Programs, workouts, and exercises",
        "Entity-relationship diagram  ·  how a program day becomes a member session",
    )
    footer(c, W, 1, 3)

    # 4 columns × 3 rows. Boxes do not overlap. Lines stay in the gutters.
    x = [22, 214, 406, 598]
    w = 178
    y1, h1 = 418, 118
    y2, h2 = 248, 118
    y3, h3 = 78, 118

    entity(
        c, x[0], y1, w, h1, "Program",
        ["PK id", "    slug  UNIQUE", "    name", "    durationWeeks", "    published", "    startDate  YYYY-MM-DD"],
        HEADER_PROG,
    )
    entity(
        c, x[1], y1, w, h1, "ProgramWeek",
        ["PK id", "FK programId", "    weekNumber  UNIQUE/program", "    macroPhaseIndex", "    phaseWeekNumber", "absolute week ≠ week-in-phase"],
        HEADER_PROG,
    )
    entity(
        c, x[2], y1, w, h1, "ProgramDay",
        ["PK id", "FK weekId", "    dayNumber  UNIQUE/week", "    cycleMonth / cycleDay", "FK workoutId  (legacy)", "    partCount / freePool"],
        HEADER_PROG,
    )
    entity(
        c, x[3], y1, w, h1, "ProgramDaySession",
        ["PK id", "FK dayId", "    partIndex  UNIQUE/day", "    label  AM / Mid / PM", "    sessionKind", "    timeSlot"],
        HEADER_PROG,
    )
    entity(
        c, x[0], y2, w, h2, "ProgramEnrollment",
        ["PK id", "FK userId", "FK programId", "    programStartDate", "    blockEndsAt", "    currentWeek / Day / Phase", "    trainingLocation"],
        HEADER_PROG,
    )
    entity(
        c, x[1], y2, w, h2, "ProgramMacroPhase",
        ["PK id", "FK programId", "    phaseIndex  UNIQUE/program", "    slug / name", "    minWeeks / maxWeeks", "Adult: cond → hyp → str → power"],
        HEADER_PROG,
    )
    entity(
        c, x[2], y2, w, h2, "ProgramDayOption",
        ["PK id", "FK dayId", "FK sessionId  (nullable)", "FK workoutId", "    label  Gym / Home", "    trainingLocation", "    notes  (this day only)"],
        HEADER_PROG,
    )
    entity(
        c, x[3], y2, w, h2, "Workout",
        ["PK id", "    name  (content title)", "    source  catalog|template|…", "    restTimerSeconds / sound", "    certifiedAt", "One clone per day-track"],
        HEADER_WORK,
    )
    entity(
        c, x[1], y3, w, h3, "WorkoutSetPhase",
        ["PK id", "FK workoutExerciseId", "    phaseIndex  UNIQUE/line", "    phaseType  HOLD|REPS|…", "    reps / durationSec", "    repKind  FIXED|BURNOUT|MAX"],
        HEADER_WORK,
    )
    entity(
        c, x[2], y3, w, h3, "WorkoutExercise",
        ["PK id", "FK workoutId", "FK exerciseId", "    sortOrder", "    setCount / reps / scheme", "    restBetweenSetsSec", "    notes  (today’s cue)"],
        HEADER_WORK,
    )
    entity(
        c, x[3], y3, w, h3, "Exercise",
        ["PK id", "    name  (library identity)", "    description / videoUrl", "    defaultSetScheme", "    archivedAt  (soft hide)"],
        HEADER_EX,
    )

    g = 18  # gutter between columns
    # Row 1 horizontals through gutters
    mid1 = y1 + h1 / 2
    hline(c, x[0] + w, x[1], mid1)
    label(c, x[0] + w + g / 2, mid1 + 4, "1 : N")
    hline(c, x[1] + w, x[2], mid1)
    label(c, x[1] + w + g / 2, mid1 + 4, "1 : N")
    hline(c, x[2] + w, x[3], mid1)
    label(c, x[2] + w + g / 2, mid1 + 4, "1 : N parts")

    # Program down to Enrollment
    vline(c, x[0] + 28, y2 + h2, y1)
    label(c, x[0] + 36, (y1 + y2 + h2) / 2, "1 : N")

    # Program down-right to MacroPhase (gutter between col0/col1, then into box)
    vline(c, x[0] + w - 28, y1, y1 - 10)
    hline(c, x[0] + w - 28, x[1] + 28, y1 - 10)
    vline(c, x[1] + 28, y2 + h2, y1 - 10)
    label(c, x[0] + w + 8, y1 - 18, "1 : N phases")

    # Day down to Option
    vline(c, x[2] + 40, y2 + h2, y1)
    label(c, x[2] + 48, (y1 + y2 + h2) / 2, "1 : N")

    # Session down to Option
    vline(c, x[3] + 24, y2 + h2 + 8, y1)
    hline(c, x[2] + w, x[3] + 24, y2 + h2 + 8)
    label(c, x[3] - 36, y2 + h2 + 12, "tracks")

    # Option to Workout
    mid2 = y2 + h2 / 2
    hline(c, x[2] + w, x[3], mid2)
    label(c, x[2] + w + g / 2, mid2 + 4, "N : 1")

    # Workout (col 3, row 2) → WorkoutExercise (col 2, row 3)
    drop = y2 - 14
    vline(c, x[3] + 36, drop, y2)
    hline(c, x[2] + w / 2, x[3] + 36, drop)
    vline(c, x[2] + w / 2, y3 + h3, drop)
    label(c, x[2] + w + 20, drop + 4, "1 : N lines")

    # WorkoutExercise to Exercise
    mid3 = y3 + h3 / 2
    hline(c, x[2] + w, x[3], mid3)
    label(c, x[2] + w + g / 2, mid3 + 4, "N : 1")

    # WorkoutExercise to SetPhase
    hline(c, x[1] + w, x[2], mid3)
    label(c, x[1] + w + g / 2, mid3 + 4, "N : 1")

    c.setFillColor(NAVY)
    c.setFont(FONT_B, 8)
    c.drawString(22, H - 58, "Read left to right, then down")
    c.setFont(FONT, 7.2)
    c.setFillColor(INK)
    c.drawString(
        22,
        H - 70,
        "Program → weeks → days → parts (sessions) → Gym/Home options → a Workout clone → ordered lines → one library Exercise. Prescription lives on the line, not the exercise name.",
    )


def page_logging(c, W, H):
    header_bar(
        c,
        W,
        H,
        "Logging, templates, and the 28-day cycle library",
        "Same Workout and Exercise rows — extra tables for history and coach tools",
    )
    footer(c, W, 2, 3)

    c.setFillColor(NAVY)
    c.setFont(FONT_B, 8)
    c.drawString(22, H - 58, "Rules the boxes do not say")
    c.setFont(FONT, 7)
    c.setFillColor(INK)
    rules = [
        "Workout.name is a content title (Fasted cardio, Lower body). Day number and Gym/Home live on ProgramDay / Option.",
        "Template paste always clones. Do not share one Workout row across days or Tuesday’s edit changes Thursday.",
        "ProgramDay.workoutId is legacy. Members resolve through ProgramDayOption.workoutId for their trainingLocation.",
        "WorkoutExercise.notes is today’s cue. Exercise.description / videoUrl is the library catalog.",
        "Adult weekNumber is absolute. phaseWeekNumber is week-in-phase. WorkoutLog = session; ExercisePerformance = silhouette.",
    ]
    y = H - 70
    for r in rules:
        c.setFillColor(GOLD)
        c.circle(26, y + 2, 1.5, fill=1, stroke=0)
        c.setFillColor(INK)
        c.drawString(34, y, r)
        y -= 11

    x = [22, 214, 406, 598]
    w = 178
    y1, h1 = 318, 118
    y2, h2 = 168, 108
    y3, h3 = 42, 108

    entity(
        c, x[0], y1, w, h1, "Workout",
        ["PK id", "    name / source", "    rest timer fields", "Used by options, logs,", "templates, and cycle slots"],
        HEADER_WORK,
    )
    entity(
        c, x[1], y1, w, h1, "WorkoutTemplate",
        ["PK id", "FK workoutId  UNIQUE", "    name / category", "    versionLabel", "    archivedAt", "Paste always deep-clones"],
        HEADER_WORK,
    )
    entity(
        c, x[2], y1, w, h1, "WorkoutLog",
        ["PK id", "FK userId", "FK workoutId", "    performedAt", "    completed", "    progress  0–100"],
        HEADER_LOG,
    )
    entity(
        c, x[3], y1, w, h1, "ExercisePerformance",
        ["PK id", "FK userId", "FK exerciseId", "    workoutExerciseId?", "    setsCompleted / reps", "    startingWeightLbs"],
        HEADER_LOG,
    )
    entity(
        c, x[0], y2, w, h2, "Exercise",
        ["PK id", "    name / videoUrl", "    archivedAt", "Library identity"],
        HEADER_EX,
    )
    entity(
        c, x[1], y2, w, h2, "ExerciseEquipment",
        ["PK exerciseId + equipmentId", "FK exerciseId", "FK equipmentId", "Required kit for a move"],
        HEADER_EX,
    )
    entity(
        c, x[0], y3, w, h3, "WorkoutCycle",
        ["PK id", "FK programId?", "    cycleMonth  (M1…)", "    clonedFromId?", "    archivedAt"],
        HEADER_CYCLE,
    )
    entity(
        c, x[1], y3, w, h3, "WorkoutCycleDay",
        ["PK id", "FK cycleId", "    dayNumber  1–28", "    isDayOff"],
        HEADER_CYCLE,
    )
    entity(
        c, x[2], y3, w, h3, "WorkoutCycleDaySlot",
        ["PK id", "FK cycleDayId", "FK workoutId", "    trainingLocation", "UNIQUE (day, location)"],
        HEADER_CYCLE,
    )

    mid1 = y1 + h1 / 2
    hline(c, x[0] + w, x[1], mid1)
    label(c, x[0] + w + 9, mid1 + 4, "0..1")
    hline(c, x[1] + w, x[2], mid1)
    label(c, x[1] + w + 9, mid1 + 4, "1 : N logs")

    mid2 = y2 + h2 / 2
    hline(c, x[0] + w, x[1], mid2)
    label(c, x[0] + w + 9, mid2 + 4, "1 : N")

    mid3 = y3 + h3 / 2
    hline(c, x[0] + w, x[1], mid3)
    label(c, x[0] + w + 9, mid3 + 4, "1 : N")
    hline(c, x[1] + w, x[2], mid3)
    label(c, x[1] + w + 9, mid3 + 4, "1 : N")

    # FK notes instead of long crossing leaders
    label(c, x[2] + w / 2, y3 + h3 + 4, "FK → Workout")
    label(c, x[3] + w / 2, y1 - 10, "FK → Exercise")


def page_keys(c, W, H):
    header_bar(
        c,
        W,
        H,
        "Cardinality, keys, and delete behavior",
        "What the foreign keys do when a coach deletes a day, workout, or program",
    )
    footer(c, W, 3, 3)

    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import Paragraph, Table, TableStyle
    from reportlab.lib import colors

    body = ParagraphStyle(
        "b",
        fontName=FONT,
        fontSize=7.4,
        leading=10,
        textColor=INK,
    )
    head = ParagraphStyle(
        "h",
        fontName=FONT_B,
        fontSize=7.4,
        leading=10,
        textColor=white,
    )

    def P(text, style=body):
        return Paragraph(text, style)

    rows = [
        [
            P("<b>Parent → child</b>", head),
            P("<b>Card.</b>", head),
            P("<b>On delete</b>", head),
            P("<b>Meaning</b>", head),
        ],
        [
            P("Program → ProgramWeek / MacroPhase / Enrollment"),
            P("1 : N"),
            P("Cascade"),
            P("Removing a program removes its calendar and enrollments."),
        ],
        [
            P("ProgramWeek → ProgramDay"),
            P("1 : N"),
            P("Cascade"),
            P("A week owns Mon–Sun (dayNumber 1–7)."),
        ],
        [
            P("ProgramDay → ProgramDaySession / Option"),
            P("1 : N"),
            P("Cascade"),
            P("Parts and Gym/Home tracks die with the day. The Workout row is kept."),
        ],
        [
            P("ProgramDaySession → ProgramDayOption"),
            P("1 : N"),
            P("Cascade"),
            P("Gym vs Home are options under a part, not separate parts."),
        ],
        [
            P("ProgramDayOption → Workout"),
            P("N : 1"),
            P("Restrict (no cascade)"),
            P("Many options may point at one workout; prefer one clone per option."),
        ],
        [
            P("ProgramDay → Workout (legacy workoutId)"),
            P("N : 0..1"),
            P("Set-null / keep"),
            P("Old default pointer. New code reads options first."),
        ],
        [
            P("Workout → WorkoutExercise"),
            P("1 : N"),
            P("Cascade"),
            P("Deleting a workout deletes its lines."),
        ],
        [
            P("Exercise → WorkoutExercise"),
            P("1 : N"),
            P("Restrict"),
            P("Archive the exercise instead of delete if lines still reference it."),
        ],
        [
            P("WorkoutExercise → WorkoutSetPhase"),
            P("1 : N"),
            P("Cascade"),
            P("HOLD / REPS / BURNOUT / TIMED inside one working set."),
        ],
        [
            P("Workout → WorkoutTemplate"),
            P("1 : 0..1"),
            P("Cascade from workout"),
            P("Library card. Paste clones the workout; it never shares the row."),
        ],
        [
            P("Workout → WorkoutLog"),
            P("1 : N"),
            P("Keep log"),
            P("Member history stays even if the program day is rebuilt."),
        ],
        [
            P("Exercise → ExercisePerformance"),
            P("1 : N"),
            P("Cascade"),
            P("Per-move silhouette (weight / sets) for the next visit."),
        ],
        [
            P("WorkoutCycle → Day → Slot → Workout"),
            P("1 : N : N : 1"),
            P("Cascade cycle only"),
            P("Optional 28-day library (M1D1–M1D28), parallel to ProgramWeek."),
        ],
        [
            P("User → ProgramEnrollment"),
            P("1 : N"),
            P("Cascade"),
            P("programStartDate + blockEndsAt define the paid 28-day window."),
        ],
    ]

    data = rows
    table = Table(data, colWidths=[2.55 * inch, 0.7 * inch, 1.35 * inch, 4.0 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), white),
                ("BACKGROUND", (0, 1), (-1, 1), GOLD_PALE),
                ("BACKGROUND", (0, 3), (-1, 3), GOLD_PALE),
                ("BACKGROUND", (0, 5), (-1, 5), GOLD_PALE),
                ("BACKGROUND", (0, 7), (-1, 7), GOLD_PALE),
                ("BACKGROUND", (0, 9), (-1, 9), GOLD_PALE),
                ("BACKGROUND", (0, 11), (-1, 11), GOLD_PALE),
                ("BACKGROUND", (0, 13), (-1, 13), GOLD_PALE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("GRID", (0, 0), (-1, -1), 0.3, Color(0.75, 0.76, 0.78)),
                ("BOX", (0, 0), (-1, -1), 0.8, NAVY),
            ]
        )
    )
    tw, th = table.wrap(W - 56, H - 90)
    table.drawOn(c, 28, H - 58 - th)

    c.setFillColor(MUTED)
    c.setFont(FONT, 7)
    c.drawString(
        28,
        32,
        "Generated for documentation. If schema.prisma changes, regenerate:  python3 docs/generate-programs-workouts-er.py",
    )


def main():
    W, H = landscape(letter)
    c = canvas.Canvas(str(OUT), pagesize=landscape(letter))
    c.setTitle("The Train Station — Programs, workouts, exercises ER")
    c.setAuthor("The Train Station")
    c.setSubject("Postgres entity-relationship diagram")
    page_overview(c, W, H)
    c.showPage()
    page_logging(c, W, H)
    c.showPage()
    page_keys(c, W, H)
    c.save()
    print(OUT)


if __name__ == "__main__":
    main()
