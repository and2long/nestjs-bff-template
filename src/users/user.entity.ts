export interface UserEntity {
  id: number;
  uid: string;
  provider: string;
  displayName: string | null;
  email: string | null;
  isAnonymous: boolean;
  credits: number;
  createdAt: string;
  updatedAt: string;
}
