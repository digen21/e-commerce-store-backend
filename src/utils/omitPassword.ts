import { IUser } from "@types";

/**
 * Omits the password field from a user object
 * @param user - The user object to sanitize
 * @returns A new object without the password field
 */
export const omitPassword = <T extends Partial<IUser>>(
  user: T,
): Omit<T, "password"> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userWithoutPassword } = user as T & {
    password?: string;
  };
  return userWithoutPassword as Omit<T, "password">;
};

/**
 * Omits the password field from an array of user objects
 * @param users - Array of user objects to sanitize
 * @returns Array of objects without the password field
 */
export const omitPasswordFromArray = <T extends Partial<IUser>>(
  users: T[],
): Omit<T, "password">[] => {
  return users.map((user) => omitPassword(user));
};
