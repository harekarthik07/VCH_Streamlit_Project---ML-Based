"use client";
import React, { useState } from "react";

export default function TabGroup({ tabs, defaultTab, onChange, className = "" }) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.label);

  const handleTabClick = (label) => {
    setActiveTab(label);
    if (onChange) onChange(label);
  };

  return (
    <div className={`tab-container ${className}`} style={{ display: "flex", gap: 8 }}>
      {tabs.map((tab) => (
        <button
          key={tab.label}
          className={`tab-button ${activeTab === tab.label ? "active" : ""}`}
          onClick={() => handleTabClick(tab.label)}
        >
          {tab.icon && <span style={{ marginRight: 6 }}>{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
