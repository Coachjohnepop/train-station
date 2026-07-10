export type ChatThreadKind = "member" | "cohort";

export type ChatMessageKind =
  | "text"
  | "image"
  | "video_upload"
  | "youtube"
  | "workout_update"
  | "member_sms"
  | "system";

export type ChatThread = {
  id: string;
  kind: ChatThreadKind;
  memberId?: string;
  programSlug?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatReaction = {
  emoji: string;
  userId: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  authorRole: "coach" | "member" | "system";
  authorId: string;
  authorName: string;
  kind: ChatMessageKind;
  body?: string;
  mediaUrl?: string;
  youtubeId?: string;
  videoDurationSec?: number;
  sessionDate?: string;
  todaySessionId?: string;
  workoutId?: string;
  workoutTitle?: string;
  smsLogId?: string;
  alertSent?: boolean;
  createdAt: string;
  readByUserIds: string[];
  reactions?: ChatReaction[];
};

export type ChatStore = {
  threads: ChatThread[];
  messages: ChatMessage[];
};

export function emptyCoachChatStore(): ChatStore {
  return { threads: [], messages: [] };
}