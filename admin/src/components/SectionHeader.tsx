import React from 'react';

interface SectionHeaderProps {
  title: string;
  icon: React.ElementType;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, icon: Icon }) => (
  <div className="flex items-center gap-3 mb-8">
    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
      <Icon size={20} />
    </div>
    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase tracking-[2px]">{title}</h2>
  </div>
);

export default SectionHeader;
