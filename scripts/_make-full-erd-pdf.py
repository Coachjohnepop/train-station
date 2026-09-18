#!/usr/bin/env python3
"""Full Train Station ERD as of 18 Sep 2026."""

import os
import shutil
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

OUT_DOCS = "/Users/johnpopham/projects/train-station/docs/full-erd-2026-09-18.pdf"
OUT_DESK = "/Users/johnpopham/Desktop/Stuff/Lemon Voice/The Train Station/Full-ERD-2026-09-18.pdf"

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
GOLD_PALE = colors.HexColor("#FEF3C7")
PURPLE = colors.HexColor("#5B21B6")
EMERALD = colors.HexColor("#047857")
CARD = colors.HexColor("#FFFEFB")
ROSE = colors.HexColor("#9A3412")


def header_footer(c, page, title, pages=8):
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
    c.rect(0, 0, PAGE_W, 0.3 * inch, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 7.5)
    c.drawString(LEFT, 0.11 * inch, "Postgres catalog  ·  Prisma  ·  18 Sep 2026  ·  not a legal schema dump")
    c.drawRightString(PAGE_W - LEFT, 0.11 * inch, f"Page {page} of {pages}")


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
    c.drawString(x + 5, y + h - 10.5, title)
    c.setFillColor(INK)
    c.setFont("Helvetica", 6.4)
    ty = y + h - 25
    for line in lines:
        if ty < y + 5:
            break
        if line.startswith("PK ") or line.startswith("FK "):
            c.setFont("Helvetica-Bold", 6.4)
            c.setFillColor(NAVY if line.startswith("PK") else GOLD)
        else:
            c.setFont("Helvetica", 6.4)
            c.setFillColor(MUTED)
        c.drawString(x + 5, ty, line)
        ty -= 9


def kicker(c, text, y):
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(LEFT, y, text.upper())


def h1(c, text, y):
    c.setFillColor(NAVY_DEEP)
    c.setFont("Georgia-Bold", 15)
    c.drawString(LEFT, y, text)


def page1(c):
    header_footer(c, 1, "ERD  ·  people and identity")
    kicker(c, "System of record", PAGE_H - 0.55 * inch)
    h1(c, "Who is on the platform", PAGE_H - 0.78 * inch)
    y = PAGE_H - 1.0 * inch
    box(c, LEFT, y - 2.15 * inch, 3.4 * inch, 2.15 * inch, "USER", [
        "PK id",
        "email unique  ·  name  ·  phone",
        "role ADMIN | INSTRUCTOR | PLATFORM_ADMIN | MEMBER",
        "signupPlan  ·  passwordHash  ·  hidden",
        "smsConsentAt / smsOptOutAt",
        "createdAt",
        "1 -- 1 MemberProfile",
        "1 -- * Enrollment, Booking, WorkoutLog",
        "1 -- * ByowWorkout, ByowExercise, ByowLog",
        "1 -- * ChatThreadCursor",
    ], NAVY)
    box(c, LEFT + 3.55 * inch, y - 2.15 * inch, 3.5 * inch, 2.15 * inch, "MEMBER PROFILE", [
        "PK userId  FK User",
        "plan explorer|member|business|pro",
        "paymentStatus none|pending|paid",
        "paymentNote  (byow tag for BYOW leads)",
        "onboardingComplete  ·  introBookedAt",
        "stripeCustomerId / SubscriptionId",
        "referralCode  ·  grant expiry",
        "measurements identity fields",
    ], PURPLE)
    box(c, LEFT + 7.2 * inch, y - 2.15 * inch, 3.15 * inch, 2.15 * inch, "AUTH / ACCESS", [
        "OAuthIdentity  PK id  FK userId",
        "PasswordResetToken",
        "WebPushSubscription",
        "MemberCoachPrefs",
        "ChatThreadCursor (clear / archive)",
        "Session cookie ts_session (not a table)",
        "ts_byow cookie for free BYOW door",
    ], colors.HexColor("#374151"))
    y = y - 2.4 * inch
    box(c, LEFT, y - 1.35 * inch, 4.7 * inch, 1.35 * inch, "PROGRAM ENROLLMENT", [
        "PK id  FK userId  FK programId",
        "startedAt  ·  programStartDate (Day 1)",
        "blockEndsAt  ·  currentWeek/Day/Phase",
        "trainingLocation gym|home",
        "Personal 28-day month -- not gym calendar",
    ], EMERALD)
    box(c, LEFT + 4.9 * inch, y - 1.35 * inch, 5.45 * inch, 1.35 * inch, "BOOKING", [
        "PK id  FK userId?",
        "memberEmail  ·  scheduledAt  ·  durationMin",
        "calendlyInviteeUri unique-ish  ·  reschedule/cancel URLs",
        "status pending|confirmed|completed|cancelled",
        "Calendly webhook writes this; intro pester reads it",
    ], ROSE)
    c.showPage()


