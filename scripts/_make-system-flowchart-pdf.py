#!/usr/bin/env python3
"""The Train Station -- system flowchart as of 18 Sep 2026."""

import math
import os
import shutil

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

OUT_DESK = "/Users/johnpopham/Desktop/Stuff/Lemon Voice/The Train Station/System-Flowchart-2026-09-18.pdf"
OUT_DOCS = "/Users/johnpopham/projects/train-station/docs/system-flowchart-2026-09-18.pdf"
LOGO = "/Users/johnpopham/projects/train-station/public/images/logo.png"

pdfmetrics.registerFont(TTFont("Georgia", "/System/Library/Fonts/Supplemental/Georgia.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Bold", "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Italic", "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"))

PAGE_W, PAGE_H = landscape(letter)
LEFT = 0.48 * inch
RIGHT = 0.48 * inch
TOP = 0.42 * inch
BOTTOM = 0.42 * inch

NAVY = colors.HexColor("#1B3A6B")
NAVY_DEEP = colors.HexColor("#0F2444")
CREAM = colors.HexColor("#F4F1EA")
INK = colors.HexColor("#1C1917")
MUTED = colors.HexColor("#57534E")
RULE = colors.HexColor("#D6D0C4")
WHITE = colors.white
EMERALD = colors.HexColor("#047857")
EMERALD_MID = colors.HexColor("#10b981")
EMERALD_PALE = colors.HexColor("#ECFDF5")
PURPLE = colors.HexColor("#5B21B6")
PURPLE_PALE = colors.HexColor("#EDE9FE")
VIOLET = colors.HexColor("#7C3AED")
CARD = colors.HexColor("#FFFEFB")
PALE = colors.HexColor("#EEF2F7")
ROSE = colors.HexColor("#F8E8E2")
AMBER_PALE = colors.HexColor("#FEF3C7")
SILVER = colors.HexColor("#E5E7EB")


def header_footer(c, page, title):
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(NAVY_DEEP)
    c.rect(0, PAGE_H - 0.34 * inch, PAGE_W, 0.34 * inch, fill=1, stroke=0)
    c.setFillColor(EMERALD_MID)
    c.rect(0, PAGE_H - 0.34 * inch, 0.14 * inch, 0.34 * inch, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Georgia", 8)
    c.drawString(LEFT, PAGE_H - 0.22 * inch, "THE TRAIN STATION")
    c.setFont("Helvetica", 8)
    c.drawRightString(PAGE_W - RIGHT, PAGE_H - 0.22 * inch, title)
    c.setFillColor(NAVY_DEEP)
    c.rect(0, 0, PAGE_W, 0.32 * inch, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 7.5)
    c.drawString(LEFT, 0.12 * inch, "System as of 18 Sep 2026  ·  live: thetrainstation.co  ·  not for members")
    c.drawRightString(PAGE_W - RIGHT, 0.12 * inch, f"Page {page}")


def rounded(c, x, y, w, h, fill, stroke, sw=0.8, r=6):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(sw)
    c.roundRect(x, y, w, h, r, fill=1, stroke=1)


def box(c, x, y, w, h, title, lines, header=NAVY, body=CARD, ink=INK):
    rounded(c, x, y, w, h, body, header, 0.9, 5)
    head_h = 14
    c.setFillColor(header)
    c.roundRect(x, y + h - head_h, w, head_h, 5, fill=1, stroke=0)
    c.rect(x, y + h - head_h, w, 6, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 7.2)
    c.drawString(x + 6, y + h - 10.5, title)
    c.setFillColor(ink)
    c.setFont("Helvetica", 6.6)
    ty = y + h - head_h - 11
    for line in lines:
        if ty < y + 5:
            break
        c.drawString(x + 6, ty, line)
        ty -= 9
    return x, y, w, h


def pill(c, x, y, w, h, text, fill, ink=WHITE):
    rounded(c, x, y, w, h, fill, fill, 0, 8)
    c.setFillColor(ink)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(x + w / 2, y + 5, text)


def arrow(c, x1, y1, x2, y2, col=NAVY, label=""):
    c.setStrokeColor(col)
    c.setFillColor(col)
    c.setLineWidth(1.1)
    c.line(x1, y1, x2, y2)
    ang = math.atan2(y2 - y1, x2 - x1)
    size = 6
    a1 = ang + math.pi * 0.82
    a2 = ang - math.pi * 0.82
    path = c.beginPath()
    path.moveTo(x2, y2)
    path.lineTo(x2 + size * math.cos(a1), y2 + size * math.sin(a1))
    path.lineTo(x2 + size * math.cos(a2), y2 + size * math.sin(a2))
    path.close()
    c.drawPath(path, fill=1, stroke=0)
    if label:
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6)
        c.drawCentredString((x1 + x2) / 2, (y1 + y2) / 2 + 4, label)


def h_arrow(c, x1, x2, y, col=NAVY, label=""):
    arrow(c, x1, y, x2, y, col, label)


def v_arrow(c, x, y1, y2, col=NAVY, label=""):
    arrow(c, x, y1, x, y2, col, label)


def kicker(c, text, y):
    c.setFillColor(EMERALD)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(LEFT, y, text.upper())


