import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../db/prismaClient.js";
import { env } from "../../config/env.js";
import { generateWallet, fundNewWallet } from "../../blockchain/wallet.js";
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
  const wallet = generateWallet();

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: input.role,
      walletAddress: wallet.address,
      encryptedPrivateKey: wallet.encryptedPrivateKey,
    },
  });

  // Funds the custodial wallet so the user can pay gas for future purchase /
  // confirm-delivery transactions. Intentionally not swallowed: an unfunded
  // wallet would only fail later, at purchase time, in a more confusing way.
  await fundNewWallet(wallet.address);

  return { user, token: issueToken(user.id, user.role) };
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
