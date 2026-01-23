import React from 'react';
import DashboardLayout from '../DashboardLayout';

export default function Contests() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-4 text-blue-700">Sales Contests</h2>
        <p className="text-sm text-gray-600 mb-6">Gamify performance and drive results</p>

        <div className="space-y-4">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">Call Volume Challenge</h3>
                <p className="text-xs text-gray-500">Most calls this week wins $100 gift card</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-green-600">Active</div>
                <div className="text-sm font-bold mt-2">12</div>
                <div className="text-xs text-gray-500">Sarah Johnson</div>
                <div className="text-xs text-green-600 font-semibold">$100 Gift Card</div>
              </div>
            </div>
            <div className="mt-4">
              <button className="w-full bg-blue-50 text-blue-600 py-2 rounded">View Leaderboard</button>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">Pipeline Generation</h3>
                <p className="text-xs text-gray-500">Highest pipeline value this month</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-indigo-600">Upcoming</div>
                <div className="text-sm font-bold mt-2">8</div>
                <div className="text-xs text-gray-500">Sept 9</div>
                <div className="text-xs text-indigo-600 font-semibold">Team Lunch</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-50 text-center py-2 rounded text-gray-400">Coming Soon</div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">Meeting Master</h3>
                <p className="text-xs text-gray-500">Most meetings booked last quarter</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Completed</div>
                <div className="text-sm font-bold mt-2">Mike Chen</div>
                <div className="text-xs text-gray-500">47 meetings</div>
                <div className="text-xs text-yellow-600 font-semibold">$500 Bonus</div>
              </div>
            </div>
            <div className="mt-4">
              <button className="w-full bg-yellow-50 text-yellow-700 py-2 rounded">View Results</button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
