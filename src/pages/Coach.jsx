import React from 'react';
import DashboardLayout from '../DashboardLayout';

export default function Coach() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-blue-700 mb-2">Apptivia Coach</h1>
          <div className="flex flex-wrap gap-4 items-center text-sm text-gray-600">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg px-6 py-6 flex-1 min-w-[300px] flex flex-col justify-between">
              <div className="text-lg font-semibold mb-1">Intermediate</div>
              <div className="text-xs mb-2">Current Apptivity Level</div>
              <div className="flex items-center gap-4 mb-2">
                <span className="text-2xl font-bold">87%</span>
                <span className="text-xs">Overall Score</span>
              </div>
              <div className="w-full bg-white bg-opacity-20 rounded-full h-2 mb-2">
                <div className="h-2 rounded-full bg-white" style={{ width: '75%' }}></div>
              </div>
              <div className="text-xs">Progress to Proficient</div>
              <div className="w-full mt-4 pt-4 border-t border-white border-opacity-10 flex justify-between items-center">
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className="text-2xl font-bold">3</div>
                  <div className="text-xs text-white/80">Day Streak</div>
                </div>
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className="text-2xl font-bold">12</div>
                  <div className="text-xs text-white/80">Milestones</div>
                </div>
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className="text-2xl font-bold">1</div>
                  <div className="text-xs text-white/80">Achievements</div>
                </div>
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className="text-2xl font-bold">875</div>
                  <div className="text-xs text-white/80">Points</div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-6">Skillset Mastery Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'Conversationalist', progress: 75, color: '#3B82F6', description: 'Master meaningful sales conversations', nextGoal: 'Improve talk ratio to 80%' },
              { name: 'Call Conqueror', progress: 68, color: '#10B981', description: 'Excel at call conversion', nextGoal: 'Book 10 meetings this week' },
              { name: 'Email Warrior', progress: 82, color: '#8B5CF6', description: 'Dominate email outreach', nextGoal: 'Maintain 25%+ reply rate' },
              { name: 'Pipeline Guru', progress: 59, color: '#F59E0B', description: 'Generate high-value opportunities', nextGoal: 'Create $50K pipeline this month' },
              { name: 'Task Master', progress: 91, color: '#EF4444', description: 'Perfect task execution', nextGoal: '100% completion for 10 days' }
            ].map((skillset, index) => (
              <div key={index} className="border-2 border-gray-100 rounded-xl p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-white shadow-sm">
                    <span style={{ color: skillset.color, fontSize: 24 }}>●</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{skillset.name}</h3>
                    <p className="text-sm text-gray-600">{skillset.description}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="h-2 rounded-full" style={{ width: `${skillset.progress}%`, backgroundColor: skillset.color }}></div>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span>Progress</span>
                    <span className="font-bold" style={{ color: skillset.color }}>{skillset.progress}%</span>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-100 mb-2">
                  <div className="text-xs font-medium text-gray-600 mb-1">Next Milestone</div>
                  <div className="text-sm text-gray-900">{skillset.nextGoal}</div>
                </div>
                <button className="w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors hover:opacity-90" style={{ backgroundColor: skillset.color, color: 'white' }}>
                  View Details
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
