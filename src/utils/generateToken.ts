import jwt, { SignOptions, Secret } from "jsonwebtoken";

export const generateToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET as Secret;
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES || "3h") as SignOptions['expiresIn'],
  };

  return jwt.sign({ id: userId }, secret, options);
};