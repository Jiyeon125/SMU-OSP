import {
  Box,
  HStack,
  Input,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import ProjectCard from "../components/ProjectCard";
import RecommendedProjects from "../components/RecommendedProjects";
import { Button } from "../components/ui/button";
import { listProjects } from "../services/projectService";
import { PROJECT_STATUS_LABEL, ProjectStatus } from "../types/project";

export default function ProjectListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });

  const [statusFilter, setStatusFilter] = useState<"ALL" | ProjectStatus>(
    "ALL"
  );
  const [techFilter, setTechFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"latest" | "title">("latest");

  const allProjects = data?.status === "SUCCESS" ? data.data : [];

  const techOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProjects) for (const t of p.techStacks) set.add(t);
    return Array.from(set).sort();
  }, [allProjects]);

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProjects) for (const r of p.recruitRoles) set.add(r);
    return Array.from(set).sort();
  }, [allProjects]);

  const filtered = useMemo(() => {
    let list = [...allProjects];
    if (statusFilter !== "ALL") {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (techFilter) {
      list = list.filter((p) => p.techStacks.includes(techFilter));
    }
    if (roleFilter) {
      list = list.filter((p) => p.recruitRoles.includes(roleFilter));
    }
    if (sortBy === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      list.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
    return list;
  }, [allProjects, statusFilter, techFilter, roleFilter, sortBy]);

  return (
    <Box px={{ base: 4, md: 10 }} py={6} maxW={"1200px"} mx={"auto"}>
      <VStack alignItems={"stretch"} gap={5}>
        <HStack justifyContent={"space-between"} alignItems={"center"}>
          <Box>
            <Text fontSize={"2xl"} fontWeight={"bold"} color={"smu.blue"}>
              프로젝트 둘러보기
            </Text>
            <Text fontSize={"sm"} color={"smu.darkGray"}>
              관심 분야와 기술 스택에 맞는 프로젝트를 찾아 지원해 보세요.
            </Text>
          </Box>
          <RouterLink to={"/projects/new"}>
            <Button>+ 프로젝트 등록</Button>
          </RouterLink>
        </HStack>

        <RecommendedProjects />

        <Box
          p={4}
          borderWidth={1}
          borderColor={"smu.gray"}
          borderRadius={"lg"}
          bg={"white"}
        >
          <HStack
            flexWrap={"wrap"}
            gap={3}
            alignItems={"flex-end"}
            justifyContent={"space-between"}
          >
            <HStack flexWrap={"wrap"} gap={3} alignItems={"flex-end"}>
              <VStack alignItems={"flex-start"} gap={1}>
                <Text fontSize={"xs"} color={"smu.darkGray"}>
                  상태
                </Text>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "ALL" | ProjectStatus)
                  }
                  style={selectStyle}
                >
                  <option value="ALL">전체</option>
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
              </VStack>

              <VStack alignItems={"flex-start"} gap={1}>
                <Text fontSize={"xs"} color={"smu.darkGray"}>
                  기술 스택
                </Text>
                <Input
                  list="tech-options"
                  placeholder="기술 스택 선택/입력"
                  value={techFilter}
                  onChange={(e) => setTechFilter(e.target.value)}
                  width={"180px"}
                  size={"sm"}
                />
                <datalist id="tech-options">
                  {techOptions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </VStack>

              <VStack alignItems={"flex-start"} gap={1}>
                <Text fontSize={"xs"} color={"smu.darkGray"}>
                  모집 역할
                </Text>
                <Input
                  list="role-options"
                  placeholder="역할 선택/입력"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  width={"180px"}
                  size={"sm"}
                />
                <datalist id="role-options">
                  {roleOptions.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </VStack>

              <VStack alignItems={"flex-start"} gap={1}>
                <Text fontSize={"xs"} color={"smu.darkGray"}>
                  정렬
                </Text>
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as "latest" | "title")
                  }
                  style={selectStyle}
                >
                  <option value="latest">최신순</option>
                  <option value="title">이름순</option>
                </select>
              </VStack>
            </HStack>

            <HStack gap={2}>
              <Text fontSize={"xs"} color={"smu.darkGray"}>
                결과: {filtered.length}개
              </Text>
              {(statusFilter !== "ALL" || techFilter || roleFilter) && (
                <Button
                  size={"xs"}
                  variant={"outline"}
                  onClick={() => {
                    setStatusFilter("ALL");
                    setTechFilter("");
                    setRoleFilter("");
                  }}
                >
                  초기화
                </Button>
              )}
            </HStack>
          </HStack>
        </Box>

        {isLoading ? (
          <Box display={"flex"} justifyContent={"center"} p={10}>
            <Spinner />
          </Box>
        ) : filtered.length === 0 ? (
          <Box
            p={10}
            textAlign={"center"}
            borderWidth={1}
            borderColor={"smu.gray"}
            borderRadius={"lg"}
            bg={"#f7f7f7"}
          >
            <Text color={"smu.darkGray"}>
              조건에 맞는 프로젝트가 없습니다.
            </Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </SimpleGrid>
        )}
      </VStack>
    </Box>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: "0.875rem",
  borderRadius: "6px",
  border: "1px solid #d9d9d6",
  background: "white",
};
