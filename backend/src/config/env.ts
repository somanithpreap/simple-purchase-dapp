import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default("1h"),
  RPC_URL: z.string().min(1),
  // Exactly one of these two must be set -- CONTRACT_ADDRESS_FILE for the
  // local Hardhat-in-Docker flow (populated by the one-shot deploy
  // container), CONTRACT_ADDRESS for a network with no such deploy step
  // (e.g. Sepolia). Enforced at call time in blockchain/contract.ts, not
  // here, since they're substitutes rather than both-required.
  //
  // docker-compose.yml's `${CONTRACT_ADDRESS:-}` fallback produces an empty
  // string (not undefined) when unset, so empty string must normalize to
  // undefined here rather than fail `.min(1)`.
  CONTRACT_ADDRESS_FILE: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  CONTRACT_ADDRESS: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  // How long to poll for a client-submitted tx's receipt before giving up.
  // Hardhat mines instantly; Sepolia is ~12s/block, so this needs headroom
  // for real testnet confirmation times.
  TX_RECEIPT_TIMEOUT_MS: z.coerce.number().default(120000),
});

export const env = envSchema.parse(process.env);
