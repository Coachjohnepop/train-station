#!/usr/bin/env python3
"""Warehouse star/snowflake ERD — 21 Sep 2026."""

import os
import shutil
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

OUT_DOCS = "/Users/johnpopham/projects/train-station/docs/warehouse-star-erd-2026-09-21.pdf"
OUT_DESK = "/Users/johnpopham/Desktop/Stuff/Lemon Voice/The Train Station/Warehouse-Star-ERD-2026-09-21.pdf"

pdfmetrics.registerFont(TTFont("Georgia", "/System/Library/Fonts/Supplemental/Georgia.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Bold", "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"))

PAGE_W, PAGE_H = landscape(letter)
LEFT = 0.42 * inch
NAVY = colors.HexColor("#1B3A6B")
NAVY_DEEP = colors.HexColor("#0F2444")
CREAM = colors.HexColor("#F4F1EA")
INK = colors.HexColor("#1C1917")
MUTED = colors.HexColor("#57534E")
WHITE = colors.white
GOLD = colors.HexColor("#B8860B")
PURPLE = colors.HexColor("#5B21B6")
EMERALD = colors.HexColor("#047857")
CARD = colors.HexColor("#FFFEFB")
ROSE = colors.HexColor("#9A3412")


def header_footer(c, page, title, pages=3):
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
    c.drawString(LEFT, 0.1 * inch, "Analytics warehouse  ·  star / snowflake  ·  21 Sep 2026  ·  OLTP remains source of truth")
    c.drawRightString(PAGE_W - LEFT, 0.1 * inch, f"Page {page} of {pages}")


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
    c.drawString(x + 6, y + h - 10, title)
    c.setFillColor(INK)
    c.setFont("Helvetica", 6.5)
    ty = y + h - 26
    for line in lines:
        if ty < y + 5:
            break
        c.drawString(x + 6, ty, line)
        ty -= 9


def page1(c):
    header_footer(c, 1, "Warehouse ERD  ·  star")
    c.setFillColor(NAVY_DEEP)
    c.setFont("Georgia-Bold", 18)
    c.drawString(LEFT, PAGE_H - 0.7 * inch, "Facts in the middle. Dimensions around them.")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(LEFT, PAGE_H - 0.9 * inch, "Wh* tables. Loaded by mart-rollup. Never take a card charge here.")

    y = PAGE_H - 1.1 * inch
    facts = [
        (ROSE, "FACT LANDING SESSION", ["grain: AnalyticsSession", "dateKey  landingKey", "channel  member?", "converted signup/paid"]),
        (ROSE, "FACT SIGNUP", ["grain: User created", "dateKey  planKey", "memberKey unique"]),
        (ROSE, "FACT PAYMENT", ["grain: FactSubscriptionPayment", "amountCents  status", "method stripe|manual|other"]),
        (ROSE, "FACT UPGRADE REQUEST", ["grain: Coach request", "status pending|approved|declined", "sourceUserId unique"]),
    ]
    x = LEFT
    for hdr, title, lines in facts:
        box(c, x, y - 1.15 * inch, 2.45 * inch, 1.15 * inch, title, lines, hdr)
        x += 2.55 * inch

    y = y - 1.4 * inch
    dims = [
        (NAVY, "DIM DATE", ["dateKey YYYYMMDD", "Pacific calendar", "isFirstOfMonth  weekend"]),
        (PURPLE, "DIM LANDING", ["1 A /a  2 B /b", "3 C floor  4 D class", "0 other"]),
        (EMERALD, "DIM PLAN", ["explorer member", "business pro", "family + billing"]),
        (GOLD, "DIM CHANNEL", ["source x medium x campaign", "junk dimension"]),
        (NAVY, "DIM MEMBER", ["userId  email", "planKey snowflake", "city / state"]),
    ]
    x = LEFT
    for hdr, title, lines in dims:
        box(c, x, y - 1.1 * inch, 1.95 * inch, 1.1 * inch, title, lines, hdr)
        x += 2.05 * inch

    y = y - 1.4 * inch
    c.setFillColor(INK)
    c.setFont("Helvetica", 9)
    c.drawString(LEFT, y, "Snowflake: WhDimMember.planKey -> WhDimPlan. Star otherwise. Conform date + plan + landing across facts.")
    c.showPage()


