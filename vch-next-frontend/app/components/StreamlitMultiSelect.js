"use client";
import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

export default function StreamlitMultiSelect({ options = [], value = [], onChange, placeholder = "Choose options" }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when picking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleOption = (option) => {
    if (value.includes(option)) {
      onChange(value.filter(v => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  const handleRemove = (e, option) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== option));
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", fontFamily: "Inter, sans-serif" }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          minHeight: 38,
          background: "rgba(255,255,255,0.05)",
          border: isOpen ? "1px solid #43B3AE" : "1px solid rgba(67,179,174, 0.18)",
          borderRadius: 10,
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
          cursor: "pointer",
          transition: "all 0.2s",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)"
        }}
      >
        {value.length === 0 && (
          <span style={{ color: "#8EA39C", fontSize: 14, paddingLeft: 4, fontWeight: 600 }}>{placeholder}</span>
        )}
        
        {value.map(val => (
          <div key={val} style={{
            background: "rgba(67,179,174, 0.15)",
            border: "1px solid rgba(67,179,174, 0.3)",
            color: "#FFF",
            fontSize: 13,
            fontWeight: 700,
            padding: "3px 9px",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            gap: 6
          }}>
            {val}
            <div 
              onClick={(e) => handleRemove(e, val)}
              style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              <X size={12} color="#43B3AE" />
            </div>
          </div>
        ))}
        
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
          <ChevronDown size={14} color="#B4B4C0" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "0.2s" }} />
        </div>
      </div>

      {isOpen && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          marginTop: 4,
          background: "#201e24",
          border: "1px solid rgba(67,179,174,0.18)",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
          maxHeight: 250,
          overflowY: "auto",
          zIndex: 9999,
          padding: 4
        }}>
          {options.length === 0 ? (
            <div style={{ padding: "8px 12px", color: "#777", fontSize: 14 }}>No options available</div>
          ) : (
            options.map(option => {
              const isSelected = value.includes(option);
              return (
                <div
                  key={option}
                  onClick={() => handleToggleOption(option)}
                  style={{
                    padding: "8px 12px",
                    color: isSelected ? "#43B3AE" : "#FFF",
                    background: isSelected ? "rgba(67,179,174, 0.1)" : "transparent",
                    fontSize: 14,
                    fontWeight: isSelected ? 700 : 600,
                    cursor: "pointer",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center"
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {option}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}


