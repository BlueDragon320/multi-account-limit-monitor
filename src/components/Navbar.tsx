import React from 'react';
import { Flame, Plus, Layers, Database, History, Sliders } from 'lucide-react';

export type NavTab = 'overview' | 'accounts' | 'projects' | 'settings';

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenLogUsage: () => void;
}

const TABS: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: Layers },
  { id: 'accounts', label: 'Accounts & Limits', icon: Database },
  { id: 'projects', label: 'Projects & History', icon: History },
  { id: 'settings', label: 'Settings & Data', icon: Sliders },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenLogUsage,
}) => {
  return (
    <header className="px-4 w-full">
      <nav
        className="navbar-bounded"
        aria-label="Main Navigation"
      >
        {/* Brand / Logo */}
        <button
          onClick={() => onSelectTab('overview')}
          className="flex items-center gap-2.5 text-left border-0 bg-transparent cursor-pointer p-1 group focus:outline-none"
          aria-label="Quota Ember Home"
        >
          <div className="w-7 h-7 rounded-full bg-[#201f1d] border border-[#FF6543] flex items-center justify-center text-[#FF6542] shadow-[0_0_12px_rgba(255,101,66,0.3)] transition-transform group-hover:scale-105">
            <Flame className="w-4 h-4 fill-[#FF6542]" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-[13px] tracking-tight text-[#FBFAF9] flex items-center gap-1.5 font-mono">
              QUOTA<span className="text-[#FF6542] font-semibold">EMBER</span>
            </span>
            <span className="text-[10px] text-[#898580] tracking-widest uppercase font-mono leading-none">
              Control Panel
            </span>
          </div>
        </button>

        {/* Tab Navigation */}
        <div
          role="tablist"
          className="flex items-center gap-1 bg-[#181818] p-1 rounded-full border border-[#2e2c29]"
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
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-mono transition-all border-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#252422] text-[#FBFAF9] font-medium shadow-sm'
                    : 'text-[#898580] hover:text-[#FBFAF9] hover:bg-[#201f1d] bg-transparent'
                }`}
              >
                {isActive && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[#FF6542] inline-block shadow-[0_0_6px_#FF6542]"
                    aria-hidden="true"
                  />
                )}
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#FF6542]' : 'text-[#898580]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenLogUsage}
            className="btn-nav-coral focus:outline-none focus:ring-2 focus:ring-[#FF6542] focus:ring-offset-2 focus:ring-offset-[#181818]"
            title="Log usage against one or more limit windows"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Log Usage</span>
          </button>
        </div>
      </nav>
    </header>
  );
};
