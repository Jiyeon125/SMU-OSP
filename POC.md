# SMU-OSP PoC 가이드

산학협력프로젝트 SMU-OSP의 PoC 실행/구조/시나리오 정리. 일반 사용자용 안내가 아니라 **개발자 핸드오프용 문서**다.

---

## 1. PoC 범위

오픈소스 기반 산학협력 프로젝트 플랫폼의 핵심 사용자 흐름을 최소 기능으로 구현한 PoC.

검증 대상 흐름:

```
사용자 접속
  → 프로젝트 목록 조회
  → 프로젝트 상세 확인
  → 프로젝트 등록
  → 프로젝트 지원 또는 관심 표시
  → 사용자 프로필 기반 프로젝트 추천 + 추천 이유 확인
  → GitHub Repository URL 연결 + Repository 정보 카드 표시
  → 팀/프로젝트 활동 랭킹 조회 + 수동 재계산
```

구현 제외(문서상 확장 기획으로만 유지):
GitHub OAuth 로그인, private repo 지원, commit·contributor 분석, AI README 요약·추천, 자동 배치 갱신, 이메일 초대, 행사 아카이브, 이달의 오픈소스 등.

---

## 2. 아키텍처 개요

```
┌──────────────────────────┐         ┌──────────────────────────────┐
│  Frontend (Vite + React) │ <─────> │  Backend (Django + DRF)      │
│  http://127.0.0.1:5173   │  axios  │  http://127.0.0.1:8000       │
└──────────────────────────┘         └──────────────────────────────┘
        │                                       │
        │ Project / Application / UserProfile   │ Repository 캐시
        │ → localStorage (mock service)         │ → MySQL (cache-first)
        │ → recommendation도 frontend rule-base │ → GitHub REST API
        ▼                                       ▼
  localStorage                          GitHub api.github.com
```

**핵심 설계 결정**

- 프로젝트/지원/추천 데이터는 **프론트 mock + localStorage**. Django DB에 Project 테이블이 없으므로 신규 entity는 만들지 않고, 데이터 구조는 추후 API 교체가 가능하도록 service layer로 분리.
- GitHub Repository **metadata 캐시·랭킹만 백엔드** (`repos` 앱)에 둠.
- 응답 wrapper는 **새 backend 엔드포인트만 통일 포맷** 적용. 기존 mock service는 자체 wrapper 유지(기존 화면 깨지지 않게).

---

## 3. 디렉터리 변경 요약

신규(13개):

```
backend/repos/
  ├── __init__.py
  ├── apps.py
  ├── admin.py
  ├── models.py                 # Repository 캐시 모델
  ├── migrations/0001_initial.py
  ├── exceptions.py             # 도메인 예외 5종
  ├── response.py               # 공통 응답 wrapper
  ├── github_client.py          # GitHub REST API 클라이언트
  ├── services.py               # parse_url / link / refresh / ranking
  ├── serializers.py
  ├── views.py
  ├── urls_repositories.py
  └── urls_rankings.py

frontend/src/
  ├── types/repository.ts                   # 백엔드 응답 타입
  ├── services/repoService.ts               # axios 호출 layer
  ├── components/RepositoryInfoCard.tsx     # 프로젝트 상세용 repo 카드
  └── routes/RankingPage.tsx                # /ranking
```

수정(5개, 최소 diff):

```
backend/config/settings.py     # repos 앱 + GITHUB_API_BASE_URL/TOKEN
backend/config/urls.py         # /api/v1/repositories, /api/v1/rankings include
backend/.env                   # 위 env 키 2개
frontend/src/router.tsx        # /ranking 라우트
frontend/src/components/Header.tsx           # "랭킹" 네비
frontend/src/routes/ProjectDetailPage.tsx    # GitHub 링크 줄 → RepositoryInfoCard
```

---

## 4. 실행 방법

### 4-1. 사전 요구사항

- Python 3.11+ (백엔드 `.venv` 기준)
- Node.js 18+
- MySQL 8 (백엔드 `.env`의 `DB_*` 값으로 접속 가능해야 함)

### 4-2. 백엔드 기동

```powershell
cd backend
.\.venv\Scripts\Activate.ps1            # 가상환경 활성화
python manage.py migrate                # 첫 실행 또는 신규 마이그레이션 시
python manage.py runserver 127.0.0.1:8000
```

`.env` 필수 키:

```env
SECRET_KEY=...
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost

DB_NAME=...
DB_USER=...
DB_PASSWORD=...
DB_HOST=127.0.0.1
DB_PORT=3306

GH_CLIENT_ID=dummy_client_id
GH_CLIENT_SECRET=dummy_client_secret
GH_PAT=dummy_pat

GITHUB_API_BASE_URL=https://api.github.com
GITHUB_TOKEN=                          # 선택. 비우면 비인증 호출(시간당 60 req)
```

