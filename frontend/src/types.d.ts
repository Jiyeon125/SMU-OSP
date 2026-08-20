import type { ApiSuccess, PaginationDetail } from "./types/response";

export interface IUser {
  username: string;
  github_email: string;
  name: string;
  student_id: number;
  major: string;
}

export interface IPublicUser {
  username: string;
  date_joined: string;
  score: number;
  commits: number;
  stars: number;
  prs: number;
  issues: number;
}

export type PublicUserListResponse = ApiSuccess<IPublicUser[], PaginationDetail>;

/** 메인 화면에 노출하는 트렌딩 GitHub Repository입니다. */
export interface TrendingRepository {
  githubId: number;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  language: string;
  stars: number;
  forks: number;
}

/** 트렌딩 GitHub Repository 목록 응답입니다. */
export type TrendingRepositoryListResponse = ApiSuccess<TrendingRepository[], null>;

export interface IPost {
  id: number;
  title: string;
  content: string;
  image: string;
  on_carousel: boolean;
  created_at: string;
  updated_at: string;
}

interface IDialog {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

interface ILogin {
  username: string;
  password: string;
}
