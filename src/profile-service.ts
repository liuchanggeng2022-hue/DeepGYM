import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileService, UserProfile } from "./profile-types";

const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_SECONDS = 60 * 60;
const AVATAR_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

interface ProfileRow {
  id: string;
  nickname: string;
  avatar_path: string | null;
  updated_at: string;
}

function profileError(reason: unknown) {
  if (reason instanceof Error) return reason;
  if (reason && typeof reason === "object" && "message" in reason) {
    return new Error(String((reason as { message: unknown }).message));
  }
  return new Error(String(reason || "个人资料操作失败，请重试。"));
}

function validateNickname(value: string) {
  const nickname = value.trim();
  if (!nickname) throw new Error("昵称不能为空。");
  if ([...nickname].length > 30) throw new Error("昵称最多 30 个字符。");
  return nickname;
}

function validateAvatar(file: File) {
  const extension = AVATAR_TYPES.get(file.type);
  if (!extension) throw new Error("头像仅支持 JPG、PNG 或 WebP 图片。");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("头像大小不能超过 5 MB。");
  return extension;
}

export function createProfileService(client: SupabaseClient, userId: string): ProfileService {
  const signedAvatarUrl = async (path: string | null) => {
    if (!path) return null;
    const { data, error } = await client.storage.from(AVATAR_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
    if (error) throw profileError(error);
    return data.signedUrl;
  };

  const hydrate = async (row: ProfileRow): Promise<UserProfile> => ({
    userId: row.id,
    nickname: row.nickname || "",
    avatarPath: row.avatar_path,
    avatarUrl: await signedAvatarUrl(row.avatar_path),
    updatedAt: row.updated_at,
  });

  const getRow = async () => {
    const { data, error } = await client
      .from("profiles")
      .select("id,nickname,avatar_path,updated_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw profileError(error);
    if (data) return data as ProfileRow;

    const { data: created, error: createError } = await client
      .from("profiles")
      .upsert({ id: userId, nickname: "" }, { onConflict: "id" })
      .select("id,nickname,avatar_path,updated_at")
      .single();
    if (createError) throw profileError(createError);
    return created as ProfileRow;
  };

  const saveProfile = async (patch: { nickname?: string; avatar_path?: string | null }) => {
    const { data, error } = await client
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select("id,nickname,avatar_path,updated_at")
      .single();
    if (error) throw profileError(error);
    return hydrate(data as ProfileRow);
  };

  return {
    async load() {
      return hydrate(await getRow());
    },

    async saveNickname(value: string) {
      return saveProfile({ nickname: validateNickname(value) });
    },

    async uploadAvatar(file: File) {
      const extension = validateAvatar(file);
      const current = await getRow();
      const path = `${userId}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await client.storage.from(AVATAR_BUCKET).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw profileError(uploadError);

      try {
        const profile = await saveProfile({ avatar_path: path });
        if (current.avatar_path && current.avatar_path !== path) {
          void client.storage.from(AVATAR_BUCKET).remove([current.avatar_path]);
        }
        return profile;
      } catch (reason) {
        void client.storage.from(AVATAR_BUCKET).remove([path]);
        throw reason;
      }
    },

    async removeAvatar() {
      const current = await getRow();
      const profile = await saveProfile({ avatar_path: null });
      if (current.avatar_path) {
        const { error } = await client.storage.from(AVATAR_BUCKET).remove([current.avatar_path]);
        if (error) throw profileError(error);
      }
      return profile;
    },
  };
}
