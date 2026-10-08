import { useState } from "react";
import type { GeofenceZone } from "./AlertSettings.js";

export function NewZoneModal({ 
  polygon, 
  onSave, 
  onCancel 
}: { 
  polygon: [number, number][]; 
  onSave: (zone: GeofenceZone) => void; 
  onCancel: () => void; 
}) {
  const [name, setName] = useState("");
  const [alertOn, setAlertOn] = useState<"enter" | "exit">("exit");
  const [severity, setSeverity] = useState<string>("HIGH");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden text-[#1F2937]">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Save New Zone</h2>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zone Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. Buffer Zone" 
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Alert On</label>
            <select 
              value={alertOn} 
              onChange={e => setAlertOn(e.target.value as "enter" | "exit")}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
            >
              <option value="exit">Leaving Zone (Exit)</option>
              <option value="enter">Entering Zone (Enter)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <select 
              value={severity} 
              onChange={e => setSeverity(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave({ name, polygon, alertOn, severity })} 
            disabled={!name}
            className="px-4 py-2 bg-[#166534] rounded-md text-sm font-medium text-white hover:bg-[#14532d] transition-colors disabled:opacity-50"
          >
            Save Zone
          </button>
        </div>
      </div>
    </div>
  );
}
