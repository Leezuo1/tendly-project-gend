export interface DashboardData {
  waiting: number;
  incomingToday: number;
  outgoingToday: number;
  recentMessages: { id: string; name: string; text: string; timestamp: number }[];
  weeklyChats: { day: string; count: number }[];
}
