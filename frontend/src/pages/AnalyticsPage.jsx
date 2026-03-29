import { useState, useEffect } from 'react';
import { analyticsApi } from '../api';
import { BarChart, Activity, Clock, FileText, Loader2, RefreshCw } from 'lucide-react';

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const data = await analyticsApi.getStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="flex-1 p-8 h-full bg-slate-900 overflow-y-auto text-slate-200">
      <div className="flex items-center justify-between mb-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
          <Activity className="w-8 h-8 text-indigo-400" />
          Analytics Dashboard
        </h1>
        <button 
          onClick={fetchStats}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      
      {isLoading && !stats ? (
        <div className="flex flex-col items-center justify-center h-64">
           <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex items-center gap-6 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500 text-blue-400">
                <FileText className="w-32 h-32" />
              </div>
              <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0 border border-blue-500/20">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-slate-400 font-medium mb-1">Total Documents</h3>
                <p className="text-slate-100 text-4xl font-bold">{stats?.total_documents ?? 0}</p>
              </div>
            </div>

            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex items-center gap-6 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500 text-emerald-400">
                <BarChart className="w-32 h-32" />
              </div>
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0 border border-emerald-500/20">
                <BarChart className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-slate-400 font-medium mb-1">Queries Asked</h3>
                <p className="text-slate-100 text-4xl font-bold">{stats?.total_queries ?? 0}</p>
              </div>
            </div>

            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex items-center gap-6 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500 text-purple-400">
                <Clock className="w-32 h-32" />
              </div>
              <div className="w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0 border border-purple-500/20">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-slate-400 font-medium mb-1">Avg. Response Time</h3>
                <p className="text-slate-100 text-4xl font-bold">{stats?.average_response_time_ms ?? 0}<span className="text-lg text-slate-500 font-normal ml-1">ms</span></p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-sm overflow-hidden min-h-[300px]">
            <div className="px-6 py-5 border-b border-slate-700 bg-slate-800 shrink-0">
              <h2 className="text-xl font-semibold text-slate-200">Most Common Queries</h2>
            </div>
            <div className="p-0">
              {stats?.most_common_queries?.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                  <Activity className="w-12 h-12 mb-3 opacity-20" />
                  <p>No query data available yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-700/50">
                  {stats?.most_common_queries?.map((item, idx) => (
                    <li key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-6 hover:bg-slate-800/80 transition-colors gap-4">
                      <div className="flex items-start gap-4">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                          {idx + 1}
                        </span>
                        <p className="text-slate-300 font-medium text-lg leading-tight mt-1">{item.query}</p>
                      </div>
                      <div className="shrink-0 md:ml-auto">
                        <span className="inline-flex items-center rounded-full bg-slate-700 border border-slate-600 px-3 py-1 text-sm font-medium text-slate-300">
                          {item.count} {item.count === 1 ? 'time' : 'times'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
