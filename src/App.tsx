import { useState, useEffect } from 'react'

type Track = {
  id: string
  name: string
  emoji: string
  color: string
  weeklyGoal: number
  currentWeek: number
  total: number
  minAction: string
}

// 新增：打卡记录
type HistoryRecord = {
  date: string // 格式: 'YYYY-MM-DD'
  trackId: string
}

// 新增：包含所有状态的数据结构
type AppData = {
  tracks: Track[]
  history: HistoryRecord[]
  lastWeekStr: string // 记录上次登录是哪一周，用于判断跨周
}

const COLORS = ['bg-orange-500', 'bg-pink-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500']

// --- 时间工具函数 ---
const formatDate = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取当前周的唯一标识（例如 "2023-W42"）
const getWeekStr = (date = new Date()) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${weekNo}`
}

function App() {
  // 统一管理状态
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem('my-monitor-data-v4')
    const currentWeekStr = getWeekStr()

    if (saved) {
      const parsed: AppData = JSON.parse(saved)
      
      // 核心逻辑：检查是否跨周。如果跨周了，自动把本周进度清零
      if (parsed.lastWeekStr !== currentWeekStr) {
        parsed.tracks = parsed.tracks.map(t => ({ ...t, currentWeek: 0 }))
        parsed.lastWeekStr = currentWeekStr
      }
      return parsed
    }

    return { tracks: [], history: [], lastWeekStr: currentWeekStr }
  })

  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMinAction, setNewMinAction] = useState('')
  const [newGoal, setNewGoal] = useState(3)

  useEffect(() => {
    localStorage.setItem('my-monitor-data-v4', JSON.stringify(data))
  }, [data])

  const handleCheckIn = (id: string) => {
    const todayStr = formatDate(new Date())
    setData(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => 
        t.id === id ? { ...t, currentWeek: t.currentWeek + 1, total: t.total + 1 } : t
      ),
      // 把今天的打卡记录追加到历史流水里
      history: [...prev.history, { date: todayStr, trackId: id }]
    }))
  }

  const handleUndo = (id: string) => {
    const todayStr = formatDate(new Date())
    // 找今天这个目标最后一条记录删掉
    const reversedIndex = [...data.history].reverse().findIndex(h => h.trackId === id && h.date === todayStr)
    let newHistory = [...data.history]
    
    if (reversedIndex !== -1) {
      const realIndex = data.history.length - 1 - reversedIndex
      newHistory.splice(realIndex, 1)
    }

    setData(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => 
        t.id === id && t.currentWeek > 0 ? { ...t, currentWeek: t.currentWeek - 1, total: Math.max(0, t.total - 1) } : t
      ),
      history: newHistory
    }))
  }

  const handleDelete = (id: string) => {
    if (confirm('确定要放弃这个目标吗？历史记录也会一并删除。')) {
      setData(prev => ({
        ...prev,
        tracks: prev.tracks.filter(t => t.id !== id)
      }))
    }
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    if (data.tracks.length >= 3) return

    const newTrack: Track = {
      id: Date.now().toString(),
      name: newName.trim(),
      emoji: '🎯',
      color: COLORS[data.tracks.length % COLORS.length],
      weeklyGoal: newGoal,
      currentWeek: 0,
      total: 0,
      minAction: newMinAction.trim() || '只要开始做 5 分钟就算成功'
    }

    setData(prev => ({ ...prev, tracks: [...prev.tracks, newTrack] }))
    setIsAdding(false)
    setNewName('')
    setNewMinAction('')
    setNewGoal(3)
  }

  // --- 数据统计区 ---
  const { tracks, history } = data
  const totalGoal = tracks.reduce((sum, t) => sum + t.weeklyGoal, 0)
  const totalCurrent = tracks.reduce((sum, t) => sum + t.currentWeek, 0)
  const totalAccumulated = tracks.reduce((sum, t) => sum + t.total, 0)
  const progressPercent = totalGoal === 0 ? 0 : Math.min(Math.round((totalCurrent / totalGoal) * 100), 100)

  // --- 真实热力图数据生成 ---
  const getHeatmapDays = () => {
    // 统计每天打了多少次卡
    const dailyCounts: Record<string, number> = {}
    history.forEach(h => {
      dailyCounts[h.date] = (dailyCounts[h.date] || 0) + 1
    })

    const days = []
    const today = new Date()
    // 往前推 140 天 (20周)
    for (let i = 139; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateStr = formatDate(d)
      const count = dailyCounts[dateStr] || 0
      
      let level = 0
      if (count === 1) level = 1
      else if (count === 2) level = 2
      else if (count === 3) level = 3
      else if (count >= 4) level = 4

      days.push({ date: dateStr, count, level })
    }
    return days
  }

  const heatmapDays = getHeatmapDays()

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans text-gray-800">
      <div className="max-w-4xl mx-auto">
        
        <header className="mb-8 flex flex-col md:flex-row gap-6 md:items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">我的专注面板</h1>
            <p className="text-gray-500 mt-2 flex items-center gap-2">
              <span>本周进度 {progressPercent}%</span>
              <span className="text-gray-300">|</span>
              <span className="text-indigo-600 font-medium">累计积累 {totalAccumulated} 次</span>
            </p>
          </div>
          
          <div className="w-full md:w-1/2">
            <div className="flex justify-between text-sm mb-2 text-gray-500 font-medium">
              <span>本周已打卡 {totalCurrent} 次</span>
              <span>目标 {totalGoal} 次</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </header>

        {/* 真实热力图 */}
        <section className="mb-10 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">真实的坚持轨迹 (过去 20 周)</h2>
            <span className="text-xs text-gray-400">今天：{formatDate(new Date())}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {heatmapDays.map((day, i) => {
              let bgColor = 'bg-gray-100'
              if (day.level === 1) bgColor = 'bg-indigo-200'
              if (day.level === 2) bgColor = 'bg-indigo-400'
              if (day.level === 3) bgColor = 'bg-indigo-600'
              if (day.level === 4) bgColor = 'bg-indigo-800'
              
              return (
                <div 
                  key={i} 
                  className={`w-4 h-4 rounded-sm ${bgColor} hover:ring-2 ring-gray-400 transition-all cursor-pointer`}
                  title={`${day.date}: 打卡 ${day.count} 次`}
                />
              )
            })}
          </div>
          <div className="flex justify-end items-center gap-2 mt-4 text-xs text-gray-400">
            <span>少</span>
            <div className="w-3 h-3 rounded-sm bg-gray-100" />
            <div className="w-3 h-3 rounded-sm bg-indigo-200" />
            <div className="w-3 h-3 rounded-sm bg-indigo-400" />
            <div className="w-3 h-3 rounded-sm bg-indigo-600" />
            <div className="w-3 h-3 rounded-sm bg-indigo-800" />
            <span>多</span>
          </div>
        </section>

        <main className="space-y-4">
          {tracks.length === 0 && !isAdding && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
              <p className="text-gray-500 mb-4">你还没有添加任何目标</p>
              <button onClick={() => setIsAdding(true)} className="text-indigo-600 font-medium hover:underline">
                点击添加第一个目标
              </button>
            </div>
          )}

          {tracks.map(track => {
            const trackPercent = Math.min((track.currentWeek / track.weeklyGoal) * 100, 100)
            const isCompleted = track.currentWeek >= track.weeklyGoal

            return (
              <div key={track.id} className="group bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center gap-4 transition-shadow hover:shadow-md relative">
                
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-3xl w-12 h-12 flex items-center justify-center bg-gray-50 rounded-xl shrink-0">
                    {track.emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="font-semibold text-lg truncate pr-4">{track.name}</h3>
                    </div>
                    <p className="text-xs text-gray-400 mb-2 truncate" title={track.minAction}>
                      💡 {track.minAction}
                    </p>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${track.color}`}
                        style={{ width: `${trackPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 mt-2 md:mt-0">
                  <span className="text-sm font-medium text-gray-500">
                    {track.currentWeek} / {track.weeklyGoal}
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleUndo(track.id)}
                      disabled={track.currentWeek === 0}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                    >
                      -
                    </button>
                    <button 
                      onClick={() => handleCheckIn(track.id)}
                      className={`px-6 py-2 h-10 rounded-xl font-medium transition-all ${
                        isCompleted 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200'
                      }`}
                    >
                      {isCompleted ? '已达标 ✅' : '打卡'}
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => handleDelete(track.id)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-200 z-10"
                >
                  ×
                </button>
              </div>
            )
          })}

          {isAdding ? (
            <form onSubmit={handleAddSubmit} className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 border-dashed space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <input 
                  type="text" placeholder="目标名称" value={newName} onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" required autoFocus
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 whitespace-nowrap">周目标:</span>
                  <input 
                    type="number" min="1" max="14" value={newGoal} onChange={(e) => setNewGoal(Number(e.target.value))}
                    className="w-20 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-500">次</span>
                </div>
              </div>
              <div>
                <input 
                  type="text" placeholder="最小行动（如：打开书看 1 页）" value={newMinAction} onChange={(e) => setNewMinAction(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-50 rounded-xl">取消</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm">确定</button>
              </div>
            </form>
          ) : (
            tracks.length < 3 && (
              <button 
                onClick={() => setIsAdding(true)}
                className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                + 添加新目标（最多 3 个）
              </button>
            )
          )}
        </main>
      </div>
    </div>
  )
}

export default App