#!/usr/bin/env python3
"""System flowchart including BYOW, gold trim, report tab -- 13 Sep 2026."""

import os
import shutil
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

OUT_DOCS = "/Users/johnpopham/projects/train-station/docs/system-flowchart-2026-09-13-byow.pdf"
OUT_DESK = "/Users/johnpopham/Desktop/Stuff/Lemon Voice/The Train Station/System-Flowchart-2026-09-13-BYOW.pdf"

pdfmetrics.registerFont(TTFont("Georgia-Bold", "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"))
pdfmetrics.registerFont(TTFont("Georgia", "/System/Library/Fonts/Supplemental/Georgia.ttf"))

PAGE_W, PAGE_H = landscape(letter)
LEFT = 0.45 * inch
NAVY = colors.HexColor("#1B3A6B")
NAVY_DEEP = colors.HexColor("#0F2444")
CREAM = colors.HexColor("#F4F1EA")
INK = colors.HexColor("#1C1917")
MUTED = colors.HexColor("#57534E")
WHITE = colors.white
GOLD = colors.HexColor("#B8860B")
PURPLE = colors.HexColor("#5B21B6")
CARD = colors.HexColor("#FFFEFB")
EMERALD = colors.HexColor("#047857")


def hf(c, n, title):
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(NAVY_DEEP)
    c.rect(0, PAGE_H - 0.32 * inch, PAGE_W, 0.32 * inch, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(0, PAGE_H - 0.32 * inch, 0.12 * inch, 0.32 * inch, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Georgia", 8)
    c.drawString(LEFT, PAGE_H - 0.21 * inch, "THE TRAIN STATION")
    c.setFont("Helvetica", 8)
    c.drawRightString(PAGE_W - LEFT, PAGE_H - 0.21 * inch, title)
    c.setFillColor(NAVY_DEEP)
    c.rect(0, 0, PAGE_W, 0.28 * inch, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 7.5)
    c.drawString(LEFT, 0.1 * inch, "Workflows as of 13 Sep 2026  ·  live thetrainstation.co")
    c.drawRightString(PAGE_W - LEFT, 0.1 * inch, f"Page {n}")


def box(c, x, y, w, h, title, lines, header=NAVY):
    c.setFillColor(CARD)
    c.setStrokeColor(header)
    c.setLineWidth(0.9)
    c.roundRect(x, y, w, h, 5, fill=1, stroke=1)
    c.setFillColor(header)
    c.roundRect(x, y + h - 14, w, 14, 5, fill=1, stroke=0)
    c.rect(x, y + h - 14, w, 6, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(x + 6, y + h - 10.5, title)
    c.setFillColor(INK)
    c.setFont("Helvetica", 6.5)
    ty = y + h - 25
    for line in lines:
        if ty < y + 5:
            break
        c.drawString(x + 6, ty, line)
        ty -= 9


def arrow(c, x1, y1, x2, y2):
    import math
    c.setStrokeColor(NAVY)
    c.setFillColor(NAVY)
    c.setLineWidth(1)
    c.line(x1, y1, x2, y2)
    ang = math.atan2(y2 - y1, x2 - x1)
    size = 5
    path = c.beginPath()
    path.moveTo(x2, y2)
    path.lineTo(x2 + size * math.cos(ang + 2.6), y2 + size * math.sin(ang + 2.6))
    path.lineTo(x2 + size * math.cos(ang - 2.6), y2 + size * math.sin(ang - 2.6))
    path.close()
    c.drawPath(path, fill=1, stroke=0)


def p1(c):
    hf(c, 1, "Main member journey")
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(LEFT, PAGE_H - 0.55 * inch, "MAIN SITE  (gold trim)")
    c.setFillColor(NAVY_DEEP)
    c.setFont("Georgia-Bold", 15)
    c.drawString(LEFT, PAGE_H - 0.78 * inch, "Post -> landing A/B -> ticket -> Today")
    y = PAGE_H - 1.0 * inch
    steps = [
        ("TRAFFIC", ["IG / FB / direct", "One URL"]),
        ("LANDING A/B", ["Cookie ts_landing", "A Tour  B Jeremy", "C floor preview"]),
        ("TICKETS", ["Free  Coach $25", "Business $50  1st $850", "completeMemberSignup"]),
        ("CHECKOUT", ["Stripe hosted", "or Venmo Mark paid", "No CHD on origin"]),
        ("TODAY", ["28-day month", "Console  rest  log", "15-min pester"]),
    ]
    bw = 1.95 * inch
    x = LEFT
    for title, lines in steps:
        box(c, x, y - 1.05 * inch, bw, 1.05 * inch, title, lines, GOLD if title == "TODAY" else NAVY)
        if x > LEFT:
            arrow(c, x - 0.1 * inch, y - 0.52 * inch, x, y - 0.52 * inch)
        x += bw + 0.1 * inch
    y = y - 1.35 * inch
    box(c, LEFT, y - 1.35 * inch, 5.0 * inch, 1.35 * inch, "MEMBER APP", [
        "Today  Nutrition  Scores  hamburger  Messages",
        "More: Gear  Measure  Partners  Book  My notes  Account",
        "Arm icon -> Measurements  ·  Enable alerts on iPhone Safari",
        "Chat: Coach | Adult | Archive  ·  Clear messages",
    ], PURPLE)
    box(c, LEFT + 5.2 * inch, y - 1.35 * inch, 4.65 * inch, 1.35 * inch, "COACH APP", [
        "Day hub  Go to Today  Live Floor",
        "Programs calendar 0-30 / 30-60 (holes stay)",
        "People  Queue  Bookings  Chat",
        "Postgres is the catalog -- 613 workouts live",
    ], NAVY)
    c.showPage()


def p2(c):
    hf(c, 2, "BYOW hidden door")
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(LEFT, PAGE_H - 0.55 * inch, "NO LANDING LINKS  ·  FREE")
    c.setFillColor(NAVY_DEEP)
    c.setFont("Georgia-Bold", 15)
    c.drawString(LEFT, PAGE_H - 0.78 * inch, "Notes in. Console out. Report after they log.")
    y = PAGE_H - 1.0 * inch
    steps = [
        ("/byow/signup", ["Public  200", "completeMemberSignup", "channel: byow", "No Stripe  no Adult"]),
        ("/byow", ["Paste / .txt", "Guided format typewriter", "Build & open", "Exact notes saved"]),
        ("CONSOLE", ["Same checkoffs", "Log -> ByowWorkoutLog", "Not Jeremy Exercise"]),
        ("REPORT", ["My notes -> Report", "Sessions  avg min", "Muscles  cardio", "Next-week groups"]),
        ("/byow/admin", ["John only", "Testers  libraries", "Exact notes lines", "14d journey"]),
    ]
    bw = 1.95 * inch
    x = LEFT
    for title, lines in steps:
        box(c, x, y - 1.22 * inch, bw, 1.22 * inch, title, lines, GOLD)
        if x > LEFT:
            arrow(c, x - 0.1 * inch, y - 0.61 * inch, x, y - 0.61 * inch)
        x += bw + 0.1 * inch
    y = y - 1.5 * inch
    box(c, LEFT, y - 1.15 * inch, PAGE_W - 2 * LEFT, 1.15 * inch, "TABLES  (same Postgres, not Jeremy's catalog)", [
        "ByowExercise  ByowWorkout  ByowWorkoutExercise  ByowSourceNote (rawText)  ByowWorkoutLog",
        "User + MemberProfile still used (paymentNote=byow). Signup changes on main go through completeMemberSignup.",
        "Sweep 13 Sep: /byow/signup 200  ·  parse/build/log 401 unauth  ·  no dead hrefs.",
    ], PURPLE)
    c.showPage()


def p3(c):
    hf(c, 3, "Money  live  chat")
    c.setFillColor(NAVY_DEEP)
    c.setFont("Georgia-Bold", 15)
    c.drawString(LEFT, PAGE_H - 0.72 * inch, "Three more loops that stay live")
    y = PAGE_H - 0.95 * inch
    box(c, LEFT, y - 1.55 * inch, 3.35 * inch, 1.55 * inch, "MONEY", [
        "Stripe Checkout hosted LIVE",
        "Webhook marks paid",
        "Venmo + Mark paid",
        "No $1/day SKU",
        "PCI draft: SAQ A path",
    ], colors.HexColor("#635BFF"))
    box(c, LEFT + 3.5 * inch, y - 1.55 * inch, 3.35 * inch, 1.55 * inch, "LIVE CLASS", [
        "Coach assigns a subset",
        "Zoom Connect  Jeremy host",
        "Checkoffs SSE",
        "Ambient podcasts  transient buzzer",
        "Fasted cardio = 35 min one timer",
    ], EMERALD)
    box(c, LEFT + 7.0 * inch, y - 1.55 * inch, 3.35 * inch, 1.55 * inch, "CHAT", [
        "Calendly book -> 1:1 pair",
        "Member unread + coach unread",
        "Clear -> Archive tab",
        "New users skip old cohort history",
        "Enable alerts on iPhone Home Screen",
    ], PURPLE)
    c.showPage()


def p4(c):
    hf(c, 4, "Sweep 13 Sep 2026")
    c.setFillColor(NAVY_DEEP)
    c.setFont("Georgia-Bold", 15)
    c.drawString(LEFT, PAGE_H - 0.72 * inch, "Prod loop: 92 pages, 0 dead, 22/22 gates")
    y = PAGE_H - 0.95 * inch
    box(c, LEFT, y - 1.7 * inch, 5.1 * inch, 1.7 * inch, "SITE LOOP SWEEP", [
        "92 pages ok/gated/redirect  ·  bad 0",
        "Public APIs 9/9  ·  Stripe LIVE + Venmo + tips",
        "Process flows 22/22 including BYOW parse/build/log",
        "Chat archive + clear gated 401",
        "/byow/signup public 200",
    ], NAVY)
    box(c, LEFT + 5.3 * inch, y - 1.7 * inch, 4.55 * inch, 1.7 * inch, "SHIPPED THIS WEEK", [
        "Gold trim restored (Jeremy)",
        "Catalog persist + Desktop snapshot",
        "BYOW door + free signup + report",
        "Chat archive  ·  iPhone Enable alerts",
        "main = prod  b0e1613+",
    ], GOLD)
    c.showPage()


def main():
    os.makedirs(os.path.dirname(OUT_DOCS), exist_ok=True)
    os.makedirs(os.path.dirname(OUT_DESK), exist_ok=True)
    c = canvas.Canvas(OUT_DOCS, pagesize=landscape(letter))
    c.setTitle("The Train Station -- system flowchart with BYOW")
    p1(c); p2(c); p3(c); p4(c)
    c.save()
    shutil.copy2(OUT_DOCS, OUT_DESK)
    print("Wrote", OUT_DOCS)


if __name__ == "__main__":
    main()
