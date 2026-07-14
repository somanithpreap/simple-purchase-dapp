import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../db/prismaClient.js";
import { env } from "../../config/env.js";
import { getProvider } from "../../blockchain/contract.js";
import { HttpError } from "../../utils/httpError.js";
import type { RegisterInput, LoginInput } from "./schemas.js";
import type { Role } from "../../generated/prisma/enums.js";

const SALT_ROUNDS = 10;

function issueToken(userId: string, role: Role) {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError("Email already registered", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: input.role,
    },
  });

  return { user, token: issueToken(user.id, user.role) };
}

export async function getWalletBalance(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.walletAddress) {
    throw new HttpError("No wallet linked", 409);
  }
  const balanceWei = await getProvider().getBalance(user.walletAddress);
  return { walletAddress: user.walletAddress, balanceWei: balanceWei.toString() };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new HttpError("Invalid email or password", 401);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new HttpError("Invalid email or password", 401);
  }

  return { user, token: issueToken(user.id, user.role) };
}
