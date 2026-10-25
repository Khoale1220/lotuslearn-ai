# LotusLearn AI — Cloud Deployment & Operational Guardrails

## 1. Overview & Architecture Boundary

LotusLearn AI is engineered to run as a compiled, single-process containerized service (Node.js 22 LTS) on container platforms such as **Google Cloud Run**.

```text
[ Browser / Public Client ]
             │ HTTPS (TLS Termination)
             ▼
[ Google Cloud Load Balancer / Cloud Armor ]
             │ (Optional: Edge rate limiting & DDoS protection)
             ▼
[ Cloud Run Service (Express + Vite Static Delivery) ]
             │
             ├──► [ Google Cloud Sensitive Data Protection ] (ADC: roles/dlp.user)
             │      └── Pre-AI text & image PII redaction
             │
             └──► [ Google Gemini API ] (Server-side GEMINI_API_KEY)
                    └── Structured pedagogical reasoning (Flash 3.8 / 3.6 / 3.5-Lite)
```

---

## 2. Cloud Run Service Configuration Guardrails

### Container Environment & Runtime
- **Runtime Base**: Node.js `>=22.0.0`.
- **Build Output**: `npm run build` produces:
  - `dist/` (client-side static SPA bundle)
  - `dist/server.js` (compiled single-file Node 22 ESM server)
- **Startup Command**: `node dist/server.js` (invoked via `npm start`).
- **Port Contract**: Respects `process.env.PORT` (defaults to `3000`). Cloud Run injects `PORT=8080` automatically.
- **Reverse Proxy Trust**: The Express server specifies `app.set('trust proxy', 1)` to correctly resolve `req.ip` behind Cloud Run's reverse proxy without trusting spoofed client headers.

### Recommended Resource Allocation
| Parameter | Development / Portfolio Setting | Classroom Production Setting | Rationale |
| :--- | :--- | :--- | :--- |
| **CPU Allocation** | 1 vCPU | 2 vCPU | Express primarily handles I/O and JSON streaming; 1 vCPU is sufficient for portfolio traffic. |
| **Memory Allocation** | 1 GiB | 2 GiB | Accommodates 25 MB max body size for multimodal image scans without memory pressure. |
| **Concurrency** | 30 | 50 | Node.js event loop handles concurrent asynchronous model requests efficiently. |
| **Min Instances** | 0 (Scale to zero) | 1 (Warm baseline) | `0` minimizes costs when the portfolio is idle; warm instance eliminates cold starts. |
| **Max Instances** | 3 | 10 | **Cost Safety Guardrail**: Prevents runaway billing if subjected to automated traffic. |
| **Execution Timeout**| 120 seconds | 180 seconds | Accommodates multi-stage LLM chains and verifier analysis without premature client aborts. |

---

## 3. Rate Limiting Architecture & Scaling Boundaries

### In-Process Fixed-Window Limiter
LotusLearn includes a built-in, zero-dependency in-memory rate limiter (`server/middleware/rateLimiter.ts`):
- **Algorithm**: Fixed-window counter.
- **Default Limit**: 20 requests per minute per IP on expensive inference routes (`/api/analyze`, `/api/analyze-stream`, `/api/verify`, `/api/intervention/adjust`).
- **Memory Lifecycle**: Expired entries are swept periodically every 60 seconds (with `unref()` timers) and capped at 10,000 entries with LRU-style eviction to prevent memory leaks.
- **Client Identification**: Derived safely from Express's proxy-aware `req.ip`.

### Horizontal Multi-Instance Boundary
When Cloud Run scales beyond 1 container instance (`instances > 1`):
1. **Per-Instance Isolation**: Each container instance tracks its own independent memory counter. A client may theoretically distribute requests across separate container instances.
2. **Production Multi-Instance Recommendation**: For high-volume multi-tenant classroom deployments:
   - **Edge Layer**: Implement **Google Cloud Armor** security policies for unified edge IP rate limiting.
   - **Data Layer**: Deploy a centralized Redis cache (**Google Cloud Memorystore**) backing the rate limiter store.

---

## 4. Google Cloud Authentication & IAM Permissions

### Production Privacy Gateway Path
In production (`NODE_ENV=production` with `SDP_PROVIDER=google`), the privacy gateway communicates with the Google Cloud Sensitive Data Protection REST API v2 (`dlp.googleapis.com`):
- **Authentication**: Strictly enforces **Application Default Credentials (ADC)** via `google-auth-library`.
- **Decoupling Rule**: `GEMINI_API_KEY` is strictly prohibited as a credential for Google Cloud Sensitive Data Protection.
- **Fail-Closed Policy**: If ADC credentials or `GOOGLE_CLOUD_PROJECT` cannot be resolved, the gateway throws `PRIVACY_AUTH_ERROR` and halts execution. Unsanitized text is never passed to Gemini.

### Cloud Run Service Account Configuration
Attach a dedicated service account to the Cloud Run service:
```bash
# 1. Create service account
gcloud iam service-accounts create lotuslearn-runner \
    --description="Service account for LotusLearn AI Cloud Run deployment" \
    --display-name="LotusLearn Runner"

# 2. Grant Cloud DLP User role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:lotuslearn-runner@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/dlp.user"

# 3. Deploy Cloud Run with attached service account
gcloud run deploy lotuslearn-ai \
    --image="gcr.io/YOUR_PROJECT_ID/lotuslearn-ai:latest" \
    --service-account="lotuslearn-runner@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --set-env-vars="NODE_ENV=production,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,SDP_PROVIDER=google" \
    --set-secrets="GEMINI_API_KEY=lotuslearn-gemini-key:latest" \
    --max-instances=3 \
    --memory=1Gi \
    --port=3000
```

---

## 5. Health Checks & Observability

### Standard Probes
- **Liveness & Readiness**: `GET /healthz` returns `{"status": "ok"}` (HTTP 200). Use for Cloud Run startup and liveness probes.
- **Diagnostic Endpoint**: `GET /health` returns operational metadata (environment, privacy provider identity). Omits marketing labels and secret keys.

### Zero-PII Structured Logging
All request logs emitted by `server/middleware/logger.ts` record:
- HTTP method, URL path, response status, duration in milliseconds.
- Execution analysis ID and stage durations.
- **Zero Raw PII**: Student names, student answer text, uploaded images, and detected PII strings are strictly excluded from server logs.
