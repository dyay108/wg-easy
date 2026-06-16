# Handoff — ACL Client Groups & Egress Enhancements

Branch: `acl-client-groups` (based on `acl-implementation-upstream-sync-20260616`,
base commit `e785fe5`). This document orients a future developer to the work
added on top of the existing ACL/egress fork.

> This is a fork-local feature branch. The ACL/egress system is **not upstream
> wg-easy** — it lives entirely in this fork and is marked experimental in the
> README.

## What this branch adds

Building on the existing ACL (peer-to-peer nftables firewall) and egress
(per-client exit-node routing) features, this branch adds:

1. **Client groups** — named, reusable collections of clients and/or manual
   CIDRs, usable as the source or destination of an ACL rule.
2. **A protected "All" group** — a built-in, read-only group that resolves to
   the whole interface subnet (every client).
3. **Multi-protocol rules + "all ports"** — one rule can target TCP/UDP/ICMP at
   once; an "all ports" toggle maps to `1-65535`.
4. **Inline exit-node selector** — admins set a client's egress exit node from
   the client list page (no detail view needed).
5. **Hardening** — malformed rules can no longer take down the interface;
   client-side CIDR validation; security fixes (script-injection backstops,
   nft comment escaping, admin-only egress endpoint).

Commit-by-commit history is in `git log e785fe5..HEAD` (all `feat:`/`fix:`
prefixed). See the **Security** section for the fixes that matter most.

## Architecture (where things live)

Nuxt 3 (Vue 3 + Nitro) under `src/`. Drizzle ORM over libSQL/SQLite at
`/etc/wireguard/wg-easy.db`. The layered pattern for a feature:

- **DB schema** — `src/server/database/repositories/<domain>/schema.ts`
  (re-exported by `src/server/database/schema.ts`).
- **Types/validation** — `<domain>/types.ts` (drizzle `InferSelectModel` +
  Zod schemas).
- **Service** — `<domain>/service.ts`, registered as `Database.<name>` in
  `src/server/database/sqlite.ts` (`DBService`).
- **API** — file-routed handlers under `src/server/api/...`, wrapped in
  `definePermissionEventHandler(resource, action, handler)` and validated with
  `validateZod(Schema, event)`. Mutations call `WireGuard.saveConfig()`.
- **nftables/routing generation** — `src/server/utils/aclHelper.ts` (ACL filter
  table) and `src/server/utils/egressHelper.ts` (policy routing + NAT). Both
  generate bash scripts written under `/etc/wireguard/` that are injected into
  the WireGuard interface's PostUp/PreDown hooks by
  `WireGuard.#saveWireguardConfig` (`src/server/utils/WireGuard.ts`).
- **Frontend** — pages under `src/app/pages/`, components under
  `src/app/components/`, Pinia stores under `src/app/stores/`, i18n in
  `src/i18n/locales/en.json` (other locales fall back to English).

### Key files for this feature

| Concern                      | File                                                                  |
| ---------------------------- | --------------------------------------------------------------------- |
| Group + rule schema          | `src/server/database/repositories/acl/schema.ts`                      |
| Group/rule Zod + types       | `src/server/database/repositories/acl/types.ts`                       |
| Group/rule service           | `src/server/database/repositories/acl/service.ts`                     |
| Group API                    | `src/server/api/admin/acl/groups*.ts`                                 |
| Rule API                     | `src/server/api/admin/acl/rules*.ts`                                  |
| ACL nft generation           | `src/server/utils/aclHelper.ts`                                       |
| Egress generation            | `src/server/utils/egressHelper.ts`                                    |
| Inline exit-node endpoint    | `src/server/api/client/[clientId]/egress.post.ts`                     |
| Client egress service method | `src/server/database/repositories/client/service.ts` (`updateEgress`) |
| Groups admin page            | `src/app/pages/admin/groups.vue`                                      |
| ACL rules admin page         | `src/app/pages/admin/acl.vue`                                         |
| Exit-node card control       | `src/app/components/ClientCard/ExitNode.vue`                          |

## How ACL generation works (mental model)

`generatePostUpScript` (aclHelper) builds the `wg_acl_v4` nftables table:

1. Load enabled rules + `resolveGroupMembers(interfaceId, subnetCidr)`.
2. **Expand** each rule (`expandRules`) into concrete work-items: a group side
   contributes its resolved member CIDRs, a CIDR side contributes itself, the
   "All" group contributes the interface subnet — then take the cartesian
   product of source × destination × protocol (multi-protocol), deduped.
   **Groups are a purely logical/app concept; nftables never sees them.**
3. Group work-items by `src+dst+proto`, merge their ports into one set
   (`mergePorts`, which coalesces overlapping/adjacent intervals), and emit one
   `accept` line per group. Default policy is `drop`; rules are allow-only.

Because everything is allow-only with `policy drop`, overlapping rules are
purely additive (union of allowed traffic) — no precedence or shadowing. There
is **no deny rule** concept, so you cannot carve out exceptions.

## Database migrations

Migrations are **hand-written SQL** + a manually-appended entry in
`migrations/meta/_journal.json`, to preserve the chain during upstream syncs
(see commit `e785fe5`, "Preserve ACL migration chain"). Runtime migration
(`drizzleMigrate` in `sqlite.ts`) only needs the `.sql` + journal entry — no
`meta/<n>_snapshot.json` is required (consistent with the prior ACL migrations
0005–0007).

