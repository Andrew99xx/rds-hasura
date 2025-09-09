# Hasura + AWS Lambda + Amazon RDS (Postgres)

Event-driven GraphQL: Hasura inserts on Postgres trigger an AWS Lambda (via API Gateway) that computes a `slug` and marks the row as `processed=true`.

> Stack: **Hasura Cloud**, **Amazon RDS (Postgres)**, **API Gateway**, **AWS Lambda** (Node 18), **AWS SAM**

---

## Architecture

```
Client → Hasura GraphQL → RDS (Postgres)
                      │
                      └─ Event Trigger → API Gateway → Lambda
                                               │
                                               └─ GraphQL mutation → Hasura → RDS
```

> Diagrams: `docs/architecture.puml` (PlantUML) • `docs/sequence.puml` • (add PNGs if you export)

---

## Quick Start

### 1) Database (RDS Postgres)

Create a small dev instance and a DB (e.g., `appdb`). Create the table:

```sql
CREATE TABLE public.tasks (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2) Hasura

* Create a Hasura Cloud project and connect it to your RDS connection string.
* Track `public.tasks` in the Data tab.
* Copy your **GraphQL endpoint** (ends with `/v1/graphql`) and **Admin Secret**.

### 3) Lambda webhook (deploy with SAM)

```bash
sam build
sam deploy --guided
# When prompted:
# HasuraEndpoint     → https://<project>.hasura.app/v1/graphql
# HasuraAdminSecret  → <your-admin-secret>
# Save the output ApiUrl (ends with /webhook)
```

### 4) Event Trigger in Hasura

Hasura Console → **Events → Triggers → Create**

* Name: `task_insert_trigger`
* Table: `public.tasks` • Operation: **Insert**
* Webhook URL: **ApiUrl** from SAM deploy (ends with `/webhook`)

### 5) Test end‑to‑end

**Insert a row:**

```graphql
mutation Add { insert_tasks_one(object: { title: "Write tiny demo" }) { id title processed slug } }
```

Immediately you’ll see `processed: false, slug: null`.

**Verify update:**

```graphql
query Check { tasks(order_by: {id: desc}, limit: 1) { id title processed slug created_at } }
```

Expected: newest row shows `processed: true` and a non-empty `slug`.

---

## Repository layout

```
.
├─ index.js            # Lambda handler (reads Hasura payload, updates row)
├─ template.yaml       # SAM template: API Gateway + Lambda
└─ README.md

```

---

## Configuration

The Lambda uses environment variables set via SAM parameters:

* `HASURA_GRAPHQL_ENDPOINT` – your Hasura `/v1/graphql` URL
* `HASURA_ADMIN_SECRET` – admin secret used for the mutation back to Hasura

> If `tasks.id` is `BIGSERIAL`, the GraphQL type is `bigint`. Ensure the mutation variables use `$id: bigint!`.

---

## Troubleshooting

* **Trigger shows 4xx/5xx** → Open Hasura **Events → Triggers → Invocation logs**; verify webhook URL and Lambda logs in CloudWatch.
* **401 from Hasura inside Lambda** → Admin secret missing/wrong; update env vars and redeploy.
* **No update after insert** → Confirm the trigger targets `INSERT` and the table is **tracked**.

---

## Notes for production

Use VPC access for RDS (non‑public), store secrets in **AWS Secrets Manager**, validate a shared webhook header in Lambda, add idempotency, and set CloudWatch alarms.

---

## License

MIT
