import "server-only";

import { isDemoMode } from "@/lib/demo-enrollments";
import { prisma } from "@/lib/prisma";
import { normalizeAffiliateCode } from "@/lib/affiliate/cookies";

export async function findActiveAffiliateByRef(raw: string) {
  if (isDemoMode()) return null;
  const code = normalizeAffiliateCode(raw);
  if (!code) return null;

  const discount = await prisma.affiliateCode.findUnique({
    where: { code },
    include: { affiliate: true },
  });
  if (discount?.isActive && discount.affiliate.status === "ACTIVE") {
    if (discount.expiresAt && discount.expiresAt < new Date()) return null;
    if (discount.maxUsage != null && discount.usageCount >= discount.maxUsage) return null;
    return { affiliate: discount.affiliate, code: discount.code };
  }

  const affiliate = await prisma.affiliate.findUnique({ where: { referralCode: code } });
  if (!affiliate || affiliate.status !== "ACTIVE") return null;
  return { affiliate, code: affiliate.referralCode };
}

export async function recordAffiliateClick(input: {
  ref: string;
  visitorId: string;
  landingPage: string;
  referer?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}): Promise<{ ok: true; code: string } | { ok: false }> {
  const match = await findActiveAffiliateByRef(input.ref);
  if (!match) return { ok: false };
  try {
    await prisma.affiliateClick.create({
      data: {
        affiliateId: match.affiliate.id,
        visitorId: input.visitorId,
        landingPage: input.landingPage.slice(0, 300) || "/",
        referer: input.referer?.slice(0, 500) || null,
        userAgent: input.userAgent?.slice(0, 500) || null,
        ipAddress: input.ipAddress?.slice(0, 80) || null,
      },
    });
    await prisma.affiliate.update({
      where: { id: match.affiliate.id },
      data: { totalClicks: { increment: 1 } },
    });
  } catch (error) {
    console.error("[affiliate] click record failed", error);
    return { ok: false };
  }
  return { ok: true, code: match.code };
}
