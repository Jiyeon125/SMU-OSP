// 백엔드 /api/v1/repositories, /api/v1/rankings 응답 타입

export interface RepositoryDto {
  id: number;
  githubId: number;
  owner: string;
  repo: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  topics: string[];
  htmlUrl: string;
  githubUpdatedAt: string | null;
  fetchedAt: string;
}

export interface TeamRankingRow {
  rank: number;
  team: string;
  score: number;
  projectCount: number;
  totalStars: number;
  totalForks: number;
  recentUpdateScore: number;
  repositories: Array<{
    id: number;
    name: string;
    fullName: string;
    stars: number;
    forks: number;
    language: string | null;
    htmlUrl: string;
    githubUpdatedAt: string | null;
  }>;
  calculatedAt: string;
}

// 이번 PoC 백엔드의 공통 응답 wrapper
// (프론트 mock service 의 wrapper와는 별도. 백엔드 응답 전용 타입.)
export interface BackendApiOk<T> {
  status: "SUCCESS";
  data: T;
  detail: null;
  timestamp: string;
}

export interface BackendApiFail {
  status: "FAIL";
  data: null;
  detail: { code: string; message: string };
  timestamp: string;
}

export type BackendApiResponse<T> = BackendApiOk<T> | BackendApiFail;
