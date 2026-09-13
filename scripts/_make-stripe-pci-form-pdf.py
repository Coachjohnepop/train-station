#!/usr/bin/env python3
"""Printable Stripe PCI form answer sheet for The Train Station."""

import os
import shutil
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT_DOCS = "/Users/johnpopham/projects/train-station/docs/pci/STRIPE-PCI-FORM-ANSWERS.pdf"
OUT_DESK = "/Users/johnpopham/Desktop/Stuff/Lemon Voice/The Train Station/STRIPE-PCI-FORM-ANSWERS.pdf"

pdfmetrics.registerFont(TTFont("Georgia", "/System/Library/Fonts/Supplemental/Georgia.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Bold", "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"))

NAVY = colors.HexColor("#1B3A6B")
GOLD = colors.HexColor("#B8860B")
INK = colors.HexColor("#1C1917")
MUTED = colors.HexColor("#44403C")
PALE = colors.HexColor("#F4F1EA")
LINE = colors.HexColor("#D6D0C4")
ROSE = colors.HexColor("#9F1239")


def header_footer(canv, doc):
    canv.saveState()
    canv.setFillColor(NAVY)
    canv.rect(0, letter[1] - 28, letter[0], 28, fill=1, stroke=0)
    canv.setFillColor(GOLD)
    canv.rect(0, letter[1] - 28, 10, 28, fill=1, stroke=0)
    canv.setFillColor(colors.white)
    canv.setFont("Georgia", 8)
    canv.drawString(0.65 * inch, letter[1] - 18, "THE TRAIN STATION")
    canv.setFont("Helvetica", 8)
    canv.drawRightString(letter[0] - 0.65 * inch, letter[1] - 18, "Stripe PCI form -- copy sheet")
    canv.setFillColor(NAVY)
    canv.rect(0, 0, letter[0], 26, fill=1, stroke=0)
    canv.setFillColor(colors.white)
    canv.setFont("Helvetica", 7.5)
    canv.drawString(0.65 * inch, 10, "Not signed  ·  not an attestation  ·  13 Sep 2026")
    canv.drawRightString(letter[0] - 0.65 * inch, 10, f"Page {doc.page}")
    canv.restoreState()


def S():
    return {
        "k": ParagraphStyle("k", fontName="Helvetica-Bold", fontSize=8, textColor=GOLD, spaceAfter=3),
        "h1": ParagraphStyle("h1", fontName="Georgia-Bold", fontSize=15, textColor=NAVY, spaceAfter=8, leading=18),
        "h2": ParagraphStyle("h2", fontName="Georgia-Bold", fontSize=11, textColor=NAVY, spaceBefore=10, spaceAfter=5),
        "b": ParagraphStyle("b", fontName="Helvetica", fontSize=9, textColor=INK, leading=12, spaceAfter=6),
        "c": ParagraphStyle("c", fontName="Helvetica", fontSize=8, textColor=INK, leading=11),
        "cb": ParagraphStyle("cb", fontName="Helvetica-Bold", fontSize=8, textColor=NAVY, leading=11),
        "warn": ParagraphStyle("warn", fontName="Helvetica", fontSize=8.5, textColor=ROSE, leading=11, spaceAfter=6),
        "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8, textColor=MUTED, leading=11, spaceAfter=4),
    }


def P(text, st, bold=False):
    return Paragraph(text, st["cb"] if bold else st["c"])


def grid(rows, widths, st):
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PALE),
                ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return t


