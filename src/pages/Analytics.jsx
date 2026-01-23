import React from 'react';
import DashboardLayout from '../DashboardLayout';

export default function Analytics() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-4 text-blue-700">Analytics Dashboard</h2>
        <p className="text-sm text-gray-600 mb-6">Advanced reporting and insights</p>

        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Total Calls</div>
              <div className="text-2xl font-bold text-blue-600">1,247</div>
              <div className="text-xs text-green-500">+12% vs last month</div>
            </div>
            <div className="text-gray-300">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 10h18" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Meetings</div>
              <div className="text-2xl font-bold text-green-600">89</div>
              <div className="text-xs text-green-500">+8% vs last month</div>
            </div>
            <div className="text-gray-300">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 10h18" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-xs text-gray-500">Performance Trends</div>
            <div className="mt-3 h-48 bg-gray-50 rounded border border-gray-100 flex items-center justify-center text-gray-400">Chart visualization</div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold mb-3">Top Performers</h3>
            <ul className="space-y-2">
              {[
                { name: 'Sarah Johnson', score: '96%' },
                { name: 'Mike Chen', score: '93%' },
                { name: 'Alex Rivera', score: '90%' },
                { name: 'Jordan Smith', score: '87%' }
              ].map((p, i) => (
                <li key={i} className="flex items-center justify-between bg-gray-50 rounded p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium">{i+1}</div>
                    <div className="text-sm">{p.name}</div>
                  </div>
                  <div className="text-sm text-gray-600">{p.score}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
