// 백엔드 repos/rankings API 호출 service.
// HTTP status에 관계없이 body의 status 필드로 분기할 수 있도록
// validateStatus를 항상 true로 둔다.

import axios from "axios";
import Cookie from "js-cookie";
import type {
  BackendApiResponse,
  RepositoryDto,
  TeamRankingRow,
} from "../types/repository";

const instance = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL}/api/v1`,
  withCredentials: true,
  validateStatus: () => true,
});

const csrf = () => ({ "X-CSRFToken": Cookie.get("csrftoken") || "" });

export async function linkRepository(
  url: string
): Promise<BackendApiResponse<RepositoryDto>> {
  const res = await instance.post(
    "repositories/link",
    { url },
    { headers: csrf() }
  );
  return res.data as BackendApiResponse<RepositoryDto>;
}

export async function lookupRepository(
  url: string
): Promise<BackendApiResponse<RepositoryDto>> {
  const res = await instance.get("repositories/", { params: { url } });
  return res.data as BackendApiResponse<RepositoryDto>;
}

export async function refreshRepository(
  repositoryId: number
): Promise<BackendApiResponse<RepositoryDto>> {
  const res = await instance.post(
    `repositories/${repositoryId}/refresh`,
    null,
    { headers: csrf() }
  );
  return res.data as BackendApiResponse<RepositoryDto>;
}

export async function getTeamRankings(): Promise<
  BackendApiResponse<{ rankings: TeamRankingRow[] }>
> {
  const res = await instance.get("rankings/teams");
  return res.data as BackendApiResponse<{ rankings: TeamRankingRow[] }>;
}

export async function recalculateTeamRankings(): Promise<
  BackendApiResponse<{
    rankings: TeamRankingRow[];
    refresh: { succeeded: number; failed: unknown[] };
  }>
> {
  const res = await instance.post("rankings/teams/recalculate", null, {
    headers: csrf(),
  });
  return res.data as BackendApiResponse<{
    rankings: TeamRankingRow[];
    refresh: { succeeded: number; failed: unknown[] };
  }>;
}

// 프로젝트 상세에서 사용:
// 1) 캐시 lookup → hit이면 그대로 반환
// 2) cache miss(404+GITHUB_REPOSITORY_NOT_FOUND)면 link로 cold fetch 시도
// 3) 그 외 에러는 그대로 반환
export async function getOrLinkRepository(
  url: string
): Promise<BackendApiResponse<RepositoryDto>> {
  const cached = await lookupRepository(url);
  if (cached.status === "SUCCESS") return cached;
  if (
    cached.status === "FAIL" &&
    cached.detail.code === "GITHUB_REPOSITORY_NOT_FOUND"
  ) {
    return linkRepository(url);
  }
  return cached;
}
