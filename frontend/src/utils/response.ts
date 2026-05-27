import {
  ApiError,
  ApiFail,
  ApiSuccess,
  ErrorCode,
} from "../types/response";

const now = () => new Date().toISOString();

export function success<T>(
  data: T,
  message = "요청이 성공적으로 처리되었습니다."
): ApiSuccess<T> {
  return {
    status: "SUCCESS",
    data,
    detail: { message, timestamp: now() },
  };
}

export function fail(code: ErrorCode | string, message: string): ApiFail {
  return {
    status: "FAIL",
    data: null,
    detail: { code, message, timestamp: now() },
  };
}

export function serverError(
  code: ErrorCode | string = "INTERNAL_SERVER_ERROR",
  message = "서버 내부 오류가 발생했습니다."
): ApiError {
  return {
    status: "ERROR",
    data: null,
    detail: { code, message, timestamp: now() },
  };
}
