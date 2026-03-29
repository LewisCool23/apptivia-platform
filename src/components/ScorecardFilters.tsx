import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../supabaseClient';

interface Props {
  showDate?: boolean;
  initialFilters?: {
    dateRange?: string;
    departments?: string[];
    teams?: string[];
    members?: string[];
  };
  resetSignal?: number;
  lockedFilters?: {
    dateRange?: boolean;
    departments?: boolean;
    teams?: boolean;
    members?: boolean;
  };
  restrictToDepartments?: string[];
  restrictToTeams?: string[];
  restrictToMembers?: string[];
  onFilterChange?: (filters: {
    dateRange: string;
    departments: string[];
    teams: string[];
    members: string[];
  }) => void;
}

export default function ScorecardFilters({
  showDate = true,
  initialFilters,
  resetSignal,
  lockedFilters,
  restrictToDepartments,
  restrictToTeams,
  restrictToMembers,
  onFilterChange
}: Props) {
  const [dateRange, setDateRange] = useState('This Week');
  const [customWeekDate, setCustomWeekDate] = useState('');
  const [teams, setTeams] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]); // store team ids
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]); // store profile ids
  const [initialized, setInitialized] = useState(false);
  const onFilterChangeRef = useRef(onFilterChange);

  useEffect(() => {
    onFilterChangeRef.current = onFilterChange;
  }, [onFilterChange]);

  useEffect(() => {
    if (initialized) return;
    if (!initialFilters) return;
    if (initialFilters.dateRange) setDateRange(initialFilters.dateRange);
    if (Array.isArray(initialFilters.departments)) setSelectedDepartments(initialFilters.departments);
    if (Array.isArray(initialFilters.teams)) setSelectedTeams(initialFilters.teams);
    if (Array.isArray(initialFilters.members)) setSelectedMembers(initialFilters.members);
    setInitialized(true);
  }, [initialFilters, initialized]);

  useEffect(() => {
    if (resetSignal === undefined) return;
    const nextDateRange = initialFilters?.dateRange || 'This Week';
    setDateRange(nextDateRange);
    setSelectedDepartments(initialFilters?.departments || []);
    setSelectedTeams(initialFilters?.teams || []);
    setSelectedMembers(initialFilters?.members || []);
    setCustomWeekDate('');
  }, [resetSignal, initialFilters]);

  // Snap a date string to the Monday of its week, return as YYYY-MM-DD
  function snapToMonday(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Mon=1..Sun=0
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }

  // Notify parent of filter changes.
  // For Custom Week, encode the Monday date into the dateRange string so the
  // parent can resolve it without needing extra props: "Custom Week|YYYY-MM-DD"
  useEffect(() => {
    if (onFilterChangeRef.current) {
      let emittedDateRange = dateRange;
      if (dateRange === 'Custom Week' && customWeekDate) {
        emittedDateRange = `Custom Week|${snapToMonday(customWeekDate)}`;
      }
      onFilterChangeRef.current({
        dateRange: emittedDateRange,
        departments: selectedDepartments,
        teams: selectedTeams,
        members: selectedMembers,
      });
    }
  }, [dateRange, customWeekDate, selectedDepartments, selectedTeams, selectedMembers]);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const { data: teamsData, error: teamsErr } = await supabase.from('teams').select('*');
        if (teamsErr) {
          console.error('Error loading teams', teamsErr);
          if (mounted) setTeams([]);
        } else {
          console.log('Loaded teams:', teamsData);
          if (mounted) setTeams(teamsData || []);
          const depts = Array.from(new Set((teamsData || []).map((t: any) => t.department).filter(Boolean))) as string[];
          console.log('Extracted departments:', depts);
          console.log('Teams data structure:', teamsData?.map((t: any) => ({ id: t.id, name: t.name, department: t.department })));
          if (mounted) setDepartments(depts);
        }
      } catch (err) {
        console.error('Unexpected error loading teams', err);
      }

      try {
        const { data: profilesData, error: profilesErr } = await supabase.from('profiles').select('*').not('role', 'in', '("admin","manager","coach")');
        if (profilesErr) {
          console.error('Error loading profiles', profilesErr);
          if (mounted) setProfiles([]);
        } else {
          console.log('Loaded profiles:', profilesData?.length, 'profiles');
          if (mounted) setProfiles(profilesData || []);
        }
      } catch (err) {
        console.error('Unexpected error loading profiles', err);
      }
    }

    loadData();

    // Real-time subscriptions
    const subs: any[] = [];

    const applyRowChange = (listSetter: (v: any) => void, idField: string = 'id') => (payload: any) => {
      const newRow = payload?.new || payload?.record || payload?.after || payload;
      const oldRow = payload?.old || payload?.prev || payload?.before || null;
      if (newRow && !oldRow) {
        listSetter((prev: any[]) => {
          const without = prev.filter(p => String(p[idField]) !== String(newRow[idField]));
          return [...without, newRow];
        });
      } else if (newRow && oldRow) {
        listSetter((prev: any[]) => prev.map(p => String(p[idField]) === String(newRow[idField]) ? newRow : p));
      } else if (!newRow && oldRow) {
        listSetter((prev: any[]) => prev.filter(p => String(p[idField]) !== String(oldRow[idField])));
      }
    };

    // Helper: after teams state is updated via applyRowChange, derive
    // departments from the CURRENT teams state (avoids stale closure).
    const syncDepartmentsFromTeams = () => {
      setTeams((currentTeams: any[]) => {
        const depts = Array.from(new Set((currentTeams || []).map((t: any) => t.department).filter(Boolean)));
        setDepartments(depts as string[]);
        return currentTeams; // return unchanged — we just need to read the value
      });
    };

    try {
      if ((supabase as any).channel) {
        const ch = (supabase as any).channel('realtime_teams')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, (payload: any) => {
            applyRowChange(setTeams)(payload);
            // Derive departments after setTeams has been applied (next microtask)
            setTimeout(syncDepartmentsFromTeams, 0);
          })
          .subscribe();
        subs.push(ch);
      } else if ((supabase as any).from) {
        const sub = (supabase as any).from('teams').on('*', (payload: any) => {
          applyRowChange(setTeams)(payload);
          setTimeout(syncDepartmentsFromTeams, 0);
        }).subscribe();
        subs.push(sub);
      }
    } catch (e) {
      console.error('Error creating teams subscription', e);
    }

    try {
      if ((supabase as any).channel) {
        const ch2 = (supabase as any).channel('realtime_profiles')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload: any) => {
            applyRowChange(setProfiles)(payload);
          })
          .subscribe();
        subs.push(ch2);
      } else if ((supabase as any).from) {
        const sub2 = (supabase as any).from('profiles').on('*', (payload: any) => {
          applyRowChange(setProfiles)(payload);
        }).subscribe();
        subs.push(sub2);
      }
    } catch (e) {
      console.error('Error creating profiles subscription', e);
    }

    return () => {
      mounted = false;
      try {
        subs.forEach(s => {
          if (!s) return;
          if (typeof s.unsubscribe === 'function') {
            s.unsubscribe();
          } else if (s.unsubscribe) {
            try { s.unsubscribe(); } catch (e) {}
          }
        });
      } catch (e) {}
    };
  }, []);

  const filteredTeams = useMemo(() => {
    let list = teams;
    if (selectedDepartments.length > 0) {
      list = list.filter(t => selectedDepartments.includes(t.department));
    }
    if (Array.isArray(restrictToTeams) && restrictToTeams.length > 0) {
      list = list.filter(t => restrictToTeams.includes(String(t.id)));
    }
    if (Array.isArray(restrictToDepartments) && restrictToDepartments.length > 0) {
      list = list.filter(t => restrictToDepartments.includes(String(t.department)));
    }
    return list;
  }, [teams, selectedDepartments, restrictToTeams, restrictToDepartments]);

  const filteredMembers = useMemo(() => {
    let list = profiles;
    if (selectedDepartments.length > 0) {
      list = list.filter((p: any) => selectedDepartments.includes(p.department));
    }
    if (selectedTeams.length > 0) {
      list = list.filter((p: any) => selectedTeams.includes(p.team_id != null ? String(p.team_id) : ''));
    }
    if (Array.isArray(restrictToMembers) && restrictToMembers.length > 0) {
      list = list.filter((p: any) => restrictToMembers.includes(String(p.id)));
    }
    if (Array.isArray(restrictToTeams) && restrictToTeams.length > 0) {
      list = list.filter((p: any) => restrictToTeams.includes(String(p.team_id)));
    }
    if (Array.isArray(restrictToDepartments) && restrictToDepartments.length > 0) {
      list = list.filter((p: any) => restrictToDepartments.includes(String(p.department)));
    }
    return list;
  }, [profiles, selectedDepartments, selectedTeams, restrictToMembers, restrictToTeams, restrictToDepartments]);

  function handleMultiSelect(e: React.ChangeEvent<HTMLSelectElement>, setter: (v: any) => void) {
    const values = Array.from(e.target.selectedOptions, option => option.value);
    // If empty string ("All" option) is selected, clear all selections to show all
    if (values.includes('')) {
      setter([]);
    } else {
      setter(values);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {showDate && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date Range</label>
          <select
            value={dateRange}
            onChange={e => {
              const val = e.target.value;
              if (!lockedFilters?.dateRange) {
                setDateRange(val);
              }
              if (val !== 'Custom Week') setCustomWeekDate('');
            }}
            className={`border rounded px-2 py-1 text-xs ${lockedFilters?.dateRange ? 'opacity-60 cursor-not-allowed' : ''}`}
            disabled={lockedFilters?.dateRange}
          >
            <option>All Time</option>
            <option>This Week</option>
            <option>Last Week</option>
            <option>This Month</option>
            <option>Last Month</option>
            <option>This Quarter</option>
            <option>Last Quarter</option>
            <option>Custom Week</option>
          </select>
        </div>
      )}
      
      {dateRange === 'Custom Week' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Pick any day in the week</label>
          <input
            type="date"
            title="Pick any day — the full Mon–Sun week will be selected"
            value={customWeekDate}
            onChange={e => setCustomWeekDate(e.target.value)}
            className="border rounded px-2 py-1 text-xs"
          />
          {customWeekDate && (
            <div className="text-[10px] text-gray-400 mt-0.5">
              Week: {snapToMonday(customWeekDate)} → {(() => {
                const mon = new Date(snapToMonday(customWeekDate) + 'T00:00:00');
                mon.setDate(mon.getDate() + 6);
                return mon.toISOString().slice(0, 10);
              })()}
            </div>
          )}
        </div>
      )}


      <div>
        <label className="block text-xs text-gray-500 mb-1">Departments</label>
        <select multiple size={1} value={selectedDepartments} onChange={e => handleMultiSelect(e, setSelectedDepartments)} className={`border rounded px-2 py-1 text-xs min-w-[140px] ${lockedFilters?.departments ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={lockedFilters?.departments}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Teams</label>
        <select multiple size={1} value={selectedTeams} onChange={e => handleMultiSelect(e, setSelectedTeams)} className={`border rounded px-2 py-1 text-xs min-w-[160px] ${lockedFilters?.teams ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={lockedFilters?.teams}>
          <option value="">All Teams</option>
          {filteredTeams.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Team Members</label>
        <select multiple size={1} value={selectedMembers} onChange={e => handleMultiSelect(e, setSelectedMembers)} className={`border rounded px-2 py-1 text-xs min-w-[200px] ${lockedFilters?.members ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={lockedFilters?.members}>
          <option value="">All Members</option>
          {filteredMembers.map(m => <option key={m.id} value={String(m.id)}>{`${m.first_name || ''} ${m.last_name || ''}`.trim()}</option>)}
        </select>
      </div>
    </div>
  );
}