def h1(c, text, y):
    c.setFillColor(NAVY_DEEP)
    c.setFont("Georgia-Bold", 16)
    c.drawString(LEFT, y, text)


def note(c, text, y, max_w=None):
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(LEFT, y, text)


def page1(c):
    header_footer(c, 1, "System flowchart  ·  map of maps")
    if os.path.exists(LOGO):
        c.drawImage(LOGO, LEFT, PAGE_H - 1.28 * inch, width=0.62 * inch, height=0.62 * inch, mask="auto")
    c.setFillColor(NAVY_DEEP)
    c.setFont("Georgia-Bold", 22)
    c.drawString(LEFT + 0.74 * inch, PAGE_H - 0.78 * inch, "How The Train Station works today")
    c.setFillColor(MUTED)
    c.setFont("Georgia-Italic", 10)
    c.drawString(LEFT + 0.74 * inch, PAGE_H - 0.98 * inch, "One site. Four rooms. One Postgres. Jeremy coaches; the app holds the floor.")
    c.setFillColor(EMERALD)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(LEFT + 0.74 * inch, PAGE_H - 1.16 * inch, "Brand trim is emerald green (was gold)  ·  13 Sep 2026")

    y = PAGE_H - 1.55 * inch
    layers = [
        (PURPLE, "1  PUBLIC", "thetrainstation.co", [
            "Landing A/B (cookie ts_landing)",
            "A Tour  ·  B Meet Jeremy  ·  C Floor preview",
            "Join / tickets  ·  Signup  ·  Login",
            "How it Works  ·  See inside tour",
        ]),
        (EMERALD, "2  MEMBER APP", "/member/*", [
            "Today  ·  workout console  ·  rest timer",
            "Messages  ·  Scores  ·  Gear  ·  Measure",
            "Nutrition + shopping list",
            "Book 15-min intro (pester until booked)",
        ]),
        (NAVY, "3  COACH APP", "/admin/*", [
            "Day hub  ·  Go to Today  ·  Live Floor",
            "Programs calendar (Adult 0-30 / 30-60)",
            "Members  ·  Queue  ·  Bookings  ·  Chat",
            "Videos  ·  Grocery  ·  Landing  ·  Settings",
        ]),
        (colors.HexColor("#374151"), "4  PLATFORM", "John + Jeremy ops", [
            "Billing  ·  Pricing  ·  Discounts",
            "Accounting books  ·  Money desk",
            "SEO  ·  Audit  ·  Users  ·  Offers",
            "Analytics (first-party Postgres)",
        ]),
    ]
    bw = 2.35 * inch
    gap = 0.16 * inch
    x = LEFT
    for header, title, sub, lines in layers:
        box(c, x, y - 1.72 * inch, bw, 1.72 * inch, title, [sub] + lines, header)
        if x > LEFT:
            h_arrow(c, x - gap + 2, x - 2, y - 0.86 * inch, MUTED)
        x += bw + gap

    y = y - 2.05 * inch
    kicker(c, "Under the floor", y)
    y -= 0.18 * inch
    rails = [
        (EMERALD, "Postgres", "Supabase train-station-catalog  ·  Prisma  ·  every product fact lives here"),
        (VIOLET, "Vercel", "main = prod thetrainstation.co  ·  Next.js app + API routes"),
        (colors.HexColor("#635BFF"), "Stripe LIVE", "Jeremy merchant  ·  Coach $25 / Business $50 / 1st $850"),
        (colors.HexColor("#008CFF"), "Venmo", "@JeremyByrdCSCS  ·  coach Mark paid (not auto)"),
        (colors.HexColor("#0B5CFF"), "Zoom", "Jeremy Connect  ·  live class + 15-min intro"),
        (colors.HexColor("#006BFF"), "Calendly", "Book Call webhook  ·  Booking row in Postgres"),
    ]
    bw = 3.5 * inch
    bh = 0.42 * inch
    for i, (col, title, line) in enumerate(rails):
        col_i = i % 2
        row = i // 2
        xx = LEFT + col_i * (bw + 0.22 * inch)
        yy = y - 0.18 * inch - row * (bh + 0.1 * inch) - bh
        rounded(c, xx, yy, bw, bh, CARD, col, 1.1, 5)
        c.setFillColor(col)
        c.rect(xx, yy, 5, bh, fill=1, stroke=0)
        c.setFillColor(NAVY_DEEP)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(xx + 12, yy + 24, title)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 7)
        c.drawString(xx + 12, yy + 10, line)

    y = 0.55 * inch
    rounded(c, LEFT, y, PAGE_W - LEFT - RIGHT, 0.72 * inch, EMERALD_PALE, EMERALD, 1, 6)
    c.setFillColor(EMERALD)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(LEFT + 12, y + 0.48 * inch, "Read this pack left to right")
    c.setFillColor(INK)
    c.setFont("Helvetica", 8)
    c.drawString(LEFT + 12, y + 0.30 * inch, "Page 2  Guest journey and landing A/B.   Page 3  Tickets, checkout, onboard, 15-min intro.")
    c.drawString(LEFT + 12, y + 0.16 * inch, "Page 4  Member app.   Page 5  Coach app.   Page 6  Live class + workout.   Page 7  Money.   Page 8  Data.   Page 9  Loop tests.")
    c.showPage()


