import { Box, HStack, SimpleGrid, Spinner, Text, VStack } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import ApplyDialog from "../components/ApplyDialog";
import RepositoryInfoCard from "../components/RepositoryInfoCard";
import { Button } from "../components/ui/button";
import { MOCK_USER } from "../data/mockUser";
import {
  applyToProject,
  getMyApplicationForProject,
  markInterested,
} from "../services/applicationService";
import { getProject } from "../services/projectService";
import { ApplyInput } from "../types/application";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_TYPE_LABEL,
  ProjectStatus,
} from "../types/project";
import { formatDateKST, formatDateTimeKST } from "../utils/date";

const STATUS_COLOR: Record<ProjectStatus, { bg: string; color: string }> = {
  RECRUITING: { bg: "smu.lightBlue", color: "white" },
  IN_PROGRESS: { bg: "smu.yellow", color: "smu.darkGray" },
  COMPLETED: { bg: "smu.smuGray", color: "white" },
  CLOSED: { bg: "smu.gray", color: "smu.darkGray" },
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Text fontSize={"sm"} fontWeight={"bold"} color={"smu.blue"} mb={1}>
        {title}
      </Text>
      <Box fontSize={"sm"}>{children}</Box>
    </Box>
  );
}

function Pill({
  children,
  bg = "smu.gray",
  color = "smu.darkGray",
}: {
  children: React.ReactNode;
  bg?: string;
  color?: string;
}) {
  return (
    <Box
      px={2}
      py={0.5}
      fontSize={"xs"}
      borderRadius={"full"}
      bg={bg}
      color={color}
    >
      {children}
    </Box>
  );
}

