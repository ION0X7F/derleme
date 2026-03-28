ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "companyName" TEXT;
ALTER TABLE "User" ADD COLUMN "storeName" TEXT;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
