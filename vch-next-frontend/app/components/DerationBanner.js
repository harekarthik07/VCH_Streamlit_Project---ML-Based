"use client";
import React from "react";

export default function DerationBanner({ message, className = "" }) {
  return (
    <div className={`deration-banner ${className}`}>
      {message}
    </div>
  );
}
