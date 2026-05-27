import {
  Box,
  HStack,
  Input,
  Textarea,
  VStack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "./ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruitRoles: string[];
  defaultSkills?: string[];
  loading?: boolean;
  onSubmit: (input: {
    role: string;
    skills: string[];
    message: string;
  }) => void;
}

export default function ApplyDialog({
  open,
  onOpenChange,
  recruitRoles,
  defaultSkills = [],
  loading = false,
  onSubmit,
}: Props) {
  const [role, setRole] = useState<string>(recruitRoles[0] || "");
  const [skills, setSkills] = useState<string>(defaultSkills.join(", "));
  const [message, setMessage] = useState<string>("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setRole(recruitRoles[0] || "");
      setSkills(defaultSkills.join(", "));
      setMessage("");
      setTouched(false);
    }
  }, [open, recruitRoles, defaultSkills]);

  const roleInvalid = touched && !role;

  const handleSubmit = () => {
    setTouched(true);
    if (!role) return;
    onSubmit({
      role,
      skills: skills
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      message: message.trim(),
    });
  };

  return (
    <DialogRoot
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>프로젝트 지원하기</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack alignItems={"stretch"} gap={4}>
            <Box>
              <Text fontSize={"sm"} fontWeight={"semibold"} mb={1}>
                희망 역할 <span style={{ color: "#ff7c01" }}>*</span>
              </Text>
              <HStack flexWrap={"wrap"} gap={2}>
                {recruitRoles.map((r) => (
                  <Box
                    key={r}
                    px={3}
                    py={1}
                    borderRadius={"md"}
                    borderWidth={1}
                    borderColor={role === r ? "smu.blue" : "smu.gray"}
                    bg={role === r ? "smu.blue" : "white"}
                    color={role === r ? "white" : "smu.darkGray"}
                    cursor={"pointer"}
                    fontSize={"sm"}
                    onClick={() => setRole(r)}
                  >
                    {r}
                  </Box>
                ))}
              </HStack>
              {roleInvalid && (
                <Text fontSize={"xs"} color={"smu.orange"} mt={1}>
                  희망 역할을 선택해주세요.
                </Text>
              )}
            </Box>

            <Box>
              <Text fontSize={"sm"} fontWeight={"semibold"} mb={1}>
                보유 기술 (쉼표 또는 공백 구분)
              </Text>
              <Input
                placeholder="예: React, TypeScript, Django"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
              />
            </Box>

            <Box>
              <Text fontSize={"sm"} fontWeight={"semibold"} mb={1}>
                지원 메시지
              </Text>
              <Textarea
                placeholder="간단한 자기소개와 어떤 부분에 기여하고 싶은지 알려주세요."
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </Box>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button
            variant={"outline"}
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "지원 중..." : "지원하기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
