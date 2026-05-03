"use client"

import * as React from "react"
import { CalendarIcon, Check } from "lucide-react"
import { addDays, format, isSameDay, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, startOfYear } from "date-fns"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  className?: React.HTMLAttributes<divElement>
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
}

export function DateRangePicker({
  className,
  date,
  setDate,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  const presets = [
    {
      label: "Today",
      value: { from: startOfDay(new Date()), to: endOfDay(new Date()) },
    },
    {
      label: "Yesterday",
      value: { from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) },
    },
    {
      label: "Last 7 Days",
      value: { from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) },
    },
    {
      label: "Last 30 Days",
      value: { from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) },
    },
    {
      label: "This Month",
      value: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
    },
    {
      label: "Last Month",
      value: {
        from: startOfMonth(subDays(startOfMonth(new Date()), 1)),
        to: endOfMonth(subDays(startOfMonth(new Date()), 1)),
      },
    },
    {
      label: "All Time",
      value: { from: startOfYear(subDays(new Date(), 3650)), to: endOfDay(new Date()) }, // Approx 10 years
    },
  ]

  const isPresetSelected = (presetValue: DateRange) => {
    if (!date?.from || !date?.to || !presetValue.from || !presetValue.to) return false
    return isSameDay(date.from, presetValue.from) && isSameDay(date.to, presetValue.to)
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[260px] justify-start text-left font-normal bg-background/50 backdrop-blur-sm border-white/10 hover:bg-white/5",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-emerald-500" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 flex flex-row" align="end">
          <div className="flex flex-col border-r border-white/10 p-2 bg-muted/30">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Presets
            </div>
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                className={cn(
                  "justify-between font-normal text-sm px-2 py-1.5 h-auto",
                  isPresetSelected(preset.value) ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : "hover:bg-white/5"
                )}
                onClick={() => {
                  setDate(preset.value)
                  setOpen(false)
                }}
              >
                {preset.label}
                {isPresetSelected(preset.value) && <Check className="h-3 w-3" />}
              </Button>
            ))}
          </div>
          <div className="p-0">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
              classNames={{
                range_start: "bg-emerald-600 text-white rounded-l-md",
                range_end: "bg-emerald-600 text-white rounded-r-md",
                range_middle: "bg-emerald-500/20 text-emerald-900 dark:text-emerald-100",
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
