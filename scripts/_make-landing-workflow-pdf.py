#!/usr/bin/env python3
"""Landing workflow charts — 21 Sep 2026."""

import math
import os
import shutil
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

OUT_DOCS = "/Users/johnpopham/projects/train-station/docs/landing-workflow-2026-09-21.pdf"
OUT_DESK = "/Users/johnpopham/Desktop/Stuff/Lemon Voice/The Train Station/Landing-Workflow-2026-09-21.pdf"

pdfmetrics.registerFont(TTFont("Georgia", "/System/Library/Fonts/Supplemental/Georgia.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Bold", "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"))

PAGE_W, PAGE_H = landscape(letter)
LEFT = 0.45 * inch
NAVY = colors.HexColor("#1B3A6B")
NAVY_DEEP = colors.HexColor("#0F2444")
CREAM = colors.HexColor("#F4F1EA")
INK = colors.HexColor("#1C1917")
MUTED = colors.HexColor("#57534E")
WHITE = colors.white
EMERALD = colors.HexColor("#047857")
PURPLE = colors.HexColor("#5B21B6")
GOLD = colors.HexColor("#B8860B")
CARD = colors.HexColor("#FFFEFB")


def header_footer(c, page, title, pages=4):
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
    c.drawString(LEFT, 0.1 * inch, "Landing workflow  ·  21 Sep 2026  ·  Stripe only  ·  /a and /b preview doors")
    c.drawRightString(PAGE_W - LEFT, 0.1 * inch, f"Page {page} of {pages}")


def rounded(c, x, y, w, h, fill, stroke, sw=0.8, r=6):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(sw)
    c.roundRect(x, y, w, h, r, fill=1, stroke=1)


def box(c, x, y, w, h, title, lines, header=NAVY):
    rounded(c, x, y, w, h, CARD, header, 0.9, 5)
    c.setFillColor(header)
    c.roundRect(x, y + h - 14, w, 14, 5, fill=1, stroke=0)
    c.rect(x, y + h - 14, w, 6, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 7.1)
    c.drawString(x + 6, y + h - 10.2, title)
    c.setFillColor(INK)
    c.setFont("Helvetica", 6.6)
    ty = y + h - 26
    for line in lines:
        if ty < y + 5:
            break
        c.drawString(x + 6, ty, line)
        ty -= 9


def arrow(c, x1, y1, x2, y2, col=NAVY):
    c.setStrokeColor(col)
    c.setFillColor(col)
    c.setLineWidth(1.1)
    c.line(x1, y1, x2, y2)
    ang = math.atan2(y2 - y1, x2 - x1)
    size = 6
    path = c.beginPath()
    path.moveTo(x2, y2)
    path.lineTo(x2 + size * math.cos(ang + 2.6), y2 + size * math.sin(ang + 2.6))
    path.lineTo(x2 + size * math.cos(ang - 2.6), y2 + size * math.sin(ang - 2.6))
    path.close()
    c.drawPath(path, fill=1, stroke=0)


