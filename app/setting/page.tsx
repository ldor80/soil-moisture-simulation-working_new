import React, { useContext } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import SettingsContext from '@/contexts/SettingsContext'

export default function SettingsPage() {
  const { units, setUnits, moistureUnit, setMoistureUnit } = useContext(SettingsContext)

  const handleSaveSettings = () => {
    // Save settings to local storage or other persistent storage
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="units">Units</Label>
          <Select value={units} onValueChange={setUnits}>
            <SelectTrigger id="units">
              <SelectValue placeholder="Select units" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="metric">Metric</SelectItem>
              <SelectItem value="imperial">Imperial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="moistureUnit">Moisture Unit</Label>
          <Select value={moistureUnit} onValueChange={setMoistureUnit}>
            <SelectTrigger id="moistureUnit">
              <SelectValue placeholder="Select moisture unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="volumetric">Volumetric (m³/m³)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSaveSettings}>Save Settings</Button>
      </div>
    </div>
  )
}