def main():
    os.makedirs(os.path.dirname(OUT_DOCS), exist_ok=True)
    os.makedirs(os.path.dirname(OUT_DESK), exist_ok=True)
    st = S()
    story = []
    story.append(Paragraph("PRINT AND TAKE TO STRIPE DASHBOARD", st["k"]))
    story.append(Paragraph("Stripe PCI wizard -- filled answers", st["h1"]))
    story.append(
        Paragraph(
            "Not signed. Not an attestation. Paste these answers into "
            "<b>Dashboard → Settings → Compliance documents</b>, then Jeremy signs "
            "<b>there</b> if Stripe asks. Merchant of record: Jeremy's Train Station "
            "<b>LIVE</b> Stripe (not John's personal account).",
            st["b"],
        )
    )

    story.append(Paragraph("A. Integration -- copy as-is", st["h2"]))
    a = [
        [P("Question", st, True), P("Answer", st, True), P("Why", st, True)],
        [
            P("How do customers pay online?", st),
            P("<b>Stripe Checkout</b> -- hosted redirect to checkout.stripe.com", st),
            P("/api/stripe/checkout creates a Session; browser leaves our site.", st),
        ],
        [
            P("Elements / Payment Element / card fields on our page?", st),
            P("<b>No</b>", st),
            P("No CardElement or PaymentElement in the app.", st),
        ],
        [
            P("Raw card numbers posted to our API?", st),
            P("<b>No</b>", st),
            P("Never.", st),
        ],
        [
            P("Store PAN, expiry, or CVC?", st),
            P("<b>No</b>", st),
            P("Postgres stores Stripe customer / subscription / Checkout session IDs only.", st),
        ],
        [
            P("Card-present / Stripe Terminal?", st),
            P("<b>No</b>", st),
            P("", st),
        ],
        [
            P("Staff types cards into the Stripe Dashboard as a normal way to take payment?", st),
            P("<b>Never</b> (confirmed 13 Sep 2026)", st),
            P("Routine Dashboard entry would force SAQ C-VT. Do not start.", st),
        ],
        [
            P("Which SAQ should Stripe pick?", st),
            P("<b>SAQ A</b>", st),
            P("Hosted Checkout. If wizard says A-EP or D, stop -- misclassified.", st),
        ],
    ]
    story.append(grid(a, [2.15 * inch, 2.35 * inch, 2.0 * inch], st))

    story.append(Paragraph("B. Other money -- say this if asked", st["h2"]))
    b = [
        [P("Question", st, True), P("Answer", st, True)],
        [P("Other ways people pay?", st), P("<b>Venmo</b> @JeremyByrdCSCS then coach <b>Mark paid</b>. Not card data.", st)],
        [P("BYOW / notes app?", st), P("<b>Free.</b> No Stripe. Out of card scope.", st)],
        [P("Tips?", st), P("Stripe Checkout (same hosted page).", st)],
        [P("Refunds?", st), P("Stripe Dashboard / admin refund API (Stripe IDs only).", st)],
        [P("Connect marketplace yet?", st), P("Not yet. If Connect stays hosted Checkout, still SAQ A -- revisit then.", st)],
    ]
    story.append(grid(b, [2.15 * inch, 4.35 * inch], st))

    story.append(Paragraph("C. SAQ A eligibility -- all Yes", st["h2"]))
    yes = [
        "Card-not-present only (e-commerce). <b>Yes.</b>",
        "All account-data handling outsourced to Stripe (PCI Level 1). <b>Yes.</b>",
        "We do not store, process, or transmit account data electronically. <b>Yes.</b>",
        "Stripe is PCI validated -- download their AoC from the same Dashboard page. <b>Yes, once that file is saved.</b>",
        "Paper card numbers? <b>No</b> (Jeremy must not write PANs on paper).",
        "Website only redirects to Stripe Checkout -- no card form on our origin. <b>Yes.</b>",
    ]
    story.append(
        ListFlowable(
            [ListItem(Paragraph(x, st["c"]), leftIndent=6) for x in yes],
            bulletType="bullet",
            leftIndent=14,
        )
    )

    story.append(Paragraph("D. Merchant block -- confirmed vs write-in", st["h2"]))
    d = [
        [P("Field", st, True), P("Value", st, True), P("", st, True)],
        [P("Legal name", st), P("<b>Jeremy Byrd / The Train Station</b>", st), P("confirmed", st)],
        [P("DBA", st), P("The Train Station", st), P("confirmed", st)],
        [P("Website", st), P("https://www.thetrainstation.co", st), P("confirmed", st)],
        [P("Stripe account", st), P("LIVE Train Station (Jeremy merchant)", st), P("confirmed", st)],
        [P("Business type", st), P("Fitness coaching / online memberships", st), P("confirmed", st)],
        [P("Who signs", st), P("<b>Jeremy Byrd</b> -- merchant of record. John does not sign.", st), P("confirmed", st)],
        [P("Card tx / year", st), P("Well under 20,000 (Level 4-ish)", st), P("write number if asked", st)],
        [P("Company address", st), P("________________________________", st), P("write", st)],
        [P("City / state / ZIP", st), P("________________________________", st), P("write", st)],
        [P("Business phone", st), P("________________________________", st), P("write", st)],
        [P("EIN / tax ID", st), P("________________________________", st), P("write -- not SSN on this sheet", st)],
        [P("Date signed", st), P("________________________________", st), P("write", st)],
    ]
    story.append(grid(d, [1.7 * inch, 3.5 * inch, 1.3 * inch], st))

    story.append(Paragraph("E. After you paste this into Stripe", st["h2"]))
    story.append(
        Paragraph(
            "1. Download <b>Stripe's AoC</b> and the <b>Shared Responsibility Matrix</b> from that page.<br/>"
            "2. Save them next to PCI-SAQ-A-Draft-2026-09-13.pdf on the Desktop.<br/>"
            "3. Do <b>not</b> run ASV scans unless Stripe or the bank requires them (later).",
            st["b"],
        )
    )
    story.append(Paragraph("F. Do not answer Yes to", st["h2"]))
    story.append(
        Paragraph(
            "We collect cards on our website · We use Stripe.js v2 · Staff types cards into Dashboard as the normal take-pay method · We store full card numbers · We have in-person terminals.",
            st["warn"],
        )
    )
    story.append(
        Paragraph(
            "If the wizard says SAQ A-EP or D, stop. The live app is Checkout redirect -- fix the classification; do not sign the wrong form.",
            st["warn"],
        )
    )

    doc = SimpleDocTemplate(
        OUT_DOCS,
        pagesize=letter,
        leftMargin=0.65 * inch,
        rightMargin=0.65 * inch,
        topMargin=0.55 * inch,
        bottomMargin=0.48 * inch,
        title="Stripe PCI form answers -- The Train Station",
        author="The Train Station",
    )
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    shutil.copy2(OUT_DOCS, OUT_DESK)
    print("Wrote", OUT_DOCS)


if __name__ == "__main__":
    main()
