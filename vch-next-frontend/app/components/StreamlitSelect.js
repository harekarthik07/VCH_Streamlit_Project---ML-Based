"use client";
import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export default function StreamlitSelect({ options = [], value, onChange, placeholder = "Choose option" }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange(option);
    setIsOpen(false);
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
          gap: 6,
          cursor: "pointer",
          transition: "all 0.2s",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)"
        }}
      >
        {!value || value === "" ? (
          <span style={{ color: "#8EA39C", fontSize: 14, paddingLeft: 4, fontWeight: 600 }}>{placeholder}</span>
        ) : (
          <span style={{ color: "#FFF", fontSize: 14, paddingLeft: 4, fontWeight: 700 }}>{value}</span>
        )}
        
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
              const isSelected = value === option;
              return (
                <div
                  key={option}
                  onClick={() => handleSelect(option)}
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


