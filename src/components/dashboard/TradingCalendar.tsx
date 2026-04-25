import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Star, Globe } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";
import { fetchTrades, tradesQueryKey, type Trade } from "@/lib/trades";
import { navigateToPage, focusDailyView } from "@/lib/nav-bus";
import { useQuery } from "@tanstack/react-query";

export function TradingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [newsFilter, setNewsFilter] = useState<number>(0);

  const { data: trades = [] } = useQuery({
    queryKey: tradesQueryKey,
    queryFn: fetchTrades,
  });

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleDayClick = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    navigateToPage("daily");
    setTimeout(() => focusDailyView(dateStr), 50);
  };

  // Generate calendar grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = "d";
  const rows: Date[][] = [];

  let days: Date[] = [];
  let day = startDate;
  let formattedDate = "";

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      days.push(day);
      day = new Date(day.getTime() + 24 * 60 * 60 * 1000); // add 1 day
    }
    rows.push(days);
    days = [];
  }

  // Aggregate PnL and Count by day
  const tradesByDay = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number }>();
    trades.forEach((t) => {
      const dateStr = format(new Date(t.entryTime), "yyyy-MM-dd");
      const existing = map.get(dateStr) || { pnl: 0, count: 0 };
      map.set(dateStr, {
        pnl: existing.pnl + t.netPnl,
        count: existing.count + 1
      });
    });
    return map;
  }, [trades]);

  const monthTotalPnl = useMemo(() => {
    let total = 0;
    trades.forEach((t) => {
      if (isSameMonth(new Date(t.entryTime), monthStart)) {
        total += t.netPnl;
      }
    });
    return total;
  }, [trades, monthStart]);

  return (
    <div className="w-full h-full flex flex-col p-4 sm:p-8 bg-transparent">
      <div className="w-full mx-auto flex flex-col h-full bg-white rounded-[24px] sm:rounded-[32px] shadow-sm border border-slate-100 text-slate-900 overflow-hidden">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 sm:px-8 py-4 sm:py-6 gap-4">
          <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-6">
            <h2 className="text-lg sm:text-2xl font-bold font-sans text-slate-900">
              {format(currentDate, "MMMM yyyy")}
            </h2>
            <div className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-slate-100 flex items-center gap-1">
              <span className={`text-sm sm:text-lg font-bold ${monthTotalPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {monthTotalPnl >= 0 ? "+" : ""}${Math.abs(monthTotalPnl).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8">
            <div className="hidden md:flex items-center gap-3">
              <span className="text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase">News Importance</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((star) => (
                  <button
                    key={star}
                    onClick={() => setNewsFilter(newsFilter === star ? 0 : star)}
                    className={`transition-colors ${newsFilter >= star ? "text-slate-200" : "text-slate-100"}`}
                  >
                    <Star className="w-5 h-5 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-50 text-xs font-bold tracking-widest text-slate-900">
                <Globe className="w-4 h-4" />
                <span>EN</span>
              </button>
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-full border border-slate-100">
                <button onClick={handlePrevMonth} className="p-1.5 rounded-full hover:bg-white hover:shadow-sm text-slate-400 transition-all">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={handleNextMonth} className="p-1.5 rounded-full hover:bg-white hover:shadow-sm text-slate-400 transition-all">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col overflow-x-auto scrollbar-hide">
          {/* Days of week */}
          <div className="grid grid-cols-7 md:grid-cols-8 border-y border-slate-100 min-w-[600px] md:min-w-0">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => (
              <div key={dayName} className="py-2 sm:py-4 text-center text-[9px] sm:text-[11px] font-bold tracking-[0.1em] sm:tracking-[0.2em] text-slate-400 uppercase border-r border-slate-100">
                {dayName}
              </div>
            ))}
            <div className="hidden md:block py-4 text-center text-[11px] font-bold tracking-[0.2em] text-slate-400 uppercase bg-slate-50/50">
              Weekly
            </div>
          </div>

          {/* Days */}
          <div className="flex-1 flex flex-col divide-y divide-slate-100 min-w-[600px] md:min-w-0">
            {rows.map((row, i) => {
              // Calculate weekly PnL
              const weeklyPnl = row.reduce((sum, day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                return sum + (tradesByDay.get(dateStr)?.pnl || 0);
              }, 0);

              return (
                <div key={i} className="flex-1 grid grid-cols-7 md:grid-cols-8 divide-x divide-slate-100">
                  {row.map((day, j) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const dayInfo = tradesByDay.get(dateStr);
                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const isToday = isSameDay(day, new Date());
                    const pnl = dayInfo?.pnl;

                    return (
                      <div
                        key={j}
                        onClick={() => handleDayClick(day)}
                        className={`p-2 sm:p-4 flex flex-col justify-between cursor-pointer transition-all min-h-[80px] sm:min-h-[120px] relative
                          ${pnl !== undefined ? (pnl >= 0 ? "bg-[#00C08B]" : "bg-[#FF2D55]") : "bg-white hover:bg-slate-50"}
                          ${!isCurrentMonth ? "opacity-30" : ""}
                        `}
                      >
                        <span className={`text-sm font-bold ${pnl !== undefined ? "text-white/90" : "text-slate-900"}`}>
                          {format(day, dateFormat)}
                        </span>
                        
                        <div className="flex flex-col items-center justify-center flex-1">
                          {dayInfo ? (
                            <div className="text-center text-white">
                              <div className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest opacity-80 mb-0.5 sm:mb-1">
                                {dayInfo.count} {dayInfo.count === 1 ? 'Trade' : 'Trades'}
                              </div>
                              <div className="text-sm sm:text-lg font-black font-mono">
                                {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toLocaleString()}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">
                              No Trades
                            </div>
                          )}
                        </div>
                        {isToday && pnl === undefined && (
                          <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                      </div>
                    );
                  })}
                  {/* Weekly Column */}
                  <div className="hidden md:flex flex-col items-center justify-center bg-slate-50/50">
                    <span className={`text-sm font-bold font-mono ${weeklyPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {weeklyPnl >= 0 ? "+" : ""}${Math.abs(weeklyPnl).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

