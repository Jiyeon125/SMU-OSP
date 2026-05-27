import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { MOCK_USER } from "../data/mockUser";
import { recommendForUser } from "../services/recommendationService";
import { formatDateTimeKST } from "../utils/date";

export default function RecommendedProjects() {
  const { data, isLoading } = useQuery({
    queryKey: ["recommendations", MOCK_USER.id],
    queryFn: () => recommendForUser(MOCK_USER, 3),
  });

  if (isLoading) {
    return (
      <Box
        p={4}
        borderWidth={1}
        borderColor={"smu.gray"}
        borderRadius={"lg"}
        bg={"white"}
      >
        <Text>추천 계산 중...</Text>
      </Box>
    );
  }

  if (!data || data.status !== "SUCCESS") {
    const code = data?.detail.code;
    const message = data?.detail.message || "추천 결과를 가져올 수 없습니다.";
    return (
      <Box
        p={4}
        borderWidth={1}
        borderColor={"smu.orange"}
        bg={"#fff8ec"}
        borderRadius={"lg"}
      >
        <Text fontWeight={"bold"} color={"smu.orange"}>
          [{code}]
        </Text>
        <Text fontSize={"sm"}>{message}</Text>
      </Box>
    );
  }

  const recs = data.data;
  const recommendedAt = recs[0]?.recommendedAt;

  return (
    <Box
      p={5}
      borderWidth={1}
      borderColor={"smu.blue"}
      borderRadius={"lg"}
      bg={"white"}
    >
      <HStack justifyContent={"space-between"} mb={3}>
        <Text fontSize={"lg"} fontWeight={"bold"} color={"smu.blue"}>
          {MOCK_USER.name}님을 위한 추천 프로젝트
        </Text>
        {recommendedAt && (
          <Text fontSize={"xs"} color={"smu.smuGray"}>
            추천 생성 시각: {formatDateTimeKST(recommendedAt)}
          </Text>
        )}
      </HStack>

      <VStack alignItems={"stretch"} gap={3}>
        {recs.map((r, idx) => (
          <Box
            key={r.projectId}
            p={3}
            borderWidth={1}
            borderColor={"smu.gray"}
            borderRadius={"md"}
          >
            <HStack
              justifyContent={"space-between"}
              alignItems={"flex-start"}
              mb={1}
            >
              <HStack gap={2}>
                <Text fontSize={"sm"} color={"smu.darkGray"}>
                  #{idx + 1}
                </Text>
                <RouterLink to={`/projects/${r.projectId}`}>
                  <Text
                    fontWeight={"bold"}
                    color={"smu.blue"}
                    _hover={{ textDecoration: "underline" }}
                  >
                    {r.title}
                  </Text>
                </RouterLink>
              </HStack>
              <Box
                px={3}
                py={1}
                borderRadius={"md"}
                bg={"smu.blue"}
                color={"white"}
                fontWeight={"bold"}
                fontSize={"sm"}
              >
                score {r.score}
              </Box>
            </HStack>

            <Text fontSize={"sm"} mb={2}>
              {r.reason}
            </Text>

            <HStack flexWrap={"wrap"} gap={1}>
              {r.matchedInterests.map((t) => (
                <Box
                  key={`i-${t}`}
                  px={2}
                  py={0.5}
                  fontSize={"xs"}
                  borderRadius={"full"}
                  bg={"smu.yellow"}
                  color={"smu.darkGray"}
                >
                  관심: {t}
                </Box>
              ))}
              {r.matchedTechStacks.map((t) => (
                <Box
                  key={`t-${t}`}
                  px={2}
                  py={0.5}
                  fontSize={"xs"}
                  borderRadius={"full"}
                  bg={"smu.lightBlue"}
                  color={"white"}
                >
                  기술: {t}
                </Box>
              ))}
              {r.matchedRoles.map((t) => (
                <Box
                  key={`r-${t}`}
                  px={2}
                  py={0.5}
                  fontSize={"xs"}
                  borderRadius={"full"}
                  bg={"smu.blue"}
                  color={"white"}
                >
                  역할: {t}
                </Box>
              ))}
            </HStack>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}