def page1(c):
    header_footer(c, 1, "Landing  ·  how traffic splits")
    c.setFillColor(NAVY_DEEP)
    c.setFont("Georgia-Bold", 18)
    c.drawString(LEFT, PAGE_H - 0.72 * inch, "A sells the ticket. B opens the console.")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(LEFT, PAGE_H - 0.92 * inch, "Random split on /  ·  deliberate doors /a and /b  ·  members skip the experiment")

    y = PAGE_H - 1.15 * inch
    box(c, LEFT, y - 0.95 * inch, 2.1 * inch, 0.95 * inch, "TRAFFIC", [
        "Instagram / Facebook / text",
        "thetrainstation.co",
        "allaboard.fit 308 -> /l/class",
    ], PURPLE)
    arrow(c, LEFT + 2.1 * inch, y - 0.48 * inch, LEFT + 2.4 * inch, y - 0.48 * inch)
    box(c, LEFT + 2.4 * inch, y - 0.95 * inch, 2.35 * inch, 0.95 * inch, "MIDDLEWARE", [
        "Cookie ts_landing (sticky)",
        "Guest /  = 50/50 A|B",
        "Staff on / always see A",
        "Member /  -> Welcome back",
    ], NAVY)
    arrow(c, LEFT + 4.75 * inch, y - 0.48 * inch, LEFT + 5.05 * inch, y - 0.48 * inch)
    box(c, LEFT + 5.05 * inch, y - 0.95 * inch, 2.35 * inch, 0.95 * inch, "A  /a  TOUR", [
        "Grab Your Ticket  (purple)",
        "How it Works  (emerald)",
        "Explore Content  (gold/green)",
        "Then /join tickets",
    ], EMERALD)
    box(c, LEFT + 7.5 * inch, y - 0.95 * inch, 2.4 * inch, 0.95 * inch, "B  /b  FIRST DAY FREE", [
        "Grab Your Ticket",
        "See the program",
        "Track Your Current Workout",
        "Use your workout or ours",
    ], PURPLE)

    y = y - 1.2 * inch
    box(c, LEFT, y - 0.85 * inch, 3.2 * inch, 0.85 * inch, "PREVIEW ANY DEVICE", [
        "https://www.thetrainstation.co/a",
        "https://www.thetrainstation.co/b",
        "Works signed-in. Sets the cookie.",
    ], GOLD)
    box(c, LEFT + 3.4 * inch, y - 0.85 * inch, 3.2 * inch, 0.85 * inch, "STILL ON FILE", [
        "/l/tour  /l/jeremy  /l/floor  /l/class",
        "C and D are preview, not live split",
        "Kill switch: LANDING_AB_ENABLED",
    ], NAVY)
    box(c, LEFT + 6.8 * inch, y - 0.85 * inch, 3.1 * inch, 0.85 * inch, "NOT THE 3RD BUTTON", [
        "A/B is the whole page, not Explore",
        "3rd on A = Explore Content",
        "3rd on B = Track Current Workout",
    ], EMERALD)

    y = y - 1.05 * inch
    c.setFillColor(EMERALD)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(LEFT, y, "AFTER THE DOOR")
    y -= 0.08 * inch
    steps = [
        ("HOW IT WORKS", ["Guided overlay", "Play / Next", "Music after Play"]),
        ("/join TICKETS", ["Free / Coach $25", "Business $50", "1st $850 once"]),
        ("SIGNUP", ["Email + password", "Paid -> Stripe", "No Venmo rail"]),
        ("CHECKOUT", ["Jeremy Live Stripe", "acct_1TmKSW…", "Success -> onboard"]),
        ("RESET PASSWORD", ["/reset-password", "Not Forgot", "Email link 1 hour"]),
    ]
    x = LEFT
    bw = 1.95 * inch
    for title, lines in steps:
        box(c, x, y - 0.95 * inch, bw, 0.95 * inch, title, lines, PURPLE if "TICKET" in title else NAVY)
        x += bw + 0.1 * inch
    c.showPage()


def page2(c):
    header_footer(c, 2, "Landing  ·  Coach Class upgrade")
    c.setFillColor(NAVY_DEEP)
    c.setFont("Georgia-Bold", 18)
    c.drawString(LEFT, PAGE_H - 0.72 * inch, "Airline-style upgrade after Coach payment")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(LEFT, PAGE_H - 0.92 * inch, "Everyone who finished Coach Class Stripe sees the offer. John approves. One paying request can win the month.")

    y = PAGE_H - 1.15 * inch
    boxes = [
        (NAVY, "PAY COACH $25", ["Stripe Checkout", "plan = member", "paid on Jeremy Live"]),
        (PURPLE, "REQUEST", ["Like to join Live Zooms?", "Request Upgrade to", "Business Class"]),
        (GOLD, "WAITLIST", ["1st / 2nd / 3rd", "ahead count", "Admin Upgrades tab"]),
        (EMERALD, "APPROVE", ["Stripe sub -> $50/mo", "or stamp Business", "if no sub on file"]),
        (PURPLE, "MONTHLY DRAW", ["Paying Stripe only", "1 complimentary seat", "Coach billing stays"]),
    ]
    x = LEFT
    bw = 1.95 * inch
    for hdr, title, lines in boxes:
        box(c, x, y - 1.15 * inch, bw, 1.15 * inch, title, lines, hdr)
        x += bw + 0.1 * inch

    y = y - 1.45 * inch
    box(c, LEFT, y - 1.35 * inch, 4.8 * inch, 1.35 * inch, "WHO SEES IT", [
        "plan = member AND paymentStatus = paid",
        "Not Explorer, not already Business / 1st",
        "Lemon John is Business — no button",
        "Ali after Coach checkout — yes",
    ], NAVY)
    box(c, LEFT + 5.05 * inch, y - 1.35 * inch, 4.85 * inch, 1.35 * inch, "MONEY DESK", [
        "Jeremy = CEO   John = CFO",
        "One merchant: Jeremy Live Stripe",
        "Venmo retired 21 Sep 2026",
        "25% x 4: Fees / John Pay / Reinvest / Jeremy Pay",
    ], GOLD)
    c.showPage()


