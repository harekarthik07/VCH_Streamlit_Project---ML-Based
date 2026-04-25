"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Zap,
  LayoutDashboard,
  Activity,
  Route,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldAlert,
  UploadCloud
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Master App", icon: LayoutDashboard, section: "VCH SYSTEMS" },
  { href: "/dyno", label: "Dyno Suite", icon: Activity, section: "DYNO SUITE" },
  { href: "/road", label: "Road Suite", icon: Route, section: "ROAD SUITE" },
  { href: "/admin", label: "Admin Zone", icon: ShieldAlert, section: "ADMINISTRATION" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [username, setUsername] = useState("admin");

  useEffect(() => {
    setIsMounted(true);
    const stored = window?.localStorage?.getItem("vch-auth");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.username) setUsername(parsed.username);
      } catch {
        // ignore
      }
    }
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("vch-auth");
    }
    router.push("/login");
  };

  return (
    <aside
      className="sidebar"
      style={{
        width: collapsed ? 80 : 260,
        minHeight: "100vh",
        flexShrink: 0,
        backgroundColor: "#0b0c10",
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
        padding: "30px 20px",
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box"
      }}
    >
      {/* Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 34,
          whiteSpace: "nowrap",
        }}
      >
        <Zap
          size={18}
          style={{ color: "#00CC96", flexShrink: 0 }}
        />
        {!collapsed && (
          <span
            style={{
              color: "#00CC96",
              fontSize: "1rem",
              fontWeight: 800,
              letterSpacing: "0.12em",
            }}
          >
            VCH SYSTEMS
          </span>
        )}
      </div>

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        {NAV_ITEMS.map((item, index) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const showSection = !collapsed && (index === 0 || NAV_ITEMS[index - 1].section !== item.section);
          return (
            <React.Fragment key={item.href}>
              {showSection && (
                <div
                  style={{
                    color: "#cfd3dd",
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.16em",
                    opacity: 0.9,
                    marginTop: index === 0 ? 2 : 10,
                    marginBottom: 4,
                    paddingLeft: 10,
                    textTransform: "uppercase",
                  }}
                >
                  {item.section}
                </div>
              )}
              <Link
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 14px",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 14,
                  whiteSpace: "nowrap",
                  color: isActive ? "#f4fff9" : "#B4B4C0",
                  background: isActive ? "rgba(0, 204, 150, 0.12)" : "transparent",
                  border: isActive ? "1px solid rgba(0, 204, 150, 0.12)" : "1px solid transparent",
                  borderLeft: isActive ? "4px solid #00CC96" : "4px solid transparent",
                  opacity: isActive ? 1 : 0.82,
                  transition: "all 0.25s ease",
                  boxShadow: isActive ? "0 0 12px rgba(0, 204, 150, 0.15)" : "none",
                }}
              >
                {isActive && (
                  <span
                    style={{
                      position: "absolute",
                      left: 14,
                      color: "#00CC96",
                      textShadow: "0 0 8px #00CC96, 0 0 15px #00CC96",
                      fontSize: "0.5rem",
                      marginRight: 0,
                    }}
                  >
                    ●
                  </span>
                )}
                <Icon 
                  size={18} 
                  style={{ 
                    flexShrink: 0, 
                    color: isActive ? "#00CC96" : "#a2aab9",
                    filter: isActive ? "drop-shadow(0 0 4px rgba(0, 204, 150, 0.5))" : "none"
                  }} 
                />
                {!collapsed && item.label}
              </Link>
            </React.Fragment>
          );
        })}
      </nav>

      {!collapsed && (
        <div style={{ color: "#A0A0AB", fontSize: 13, marginBottom: 12 }}>
          Logged in as: <span style={{ color: "#00CC96", fontWeight: 700 }}>{isMounted ? username : "admin"}</span>
        </div>
      )}

      <button
        onClick={handleLogout}
        style={{
          width: "fit-content",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: collapsed ? "8px" : "9px 14px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.02)",
          color: "#ebeef5",
          cursor: "pointer",
          marginBottom: 56,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,75,75,0.1)";
          e.currentTarget.style.borderColor = "rgba(255,75,75,0.3)";
          e.currentTarget.style.color = "#FF4B4B";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.02)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
          e.currentTarget.style.color = "#ebeef5";
        }}
      >
        <LogOut size={15} />
        {!collapsed && "Logout"}
      </button>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: "absolute",
          bottom: 20,
          right: collapsed ? "50%" : 16,
          transform: collapsed ? "translateX(50%)" : "none",
          background: "rgba(45, 45, 51, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: 8,
          padding: "6px 8px",
          cursor: "pointer",
          color: "#B4B4C0",
          display: "flex",
          alignItems: "center",
          transition: "all 0.3s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(0,204,150,0.1)";
          e.currentTarget.style.borderColor = "#00CC96";
          e.currentTarget.style.color = "#00CC96";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(45, 45, 51, 0.6)";
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
          e.currentTarget.style.color = "#B4B4C0";
        }}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