def page2(c):
    header_footer(c, 2, "ERD  ·  Jeremy catalog")
    kicker(c, "Coach library", PAGE_H - 0.55 * inch)
    h1(c, "Programs, days, workouts, exercises", PAGE_H - 0.78 * inch)
    y = PAGE_H - 0.98 * inch
    ents = [
        (NAVY, "PROGRAM", ["PK id  slug unique", "name  durationWeeks", "1 -- * Week / Cycle / Enrollment"]),
        (PURPLE, "PROGRAM WEEK", ["PK id  FK programId", "weekNumber", "1 -- * ProgramDay"]),
        (colors.HexColor("#0F766E"), "PROGRAM DAY", ["PK id  FK weekId", "dayNumber  notes", "partCount  1--* Session", "1 -- * DayOption"]),
        (EMERALD, "DAY OPTION", ["PK id  FK dayId workoutId", "label Gym|Home", "trainingLocation"]),
        (GOLD, "WORKOUT", ["PK id  name  exportText", "source catalog|template", "restTimer*  certifiedAt", "updatedAt stamped on line edit"]),
        (ROSE, "WORKOUT EXERCISE", ["PK id  FK workoutId", "FK exerciseId  sortOrder", "sets  reps  restSec  notes"]),
        (colors.HexColor("#374151"), "EXERCISE", ["PK id  name", "videoUrl  tags", "archivedAt  library"]),
        (PURPLE, "SET PHASE", ["PK id  FK workoutExerciseId", "HOLD|REPS|BURNOUT|TIMED"]),
        (NAVY, "WORKOUT LOG", ["PK id  FK userId workoutId", "performedAt  progress", "catchUpForDate"]),
        (EMERALD, "TEMPLATE / CYCLE", ["WorkoutTemplate", "WorkoutCycle + Day + Slot", "paste onto program month"]),
    ]
    bw, bh = 2.35 * inch, 1.12 * inch
    for i, (hdr, title, lines) in enumerate(ents):
        col, row = i % 5, i // 5
        box(c, LEFT + col * (bw + 0.12 * inch), y - row * (bh + 0.12 * inch) - bh, bw, bh, title, lines, hdr)
    c.showPage()


def page3(c):
    header_footer(c, 3, "ERD  ·  BYOW isolated catalog")
    kicker(c, "Not Jeremy's library", PAGE_H - 0.55 * inch)
    h1(c, "Bring Your Own Workout -- same shape, other tables", PAGE_H - 0.78 * inch)
    y = PAGE_H - 1.0 * inch
    box(c, LEFT, y - 1.7 * inch, 3.3 * inch, 1.7 * inch, "BYOW EXERCISE", [
        "PK id  FK ownerUserId",
        "name  description  tags",
        "Never written to Exercise",
    ], GOLD)
    box(c, LEFT + 3.45 * inch, y - 1.7 * inch, 3.3 * inch, 1.7 * inch, "BYOW WORKOUT", [
        "PK id  FK ownerUserId",
        "name  exportText (exact paste)",
        "source notes",
        "1 -- 1 ByowSourceNote",
    ], NAVY)
    box(c, LEFT + 6.9 * inch, y - 1.7 * inch, 3.45 * inch, 1.7 * inch, "BYOW LINE + LOG", [
        "ByowWorkoutExercise  FK workout+exercise",
        "ByowSourceNote  rawText line-for-line",
        "ByowWorkoutLog  durationSec  names",
        "Report tab reads logs Mon-Sun PT",
    ], PURPLE)
    y = y - 1.95 * inch
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(LEFT, y, "Same Postgres (train-station-catalog). Isolation is tables, not a second Supabase project.")
    c.drawString(LEFT, y - 14, "Signup: completeMemberSignup({ channel: 'byow' }) -- User + MemberProfile, paymentNote=byow, no Stripe, no Adult enroll.")
    c.drawString(LEFT, y - 28, "Doors: /byow/signup (public)  /byow (upload)  /byow/admin (John)  /member/byow (Workouts | Report).")
    c.showPage()


