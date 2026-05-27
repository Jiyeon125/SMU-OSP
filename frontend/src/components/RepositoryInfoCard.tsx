import { Box, HStack, SimpleGrid, Spinner, Text, VStack } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrLinkRepository,
  refreshRepository,
} from "../services/repoService";
import { formatDateTimeKST } from "../utils/date";
import { Button } from "./ui/button";

interface Props {
  githubUrl?: string;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Box
      p={3}
      borderWidth={1}
      borderColor={"smu.gray"}
      borderRadius={"md"}
      bg={"white"}
    >
      <Text fontSize={"xs"} color={"smu.darkGray"}>
        {label}
      </Text>
      <Text fontWeight={"bold"} color={"smu.blue"}>
        {value}
      </Text>
    </Box>
  );
}

export default function RepositoryInfoCard({ githubUrl }: Props) {
  const queryClient = useQueryClient();

  const repoQuery = useQuery({
    queryKey: ["repository", githubUrl],
    queryFn: () => getOrLinkRepository(githubUrl || ""),
    enabled: !!githubUrl,
    retry: false,
  });

  const refreshMutation = useMutation({
    mutationFn: (id: number) => refreshRepository(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repository", githubUrl] });
      queryClient.invalidateQueries({ queryKey: ["team-rankings"] });
    },
  });

  if (!githubUrl) {
    return (
      <Box
        p={4}
        borderWidth={1}
        borderColor={"smu.gray"}
        borderRadius={"md"}
        bg={"#fafafa"}
      >
        <Text fontSize={"sm"} color={"smu.darkGray"}>
          GitHub Repository가 연결되지 않았습니다.
        </Text>
      </Box>
    );
  }

  if (repoQuery.isLoading) {
    return (
      <Box p={4} borderWidth={1} borderRadius={"md"} display={"flex"} gap={2}>
        <Spinner size={"sm"} /> <Text fontSize={"sm"}>GitHub Repository 정보 불러오는 중…</Text>
      </Box>
    );
  }

  const resp = repoQuery.data;
  if (!resp || resp.status !== "SUCCESS") {
    const code = resp?.detail?.code || "UNKNOWN";
    const message =
      resp?.detail?.message || "Repository 정보를 불러올 수 없습니다.";
    return (
      <Box
        p={4}
        borderWidth={1}
        borderColor={"smu.orange"}
        bg={"#fff8ec"}
        borderRadius={"md"}
      >
        <Text fontSize={"sm"} fontWeight={"bold"} color={"smu.orange"}>
          [{code}]
        </Text>
        <Text fontSize={"sm"}>{message}</Text>
      </Box>
    );
  }

  const repo = resp.data;

  return (
    <Box
      p={5}
      borderWidth={1}
      borderColor={"smu.gray"}
      borderRadius={"lg"}
      bg={"white"}
    >
      <HStack justifyContent={"space-between"} alignItems={"flex-start"} mb={3}>
        <VStack alignItems={"flex-start"} gap={0} flex={1}>
          <Text fontSize={"xs"} color={"smu.darkGray"}>
            GitHub Repository
          </Text>
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#002f87",
              textDecoration: "underline",
              fontWeight: 700,
              fontSize: "1.05rem",
            }}
          >
            {repo.fullName} ↗
          </a>
          {repo.description && (
            <Text fontSize={"sm"} color={"smu.darkGray"} mt={1}>
              {repo.description}
            </Text>
          )}
        </VStack>
        <Button
          variant={"outline"}
          size={"sm"}
          onClick={() => refreshMutation.mutate(repo.id)}
          disabled={refreshMutation.isPending}
        >
          {refreshMutation.isPending ? "갱신 중…" : "↻ 새로고침"}
        </Button>
      </HStack>

      <SimpleGrid columns={{ base: 2, md: 4 }} gap={3} mb={3}>
        <Stat label="★ Stars" value={repo.stars.toLocaleString()} />
        <Stat label="⑂ Forks" value={repo.forks.toLocaleString()} />
        <Stat label="주요 언어" value={repo.language || "-"} />
        <Stat
          label="GitHub 최근 업데이트"
          value={
            repo.githubUpdatedAt
              ? formatDateTimeKST(repo.githubUpdatedAt)
              : "-"
          }
        />
      </SimpleGrid>

      {repo.topics.length > 0 && (
        <HStack flexWrap={"wrap"} gap={1} mb={2}>
          {repo.topics.map((t) => (
            <Box
              key={t}
              px={2}
              py={0.5}
              fontSize={"xs"}
              borderRadius={"full"}
              bg={"smu.gray"}
              color={"smu.darkGray"}
            >
              #{t}
            </Box>
          ))}
        </HStack>
      )}

      <Text fontSize={"xs"} color={"smu.darkGray"}>
        마지막 동기화 (fetched_at): {formatDateTimeKST(repo.fetchedAt)}
      </Text>

      {refreshMutation.isError && (
        <Text fontSize={"xs"} color={"smu.orange"} mt={1}>
          갱신에 실패했지만 기존 캐시 데이터는 유지됩니다.
        </Text>
      )}
      {refreshMutation.data && refreshMutation.data.status === "FAIL" && (
        <Text fontSize={"xs"} color={"smu.orange"} mt={1}>
          [{refreshMutation.data.detail.code}] {refreshMutation.data.detail.message}
        </Text>
      )}
    </Box>
  );
}
