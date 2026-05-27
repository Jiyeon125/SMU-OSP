import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_TYPE_LABEL,
  Project,
  ProjectStatus,
} from "../types/project";
import { formatDateKST } from "../utils/date";

interface Props {
  project: Project;
}

const STATUS_COLOR: Record<ProjectStatus, { bg: string; color: string }> = {
  RECRUITING: { bg: "smu.lightBlue", color: "white" },
  IN_PROGRESS: { bg: "smu.yellow", color: "smu.darkGray" },
  COMPLETED: { bg: "smu.smuGray", color: "white" },
  CLOSED: { bg: "smu.gray", color: "smu.darkGray" },
};

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
      whiteSpace={"nowrap"}
    >
      {children}
    </Box>
  );
}

export default function ProjectCard({ project }: Props) {
  const statusStyle = STATUS_COLOR[project.status];

  return (
    <Box
      p={4}
      borderWidth={1}
      borderColor={"smu.gray"}
      borderRadius={"lg"}
      bg={"white"}
      h={"100%"}
      display={"flex"}
      flexDirection={"column"}
    >
      <VStack alignItems={"stretch"} gap={2} flex={1}>
        <HStack justifyContent={"space-between"} alignItems={"flex-start"}>
          <Text fontWeight={"bold"} color={"smu.blue"} fontSize={"md"}>
            {project.title}
          </Text>
          <Pill bg={statusStyle.bg} color={statusStyle.color}>
            {PROJECT_STATUS_LABEL[project.status]}
          </Pill>
        </HStack>

        <Text fontSize={"sm"} color={"smu.darkGray"} lineClamp={2} minH={"3em"}>
          {project.summary}
        </Text>

        <HStack flexWrap={"wrap"} gap={1}>
          {project.techStacks.slice(0, 5).map((t) => (
            <Pill key={t}>{t}</Pill>
          ))}
          {project.techStacks.length > 5 && (
            <Pill>+{project.techStacks.length - 5}</Pill>
          )}
        </HStack>

        <HStack flexWrap={"wrap"} gap={1}>
          {project.recruitRoles.slice(0, 3).map((r) => (
            <Pill key={r} bg={"smu.blue"} color={"white"}>
              {r}
            </Pill>
          ))}
          {project.recruitRoles.length > 3 && (
            <Pill bg={"smu.blue"} color={"white"}>
              +{project.recruitRoles.length - 3}
            </Pill>
          )}
        </HStack>

        <HStack
          fontSize={"xs"}
          color={"smu.darkGray"}
          gap={3}
          flexWrap={"wrap"}
        >
          <Text>{PROJECT_TYPE_LABEL[project.projectType]}</Text>
          <Text>
            모집 {project.currentApplicantCount}/{project.recruitCount}
          </Text>
          <Text>수정 {formatDateKST(project.updatedAt)}</Text>
        </HStack>

        <Box flex={1} />

        <HStack justifyContent={"flex-end"}>
          <RouterLink to={`/projects/${project.id}`}>
            <Box
              px={3}
              py={1}
              fontSize={"sm"}
              borderRadius={"md"}
              borderWidth={1}
              borderColor={"smu.blue"}
              color={"smu.blue"}
              _hover={{ bg: "smu.blue", color: "white" }}
              cursor={"pointer"}
            >
              상세 보기 →
            </Box>
          </RouterLink>
        </HStack>
      </VStack>
    </Box>
  );
}