def page2(c):
    header_footer(c, 2, "Warehouse ERD  ·  load")
    c.setFillColor(NAVY_DEEP)
    c.setFont("Georgia-Bold", 16)
    c.drawString(LEFT, PAGE_H - 0.7 * inch, "OLTP in. Star out. Same Postgres, different tables.")
    y = PAGE_H - 1.0 * inch
    box(c, LEFT, y - 1.7 * inch, 4.8 * inch, 1.7 * inch, "SOURCE (OLTP)", [
        "AnalyticsSession + AnalyticsEvent",
        "User + MemberProfile",
        "FactSubscriptionPayment (already a ledger)",
        "MartDailyMetrics stays as a cube snapshot",
        "Checkout / Stripe webhooks do not insert Wh*",
    ], NAVY)
    box(c, LEFT + 5.05 * inch, y - 1.7 * inch, 4.85 * inch, 1.7 * inch, "LOAD", [
        "src/lib/warehouse-load.ts",
        "Hooked from mart-rollup (daily 07:00 UTC)",
        "Idempotent upserts on source ids",
        "Pacific iso date -> dateKey",
        "First run seeds 2026 dates + plan/landing dims",
    ], EMERALD)
    y = y - 2.0 * inch
    box(c, LEFT, y - 1.5 * inch, 9.9 * inch, 1.5 * inch, "QUERY EXAMPLES", [
        "A vs B sessions: GROUP BY landing.letter  WHERE date.month = 9",
        "Coach upgrade funnel: signups plan=member  vs  upgradeRequests  vs  payments plan=business",
        "Paying vs grant: payments.method = stripe  vs  member.plan from staff grant (no payment fact)",
        "Do not hot-poll these tables faster than 5s — same Postgres as the app.",
    ], PURPLE)
    c.showPage()


def page3(c):
    header_footer(c, 3, "Warehouse ERD  ·  not this")
    c.setFillColor(NAVY_DEEP)
    c.setFont("Georgia-Bold", 16)
    c.drawString(LEFT, PAGE_H - 0.7 * inch, "Keep the gym app and the warehouse from becoming one blob.")
    y = PAGE_H - 1.05 * inch
    box(c, LEFT, y - 1.6 * inch, 4.8 * inch, 1.6 * inch, "NOT IN THE WAREHOUSE", [
        "Card data (Stripe hosted Checkout)",
        "Password hashes",
        "Chat bodies",
        "BYOW raw notes",
        "Venmo QR (retired)",
    ], ROSE)
    box(c, LEFT + 5.05 * inch, y - 1.6 * inch, 4.85 * inch, 1.6 * inch, "STILL OLTP", [
        "MemberProfile.plan is live access",
        "BusinessUpgrade* columns drive the button",
        "Acct* books are GL, not star facts",
        "MoneyDeskSettings is ops, not a dimension",
    ], NAVY)
    c.showPage()


def main():
    os.makedirs(os.path.dirname(OUT_DOCS), exist_ok=True)
    c = canvas.Canvas(OUT_DOCS, pagesize=landscape(letter))
    c.setTitle("The Train Station -- warehouse star ERD 21 Sep 2026")
    page1(c)
    page2(c)
    page3(c)
    c.save()
    desk_dir = os.path.dirname(OUT_DESK)
    if os.path.isdir(desk_dir):
        shutil.copy2(OUT_DOCS, OUT_DESK)
        print("Wrote", OUT_DOCS, "and", OUT_DESK)
    else:
        print("Wrote", OUT_DOCS)


if __name__ == "__main__":
    main()
