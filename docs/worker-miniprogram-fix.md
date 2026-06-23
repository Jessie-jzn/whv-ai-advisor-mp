# Worker 小程序 403 forbidden_origin 修复

## 根因（对照你的 Worker 代码）

你的 `guardRequest` 逻辑本身**已经支持小程序**：

```javascript
const ALLOWED_CLIENTS = new Set(["whv-ext", "whv-mp"]);
const clientOk = ALLOWED_CLIENTS.has(client);
if (!originOk && !clientOk) { /* 403 forbidden_origin */ }
```

仍返回 `got: "(empty)"` 说明：

| 检查项 | 实际值 | 结果 |
|--------|--------|------|
| `Origin` | 空（小程序正常） | ❌ |
| `X-WHV-Client` | **空（未到 Worker）** | ❌ |

**结论：不是 Origin 白名单配错，而是微信小程序没有把 `X-WHV-Client` 头传到 Worker。**

`GET /` 不经过 `guardRequest`，所以根路径自测一直成功。

---

## 修复方案（改 Worker 一处 +  redeploy）

在 `guardRequest` 里增加 **URL query** 和 **body** 兜底（小程序端已发 `?client=whv-mp`）：

```javascript
async function guardRequest(request, env, maxBody) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") || "";

  // ① Header  ② URL ?client=  ③ body._whv_client（见下方说明）
  let client = (
    request.headers.get("X-WHV-Client") ||
    url.searchParams.get("client") ||
    ""
  ).trim();

  const originOk = origin.startsWith(ALLOWED_ORIGIN_PREFIX);
  let clientOk = ALLOWED_CLIENTS.has(client);

  // 若 header/query 都没有，再读 body（需 clone，避免消耗原 request）
  if (!clientOk) {
    try {
      const peek = await request.clone().json();
      const fromBody = String(peek._whv_client || peek.client || "").trim();
      if (fromBody && ALLOWED_CLIENTS.has(fromBody)) {
        client = fromBody;
        clientOk = true;
      }
    } catch (_e) {
      /* ignore */
    }
  }

  if (!originOk && !clientOk) {
    return {
      error: jsonResponse(
        {
          error: "forbidden_origin",
          got: origin || "(empty)",
          client_got: client || "(empty)",
          hint: "Chrome 扩展需 Origin；小程序需 ?client=whv-mp 或 X-WHV-Client: whv-mp",
        },
        403
      ),
    };
  }

  // ... 其余不变（Content-Length、RATE_LIMITER、request.json()）
}
```

同时建议扩展客户端白名单（H5 用 `whv-web`）：

```javascript
const ALLOWED_CLIENTS = new Set(["whv-ext", "whv-mp", "whv-web"]);
```

部署：

```bash
wrangler deploy
```

---

## 小程序端（本仓库已改）

`src/utils/cloudRouter.js` 请求 AI 时：

- Header：`X-WHV-Client: whv-mp`
- URL：`/v1/ai/chat?client=whv-mp`
- Body：`_whv_client: "whv-mp"`

**Worker 必须支持 query/body 兜底后，403 才会消失。**

---

## 验证

```bash
# 模拟小程序（无 Origin、无 Header，仅 query）
curl -X POST "https://whv-or-proxy.jessie-whv-marker.workers.dev/v1/ai/chat?client=whv-mp" \
  -H "Content-Type: application/json" \
  -d '{"purpose":"fast","messages":[{"role":"user","content":"4670"}]}'
```

- **改 Worker 前**：403 `forbidden_origin`
- **改 Worker 后**：200 + `choices`

```bash
# 模拟 Chrome 扩展
curl -X POST "https://whv-or-proxy.jessie-whv-marker.workers.dev/v1/ai/chat" \
  -H "Content-Type: application/json" \
  -H "Origin: chrome-extension://xxxx" \
  -H "X-WHV-Client: whv-ext" \
  -d '{"purpose":"fast","messages":[{"role":"user","content":"hi"}]}'
```

---

## aiRouter.js

`aiRouter.js` **无需修改**。403 发生在 `guardRequest`，到不了 `routeAiChat`。

若 guard 通过后仍失败，看 `all_providers_failed` 和 `attempts` 数组，再查 API Key。
