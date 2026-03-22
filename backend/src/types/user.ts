export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}
