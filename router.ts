import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { rankingRouter } from "./ranking-router";
import { documentRouter } from "./document-router";
import { inspirationRouter } from "./inspiration-router";
import { dailyRouter } from "./daily-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  ranking: rankingRouter,
  documents: documentRouter,
  inspiration: inspirationRouter,
  daily: dailyRouter,

  // TODO: add feature routers here, e.g.
  // todo: createRouter({
  //   list: publicQuery.query(() => findTodos()),
  // }),
});

export type AppRouter = typeof appRouter;
