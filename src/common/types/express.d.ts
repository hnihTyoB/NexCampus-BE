declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        role: string;
        roleId?: string;
        permissions?: string[];
      };
    }
  }
}

export {};
