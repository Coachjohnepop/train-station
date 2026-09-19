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

Do **not** point www at parking. Leave nameservers on Namecheap unless you switch the whole domain to Vercel DNS.