def page3(c):
    header_footer(c, 3, "Landing  ·  B console path")
    c.setFillColor(NAVY_DEEP)
    c.setFont("Georgia-Bold", 18)
    c.drawString(LEFT, PAGE_H - 0.72 * inch, "First Day Free — your workout or ours")
    y = PAGE_H - 1.05 * inch
    box(c, LEFT, y - 1.5 * inch, 4.7 * inch, 1.5 * inch, "B COPY (LIVE)", [
        "Kicker: First Day Free",
        "Headline: Use Your Workout or Ours",
        "Body: Start by seeing how the application",
        "works for you and use your own workout",
        "or one of ours.",
    ], PURPLE)
    box(c, LEFT + 4.95 * inch, y - 1.5 * inch, 4.95 * inch, 1.5 * inch, "B TAPS", [
        "Grab Your Ticket -> /join",
        "See the program -> How it Works + Jeremy",
        "Track Your Current Workout -> BYOW guest",
        "24h guest trial  ·  real email to book Jeremy",
        "Ping Zoom is Business Class and up",
    ], EMERALD)
    y = y - 1.75 * inch
    box(c, LEFT, y - 1.4 * inch, 9.9 * inch, 1.4 * inch, "WAREHOUSE GRAIN FOR THIS DOOR", [
        "WhFactLandingSession: one AnalyticsSession, keyed by Pacific date + landing A/B/C/D + UTM channel.",
        "convertedSignup / convertedPaid flags copy from the OLTP session.",
        "Do not join this fact to Stripe Checkout directly — payments live in WhFactPayment.",
        "Nightly mart-rollup loads the star. OLTP AnalyticsEvent stays the raw log.",
    ], NAVY)
    c.showPage()


def page4(c):
    header_footer(c, 4, "Landing  ·  what changed 21 Sep")
    c.setFillColor(NAVY_DEEP)
    c.setFont("Georgia-Bold", 16)
    c.drawString(LEFT, PAGE_H - 0.7 * inch, "Shipped with this pack")
    lines = [
        "Venmo off checkout, landing, and Mark paid. Stripe is the membership rail.",
        "Reset password is the public name. /reset-password  ·  /forgot-password redirects.",
        "/a and /b published. Cookie set. Signed-in preview works.",
        "Coach Class upgrade request + waitlist place + monthly paying-customer draw.",
        "Mobile welcome bar: logo + theme + menu. Today / Sign out live in the menu.",
        "A buttons: darker purple + white plate, emerald How it Works, gold/green Explore.",
        "Warehouse star started: WhDim* + WhFact* loaded from mart-rollup.",
    ]
    y = PAGE_H - 1.0 * inch
    c.setFillColor(INK)
    c.setFont("Helvetica", 10)
    for line in lines:
        c.drawString(LEFT, y, "•  " + line)
        y -= 0.28 * inch
    c.showPage()


def main():
    os.makedirs(os.path.dirname(OUT_DOCS), exist_ok=True)
    c = canvas.Canvas(OUT_DOCS, pagesize=landscape(letter))
    c.setTitle("The Train Station -- landing workflow 21 Sep 2026")
    c.setAuthor("The Train Station")
    page1(c)
    page2(c)
    page3(c)
    page4(c)
    c.save()
    desk_dir = os.path.dirname(OUT_DESK)
    if os.path.isdir(desk_dir):
        shutil.copy2(OUT_DOCS, OUT_DESK)
        print("Wrote", OUT_DOCS, "and", OUT_DESK)
    else:
        print("Wrote", OUT_DOCS)


if __name__ == "__main__":
    main()
