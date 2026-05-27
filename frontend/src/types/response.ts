// 공통 API 응답 구조 (status/data/detail)
// HTTP status와 분리: body.status는 SUCCESS | FAIL | ERROR

export interface ApiSuccess<T> {
  status: "SUCCESS";
  data: T;
  detail: { message: string; timestamp: string };
}

export interface ApiFail {
  status: "FAIL";
  data: null;
  detail: { code: string; message: string; timestamp: string };
}

export interface ApiError {
  status: "ERROR";
  data: null;
  detail: { code: string; message: string; timestamp: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFail | ApiError;

// 도메인 에러 코드
export const ERROR_CODES = {
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  INVALID_PROJECT_INPUT: "INVALID_PROJECT_INPUT",
  INVALID_RECRUIT_COUNT: "INVALID_RECRUIT_COUNT",
  PROJECT_NOT_RECRUITING: "PROJECT_NOT_RECRUITING",
  DUPLICATE_APPLICATION: "DUPLICATE_APPLICATION",
  NO_RECOMMENDED_PROJECT: "NO_RECOMMENDED_PROJECT",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
