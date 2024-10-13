'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Info, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import 'katex/dist/katex.min.css'
import dynamic from 'next/dynamic'

const BlockMath = dynamic(() => import('react-katex').then((mod) => mod.BlockMath), { ssr: false })

interface Cell {
  moisture: number
  tapStatus: boolean
  overrideTap: boolean
}

interface SimulationParams {
  diffusionCoefficient: number
  evapotranspirationRate: number
  irrigationRate: number
  moistureThreshold: number
}

const getColorForMoisture = (moisture: number, colorScheme: string): string => {
  switch (colorScheme) {
    case 'blue':
      const lightness = 100 - moisture * 50 // 100% to 50%
      return `hsl(240, 100%, ${lightness}%)`
    case 'grayscale':
      const gray = 100 - moisture * 100
      return `hsl(0, 0%, ${gray}%)`
    default:
      const hue = moisture * 240 // 0 (red) to 240 (blue)
      return `hsl(${hue}, 100%, 50%)`
  }
}

const getTextColorForMoisture = (moisture: number): string => {
  return moisture > 0.5 ? 'white' : 'black'
}

const parameterExplanations: { [key in keyof SimulationParams]: string } = {
  diffusionCoefficient: "Diffusion Coefficient (D): Controls the rate at which moisture moves between cells. Higher values mean faster diffusion.",
  evapotranspirationRate: "Evapotranspiration Rate (ET₀): Represents the rate at which water is lost from the soil due to evaporation and plant transpiration.",
  irrigationRate: "Irrigation Rate: The amount of water added to the soil when irrigation is applied.",
  moistureThreshold: "Moisture Threshold (θₜ): The soil moisture level below which irrigation is triggered.",
}

const parameterFormulas: { [key in keyof SimulationParams]: string } = {
  diffusionCoefficient: `\\Delta\\theta_{\\text{movement}} = D \\times \\sum_{\\text{neighbors}} (\\theta_{\\text{neighbor}} - \\theta_{i,j})`,
  evapotranspirationRate: `\\Delta\\theta = -ET_0 \\times \\Delta t`,
  irrigationRate: `\\Delta\\theta = I_r \\times \\Delta t`,
  moistureThreshold: '', // No formula for this parameter
}

