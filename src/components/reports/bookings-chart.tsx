"use client"

import { format } from "date-fns"
import { ScrollRegion } from "@/components/scroll-region"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export type DailyPoint = {
  day: string
  completed: number
  open: number
  cancelled: number
  noShow: number
  total: number
}

const config = {
  completed: { label: "Completed", color: "var(--status-completed)" },
  open: { label: "Upcoming / in progress", color: "var(--chart-3)" },
  cancelled: { label: "Cancelled", color: "var(--status-cancelled)" },
  noShow: { label: "No-show", color: "var(--status-no-show)" },
} satisfies ChartConfig

const parse = (v: string) => {
  const [y, m, d] = v.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function BookingsChart({ data }: { data: DailyPoint[] }) {
  const total = data.reduce((sum, d) => sum + d.total, 0)

  return (
    <div className="grid min-w-0 gap-3">
      <ChartContainer
        config={config}
        className="h-72 w-full min-w-0"
        role="img"
        aria-label={`Bar chart of ${total} appointments per day from ${data[0] ? format(parse(data[0].day), "MMM d") : ""} to ${data.at(-1) ? format(parse(data.at(-1)!.day), "MMM d") : ""}, split by status. The same numbers are in the table below.`}
      >
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval="preserveStartEnd"
            minTickGap={28}
            tickFormatter={(v: string) => format(parse(v), data.length > 14 ? "MMM d" : "EEE d")}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(v) => format(parse(String(v)), "EEEE, MMMM d")} />}
          />
          <ChartLegend content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-1" />} />
          <Bar dataKey="completed" stackId="a" fill="var(--color-completed)" />
          <Bar dataKey="open" stackId="a" fill="var(--color-open)" />
          <Bar dataKey="cancelled" stackId="a" fill="var(--color-cancelled)" />
          <Bar dataKey="noShow" stackId="a" fill="var(--color-noShow)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartContainer>

      <details className="rounded-xl border p-3 text-sm">
        <summary className="cursor-pointer font-medium">View the chart data as a table</summary>
        <ScrollRegion label="Appointments per day" className="mt-3 max-h-72 overflow-y-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Appointments per day by status</caption>
            <thead className="sticky top-0 bg-background">
              <tr className="border-b">
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Day
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Total
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Completed
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Upcoming
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Cancelled
                </th>
                <th scope="col" className="py-1.5 pl-3 text-right font-medium">
                  No-show
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.day} className="border-b last:border-0">
                  <th scope="row" className="py-1.5 pr-3 font-normal">
                    {format(parse(d.day), "EEE, MMM d")}
                  </th>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.total}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.completed}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.open}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.cancelled}</td>
                  <td className="py-1.5 pl-3 text-right tabular-nums">{d.noShow}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      </details>
    </div>
  )
}
