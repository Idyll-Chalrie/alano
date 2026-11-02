import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, Controls, Handle, Position, applyNodeChanges, type Edge, type Node, type NodeProps, type OnNodesChange, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FileText, Network, Plus, Sparkles, Trash2, Upload, WandSparkles } from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { StoryCharacter, StoryMap } from "@contracts/types";

type FlowData = Record<string, unknown> & {
  label: string;
  kind: "root" | "group" | "character" | "hook" | "synopsis";
  value?: string;
  character?: StoryCharacter;
  onChange?: (value: string) => void;
  onCharacterChange?: (field: keyof StoryCharacter, value: string) => void;
};
type FlowNode = Node<FlowData>;

function StoryNode({ data }: NodeProps<FlowNode>) {
  return <div className={`mind-node ${data.kind}`}>
    <Handle type="target" position={Position.Left} />
    <span className="node-label">{data.label}</span>
    {data.kind === "character" && data.character ? <div>
      <textarea aria-label="人物名称" className="node-input nodrag" rows={1} placeholder="人物名称" value={data.character.name} onChange={(e) => data.onCharacterChange?.("name", e.target.value)} />
      <div className="node-divider" />
      <textarea aria-label="身份与性格" className="node-input small nodrag" rows={2} placeholder="身份 / 性格" value={data.character.role} onChange={(e) => data.onCharacterChange?.("role", e.target.value)} />
      <textarea aria-label="核心目标" className="node-input small nodrag" rows={2} placeholder="核心目标" value={data.character.desire} onChange={(e) => data.onCharacterChange?.("desire", e.target.value)} />
      <textarea aria-label="人物冲突" className="node-input small nodrag" rows={2} placeholder="人物冲突" value={data.character.conflict} onChange={(e) => data.onCharacterChange?.("conflict", e.target.value)} />
    </div> : data.kind !== "group" ? <textarea aria-label={data.label} className="node-input nodrag" rows={data.kind === "synopsis" ? 7 : data.kind === "hook" ? 5 : 2} placeholder={data.kind === "root" ? "作品名称" : "点击填充具体内容……"} value={data.value || ""} onChange={(e) => data.onChange?.(e.target.value)} /> : null}
    <Handle type="source" position={Position.Right} />
  </div>;
}
const nodeTypes = { story: StoryNode };
const emptyMap = (title: string): StoryMap => ({ centralTitle: title, characters: [{ id: crypto.randomUUID(), name: "主要人物", role: "", desire: "", conflict: "" }], hooks: { intro: "", conflict: "", reversal: "" }, synopsis: "" });

