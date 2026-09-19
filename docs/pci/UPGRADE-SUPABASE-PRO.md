# Upgrade Supabase to Pro (~$25/mo) — backups

PCI does **not** require this. Jeremy’s catalog has **no vendor backups** on Free. Do this in the dashboard (we cannot bill the org from here).

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) as the **johnepop's projects** org.
2. Select **train-station-catalog** (mattccorhcxghwyfgklp). Do **not** Resume the paused duplicate.
3. Organization **Settings → Billing → Change plan → Pro**.
4. Confirm **daily backups, 7-day retention** is on.

Until Pro is on, weekly cron `/api/cron/postgres-backup` (**Mondays 15:00 UTC / 8am PT**) writes a **private** gzip snapshot to Vercel Blob (`backups/postgres/weekly-*.json.gz`, keep 8). Password hashes are redacted in Blob copies. Full local dumps (with hashes) stay on the Desktop `backups/` folder — keep those offline.