export default function ProjectDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  const [toast, setToast] = useState<{
    type: "ok" | "fail";
    message: string;
  } | null>(null);

  const projectQuery = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
    enabled: !!id,
  });

  const myAppQuery = useQuery({
    queryKey: ["my-application", id, MOCK_USER.id],
    queryFn: () => getMyApplicationForProject(id, MOCK_USER.id),
    enabled: !!id,
  });

  const applyMutation = useMutation({
    mutationFn: (input: ApplyInput) =>
      applyToProject(id, MOCK_USER.id, input),
    onSuccess: (resp) => {
      if (resp.status === "SUCCESS") {
        setToast({ type: "ok", message: "지원이 완료되었습니다." });
        setApplyOpen(false);
        queryClient.invalidateQueries({ queryKey: ["project", id] });
        queryClient.invalidateQueries({ queryKey: ["my-application", id] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        queryClient.invalidateQueries({ queryKey: ["my-applications"] });
        queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      } else {
        setToast({
          type: "fail",
          message: `[${resp.detail.code}] ${resp.detail.message}`,
        });
      }
    },
  });

  const interestMutation = useMutation({
    mutationFn: () => markInterested(id, MOCK_USER.id),
    onSuccess: (resp) => {
      if (resp.status === "SUCCESS") {
        setToast({ type: "ok", message: "관심 프로젝트로 저장했습니다." });
        queryClient.invalidateQueries({ queryKey: ["my-application", id] });
        queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      } else {
        setToast({
          type: "fail",
          message: `[${resp.detail.code}] ${resp.detail.message}`,
        });
      }
    },
  });

  if (projectQuery.isLoading) {
    return (
      <Box display={"flex"} justifyContent={"center"} p={10}>
        <Spinner />
      </Box>
    );
  }

  const resp = projectQuery.data;
  if (!resp || resp.status !== "SUCCESS") {
    return (
      <Box px={{ base: 4, md: 10 }} py={6} maxW={"800px"} mx={"auto"}>
        <Box
          p={6}
          borderWidth={1}
          borderColor={"smu.orange"}
          bg={"#fff8ec"}
          borderRadius={"lg"}
        >
          <Text fontWeight={"bold"} color={"smu.orange"}>
            [{resp?.detail.code || "UNKNOWN"}]
          </Text>
          <Text>{resp?.detail.message || "프로젝트를 불러올 수 없습니다."}</Text>
          <Box mt={4}>
            <RouterLink to={"/projects"}>
              <Button variant={"outline"}>← 목록으로</Button>
            </RouterLink>
          </Box>
        </Box>
      </Box>
    );
  }

  const project = resp.data;
  const statusStyle = STATUS_COLOR[project.status];
  const myApp = myAppQuery.data?.status === "SUCCESS" ? myAppQuery.data.data : null;
  const isFull = project.currentApplicantCount >= project.recruitCount;
  const canApply =
    project.status === "RECRUITING" && (!myApp || myApp.status !== "APPLIED");

  return (
    <Box px={{ base: 4, md: 10 }} py={6} maxW={"1000px"} mx={"auto"}>
      <VStack alignItems={"stretch"} gap={5}>
        <HStack justifyContent={"space-between"}>
          <Button variant={"outline"} onClick={() => navigate("/projects")}>
            ← 목록으로
          </Button>
          <HStack gap={2}>
            <Button
              variant={"outline"}
              onClick={() => interestMutation.mutate()}
              disabled={interestMutation.isPending}
            >
              {myApp?.status === "INTERESTED"
                ? "✓ 관심 저장됨"
                : "♡ 관심 저장"}
            </Button>
            <Button
              onClick={() => setApplyOpen(true)}
              disabled={!canApply || applyMutation.isPending}
            >
              {myApp?.status === "APPLIED"
                ? "✓ 지원 완료"
                : project.status !== "RECRUITING"
                  ? "지원 불가"
                  : "지원하기"}
            </Button>
          </HStack>
        </HStack>

        {toast && (
          <Box
            p={3}
            borderWidth={1}
            borderRadius={"md"}
            borderColor={toast.type === "ok" ? "smu.lightBlue" : "smu.orange"}
            bg={toast.type === "ok" ? "#eaf3fb" : "#fff8ec"}
          >
            <Text fontSize={"sm"}>{toast.message}</Text>
          </Box>
        )}

        <Box
          p={6}
          borderWidth={1}
          borderColor={"smu.gray"}
          borderRadius={"lg"}
          bg={"white"}
        >
          <HStack
            justifyContent={"space-between"}
            alignItems={"flex-start"}
            mb={3}
          >
            <VStack alignItems={"flex-start"} gap={1}>
              <Text fontSize={"2xl"} fontWeight={"bold"} color={"smu.blue"}>
                {project.title}
              </Text>
              <Text color={"smu.darkGray"}>{project.summary}</Text>
            </VStack>
            <VStack alignItems={"flex-end"} gap={1}>
              <Pill bg={statusStyle.bg} color={statusStyle.color}>
                {PROJECT_STATUS_LABEL[project.status]}
              </Pill>
              <Pill>{PROJECT_TYPE_LABEL[project.projectType]}</Pill>
            </VStack>
          </HStack>

          <SimpleGrid columns={{ base: 2, md: 4 }} gap={3} mb={5}>
            <Stat
              label="모집 인원"
              value={`${project.currentApplicantCount} / ${project.recruitCount}`}
              warn={isFull}
            />
            <Stat
              label="진행 기간"
              value={`${formatDateKST(project.startDate)} ~ ${formatDateKST(project.endDate)}`}
            />
            <Stat
              label="생성일"
              value={formatDateTimeKST(project.createdAt)}
            />
            <Stat
              label="수정일"
              value={formatDateTimeKST(project.updatedAt)}
            />
          </SimpleGrid>

          <VStack alignItems={"stretch"} gap={4}>
            <Section title="프로젝트 배경">
              <Text whiteSpace={"pre-wrap"}>{project.background || "-"}</Text>
            </Section>
            <Section title="해결하려는 문제">
              <Text whiteSpace={"pre-wrap"}>{project.problem || "-"}</Text>
            </Section>
            <Section title="상세 설명">
              <Text whiteSpace={"pre-wrap"}>{project.description || "-"}</Text>
            </Section>
            <Section title="주요 기능">
              {project.features.length === 0 ? (
                "-"
              ) : (
                <VStack alignItems={"flex-start"} gap={0.5}>
                  {project.features.map((f, i) => (
                    <Text key={i}>· {f}</Text>
                  ))}
                </VStack>
              )}
            </Section>
            <Section title="기술 스택">
              <HStack flexWrap={"wrap"} gap={1}>
                {project.techStacks.map((t) => (
                  <Pill key={t}>{t}</Pill>
                ))}
              </HStack>
            </Section>
            <Section title="모집 역할">
              <HStack flexWrap={"wrap"} gap={1}>
                {project.recruitRoles.map((r) => (
                  <Pill key={r} bg={"smu.blue"} color={"white"}>
                    {r}
                  </Pill>
                ))}
              </HStack>
            </Section>
            <Section title="필요 역량">
              {project.requiredSkills.length === 0 ? (
                "-"
              ) : (
                <HStack flexWrap={"wrap"} gap={1}>
                  {project.requiredSkills.map((s) => (
                    <Pill key={s} bg={"smu.lightBlue"} color={"white"}>
                      {s}
                    </Pill>
                  ))}
                </HStack>
              )}
            </Section>
            <Section title="예상 산출물">
              <Text whiteSpace={"pre-wrap"}>{project.expectedOutput || "-"}</Text>
            </Section>
            {project.documentUrl && (
              <HStack gap={4} fontSize={"sm"}>
                <a
                  href={project.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#002f87",
                    textDecoration: "underline",
                  }}
                >
                  관련 문서 ↗
                </a>
              </HStack>
            )}
          </VStack>
        </Box>

        <RepositoryInfoCard githubUrl={project.githubUrl} />

        {myApp && (
          <Box
            p={4}
            borderWidth={1}
            borderColor={"smu.lightBlue"}
            bg={"#eaf3fb"}
            borderRadius={"md"}
          >
            <Text fontWeight={"bold"} color={"smu.blue"} mb={1}>
              내 지원 상태
            </Text>
            <Text fontSize={"sm"}>
              {myApp.status === "APPLIED" ? "지원 완료" : "관심 저장"} ·{" "}
              {formatDateTimeKST(myApp.appliedAt)}
            </Text>
            {myApp.role && (
              <Text fontSize={"sm"}>희망 역할: {myApp.role}</Text>
            )}
            {myApp.message && (
              <Text fontSize={"sm"} whiteSpace={"pre-wrap"}>
                메시지: {myApp.message}
              </Text>
            )}
          </Box>
        )}
      </VStack>

      <ApplyDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        recruitRoles={project.recruitRoles}
        defaultSkills={MOCK_USER.techStacks}
        loading={applyMutation.isPending}
        onSubmit={(input) => applyMutation.mutate(input)}
      />
    </Box>
  );
}

function Stat({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <Box
      p={3}
      borderWidth={1}
      borderColor={warn ? "smu.orange" : "smu.gray"}
      borderRadius={"md"}
      bg={"white"}
    >
      <Text fontSize={"xs"} color={"smu.darkGray"}>
        {label}
      </Text>
      <Text fontWeight={"bold"} color={warn ? "smu.orange" : "smu.blue"}>
        {value}
      </Text>
    </Box>
  );
}