def page4(c):
    header_footer(c, 4, "ERD  ·  live class and chat")
    kicker(c, "Floor + messages", PAGE_H - 0.55 * inch)
    h1(c, "Live session, Zoom, and 1:1 / cohort chat", PAGE_H - 0.78 * inch)
    y = PAGE_H - 1.0 * inch
    ents = [
        (NAVY, "COACH TODAY SESSION", ["PK id  sessionDate", "userIds subset JSON", "workoutId  restActive", "Assign is not the whole roster"]),
        (PURPLE, "LIVE WORKOUT SESSION", ["PK  user x workout x day", "completedSets JSON", "SSE to member+coach"]),
        (colors.HexColor("#0B5CFF"), "ZOOM / CALENDLY", ["CoachZoomOAuth", "LiveClassZoomDay", "CalendlyIntegration", "Booking from webhook"]),
        (EMERALD, "CHAT THREAD", ["kind member|cohort", "memberId or programSlug", "title"]),
        (GOLD, "CHAT MESSAGE", ["authorRole coach|member|system", "readByUserIds", "coach msg = member unread", "system = coach unread"]),
        (ROSE, "CHAT THREAD CURSOR", ["PK userId+threadId", "clearedAt  live vs Archive", "joinAfter = enroll/createdAt"]),
    ]
    bw, bh = 3.35 * inch, 1.25 * inch
    for i, (hdr, title, lines) in enumerate(ents):
        col, row = i % 3, i // 3
        box(c, LEFT + col * (bw + 0.14 * inch), y - row * (bh + 0.14 * inch) - bh, bw, bh, title, lines, hdr)
    c.showPage()


def page5(c):
    header_footer(c, 5, "ERD  ·  money")
    kicker(c, "Jeremy is merchant of record", PAGE_H - 0.55 * inch)
    h1(c, "Stripe, Venmo, tips, commission -- no CHD in Postgres", PAGE_H - 0.78 * inch)
    y = PAGE_H - 1.0 * inch
    ents = [
        (colors.HexColor("#635BFF"), "STRIPE WEBHOOK EVENT", ["id  type  payload", "idempotent process"]),
        (NAVY, "FACT SUBSCRIPTION PAYMENT", ["amountCents  status", "plan  paidAt  userId"]),
        (GOLD, "COMMISSION", ["Partner  Payout  Line", "cliff coded; brackets draft"]),
        (PURPLE, "MONEY DESK SETTINGS", ["singleton default", "25% x4 split percents", "Grok/Vercel/Supabase lines", "bills x4 = $340 outflow floor"]),
        (EMERALD, "WAITLIST / LEADS", ["WaitlistEntry source", "byow-signup vs signup-register"]),
        (ROSE, "ACCT BOOKS", ["Entity Account Party", "Period Journal Entry Line"]),
    ]
    bw, bh = 3.35 * inch, 1.15 * inch
    for i, (hdr, title, lines) in enumerate(ents):
        col, row = i % 3, i // 3
        box(c, LEFT + col * (bw + 0.14 * inch), y - row * (bh + 0.14 * inch) - bh, bw, bh, title, lines, hdr)
    y = y - 2.55 * inch
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(LEFT, y, "Card numbers never persist here. Checkout is Stripe-hosted. Venmo is Mark paid. FA + 4 buckets live on Admin Stripe money; MoneyDeskSettings is the split.")
    c.showPage()


