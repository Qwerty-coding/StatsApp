export interface ParsedMessage {
  timestamp: number;
  sender: string;
  text: string;
  isMedia: boolean;
  isSystem: boolean;
}

export interface UserStat {
  sender: string;
  messageCount: number;
}

export interface BucketCount {
  name: string;
  value: number;
}

export interface Stats {
  totalMessages: number;
  totalUsers: number;
  avgPerUser: number;
  firstMessage: number;
  lastMessage: number;
  busiestDay: string;
  busiestDate: string;
  busiestDateCount: number;
  hourlyStats: number[];
  userStats: UserStat[];
  longestSilence: string;
  avgResponseTime: string;
  icebreakerName: string;
  icebreakerCount: number;
  monologuerName: string;
  monologuerStreak: number;
  speedDemonName: string;
  speedDemonFormatted: string;
  dynamicDuoPair: string;
  maxInteractions: number;
  leftOnReadName: string;
  maxLeftOnRead: number;
  weeklyStats: BucketCount[];
  monthlyStats: BucketCount[];
}

/** Empty stats shape returned when there are no valid messages. */
export type StatsResult = Stats | Record<string, never>;

export interface ParseResult {
  success: boolean;
  format: string | null;
  stats: StatsResult | null;
  messages: ParsedMessage[];
  /** Non-fatal data-quality notes — safe to show, parse still succeeded. */
  warnings: string[];
  /** Fatal problems — parse failed and produced no usable data. */
  errors?: string[];
}
