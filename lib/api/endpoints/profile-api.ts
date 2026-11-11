import "server-only";
import { apiRequest } from "@/lib/api/client";

/** `GET/PATCH /users/me`: the signed-in user's own profile. No organization header. */
export type ProfileApi = { id: string; email: string | null; fullName: string | null };

export const getProfileApi = async () => (await apiRequest<ProfileApi>("/users/me")).data;

export const updateProfileApi = async (fullName: string) =>
  (await apiRequest<ProfileApi>("/users/me", { method: "PATCH", json: { fullName } })).data;
