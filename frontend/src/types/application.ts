export type ApplicationStatus = "APPLIED" | "INTERESTED" | "CANCELED";

export interface Application {
  id: string;
  projectId: string;
  userId: string;
  role?: string;
  skills?: string[];
  message?: string;
  status: ApplicationStatus;
  appliedAt: string; // ISO
}

export interface ApplyInput {
  role: string;
  skills: string[];
  message: string;
}

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  APPLIED: "지원 완료",
  INTERESTED: "관심 저장",
  CANCELED: "취소됨",
};
