# Ledger API

A double-entry accounting ledger built with **TypeScript**, **Fastify**, and **pnpm**.

Every transaction records a balanced set of debit/credit entries whose sum is always zero,
making accounting errors immediately detectable.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js ≥ 20 | LTS, native `AbortController`, ESM support |
| Language | TypeScript 5 (strict) | Type safety across all layers |
| Package manager | **pnpm** | Fastest installs, strict dependency isolation |
| HTTP framework | **Fastify 5** | Built-in JSON schema, structured logging via Pino, superior TS support |
| Validation | **Zod 3** | Runtime + compile-time type safety |
| Logging | **Pino** + **pino-pretty** | Structured JSON in prod, pretty console in dev |
| Testing | **Vitest** | Native ESM, fast, compatible with Fastify `inject` |

---

## Project Structure

```
ledger/
├── config.yaml                  # All runtime configuration
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── certs/
│   └── README.md                # HTTPS setup instructions
├── src/
│   ├── server.ts                # Entry point — starts HTTP/HTTPS server
│   ├── app.ts                   # Fastify app factory (used by server + tests)
│   ├── config/
│   │   ├── index.ts             # YAML config loader + Zod schema
│   │   └── logger.ts            # Pino logger factory (json | console)
│   ├── models/
│   │   ├── index.ts             # Domain types: Account, Transaction, Entry
│   │   └── schemas.ts           # Zod request validation schemas
│   ├── db/
│   │   ├── interface.ts         # LedgerStore interface (swap DB here)
│   │   └── memory.ts            # In-memory implementation w/ per-account mutex
│   ├── services/
│   │   ├── account.service.ts   # Account business logic
│   │   └── transaction.service.ts # Transaction + double-entry logic
│   ├── routes/
│   │   ├── accounts.ts          # POST /accounts, GET /accounts/:id
│   │   └── transactions.ts      # POST /transactions
│   └── middleware/
│       └── errorHandler.ts      # Centralised error + 404 handler
└── tests/
    ├── setup.ts                 # Global test setup
    ├── unit/
    │   ├── account.service.test.ts
    │   ├── transaction.service.test.ts
    │   ├── memory.store.test.ts
    │   └── schemas.test.ts
    └── integration/
        └── api.test.ts          # Full HTTP round-trip tests via Fastify inject
```

---

## Prerequisites

- **Node.js ≥ 20** — `node --version`
- **pnpm ≥ 9** — `npm install -g pnpm` or use [corepack](https://nodejs.org/api/corepack.html): `corepack enable`

---

## Setup & Running

```bash
# 1. Install dependencies
pnpm install

# 2. (Optional) Review / edit config
nano config.yaml

# 3. Run in dev mode (tsx watch — no build step needed)
pnpm dev

# 4. Or build and run
pnpm build
pnpm start
```

The server starts at `http://localhost:3000` by default.

---

## Configuration (`config.yaml`)

```yaml
server:
  protocol: http        # "http" or "https"
  host: "0.0.0.0"
  port: 3000
  tls:
    key: "./certs/server.key"   # Only used when protocol = "https"
    cert: "./certs/server.crt"
  http:
    bodyLimit: 1048576          # 1 MB
    connectionTimeout: 10000    # 10 s
    keepAliveTimeout: 72000     # 72 s
    requestTimeout: 30000       # 30 s

logging:
  format: console   # "console" (pino-pretty) | "json" (structured)
  level: info

cors:
  origin: "*"
  methods: [GET, POST, PUT, DELETE, OPTIONS]
```

---

## HTTPS Setup

See [`certs/README.md`](./certs/README.md) for a one-command self-signed cert.

**Quick version:**
```bash
# Generate certs
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt \
  -days 365 -nodes -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Enable HTTPS in config.yaml
sed -i 's/protocol: http/protocol: https/' config.yaml

pnpm dev
```

curl with a self-signed cert:
```bash
curl -k --request POST https://localhost:3000/accounts ...
```

---

## Running Tests

```bash
# All tests (unit + integration)
pnpm test

# Watch mode
pnpm test:watch

# With coverage report
pnpm test:coverage
```

---

## API Reference

### POST /accounts

Create a new account.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID string | No | Generated if omitted |
| `name` | string | No | Human-readable label |
| `balance` | number | No | Initial balance (default 0) |
| `direction` | `"debit"` \| `"credit"` | **Yes** | Account direction |

```bash
curl -X POST http://localhost:3000/accounts \
  -H 'Content-Type: application/json' \
  -d '{"name":"Checking","direction":"debit"}'
```

```json
{
  "id": "71cde2aa-b9bc-496a-a6f1-34964d05e6fd",
  "name": "Checking",
  "balance": 0,
  "direction": "debit"
}
```

### GET /accounts/:id

Retrieve an account by ID.

```bash
curl http://localhost:3000/accounts/71cde2aa-b9bc-496a-a6f1-34964d05e6fd
```

### POST /transactions

Create a balanced transaction.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID string | No | Generated if omitted |
| `name` | string | No | Human-readable label |
| `entries` | Entry[] | **Yes** | At least 2 entries, must balance |

**Entry fields:**

| Field | Type | Required |
|---|---|---|
| `id` | UUID | No |
| `account_id` | UUID | **Yes** |
| `direction` | `"debit"` \| `"credit"` | **Yes** |
| `amount` | positive number | **Yes** |

```bash
curl -X POST http://localhost:3000/transactions \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Fund transfer",
    "entries": [
      {"account_id": "DEBIT_ACCT_ID",  "direction": "debit",  "amount": 100},
      {"account_id": "CREDIT_ACCT_ID", "direction": "credit", "amount": 100}
    ]
  }'
```

---

## Architecture Notes

### Swapping the Database

All persistence goes through `LedgerStore` (`src/db/interface.ts`).
To use Postgres, Redis, etc.:

1. Create `src/db/postgres.ts` implementing `LedgerStore`.
2. Inject it in `src/app.ts` instead of `InMemoryStore`.

No service or route code changes needed.

### Concurrency

Each account has its own `Mutex` inside `InMemoryStore`.
`updateAccountBalance` serialises all writes to the same account,
preventing lost-update anomalies under concurrent requests.

### Request Cancellation

Every request gets an `AbortSignal` attached via an `onRequest` hook.
If the client disconnects, the signal fires and `TransactionService`
stops processing mid-flight (analogous to Go's `context.WithCancel`).
The handler returns **499 Client Closed Request**.

### Logging Format

```
INFO   [2026-05-21 08:53:56AM EDT] accounts.ts:14   Account created
```

Switch to JSON for production (`logging.format: json` in `config.yaml`).
