import { useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Coins, PenLine, Trash2, X } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { trpc } from "@/providers/trpc";

function keyOf(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function money(value: number) { return value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
type EntryForm = { words: string; income: string; platform: string; workTitle: string; note: string };
const blankForm: EntryForm = { words: "0", income: "0", platform: "", workTitle: "", note: "" };

export default function IncomePage() {
  const now = new Date();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const year = month.getFullYear();
  const entriesQuery = trpc.daily.year.useQuery({ year }, { refetchOnWindowFocus: false });
  const entries = useMemo(() => entriesQuery.data || [], [entriesQuery.data]);
  const utils = trpc.useUtils();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [form, setForm] = useState<EntryForm>(blankForm);
  const [error, setError] = useState("");
  const invalidate = async () => { await utils.daily.year.invalidate(); };
  const save = trpc.daily.save.useMutation({ onSuccess: async () => { await invalidate(); setSelectedDate(null); }, onError: (e) => setError(e.message) });
  const remove = trpc.daily.remove.useMutation({ onSuccess: async () => { await invalidate(); setSelectedDate(null); }, onError: (e) => setError(e.message) });

  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.entryDate, entry])), [entries]);
  const monthPrefix = `${year}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const monthEntries = entries.filter((entry) => entry.entryDate.startsWith(monthPrefix));
  const monthIncome = monthEntries.reduce((sum, entry) => sum + Number(entry.income), 0);
  const monthWords = monthEntries.reduce((sum, entry) => sum + entry.words, 0);
  const daysInMonth = new Date(year, month.getMonth() + 1, 0).getDate();
  const monthChart = Array.from({ length: daysInMonth }, (_, index) => {
    const key = `${monthPrefix}-${String(index + 1).padStart(2, "0")}`;
    return { day: `${index + 1}日`, income: Number(entryMap.get(key)?.income || 0), words: entryMap.get(key)?.words || 0 };
  });
  const yearChart = Array.from({ length: 12 }, (_, index) => ({
    month: `${index + 1}月`,
    income: entries.filter((entry) => entry.entryDate.startsWith(`${year}-${String(index + 1).padStart(2, "0")}`)).reduce((sum, entry) => sum + Number(entry.income), 0),
  }));
  const calendarDays = useMemo(() => {
    const offset = (month.getDay() + 6) % 7;
    const start = new Date(year, month.getMonth(), 1 - offset);
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [month, year]);

  function openEntry(key: string) {
    const entry = entryMap.get(key); setError(""); setSelectedDate(key);
    setForm(entry ? { words: String(entry.words), income: String(entry.income), platform: entry.platform || "", workTitle: entry.workTitle || "", note: entry.note || "" } : blankForm);
  }
  function submit() {
    if (!selectedDate) return;
    const words = Number(form.words), income = Number(form.income);
    if (!Number.isInteger(words) || words < 0 || !Number.isFinite(income) || income < 0) { setError("字数需为非负整数，收入需为非负数字。"); return; }
    save.mutate({ entryDate: selectedDate, words, income, platform: form.platform, workTitle: form.workTitle, note: form.note });
  }

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">THE FRUIT OF WORDS · 写作收获</p><h1 className="page-title">收入统计</h1><p className="page-description">每一个被记录的日子，都在让热爱变得清晰可见。</p></div>
        <button className="gold-button inline-flex items-center gap-2 px-4 py-2.5 text-xs" onClick={() => openEntry(keyOf(now))}><PenLine size={15} />记录今日</button>
      </header>
      {entriesQuery.error && <div className="error-banner">{entriesQuery.error.message}</div>}
      <div className="stat-grid">
        <section className="glass-panel stat-card"><span>本月收入</span><strong><small>¥</small>{money(monthIncome)}</strong><em>每一行文字，都有回响</em></section>
        <section className="glass-panel stat-card"><span>本月写作</span><strong>{monthWords.toLocaleString()}<small>字</small></strong><em>{monthEntries.length} 天留下了写作记录</em></section>
        <section className="glass-panel stat-card"><span>有记录日均</span><strong>{Math.round(monthWords / (monthEntries.length || 1)).toLocaleString()}<small>字 / 天</small></strong><em>不求快，只求一直在写</em></section>
      </div>
      <div className="ledger-layout">
        <section className="glass-panel calendar-panel">
          <div className="panel-heading"><div><h2>{year} 年 {month.getMonth() + 1} 月</h2><p>点击日期，记录当日字数与收入</p></div><div className="flex gap-2"><button className="icon-button" aria-label="上个月" onClick={() => setMonth(new Date(year, month.getMonth() - 1, 1))}><ChevronLeft size={15} /></button><button className="icon-button" aria-label="下个月" onClick={() => setMonth(new Date(year, month.getMonth() + 1, 1))}><ChevronRight size={15} /></button></div></div>
          <div className="calendar-week">{["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day}>周{day}</span>)}</div>
          <div className="calendar-grid">{calendarDays.map((day) => {
            const key = keyOf(day), entry = entryMap.get(key), outside = day.getMonth() !== month.getMonth();
            return <button key={key} className={`calendar-day ${outside ? "outside" : ""} ${key === keyOf(now) ? "today" : ""}`} onClick={() => openEntry(key)}><span className="day-number">{day.getDate()}</span>{entry && <span className="day-data"><span className="day-words">{entry.words.toLocaleString()} 字</span><span className="day-income">¥ {money(Number(entry.income))}</span></span>}</button>;
          })}</div>
        </section>
        <section className="glass-panel chart-panel">
          <div className="panel-heading"><div><h2>本月收入曲线</h2><p>每日收入的变化与节奏</p></div><Coins size={18} className="text-[#b88a49]" /></div>
          <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={monthChart} margin={{ top: 12, right: 8, bottom: 0, left: -20 }}><CartesianGrid stroke="#e9dfd1" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="day" tick={{ fill: "#a59889", fontSize: 9 }} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(daysInMonth / 7))} /><YAxis tick={{ fill: "#a59889", fontSize: 9 }} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => [`¥ ${money(Number(value))}`, "收入"]} contentStyle={{ border: "1px solid #eadbc5", borderRadius: 12, background: "rgba(255,253,248,.95)", fontSize: 11 }} /><Line type="monotone" dataKey="income" stroke="#b78a4c" strokeWidth={2.2} dot={false} activeDot={{ r: 4, fill: "#b78a4c", stroke: "#fff", strokeWidth: 2 }} /></LineChart></ResponsiveContainer></div>
        </section>
      </div>
      <section className="glass-panel trend-panel">
        <div className="panel-heading"><div><h2>{year} 年收入趋势</h2><p>把零散的日常，写成长期的坚持</p></div><BarChart3 size={18} className="text-[#b88a49]" /></div>
        <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={yearChart} margin={{ top: 10, right: 15, bottom: 0, left: -10 }}><CartesianGrid stroke="#e9dfd1" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="month" tick={{ fill: "#a59889", fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis tick={{ fill: "#a59889", fontSize: 9 }} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => [`¥ ${money(Number(value))}`, "月收入"]} contentStyle={{ border: "1px solid #eadbc5", borderRadius: 12, background: "rgba(255,253,248,.95)", fontSize: 11 }} /><Line type="monotone" dataKey="income" stroke="#aa91b7" strokeWidth={2.3} dot={{ r: 3, fill: "#fff", stroke: "#aa91b7", strokeWidth: 2 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div>
      </section>

      {selectedDate && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedDate(null); }}><div className="modal-card">
        <div className="flex items-start justify-between"><div><p className="eyebrow">DAILY ENTRY</p><h2 className="modal-title">{selectedDate} 的写作记录</h2></div><button className="icon-button" onClick={() => setSelectedDate(null)}><X size={15} /></button></div>
        {error && <div className="error-banner">{error}</div>}
        <div className="grid grid-cols-2 gap-3 mb-4"><label><span className="field-label">写作字数</span><input className="text-field" type="number" min="0" step="1" value={form.words} onChange={(e) => setForm({ ...form, words: e.target.value })} /></label><label><span className="field-label">当日收入（元）</span><input className="text-field" type="number" min="0" step="0.01" value={form.income} onChange={(e) => setForm({ ...form, income: e.target.value })} /></label></div>
        <div className="grid grid-cols-2 gap-3 mb-4"><label><span className="field-label">平台（选填）</span><input className="text-field" placeholder="例如：知乎盐选" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} /></label><label><span className="field-label">作品（选填）</span><input className="text-field" placeholder="作品名称" value={form.workTitle} onChange={(e) => setForm({ ...form, workTitle: e.target.value })} /></label></div>
        <label><span className="field-label">今日小记（选填）</span><textarea className="text-field" rows={4} placeholder="今天的状态、进展或一点小确幸……" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        <div className="modal-actions justify-between"><div>{entryMap.has(selectedDate) && <button className="inline-flex items-center gap-1 border-0 bg-transparent px-0 text-xs text-[#b47a6e]" onClick={() => { if (window.confirm("删除这一天的记录吗？")) remove.mutate({ entryDate: selectedDate }); }}><Trash2 size={13} />删除记录</button>}</div><div className="flex gap-2"><button className="soft-button px-4 py-2 text-xs" onClick={() => setSelectedDate(null)}>取消</button><button className="gold-button px-5 py-2 text-xs" disabled={save.isPending} onClick={submit}>{save.isPending ? "保存中…" : "保存记录"}</button></div></div>
      </div></div>}
    </>
  );
}
