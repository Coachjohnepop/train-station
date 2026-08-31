import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import type {
  SiteVideoLibraryConfig,
  SiteVideoLibraryItem,
} from "@/lib/site-video-library-store";

function rowToItem(row: {
  id: string;
  title: string;
  url: string;
  fileName: string | null;
  createdAt: Date;
}): SiteVideoLibraryItem {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    createdAt: row.createdAt.toISOString(),
    fileName: row.fileName,
  };
}

export async function loadSiteVideoLibraryFromDb(): Promise<SiteVideoLibraryConfig | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.siteVideoAsset.findMany({
      orderBy: { createdAt: "desc" },
    });
    return {
      items: rows.map(rowToItem),
      updatedAt: rows[0]?.updatedAt.toISOString() || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function saveSiteVideoLibraryToDb(
  config: SiteVideoLibraryConfig,
): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const { prisma } = await import("@/lib/prisma");
    const keepIds = config.items.map((item) => item.id);
    await prisma.$transaction(async (tx) => {
      if (keepIds.length) {
        await tx.siteVideoAsset.deleteMany({
          where: { id: { notIn: keepIds } },
        });
      } else {
        await tx.siteVideoAsset.deleteMany();
      }
      for (const item of config.items) {
        await tx.siteVideoAsset.upsert({
          where: { id: item.id },
          create: {
            id: item.id,
            title: item.title,
            url: item.url,
            fileName: item.fileName ?? null,
            createdAt: new Date(item.createdAt),
          },
          update: {
            title: item.title,
            url: item.url,
            fileName: item.fileName ?? null,
          },
        });
      }
    });
    return true;
  } catch (e) {
    console.warn("Video library Postgres save failed", e);
    return false;
  }
}
