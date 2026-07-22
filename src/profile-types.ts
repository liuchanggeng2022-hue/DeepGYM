export interface UserProfile {
  userId: string;
  nickname: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  updatedAt: string;
}

export interface ProfileService {
  load(): Promise<UserProfile>;
  saveNickname(nickname: string): Promise<UserProfile>;
  uploadAvatar(file: File): Promise<UserProfile>;
  removeAvatar(): Promise<UserProfile>;
}