def page2(c):
    header_footer(c, 2, "Guest journey  ·  one URL")
    kicker(c, "The door", PAGE_H - 0.58 * inch)
    h1(c, "Jeremy posts thetrainstation.co. The site splits the room.", PAGE_H - 0.82 * inch)
    note(c, "Members skip the experiment and land in the app. Staff always see A (current homepage). Guests get a sticky cookie.", PAGE_H - 1.02 * inch)

    y = PAGE_H - 1.22 * inch
    box(c, LEFT, y - 0.78 * inch, 1.7 * inch, 0.78 * inch, "TRAFFIC", [
        "Instagram -> Safari",
        "Facebook in-app",
        "Direct / QR / text",
    ], PURPLE)
    h_arrow(c, LEFT + 1.7 * inch, LEFT + 2.05 * inch, y - 0.39 * inch)
    box(c, LEFT + 2.05 * inch, y - 0.78 * inch, 2.15 * inch, 0.78 * inch, "MIDDLEWARE", [
        "/  + cookie ts_landing",
        "50/50  A tour  |  B jeremy",
        "C floor is preview only",
    ], NAVY)
    h_arrow(c, LEFT + 4.2 * inch, LEFT + 4.55 * inch, y - 0.39 * inch)

    box(c, LEFT + 4.55 * inch, y - 0.78 * inch, 2.15 * inch, 0.78 * inch, "A  TOUR  (control)", [
        "Current homepage -- stays",
        "How it Works  ·  See inside",
        "Start membership -> /join",
    ], EMERALD)
    box(c, LEFT + 6.85 * inch, y - 0.78 * inch, 2.15 * inch, 0.78 * inch, "B  MEET JEREMY", [
        "First screen is Jeremy",
        "Play intro  ·  Start Free",
        "Same tickets after",
    ], VIOLET)
    h_arrow(c, LEFT + 6.7 * inch, LEFT + 6.85 * inch, y - 0.39 * inch, MUTED)

    y = y - 1.05 * inch
    box(c, LEFT + 4.55 * inch, y - 0.62 * inch, 2.15 * inch, 0.62 * inch, "PREVIEW  /l/floor", [
        "C  first hour = one set",
        "Not in the live split",
    ], colors.HexColor("#6B7280"))
    box(c, LEFT + 6.85 * inch, y - 0.62 * inch, 2.15 * inch, 0.62 * inch, "PREVIEW DOORS", [
        "/l/tour  /l/jeremy  /l/floor",
        "Staff bar on homepage",
    ], colors.HexColor("#6B7280"))

    y = y - 0.88 * inch
    kicker(c, "Once they are inside the public site", y)
    y -= 0.12 * inch
    steps = [
        ("SEE INSIDE TOUR", ["Sets, rest, confetti demo", "Ends on four tickets", "Free gag video on Free"]),
        ("HOW IT WORKS", ["Guided overlay + voice", "One audio element", "Next/Back from the tap"]),
        ("/join  TICKETS", ["Free  ·  Coach $25", "Business $50  ·  1st $850", "/pricing redirects here"]),
        ("/signup?plan=", ["Account + password", "Paid -> checkout", "Free -> onboard"]),
        ("LOGIN / OAUTH", ["Email  ·  Google / Apple", "Forgot password", "iOS logout = form POST"]),
    ]
    bw = 1.95 * inch
    x = LEFT
    for title, lines in steps:
        box(c, x, y - 0.92 * inch, bw, 0.92 * inch, title, lines, PURPLE if "TICKET" in title else NAVY)
        if x > LEFT:
            h_arrow(c, x - 0.12 * inch, x, y - 0.46 * inch, MUTED)
        x += bw + 0.12 * inch

    y = y - 1.18 * inch
    rounded(c, LEFT, y - 1.28 * inch, PAGE_W - LEFT - RIGHT, 1.28 * inch, PALE, NAVY, 0.8, 6)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(LEFT + 10, y - 0.18 * inch, "What the analytics already told us (do not forget)")
    c.setFillColor(INK)
    c.setFont("Helvetica", 8)
    lines = [
        "Homepage is the storefront (~80% of guest sessions). Bounce is the leak, not the app.",
        "Fri 11 Sep = Instagram to Safari (blank referrer). Wed 9 Sep = Facebook in-app (FBAN).",
        "One post URL hits the A/B door. Tour curiosity is not conversion.",
        "Join and Signup ping-pong. Free explorers wander unless they book Jeremy.",
        "Kill switch: LANDING_AB_ENABLED in src/lib/landing-ab.ts. Live arms: tour + jeremy. Floor stays /l/floor.",
    ]
    ty = y - 0.38 * inch
    for line in lines:
        c.drawString(LEFT + 10, ty, line)
        ty -= 0.16 * inch
    c.showPage()


