import type { CommissionPartner } from "@/lib/commission-partners-store";

export type PartnerSplitLine = {
  partnerId: string;
  partnerName: string;
  sharePercent: number;
  amountCents: number;
};

/** Flat revenue split: each partner sharePercent is % of gross MRR. */
export function splitRevenueAmongPartners(
  mrrCents: number,
  partners: CommissionPartner[],
): PartnerSplitLine[] {
  const enabled = partners.filter((p) => p.enabled && p.sharePercent > 0);
  if (enabled.length === 0 || mrrCents <= 0) return [];

  const totalShare = enabled.reduce((sum, p) => sum + p.sharePercent, 0);
  if (totalShare <= 0) return [];

  const totalPartnerCents = Math.round((mrrCents * totalShare) / 100);
  const lines: PartnerSplitLine[] = [];
  let allocated = 0;

  for (let i = 0; i < enabled.length; i++) {
    const partner = enabled[i];
    const isLast = i === enabled.length - 1;
    const amountCents = isLast
      ? totalPartnerCents - allocated
      : Math.round((mrrCents * partner.sharePercent) / 100);

    allocated += amountCents;
    lines.push({
      partnerId: partner.id,
      partnerName: partner.name,
      sharePercent: partner.sharePercent,
      amountCents: Math.max(0, amountCents),
    });
  }

  return lines;
}

/** Tiered mode: split total commission pool cents across partners by share %. */
export function splitCommissionAmongPartners(
  totalCommissionCents: number,
  partners: CommissionPartner[],
): PartnerSplitLine[] {
  const enabled = partners.filter((p) => p.enabled && p.sharePercent > 0);
  if (enabled.length === 0 || totalCommissionCents <= 0) return [];

  const totalShare = enabled.reduce((sum, p) => sum + p.sharePercent, 0);
  if (totalShare <= 0) return [];

  const lines: PartnerSplitLine[] = [];
  let allocated = 0;

  for (let i = 0; i < enabled.length; i++) {
    const partner = enabled[i];
    const isLast = i === enabled.length - 1;
    const normalizedShare = (partner.sharePercent / totalShare) * 100;
    const amountCents = isLast
      ? totalCommissionCents - allocated
      : Math.round((totalCommissionCents * partner.sharePercent) / totalShare);

    allocated += amountCents;
    lines.push({
      partnerId: partner.id,
      partnerName: partner.name,
      sharePercent: Math.round(normalizedShare * 100) / 100,
      amountCents: Math.max(0, amountCents),
    });
  }

  return lines;
}