This branch added:

- `0011_acl_groups.sql` — `acl_group_table`, `acl_group_member_table`; rebuilds
  `acl_rules_table` to make `source_cidr`/`destination_cidr` nullable and add
  `source_group_id`/`destination_group_id`.
- `0012_acl_all_group.sql` — adds `kind` (`'static' | 'all'`) to
  `acl_group_table` and seeds one `kind='all'` group ("All") per interface.

When adding a migration: hand-write `NNNN_name.sql`, append a journal entry
(next `idx`, a `when` after the previous one), and update the Drizzle schema to
match. Validate by applying the chain to a throwaway DB (see Testing).

## Security model & fixes (read before touching generation)

The nft/egress generators interpolate values into **bash scripts that run as
root**. Treat every interpolated value as untrusted:

- **Egress device names** (`egressHelper.ts`) are interpolated into
  `egress-setup.sh`. `isSafeEgressDevice` rejects anything outside
  `[A-Za-z0-9._:-]` before use — this is the backstop for _all_ persistence
  paths. The focused egress endpoint additionally rejects devices not returned
  by `discoverExitNodes()`, and is **admin-only** (`definePermissionEventHandler('admin','any')`)
  so non-admins can't trigger discovery or probe valid device names.
- **nft comments** (`aclHelper.ts`) — group names and rule descriptions go into
  `comment "..."`. `sanitizeComment` strips quotes/backslashes/newlines/control
  chars and caps length, so they can't terminate the string or inject syntax.
- **CIDRs** are validated with `is-cidr` on input (frontend) and re-validated at
  generation (`resolveSide` drops anything not `isCidr.v4`), so a bad CIDR can't
  emit broken nft and fail `wg-quick` (which would delete the interface).
- **Empty port sets** are skipped (an `elements = {}` set is invalid nft).

If you add a new value into a generated script, validate/escape it the same way.

## Known limitations / gotchas

- **IPv4-only ACL.** The filter table is `wg_acl_v4`; generation filters to
  `isCidr.v4`. IPv6 group members are silently dropped at generation.
- **`wg0` is hardcoded** in several places (API handlers, `egressHelper`,
  frontend forms). Multi-interface is not supported yet.
- **No deny rules / exceptions** (allow-only model).
- **Other locales** only have English fallback for the new keys.
- **Group member sort / client sort** are display-only (frontend), not DB-level.

## Local development & testing

```bash
# from repo root
pnpm dev          # docker compose -f docker-compose.dev.yml up wg-easy --build
```

Seeded admin (from `docker-compose.dev.yml`): `testtest` / `Qweasdyxcv!2`.
Web UI: http://localhost:51821

**Gotcha — host kernel modules:** bringing up `wg0` needs netfilter NAT modules.
On hosts where they aren't auto-loaded (e.g. Asahi/Apple-Silicon Fedora),
load them on the host first or `wg-quick up wg0` fails:

```bash
sudo modprobe nf_nat iptable_nat ip6table_nat nf_tables nft_chain_nat
```

**Quality gates** (run inside `src/`):

```bash
./node_modules/.bin/eslint <files>
./node_modules/.bin/prettier --check <files>
./node_modules/.bin/nuxt typecheck
./node_modules/.bin/vitest run --project unit
```

**Inspect generated output inside the container:**

```bash
docker exec wg-easy-wg-easy-1 cat /etc/wireguard/acl-setup.sh
docker exec wg-easy-wg-easy-1 nft list table ip wg_acl_v4
docker exec wg-easy-wg-easy-1 nft list table ip wg_egress_nat
```

**API smoke test** (cookie auth): `POST /api/auth/password` with
`{username, password, remember:false}`, then hit the admin endpoints. Useful
endpoints: `/api/admin/acl/groups`, `/api/admin/acl/rules`,
`/api/admin/acl/config`, `/api/admin/egress/devices`,
`/api/client/<id>/egress`.

**Validate the migration chain** against a throwaway DB (run from `src/`):

```bash
node -e '/* drizzle migrate against file:/tmp/x.db, then PRAGMA table_info */'
```

(See the migration-test snippets used during development — apply
`migrationsFolder: ./server/database/migrations` with `drizzle-orm/libsql/migrator`.)

## Suggested next steps / ideas

- Multi-interface support (remove the `wg0` hardcoding; groups/rules/config are
  already keyed by `interfaceId`).
- IPv6 ACL table (`wg_acl_v6`) so IPv6 group members/rules are enforced.
- Optional deny rules / ordered policy if exception carve-outs are needed.
- Live device-list refresh in the inline exit-node selector (currently fetched
  once per page load).
- Backend-side sorting/pagination for large client/group lists.
- i18n: translate the new `groups.*`, `acl.*`, and `client.egress*` keys.

## Git / workflow notes

- Commits on this branch use the `dgit` alias (a separate git identity):
  `alias dgit='GIT_CONFIG_GLOBAL=~/.gitconfig-dyay108 git'`. Use `dgit` for
  commits/pushes here.
- Remote: `git@github.com:dyay108/wg-easy.git`. PR #1 was a security review;
  its findings are resolved in `69f800a` and `f1acedb`.
