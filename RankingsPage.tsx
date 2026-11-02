import { useState } from "react";
import { ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { trpc } from "@/providers/trpc";

const platformNames = { zhihu: "知乎盐选", fanqie: "番茄小说", jjwxc: "晋江文学城" };

export default function RankingsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading, error, refetch } = trpc.ranking.latest.useQuery(undefined, { refetchOnWindowFocus: false });
  const [message, setMessage] = useState("");
  const refresh = trpc.ranking.refresh.useMutation({
    onSuccess: async () => { await utils.ranking.latest.invalidate(); setMessage("三个公开榜单已重新检查，采集结果见各榜单下方。"); },
    onError: (err) => setMessage(err.message),
  });

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">DAILY DISCOVERY · 每日观察</p>
          <h1 className="page-title">今日榜单</h1>
          <p className="page-description">沿着热度，看见读者正在为什么样的故事停留。</p>
        </div>
        <button className="gold-button inline-flex items-center gap-2 px-4 py-2.5 text-xs" disabled={refresh.isPending} onClick={() => { setMessage(""); refresh.mutate({}); }}>
          <RefreshCw size={15} className={refresh.isPending ? "spin" : ""} />{refresh.isPending ? "正在采集…" : "刷新榜单"}
        </button>
      </header>
      <div className="ranking-meta"><span className="live-dot" /><span>{data?.today || "今日"} · 公开榜单元数据</span><span>点击作品即可前往原阅读页</span></div>
      {(message || error) && <div className="error-banner">{message || error?.message}</div>}
      {isLoading ? (
        <div className="glass-panel empty-state"><Sparkles className="animate-pulse text-[#b88a49]" /><h3>正在翻开今日榜单</h3><p>首次启动采集可能需要一点时间。</p></div>
      ) : (
        <div className="ranking-grid">
          {data?.groups.map((group) => (
            <section className="glass-panel ranking-column" key={group.platform}>
              <div className="ranking-column-head">
                <div className={`platform-seal ${group.platform}`}>{platformNames[group.platform].slice(0, 1)}</div>
                <div><h2>{platformNames[group.platform]}</h2><p>{group.listName}</p></div>
                <span className="rank-count">{group.entries.length} 部作品</span>
              </div>
              <div className="ranking-list">
                {group.entries.map((entry) => (
                  <a className="ranking-item" href={entry.url} target="_blank" rel="noreferrer" key={entry.id} title={`阅读《${entry.title}》`}>
                    <span className="rank-number">{String(entry.rank).padStart(2, "0")}</span>
                    <div className="ranking-copy">
                      <h3 className="ranking-title">{entry.title}<ExternalLink size={11} /></h3>
                      <p className="ranking-byline">{entry.author} · {entry.snapshotDate}</p>
                      <div className="ranking-tags"><span className="ranking-category">{entry.category}</span><span className="ranking-heat">{entry.heat}</span></div>
                    </div>
                  </a>
                ))}
                {!group.entries.length && <div className="empty-state" style={{ minHeight: 280 }}><Sparkles size={24} /><h3>暂无可展示的快照</h3><p>点击上方“刷新榜单”重试。采集失败时不会写入虚构作品。</p></div>}
              </div>
              {(group.collection?.message || (group.latestAttempt?.status === "failed" && group.latestAttempt.message)) && (
                <div className="ranking-status">{group.latestAttempt?.status === "failed" ? `最近采集：${group.latestAttempt.message}` : group.collection?.message}</div>
              )}
            </section>
          ))}
        </div>
      )}
      <p className="muted-note mt-5">榜单名称按原页面口径标注；知乎当前榜单若不足十条，将按实际条数保留。作者与热度仅展示来源公开提供的信息。</p>
      <button className="hidden" onClick={() => refetch()} aria-hidden="true" tabIndex={-1} />
    </>
  );
}
