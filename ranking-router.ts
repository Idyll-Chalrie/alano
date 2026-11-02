import * as cheerio from "cheerio";
import iconv from "iconv-lite";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { rankingCollections, rankingEntries } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { fanqieFontMap } from "./fanqie-font-map";
import { log } from "./lib/logger";

type Platform = "zhihu" | "fanqie" | "jjwxc";
type Seed = { rank: number; title: string; author: string; category: string; heat: string; url: string };
const SOURCES: Record<Platform, { listName: string; sourceUrl: string }> = {
  zhihu: { listName: "盐选榜单 · 热度榜 · 言情", sourceUrl: "https://www.zhihu.com/fiore/h5/vip-web" },
  fanqie: { listName: "女频新书榜 · 古风世情", sourceUrl: "https://fanqienovel.com/rank/0_1_1139" },
  jjwxc: { listName: "晋江文学城 · 月度排行榜", sourceUrl: "https://www.jjwxc.net/topten.php?orderstr=5&t=0" },
};
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";

function chinaToday() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
async function getResponse(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/json" }, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`公开榜单响应 HTTP ${response.status}`);
  return response;
}

async function fetchJjwxc(): Promise<Seed[]> {
  const bytes = Buffer.from(await (await getResponse(SOURCES.jjwxc.sourceUrl)).arrayBuffer());
  const $ = cheerio.load(iconv.decode(bytes, "gb18030"));
  const rows: Seed[] = [];
  $("tr").each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length < 8) return;
    const rank = Number($(cells[0]).text().trim());
    const titleLink = $(cells[2]).find("a").first();
    const href = titleLink.attr("href") || "";
    if (!Number.isInteger(rank) || rank < 1 || rank > 10 || !href) return;
    rows.push({
      rank,
      author: $(cells[1]).text().trim(),
      title: titleLink.text().trim(),
      category: $(cells[3]).text().trim(),
      heat: `${$(cells[6]).text().trim()} 作品积分`,
      url: href.startsWith("//") ? `https:${href}` : new URL(href, SOURCES.jjwxc.sourceUrl).toString(),
    });
  });
  return rows.sort((a, b) => a.rank - b.rank).slice(0, 10);
}

type ZhihuItem = { title?: string; subtitle?: string; label_text?: string; url?: string };
type ZhihuTab = { head?: { type?: string }; content_list?: ZhihuItem[] };
async function fetchZhihu(): Promise<Seed[]> {
  const api = "https://api.zhihu.com/km-vip-zhihu-web/vip_tab/svip_story?modules=billboard";
  const payload = await (await getResponse(api)).json() as { data?: Array<{ module_data?: { data?: { data?: ZhihuTab[] } } }> };
  const tabs = payload.data?.[0]?.module_data?.data?.data || [];
  const items = tabs.find((tab) => tab.head?.type === "hot")?.content_list || [];
  return items.slice(0, 10).map((item, index) => ({
    rank: index + 1,
    title: item.title || "未命名作品",
    author: "榜单未披露",
    category: item.label_text || "言情",
    heat: item.subtitle || "未显示热度",
    url: item.url || SOURCES.zhihu.sourceUrl,
  }));
}

type FanqieBook = { bookName?: string; author?: string; read_count?: string; bookId?: string; currentPos?: number };
function decodeFanqie(value: string) {
  return [...value].map((char) => fanqieFontMap.get(char) || char).join("");
}
async function fetchFanqie(): Promise<Seed[]> {
  const html = await (await getResponse(SOURCES.fanqie.sourceUrl)).text();
  const fontFile = html.match(/awesome-font\/c\/([\w-]+)\.woff2/)?.[1];
  if (fontFile && fontFile !== "dc027189e0ba4cd") {
    throw new Error("番茄已更换动态字体，为避免保存错误书名，本次未采集");
  }
  const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});/s);
  if (!match) throw new Error("番茄榜单页面结构已变化");
  const state = JSON.parse(match[1]) as { rank?: { book_list?: FanqieBook[] } };
  const books = state.rank?.book_list || [];
  const rows = books.slice(0, 10).sort((a, b) => (a.currentPos || 0) - (b.currentPos || 0)).map((book, index) => ({
    rank: book.currentPos || index + 1,
    title: decodeFanqie(book.bookName || ""),
    author: decodeFanqie(book.author || ""),
    category: "古风世情",
    heat: `${book.read_count || "0"} 人在读`,
    url: book.bookId ? `https://fanqienovel.com/page/${book.bookId}` : SOURCES.fanqie.sourceUrl,
  }));
  if (rows.some((row) => /[\uE000-\uF8FF]/.test(row.title + row.author))) {
    throw new Error("番茄字体映射不完整，为避免保存乱码，本次未采集");
  }
  return rows;
}

