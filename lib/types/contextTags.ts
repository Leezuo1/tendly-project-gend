import type { TagType } from './inbox';

export interface ContextTagRule {
  id: string;
  label: string;
  keywords: string[];
  type: TagType;
  enabled: boolean;
}
