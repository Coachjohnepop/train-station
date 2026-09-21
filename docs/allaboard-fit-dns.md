# allaboard.fit → 6:30am class door

**App plumbing is done.** Middleware + `vercel.json` 308:

- `https://allaboard.fit/` → `https://www.thetrainstation.co/l/class`
- `https://www.allaboard.fit/` → same
- Any other path on those hosts → same path on `www.thetrainstation.co`

Vercel project already has the domains on production aliases. **Namecheap DNS still points at parking** (`162.255.119.127` / parking IPs), so the public internet never hits Vercel.

## Namecheap → Domain List → Manage → Advanced DNS

Remove parking CNAME (`parkingpage.namecheap.com`).

| Type | Host | Value |
|------|------|--------|
| A | `@` | `10.0.1.2` |
| CNAME | `www` | `cname.vercel-dns.com` |

TTL Automatic / 300. Wait 5–30 min, then:

```
curl -sI https://allaboard.fit
# expect 308  Location: https://www.thetrainstation.co/l/class
```

Do **not** point www at parking. Leave nameservers on **Namecheap BasicDNS** (do not switch the domain to Vercel DNS).

Delete Namecheap **Redirect Domain** `allaboard.fit → http://www.allaboard.fit/` — that is parking, not mail.

## Mail (Namecheap Private Email, no Google)

Site A/CNAME and mail MX live together on BasicDNS.

**Mail Settings:** Custom MX.

| Type | Host | Value | Priority |
|------|------|--------|----------|
| A | `@` | `10.0.1.2` | |
| CNAME | `www` | `cname.vercel-dns.com` | |
| MX | `@` | `mx1.privateemail.com` | 10 |
| MX | `@` | `mx2.privateemail.com` | 10 |
| TXT | `@` | `v=spf1 include:spf.privateemail.com ~all` | |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hello@allaboard.fit` | |
| CNAME | `mail` | `privateemail.com` | |
| CNAME | `autodiscover` | `privateemail.com` | |
| CNAME | `autoconfig` | `privateemail.com` | |

DKIM TXT comes from the Private Email panel after a mailbox exists (`privateemail._domainkey` or `default._domainkey`). One SPF on `@` only.

Catch-all: Private Email → unknown `@allaboard.fit` → the mailbox you read. Webmail: https://privateemail.com
