import React from 'react';
import DashboardLayout from '../DashboardLayout';

export default function Systems() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-4 text-blue-700">Systems Management</h2>
        <p className="text-sm text-gray-600 mb-6">Manage integrations and system settings</p>

        <div className="mb-6 bg-white rounded-lg shadow-sm p-2">
          <div className="flex gap-2 p-2">
            <button className="flex-1 py-2 px-3 rounded-md bg-blue-500 text-white text-sm">Integrations</button>
            <button className="flex-1 py-2 px-3 rounded-md bg-white text-sm border">Teams</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: 'Salesforce', status: 'active', desc: 'Sales integration' },
            { name: 'Outreach.io', status: 'active', desc: 'Sales integration' },
            { name: 'Salesloft', status: 'not_connected', desc: 'Sales integration' },
            { name: 'Gong.io', status: 'active', desc: 'Sales integration' },
            { name: 'Microsoft Outlook', status: 'not_connected', desc: 'Sales integration' },
            { name: 'HubSpot', status: 'available', desc: 'Sales integration' }
          ].map((svc, idx) => (
            <div key={idx} className="bg-white rounded-lg p-4 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-sm font-semibold">{svc.name[0]}</div>
                  <div>
                    <div className="font-medium">{svc.name}</div>
                    <div className="text-xs text-gray-500">{svc.desc}</div>
                  </div>
                </div>
                <div>
                  {svc.status === 'active' && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Active</span>}
                  {svc.status === 'not_connected' && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Not Connected</span>}
                  {svc.status === 'available' && <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">Available</span>}
                </div>
              </div>
              <div className="mt-auto">
                {svc.status === 'active' ? (
                  <button className="w-full bg-red-500 text-white py-2 rounded-md">Disconnect</button>
                ) : (
                  <button className="w-full bg-blue-500 text-white py-2 rounded-md">Connect</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