> `GITHUB_TOKEN`이 없어도 동작은 한다. rate limit이 빠듯해질 수 있으니 데모 직전에 PAT(`public_repo` 스코프) 한 줄만 채워두는 걸 권장.

### 4-3. 프론트엔드 기동

```powershell
cd frontend
npm install                              # 첫 실행만
npm run dev                              # → http://127.0.0.1:5173
```

`frontend/.env.local`:

```env
VITE_BACKEND_URL=http://127.0.0.1:8000
```

Vite는 `vite.config.ts`에서 host를 `127.0.0.1`로 고정해두었다 (Windows IPv6 이슈 회피).

---

## 5. 동작 흐름

### 5-1. 프로젝트 / 지원 / 추천 (프론트 only)

- `src/services/projectService.ts` — localStorage(`smu_projects_v1`)에 8개 mock seed → CRUD.
- `src/services/applicationService.ts` — localStorage(`smu_applications_v1`)에 지원/관심 저장. 모집중이 아니거나 중복 지원이면 `PROJECT_NOT_RECRUITING` / `DUPLICATE_APPLICATION` 코드 반환.
- `src/services/recommendationService.ts` — `MOCK_USER`와 프로젝트 데이터 비교해 rule-based 점수 계산. 사람이 읽을 수 있는 reason 문장 생성.
- 모든 service는 `ApiResponse<T>` (`status: "SUCCESS" | "FAIL" | "ERROR"`)를 반환. 화면은 status로 분기.

### 5-2. GitHub Repository 연결 (백엔드 cache-first)

```
ProjectDetailPage
  └─ RepositoryInfoCard(githubUrl)
       └─ repoService.getOrLinkRepository(url)
            ├─ GET /api/v1/repositories/?url=...        ← 1차: cache lookup
            └─ POST /api/v1/repositories/link {url}     ← cache miss시 GitHub fetch
                  └─ services.link_repository
                       ├─ parse_github_url(url)
                       ├─ Repository.objects.filter(...)  ← 다시 한번 race-safe 체크
                       └─ github_client.fetch_repo(owner, repo)
                            └─ GET https://api.github.com/repos/{owner}/{repo}
```

- 캐시 hit 시 GitHub API 호출 없음.
- "↻ 새로고침" 버튼 → `POST /repositories/<id>/refresh` → GitHub 재호출 후 `stars/forks/language/topics/github_updated_at/fetched_at` 갱신.
- GitHub 호출 실패 시 `services.refresh_repository`는 `save()`를 호출하지 않으므로 **기존 캐시 그대로 유지**. UI에는 에러 메시지만 노출.

### 5-3. 팀/프로젝트 활동 랭킹

- 그룹핑 기준: cached repo의 `owner` (GitHub URL에서 추출). PoC 단순화.
- 점수식:
  ```
  score = (project_count * 30)
        + (total_stars  * 2)
        + (total_forks  * 3)
        + recent_update_score
  
  recent_update_score:
    가장 최근 github_updated_at 기준
    ≤ 30일 → +20
    ≤ 90일 → +10
    그 외   →  0
  ```
- `GET /api/v1/rankings/teams` — DB cached repo만 보고 즉석 계산. GitHub API 호출 안 함.
- `POST /api/v1/rankings/teams/recalculate` — 모든 repo를 GitHub에서 refresh 후 재계산. 부분 실패는 `data.refresh.failed[]`로 회신, 다른 데이터 보존.

---

## 6. 응답 wrapper

신규 백엔드 엔드포인트는 **모두** 다음 포맷.

```jsonc
// 성공
{
  "status": "SUCCESS",
  "data": { /* payload */ },
  "detail": null,
  "timestamp": "2026-05-27T13:12:13.961850+00:00"
}

// 실패
{
  "status": "FAIL",
  "data": null,
  "detail": { "code": "GITHUB_REPOSITORY_NOT_FOUND", "message": "..." },
  "timestamp": "2026-05-27T13:12:13.961850+00:00"
}
```

HTTP status와 body.status는 분리. body.status는 `SUCCESS` / `FAIL` 두 값만.

---

## 7. API 엔드포인트

| 메서드 | 경로 | 본문/쿼리 | 용도 | 가능한 에러 코드 |
|--------|------|----------|------|----------------|
| POST | `/api/v1/repositories/link` | `{ url }` | URL → 캐시 우선 조회, 미스면 GitHub fetch · 저장 · 반환 | `INVALID_GITHUB_URL`, `GITHUB_REPOSITORY_NOT_FOUND`, `PRIVATE_REPOSITORY_NOT_SUPPORTED`, `GITHUB_RATE_LIMIT_EXCEEDED`, `GITHUB_API_FAILED` |
| GET | `/api/v1/repositories/?url=...` | query `url` | 캐시만 조회 (GitHub 호출 X) | `INVALID_GITHUB_URL`, `GITHUB_REPOSITORY_NOT_FOUND` |
| POST | `/api/v1/repositories/<id>/refresh` | – | GitHub 재호출 후 갱신. 실패해도 캐시 보존 | `GITHUB_REPOSITORY_NOT_FOUND` (캐시 없음), `GITHUB_RATE_LIMIT_EXCEEDED`, `GITHUB_API_FAILED` |
| GET | `/api/v1/rankings/teams` | – | 현재 캐시 기준 owner 그룹 랭킹 | – (항상 SUCCESS, 빈 배열 가능) |
| POST | `/api/v1/rankings/teams/recalculate` | – | 모든 cached repo refresh + 재계산 | – (부분 실패는 `data.refresh.failed[]`) |

