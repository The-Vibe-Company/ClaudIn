/**
 * Search Filters Component
 * Advanced filtering for CRM profiles
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter,
  X,
  MapPin,
  Briefcase,
  Building2,
  Users,
  ChevronDown,
  Check
} from 'lucide-react';

export interface SearchFiltersState {
  location: string;
  company: string;
  title: string;
  syncStatus: 'all' | 'synced' | 'partial';
  hasMessages: 'any' | 'yes' | 'no';
  hasPosts: 'any' | 'yes' | 'no';
}

const defaultFilters: SearchFiltersState = {
  location: '',
  company: '',
  title: '',
  syncStatus: 'all',
  hasMessages: 'any',
  hasPosts: 'any',
};

interface SearchFiltersProps {
  filters: SearchFiltersState;
  onFiltersChange: (filters: SearchFiltersState) => void;
}

export function SearchFilters({ filters, onFiltersChange }: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'syncStatus') return value !== 'all';
    if (key === 'hasMessages' || key === 'hasPosts') return value !== 'any';
    return value !== '';
  }).length;

  const handleReset = () => {
    onFiltersChange(defaultFilters);
  };

  const updateFilter = <K extends keyof SearchFiltersState>(
    key: K,
    value: SearchFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="relative">
      {/* Filter toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all
          ${isOpen || activeFilterCount > 0
            ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/30'
            : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary border border-border-subtle'
          }
        `}
      >
        <Filter className="w-4 h-4" />
        Filters
        {activeFilterCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-accent-primary text-white text-xs">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Filter panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-80 bg-bg-secondary border border-border-subtle rounded-xl shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <span className="text-sm font-semibold text-text-primary">Filter Profiles</span>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleReset}
                    className="text-xs text-accent-primary hover:underline"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded hover:bg-bg-tertiary text-text-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter fields */}
            <div className="p-4 space-y-4">
              {/* Text filters */}
              <div className="space-y-3">
                <FilterInput
                  icon={MapPin}
                  label="Location"
                  value={filters.location}
                  onChange={(v) => updateFilter('location', v)}
                  placeholder="e.g., San Francisco"
                />
                <FilterInput
                  icon={Building2}
                  label="Company"
                  value={filters.company}
                  onChange={(v) => updateFilter('company', v)}
                  placeholder="e.g., Google"
                />
                <FilterInput
                  icon={Briefcase}
                  label="Title"
                  value={filters.title}
                  onChange={(v) => updateFilter('title', v)}
                  placeholder="e.g., Engineer"
                />
              </div>

              {/* Dropdown filters */}
              <div className="pt-2 border-t border-border-subtle space-y-3">
                <FilterSelect
                  icon={Users}
                  label="Sync Status"
                  value={filters.syncStatus}
                  onChange={(v) => updateFilter('syncStatus', v as 'all' | 'synced' | 'partial')}
                  options={[
                    { value: 'all', label: 'All profiles' },
                    { value: 'synced', label: 'Fully synced' },
                    { value: 'partial', label: 'Partial only' },
                  ]}
                />
                <FilterSelect
                  label="Has Messages"
                  value={filters.hasMessages}
                  onChange={(v) => updateFilter('hasMessages', v as 'any' | 'yes' | 'no')}
                  options={[
                    { value: 'any', label: 'Any' },
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                  ]}
                />
                <FilterSelect
                  label="Has Posts"
                  value={filters.hasPosts}
                  onChange={(v) => updateFilter('hasPosts', v as 'any' | 'yes' | 'no')}
                  options={[
                    { value: 'any', label: 'Any' },
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                  ]}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border-subtle bg-bg-tertiary/30">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-2 px-4 rounded-lg bg-accent-primary text-white text-sm font-medium hover:bg-accent-hover transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FilterInputProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function FilterInput({ icon: Icon, label, value, onChange, placeholder }: FilterInputProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-text-muted flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-subtle text-sm text-text-primary
                   placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary"
      />
    </div>
  );
}

interface FilterSelectProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function FilterSelect({ icon: Icon, label, value, onChange, options }: FilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className="space-y-1 relative">
      <label className="text-xs font-medium text-text-muted flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-bg-tertiary border border-border-subtle text-sm text-text-primary
                   hover:border-accent-primary/50 transition-colors"
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown className={`w-3 h-3 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute top-full left-0 right-0 mt-1 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg z-10 overflow-hidden"
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
              >
                <span>{option.label}</span>
                {value === option.value && <Check className="w-3 h-3 text-accent-primary" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { defaultFilters };