def page3(c):
    header_footer(c, 3, "Tickets  ·  checkout  ·  onboard  ·  15-min intro")
    kicker(c, "The four seats", PAGE_H - 0.58 * inch)
    h1(c, "Pick a ticket. Paid seats hit checkout. Free is a lead, not a product.", PAGE_H - 0.82 * inch)

    seats = [
        (PURPLE, "FREE EXPLORER", "$0", ["Lead so they can know Jeremy", "No Stripe", "Onboard + 15-min pester", "Today still opens"]),
        (VIOLET, "COACH CLASS", "$25 / mo", ["Subscription  ·  Stripe LIVE", "Or Venmo + Mark paid", "3-day trial is checkout-only", "Personal 28-day Adult month"]),
        (colors.HexColor("#6B7280"), "BUSINESS CLASS", "$50 / mo", ["Subscription", "Quick maintain extras", "Same intro booking", "Silver trim on purple"]),
        (EMERALD, "1ST CLASS", "$850 once", ["One-time  ·  not monthly", "8 x 1-hr private / 30 days", "Emerald trim (was gold)", "Full site access"]),
    ]
    bw = 2.35 * inch
    x = LEFT
    y = PAGE_H - 1.0 * inch
    for header, title, price, lines in seats:
        box(c, x, y - 1.28 * inch, bw, 1.28 * inch, f"{title}   {price}", lines, header)
        x += bw + 0.14 * inch

    y = y - 1.52 * inch
    kicker(c, "Money in", y)
    y -= 0.1 * inch
    box(c, LEFT, y - 1.35 * inch, 3.55 * inch, 1.35 * inch, "STRIPE  (card)", [
        "Checkout Session  ·  subscription or one-time",
        "Webhook marks paymentStatus = paid",
        "100% (minus Stripe 2.9% + $0.30) -> Jeremy",
        "Live keys on Vercel Production",
        "No $1/day SKU -- the 30-cent fee eats it",
    ], colors.HexColor("#635BFF"))
    h_arrow(c, LEFT + 3.55 * inch, LEFT + 3.85 * inch, y - 0.68 * inch)
    box(c, LEFT + 3.85 * inch, y - 1.35 * inch, 3.05 * inch, 1.35 * inch, "VENMO  (backup rail)", [
        "QR + @JeremyByrdCSCS on checkout",
        "Same business bank story as Stripe",
        "NOT automatic -- coach Mark paid",
        "Admin -> Members or Queue",
        "Same paid path in the app after",
    ], colors.HexColor("#008CFF"))
    h_arrow(c, LEFT + 6.9 * inch, LEFT + 7.2 * inch, y - 0.68 * inch)
    box(c, LEFT + 7.2 * inch, y - 1.35 * inch, 2.28 * inch, 1.35 * inch, "THEN", [
        "Onboard questions",
        "programStartDate stamped",
        "Book 15-min is the purple",
        "  button on every seat",
        "Today is not locked",
    ], EMERALD)

    y = y - 1.58 * inch
    kicker(c, "15-minute intro  --  almost mandatory, not a lock", y)
    y -= 0.08 * inch
    box(c, LEFT, y - 1.15 * inch, PAGE_W - LEFT - RIGHT, 1.15 * inch, "BOOKING LOOP", [
        "Onboard CTA = Book 15 min with Jeremy (Calendly embed). Today still opens so they can train.",
        "MemberBookIntroPester bar stays until a Booking row exists. Natasha Simmen already has an intro stamp -- no outreach.",
        "Calendly webhook writes Booking in Postgres. Coach sees it in Admin -> Bookings / Alerts.",
        "Free is a lead source so they can know the coach. Working out is personal; not knowing Jeremy is the barrier.",
        "Do not email, SMS, or chase Natasha. Leave Free. Internal Calendly backfill is OK.",
    ], EMERALD, EMERALD_PALE)
    c.showPage()


