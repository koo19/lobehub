export interface CheckpointConfig {
  onAgentRequest?: boolean;
  tasks?: {
    afterIds?: string[];
    beforeIds?: string[];
  };
  topic?: {
    after?: boolean;
    before?: boolean;
  };
}

export interface WorkspaceDocNode {
  charCount: number | null;
  createdAt: string;
  fileType: string;
  parentId: string | null;
  pinnedBy: string;
  sourceTaskIdentifier: string | null;
  title: string;
  updatedAt: string | null;
}

export interface WorkspaceTreeNode {
  children: WorkspaceTreeNode[];
  id: string;
}

export interface WorkspaceData {
  nodeMap: Record<string, WorkspaceDocNode>;
  tree: WorkspaceTreeNode[];
}

// ── Task Detail (shared across CLI, viewTask tool, task.detail router) ──

export interface TaskDetailSubtask {
  blockedBy?: string;
  identifier: string;
  name?: string | null;
  priority?: number | null;
  status: string;
}

export interface TaskDetailWorkspaceNode {
  children?: TaskDetailWorkspaceNode[];
  documentId: string;
  fileType?: string;
  size?: number | null;
  sourceTaskIdentifier?: string | null;
  title?: string;
}

export interface TaskDetailTopic {
  id?: string;
  seq?: number | null;
  status?: string | null;
  time?: string;
  title?: string;
}

export interface TaskDetailBrief {
  id?: string;
  priority?: string | null;
  resolvedAction?: string | null;
  summary?: string;
  time?: string;
  title: string;
  type: string;
}

export interface TaskDetailComment {
  agentId?: string | null;
  content: string;
  time?: string;
}

export interface TaskDetailData {
  agentId?: string | null;
  checkpoint?: CheckpointConfig;
  createdAt?: string;
  dependencies?: Array<{ dependsOn: string; type: string }>;
  description?: string | null;
  error?: string | null;
  heartbeat?: {
    interval?: number | null;
    lastAt?: string | null;
    timeout?: number | null;
  };
  identifier: string;
  instruction: string;
  name?: string | null;
  parent?: { identifier: string; name: string | null } | null;
  priority?: number | null;
  review?: Record<string, any> | null;
  status: string;
  subtasks?: TaskDetailSubtask[];
  timeline?: {
    briefs?: TaskDetailBrief[];
    comments?: TaskDetailComment[];
    topics?: TaskDetailTopic[];
  };
  topicCount?: number;
  userId?: string | null;
  workspace?: TaskDetailWorkspaceNode[];
}
