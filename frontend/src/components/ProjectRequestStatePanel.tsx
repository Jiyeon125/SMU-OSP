import { Box } from "@chakra-ui/react";

export default function ProjectRequestStatePanel({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <Box
      p={10}
      textAlign="center"
      borderWidth={1}
      borderColor={tone === "error" ? "#f3b8b8" : "smu.gray"}
      borderRadius="lg"
      bg={tone === "error" ? "#fff7f7" : "#f7f7f7"}
    >
      {children}
    </Box>
  );
}