const collectors = { zhihu: fetchZhihu, fanqie: fetchFanqie, jjwxc: fetchJjwxc };

async function collectPlatform(platform: Platform, snapshotDate = chinaToday()) {
  const source = SOURCES[platform];
  try {
    const entries = await collectors[platform]();
    if (!entries.length) throw new Error("公开榜单未返回可识别的作品");
    const status = entries.length < 10 ? "partial" : "success";
    const message = entries.length < 10 ? `原榜单当前仅展示 ${entries.length} 条，已按实际条数保存。` : null;
    await getDb().transaction(async (tx) => {
      await tx.delete(rankingEntries).where(and(eq(rankingEntries.platform, platform), eq(rankingEntries.snapshotDate, snapshotDate)));
      await tx.insert(rankingEntries).values(entries.map((entry) => ({ ...entry, platform, snapshotDate, listName: source.listName })));
      await tx.insert(rankingCollections).values({ platform, snapshotDate, ...source, status, entriesCount: entries.length, message });
    });
    return { platform, ok: true, count: entries.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "采集失败";
    await getDb().insert(rankingCollections).values({ platform, snapshotDate, ...source, status: "failed", entriesCount: 0, message });
    log.error("ranking collection failed", { platform, message });
    return { platform, ok: false, message };
  }
}

let collecting: Promise<unknown> | null = null;
export function refreshRankings() {
  if (!collecting) {
    collecting = Promise.all((["zhihu", "fanqie", "jjwxc"] as Platform[]).map((platform) => collectPlatform(platform))).finally(() => { collecting = null; });
  }
  return collecting;
}

export async function ensureDailyRankings() {
  const today = chinaToday();
  const existing = await getDb().query.rankingCollections.findMany({
    where: and(eq(rankingCollections.snapshotDate, today), ne(rankingCollections.status, "failed")),
  });
  const collected = new Set(existing.map((collection) => collection.platform));
  const missing = (["zhihu", "fanqie", "jjwxc"] as Platform[]).some((platform) => !collected.has(platform));
  if (missing) await refreshRankings();
}

export const rankingRouter = createRouter({
  latest: authedQuery.query(async () => {
    const groups = [];
    for (const platform of ["zhihu", "fanqie", "jjwxc"] as Platform[]) {
      const collection = await getDb().query.rankingCollections.findFirst({
        where: and(eq(rankingCollections.platform, platform), ne(rankingCollections.status, "failed")),
        orderBy: [desc(rankingCollections.snapshotDate), desc(rankingCollections.createdAt)],
      });
      const latestAttempt = await getDb().query.rankingCollections.findFirst({
        where: eq(rankingCollections.platform, platform),
        orderBy: [desc(rankingCollections.createdAt)],
      });
      const entries = collection ? await getDb().query.rankingEntries.findMany({
        where: and(eq(rankingEntries.platform, platform), eq(rankingEntries.snapshotDate, collection.snapshotDate)),
        orderBy: [rankingEntries.rank],
      }) : [];
      groups.push({ platform, ...SOURCES[platform], collection: collection || null, latestAttempt: latestAttempt || null, entries });
    }
    return { groups, today: chinaToday() };
  }),
  refresh: authedQuery.input(z.object({}).optional()).mutation(async () => {
    await refreshRankings();
    return { ok: true };
  }),
});
