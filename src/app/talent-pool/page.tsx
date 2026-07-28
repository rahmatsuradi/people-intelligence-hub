"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, Card, Icon, SvgPath, cn, inputClass, Button } from "@/components/app-shell";
import { getTalentPool, loadDemoData, type TalentProfile } from "@/lib/store";

export default function TalentPoolPage() {
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [filterLoc, setFilterLoc] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterSkill, setFilterSkill] = useState<string>("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setTalents(getTalentPool());
  }, []);

  // Unique values for filters
  const locations = useMemo(() => Array.from(new Set(talents.map((t) => t.location))).sort(), [talents]);
  const statuses = useMemo(() => Array.from(new Set(talents.map((t) => t.status))).sort(), [talents]);
  const skills = useMemo(() => Array.from(new Set(talents.flatMap((t) => t.skills))).sort(), [talents]);

  // Map aggregations (ignoring filters to show global capacity)
  const mapData = useMemo(() => {
    const map = new Map<string, { count: number; capacity: number }>();
    talents.forEach((t) => {
      const current = map.get(t.location) || { count: 0, capacity: 0 };
      map.set(t.location, {
        count: current.count + 1,
        capacity: current.capacity + (t.capacity || 0),
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [talents]);

  // Filtered List
  const filtered = useMemo(() => {
    return talents.filter((t) => {
      if (filterLoc !== "All" && t.location !== filterLoc) return false;
      if (filterStatus !== "All" && t.status !== filterStatus) return false;
      if (filterSkill !== "All" && !t.skills.includes(filterSkill)) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [talents, filterLoc, filterStatus, filterSkill, search]);

  return (
    <AppShell
      activeNavId="talent-pool"
      title="Talent Pool & Map"
      subtitle="Database of operational talents, production partners, and freelancers."
    >
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Talent Map Section */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Talent Map (Distribution)</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {mapData.map(([loc, stats]) => (
              <Card key={loc} className="relative overflow-hidden transition-all hover:shadow-md cursor-pointer group" padding={false}>
                <div className="p-5" onClick={() => setFilterLoc(filterLoc === loc ? "All" : loc)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{loc}</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stats.count} <span className="text-sm font-normal text-slate-500">Talents</span></p>
                    </div>
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                      filterLoc === loc ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400" : "bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 dark:bg-slate-800 dark:group-hover:bg-blue-900/30 dark:group-hover:text-blue-400"
                    )}>
                      <Icon><SvgPath name="dashboard" /></Icon>
                    </div>
                  </div>
                  {stats.capacity > 0 && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <Icon className="h-4 w-4 text-emerald-500"><SvgPath name="sparkles" /></Icon>
                      <span><strong className="font-semibold">{stats.capacity.toLocaleString()}</strong> pcs/week cap</span>
                    </div>
                  )}
                </div>
                {filterLoc === loc && <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500" />}
              </Card>
            ))}
          </div>
        </div>

        {/* Directory Section */}
        <div className="pt-4">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Directory ({filtered.length})</h2>
            
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial sm:w-64">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"><SvgPath name="search" /></Icon>
                <input
                  type="text"
                  placeholder="Search name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn(inputClass, "pl-9")}
                />
              </div>
              
              <select value={filterLoc} onChange={(e) => setFilterLoc(e.target.value)} className={inputClass}>
                <option value="All">All Locations</option>
                {locations.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>

              <select value={filterSkill} onChange={(e) => setFilterSkill(e.target.value)} className={inputClass}>
                <option value="All">All Skills</option>
                {skills.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputClass}>
                <option value="All">All Statuses</option>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <Card padding={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name & Contact</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Skills</th>
                    <th className="px-4 py-3 font-medium">Capacity</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        <p className="mb-4">No talents found matching the filters or database is empty.</p>
                        <Button 
                          variant="primary" 
                          onClick={() => {
                            loadDemoData();
                            setTalents(getTalentPool());
                          }}
                        >
                          Generate 94 Mock Data
                        </Button>
                      </td>
                    </tr>
                  ) : filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">{t.name}</div>
                        <div className="text-xs text-slate-500">{t.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          t.category === "Freelance" ? "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300" :
                          t.category === "Karyawan Inti" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" :
                          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        )}>
                          {t.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{t.location}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap max-w-[200px]">
                          {t.skills.map(s => (
                            <span key={s} className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {t.capacity > 0 ? `${t.capacity} pcs/w` : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1.5",
                          t.status === "Available" ? "text-emerald-600 dark:text-emerald-400" :
                          t.status === "Active" ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
                        )}>
                          <span className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            t.status === "Available" ? "bg-emerald-600 dark:bg-emerald-400" :
                            t.status === "Active" ? "bg-blue-600 dark:bg-blue-400" : "bg-slate-400"
                          )} />
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Icon className="h-4 w-4 text-amber-400"><SvgPath name="star" /></Icon>
                          <span className="font-medium text-slate-900 dark:text-white">{t.rating.toFixed(1)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