def page4(c):
    header_footer(c, 4, "Member app")
    kicker(c, "Once they have a seat", PAGE_H - 0.58 * inch)
    h1(c, "The member app is a phone floor. Logo is Home. Today is the work.", PAGE_H - 0.82 * inch)

    y = PAGE_H - 1.0 * inch
    box(c, LEFT, y - 1.55 * inch, 2.2 * inch, 1.55 * inch, "TOP  ·  LOGO = HOME", [
        "Logo -> landing / home",
        "No house icon on Today",
        "Join strip when class is live",
        "  (compact, right side)",
        "Text size in Account",
        "Sign out = form POST 303",
    ], PURPLE)
    h_arrow(c, LEFT + 2.2 * inch, LEFT + 2.48 * inch, y - 0.78 * inch)
    navs = [
        ("TODAY", ["Personal 28-day month", "Not the gym calendar", "Day wheel + workout", "Fasted cardio = 35 min"]),
        ("MESSAGES", ["1:1 with Jeremy", "Unread badge", "Open during pending pay"]),
        ("SCORES", ["Points / leaderboard", "Confetti on finish", "Emerald +N celebrate"]),
        ("GEAR", ["Equipment shop", "Amazon links", "Home vs gym filter"]),
    ]
    x = LEFT + 2.48 * inch
    bw = 1.7 * inch
    for title, lines in navs:
        box(c, x, y - 1.55 * inch, bw, 1.55 * inch, title, lines, EMERALD if title == "TODAY" else NAVY)
        x += bw + 0.08 * inch

    y = y - 1.75 * inch
    box(c, LEFT, y - 1.35 * inch, 2.2 * inch, 1.35 * inch, "MORE", [
        "Measure  (tapes + photos)",
        "Partners  (Eco Delight)",
        "Book Call  (Calendly)",
        "Account  (tier, tips, logout)",
        "Nutrition desk in header",
    ], NAVY)
    h_arrow(c, LEFT + 2.2 * inch, LEFT + 2.48 * inch, y - 0.68 * inch)
    box(c, LEFT + 2.48 * inch, y - 1.35 * inch, 3.55 * inch, 1.35 * inch, "NUTRITION", [
        "Breakfast / Lunch / Dinner ideas",
        "Shopping list -- two-column phone checklist",
        "Trainstationize against Jeremy's cleanse table",
        "Coach edits Admin -> Grocery list",
        "Book a nutrition appointment (Calendly)",
    ], colors.HexColor("#15803D"))
    box(c, LEFT + 6.15 * inch, y - 1.35 * inch, 2.85 * inch, 1.35 * inch, "GATES", [
        "Payment pending -> checkout",
        "  (Messages / Book / Account open)",
        "Intake pending -> onboard",
        "Intro not booked -> pester bar",
        "Live class -> Join / Ping Coach",
    ], colors.HexColor("#9A3412"), ROSE)

    y = y - 1.55 * inch
    kicker(c, "Today  --  the actual workout", y)
    y -= 0.08 * inch
    steps = [
        ("DAY WHEEL", ["Their month, not Adult gym", "Today chip = emerald", "Catch-up allowed"]),
        ("WARM-UP GROUP", ["Timed block", "Not restacked as slot 1", "Cool Down is its own slot"]),
        ("SETS", ["Check a set -> rest", "Rest = restActive only", "Buzzer = transient"]),
        ("TIMED WORK", ["Fasted cardio 35:00", "One timer, not 3 sets", "Podcasts stay ambient"]),
        ("DONE", ["Confetti + points", "Day stamp", "Scores update"]),
    ]
    bw = 1.95 * inch
    x = LEFT
    for title, lines in steps:
        box(c, x, y - 1.05 * inch, bw, 1.05 * inch, title, lines, EMERALD)
        if x > LEFT:
            h_arrow(c, x - 0.1 * inch, x, y - 0.52 * inch, EMERALD)
        x += bw + 0.1 * inch
    c.showPage()


def page5(c):
    header_footer(c, 5, "Coach app")
    kicker(c, "Jeremy's desk", PAGE_H - 0.58 * inch)
    h1(c, "Plan the day. Put people on it. Coach live. Edit the catalog when you must.", PAGE_H - 0.82 * inch)

    groups = [
        (NAVY, "OVERVIEW", [
            "Dashboard / Day hub  /admin/day",
            "Plan class  ·  pick roster  ·  Deploy",
            "Wrong day? Move this class",
            "Do not wipe the draft on Today/Tomorrow",
        ]),
        (EMERALD, "LIVE", [
            "Go to Today  /admin/today",
            "Live Floor  /admin/live",
            "Assign  ·  Lesson plan",
            "Zoom host tools  ·  checkoffs",
        ]),
        (PURPLE, "PEOPLE", [
            "Members  ·  member cards",
            "Queue  ·  Mark paid (Venmo)",
            "Leads  ·  Bookings  ·  Alerts",
            "Messages 1:1",
        ]),
        (colors.HexColor("#0F766E"), "CONTENT", [
            "Programs calendar builder",
            "Adult Home/Gym 0-30 / 30-60",
            "Workouts  ·  Templates  ·  Exercises",
            "Videos  ·  Equipment  ·  Grocery",
        ]),
        (colors.HexColor("#6B7280"), "SITE", [
            "Landing media + Venmo QR",
            "SEO  ·  Settings  ·  Theme Song",
            "Gamification  ·  Sponsorships",
            "Discount codes",
        ]),
        (colors.HexColor("#374151"), "PLATFORM (John)", [
            "Billing  ·  Accounting books",
            "Money desk / commission",
            "Pricing  ·  Offers  ·  Users",
            "Audit  ·  Insights  ·  Reports",
        ]),
    ]
    bw = 3.35 * inch
    bh = 1.22 * inch
    y = PAGE_H - 1.02 * inch
    for i, (header, title, lines) in enumerate(groups):
        col = i % 3
        row = i // 3
        xx = LEFT + col * (bw + 0.16 * inch)
        yy = y - row * (bh + 0.14 * inch) - bh
        box(c, xx, yy, bw, bh, title, lines, header)

    y = y - 2 * (bh + 0.14 * inch) - 0.08 * inch
    kicker(c, "Adult calendar builder  --  what broke and the rule now", y)
    y -= 0.08 * inch
    box(c, LEFT, y - 1.28 * inch, PAGE_W - LEFT - RIGHT, 1.28 * inch, "0-30  /  30-60  COLUMNS", [
        "Jeremy's mouse: click a slot, add Cool Down / Meal Prep, delete -- the last exercise used to jump to the top.",
        "Cause was column math + pin-on-load, not the Cool Down name. GET no longer re-pins. Delete leaves a hole. Add fills the clicked slot.",
        "5+4 rebalance used to grow the left column and jump items. Left width is locked; extras grow the right only. Blur saves the focused card.",
        "Do not compact PATCH on assignSlot. Do not restack on save. Cool Down is not a warmup. Meal Prep can sit after Cool Down.",
        "Video: Sept 12 fixes.mp4  ·  shipped ebd57bd and follow-ups.",
    ], colors.HexColor("#9A3412"), ROSE)
    c.showPage()


