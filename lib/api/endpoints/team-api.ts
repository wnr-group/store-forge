import "server-only";
import { apiRequest } from "@/lib/api/client";

/** `/team/members` of the StoreForge API (Owner only). Dates arrive as ISO strings. */
export type TeamMemberApi = {
  userId: string;
  fullName: string | null;
  email: string;
  role: string;
  roleLabel: string;
  status: string;
  joinedAt: string;
  permissions: Record<string, string>;
};

export type TeamPermissionsApi = Record<string, string>;

export const listTeamApi = async (organizationId: string) =>
  (await apiRequest<TeamMemberApi[]>("/team/members", { organizationId })).data;

export const createMemberApi = async (
  organizationId: string,
  input: { fullName: string; email: string; password: string; permissions: TeamPermissionsApi },
) => (await apiRequest<{ userId: string; email: string }>("/team/members", { method: "POST", json: input, organizationId })).data;

export const updateMemberApi = async (organizationId: string, userId: string, input: { fullName: string; permissions: TeamPermissionsApi }) => {
  await apiRequest(`/team/members/${userId}`, { method: "PATCH", json: input, organizationId });
};

export const setMemberStatusApi = async (organizationId: string, userId: string, status: "active" | "disabled") => {
  await apiRequest(`/team/members/${userId}/status`, { method: "PATCH", json: { status }, organizationId });
};

export const removeMemberApi = async (organizationId: string, userId: string) => {
  await apiRequest(`/team/members/${userId}`, { method: "DELETE", organizationId });
};

export const resetMemberPasswordApi = async (organizationId: string, userId: string, password: string) => {
  await apiRequest(`/team/members/${userId}/password`, { method: "POST", json: { password }, organizationId });
};
