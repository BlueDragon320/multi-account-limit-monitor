import React from 'react';
import { Flame, Plus, Layers, Database, History, Sliders, Lock } from 'lucide-react';

export type NavTab = 'overview' | 'accounts' | 'projects' | 'settings';

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenLogUsage: () => void;
  onLock?: () => void;
}

const TABS: { id: NavTab; label: string; shortLabel: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'Overview', icon: Layers },
  { id: 'accounts', label: 'Accounts & Limits', shortLabel: 'Accounts', icon: Database },
  { id: 'projects', label: 'Projects & History', shortLabel: 'Projects', icon: History },
  { id: 'settings', label: 'Settings & Data', shortLabel: 'Settings', icon: Sliders },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenLogUsage,
  onLock,
}) => {
  return (
    <header className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      <nav
        className="navbar-bounded w-full flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 p-2.5 sm:px-5 sm:py-3"
        aria-label="Main Navigation"
      >
        {/* Brand / Logo */}
        <button
          onClick={() => onSelectTab('overview')}
          className="flex items-center gap-3 text-left border-0 bg-transparent cursor-pointer p-1 group outline-none focus:outline-none appearance-none shrink-0"
          aria-label="Quota Ember Home"
        >
          <div className="w-8 h-8 rounded-full bg-[#1C1917] border border-[#D4F268] flex items-center justify-center text-[#D4F268] shadow-[0_0_14px_rgba(212,242,104,0.25)] transition-all group-hover:scale-105">
            <Flame className="w-4 h-4 fill-[#D4F268]" />
          </div>
          <div className="flex flex-col">
            <span className="font-sans font-semibold text-[14px] tracking-tight text-[#E7E5E4] flex items-center gap-1">
              QUOTA<span className="text-[#D4F268] font-normal italic font-serif text-[17px]">EMBER</span>
            </span>
            <span className="tech-tag text-[10px] text-[#A8A29E] leading-none">
              Fig. 01 • Control Panel
            </span>
          </div>
        </button>

        {/* Tab Navigation */}
        <div
          role="tablist"
          className="order-3 lg:order-2 w-full lg:w-auto flex items-center justify-around lg:justify-center gap-1 bg-[#141210] p-1 rounded-full border border-[rgba(255,255,255,0.08)]"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectTab(tab.id)}
                className={`relative flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-[13px] font-sans cursor-pointer flex-1 lg:flex-initial transition-all ${
                  isActive
                    ? 'bg-[#292524] text-[#E7E5E4] border border-[rgba(212,242,104,0.4)] shadow-[0_0_10px_rgba(212,242,104,0.15)] font-medium px-3 sm:px-4 py-1.5 sm:py-2 rounded-full'
                    : 'text-[#A8A29E] hover:text-[#E7E5E4] hover:bg-[#1C1917] px-2.5 sm:px-3.5 py-1.5 rounded-full border border-transparent bg-transparent'
                }`}
              >
                {isActive && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[#D4F268] inline-block shadow-[0_0_6px_#D4F268]"
                    aria-hidden="true"
                  />
                )}
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#D4F268]' : 'text-[#A8A29E]'}`} />
                <span className="hidden lg:inline">{tab.label}</span>
                <span className="inline lg:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Action Button & Session Lock */}
        <div className="order-2 lg:order-3 flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenLogUsage}
            className="btn-primary-lime text-xs sm:text-[13px] font-sans font-semibold focus:outline-none focus:ring-2 focus:ring-[#D4F268] focus:ring-offset-2 focus:ring-offset-[#0C0A09]"
            title="Log usage against one or more limit windows"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Log Usage</span>
          </button>

          {onLock && (
            <button
              onClick={onLock}
              className="w-8 h-8 rounded-full bg-[#141210] hover:bg-[#292524] text-[#A8A29E] hover:text-[#D4F268] border border-[rgba(255,255,255,0.08)] flex items-center justify-center transition-colors cursor-pointer"
              title="Lock Terminal"
              aria-label="Lock Terminal"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </nav>
    </header>
  );
};