def page6(c):
    header_footer(c, 6, "Live class  ·  workout console  ·  audio")
    kicker(c, "When Jeremy is on the floor", PAGE_H - 0.58 * inch)
    h1(c, "A class is a subset of the roster. Unassigned members stay on their own month.", PAGE_H - 0.82 * inch)

    y = PAGE_H - 1.02 * inch
    steps = [
        ("COACH PLANS", ["Day hub", "Pick workout", "Pick who gets it", "Deploy"]),
        ("ZOOM CONNECT", ["jeremy@… host", "Marketplace app", "Do not disconnect", "  in soaks"]),
        ("MEMBERS JOIN", ["Join / Rejoin", "Ping Coach", "Landscape strip stays", "Assigned only"]),
        ("LIVE CHECKOFFS", ["Coach + member sets", "SSE + tab-focus", "No poll faster than 5s", "restActive only"]),
        ("CLASS MOVES", ["Wrong day? Move", "POST /api/today/move", "Change workout mid-class", "Stamp bumps Today"]),
    ]
    bw = 1.95 * inch
    x = LEFT
    for title, lines in steps:
        box(c, x, y - 1.22 * inch, bw, 1.22 * inch, title, lines, EMERALD if "CHECK" in title else NAVY)
        if x > LEFT:
            h_arrow(c, x - 0.1 * inch, x, y - 0.61 * inch)
        x += bw + 0.1 * inch

    y = y - 1.5 * inch
    kicker(c, "Audio  --  copy the working implementations. Do not invent a second player.", y)
    y -= 0.1 * inch
    box(c, LEFT, y - 1.55 * inch, 3.4 * inch, 1.55 * inch, "AMBIENT  (default)", [
        "Safari audioSession = ambient",
        "Keep-awake video on Today",
        "Silent rest primes",
        "Podcasts / Music keep playing",
        "Never resume our music on tab-visible",
    ], EMERALD, EMERALD_PALE)
    box(c, LEFT + 3.55 * inch, y - 1.55 * inch, 3.4 * inch, 1.55 * inch, "TRANSIENT  (buzzer)", [
        "Rest horn / message whistle",
        "Ducks, then they can keep listening",
        "Fasted cardio buzzer at 35:00",
        "One HTMLAudio element (rest-audio.ts)",
        "No new Audio() per play",
    ], colors.HexColor("#B45309"), AMBER_PALE)
    box(c, LEFT + 7.1 * inch, y - 1.55 * inch, 2.38 * inch, 1.55 * inch, "PLAYBACK", [
        "Theme Song",
        "Intros",
        "How it Works voice",
        "Only if they started it",
        "One element, one play()",
    ], PURPLE, PURPLE_PALE)

    y = y - 1.78 * inch
    rounded(c, LEFT, y - 0.95 * inch, PAGE_W - LEFT - RIGHT, 0.95 * inch, PALE, NAVY, 0.8, 6)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(LEFT + 10, y - 0.18 * inch, "Hard rules while this is live")
    c.setFillColor(INK)
    c.setFont("Helvetica", 8)
    c.drawString(LEFT + 10, y - 0.38 * inch, "Never hot-poll Postgres faster than 5 seconds. Idle screens: one GET, SSE, refresh on tab-focus. Rest-timer 200ms tick is local UI only.")
    c.drawString(LEFT + 10, y - 0.56 * inch, "Always use Postgres for product state. Blob/JSON is migration debt. Binary media (images, short video) may live in Blob; URLs + fields still in Postgres.")
    c.drawString(LEFT + 10, y - 0.74 * inch, "John & Steph live class pick: john@lemonvoice.com + sprealty9@gmail.com. Do not auto-select the whole roster on Assign.")
    c.showPage()


