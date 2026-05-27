/**
 * Rule-based 추천 서비스
 *
 * 점수 규칙:
 *  - 사용자 관심 분야가 프로젝트 설명/유형/태그와 일치: +20 / 항목
 *  - 보유 기술 ∩ 프로젝트 techStacks: +25 / 항목
 *  - 희망 역할 ∩ 모집 역할: +25 / 항목
 *  - status가 RECRUITING: +20
 *  - 현재 지원자 수 < 모집 인원: +15
 *  - 최근 수정일이 7일 이내: +10, 30일 이내: +5
 */

import { Project } from "../types/project";
import { ApiResponse, ERROR_CODES } from "../types/response";
import { UserProfile } from "../types/user";
import { nowIso } from "../utils/date";
import { fail, serverError, success } from "../utils/response";
import { listProjects } from "./projectService";

export interface Recommendation {
  projectId: string;
  title: string;
  score: number;
  matchedTechStacks: string[];
  matchedRoles: string[];
  matchedInterests: string[];
  reason: string;
  recommendedAt: string;
}

const lower = (s: string) => s.toLowerCase();

function matchInterests(user: UserProfile, project: Project): string[] {
  const haystacks = [
    project.title,
    project.summary,
    project.description,
    project.background,
    project.projectType,
    ...project.techStacks,
    ...project.recruitRoles,
  ]
    .filter(Boolean)
    .map(lower)
    .join(" ");
  return user.interests.filter((i) => haystacks.includes(lower(i)));
}

function intersect(a: string[], b: string[]): string[] {
  const setB = new Set(b.map(lower));
  return a.filter((x) => setB.has(lower(x)));
}

function scoreOne(user: UserProfile, project: Project): Recommendation | null {
  const matchedTechStacks = intersect(user.techStacks, project.techStacks);
  const matchedRoles = intersect(user.preferredRoles, project.recruitRoles);
  const matchedInterests = matchInterests(user, project);

  let score = 0;
  const parts: string[] = [];

  if (matchedInterests.length) {
    score += 20 * matchedInterests.length;
    parts.push(`사용자의 관심 분야인 ${matchedInterests.join("·")}와(과) 맞닿아 있고`);
  }
  if (matchedTechStacks.length) {
    score += 25 * matchedTechStacks.length;
    parts.push(
      `보유 기술인 ${matchedTechStacks.join("·")}이(가) 프로젝트 기술 스택과 겹치며`
    );
  }
  if (matchedRoles.length) {
    score += 25 * matchedRoles.length;
    parts.push(
      `희망 역할인 ${matchedRoles.join("·")}을(를) 모집하고 있어`
    );
  }
  if (project.status === "RECRUITING") {
    score += 20;
    parts.push("현재 모집중이고");
  }
  if (project.currentApplicantCount < project.recruitCount) {
    score += 15;
    parts.push(
      `정원(${project.recruitCount}명) 대비 지원자(${project.currentApplicantCount}명)에 여유가 있어`
    );
  }

  const updated = new Date(project.updatedAt).getTime();
  const daysAgo = (Date.now() - updated) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 7) {
    score += 10;
    parts.push("최근 1주일 안에 업데이트되었기 때문에");
  } else if (daysAgo <= 30) {
    score += 5;
    parts.push("최근 한 달 안에 업데이트되어");
  }

  if (score <= 0) return null;

  const reason =
    parts.length > 0
      ? `이 프로젝트는 ${parts.join(", ")} 추천되었습니다.`
      : "추천 기준에 부합하여 추천되었습니다.";

  return {
    projectId: project.id,
    title: project.title,
    score,
    matchedTechStacks,
    matchedRoles,
    matchedInterests,
    reason,
    recommendedAt: nowIso(),
  };
}

export async function recommendForUser(
  user: UserProfile,
  topK: number = 5
): Promise<ApiResponse<Recommendation[]>> {
  try {
    const listResp = await listProjects();
    if (listResp.status !== "SUCCESS") return listResp;

    const recs: Recommendation[] = [];
    for (const project of listResp.data) {
      const r = scoreOne(user, project);
      if (r) recs.push(r);
    }
    if (recs.length === 0) {
      return fail(
        ERROR_CODES.NO_RECOMMENDED_PROJECT,
        "현재 추천 가능한 프로젝트가 없습니다. 관심 분야나 기술 스택을 추가해 보세요."
      );
    }
    recs.sort((a, b) => b.score - a.score);
    return success(recs.slice(0, topK), "추천 결과가 생성되었습니다.");
  } catch (e) {
    return serverError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      `추천 처리 중 오류: ${(e as Error).message}`
    );
  }
}
