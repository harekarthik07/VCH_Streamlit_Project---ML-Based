"use client";
import React from "react";

export default function StatusBadge({ 
  children, 
  variant = "green",
  className = "" 
}) {
  const variants = {
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
    red: {
      background: "rgba(255,75,75,0.15)",
      border: "1px solid rgba(255,75,75,0.4)",
      color: "#FF4B4B",
    },
    gray: {
      background: "rgba(128,128,128,0.15)",
      border: "1px solid rgba(128,128,128,0.3)",
      color: "#888",
    },
  };

  const style = variants[variant] || variants.gray;

  return (
    <span
      className={`badge ${className}`}
      style={{
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: 1,
        padding: "5px 10px",
        borderRadius: 8,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
