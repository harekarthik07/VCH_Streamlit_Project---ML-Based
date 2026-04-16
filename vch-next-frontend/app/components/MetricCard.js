"use client";
import React from "react";

const statusColors = {
  safe: {
    border: "rgba(0,204,150,0.6)",
    text: "#00CC96",
    shadow: "rgba(0,204,150,0.08)",
    gradient: "linear-gradient(160deg, rgba(0,204,150,0.1) 0%, rgba(0,204,150,0.01) 100%)",
    hoverShadow: "rgba(0, 204, 150, 0.1)",
  },
  breach: {
    border: "rgba(255,75,75,0.6)",
    text: "#FF4B4B",
    shadow: "rgba(255,75,75,0.08)",
    gradient: "linear-gradient(160deg, rgba(255,75,75,0.1) 0%, rgba(255,75,75,0.01) 100%)",
    hoverShadow: "rgba(255, 75, 75, 0.1)",
  },
  gold: {
    border: "rgba(255,215,0,0.6)",
    text: "#FFD700",
    shadow: "rgba(255,215,0,0.08)",
    gradient: "linear-gradient(160deg, rgba(255,215,0,0.1) 0%, rgba(255,215,0,0.01) 100%)",
    hoverShadow: "rgba(255, 215, 0, 0.1)",
  },
};

export default function MetricCard({
  title,
  value,
  unit = "",
  subtitle,
  status = "default",
  limit,
  limitUnit = "",
  isHighlighted = false,
  className = "",
  style = {},
  children,
}) {
  const getStatus = () => {
    if (isHighlighted) return "gold";
    return status;
  };

  const currentStatus = getStatus();
  const colors = statusColors[currentStatus] || statusColors.safe;

  return (
    <div
      className={`metric-card ${currentStatus} ${className}`}
      style={{
        background: colors.gradient,
        borderTopWidth: currentStatus === "default" ? "1px" : "2px",
        borderTopColor: currentStatus === "default" ? "rgba(255, 255, 255, 0.2)" : colors.border,
        boxShadow: currentStatus === "default" ? "0 4px 16px rgba(0, 0, 0, 0.4)" : `0 4px 16px ${colors.shadow}`,
        ...style,
      }}
    >
      <div className="metric-title">{title}</div>
      
      <div
        className="metric-value"
        style={{ color: currentStatus === "default" ? "#FFFFFF" : colors.text }}
      >
        {value}
        {unit && <span style={{ fontSize: "0.6em", marginLeft: 4, opacity: 0.8 }}>{unit}</span>}
      </div>

      {subtitle && (
        <div className="metric-sub">{subtitle}</div>
      )}

      {limit !== undefined && (
        <div
          className="metric-sub"
          style={{
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            marginTop: 8,
            paddingTop: 5,
          }}
        >
          Limit: {limit}{limitUnit} |{" "}
          <span style={{ color: colors.text, fontWeight: 700 }}>
            {status === "breach" ? "⚠️ BREACH" : status === "gold" ? "⭐ PEAK" : "✅ SAFE"}
          </span>
        </div>
      )}

      {children}
    </div>
  );
}
