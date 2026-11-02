import { useAuth } from "@/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import { BarChart3, BookOpenText, ChevronRight, Lightbulb, LogOut, Menu, PenLine, Sparkles, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { AuthLayoutSkeleton } from "./AuthLayoutSkeleton";
import { Button } from "./ui/button";

const navigation = [
  { label: "今日榜单", path: "/rankings", icon: BookOpenText, caption: "看见故事风向" },
  { label: "拆文助手", path: "/analysis", icon: PenLine, caption: "读懂好故事" },
  { label: "灵感卡片", path: "/inspiration", icon: Lightbulb, caption: "收藏每束微光" },
  { label: "收入统计", path: "/income", icon: BarChart3, caption: "记录写作果实" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { isLoading, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (isLoading) return <AuthLayoutSkeleton />;
  if (!user) {
    return (
      <div className="login-scene">
        <div className="login-orbit" />
        <div className="glass-panel login-card">
          <div className="brand-mark"><Sparkles size={23} /></div>
          <p className="eyebrow">YOUR STORY, YOUR LIGHT</p>
          <h1>拾光写作台</h1>
          <p>把灵感、故事与每一份写作收获，温柔地收在一起。</p>
          <Button size="lg" className="gold-button w-full" onClick={() => { window.location.href = LOGIN_PATH; }}>
            使用 Kimi 登录 <ChevronRight size={17} />
          </Button>
          <small>个人内容将安全地保存在你的工作台中</small>
        </div>
      </div>
    );
  }

  const sidebar = (
    <>
      <div className="sidebar-brand">
        <div className="brand-mark"><Sparkles size={21} /></div>
        <div><strong>拾光写作台</strong><span>SHIGUANG STUDIO</span></div>
      </div>
      <div className="sidebar-section-label">我的写作空间</div>
      <nav className="sidebar-nav">
        {navigation.map((item) => (
          <NavLink key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon"><item.icon size={19} strokeWidth={1.7} /></span>
            <span><strong>{item.label}</strong><small>{item.caption}</small></span>
            <ChevronRight className="nav-arrow" size={15} />
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-quote">
        <span>“</span>
        <p>故事不是等待来的，<br />是一个字一个字点亮的。</p>
      </div>
      <div className="sidebar-user">
        <div className="user-avatar">{user.name?.slice(0, 1) || "写"}</div>
        <div><strong>{user.name || "写作者"}</strong><span>今天也写下一行吧</span></div>
        <button aria-label="退出登录" title="退出登录" onClick={logout}><LogOut size={16} /></button>
      </div>
    </>
  );

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">{sidebar}</aside>
      <div className={`mobile-sidebar-backdrop ${mobileOpen ? "show" : ""}`} onClick={() => setMobileOpen(false)} />
      <aside className={`mobile-sidebar ${mobileOpen ? "show" : ""}`}>
        <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="关闭菜单"><X size={20} /></button>
        {sidebar}
      </aside>
      <main className="workspace-main">
        <div className="mobile-topbar">
          <button onClick={() => setMobileOpen(true)} aria-label="打开菜单"><Menu size={21} /></button>
          <strong>{navigation.find((item) => item.path === location.pathname)?.label || "拾光写作台"}</strong>
          <Sparkles size={18} />
        </div>
        <div className="ambient ambient-one" /><div className="ambient ambient-two" />
        <div className="page-container">{children}</div>
      </main>
    </div>
  );
}
