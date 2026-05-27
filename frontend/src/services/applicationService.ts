/**
 * Application Service (mock + localStorage)
 *
 * - 지원(APPLY): 모집중 프로젝트만 가능, 중복 지원 금지, currentApplicantCount 증가
 * - 관심 저장(INTEREST): 어떤 상태든 가능, 중복은 동일 항목으로 idempotent
 * - 사용자별 조회 지원
 */

import { Application, ApplicationStatus, ApplyInput } from "../types/application";
import { ApiResponse, ERROR_CODES } from "../types/response";
import { genId, nowIso } from "../utils/date";
import { fail, serverError, success } from "../utils/response";
import { getProject, patchProjectSync } from "./projectService";

const STORAGE_KEY = "poc.applications";

function readAll(): Application[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Application[];
  } catch {
    // fallthrough
  }
  return [];
}

function writeAll(list: Application[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function isActive(a: Application, projectId: string, userId: string) {
  return (
    a.projectId === projectId &&
    a.userId === userId &&
    a.status !== "CANCELED"
  );
}

export async function applyToProject(
  projectId: string,
  userId: string,
  input: ApplyInput
): Promise<ApiResponse<Application>> {
  try {
    const projectResp = await getProject(projectId);
    if (projectResp.status !== "SUCCESS") return projectResp;
    const project = projectResp.data;

    if (project.status !== "RECRUITING") {
      return fail(
        ERROR_CODES.PROJECT_NOT_RECRUITING,
        "현재 모집중이 아닌 프로젝트에는 지원할 수 없습니다."
      );
    }

    const list = readAll();
    const existing = list.find(
      (a) => isActive(a, projectId, userId) && a.status === "APPLIED"
    );
    if (existing) {
      return fail(
        ERROR_CODES.DUPLICATE_APPLICATION,
        "이미 지원한 프로젝트입니다."
      );
    }

    if (!input.role?.trim()) {
      return fail(
        ERROR_CODES.INVALID_PROJECT_INPUT,
        "희망 역할을 선택해주세요."
      );
    }

    const application: Application = {
      id: genId("app"),
      projectId,
      userId,
      role: input.role,
      skills: input.skills,
      message: input.message,
      status: "APPLIED",
      appliedAt: nowIso(),
    };
    list.unshift(application);
    writeAll(list);

    patchProjectSync(projectId, {
      currentApplicantCount: project.currentApplicantCount + 1,
    });

    return success(application, "지원이 완료되었습니다.");
  } catch (e) {
    return serverError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      `지원 처리 중 오류: ${(e as Error).message}`
    );
  }
}

export async function markInterested(
  projectId: string,
  userId: string
): Promise<ApiResponse<Application>> {
  try {
    const projectResp = await getProject(projectId);
    if (projectResp.status !== "SUCCESS") return projectResp;

    const list = readAll();
    const existing = list.find(
      (a) =>
        isActive(a, projectId, userId) && a.status === "INTERESTED"
    );
    if (existing) {
      return success(existing, "이미 관심 프로젝트로 저장되어 있습니다.");
    }

    const application: Application = {
      id: genId("int"),
      projectId,
      userId,
      status: "INTERESTED",
      appliedAt: nowIso(),
    };
    list.unshift(application);
    writeAll(list);

    return success(application, "관심 프로젝트로 저장했습니다.");
  } catch (e) {
    return serverError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      `관심 저장 중 오류: ${(e as Error).message}`
    );
  }
}

export async function listMyApplications(
  userId: string
): Promise<ApiResponse<Application[]>> {
  try {
    const list = readAll().filter((a) => a.userId === userId);
    list.sort(
      (a, b) =>
        new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
    );
    return success(list);
  } catch (e) {
    return serverError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      `지원 목록 조회 중 오류: ${(e as Error).message}`
    );
  }
}

export async function getMyApplicationForProject(
  projectId: string,
  userId: string
): Promise<ApiResponse<Application | null>> {
  try {
    const list = readAll();
    const found =
      list.find(
        (a) =>
          a.projectId === projectId &&
          a.userId === userId &&
          a.status === "APPLIED"
      ) ||
      list.find(
        (a) =>
          a.projectId === projectId &&
          a.userId === userId &&
          a.status === "INTERESTED"
      ) ||
      null;
    return success(found);
  } catch (e) {
    return serverError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      `지원 조회 중 오류: ${(e as Error).message}`
    );
  }
}

export const APPLICATION_STATUS_VALUES: readonly ApplicationStatus[] = [
  "APPLIED",
  "INTERESTED",
  "CANCELED",
];
