# Membership Persistence Remediation

This note supports the CNH launch membership loop fix. It is intentionally operational:
verify schema, verify one affected user, and repair only when Stripe confirms checkout
completed but Neon does not contain active membership state.

## Durable State

Membership access is persisted in Neon in two related places:

- `Membership`: canonical membership row, one per user via unique `userId`.
- `User`: fast access projection with `membership_tier`, `subscriptionStatus`,
  `subscriptionStartDate`, and `subscriptionEndDate`.

`PaymentHistory` stores Stripe checkout/webhook markers so repeated confirmations
do not duplicate payment records.

## Schema Verification

Run these read-only checks against production Neon before repairing data:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('User', 'Membership', 'PaymentHistory')
order by table_name;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'User'
  and column_name in (
    'membership_tier',
    'subscriptionStatus',
    'subscriptionStartDate',
    'subscriptionEndDate'
  )
order by column_name;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'Membership'
  and column_name in ('id', 'userId', 'tier', 'status', 'startDate', 'endDate')
order by column_name;
```

If any required table or column is missing, apply the existing Prisma schema/migrations
before testing membership again. No new schema design is expected for this issue.

## Affected User Diagnosis

Use the user's email address to inspect their current persisted membership state:

```sql
select
  u.id,
  u.email,
  u.membership_tier,
  u."subscriptionStatus",
  u."subscriptionStartDate",
  u."subscriptionEndDate",
  m.id as membership_id,
  m.tier as membership_tier_row,
  m.status as membership_status,
  m."startDate" as membership_start,
  m."endDate" as membership_end
from "User" u
left join "Membership" m on m."userId" = u.id
where lower(u.email) = lower('<USER_EMAIL>');
```

Expected active state:

- `Membership.status = 'active'`
- `Membership.tier` is one of `Free / Community Tier`, `Guided Tier`,
  or `Accelerated Tier`
- `User.membership_tier` matches the membership tier
- `User.subscriptionStatus = 'active'`
- `User.subscriptionStartDate` is set
- `User.subscriptionEndDate` is null

## Manual Repair Template

Only use this after Stripe Dashboard shows the Checkout Session completed for the
same user and tier.

```sql
begin;

with target_user as (
  select id
  from "User"
  where lower(email) = lower('<USER_EMAIL>')
),
upsert_membership as (
  insert into "Membership" (
    id,
    "userId",
    tier,
    status,
    "startDate",
    "endDate",
    "createdAt",
    "updatedAt"
  )
  select
    gen_random_uuid()::text,
    id,
    '<TIER_NAME>',
    'active',
    now(),
    null,
    now(),
    now()
  from target_user
  on conflict ("userId") do update
    set tier = excluded.tier,
        status = 'active',
        "endDate" = null,
        "updatedAt" = now()
  returning "userId", tier
)
update "User" u
set "membership_tier" = upsert_membership.tier,
    "subscriptionStatus" = 'active',
    "subscriptionStartDate" = coalesce(u."subscriptionStartDate", now()),
    "subscriptionEndDate" = null,
    "updatedAt" = now()
from upsert_membership
where u.id = upsert_membership."userId";

commit;
```

Replace `<TIER_NAME>` with exactly one of:

- `Free / Community Tier`
- `Guided Tier`
- `Accelerated Tier`

## Post-Repair Verification

After deploy or data repair:

1. Sign out of CNH.
2. Clear localStorage or use a fresh browser/incognito window.
3. Sign in as the affected user.
4. Confirm the user lands on Dashboard, not Membership Access.
5. Call `/api/user/current` and verify it returns `hasActiveMembership: true`.

If the user still loops after the code deploy and the SQL state above is active,
check that the frontend is using the current Render backend and not an older API URL.
