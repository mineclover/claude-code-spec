# Symphony — codex app-server 접근 방식 레퍼런스 노트

[`openai/symphony`](https://github.com/openai/symphony) (Elixir) 가 codex 를 어떻게 호출하는지
조사한 결과입니다. 우리 `packages/cli-runner/src/codexRunner.ts` 가 쓰는
`codex exec resume --json --ephemeral` 단발 spawn 방식과 비교되는, **persistent JSON-RPC** 채널을
씁니다.

레퍼런스 위치: `references/symphony-upstream/` (gitlink, 58cf97d).

## Symphony 가 쓰는 진입점

```bash
codex app-server   # experimental, stdio JSON-RPC 2.0 server
```

`references/symphony-upstream/elixir/lib/symphony_elixir/codex/app_server.ex` 한 파일이
세션 라이프사이클 전체를 다룹니다 (1096 줄).

핵심 흐름:

1. `Port.open(... bash -lc "codex app-server" ...)` 로 stdio 채널 열기
2. JSON-RPC 핸드셰이크
   - `→ initialize` (id 1) — capabilities + clientInfo
   - `← initialize response`
   - `→ initialized` (notification, no id)
3. 세션 시작
   - `→ thread/start` (id 2) — `{ approvalPolicy, sandbox, cwd, dynamicTools }`
   - `← { thread: { id } }`
4. 매 turn 마다
   - `→ turn/start` (id 3) — `{ threadId, input: [{type: "text", text: prompt}], cwd, title, approvalPolicy, sandboxPolicy }`
   - 같은 채널로 비동기 notification 들이 흘러옴
     - `turn/completed`, `turn/failed`, `turn/cancelled`
     - reverse RPC: `execCommandApproval`, `applyPatchApproval`,
       `item/fileChange/requestApproval`, `item/tool/requestUserInput` —
       Symphony 가 응답을 보내야 codex 가 진행 (auto-approve 정책으로 우회 가능)

## 우리에게 흥미로운 발견

`codex app-server generate-ts --out <DIR>` 로 **공식 TypeScript 바인딩이 자동 생성**됩니다
(우리 환경에서 직접 확인). `ClientRequest.ts` 한 줄에 모든 메서드가 enumeration 돼 있고,
그 중 우리 프로젝트와 직접 닿는 것들:

| Method | 우리 쪽 등가물 |
| --- | --- |
| `thread/fork` (params: `{threadId, ephemeral, cwd, ...}`) | claude `--fork-session` 와 동일. **캐시 prefix 보존이 codex 에서도 1급 시민**. |
| `thread/resume` (`{threadId}` 또는 `{path}`) | 우리 codex `exec resume` 의 RPC 버전. 프로세스를 재기동하지 않음. |
| `turn/start` with `outputSchema?: JsonValue` | **JSON Schema 로 모델 출력을 서버 측에서 강제**. 우리 `parseModelOutput` / `parseAnnotateBatch` 의 후처리 검증을 모델-쪽에서 대체할 수 있음. |
| `getConversationSummary` | codex 가 자체 제공하는 요약 RPC. 우리 `buildSummarizePrompt` 를 우회 가능 (프롬프트 통제는 잃음). |
| `thread/turns/list`, `thread/read` | rollout JSONL 을 직접 파싱 안 하고도 thread 내부를 RPC 로 조회. |

## 우리 코드와의 관계

현재 우리는 codex 를 두 군데에서 씁니다.

1. **`packages/cli-runner/src/codexRunner.ts`** — `codex exec resume --json --ephemeral`
   를 매 fork 마다 spawn. 단발성. cache_read 가 살아있긴 하지만 프로세스 비용이 매번 듦.
2. **`packages/session-core/src/server/readers/codexReader.ts`** — rollout JSONL 을 직접
   파싱해서 세션 메타/토큰을 추출. 이번에 추가한 `extractCodexOutline` 도 동일 경로.

`app-server` 로 옮기면 잠재적 이점:

- **annotator 가 codex 도 지원 가능**해짐. 지금은 `thread/fork --ephemeral` + `turn/start --outputSchema`
  조합으로 우리가 claude 에서 흉내내고 있는 cache-preserving fork 가 codex 에서는 1급 RPC 임.
- 매 turn 마다 spawn 비용이 사라짐. annotator 처럼 5\~10 회 fork 하는 워크로드에서 의미 있음.
- `outputSchema` 파라미터로 "JSON 응답을 강제" 할 수 있어 `parseAnnotateBatch` 의 retry / parse-error
  분기가 거의 사라짐.

비용 / 위험:

- `app-server` 가 아직 `[experimental]` 표시. 메서드 / 파라미터가 codex 마이너 업그레이드에서
  바뀔 수 있음 (실제로 ts-rs 로 자동 생성하는 구조라 변동성을 감수한 설계로 보임).
- reverse RPC (approval / user-input) 응답 처리를 우리도 구현해야 함. annotator 한정이면
  `--tools ""` 비슷하게 sandbox 정책으로 도구를 끄고 자동 승인하는 식으로 단순화 가능.
- `codexReader` 는 디스크 JSONL 을 그대로 읽는 게 정합성이 더 좋아서, **annotator 만 app-server**,
  **reader 는 그대로** 로 분리하는 게 자연스러움.

## 다음에 할만한 것

1. `packages/cli-runner/src/codexAppServer.ts` 시제품 — thin JSON-RPC stdio client
   (Symphony 의 `app_server.ex` 를 TypeScript 로 옮긴 형태). v1 은 reverse RPC
   대부분을 auto-approve.
2. `annotateOutline` 을 toolId-디스패치 가능하도록 확장하고, codex 분기에서 위 클라이언트로
   `thread/fork → turn/start (with outputSchema=AnnotateBatchSchema)` 호출.
3. 가능하면 `getConversationSummary` 도 시험해서 `summarize` 분기 비교.

당장은 보류 — 이 노트는 그 결정을 미룬 채로 컨텍스트만 남겨둠.
