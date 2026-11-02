import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { inspirationCards } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";

const cardInput = z.object({
  title: z.string().trim().min(1).max(255),
  content: z.string().trim().max(10000),
  category: z.string().trim().min(1).max(100),
  color: z.enum(["champagne", "lavender", "peach", "sage", "sky", "rose"]),
});

async function ownedCard(id: number, userId: number) {
  return getDb().query.inspirationCards.findFirst({
    where: and(eq(inspirationCards.id, id), eq(inspirationCards.userId, userId)),
  });
}

export const inspirationRouter = createRouter({
  list: authedQuery.query(({ ctx }) =>
    getDb().query.inspirationCards.findMany({
      where: eq(inspirationCards.userId, ctx.user.id),
      orderBy: [desc(inspirationCards.updatedAt)],
    }),
  ),
  create: authedQuery.input(cardInput).mutation(async ({ ctx, input }) => {
    const [{ id }] = await getDb().insert(inspirationCards).values({ ...input, userId: ctx.user.id }).$returningId();
    return getDb().query.inspirationCards.findFirst({ where: eq(inspirationCards.id, id) });
  }),
  update: authedQuery.input(cardInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    if (!(await ownedCard(input.id, ctx.user.id))) return null;
    await getDb().update(inspirationCards).set({
      title: input.title,
      content: input.content,
      category: input.category,
      color: input.color,
      updatedAt: new Date(),
    }).where(eq(inspirationCards.id, input.id));
    return ownedCard(input.id, ctx.user.id);
  }),
  remove: authedQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await getDb().delete(inspirationCards).where(and(eq(inspirationCards.id, input.id), eq(inspirationCards.userId, ctx.user.id)));
    return { ok: true };
  }),
});
