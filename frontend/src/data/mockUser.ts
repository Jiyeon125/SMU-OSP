import { UserProfile } from "../types/user";

export const MOCK_USER: UserProfile = {
  id: "u_dummy_001",
  name: "김숙명",
  major: "소프트웨어학부",
  grade: 3,
  interests: ["오픈소스", "교내 서비스", "데이터 시각화"],
  techStacks: ["React", "TypeScript", "Python"],
  preferredRoles: ["프론트엔드 개발자", "백엔드 개발자"],
  githubUrl: "https://github.com/example-smu-user",
  availableTime: "주 10시간 (평일 저녁/주말)",
  introduction:
    "교내 서비스와 오픈소스에 관심이 많은 3학년입니다. 작은 단위라도 끝까지 완성하는 프로젝트를 선호합니다.",
};
