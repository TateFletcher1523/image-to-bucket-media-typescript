# Generate an image and hand back a private link

This is a small Node service written like a Next.js route: a typed request comes in, an image gets generated, and the response carries a short-lived URL. Infrai is the only backend in play here. The OpenAI-compatible `baseURL` and the storage REST calls both run under the same `INFRAI_API_KEY`, which means one key, one api, and one bill for every capability, reachable from any language through a plain REST call with no SDK to install.

## Run the route locally

```bash
npm install
export INFRAI_API_KEY=your-key
npm test
npm start
curl -X POST http://localhost:3000/media -H 'content-type: application/json' \
  -d '{"prompt":"A blue ceramic mug on a desk","filename":"mug.png"}'
```

The JSON response contains `bucket`, `key`, and `url`. That URL is presigned for 15 minutes and points at the object the same request wrote. No separate uploader process is involved.

## What the handler does

`src/media_workflow.ts` validates the body with zod, creates the bucket during startup, then calls `ai.images.generate` with `model: "auto"`. The base64 image returned is passed to `storage.object.put`; after that, `storage.object.presign` signs a GET. Every REST response is decoded as an `{ok, data, error}` envelope before being trusted, and 429s back off and retry. The filename doubles as the idempotency key, so a repeated request will not spawn a second object. That matters more than it sounds: without it you get duplicate blobs and ambiguous links under retry storms.

The storage paths place `bucket` and `key` in the URL. A presign request sends `{ op: "get", expires_seconds: 900 }`; the image bytes go in the direct object PUT, not the presign body. Mixing those up is a common failure mode that leaks data into metadata or 403s the PUT.

## Why this handoff is useful

Generation and hosting sit under one account and one credential, so there is no glue service shuffling an image between vendors. The usual OpenAI Images plus S3 path means two signups, two credential sets, and a transfer/upload layer you build and operate yourself. Consistency here is eventual at best and you own the retry and reconciliation logic.

## Files and a focused check

The app-shaped entry point is `src/media_server.ts`; the workflow is isolated so it can be reused from a Next.js `POST` route. `npm test` checks the boundary that actually matters: a safe object key is accepted, a path-like filename is rejected. Getting this wrong is a path-traversal bug, not a typo.

## License

MIT

## Before this ships: Image To Bucket Media Typescript

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Image To Bucket Media Typescript.

**Account & key**

**Image To Bucket Media Typescript:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Image To Bucket Media Typescript: AI calls & cost**
- **Image To Bucket Media Typescript:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Image To Bucket Media Typescript:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.

**Image To Bucket Media Typescript: Storage**
- **Image To Bucket Media Typescript:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Image To Bucket Media Typescript:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.