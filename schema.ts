import {
  bigint,
  date,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type StoryCharacter = {
  id: string;
  name: string;
  role: string;
  desire: string;
  conflict: string;
};

export type StoryMap = {
  centralTitle: string;
  characters: StoryCharacter[];
  hooks: { intro: string; conflict: string; reversal: string };
  synopsis: string;
};

export const rankingCollections = mysqlTable(
  "ranking_collections",
  {
    id: serial("id").primaryKey(),
    platform: mysqlEnum("platform", ["zhihu", "fanqie", "jjwxc"]).notNull(),
    listName: varchar("listName", { length: 255 }).notNull(),
    sourceUrl: text("sourceUrl").notNull(),
    snapshotDate: date("snapshotDate", { mode: "string" }).notNull(),
    status: mysqlEnum("status", ["success", "partial", "failed"]).notNull(),
    entriesCount: int("entriesCount").notNull().default(0),
    message: text("message"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    platformDateIdx: index("ranking_platform_date_idx").on(table.platform, table.snapshotDate),
  }),
);

export const rankingEntries = mysqlTable(
  "ranking_entries",
  {
    id: serial("id").primaryKey(),
    platform: mysqlEnum("platform", ["zhihu", "fanqie", "jjwxc"]).notNull(),
    listName: varchar("listName", { length: 255 }).notNull(),
    snapshotDate: date("snapshotDate", { mode: "string" }).notNull(),
    rank: int("rank").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    author: varchar("author", { length: 255 }).notNull(),
    category: varchar("category", { length: 255 }).notNull(),
    heat: varchar("heat", { length: 255 }).notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    platformDateRank: uniqueIndex("ranking_platform_date_rank").on(
      table.platform,
      table.snapshotDate,
      table.rank,
    ),
  }),
);

export const analysisDocuments = mysqlTable(
  "analysis_documents",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    sourceName: varchar("sourceName", { length: 512 }),
    sourceKey: varchar("sourceKey", { length: 1024 }),
    mapData: json("mapData").$type<StoryMap>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({ userIdx: index("analysis_user_idx").on(table.userId) }),
);

export const inspirationCards = mysqlTable(
  "inspiration_cards",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    category: varchar("category", { length: 100 }).notNull().default("灵感碎片"),
    color: varchar("color", { length: 20 }).notNull().default("champagne"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({ userIdx: index("inspiration_user_idx").on(table.userId) }),
);

export const dailyEntries = mysqlTable(
  "daily_entries",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    entryDate: date("entryDate", { mode: "string" }).notNull(),
    words: int("words").notNull().default(0),
    income: decimal("income", { precision: 12, scale: 2 }).notNull().default("0.00"),
    platform: varchar("platform", { length: 100 }),
    workTitle: varchar("workTitle", { length: 255 }),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    userDate: uniqueIndex("daily_user_date").on(table.userId, table.entryDate),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type RankingEntry = typeof rankingEntries.$inferSelect;
export type AnalysisDocument = typeof analysisDocuments.$inferSelect;
export type InspirationCard = typeof inspirationCards.$inferSelect;
export type DailyEntry = typeof dailyEntries.$inferSelect;
