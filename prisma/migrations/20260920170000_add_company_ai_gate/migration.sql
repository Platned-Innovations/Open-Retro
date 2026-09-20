-- Per-company opt-in for AI features.
--
-- Additive and defaulted off, so every existing company keeps the behaviour it
-- has: no retro content can reach a model provider until an admin of that
-- company turns this on.
ALTER TABLE "Company" ADD COLUMN "aiFeaturesEnabled" BOOLEAN NOT NULL DEFAULT false;
