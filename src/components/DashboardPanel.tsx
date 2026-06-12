export const DashboardPanel = () => {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
      <i className="fa-solid fa-chart-line text-4xl mb-4 opacity-50"></i>
      <h2 className="text-xl font-bold text-slate-200">Dashboard Overview</h2>
      <p className="mt-2 text-sm text-center max-w-md">
        Welcome to the OddsFactory Betting Intelligence Platform. Your bankroll and performance metrics will appear here.
      </p>
    </div>
  )
}
