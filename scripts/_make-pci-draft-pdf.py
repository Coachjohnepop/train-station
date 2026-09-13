#!/usr/bin/env python3
"""First-draft PCI DSS posture report for The Train Station. Not an attestation."""

import os
import shutil
from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, ListFlowable, ListItem,
)

OUT_DOCS = "/Users/johnpopham/projects/train-station/docs/pci-saq-a-draft-2026-09-13.pdf"
OUT_DESK = "/Users/johnpopham/Desktop/Stuff/Lemon Voice/The Train Station/PCI-SAQ-A-Draft-2026-09-13.pdf"

pdfmetrics.registerFont(TTFont("Georgia", "/System/Library/Fonts/Supplemental/Georgia.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Bold", "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Italic", "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"))

NAVY = colors.HexColor("#1B3A6B")
GOLD = colors.HexColor("#B8860B")
INK = colors.HexColor("#1C1917")
MUTED = colors.HexColor("#44403C")
PALE = colors.HexColor("#F4F1EA")
ROSE = colors.HexColor("#9F1239")


def header_footer(canv, doc):
    canv.saveState()
    canv.setFillColor(NAVY)
    canv.rect(0, letter[1] - 28, letter[0], 28, fill=1, stroke=0)
    canv.setFillColor(GOLD)
    canv.rect(0, letter[1] - 28, 10, 28, fill=1, stroke=0)
    canv.setFillColor(colors.white)
    canv.setFont("Georgia", 8)
    canv.drawString(0.7 * inch, letter[1] - 18, "THE TRAIN STATION")
    canv.setFont("Helvetica", 8)
    canv.drawRightString(letter[0] - 0.7 * inch, letter[1] - 18, "PCI DSS first draft  ·  not an attestation")
    canv.setFillColor(NAVY)
    canv.rect(0, 0, letter[0], 26, fill=1, stroke=0)
    canv.setFillColor(colors.white)
    canv.setFont("Helvetica", 7.5)
    canv.drawString(0.7 * inch, 10, "Draft 13 Sep 2026  ·  not legal advice  ·  not signed  ·  for John + counsel")
    canv.drawRightString(letter[0] - 0.7 * inch, 10, f"Page {doc.page}")
    canv.restoreState()


def styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(name="Kicker", fontName="Helvetica-Bold", fontSize=8, textColor=GOLD, spaceAfter=4, tracking=1))
    s.add(ParagraphStyle(name="H1", fontName="Georgia-Bold", fontSize=16, textColor=NAVY, spaceAfter=10, leading=20))
    s.add(ParagraphStyle(name="H2", fontName="Georgia-Bold", fontSize=12, textColor=NAVY, spaceBefore=12, spaceAfter=6))
    s.add(ParagraphStyle(name="Body", fontName="Helvetica", fontSize=9.5, textColor=INK, leading=13, alignment=TA_JUSTIFY, spaceAfter=8))
    s.add(ParagraphStyle(name="Small", fontName="Helvetica", fontSize=8.5, textColor=MUTED, leading=12, spaceAfter=6))
    s.add(ParagraphStyle(name="Warn", fontName="Helvetica", fontSize=9, textColor=ROSE, leading=12, spaceAfter=8))
    s.add(ParagraphStyle(name="Cell", fontName="Helvetica", fontSize=8, textColor=INK, leading=11))
    s.add(ParagraphStyle(name="CellB", fontName="Helvetica-Bold", fontSize=8, textColor=NAVY, leading=11))
    return s


def cell(text, st, bold=False):
    return Paragraph(text, st["CellB"] if bold else st["Cell"])