export default function Simulation() {
  const searchParams = useSearchParams()
  const [grid, setGrid] = useState<Cell[][]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [timeStep, setTimeStep] = useState(0)
  const [params, setParams] = useState<SimulationParams>({
    diffusionCoefficient: 0.1,
    evapotranspirationRate: 0.02,
    irrigationRate: 0.05,
    moistureThreshold: 0.2,
  })
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [moistureHistory, setMoistureHistory] = useState<{ time: number; moisture: number }[]>([])
  const [showCellDetails, setShowCellDetails] = useState(false)
  const [displayValuesInCells, setDisplayValuesInCells] = useState(false)
  const [colorScheme, setColorScheme] = useState('default')
  const [units, setUnits] = useState('metric')
  const [moistureUnit, setMoistureUnit] = useState<'percentage' | 'volumetric'>('percentage')
  const [timeStepSize, setTimeStepSize] = useState(1) // Default to 1 hour
  const [openInfoPanel, setOpenInfoPanel] = useState<keyof SimulationParams | null>(null)

  const initializeGrid = useCallback(() => {
    const rows = parseInt(searchParams.get('rows') || '10')
    const cols = parseInt(searchParams.get('cols') || '10')
    const initialMoisture = searchParams.get('initialMoisture') || 'uniform'
    const uniformMoisture = parseFloat(searchParams.get('uniformMoisture') || '50') / 100

    return Array(rows).fill(null).map(() =>
      Array(cols).fill(null).map(() => ({
        moisture: initialMoisture === 'uniform' ? uniformMoisture : Math.random(),
        tapStatus: false,
        overrideTap: false
      }))
    )
  }, [searchParams])

  useEffect(() => {
    setGrid(initializeGrid())
  }, [initializeGrid])

  const updateGrid = useCallback(() => {
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(row => [...row])
      for (let i = 0; i < newGrid.length; i++) {
        for (let j = 0; j < newGrid[i].length; j++) {
          if (!newGrid[i][j].overrideTap) {
            newGrid[i][j].tapStatus = newGrid[i][j].moisture < params.moistureThreshold
          }

          if (newGrid[i][j].tapStatus) {
            newGrid[i][j].moisture += params.irrigationRate * timeStepSize
          } else {
            newGrid[i][j].moisture -= params.evapotranspirationRate * timeStepSize
          }

          const neighbors = [
            prevGrid[i - 1]?.[j],
            prevGrid[i + 1]?.[j],
            prevGrid[i][j - 1],
            prevGrid[i][j + 1],
          ].filter(Boolean)

          let deltaMoisture = 0
          neighbors.forEach((neighbor) => {
            deltaMoisture += params.diffusionCoefficient * (neighbor.moisture - prevGrid[i][j].moisture)
          })

          newGrid[i][j].moisture += deltaMoisture * timeStepSize
          newGrid[i][j].moisture = Math.max(0, Math.min(1, newGrid[i][j].moisture))
        }
      }
      return newGrid
    })

    setTimeStep(prev => prev + 1)
  }, [params, timeStepSize])

  useEffect(() => {
    if (selectedCell && grid.length > 0) {
      const { row, col } = selectedCell
      setMoistureHistory(prev => [
        ...prev,
        { time: timeStep, moisture: grid[row][col].moisture }
      ].slice(-20))
    }
  }, [selectedCell, timeStep, grid])

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    if (isRunning) {
      intervalId = setInterval(updateGrid, 1000)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [isRunning, updateGrid])

  const toggleSimulation = useCallback(() => setIsRunning(prev => !prev), [])

  const resetSimulation = useCallback(() => {
    setIsRunning(false)
    setTimeStep(0)
    setMoistureHistory([])
    setGrid(initializeGrid())
  }, [initializeGrid])

  const handleCellClick = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col })
    setShowCellDetails(true)
  }, [])

  const formatMoisture = useCallback((moisture: number) => {
    if (moistureUnit === 'percentage') {
      return `${(moisture * 100).toFixed(1)}%`
    } else {
      const volumetricMoisture = moisture * 0.5
      return `${volumetricMoisture.toFixed(3)} m³/m³`
    }
  }, [moistureUnit])

  const getUnitForParameter = useCallback((paramName: keyof SimulationParams) => {
    switch (paramName) {
      case 'diffusionCoefficient':
        return '' // Unitless
      case 'evapotranspirationRate':
        return units === 'metric' ? 'mm/h' : 'in/h'
      case 'irrigationRate':
        return units === 'metric' ? 'mm/h' : 'in/h'
      case 'moistureThreshold':
        return moistureUnit === 'percentage' ? '%' : 'm³/m³'
      default:
        return ''
    }
  }, [units, moistureUnit])

  const formatParameterName = useCallback((name: string): string => {
    return name
      .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize the first letter
  }, [])

  const ColorLegend = useMemo(() => {
    const minLabel = moistureUnit === 'percentage' ? '0% (Dry)' : '0.000 m³/m³ (Dry)'
    const midLabel = moistureUnit === 'percentage' ? '50%' : '0.250 m³/m³'
    const maxLabel = moistureUnit === 'percentage' ? '100% (Wet)' : '0.500 m³/m³ (Wet)'

    return (
      <div className="flex items-center justify-between mt-4 bg-white p-2 rounded-md shadow">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4" style={{ backgroundColor: getColorForMoisture(0, colorScheme) }}></div>
          <span>{minLabel}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4" style={{ backgroundColor: getColorForMoisture(0.5, colorScheme) }}></div>
          <span>{midLabel}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4" style={{ backgroundColor: getColorForMoisture(1, colorScheme) }}></div>
          <span>{maxLabel}</span>
        </div>
      </div>
    )
  }, [colorScheme, moistureUnit])

  const ParamControl = useCallback(({ name, value, onChange, min, max, step }: {
    name: keyof SimulationParams
    value: number
    onChange: (value: number) => void
    min: number
    max: number
    step: number
  }) => {
    const unit = getUnitForParameter(name)
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={name} className="flex items-center space-x-1">
            <span>{`${formatParameterName(name)}${unit ? ` (${unit})` : ''}`}</span>
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpenInfoPanel(openInfoPanel === name ? null : name)}
          >
            {openInfoPanel === name ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
          </Button>
        </div>
        {openInfoPanel === name && (
          <Card>
            <CardContent className="p-4">
              <p>{parameterExplanations[name]}</p>
              {parameterFormulas[name] && parameterFormulas[name].trim() !== '' && (
                <BlockMath math={parameterFormulas[name]} />
              )}
            </CardContent>
          </Card>
        )}
        <div className="flex items-center space-x-2">
          <Input
            id={name}
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              const newValue = parseFloat(e.target.value)
              if (!isNaN(newValue) && newValue >= min && newValue <= max) {
                onChange(newValue)
              }
            }}
            className="w-20"
          />
          <Slider
            min={min}
            max={max}
            step={step}
            value={[value]}
            onValueChange={(value) => onChange(value[0])}
            className="flex-1"
          />
        </div>
      </div>
    )
  }, [getUnitForParameter, formatParameterName, openInfoPanel])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
      <div className="md:col-span-2">
        <h2 className="text-2xl font-bold mb-4">Simulation Grid</h2>
        {grid.length > 0 ? (
          <div className="grid gap-1 overflow-auto max-h-[60vh]" style={{ gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))` }}>
            {grid.flat().map((cell, index) => (
              <div
                key={index}
                className="aspect-square rounded cursor-pointer relative"
                style={{
                  backgroundColor: getColorForMoisture(cell.moisture, colorScheme),
                  border: cell.tapStatus ? '2px solid yellow' : '1px solid gray',
                  boxShadow: cell.overrideTap ? '0 0 0 2px red inset' : 'none',
                }}
                onClick={() => handleCellClick(Math.floor(index / grid[0].length), index % grid[0].length)}
                aria-label={`Cell ${Math.floor(index / grid[0].length)},${index % grid[0].length}. Moisture: ${formatMoisture(cell.moisture)}. Tap: ${cell.tapStatus ? 'On' : 'Off'}. Override:  ${cell.overrideTap ? 'Yes' : 'No'}`}
              >
                {displayValuesInCells && (
                  <span
                    className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                    style={{ color: getTextColorForMoisture(cell.moisture) }}
                  >
                    {formatMoisture(cell.moisture)}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>Loading grid...</p>
        )}
        {ColorLegend}
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-4">Controls</h2>
        <div className="space-y-4">
          <div className="space-x-2">
            <Button onClick={toggleSimulation}>{isRunning ? 'Pause' : 'Start'}</Button>
            <Button onClick={resetSimulation}>Reset</Button>
            <Button onClick={updateGrid} disabled={isRunning}>Step Forward</Button>
          </div>
          {Object.entries(params).map(([key, value]) => (
            <ParamControl
              key={key}
              name={key as keyof SimulationParams}
              value={value}
              onChange={(newValue) => setParams(prev => ({ ...prev, [key]: newValue }))}
              min={0}
              max={key === 'diffusionCoefficient' || key === 'moistureThreshold' ? 1 : 0.5}
              step={0.01}
            />
          ))}
          <div className="space-y-2">
            <Label htmlFor="timeStepSize">Time Step Size (hours)</Label>
            <Input
              id="timeStepSize"
              type="number"
              min={0.1}
              max={24}
              step={0.1}
              value={timeStepSize}
              onChange={(e) => {
                const value = parseFloat(e.target.value)
                if (!isNaN(value) && value >= 0.1 && value <= 24) {
                  setTimeStepSize(value)
                }
              }}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="displayValuesInCells"
              checked={displayValuesInCells}
              onCheckedChange={setDisplayValuesInCells}
            />
            <Label htmlFor="displayValuesInCells">Display Values in Cells</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="colorScheme">Color Scheme</Label>
            <Select value={colorScheme} onValueChange={setColorScheme}>
              <SelectTrigger id="colorScheme">
                <SelectValue placeholder="Select color scheme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Red to Blue</SelectItem>
                <SelectItem value="blue">Light to Dark Blue</SelectItem>
                <SelectItem value="grayscale">Grayscale</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="units">Units</Label>
            <div className="flex items-center space-x-2">
              <Select value={units} onValueChange={setUnits}>
                <SelectTrigger id="units">
                  <SelectValue placeholder="Select units" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">Metric</SelectItem>
                  <SelectItem value="imperial">Imperial</SelectItem>
                </SelectContent>
              </Select>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Metric: mm/h for rates, cm for depth</p>
                    <p>Imperial: in/h for rates, in for depth</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
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
        </div>
      </div>
      <div className="md:col-span-3">
        <h2 className="text-2xl font-bold mb-4">Data Visualization</h2>
        <Tabs defaultValue="timeSeries">
          <TabsList>
            <TabsTrigger value="timeSeries">Time Series</TabsTrigger>
            <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          </TabsList>
          <TabsContent value="timeSeries">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={moistureHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis
                  label={{ value: moistureUnit === 'percentage' ? 'Moisture (%)' : 'Moisture (m³/m³)', angle: -90, position: 'insideLeft' }}
                  tickFormatter={(value) => formatMoisture(value)}
                />
                <RechartsTooltip formatter={(value) => formatMoisture(value as number)} />
                <Legend />
                <Line type="monotone" dataKey="moisture" stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
          <TabsContent value="heatmap">
            {grid.length > 0 ? (
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))` }}>
                {grid.flat().map((cell, index) => (
                  <div
                    key={index}
                    className="aspect-square rounded"
                    style={{
                      backgroundColor: getColorForMoisture(cell.moisture, colorScheme)
                    }}
                  />
                ))}
              </div>
            ) : (
              <p>Loading heatmap...</p>
            )}
            {ColorLegend}
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={showCellDetails} onOpenChange={setShowCellDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cell Details</DialogTitle>
          </DialogHeader>
          {selectedCell && grid[selectedCell.row] && grid[selectedCell.row][selectedCell.col] && (
            <DialogDescription>
              <p>Row: {selectedCell.row}, Column: {selectedCell.col}</p>
              <p>Moisture: {formatMoisture(grid[selectedCell.row][selectedCell.col].moisture)}</p>
              <p>Tap Status: {grid[selectedCell.row][selectedCell.col].tapStatus ? 'On' : 'Off'}</p>
              <p>Override: {grid[selectedCell.row][selectedCell.col].overrideTap ? 'Yes' : 'No'}</p>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="manualMoisture">Set Moisture Manually</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="manualMoisture"
                      type="number"
                      min={0}
                      max={moistureUnit === 'percentage' ? 100 : 0.5}
                      step={moistureUnit === 'percentage' ? 1 : 0.01}
                      value={moistureUnit === 'percentage' ? 
                        (grid[selectedCell.row][selectedCell.col].moisture * 100).toFixed(0) : 
                        (grid[selectedCell.row][selectedCell.col].moisture * 0.5).toFixed(3)
                      }
                      onChange={(e) => {
                        const value = parseFloat(e.target.value)
                        if (!isNaN(value)) {
                          const newMoisture = moistureUnit === 'percentage' ? value / 100 : value / 0.5
                          setGrid(prevGrid => {
                            const newGrid = [...prevGrid]
                            newGrid[selectedCell.row] = [...newGrid[selectedCell.row]]
                            newGrid[selectedCell.row][selectedCell.col] = {
                              ...newGrid[selectedCell.row][selectedCell.col],
                              moisture: Math.min(1, Math.max(0, newMoisture)),
                              overrideTap: true,
                            }
                            return newGrid
                          })
                        }
                      }}
                      className="w-20"
                    />
                    <span>{moistureUnit === 'percentage' ? '%' : 'm³/m³'}</span>
                  </div>
                </div>
                <Button onClick={() => {
                  setGrid(prevGrid => {
                    const newGrid = [...prevGrid]
                    newGrid[selectedCell.row] = [...newGrid[selectedCell.row]]
                    newGrid[selectedCell.row][selectedCell.col] = {
                      ...newGrid[selectedCell.row][selectedCell.col],
                      tapStatus: !newGrid[selectedCell.row][selectedCell.col].tapStatus,
                      overrideTap: true,
                    }
                    return newGrid
                  })
                }}>
                  Toggle Tap
                </Button>
                <Button onClick={() => {
                  setGrid(prevGrid => {
                    const newGrid = [...prevGrid]
                    newGrid[selectedCell.row] = [...newGrid[selectedCell.row]]
                    newGrid[selectedCell.row][selectedCell.col] = {
                      ...newGrid[selectedCell.row][selectedCell.col],
                      overrideTap: false,
                    }
                    return newGrid
                  })
                }}>
                  Reset Tap Control
                </Button>
              </div>
            </DialogDescription>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}