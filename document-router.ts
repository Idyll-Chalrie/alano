import { generateObject } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { analysisDocuments, type StoryMap } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { storage } from "./lib/storage";
import {
  AiMisconfigured,
  AiTransient,
  AiUnavailable,
  ContentRejected,
  classifyAiError,
  listModels,
} from "./lib/ai-client";

const characterSchema = z.object({
  id: z.string(),
  name: z.string().max(100),
  role: z.string().max(500),
  desire: z.string().max(1000),
  conflict: z.string().max(1500),
});

const mapSchema = z.object({
  centralTitle: z.string().max(255),
  characters: z.array(characterSchema).max(12),
  hooks: z.object({
    intro: z.string().max(4000),
    conflict: z.string().max(4000),
    reversal: z.string().max(4000),
  }),
  synopsis: z.string().max(12000),
});

export function emptyStoryMap(title = "未命名短篇"): StoryMap {
  return {
    centralTitle: title,
    characters: [{ id: crypto.randomUUID(), name: "主要人物", role: "", desire: "", conflict: "" }],
    hooks: { intro: "", conflict: "", reversal: "" },
    synopsis: "",
  };
}

async function ownedDocument(id: number, userId: number) {
  return getDb().query.analysisDocuments.findFirst({
    where: and(eq(analysisDocuments.id, id), eq(analysisDocuments.userId, userId)),
  });
}

function aiMessage(error: unknown): never {
  const classified = classifyAiError(error);
  if (classified instanceof AiUnavailable) {
    throw new TRPCError({ code: "FORBIDDEN", message: "AI 额度已耗尽或当前权益不可用，请管理员充值后再试。" });
  }
  if (classified instanceof AiMisconfigured) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "AI 服务配置异常，请重新打开或发布站点后再试。" });
  }
  if (classified instanceof ContentRejected) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "文本未能通过内容检查，请调整后再试。" });
  }
  if (classified instanceof AiTransient) {
    throw new TRPCError({ code: "TIMEOUT", message: "AI 服务暂时不可用。为避免重复计费，请稍后手动重试。" });
  }
  throw new TRPCError({ code: "BAD_REQUEST", message: classified.message || "AI 分析未完成，请稍后重试。" });
}

export const documentRouter = createRouter({
  list: authedQuery.query(({ ctx }) =>
    getDb().query.analysisDocuments.findMany({
      where: eq(analysisDocuments.userId, ctx.user.id),
      orderBy: [desc(analysisDocuments.updatedAt)],
    }),
  ),
  create: authedQuery.input(z.object({ title: z.string().trim().min(1).max(255) })).mutation(async ({ ctx, input }) => {
    const [{ id }] = await getDb().insert(analysisDocuments).values({
      userId: ctx.user.id,
      title: input.title,
      mapData: emptyStoryMap(input.title),
    }).$returningId();
    return ownedDocument(id, ctx.user.id);
  }),
  upload: authedQuery.input(z.object({
    name: z.string().min(1).max(512),
    contentBase64: z.string(),
  })).mutation(async ({ ctx, input }) => {
    if (!input.name.toLowerCase().endsWith(".txt")) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "请上传 TXT 格式文件。" });
    }
    const bytes = Uint8Array.from(Buffer.from(input.contentBase64, "base64"));
    if (bytes.length === 0 || bytes.length > 3 * 1024 * 1024) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "TXT 文件需大于 0 且不超过 3 MB。" });
    }
    const saved = await storage.uploadFile({
      fileContent: bytes,
      fileName: `u/${ctx.user.id}/txt/${input.name}`,
      contentType: "text/plain; charset=utf-8",
    });
    const title = input.name.replace(/\.txt$/i, "").slice(0, 255) || "未命名短篇";
    const [{ id }] = await getDb().insert(analysisDocuments).values({
      userId: ctx.user.id,
      title,
      sourceName: input.name,
      sourceKey: saved.key,
      mapData: emptyStoryMap(title),
    }).$returningId();
    return ownedDocument(id, ctx.user.id);
  }),
  save: authedQuery.input(z.object({ id: z.number().int().positive(), title: z.string().trim().min(1).max(255), mapData: mapSchema })).mutation(async ({ ctx, input }) => {
    if (!(await ownedDocument(input.id, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });
    await getDb().update(analysisDocuments).set({ title: input.title, mapData: input.mapData, updatedAt: new Date() }).where(eq(analysisDocuments.id, input.id));
    return { ok: true, savedAt: new Date() };
  }),
  analyze: authedQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const doc = await ownedDocument(input.id, ctx.user.id);
    if (!doc?.sourceKey) throw new TRPCError({ code: "BAD_REQUEST", message: "请先上传这篇作品的 TXT 原文。" });
    let source: string;
    try {
      const bytes = await storage.readFile({ fileKey: doc.sourceKey });
      source = Buffer.from(bytes).toString("utf8").replace(/^\uFEFF/, "").trim();
    } catch {
      throw new TRPCError({ code: "NOT_FOUND", message: "原文文件暂时无法读取，请重新上传。" });
    }
    if (!source) throw new TRPCError({ code: "BAD_REQUEST", message: "TXT 中没有可分析的文本。" });
    try {
      const { defaultModelId } = await listModels();
      const provider = createOpenAICompatible({
        name: "kimi-gw",
        baseURL: process.env.KIMI_AGENTGW_BASE_URL!,
        apiKey: process.env.KIMI_AGENTGW_API_KEY!,
        supportsStructuredOutputs: true,
      });
      const { object } = await generateObject({
        model: provider(defaultModelId),
        schema: mapSchema,
        prompt: `你是一位短篇网文编辑。请基于原文，提炼为中文思维导图内容。主要人物最多 6 位；每位填写姓名、身份/性格、核心目标、人物冲突。钩子分导语、核心冲突、关键反转。剧情梗概须简洁但完整。不要补写原文没有的事实。人物 id 使用 c1、c2 等短字符串。\n\n作品名：${doc.title}\n\n原文：\n${source.slice(0, 60000)}`,
        providerOptions: { "kimi-gw": { max_completion_tokens: 6000 } },
      });
      await getDb().update(analysisDocuments).set({ mapData: object, updatedAt: new Date() }).where(eq(analysisDocuments.id, doc.id));
      return object;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      aiMessage(error);
    }
  }),
  remove: authedQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const doc = await ownedDocument(input.id, ctx.user.id);
    if (!doc) return { ok: true };
    await getDb().delete(analysisDocuments).where(eq(analysisDocuments.id, doc.id));
    if (doc.sourceKey) await storage.deleteFile({ fileKey: doc.sourceKey });
    return { ok: true };
  }),
});