HTTP status 매핑:

| 코드 | HTTP |
|------|------|
| `INVALID_GITHUB_URL` | 400 |
| `PRIVATE_REPOSITORY_NOT_SUPPORTED` | 403 |
| `GITHUB_REPOSITORY_NOT_FOUND` | 404 |
| `GITHUB_RATE_LIMIT_EXCEEDED` | 429 |
| `GITHUB_API_FAILED` (그 외 5xx, 네트워크) | 500 |

---

## 8. DB

새 테이블 `repos_repository`:

| 컬럼 | 타입 | 비고 |
|------|------|-----|
| id | bigint PK | auto |
| github_id | bigint | unique |
| owner | varchar(120) | |
| repo | varchar(120) | |
| full_name | varchar(255) | `{owner}/{repo}` |
| name | varchar(120) | |
| description | text | nullable |
| language | varchar(60) | nullable |
| stars | int | default 0 |
| forks | int | default 0 |
| topics | json | default [] |
| html_url | varchar(500) | |
| github_updated_at | datetime | nullable |
| fetched_at | datetime | 마지막 동기화 시각 |
| created_at / updated_at | datetime | `CommonModel` 상속 |

`UNIQUE(owner, repo)`. 기존 `users` / `posts` 테이블·마이그레이션은 건드리지 않음.

---

## 9. 테스트 시나리오

브라우저에서만 따라가면 끝. 백엔드 5개 엔드포인트는 이미 스모크로 통과 확인됨.

### A. Repository 연결 + 카드 표시
1. http://127.0.0.1:5173/projects/new — 프로젝트 등록. GitHub 링크 `https://github.com/vercel/next.js`
2. 상세 페이지에서 GitHub Repository 카드 자동 표시 확인 (fullName/설명/stars/forks/language/최근 업데이트/topics/fetched_at).
3. 카드의 "↻ 새로고침" → fetched_at 갱신.

### B. 미연결 케이스
- GitHub 링크 비워두고 등록 → 상세 카드에 "GitHub Repository가 연결되지 않았습니다." 만 표시.

### C. 잘못된 URL / 존재하지 않는 repo
- `https://example.com/nope` → 상세 카드에 `[INVALID_GITHUB_URL]`.
- `https://github.com/somerandomzz9988/nope` → `[GITHUB_REPOSITORY_NOT_FOUND]`.
- 이 케이스에서도 본문 / 지원·관심 기능은 정상 동작해야 한다 (기존 기능 보호).

### D. 기존 기능 회귀
- /projects 카드 목록 / 필터 / 정렬
- 추천 영역 표시 (MOCK_USER 기준)
- 지원하기 / 관심 저장 / 중복 지원 시 `DUPLICATE_APPLICATION` 토스트
- /me 프로필 + 내 지원 목록

### E. 팀 랭킹
1. A에서 repo 2개 이상 cache (`vercel/next.js`, `chakra-ui/chakra-ui` 등).
2. 헤더 "랭킹" → /ranking.
3. 점수식 직접 검산: `(project_count*30) + (stars*2) + (forks*3) + recent_update_score`.
4. "↻ 전체 갱신·재계산" → 모든 repo GitHub 재조회 후 랭킹 갱신, 일부 실패는 알림만.

### F. 응답 wrapper
- DevTools Network → 신규 엔드포인트 응답 4개 키(`status`, `data`, `detail`, `timestamp`)만 보이는지.
- 실패 응답에서 `data: null`, `detail.code`/`detail.message` 존재.

---

## 10. 향후 교체 포인트

- 프론트 mock service → 실제 Django API: `projectService` / `applicationService` 함수 시그니처(`ApiResponse<T>` 반환) 그대로 둔 채 axios 호출로 교체 가능.
- 프로젝트 → Repository 연결을 백엔드 entity로 격상: 현재는 Project가 frontend에만 존재해 owner 기준 그룹핑. Project 모델을 BE로 옮기면 `Project.repository_id` 외래키로 변경하고 랭킹 그룹핑을 `team` 컬럼으로 바꿀 것.
- 인증: 현재 신규 엔드포인트는 인증 없이 동작. 실제 서비스 전환 시 `permission_classes` 추가 필요.
