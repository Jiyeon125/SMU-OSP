import { Box, HStack, SimpleGrid, Spinner, Text, VStack } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { MOCK_USER } from "../data/mockUser";
import { listMyApplications } from "../services/applicationService";
import { listProjects } from "../services/projectService";
import { APPLICATION_STATUS_LABEL } from "../types/application";
import { formatDateTimeKST } from "../utils/date";

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

export default function UserProfilePage() {
  const myAppsQuery = useQuery({
    queryKey: ["my-applications", MOCK_USER.id],
    queryFn: () => listMyApplications(MOCK_USER.id),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });

  const apps =
    myAppsQuery.data?.status === "SUCCESS" ? myAppsQuery.data.data : [];
  const projects =
    projectsQuery.data?.status === "SUCCESS" ? projectsQuery.data.data : [];
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  const loading = myAppsQuery.isLoading || projectsQuery.isLoading;

  return (
    <Box px={{ base: 4, md: 10 }} py={6} maxW={"900px"} mx={"auto"}>
      <VStack alignItems={"stretch"} gap={5}>
        <Box
          p={6}
          borderWidth={1}
          borderColor={"smu.gray"}
          borderRadius={"lg"}
          bg={"white"}
        >
          <Text fontSize={"2xl"} fontWeight={"bold"} color={"smu.blue"} mb={1}>
            {MOCK_USER.name}
          </Text>
          <Text fontSize={"sm"} color={"smu.darkGray"} mb={4}>
            {MOCK_USER.major} · {MOCK_USER.grade}학년 ·{" "}
            가용 시간 {MOCK_USER.availableTime}
          </Text>

          <Text fontSize={"sm"} mb={4} whiteSpace={"pre-wrap"}>
            {MOCK_USER.introduction}
          </Text>

          <SimpleGrid columns={{ base: 1, md: 3 }} gap={3}>
            <Section label="관심 분야">
              {MOCK_USER.interests.map((t) => (
                <Pill key={t} bg={"smu.yellow"} color={"smu.darkGray"}>
                  {t}
                </Pill>
              ))}
            </Section>
            <Section label="보유 기술">
              {MOCK_USER.techStacks.map((t) => (
                <Pill key={t} bg={"smu.lightBlue"} color={"white"}>
                  {t}
                </Pill>
              ))}
            </Section>
            <Section label="희망 역할">
              {MOCK_USER.preferredRoles.map((t) => (
                <Pill key={t} bg={"smu.blue"} color={"white"}>
                  {t}
                </Pill>
              ))}
            </Section>
          </SimpleGrid>

          {MOCK_USER.githubUrl && (
            <Text fontSize={"sm"} mt={4}>
              <a
                href={MOCK_USER.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#002f87", textDecoration: "underline" }}
              >
                GitHub 프로필 ↗
              </a>
            </Text>
          )}
        </Box>

        <Box
          p={6}
          borderWidth={1}
          borderColor={"smu.gray"}
          borderRadius={"lg"}
          bg={"white"}
        >
          <Text fontSize={"lg"} fontWeight={"bold"} color={"smu.blue"} mb={3}>
            내 지원·관심 프로젝트
          </Text>

          {loading ? (
            <Spinner />
          ) : apps.length === 0 ? (
            <Text fontSize={"sm"} color={"smu.smuGray"}>
              아직 지원하거나 관심 저장한 프로젝트가 없습니다.{" "}
              <RouterLink
                to={"/projects"}
                style={{
                  color: "#002f87",
                  textDecoration: "underline",
                }}
              >
                둘러보기
              </RouterLink>
            </Text>
          ) : (
            <VStack alignItems={"stretch"} gap={2}>
              {apps.map((a) => {
                const project = projectMap[a.projectId];
                return (
                  <Box
                    key={a.id}
                    p={3}
                    borderWidth={1}
                    borderColor={"smu.gray"}
                    borderRadius={"md"}
                  >
                    <HStack
                      justifyContent={"space-between"}
                      alignItems={"flex-start"}
                    >
                      <VStack alignItems={"flex-start"} gap={0.5}>
                        <RouterLink to={`/projects/${a.projectId}`}>
                          <Text
                            fontWeight={"bold"}
                            color={"smu.blue"}
                            _hover={{ textDecoration: "underline" }}
                          >
                            {project?.title || `(삭제됨) ${a.projectId}`}
                          </Text>
                        </RouterLink>
                        <Text fontSize={"xs"} color={"smu.darkGray"}>
                          {formatDateTimeKST(a.appliedAt)}
                        </Text>
                        {a.role && (
                          <Text fontSize={"xs"}>희망 역할: {a.role}</Text>
                        )}
                      </VStack>
                      <Pill
                        bg={
                          a.status === "APPLIED"
                            ? "smu.blue"
                            : a.status === "INTERESTED"
                              ? "smu.yellow"
                              : "smu.gray"
                        }
                        color={
                          a.status === "INTERESTED" ? "smu.darkGray" : "white"
                        }
                      >
                        {APPLICATION_STATUS_LABEL[a.status]}
                      </Pill>
                    </HStack>
                  </Box>
                );
              })}
            </VStack>
          )}
        </Box>
      </VStack>
    </Box>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Text fontSize={"xs"} color={"smu.darkGray"} mb={1}>
        {label}
      </Text>
      <HStack flexWrap={"wrap"} gap={1}>
        {children}
      </HStack>
    </Box>
  );
}
