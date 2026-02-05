import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Calendar, ChevronDown, ChevronUp, X } from 'lucide-react';

export const ControlPanel = ({
  searchQuery,
  setSearchQuery,
  filterCamp,
  setFilterCamp,
  filterUnit,
  setFilterUnit,
  filterStatus,
  setFilterStatus,
  filterOptions,
  selectedDate,
  setSelectedDate,
  onClearFilters,
  onViewHistory
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const hasFilters = searchQuery || filterCamp || filterUnit || filterStatus;
  
  const handleCampChange = (val) => setFilterCamp(val === 'all' ? '' : val);
  const handleUnitChange = (val) => setFilterUnit(val === 'all' ? '' : val);
  const handleStatusChange = (val) => setFilterStatus(val === 'all' ? '' : val);
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="border-b border-tactical-border bg-tactical-surface">
      {/* Search Row */}
      <div className="p-2 flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 bg-tactical-bg border-tactical-border h-8 text-xs"
            data-testid="search-input"
          />
          {searchQuery && (
            <button 
              className="absolute right-2 top-1/2 transform -translate-y-1/2"
              onClick={() => setSearchQuery('')}
            >
              <X className="w-3 h-3 text-gray-400 hover:text-white" />
            </button>
          )}
        </div>
        <Button
          size="sm"
          variant={showFilters ? 'default' : 'outline'}
          className="h-8 px-2 text-xs"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Filters
          {hasFilters && !showFilters && <span className="ml-1 w-2 h-2 bg-primary rounded-full" />}
        </Button>
      </div>

      {/* Expandable Filters */}
      {showFilters && (
        <div className="px-2 pb-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={filterCamp || 'all'} onValueChange={handleCampChange}>
              <SelectTrigger className="bg-tactical-bg border-tactical-border text-xs h-7">
                <SelectValue placeholder="Camp" />
              </SelectTrigger>
              <SelectContent className="bg-tactical-panel border-tactical-border">
                <SelectItem value="all" className="text-xs">All Camps</SelectItem>
                {(filterOptions.camps || []).map(camp => (
                  <SelectItem key={camp} value={camp} className="text-xs">{camp}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filterUnit || 'all'} onValueChange={handleUnitChange}>
              <SelectTrigger className="bg-tactical-bg border-tactical-border text-xs h-7">
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent className="bg-tactical-panel border-tactical-border">
                <SelectItem value="all" className="text-xs">All Units</SelectItem>
                {(filterOptions.units || []).map(unit => (
                  <SelectItem key={unit} value={unit} className="text-xs">{unit}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Select value={filterStatus || 'all'} onValueChange={handleStatusChange}>
              <SelectTrigger className="bg-tactical-bg border-tactical-border text-xs h-7">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-tactical-panel border-tactical-border">
                <SelectItem value="all" className="text-xs">All Status</SelectItem>
                <SelectItem value="active" className="text-xs">Active</SelectItem>
                <SelectItem value="inactive" className="text-xs">Inactive</SelectItem>
                <SelectItem value="assigned" className="text-xs">Assigned</SelectItem>
                <SelectItem value="finished" className="text-xs">Finished</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex gap-1">
              <Input
                type="date"
                value={selectedDate || today}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={today}
                className="bg-tactical-bg border-tactical-border text-xs h-7 flex-1"
                data-testid="date-filter"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={onViewHistory}
                data-testid="view-history-btn"
              >
                <Calendar className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          {hasFilters && (
            <Button 
              size="sm" 
              variant="ghost" 
              className="w-full h-6 text-xs"
              onClick={onClearFilters}
              data-testid="clear-filters-btn"
            >
              <X className="w-3 h-3 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
