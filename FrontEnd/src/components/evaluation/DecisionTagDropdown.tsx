'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export type DecisionTagType = 'REVIEW' | 'SUBMIT' | 'REJECT';

interface DecisionTagDropdownProps {
  value: DecisionTagType;
  onChange: (newValue: DecisionTagType) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

interface TagConfig {
  label: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  badgeHover: string;
  badgeRing: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

const TAG_CONFIGS: Record<DecisionTagType, TagConfig> = {
  REVIEW: {
    label: 'REVIEW',
    badgeBg: 'bg-[#FEF9EE]',
    badgeBorder: 'border-[#FDE68A]',
    badgeText: 'text-[#92400E]',
    badgeHover: 'hover:bg-[#FEF3C7] hover:border-[#FCD34D]',
    badgeRing: 'focus:ring-amber-400/40',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    icon: (
      <svg className="w-3.5 h-3.5 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 22h14" />
        <path d="M5 2h14" />
        <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
        <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
      </svg>
    ),
  },
  SUBMIT: {
    label: 'SUBMIT',
    badgeBg: 'bg-[#ECFDF5]',
    badgeBorder: 'border-[#A7F3D0]',
    badgeText: 'text-[#065F46]',
    badgeHover: 'hover:bg-[#D1FAE5] hover:border-[#6EE7B7]',
    badgeRing: 'focus:ring-emerald-400/40',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
    icon: (
      <svg className="w-3.5 h-3.5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  REJECT: {
    label: 'REJECT',
    badgeBg: 'bg-[#FFF1F2]',
    badgeBorder: 'border-[#FECDD3]',
    badgeText: 'text-[#9F1239]',
    badgeHover: 'hover:bg-[#FFE4E6] hover:border-[#FDA4AF]',
    badgeRing: 'focus:ring-rose-400/40',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-700',
    icon: (
      <svg className="w-3.5 h-3.5 text-rose-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  },
};

const OPTIONS: Array<{ type: DecisionTagType; title: string; subtitle: string }> = [
  { type: 'REVIEW', title: 'Review', subtitle: 'Pending human verification' },
  { type: 'SUBMIT', title: 'Submit', subtitle: 'Accepted & ready for interview' },
  { type: 'REJECT', title: 'Reject', subtitle: 'Unsuitable or low criteria match' },
];

export default function DecisionTagDropdown({
  value,
  onChange,
  disabled = false,
  size = 'md',
}: DecisionTagDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentTag = TAG_CONFIGS[value] || TAG_CONFIGS.REVIEW;

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 190;
    
    // Calculate centered horizontal placement with viewport clamping
    let left = rect.left + rect.width / 2 - menuWidth / 2;
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    // Check if dropdown should open upwards if too close to bottom
    const openUpwards = rect.bottom + 180 > window.innerHeight && rect.top > 200;
    const top = openUpwards ? rect.top - 175 : rect.bottom + 6;

    setMenuPos({ top, left, width: menuWidth });
  }, []);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelect = (newType: DecisionTagType, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(newType);
    setIsOpen(false);
  };

  // Close when clicking outside or scrolling
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      setIsOpen(false);
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  return (
    <div className="inline-flex items-center justify-center relative select-none">
      {/* ── TRIGGER BUTTON ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleDropdown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title="Click to update decision: Review, Submit, or Reject"
        className={`group relative inline-flex items-center gap-2 rounded-full border shadow-2xs transition-all cursor-pointer outline-none focus:ring-2 ${
          currentTag.badgeBg
        } ${currentTag.badgeBorder} ${currentTag.badgeText} ${currentTag.badgeHover} ${
          currentTag.badgeRing
        } ${
          size === 'sm' ? 'px-3 py-1 text-[10px]' : 'px-3.5 py-1.5 text-[11px]'
        } font-black tracking-wider ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
      >
        {/* Crisp Icon */}
        <span className="flex-shrink-0 flex items-center justify-center transition-transform group-hover:scale-110">
          {currentTag.icon}
        </span>

        {/* Tag Label */}
        <span className="font-extrabold">{currentTag.label}</span>

        {/* Chevron Indicator */}
        <svg
          className={`w-3 h-3 text-current opacity-70 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── FLOATING POPOVER MENU (Rendered in Portal) ── */}
      {isOpen &&
        menuPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
              width: `${menuPos.width}px`,
              zIndex: 9999,
            }}
            className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-900/10 p-1.5 animate-in fade-in zoom-in-95 duration-150 select-none"
            role="listbox"
          >
            <div className="px-2 py-1 mb-1 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Decision Tag
              </span>
              <span className="text-[9px] text-slate-400 font-mono">Select</span>
            </div>

            <div className="space-y-0.5">
              {OPTIONS.map((opt) => {
                const isSelected = value === opt.type;
                const optConfig = TAG_CONFIGS[opt.type];

                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={(e) => handleSelect(opt.type, e)}
                    className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-slate-100/90 text-slate-900 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {/* Option Icon Pill */}
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${optConfig.iconBg}`}
                    >
                      {optConfig.icon}
                    </div>

                    {/* Option Text */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-black tracking-tight leading-none text-slate-900">
                        {opt.title}
                      </div>
                      <div className="text-[9px] text-slate-400 font-medium truncate mt-0.5">
                        {opt.subtitle}
                      </div>
                    </div>

                    {/* Checkmark indicator for selected */}
                    {isSelected && (
                      <svg
                        className="w-3.5 h-3.5 text-slate-900 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
