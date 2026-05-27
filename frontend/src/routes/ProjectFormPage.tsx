import { Box, HStack, Input, Text, Textarea, VStack } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { createProject } from "../services/projectService";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_TYPE_LABEL,
  ProjectInput,
  ProjectStatus,
  ProjectType,
} from "../types/project";

interface FormState {
  title: string;
  summary: string;
  description: string;
  background: string;
  problem: string;
  featuresText: string;
  techStacksText: string;
  recruitRolesText: string;
  requiredSkillsText: string;
  recruitCount: string;
  projectType: ProjectType;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  githubUrl: string;
  documentUrl: string;
  expectedOutput: string;
}

const initialState: FormState = {
  title: "",
  summary: "",
  description: "",
  background: "",
  problem: "",
  featuresText: "",
  techStacksText: "",
  recruitRolesText: "",
  requiredSkillsText: "",
  recruitCount: "3",
  projectType: "OPEN_SOURCE",
  status: "RECRUITING",
  startDate: "",
  endDate: "",
  githubUrl: "",
  documentUrl: "",
  expectedOutput: "",
};

const split = (s: string) =>
  s
    .split(/[,\n]+/)
    .map((v) => v.trim())
    .filter(Boolean);

export default function ProjectFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<FormState>(initialState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const update =
    <K extends keyof FormState>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setState((s) => ({ ...s, [key]: e.target.value as FormState[K] }));

  const createMutation = useMutation({
    mutationFn: (input: ProjectInput) => createProject(input),
    onSuccess: (resp) => {
      if (resp.status === "SUCCESS") {
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        queryClient.invalidateQueries({ queryKey: ["recommendations"] });
        navigate(`/projects/${resp.data.id}`);
      } else {
        setErrorMessage(`[${resp.detail.code}] ${resp.detail.message}`);
      }
    },
  });

  const handleSubmit = () => {
    setErrorMessage(null);

    const input: ProjectInput = {
      title: state.title.trim(),
      summary: state.summary.trim(),
      description: state.description.trim(),
      background: state.background.trim(),
      problem: state.problem.trim(),
      features: split(state.featuresText),
      techStacks: split(state.techStacksText),
      recruitRoles: split(state.recruitRolesText),
      requiredSkills: split(state.requiredSkillsText),
      recruitCount: Number(state.recruitCount),
      projectType: state.projectType,
      status: state.status,
      startDate: state.startDate,
      endDate: state.endDate,
      githubUrl: state.githubUrl.trim() || undefined,
      documentUrl: state.documentUrl.trim() || undefined,
      expectedOutput: state.expectedOutput.trim(),
    };

    createMutation.mutate(input);
  };

  return (
    <Box px={{ base: 4, md: 10 }} py={6} maxW={"900px"} mx={"auto"}>
      <VStack alignItems={"stretch"} gap={4}>
        <HStack justifyContent={"space-between"}>
          <Text fontSize={"2xl"} fontWeight={"bold"} color={"smu.blue"}>
            새 프로젝트 등록
          </Text>
          <Button variant={"outline"} onClick={() => navigate("/projects")}>
            ← 목록으로
          </Button>
        </HStack>

        {errorMessage && (
          <Box
            p={3}
            borderWidth={1}
            borderColor={"smu.orange"}
            bg={"#fff8ec"}
            borderRadius={"md"}
          >
            <Text fontSize={"sm"}>{errorMessage}</Text>
          </Box>
        )}

        <Box
          p={6}
          borderWidth={1}
          borderColor={"smu.gray"}
          borderRadius={"lg"}
          bg={"white"}
        >
          <VStack alignItems={"stretch"} gap={4}>
            <Field label="프로젝트명" required>
              <Input
                placeholder="예: 오픈소스 학사 행정 도구"
                value={state.title}
                onChange={update("title")}
              />
            </Field>

            <Field label="한 줄 설명" required>
              <Input
                placeholder="프로젝트를 한 문장으로 설명해주세요."
                value={state.summary}
                onChange={update("summary")}
              />
            </Field>

            <Field label="상세 설명" required>
              <Textarea
                placeholder="프로젝트의 목적, 다루는 범위, 진행 방식을 자세히 적어주세요."
                rows={4}
                value={state.description}
                onChange={update("description")}
              />
            </Field>

            <HStack gap={3} alignItems={"flex-start"}>
              <Field label="프로젝트 배경" containerStyle={{ flex: 1 }}>
                <Textarea
                  rows={3}
                  value={state.background}
                  onChange={update("background")}
                />
              </Field>
              <Field label="해결하려는 문제" containerStyle={{ flex: 1 }}>
                <Textarea
                  rows={3}
                  value={state.problem}
                  onChange={update("problem")}
                />
              </Field>
            </HStack>

            <Field label="주요 기능 (쉼표 또는 줄바꿈 구분)">
              <Textarea
                rows={2}
                placeholder="예: 수강신청 자동화, 졸업요건 점검, 시간표 시뮬레이션"
                value={state.featuresText}
                onChange={update("featuresText")}
              />
            </Field>

            <HStack gap={3} alignItems={"flex-start"}>
              <Field
                label="기술 스택 (쉼표 구분)"
                required
                containerStyle={{ flex: 1 }}
              >
                <Input
                  placeholder="예: React, TypeScript, Django"
                  value={state.techStacksText}
                  onChange={update("techStacksText")}
                />
              </Field>
              <Field
                label="모집 역할 (쉼표 구분)"
                required
                containerStyle={{ flex: 1 }}
              >
                <Input
                  placeholder="예: 프론트엔드 개발자, 백엔드 개발자"
                  value={state.recruitRolesText}
                  onChange={update("recruitRolesText")}
                />
              </Field>
            </HStack>

            <Field label="필요 역량 (쉼표 구분)">
              <Input
                placeholder="예: React 기본기, Git 사용 경험"
                value={state.requiredSkillsText}
                onChange={update("requiredSkillsText")}
              />
            </Field>

            <HStack gap={3} alignItems={"flex-start"}>
              <Field label="모집 인원" required containerStyle={{ width: "160px" }}>
                <Input
                  type="number"
                  min={1}
                  value={state.recruitCount}
                  onChange={update("recruitCount")}
                />
              </Field>
              <Field label="프로젝트 유형" containerStyle={{ flex: 1 }}>
                <select
                  value={state.projectType}
                  onChange={update("projectType")}
                  style={selectStyle}
                >
                  {(
                    [
                      "OPEN_SOURCE",
                      "INDUSTRY_ACADEMIC",
                      "PERSONAL",
                      "TEAM",
                    ] as ProjectType[]
                  ).map((t) => (
                    <option key={t} value={t}>
                      {PROJECT_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="모집 상태" containerStyle={{ flex: 1 }}>
                <select
                  value={state.status}
                  onChange={update("status")}
                  style={selectStyle}
                >
                  {(
                    [
                      "RECRUITING",
                      "IN_PROGRESS",
                      "COMPLETED",
                      "CLOSED",
                    ] as ProjectStatus[]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {PROJECT_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Field>
            </HStack>

            <HStack gap={3} alignItems={"flex-start"}>
              <Field label="시작일" containerStyle={{ flex: 1 }}>
                <Input
                  type="date"
                  value={state.startDate}
                  onChange={update("startDate")}
                />
              </Field>
              <Field label="종료일" containerStyle={{ flex: 1 }}>
                <Input
                  type="date"
                  value={state.endDate}
                  onChange={update("endDate")}
                />
              </Field>
            </HStack>

            <Field label="GitHub Repository 링크">
              <Input
                placeholder="https://github.com/..."
                value={state.githubUrl}
                onChange={update("githubUrl")}
              />
            </Field>

            <Field label="문서 링크">
              <Input
                placeholder="https://..."
                value={state.documentUrl}
                onChange={update("documentUrl")}
              />
            </Field>

            <Field label="예상 산출물">
              <Textarea
                rows={2}
                placeholder="예: 시연 영상, 보고서, 오픈소스 공개"
                value={state.expectedOutput}
                onChange={update("expectedOutput")}
              />
            </Field>

            <HStack justifyContent={"flex-end"} pt={2}>
              <Button
                variant={"outline"}
                onClick={() => navigate("/projects")}
                disabled={createMutation.isPending}
              >
                취소
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "등록 중..." : "등록하기"}
              </Button>
            </HStack>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
}

function Field({
  label,
  required,
  children,
  containerStyle,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  containerStyle?: React.CSSProperties;
}) {
  return (
    <Box style={containerStyle}>
      <Text fontSize={"sm"} fontWeight={"semibold"} mb={1}>
        {label}{" "}
        {required && <span style={{ color: "#ff7c01" }}>*</span>}
      </Text>
      {children}
    </Box>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: "0.875rem",
  borderRadius: "6px",
  border: "1px solid #d9d9d6",
  background: "white",
  width: "100%",
};