export default function AnalysisPage() {
  const utils = trpc.useUtils();
  const documents = trpc.documents.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = documents.data?.find((doc) => doc.id === selectedId);
  const [map, setMap] = useState<StoryMap>(() => emptyMap("我的短篇"));
  const [title, setTitle] = useState("我的短篇");
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [saveState, setSaveState] = useState("已保存");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const skipSave = useRef(true);
  const layoutKey = useRef("");
  const flowInstance = useRef<ReactFlowInstance<FlowNode, Edge> | null>(null);
  const utilsInvalidate = async () => { await utils.documents.list.invalidate(); };
  const create = trpc.documents.create.useMutation({ onSuccess: async (doc) => { if (doc) setSelectedId(doc.id); await utilsInvalidate(); setCreating(false); setNewTitle(""); }, onError: (e) => setError(e.message) });
  const upload = trpc.documents.upload.useMutation({ onSuccess: async (doc) => { if (doc) setSelectedId(doc.id); await utilsInvalidate(); }, onError: (e) => setError(e.message) });
  const save = trpc.documents.save.useMutation({ onSuccess: () => setSaveState("已自动保存"), onError: (e) => { setSaveState("保存失败"); setError(e.message); } });
  const analyze = trpc.documents.analyze.useMutation({ onSuccess: async (object) => { setMap(object); skipSave.current = false; await utilsInvalidate(); }, onError: (e) => setError(e.message) });
  const remove = trpc.documents.remove.useMutation({ onSuccess: async () => { setSelectedId(null); await utilsInvalidate(); }, onError: (e) => setError(e.message) });

  useEffect(() => {
    if (!selectedId && documents.data?.length) setSelectedId(documents.data[0].id);
  }, [documents.data, selectedId]);
  useEffect(() => {
    if (!selected) return;
    skipSave.current = true; setTitle(selected.title); setMap(selected.mapData); setError("");
  }, [selectedId, selected]);
  useEffect(() => {
    if (!selectedId || !selected) return;
    if (skipSave.current) { skipSave.current = false; return; }
    setSaveState("正在保存…");
    const timer = window.setTimeout(() => save.mutate({ id: selectedId, title: title.trim() || "未命名短篇", mapData: map }), 900);
    return () => window.clearTimeout(timer);
  }, [map, title, selectedId]);

  const patchCharacter = useCallback((id: string, field: keyof StoryCharacter, value: string) => {
    setMap((current) => ({ ...current, characters: current.characters.map((character) => character.id === id ? { ...character, [field]: value } : character) }));
  }, []);
  const builtNodes = useMemo<FlowNode[]>(() => {
    if (!selected) return [];
    const hookTop = Math.max(310, map.characters.length * 280 + 40);
    const synopsisTop = hookTop + 500;
    const result: FlowNode[] = [{
      id: "root", type: "story", position: { x: 20, y: Math.max(390, synopsisTop / 2) },
      data: { label: "作品", kind: "root", value: map.centralTitle, onChange: (value) => { setMap((m) => ({ ...m, centralTitle: value })); setTitle(value); } },
    }, {
      id: "characters", type: "story", position: { x: 290, y: 20 }, data: { label: "人设", kind: "group" },
    }, {
      id: "hooks", type: "story", position: { x: 290, y: hookTop + 90 }, data: { label: "钩子", kind: "group" },
    }, {
      id: "synopsis", type: "story", position: { x: 290, y: synopsisTop }, data: { label: "剧情梗概", kind: "group" },
    }];
    map.characters.forEach((character, index) => result.push({
      id: `character-${character.id}`, type: "story", position: { x: 550, y: index * 280 },
      data: { label: `人物 ${String(index + 1).padStart(2, "0")}`, kind: "character", character, onCharacterChange: (field, value) => patchCharacter(character.id, field, value) },
    }));
    ([
      ["intro", "导语", hookTop], ["conflict", "冲突", hookTop + 190], ["reversal", "反转", hookTop + 380],
    ] as const).forEach(([key, label, y]) => result.push({
      id: `hook-${key}`, type: "story", position: { x: 550, y },
      data: { label, kind: "hook", value: map.hooks[key], onChange: (value) => setMap((m) => ({ ...m, hooks: { ...m.hooks, [key]: value } })) },
    }));
    result.push({ id: "synopsis-leaf", type: "story", position: { x: 550, y: synopsisTop + 130 }, data: { label: "起承转合", kind: "synopsis", value: map.synopsis, onChange: (value) => setMap((m) => ({ ...m, synopsis: value })) } });
    return result;
  }, [map, selected, patchCharacter]);
  useEffect(() => {
    const nextLayoutKey = `${selectedId ?? "none"}:${map.characters.length}`;
    const resetLayout = layoutKey.current !== nextLayoutKey;
    layoutKey.current = nextLayoutKey;
    setNodes((current) => builtNodes.map((node) => ({
      ...node,
      position: !resetLayout && current.find((item) => item.id === node.id)?.position || node.position,
    })));
    if (resetLayout) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        void flowInstance.current?.fitView({ padding: .15, maxZoom: .85 });
      }));
    }
  }, [builtNodes, map.characters.length, selectedId]);
  const edges = useMemo<Edge[]>(() => [
    { id: "e-root-characters", source: "root", target: "characters", type: "smoothstep" },
    { id: "e-root-hooks", source: "root", target: "hooks", type: "smoothstep" },
    { id: "e-root-synopsis", source: "root", target: "synopsis", type: "smoothstep" },
    ...map.characters.map((character) => ({ id: `e-character-${character.id}`, source: "characters", target: `character-${character.id}`, type: "smoothstep" })),
    ...["intro", "conflict", "reversal"].map((key) => ({ id: `e-hook-${key}`, source: "hooks", target: `hook-${key}`, type: "smoothstep" })),
    { id: "e-synopsis", source: "synopsis", target: "synopsis-leaf", type: "smoothstep" },
  ], [map.characters]);
  const onNodesChange: OnNodesChange<FlowNode> = useCallback((changes) => setNodes((current) => applyNodeChanges(changes, current)), []);

  async function handleFile(file?: File) {
    if (!file) return;
    setError("");
    if (file.size > 3 * 1024 * 1024) { setError("TXT 文件不能超过 3 MB。上传与 AI 分析可能需等待约十秒。 "); return; }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = ""; const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    upload.mutate({ name: file.name, contentBase64: btoa(binary) });
    if (fileInput.current) fileInput.current.value = "";
  }
  function addCharacter() {
    setMap((current) => ({ ...current, characters: [...current.characters, { id: crypto.randomUUID(), name: `人物 ${current.characters.length + 1}`, role: "", desire: "", conflict: "" }] }));
  }

  return <>
    <header className="page-header">
      <div><p className="eyebrow">STORY ANATOMY · 短篇拆解</p><h1 className="page-title">拆文助手</h1><p className="page-description">从人设到钩子，把一个好故事的光，拆成看得见的路径。</p></div>
      {selected && <span className="pill"><Network size={12} />拖动节点 · 滚轮缩放 · 点击填写</span>}
    </header>
    {error && <div className="error-banner">{error}</div>}
    <div className="analysis-layout">
      <aside className="glass-panel document-panel">
        <div className="document-actions"><button className="soft-button inline-flex items-center gap-1" onClick={() => setCreating(!creating)}><Plus size={13} />空白导图</button><button className="soft-button inline-flex items-center gap-1" disabled={upload.isPending} onClick={() => fileInput.current?.click()}><Upload size={13} />{upload.isPending ? "上传中…" : "上传 TXT"}</button></div>
        <input ref={fileInput} type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        {creating && <div className="mb-3 flex gap-1"><input autoFocus className="text-field !p-2 !text-[10px]" placeholder="作品名称" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) create.mutate({ title: newTitle.trim() }); }} /><button className="gold-button px-2 text-[10px]" disabled={!newTitle.trim() || create.isPending} onClick={() => create.mutate({ title: newTitle.trim() })}>创建</button></div>}
        <div className="document-list">{documents.data?.map((doc) => <button key={doc.id} className={`document-item ${doc.id === selectedId ? "active" : ""}`} onClick={() => setSelectedId(doc.id)}><strong>{doc.title}</strong><span>{doc.sourceName ? "TXT 原文 · " : "手动拆解 · "}{new Date(doc.updatedAt).toLocaleDateString("zh-CN")}</span></button>)}</div>
        {!documents.isLoading && !documents.data?.length && <p className="muted-note p-3 text-center">新建空白导图，或上传 TXT 开始。</p>}
      </aside>
      <section className="glass-panel mindmap-panel">
        {selected ? <>
          <div className="mindmap-toolbar">
            <input className="doc-title-input" aria-label="导图作品名称" value={title} onChange={(e) => { setTitle(e.target.value); setMap((m) => ({ ...m, centralTitle: e.target.value })); }} />
            <span className="save-status">{saveState}</span>
            <button className="soft-button inline-flex items-center gap-1 px-3 py-2 text-[10px]" onClick={addCharacter} disabled={map.characters.length >= 12}><Plus size={13} />人物</button>
            {selected.sourceKey && <button className="gold-button inline-flex items-center gap-1 px-3 py-2 text-[10px]" disabled={analyze.isPending} title="AI 分析会消耗站点所有者的模型额度" onClick={() => { setError(""); if (window.confirm("AI 将分析已上传的原文并填充导图，当前已填写内容会被替换。此调用会产生模型额度消耗，是否继续？")) analyze.mutate({ id: selected.id }); }}><WandSparkles size={13} className={analyze.isPending ? "animate-pulse" : ""} />{analyze.isPending ? "AI 拆文中…" : "AI 填充"}</button>}
            <button className="icon-button" title="删除此导图" onClick={() => { if (window.confirm("确定删除这篇拆文及已上传的原文吗？")) remove.mutate({ id: selected.id }); }}><Trash2 size={14} /></button>
          </div>
          <div className="mindmap-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onInit={(instance) => { flowInstance.current = instance; }} fitView fitViewOptions={{ padding: .15, maxZoom: .85 }} minZoom={.2} maxZoom={1.5} proOptions={{ hideAttribution: true }}><Controls showInteractive={false} /></ReactFlow></div>
        </> : <div className="empty-state"><FileText size={32} className="text-[#b89460]" /><h3>让故事的结构，在眼前展开</h3><p>新建空白导图自由填充，或上传 TXT 后使用 AI 生成初稿。AI 调用会消耗站点所有者的模型额度。</p><button className="gold-button inline-flex items-center gap-2 px-4 py-2 text-xs" onClick={() => fileInput.current?.click()}><Sparkles size={14} />上传第一篇短篇</button></div>}
      </section>
    </div>
  </>;
}
