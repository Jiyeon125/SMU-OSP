import {
  Box,
  HStack,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import {
  getTeamRankings,
  recalculateTeamRankings,
} from "../services/repoService";
import { formatDateTimeKST } from "../utils/date";

function MedalColor(rank: number) {
  if (rank === 1) return { bg: "smu.yellow", color: "smu.darkGray" };
  if (rank === 2) return { bg: "smu.smuGray", color: "white" };
  if (rank === 3) return { bg: "smu.orange", color: "white" };
  return { bg: "smu.gray", color: "smu.darkGray" };
}

export default function RankingPage() {
  const queryClient = useQueryClient();

  const rankingsQuery = useQuery({
    queryKey: ["team-rankings"],
    queryFn: () => getTeamRankings(),
  });

  const recalcMutation = useMutation({
    mutationFn: () => recalculateTeamRankings(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-rankings"] });
      queryClient.invalidateQueries({ queryKey: ["repository"] });
    },
  });

  if (rankingsQuery.isLoading) {
    return (
      <Box display={"flex"} justifyContent={"center"} p={10}>
        <Spinner />
      </Box>
    );
  }

  const resp = rankingsQuery.data;

  return (
    <Box px={{ base: 4, md: 10 }} py={6} maxW={"1100px"} mx={"auto"}>
      <VStack alignItems={"stretch"} gap={5}>
        <HStack justifyContent={"space-between"} alignItems={"flex-end"}>
          <VStack alignItems={"flex-start"} gap={0}>
            <Text fontSize={"2xl"} fontWeight={"bold"} color={"smu.blue"}>
              팀/프로젝트 활동 랭킹
            </Text>
            <Text fontSize={"sm"} color={"smu.darkGray"}>
              현재 등록된 GitHub Repository 캐시 기준으로 계산됩니다. <br />
              score = (project_count × 30) + (total_stars × 2) + (total_forks ×
              3) + recent_update_score
            </Text>
          </VStack>
          <Button
            onClick={() => recalcMutation.mutate()}
            disabled={recalcMutation.isPending}
          >
            {recalcMutation.isPending ? "재계산 중…" : "↻ 전체 갱신·재계산"}
          </Button>
        </HStack>

        {recalcMutation.data?.status === "SUCCESS" && (
          <Box
            p={3}
            borderWidth={1}
            borderColor={"smu.lightBlue"}
            bg={"#eaf3fb"}
            borderRadius={"md"}
            fontSize={"sm"}
          >
            전체 갱신 완료: 성공 {recalcMutation.data.data.refresh.succeeded}건
            {recalcMutation.data.data.refresh.failed.length > 0 && (
              <Text as={"span"} color={"smu.orange"}>
                {" "}
                / 실패 {recalcMutation.data.data.refresh.failed.length}건 (기존
                캐시 유지)
              </Text>
            )}
          </Box>
        )}

        {!resp || resp.status !== "SUCCESS" ? (
          <Box
            p={6}
            borderWidth={1}
            borderColor={"smu.orange"}
            bg={"#fff8ec"}
            borderRadius={"lg"}
          >
            <Text fontWeight={"bold"} color={"smu.orange"}>
              [{resp?.detail?.code || "UNKNOWN"}]
            </Text>
            <Text>
              {resp?.detail?.message || "랭킹 정보를 불러올 수 없습니다."}
            </Text>
          </Box>
        ) : resp.data.rankings.length === 0 ? (
          <Box
            p={8}
            borderWidth={1}
            borderColor={"smu.gray"}
            borderRadius={"lg"}
            textAlign={"center"}
            color={"smu.darkGray"}
          >
            <Text fontSize={"md"} fontWeight={"bold"} mb={1}>
              랭킹 데이터가 없습니다.
            </Text>
            <Text fontSize={"sm"}>
              프로젝트 상세 화면에서 GitHub Repository를 먼저 연결해주세요.
            </Text>
          </Box>
        ) : (
          <VStack alignItems={"stretch"} gap={3}>
            {resp.data.rankings.map((row) => {
              const medal = MedalColor(row.rank);
              return (
                <Box
                  key={`${row.team}-${row.rank}`}
                  p={5}
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
                    <HStack gap={3}>
                      <Box
                        w={"48px"}
                        h={"48px"}
                        display={"flex"}
                        alignItems={"center"}
                        justifyContent={"center"}
                        borderRadius={"full"}
                        bg={medal.bg}
                        color={medal.color}
                        fontWeight={"bold"}
                        fontSize={"lg"}
                      >
                        #{row.rank}
                      </Box>
                      <VStack alignItems={"flex-start"} gap={0}>
                        <Text fontSize={"lg"} fontWeight={"bold"} color={"smu.blue"}>
                          {row.team}
                        </Text>
                        <Text fontSize={"xs"} color={"smu.darkGray"}>
                          calculated_at: {formatDateTimeKST(row.calculatedAt)}
                        </Text>
                      </VStack>
                    </HStack>
                    <VStack alignItems={"flex-end"} gap={0}>
                      <Text fontSize={"2xl"} fontWeight={"bold"} color={"smu.blue"}>
                        {row.score.toLocaleString()}
                      </Text>
                      <Text fontSize={"xs"} color={"smu.darkGray"}>
                        총점
                      </Text>
                    </VStack>
                  </HStack>

                  <SimpleGrid columns={{ base: 2, md: 4 }} gap={2} mb={3}>
                    <Box p={2} bg={"smu.gray"} borderRadius={"md"}>
                      <Text fontSize={"xs"} color={"smu.darkGray"}>
                        프로젝트 수
                      </Text>
                      <Text fontWeight={"bold"}>{row.projectCount}</Text>
                    </Box>
                    <Box p={2} bg={"smu.gray"} borderRadius={"md"}>
                      <Text fontSize={"xs"} color={"smu.darkGray"}>
                        ★ stars 합계
                      </Text>
                      <Text fontWeight={"bold"}>
                        {row.totalStars.toLocaleString()}
                      </Text>
                    </Box>
                    <Box p={2} bg={"smu.gray"} borderRadius={"md"}>
                      <Text fontSize={"xs"} color={"smu.darkGray"}>
                        ⑂ forks 합계
                      </Text>
                      <Text fontWeight={"bold"}>
                        {row.totalForks.toLocaleString()}
                      </Text>
                    </Box>
                    <Box p={2} bg={"smu.gray"} borderRadius={"md"}>
                      <Text fontSize={"xs"} color={"smu.darkGray"}>
                        최근 업데이트 점수
                      </Text>
                      <Text fontWeight={"bold"}>+{row.recentUpdateScore}</Text>
                    </Box>
                  </SimpleGrid>

                  {row.repositories.length > 0 && (
                    <Box>
                      <Text fontSize={"xs"} color={"smu.darkGray"} mb={1}>
                        포함된 Repository
                      </Text>
                      <VStack alignItems={"stretch"} gap={1}>
                        {row.repositories.map((r) => (
                          <HStack
                            key={r.id}
                            justifyContent={"space-between"}
                            fontSize={"sm"}
                            p={2}
                            borderWidth={1}
                            borderColor={"smu.gray"}
                            borderRadius={"md"}
                          >
                            <a
                              href={r.htmlUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "#002f87",
                                textDecoration: "underline",
                              }}
                            >
                              {r.fullName}
                            </a>
                            <HStack gap={3} fontSize={"xs"} color={"smu.darkGray"}>
                              <Text>{r.language || "-"}</Text>
                              <Text>★ {r.stars.toLocaleString()}</Text>
                              <Text>⑂ {r.forks.toLocaleString()}</Text>
                            </HStack>
                          </HStack>
                        ))}
                      </VStack>
                    </Box>
                  )}
                </Box>
              );
            })}
          </VStack>
        )}
      </VStack>
    </Box>
  );
}