def page7(c):
    header_footer(c, 7, "Money")
    kicker(c, "One business", PAGE_H - 0.58 * inch)
    h1(c, "Stripe and Venmo both fund Jeremy's Train Station. John is not a second merchant.", PAGE_H - 0.82 * inch)

    y = PAGE_H - 1.02 * inch
    box(c, LEFT, y - 1.85 * inch, 4.7 * inch, 1.85 * inch, "TODAY  (coded)", [
        "Member pays -> Jeremy master Stripe (manual payouts)",
        "Autos to Financial Account are OFF; look then pay",
        "Admin Stripe money: 25% x4 buckets of visible cash",
        "Platform + John Pay -> John's Stripe, HOLD until Mercury",
        "Reinvest -> Train Station Mercury (hold in FA until open)",
        "Jeremy Pay -> currently mapped Stripe payout",
        "No outflow until monthly bills x4 ($85 -> $340)",
    ], NAVY)
    box(c, LEFT + 4.9 * inch, y - 1.85 * inch, 4.58 * inch, 1.85 * inch, "DRAFT PARTNERSHIP  (not coded, not signed)", [
        "Tax brackets on Gross MRR:",
        "  first $5k always 5% to John",
        "  $5k-$15k always 30%",
        "  above $15k always 50/50",
        "Contract: docs/partnership-drafts…/10-Partnership-Agreement-DRAFT.pdf",
        "Not legal advice. Recode Admin after counsel.",
        "BYOW ($2.99 app, $10 Jeremy week) stays preview.",
    ], EMERALD, EMERALD_PALE)

    y = y - 2.08 * inch
    kicker(c, "Tickets vs fees", y)
    y -= 0.08 * inch
    box(c, LEFT, y - 1.15 * inch, 3.1 * inch, 1.15 * inch, "KEEP", [
        "Coach Class $25 / mo  (the goal)",
        "Business Class $50 / mo",
        "1st Class $850 one-time",
        "Tips  $5 / $10 / $25 / $50",
    ], EMERALD, EMERALD_PALE)
    box(c, LEFT + 3.25 * inch, y - 1.15 * inch, 3.1 * inch, 1.15 * inch, "DROPPED", [
        "$1 / day  -- Stripe $0.30 eats it",
        "10 cents a minute",
        "Three buy-button SKUs",
        "$10 / week as a live SKU",
    ], colors.HexColor("#9A3412"), ROSE)
    box(c, LEFT + 6.5 * inch, y - 1.15 * inch, 2.98 * inch, 1.15 * inch, "PARKED", [
        "Twilio SMS  (Messages exists)",
        "BYOW platform  (preview doc)",
        "App Store later",
        "Supabase still Free -- backups!",
    ], colors.HexColor("#92400E"), AMBER_PALE)

    y = y - 1.38 * inch
    rounded(c, LEFT, y - 0.85 * inch, PAGE_W - LEFT - RIGHT, 0.85 * inch, PALE, NAVY, 0.8, 6)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(LEFT + 10, y - 0.18 * inch, "Do not")
    c.setFillColor(INK)
    c.setFont("Helvetica", 8)
    c.drawString(LEFT + 10, y - 0.38 * inch, "Put a second merchant secret on Vercel for John. Assume checkout auto-splits to John's bank. Treat Venmo as a different company.")
    c.drawString(LEFT + 10, y - 0.56 * inch, "Grant landing_free_week unpaid. Skip the 15-min book as if Free were the product. Post /l/jeremy -- post thetrainstation.co only.")
    c.showPage()


def page8(c):
    header_footer(c, 8, "Data  ·  integrations  ·  identity")
    kicker(c, "System of record", PAGE_H - 0.58 * inch)
    h1(c, "PostgreSQL (Prisma) is the app. Everything else is a rail.", PAGE_H - 0.82 * inch)

    y = PAGE_H - 1.0 * inch
    ents = [
        (NAVY, "USER", ["role coach / member", "plan + paymentStatus", "programStartDate", "quick-auth / session"]),
        (PURPLE, "PROGRAM", ["Adult / Strength / …", "weeks + days + slots", "Home vs Gym", "templates / paste"]),
        (EMERALD, "WORKOUT", ["exercises + sets", "warmup / cooldown", "timed hold (35 min)", "logs + catch-up"]),
        (colors.HexColor("#0F766E"), "ENROLLMENT", ["personal 28-day month", "Day 1 = Adult W1D1", "Todd exception Day 2", "location home/gym"]),
        (colors.HexColor("#B45309"), "BOOKING", ["Calendly event", "intro 15-min", "nutrition appt", "reschedule fields"]),
        (colors.HexColor("#635BFF"), "MONEY", ["FA + payments wallets", "MoneyDeskSettings 25%x4", "$340 savings floor", "Venmo mark-paid"]),
        (VIOLET, "LIVE", ["CoachTodaySession", "userIds subset", "Zoom day", "restActive"]),
        (colors.HexColor("#374151"), "ANALYTICS", ["AnalyticsSession", "AnalyticsEvent", "landingVariant", "first-party only"]),
    ]
    bw = 2.35 * inch
    bh = 1.12 * inch
    for i, (header, title, lines) in enumerate(ents):
        col = i % 4
        row = i // 4
        xx = LEFT + col * (bw + 0.14 * inch)
        yy = y - row * (bh + 0.12 * inch) - bh
        box(c, xx, yy, bw, bh, title, lines, header)

    y = y - 2 * (bh + 0.12 * inch) - 0.1 * inch
    kicker(c, "Who is who on this system", y)
    y -= 0.08 * inch
    box(c, LEFT, y - 1.22 * inch, 4.7 * inch, 1.22 * inch, "PEOPLE", [
        "Jeremy  jeremy@thetrainstation.co  -- coach, merchant, Zoom host",
        "John admin  john@thetrainstation.co  -- app admin",
        "Lemon John / Steph / Ali -- Business Class standing staff grants",
        "Vercel/GitHub  john@bcxvoice.com  -- deploys only, not a member",
        "Natasha  tangledsigns@gmail.com  -- Free, no outreach",
    ], NAVY)
    box(c, LEFT + 4.9 * inch, y - 1.22 * inch, 4.58 * inch, 1.22 * inch, "VENDORS", [
        "Vercel project train-station -> thetrainstation.co",
        "Supabase org johnepop's projects  ·  catalog mattccorhcxghwyfgklp",
        "Do not Resume the paused duplicate dptxndclpkezrqrsdezf",
        "Twilio parked  ·  Resend email  ·  Calendly webhook",
        "xAI Grok for Trainstationize / help -- not a second coach",
    ], colors.HexColor("#374151"))
    c.showPage()


