export type ProjectStatus =
  | "RECRUITING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CLOSED";

export type ProjectType =
  | "OPEN_SOURCE"
  | "INDUSTRY_ACADEMIC"
  | "PERSONAL"
  | "TEAM";

export interface Project {
  id: string;
  title: string;
  summary: string;
  description: string;
  background: string;
  problem: string;
  features: string[];
  techStacks: string[];
  recruitRoles: string[];
  requiredSkills: string[];
  recruitCount: number;
  currentApplicantCount: number;
  projectType: ProjectType;
  status: ProjectStatus;
  githubUrl?: string;
  documentUrl?: string;
  expectedOutput: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

// 폼 입력용: 자동 필드(id/createdAt/updatedAt/currentApplicantCount) 제외
export type ProjectInput = Omit<
  Project,
  "id" | "createdAt" | "updatedAt" | "currentApplicantCount"
>;

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  RECRUITING: "모집중",
  IN_PROGRESS: "진행중",
  COMPLETED: "완료",
  CLOSED: "마감",
};

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  OPEN_SOURCE: "오픈소스",
  INDUSTRY_ACADEMIC: "산학협력",
  PERSONAL: "개인",
  TEAM: "팀",
};
