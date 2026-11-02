import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";
import { dailyEntries } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const dailyRouter = createRouter({
  year: authedQuery.input(z.object({ year: z.number().int().min(2000).max(2100) })).query(({ ctx, input }) =>
    getDb().query.dailyEntries.findMany({
      where: and(
        eq(dailyEntries.userId, ctx.user.id),
        gte(dailyEntries.entryDate, `${input.year}-01-01`),
        lte(dailyEntries.entryDate, `${input.year}-12-31`),
      ),
      orderBy: [dailyEntries.entryDate],
    }),
  ),
  save: authedQuery.input(z.object({
    entryDate: isoDate,
    words: z.number().int().min(0).max(1000000),
    income: z.number().min(0).max(100000000),
    platform: z.string().trim().max(100).optional(),
    workTitle: z.string().trim().max(255).optional(),
    note: z.string().trim().max(5000).optional(),
  })).mutation(async ({ ctx, input }) => {
    const values = {
      ...input,
      income: input.income.toFixed(2),
      platform: input.platform || null,
      workTitle: input.workTitle || null,
      note: input.note || null,
      userId: ctx.user.id,
    };
    await getDb().insert(dailyEntries).values(values).onDuplicateKeyUpdate({
      set: { ...values, updatedAt: new Date() },
    });
    return getDb().query.dailyEntries.findFirst({
      where: and(eq(dailyEntries.userId, ctx.user.id), eq(dailyEntries.entryDate, input.entryDate)),
    });
  }),
  remove: authedQuery.input(z.object({ entryDate: isoDate })).mutation(async ({ ctx, input }) => {
    await getDb().delete(dailyEntries).where(and(eq(dailyEntries.userId, ctx.user.id), eq(dailyEntries.entryDate, input.entryDate)));
    return { ok: true };
  }),
});