def page9(c, loop):
    header_footer(c, 9, "Loop tests  ·  emerald sweep  ·  what is live")
    kicker(c, "18 Sep 2026 sweep", PAGE_H - 0.58 * inch)
    h1(c, "Links hold. Money desk is live. Workflows that need a coach password stay gated.", PAGE_H - 0.82 * inch)

    y = PAGE_H - 1.0 * inch
    box(c, LEFT, y - 1.55 * inch, 4.7 * inch, 1.55 * inch, "EMERALD SWEEP", [
        "--ramp-gold token is now #10b981 (emerald)",
        "1st Class trim, tickets, tour CTA, score +N",
        "How it Works, confetti, inbox chips, set-done",
        "Coach dashboard CTAs, day-wheel Today chip",
        "Amber warnings (forgot password, resume strip) stay amber",
        "CSS class names still say gold; they render emerald",
    ], EMERALD, EMERALD_PALE)
    box(c, LEFT + 4.9 * inch, y - 1.55 * inch, 4.58 * inch, 1.55 * inch, "SITE LOOP SWEEP  (prod)", [
        f"Pages probed: {loop.get('pages', '87')}  ·  bad: {loop.get('pages_bad', '0')}",
        f"Public APIs: {loop.get('apis', '9/9')}",
        f"Process-flow APIs (401 unauth): {loop.get('flows', '17/17')}",
        f"Dead hrefs: {loop.get('dead', '0')}",
        f"Landing A/B loop: {loop.get('ab', '39/39')}",
        f"Landing -> paid loop: {loop.get('paid', '94/95')}",
        f"Coach-auth full-site loop: {loop.get('coach', 'login skipped')}",
    ], NAVY)

    y = y - 1.75 * inch
    box(c, LEFT, y - 1.55 * inch, PAGE_W - LEFT - RIGHT, 1.55 * inch, "SHIPPED THIS WEEK + THIS PACK", [
        "Admin Stripe money: FA wallet, 25%x4 buckets, $340 savings floor, rails to John Stripe / TS Mercury / Jeremy mapped",
        "Manual payouts on Jeremy Live; FA transfer_all off; standing Business Class for Steph / Ali / John",
        "Landing A/B, set-log finger, usage Day/Week/Month, allaboard.fit 308 to /l/class",
        "Partnership tax brackets still draft (not coded). BYOW stays preview.",
    ], PURPLE, PURPLE_PALE)

    y = y - 1.75 * inch
    rounded(c, LEFT, y - 1.05 * inch, PAGE_W - LEFT - RIGHT, 1.05 * inch, EMERALD_PALE, EMERALD, 1, 6)
    c.setFillColor(EMERALD)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(LEFT + 12, y - 0.22 * inch, "If you only remember four arrows")
    c.setFillColor(INK)
    c.setFont("Helvetica", 8.5)
    c.drawString(LEFT + 12, y - 0.42 * inch, "1.  Post hits /  ->  A or B  ->  ticket  ->  checkout or Free onboard  ->  book 15 min  ->  Today.")
    c.drawString(LEFT + 12, y - 0.60 * inch, "2.  Jeremy plans a class  ->  assigns a subset  ->  Zoom  ->  checkoffs. Everyone else stays on their own month.")
    c.drawString(LEFT + 12, y - 0.78 * inch, "3.  Card money lands in Jeremy's Stripe (manual). Hold to $340. Then 25% fees+John / reinvest / Jeremy. Venmo is the same company after Mark paid.")
    c.drawString(LEFT + 12, y - 0.96 * inch, "4.  Postgres is the truth. Don't poll it. Don't steal the phone's podcast. Don't restack Jeremy's columns.")
    c.showPage()


def main():
    loop = {
        "pages": "95",
        "pages_bad": "0",
        "apis": "9/9",
        "flows": "24/24",
        "dead": "0",
        "ab": "not re-run this pack (prior 39/39)",
        "paid": "not re-run this pack (prior 94/95, fail = A/B working)",
        "coach": "login skipped -- prod password not in env; admin routes 307 to /login",
    }
    os.makedirs(os.path.dirname(OUT_DESK), exist_ok=True)
    os.makedirs(os.path.dirname(OUT_DOCS), exist_ok=True)
    c = canvas.Canvas(OUT_DOCS, pagesize=landscape(letter))
    c.setTitle("The Train Station -- system flowchart 18 Sep 2026")
    c.setAuthor("The Train Station")
    page1(c)
    page2(c)
    page3(c)
    page4(c)
    page5(c)
    page6(c)
    page7(c)
    page8(c)
    page9(c, loop)
    c.save()
    shutil.copy2(OUT_DOCS, OUT_DESK)
    print("Wrote", OUT_DOCS)
    print("Copied", OUT_DESK)


if __name__ == "__main__":
    main()
