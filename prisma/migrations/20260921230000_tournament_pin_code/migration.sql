-- Practice-mode-only soft privacy gate: a random PIN code for /t/[id] public pages.

ALTER TABLE "Tournament" ADD COLUMN "pinCode" TEXT;
