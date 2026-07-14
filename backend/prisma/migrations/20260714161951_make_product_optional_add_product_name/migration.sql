-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_productId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "productName" TEXT,
ALTER COLUMN "productId" DROP NOT NULL;

-- Backfill productName from the still-linked product before the column
-- becomes required, so existing orders aren't dropped by the NOT NULL below.
UPDATE "Order" o
SET "productName" = p."name"
FROM "Product" p
WHERE o."productId" = p."id";

ALTER TABLE "Order" ALTER COLUMN "productName" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
