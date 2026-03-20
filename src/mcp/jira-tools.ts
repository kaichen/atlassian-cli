import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JiraService } from "../services/jira.ts";
import { registerJsonTool } from "./helpers.ts";

interface JiraToolOptions {
  server: McpServer;
  jira: JiraService;
  enabledTools?: Set<string>;
  readOnly: boolean;
}

const jsonValueSchema = z.unknown();

function stringList(value?: string): string[] | undefined {
  if (!value) {
    return undefined;
  }
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export function registerJiraTools(options: JiraToolOptions): number {
  const { server, jira, enabledTools, readOnly } = options;
  let count = 0;

  count += Number(registerJsonTool(server, {
    name: "jira_get_issue",
    title: "Get Issue",
    description: "Get details of a specific Jira issue.",
    inputSchema: {
      issue_key: z.string().min(1),
      fields: z.string().optional(),
      expand: z.string().optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ issue_key, fields, expand }) => jira.getIssue(issue_key, fields, expand),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_search",
    title: "Search Issues",
    description: "Search Jira issues using JQL.",
    inputSchema: {
      jql: z.string().min(1),
      fields: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      start_at: z.number().int().min(0).optional(),
      expand: z.string().optional(),
      projects_filter: z.string().optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ jql, fields, limit, start_at, expand, projects_filter }) =>
      jira.searchIssues(jql, fields, limit ?? 10, start_at ?? 0, expand, projects_filter),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_create_issue",
    title: "Create Issue",
    description: "Create a new Jira issue.",
    inputSchema: { body: jsonValueSchema },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: ({ body }) => jira.createIssue(body),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_update_issue",
    title: "Update Issue",
    description: "Update an existing Jira issue.",
    inputSchema: {
      issue_key: z.string().min(1),
      body: jsonValueSchema,
    },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: async ({ issue_key, body }) => {
      await jira.updateIssue(issue_key, body);
      return { success: true, issue_key };
    },
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_delete_issue",
    title: "Delete Issue",
    description: "Delete a Jira issue.",
    inputSchema: { issue_key: z.string().min(1) },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: async ({ issue_key }) => {
      await jira.deleteIssue(issue_key);
      return { success: true, issue_key };
    },
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_transition_issue",
    title: "Transition Issue",
    description: "Transition a Jira issue to a different workflow state.",
    inputSchema: {
      issue_key: z.string().min(1),
      transition_id: z.string().min(1),
      body: jsonValueSchema.optional(),
    },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: async ({ issue_key, transition_id, body }) => {
      await jira.transitionIssue(issue_key, transition_id, body);
      return { success: true, issue_key, transition_id };
    },
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_add_comment",
    title: "Add Comment",
    description: "Add a comment to a Jira issue.",
    inputSchema: {
      issue_key: z.string().min(1),
      text: z.string().optional(),
      body: jsonValueSchema.optional(),
    },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: ({ issue_key, text, body }) => jira.addComment(issue_key, text, body),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_get_worklog",
    title: "Get Worklog",
    description: "List worklogs for a Jira issue.",
    inputSchema: {
      issue_key: z.string().min(1),
      start_at: z.number().int().min(0).optional(),
      max_results: z.number().int().min(1).max(100).optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ issue_key, start_at, max_results }) =>
      jira.getWorklog(issue_key, start_at, max_results),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_add_worklog",
    title: "Add Worklog",
    description: "Add a worklog entry to a Jira issue.",
    inputSchema: {
      issue_key: z.string().min(1),
      body: jsonValueSchema,
    },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: ({ issue_key, body }) => jira.addWorklog(issue_key, body),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_get_transitions",
    title: "Get Transitions",
    description: "List available transitions for a Jira issue.",
    inputSchema: { issue_key: z.string().min(1) },
    enabledTools,
    readOnly,
    handler: ({ issue_key }) => jira.getTransitions(issue_key),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_get_issue_link_types",
    title: "Get Issue Link Types",
    description: "List Jira issue link types.",
    inputSchema: {},
    enabledTools,
    readOnly,
    handler: () => jira.getIssueLinkTypes(),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_create_issue_link",
    title: "Create Issue Link",
    description: "Create a link between two Jira issues.",
    inputSchema: { body: jsonValueSchema },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: ({ body }) => jira.createIssueLink(body),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_remove_issue_link",
    title: "Remove Issue Link",
    description: "Remove a Jira issue link by ID.",
    inputSchema: { link_id: z.string().min(1) },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: async ({ link_id }) => {
      await jira.removeIssueLink(link_id);
      return { success: true, link_id };
    },
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_batch_create_issues",
    title: "Batch Create Issues",
    description: "Create multiple Jira issues in one request.",
    inputSchema: { body: jsonValueSchema },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: ({ body }) => jira.batchCreateIssues(body),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_batch_get_changelogs",
    title: "Batch Get Changelogs",
    description: "Fetch changelogs for multiple Jira issues. Cloud only.",
    inputSchema: {
      issue_ids_or_keys: z.array(z.string().min(1)).min(1),
      fields: z.array(z.string().min(1)).optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ issue_ids_or_keys, fields }) =>
      jira.batchGetChangelogs(issue_ids_or_keys, fields),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_get_user_profile",
    title: "Get User Profile",
    description: "Get a Jira user profile by account ID, username, or email-like identifier.",
    inputSchema: { user_identifier: z.string().min(1) },
    enabledTools,
    readOnly,
    handler: ({ user_identifier }) => jira.getUserProfile(user_identifier),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_get_all_projects",
    title: "Get All Projects",
    description: "List Jira projects.",
    inputSchema: {
      start_at: z.number().int().min(0).optional(),
      max_results: z.number().int().min(1).max(100).optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ start_at, max_results }) => jira.getAllProjects(start_at, max_results),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_get_project_issues",
    title: "Get Project Issues",
    description: "List issues for a Jira project.",
    inputSchema: {
      project_key: z.string().min(1),
      jql: z.string().optional(),
      fields: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      start_at: z.number().int().min(0).optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ project_key, jql, fields, limit, start_at }) =>
      jira.getProjectIssues(project_key, jql, fields, limit ?? 10, start_at ?? 0),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_get_project_versions",
    title: "Get Project Versions",
    description: "List versions for a Jira project.",
    inputSchema: { project_key: z.string().min(1) },
    enabledTools,
    readOnly,
    handler: ({ project_key }) => jira.getProjectVersions(project_key),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_create_version",
    title: "Create Version",
    description: "Create a Jira version.",
    inputSchema: { body: jsonValueSchema },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: ({ body }) => jira.createVersion(body),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_batch_create_versions",
    title: "Batch Create Versions",
    description: "Create multiple Jira versions.",
    inputSchema: { body: jsonValueSchema },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: ({ body }) => jira.batchCreateVersions(body),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_search_fields",
    title: "Search Fields",
    description: "Search Jira fields.",
    inputSchema: {
      query: z.string().optional(),
      start_at: z.number().int().min(0).optional(),
      max_results: z.number().int().min(1).max(100).optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ query, start_at, max_results }) =>
      jira.searchFields(query, start_at, max_results),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_get_agile_boards",
    title: "Get Agile Boards",
    description: "List Jira agile boards.",
    inputSchema: {
      start_at: z.number().int().min(0).optional(),
      max_results: z.number().int().min(1).max(100).optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ start_at, max_results }) => jira.getBoards(start_at, max_results),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_get_board_issues",
    title: "Get Board Issues",
    description: "List issues from a Jira board.",
    inputSchema: {
      board_id: z.string().min(1),
      jql: z.string().optional(),
      fields: z.string().optional(),
      start_at: z.number().int().min(0).optional(),
      max_results: z.number().int().min(1).max(100).optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ board_id, jql, fields, start_at, max_results }) =>
      jira.getBoardIssues(board_id, jql, fields, start_at, max_results),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_get_sprints_from_board",
    title: "Get Sprints From Board",
    description: "List sprints from a Jira board.",
    inputSchema: {
      board_id: z.string().min(1),
      state: z.string().optional(),
      start_at: z.number().int().min(0).optional(),
      max_results: z.number().int().min(1).max(100).optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ board_id, state, start_at, max_results }) =>
      jira.getSprintsFromBoard(board_id, state, start_at, max_results),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_get_sprint_issues",
    title: "Get Sprint Issues",
    description: "List issues from a Jira sprint.",
    inputSchema: {
      sprint_id: z.string().min(1),
      jql: z.string().optional(),
      fields: z.string().optional(),
      start_at: z.number().int().min(0).optional(),
      max_results: z.number().int().min(1).max(100).optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ sprint_id, jql, fields, start_at, max_results }) =>
      jira.getSprintIssues(sprint_id, jql, fields, start_at, max_results),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_create_sprint",
    title: "Create Sprint",
    description: "Create a Jira sprint.",
    inputSchema: { body: jsonValueSchema },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: ({ body }) => jira.createSprint(body),
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_update_sprint",
    title: "Update Sprint",
    description: "Update a Jira sprint.",
    inputSchema: {
      sprint_id: z.string().min(1),
      body: jsonValueSchema,
    },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: async ({ sprint_id, body }) => {
      await jira.updateSprint(sprint_id, body);
      return { success: true, sprint_id };
    },
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_link_to_epic",
    title: "Link To Epic",
    description: "Add issues to a Jira epic.",
    inputSchema: {
      epic_id_or_key: z.string().min(1),
      issue_keys: z.array(z.string().min(1)).min(1).optional(),
      issues: z.string().optional(),
    },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: ({ epic_id_or_key, issue_keys, issues }) => {
      const resolvedIssueKeys = issue_keys ?? stringList(issues);
      if (!resolvedIssueKeys || resolvedIssueKeys.length === 0) {
        throw new Error("Provide issue_keys or issues for jira_link_to_epic.");
      }
      return jira.addIssuesToEpic(epic_id_or_key, resolvedIssueKeys);
    },
  }));

  count += Number(registerJsonTool(server, {
    name: "jira_download_attachments",
    title: "Download Attachments",
    description: "Download Jira attachments to a local directory.",
    inputSchema: {
      attachment_ids: z.array(z.string().min(1)).min(1).optional(),
      ids: z.string().optional(),
      output_dir: z.string().min(1).optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ attachment_ids, ids, output_dir }) =>
      jira.downloadAttachments(attachment_ids ?? stringList(ids) ?? [], output_dir ?? "."),
  }));

  return count;
}
