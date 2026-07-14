-- AlterTable
ALTER TABLE "User" DROP COLUMN "encryptedPrivateKey";
ALTER TABLE "User" ALTER COLUMN "walletAddress" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "walletNonce" TEXT;
ALTER TABLE "User" ADD COLUMN "walletNonceIssuedAt" TIMESTAMP(3);