def page6(c):
    header_footer(c, 6, "ERD  ·  member body, nutrition, analytics")
    kicker(c, "Member surfaces", PAGE_H - 0.55 * inch)
    h1(c, "Measurements, grocery, scores, first-party analytics", PAGE_H - 0.78 * inch)
    y = PAGE_H - 1.0 * inch
    ents = [
        (NAVY, "USER MEASUREMENT", ["tapes  photos  identity"]),
        (EMERALD, "GROCERY", ["ApprovedGroceryFood", "MemberShoppingList + Item"]),
        (GOLD, "GAMIFICATION", ["Event  SeasonScore", "Promo  Prize  Audit"]),
        (PURPLE, "ANALYTICS SESSION", ["sessionKey  landingVariant", "utm  device  userId?"]),
        (ROSE, "ANALYTICS EVENT", ["page_view  page_click", "pagePath  /byow section"]),
        (colors.HexColor("#374151"), "CONTENT / SEO", ["LandingMediaSettings", "SiteSeoSettings  SiteVideoAsset"]),
        (NAVY, "EQUIPMENT", ["Equipment  UserEquipment", "ExerciseEquipment"]),
        (GOLD, "NOTIFICATIONS", ["OutboundNotification", "SmsLog + DeliveryEvent", "CoachInboxItem"]),
        (PURPLE, "AUDIT EVENT", ["actor  action  entity"]),
    ]
    bw, bh = 3.35 * inch, 1.05 * inch
    for i, (hdr, title, lines) in enumerate(ents):
        col, row = i % 3, i // 3
        box(c, LEFT + col * (bw + 0.12 * inch), y - row * (bh + 0.12 * inch) - bh, bw, bh, title, lines, hdr)
    c.showPage()


def page7(c):
    header_footer(c, 7, "ERD  ·  relationships at a glance")
    kicker(c, "How the rooms connect", PAGE_H - 0.55 * inch)
    h1(c, "One User, two catalogs, one money rail", PAGE_H - 0.78 * inch)
    y = PAGE_H - 1.05 * inch
    c.setFillColor(INK)
    c.setFont("Helvetica", 9)
    lines = [
        "User -- MemberProfile -- Enrollment -- Program -- Day -- Option -- Workout -- WorkoutExercise -- Exercise",
        "User -- Booking <-- Calendly webhook   User -- CoachChatThread (1:1) -- Message",
        "User -- ByowWorkout -- ByowWorkoutExercise -- ByowExercise    User -- ByowWorkoutLog -- Report",
        "User -- WorkoutLog (Jeremy catalog only)    User -- AnalyticsEvent",
        "Stripe Checkout --> WebhookEvent --> paymentStatus=paid on MemberProfile",
        "Venmo --> Admin Mark paid --> same paymentStatus",
        "Standing staff grant (Stephanie / Ali / John) --> paymentMethod=manual, skip checkout",
        "Visible cash = FA ledger + pending + available; no outflow until bills x 4 ($340)",
        "ChatThreadCursor.clearedAt splits live vs Archive per user; cohort joinAfter hides pre-enroll history.",
    ]
    ty = y
    for line in lines:
        c.drawString(LEFT, ty, line)
        ty -= 18
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(LEFT, ty - 8, "93 tables in public schema. RLS on; Prisma as postgres (not PostgREST). MoneyDeskSettings added 18 Sep 2026.")
    c.showPage()


def page8(c):
    header_footer(c, 8, "ERD  ·  what is not in this diagram")
    kicker(c, "Out of the database", PAGE_H - 0.55 * inch)
    h1(c, "Rails, cookies, and drafts", PAGE_H - 0.78 * inch)
    y = PAGE_H - 1.05 * inch
    box(c, LEFT, y - 1.5 * inch, 5.0 * inch, 1.5 * inch, "NOT TABLES", [
        "Stripe CHD (hosted Checkout)",
        "Vercel Blob binary (images, short video URLs stored)",
        "Session JWT cookie  ·  ts_landing A/B  ·  ts_byow",
        "Calendly/Zoom as vendors; tokens in CoachZoomOAuth",
    ], colors.HexColor("#374151"))
    box(c, LEFT + 5.2 * inch, y - 1.5 * inch, 4.65 * inch, 1.5 * inch, "DRAFT / NOT CODED", [
        "Partnership tax brackets $5k / $15k",
        "BYOW $2.99 SKU  (this door is free)",
        "Twilio SMS still parked",
        "Second Supabase project for BYOW (tables instead)",
    ], GOLD)
    c.showPage()


def main():
    os.makedirs(os.path.dirname(OUT_DOCS), exist_ok=True)
    os.makedirs(os.path.dirname(OUT_DESK), exist_ok=True)
    c = canvas.Canvas(OUT_DOCS, pagesize=landscape(letter))
    c.setTitle("The Train Station -- full ERD 18 Sep 2026")
    c.setAuthor("The Train Station")
    page1(c); page2(c); page3(c); page4(c); page5(c); page6(c); page7(c); page8(c)
    c.save()
    shutil.copy2(OUT_DOCS, OUT_DESK)
    print("Wrote", OUT_DOCS)


if __name__ == "__main__":
    main()
