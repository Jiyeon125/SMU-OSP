/**
 * Project Service (mock + localStorage)
 *
 * - 초기 데이터는 mockProjects에서 로드, 이후 변경분은 localStorage에 영속화
 * - 모든 함수는 Promise<ApiResponse<T>>를 반환 → 추후 실제 API 연동 시 시그니처 유지
 */

import { MOCK_PROJECTS } from "../data/mockProjects";
import { ApiResponse, ERROR_CODES } from "../types/response";
import { Project, ProjectInput } from "../types/project";
import { genId, nowIso } from "../utils/date";
import { fail, serverError, success } from "../utils/response";

const STORAGE_KEY = "poc.projects";

function readAll(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_PROJECTS));
      return [...MOCK_PROJECTS];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Project[];
  } catch {
    // fallthrough
  }
  return [...MOCK_PROJECTS];
}

function writeAll(list: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export interface ListFilter {
  techStack?: string;
  role?: string;
  status?: Project["status"];
  sort?: "latest" | "title";
}

export async function listProjects(
  filter: ListFilter = {}
): Promise<ApiResponse<Project[]>> {
  try {
    let list = readAll();

    if (filter.techStack) {
      const target = filter.techStack.toLowerCase();
      list = list.filter((p) =>
        p.techStacks.map((t) => t.toLowerCase()).includes(target)
      );
    }
    if (filter.role) {
      const target = filter.role;
      list = list.filter((p) => p.recruitRoles.includes(target));
    }
    if (filter.status) {
      list = list.filter((p) => p.status === filter.status);
    }

    if (filter.sort === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      list.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }

    return success(list);
  } catch (e) {
    return serverError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      `프로젝트 목록 조회 중 오류: ${(e as Error).message}`
    );
  }
}

export async function getProject(id: string): Promise<ApiResponse<Project>> {
  try {
    const list = readAll();
    const found = list.find((p) => p.id === id);
    if (!found) {
      return fail(
        ERROR_CODES.PROJECT_NOT_FOUND,
        `id=${id}에 해당하는 프로젝트를 찾을 수 없습니다.`
      );
    }
    return success(found);
  } catch (e) {
    return serverError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      `프로젝트 조회 중 오류: ${(e as Error).message}`
    );
  }
}

function validateInput(input: ProjectInput): string | null {
  if (!input.title?.trim()) return "프로젝트명을 입력해주세요.";
  if (!input.summary?.trim()) return "한 줄 설명을 입력해주세요.";
  if (!input.description?.trim()) return "상세 설명을 입력해주세요.";
  if (!input.techStacks?.length) return "기술 스택을 1개 이상 입력해주세요.";
  if (!input.recruitRoles?.length) return "모집 역할을 1개 이상 입력해주세요.";
  return null;
}

export async function createProject(
  input: ProjectInput
): Promise<ApiResponse<Project>> {
  try {
    const msg = validateInput(input);
    if (msg) return fail(ERROR_CODES.INVALID_PROJECT_INPUT, msg);
    if (!Number.isFinite(input.recruitCount) || input.recruitCount <= 0) {
      return fail(
        ERROR_CODES.INVALID_RECRUIT_COUNT,
        "모집 인원은 1명 이상이어야 합니다."
      );
    }

    const list = readAll();
    const now = nowIso();
    const project: Project = {
      ...input,
      id: genId("p"),
      currentApplicantCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    list.unshift(project);
    writeAll(list);

    return success(project, "프로젝트가 등록되었습니다.");
  } catch (e) {
    return serverError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      `프로젝트 등록 중 오류: ${(e as Error).message}`
    );
  }
}

// 내부 사용: 지원/관심 시 카운트 증가 등에 사용
export function patchProjectSync(
  id: string,
  patch: Partial<Project>
): Project | null {
  const list = readAll();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const next: Project = {
    ...list[idx],
    ...patch,
    updatedAt: nowIso(),
  };
  list[idx] = next;
  writeAll(list);
  return next;
}

// 테스트/디버깅용 초기화 헬퍼
export function resetProjectsForDev() {
  localStorage.removeItem(STORAGE_KEY);
}
