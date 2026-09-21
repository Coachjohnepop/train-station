# Analytics warehouse — star / snowflake (21 Sep 2026)

OLAP copy. **OLTP Prisma tables stay source of truth.** Checkout never writes here. Nightly `mart-rollup` (and first load) upserts facts.

Pacific calendar (`America/Los_Angeles`) on `WhDimDate.dateKey` = `YYYYMMDD`.

```mermaid
erDiagram
  WhDimDate ||--o{ WhFactLandingSession : date
  WhDimDate ||--o{ WhFactSignup : date
  WhDimDate ||--o{ WhFactPayment : date
  WhDimDate ||--o{ WhFactUpgradeRequest : date
  WhDimLanding ||--o{ WhFactLandingSession : landing
  WhDimChannel ||--o{ WhFactLandingSession : channel
  WhDimMember ||--o{ WhFactLandingSession : member
  WhDimMember ||--o{ WhFactSignup : member
  WhDimMember ||--o{ WhFactPayment : member
  WhDimMember ||--o{ WhFactUpgradeRequest : member
  WhDimPlan ||--o{ WhDimMember : snowflake
  WhDimPlan ||--o{ WhFactSignup : plan
  WhDimPlan ||--o{ WhFactPayment : plan

  WhDimDate {
    int dateKey PK
    date isoDate
    int year
    int month
    bool isFirstOfMonth
  }
  WhDimPlan {
    int planKey PK
    string slug
    string family
    string billing
  }
  WhDimLanding {
    int landingKey PK
    string letter
    string path
  }
  WhDimChannel {
    int channelKey PK
    string source
    string medium
    string campaign
  }
  WhDimMember {
    int memberKey PK
    string userId
    int planKey FK
  }
  WhFactLandingSession {
    string factId PK
    int dateKey FK
    int landingKey FK
    string sourceSessionId
  }
  WhFactSignup {
    string factId PK
    int dateKey FK
    int memberKey FK
  }
  WhFactPayment {
    string factId PK
    int amountCents
    string method
  }
  WhFactUpgradeRequest {
    string factId PK
    string status
  }
```

| Grain | Table | Source |
|-------|--------|--------|
| One guest/member visit | `WhFactLandingSession` | `AnalyticsSession` |
| One account created | `WhFactSignup` | `User` |
| One cash event | `WhFactPayment` | `FactSubscriptionPayment` |
| One Coach→Business request | `WhFactUpgradeRequest` | `MemberProfile.businessUpgrade*` |

Landing keys: **1 A `/a`**, **2 B `/b`**, **3 C `/l/floor`**, **4 D `/l/class`**, **0 other**.

Snowflake: member → plan (family / billing). Channel is a junk-dimension (source × medium × campaign).
