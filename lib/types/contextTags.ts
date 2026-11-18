import type { TagType } from './inbox';

export interface ContextTagRule {
  id: string;
  label: string;
  keywords: string[];
  type: TagType;
  enabled: boolean;
  /** Ngữ cảnh shop viết cho AI: nhãn này nghĩa là tình huống gì (tối đa 500 ký tự). */
  context?: string;
}
