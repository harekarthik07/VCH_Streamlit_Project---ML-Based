"use client";
import React from "react";

export default function NavCard({
  children,
  badge,
  badgeColor = "green",
  className = "",
  style = {},
  ...props
}) {
  const badgeStyles = {
    green: {
      background: "rgba(0,204,150,0.15)",
      border: "1px solid rgba(0,204,150,0.4)",
      color: "#00CC96",
    },
    purple: {
      background: "rgba(171,99,250,0.15)",
      border: "1px solid rgba(171,99,250,0.4)",
      color: "#ab63fa",
    },
    gold: {
      background: "rgba(255,215,0,0.15)",
      border: "1px solid rgba(255,215,0,0.4)",
      color: "#FFD700",
    },
  };

  const badgeStyle = badgeStyles[badgeColor] || badgeStyles.green;

  return (
    <div
      className={`nav-card ${className}`}
      style={{
        "--card-accent-border": badgeStyle.border,
        ...style,
      }}
      {...props}
    >
      {badge && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 24,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 1,
              padding: "5px 10px",
              borderRadius: 8,
              ...badgeStyle,
            }}
          >
            {badge}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
