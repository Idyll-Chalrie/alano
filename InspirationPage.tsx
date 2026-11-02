import { useState } from "react";
import { Edit3, Plus, Trash2, X } from "lucide-react";
import { trpc } from "@/providers/trpc";

const colors = ["champagne", "lavender", "peach", "sage", "sky", "rose"] as const;
type Color = typeof colors[number];
type CardForm = { title: string; content: string; category: string; color: Color };
const blank: CardForm = { title: "", content: "", category: "灵感碎片", color: "champagne" };

export default function InspirationPage() {
  const utils = trpc.useUtils();
  const cards = trpc.inspiration.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CardForm>(blank);
  const [error, setError] = useState("");
  const done = async () => { await utils.inspiration.list.invalidate(); setOpen(false); setError(""); };
  const create = trpc.inspiration.create.useMutation({ onSuccess: done, onError: (e) => setError(e.message) });
  const update = trpc.inspiration.update.useMutation({ onSuccess: done, onError: (e) => setError(e.message) });
  const remove = trpc.inspiration.remove.useMutation({ onSuccess: () => utils.inspiration.list.invalidate() });
  const pending = create.isPending || update.isPending;

  function openCreate() { setEditingId(null); setForm(blank); setError(""); setOpen(true); }
  function openEdit(card: NonNullable<typeof cards.data>[number]) {
    setEditingId(card.id); setError("");
    setForm({ title: card.title, content: card.content, category: card.category, color: card.color as Color }); setOpen(true);
  }
  function submit() {
    if (!form.title.trim()) { setError("给这束灵感写一个标题吧。"); return; }
    if (editingId) update.mutate({ ...form, id: editingId }); else create.mutate(form);
  }

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">FRAGMENTS OF LIGHT · 灵感收集</p><h1 className="page-title">灵感卡片</h1><p className="page-description">一句话、一个人物、一场邂逅，都值得被认真收藏。</p></div>
        <button className="gold-button inline-flex items-center gap-2 px-4 py-2.5 text-xs" onClick={openCreate}><Plus size={16} />新建卡片</button>
      </header>
      {cards.error && <div className="error-banner">{cards.error.message}</div>}
      <div className="inspiration-grid">
        {cards.data?.map((card) => (
          <article key={card.id} className={`inspiration-card ${card.color}`} onClick={() => openEdit(card)}>
            <div className="card-top"><span className="card-category">{card.category}</span><span className="card-date">{new Date(card.createdAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}</span></div>
            <h3>{card.title}</h3><p>{card.content || "点击卡片，继续写下这束灵感……"}</p>
            <div className="card-bottom"><span>拾光 · 灵感簿</span><span className="flex gap-1">
              <button className="icon-button !w-7 !h-7" title="编辑卡片" onClick={(e) => { e.stopPropagation(); openEdit(card); }}><Edit3 size={12} /></button>
              <button className="icon-button !w-7 !h-7" title="删除卡片" onClick={(e) => { e.stopPropagation(); if (window.confirm("确定删除这张灵感卡片吗？")) remove.mutate({ id: card.id }); }}><Trash2 size={12} /></button>
            </span></div>
          </article>
        ))}
        <button className="new-card" onClick={openCreate}><span><Plus size={20} />收藏一束新灵感</span></button>
      </div>
      {!cards.isLoading && cards.data?.length === 0 && <p className="muted-note mt-5 text-center">第一张卡片已经为你留好位置。</p>}

      {open && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div className="modal-card">
          <div className="flex items-start justify-between"><h2 className="modal-title">{editingId ? "续写这束灵感" : "收藏一束新灵感"}</h2><button className="icon-button" onClick={() => setOpen(false)}><X size={15} /></button></div>
          {error && <div className="error-banner">{error}</div>}
          <div className="grid grid-cols-[1fr_140px] gap-3 mb-4">
            <label><span className="field-label">灵感标题</span><input autoFocus className="text-field" maxLength={255} placeholder="例如：雨夜里的第二把伞" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label><span className="field-label">分类</span><input className="text-field" maxLength={100} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
          </div>
          <label><span className="field-label">灵感内容</span><textarea className="text-field" rows={7} maxLength={10000} placeholder="记下人物、画面、冲突，或一句不想忘记的话……" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></label>
          <div className="mt-5"><span className="field-label">卡片颜色</span><div className="color-options">{colors.map((color) => <button key={color} aria-label={`选择${color}颜色`} className={`color-dot ${color} ${form.color === color ? "selected" : ""}`} onClick={() => setForm({ ...form, color })} />)}</div></div>
          <div className="modal-actions"><button className="soft-button px-4 py-2 text-xs" onClick={() => setOpen(false)}>取消</button><button disabled={pending} className="gold-button px-5 py-2 text-xs" onClick={submit}>{pending ? "保存中…" : "保存灵感"}</button></div>
        </div>
      </div>}
    </>
  );
}
