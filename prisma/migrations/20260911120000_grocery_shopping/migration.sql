-- Jeremy cleanse grocery table + member shopping checklists.

CREATE TABLE "ApprovedGroceryFood" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "whyGood" TEXT NOT NULL,
    "whyAvoid" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovedGroceryFood_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApprovedGroceryFood_category_idx" ON "ApprovedGroceryFood"("category");
CREATE INDEX "ApprovedGroceryFood_archivedAt_idx" ON "ApprovedGroceryFood"("archivedAt");

CREATE TABLE "MemberShoppingList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberShoppingList_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberShoppingList_userId_key" ON "MemberShoppingList"("userId");

ALTER TABLE "MemberShoppingList" ADD CONSTRAINT "MemberShoppingList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MemberShoppingListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "originalLabel" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "approvedFoodId" TEXT,
    "swapNote" TEXT,
    "trainstationized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberShoppingListItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemberShoppingListItem_listId_sortOrder_idx" ON "MemberShoppingListItem"("listId", "sortOrder");

ALTER TABLE "MemberShoppingListItem" ADD CONSTRAINT "MemberShoppingListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MemberShoppingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
