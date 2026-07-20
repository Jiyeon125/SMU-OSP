import {
  Box,
  Flex,
  NativeSelect,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { listProjectApplications } from "../services/projectService";
import {
  PROJECT_STATUS_LABEL,
  ProjectApplicationStatus,
} from "../types/project";
import { ERROR_CODES } from "../types/response";
import { formatDateKST } from "../utils/date";
import ProjectRequestStatePanel from "./ProjectRequestStatePanel";
import { Button } from "./ui/button";

type StatusFilter = "ALL" | "WAITING" | "JOINED" | "DECLINED" | "CLOSED";
type SortOrder = "LATEST" | "OLDEST";

const STATUS_META: Record<
  ProjectApplicationStatus,
  { label: string; bg: string; color: string }
> = {
  APPLIED: { label: "승인 대기", bg: "#fff3cd", color: "#8a5a00" },
  PENDING: { label: "승인 대기", bg: "#fff3cd", color: "#8a5a00" },
  JOINED: { label: "수락 · 참여 중", bg: "#dff5e5", color: "#176b35" },
  DECLINED: { label: "반려", bg: "#fde2e2", color: "#a32222" },
  LEFT: { label: "참여 종료", bg: "#eceff1", color: "#455a64" },
  CANCELLED: { label: "신청 취소", bg: "#eceff1", color: "#455a64" },
};

function matchesStatus(status: ProjectApplicationStatus, filter: StatusFilter) {
  if (filter === "ALL") return true;
  if (filter === "WAITING") return status === "APPLIED" || status === "PENDING";
  if (filter === "CLOSED") return status === "LEFT" || status === "CANCELLED";
  return status === filter;
}

export default function ProjectApplicationHistory() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("LATEST");
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["project-application-history"],
    queryFn: listProjectApplications,
    retry: false,
  });

  const applications = useMemo(() => {
    if (data?.status !== "SUCCESS") return [];
    return [...data.data]
      .filter((application) => matchesStatus(application.status, statusFilter))
      .sort((a, b) => {
        const timeDifference =
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return sortOrder === "LATEST" ? timeDifference : -timeDifference;
      });
  }, [data, sortOrder, statusFilter]);

  const isPermissionDenied = data?.status === ERROR_CODES.PERMISSION_DENIED;

  return (
    <VStack alignItems="stretch" gap={4}>
      <Flex
        p={3}
        alignItems={{ base: "stretch", md: "center" }}
        justifyContent="space-between"
        direction={{ base: "column", md: "row" }}
        gap={3}
        borderWidth={1}
        borderColor="smu.gray"
        borderRadius="lg"
        bg="white"
      >
        <Flex gap={2} direction={{ base: "column", sm: "row" }}>
          <NativeSelect.Root size="sm" width={{ base: "100%", sm: "180px" }}>
            <NativeSelect.Field
              aria-label="신청 상태 필터"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
            >
              <option value="ALL">전체 상태</option>
              <option value="WAITING">승인 대기</option>
              <option value="JOINED">수락 · 참여 중</option>
              <option value="DECLINED">반려</option>
              <option value="CLOSED">취소 · 참여 종료</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <NativeSelect.Root size="sm" width={{ base: "100%", sm: "160px" }}>
            <NativeSelect.Field
              aria-label="신청 내역 정렬"
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value as SortOrder)
              }
            >
              <option value="LATEST">최신 신청순</option>
              <option value="OLDEST">오래된 신청순</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Flex>
        <Button
          size="sm"
          variant="outline"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching ? "조회 중" : "새로고침"}
        </Button>
      </Flex>

      {isLoading ? (
        <ProjectRequestStatePanel>
          <Spinner />
          <Text mt={3} color="smu.darkGray">
            신청 내역을 불러오고 있습니다.
          </Text>
        </ProjectRequestStatePanel>
      ) : data?.status !== "SUCCESS" ? (
        <ProjectRequestStatePanel tone="error">
          <Text fontWeight="bold" color="#a32222">
            {isPermissionDenied
              ? "로그인 후 신청 내역을 확인할 수 있습니다."
              : "신청 내역을 불러오지 못했습니다."}
          </Text>
          <Text mt={1} fontSize="sm" color="smu.darkGray">
            {data?.detail.message}
          </Text>
          {!isPermissionDenied && (
            <Button
              mt={4}
              size="sm"
              variant="outline"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching ? "다시 조회 중" : "다시 시도"}
            </Button>
          )}
        </ProjectRequestStatePanel>
      ) : data.data.length === 0 ? (
        <ProjectRequestStatePanel>
          <Text color="smu.darkGray">아직 프로젝트 신청 내역이 없습니다.</Text>
        </ProjectRequestStatePanel>
      ) : applications.length === 0 ? (
        <ProjectRequestStatePanel>
          <Text color="smu.darkGray">
            선택한 상태에 해당하는 신청 내역이 없습니다.
          </Text>
        </ProjectRequestStatePanel>
      ) : (
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={4}>
          {applications.map((application) => {
            const statusMeta = STATUS_META[application.status];
            return (
              <Box
                key={application.id}
                p={5}
                borderWidth={1}
                borderColor="smu.gray"
                borderRadius="lg"
                bg="white"
              >
                <Flex justifyContent="space-between" alignItems="flex-start" gap={3}>
                  <Box minWidth={0}>
                    <RouterLink to={`/projects/${application.projectId}`}>
                      <Text
                        fontSize="lg"
                        fontWeight="bold"
                        color="smu.blue"
                        lineClamp={1}
                      >
                        {application.projectName}
                      </Text>
                    </RouterLink>
                    <Text mt={1} fontSize="xs" color="smu.darkGray">
                      프로젝트 상태 · {PROJECT_STATUS_LABEL[application.projectStatus]}
                    </Text>
                  </Box>
                  <Box
                    px={2.5}
                    py={1}
                    flexShrink={0}
                    borderRadius="full"
                    bg={statusMeta.bg}
                    color={statusMeta.color}
                    fontSize="xs"
                    fontWeight="bold"
                  >
                    {statusMeta.label}
                  </Box>
                </Flex>

                <VStack mt={4} alignItems="stretch" gap={1}>
                  <Text fontSize="sm" color="smu.darkGray">
                    신청 {formatDateKST(application.createdAt)}
                  </Text>
                  <Text fontSize="sm" color="smu.darkGray">
                    상태 변경 {formatDateKST(application.updatedAt)}
                  </Text>
                  {application.description && (
                    <Box mt={2} p={3} borderRadius="md" bg="#f7f7f7">
                      <Text fontSize="sm">{application.description}</Text>
                    </Box>
                  )}
                </VStack>

                <RouterLink
                  to={`/projects/${application.projectId}`}
                  style={{ display: "block", marginTop: "1rem" }}
                >
                  <Button size="sm" width="100%" variant="outline">
                    프로젝트 보기
                  </Button>
                </RouterLink>
              </Box>
            );
          })}
        </SimpleGrid>
      )}
    </VStack>
  );
}
