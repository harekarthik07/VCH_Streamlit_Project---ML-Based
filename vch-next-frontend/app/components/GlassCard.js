"use client";
import React from "react";

export default function GlassCard({
  children,
  className = "",
  hoverable = true,
  accentColor = "green",
  style = {},
  ...props
}) {
  const accentColors = {
    green: {
      border: "rgba(0, 204, 150, 0.3)",
      hoverBorder: "rgba(0, 204, 150, 0.5)",
      shadow: "rgba(0, 204, 150, 0.15)",
    },
    purple: {
      border: "rgba(171, 99, 250, 0.3)",
      hoverBorder: "rgba(171, 99, 250, 0.5)",
      shadow: "rgba(171, 99, 250, 0.15)",
    },
    gold: {
      border: "rgba(255, 215, 0, 0.3)",
      hoverBorder: "rgba(255, 215, 0, 0.5)",
      shadow: "rgba(255, 215, 0, 0.15)",
    },
    red: {
      border: "rgba(255, 75, 75, 0.3)",
      hoverBorder: "rgba(255, 75, 75, 0.5)",
      shadow: "rgba(255, 75, 75, 0.15)",
    },
  };

  const colors = accentColors[accentColor] || accentColors.green;

  return (
    <div
      className={`glass-card ${className}`}
      style={{
        background: "rgba(25, 25, 30, 0.4)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderTop: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: 16,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (hoverable) {
          e.currentTarget.style.transform = "translateY(-5px)";
          e.currentTarget.style.boxShadow = `0 10px 25px ${colors.shadow}`;
          e.currentTarget.style.borderTopColor = colors.hoverBorder;
        }
      }}
      onMouseLeave={(e) => {
        if (hoverable) {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.5)";
          e.currentTarget.style.borderTopColor = "rgba(255, 255, 255, 0.15)";
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
}