def main():
    os.makedirs(os.path.dirname(OUT_DOCS), exist_ok=True)
    os.makedirs(os.path.dirname(OUT_DESK), exist_ok=True)
    st = styles()
    story = []
    story.append(Paragraph("FIRST DRAFT -- NOT AN ATTESTATION", st["Kicker"]))
    story.append(Paragraph("PCI DSS posture: The Train Station", st["H1"]))
    story.append(Paragraph(
        "This is a working draft for John (and later counsel / the acquirer). It is <b>not</b> a "
        "Self-Assessment Questionnaire, not an Attestation of Compliance, and not legal or QSA advice. "
        "The merchant of record is Jeremy's Train Station Stripe account. Volume is far below Level 1.",
        st["Body"]))
    story.append(Paragraph(
        "Recommended questionnaire if the current architecture holds: <b>SAQ A</b> (PCI DSS v4.0.1), "
        "because card data is collected on <b>Stripe-hosted Checkout</b> (redirect), not on thetrainstation.co forms. "
        "Stripe documents Checkout / Elements / Connect as SAQ A integrations.",
        st["Body"]))

    story.append(Paragraph("1. Scope snapshot (as built 13 Sep 2026)", st["H2"]))
    rows = [
        [cell("Item", st, True), cell("Finding", st, True)],
        [cell("Merchant", st), cell("Jeremy Byrd / The Train Station -- Stripe LIVE master. John is not a second merchant.", st)],
        [cell("Site", st), cell("https://www.thetrainstation.co -- Next.js on Vercel. Postgres on Supabase (catalog).", st)],
        [cell("Card collection", st), cell("Stripe Checkout Session (hosted page). Member is redirected off-site. No card fields in our React tree.", st)],
        [cell("CHD in our DB?", st), cell("No PAN, expiry, or CVC columns. We store Stripe customer / subscription / checkout session IDs only.", st)],
        [cell("Other money", st), cell("Venmo QR + coach Mark paid (not card). Tips via Stripe Checkout. BYOW door is free (no payment).", st)],
        [cell("Likely merchant level", st), cell("Level 4 (well under 20k e-commerce tx / year). Acquirer has the final say.", st)],
        [cell("Likely SAQ", st), cell("SAQ A if we stay on hosted Checkout / no card fields on our origin.", st)],
    ]
    t = Table(rows, colWidths=[1.5 * inch, 5.0 * inch], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PALE),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D6D0C4")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph("2. What we do not do (eligibility for SAQ A)", st["H2"]))
    story.append(Paragraph(
        "SAQ A is for card-not-present merchants who fully outsource account-data handling to a PCI-validated provider "
        "and do not store, process, or transmit cardholder data on their own systems.",
        st["Body"]))
    bullets = [
        "No card number inputs on thetrainstation.co (no Stripe.js v2, no raw PaymentIntent card objects from our forms).",
        "Checkout is a Stripe-hosted URL from Checkout Sessions. Webhook receives events (customer, subscription, payment_intent ids) -- not PAN.",
        "Postgres MemberProfile keeps stripeCustomerId / stripeSubscriptionId / stripeCheckoutSessionId.",
        "BYOW (/byow) has no Stripe path. Free notes door. Out of CHD scope.",
        "Venmo is a separate rail (QR + Mark paid). Not card data.",
        "No card-present / Terminal / MOTO routine process.",
    ]
    story.append(ListFlowable(
        [ListItem(Paragraph(b, st["Body"]), leftIndent=8) for b in bullets],
        bulletType="bullet", leftIndent=16,
    ))

    story.append(Paragraph("3. What still has to be true (gaps for a real SAQ)", st["H2"]))
    story.append(Paragraph(
        "PCI DSS v4.0.1 SAQ A is short, but eligibility now includes confirming that payment pages are not "
        "susceptible to script attacks, and that payment-page content comes from the TPSP. Full redirect to Checkout "
        "is the cleaner story. Do not add Stripe Elements on our origin without revisiting SAQ A-EP.",
        st["Body"]))
    gap_rows = [
        [cell("Gap", st, True), cell("Why it matters", st, True), cell("Draft action", st, True)],
        [cell("Stripe AOC on file", st), cell("Must confirm TPSP is PCI compliant.", st), cell("Download Stripe's current AoC; store with this draft.", st)],
        [cell("Acquirer / Stripe questionnaire", st), cell("Stripe Risk Management may still ask Level 3/4 merchants to complete a form.", st), cell("Complete Stripe's PCI form when prompted. Do not invent answers.", st)],
        [cell("Payment-page scripts", st), cell("If any page that starts Checkout loads third-party JS, document it.", st), cell("Inventory scripts on /member/checkout and /join. Prefer redirect-only.", st)],
        [cell("CSP / SRI", st), cell("Good hygiene even if SAQ A no longer lists 6.4.3/11.6.1 as SAQ questions.", st), cell("Tighten Content-Security-Policy on checkout routes.", st)],
        [cell("ASV scan", st), cell("Some acquirers still want quarterly scans even at Level 4.", st), cell("Ask Stripe/bank if required. Do not skip if they say yes.", st)],
        [cell("Access / logs", st), cell("Who can see Stripe Dashboard and Vercel env.", st), cell("Jeremy merchant; John admin. No PAN in logs (verify webhook logger).", st)],
        [cell("Supabase Free", st), cell("No vendor DB backups (separate from PCI).", st), cell("Upgrade Pro $25/mo for backups; CHD still must not be in DB.", st)],
        [cell("Venmo Mark paid", st), cell("Not card, but money movement.", st), cell("Keep it coach-operated; do not collect card numbers in chat.", st)],
    ]
    g = Table(gap_rows, colWidths=[1.5 * inch, 2.5 * inch, 2.5 * inch], repeatRows=1)
    g.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PALE),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D6D0C4")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(g)

    story.append(Paragraph("4. Code pointers (for counsel / a future QSA)", st["H2"]))
    story.append(Paragraph(
        "<b>/api/stripe/checkout</b> creates a Checkout Session and returns a Stripe URL. "
        "<b>/api/stripe/webhook</b> is the only inbound card-adjacent surface -- event JSON, no PAN. "
        "<b>MemberProfile</b> stores Stripe IDs. <b>completeMemberSignup</b> BYOW channel never calls Checkout. "
        "Do not add a card form to /byow or /member/checkout without a new SAQ review.",
        st["Body"]))

    story.append(Paragraph("5. What this draft is not", st["H2"]))
    story.append(Paragraph(
        "It is not SAQ A filled out. It is not a ROC. It does not satisfy an acquirer by itself. "
        "John should not sign an Attestation until Stripe's current PCI form and (if required) an ASV scan are done. "
        "If we ever collect cards on our origin, this draft is void and the questionnaire becomes SAQ A-EP or D.",
        st["Warn"]))
    story.append(Paragraph(
        "Prepared 13 Sep 2026 from the live architecture. Update when Checkout, Elements, Terminal, or a second merchant is added.",
        st["Small"]))

    doc = SimpleDocTemplate(
        OUT_DOCS,
        pagesize=letter,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.5 * inch,
        title="PCI DSS first draft -- The Train Station",
        author="The Train Station",
    )
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    shutil.copy2(OUT_DOCS, OUT_DESK)
    print("Wrote", OUT_DOCS)


if __name__ == "__main__":
    main()
