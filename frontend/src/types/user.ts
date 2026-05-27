export interface UserProfile {
  id: string;
  name: string;
  major: string;
  grade: number;
  interests: string[];
  techStacks: string[];
  preferredRoles: string[];
  githubUrl?: string;
  availableTime: string;
  introduction: string;
}
