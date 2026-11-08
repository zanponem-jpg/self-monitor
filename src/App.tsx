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

type HistoryRecord = {
  id: string
  date: string
  trackId: string
  note?: string
  unfinished?: string
}

// 新增：未来想做的事项
type BacklogItem = {
  id: string
  title: string
  createdAt: string
}

type AppData = {
  tracks: Track[]
  history: HistoryRecord[]
  backlog: BacklogItem[] // 新增愿望池
  lastWeekStr: string
}

const COLORS = ['bg-orange-500', 'bg-pink-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500']

const formatDate = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getWeekStr = (date = new Date()) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${weekNo}`
}

function App() {
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem('my-monitor-data-v7') // 版本升级
    const currentWeekStr = getWeekStr()

    if (saved) {
      const parsed: AppData = JSON.parse(saved)
      if (parsed.lastWeekStr !== currentWeekStr) {
        parsed.tracks = parsed.tracks.map(t => ({ ...t, currentWeek: 0 }))
        parsed.lastWeekStr = currentWeekStr
      }
      // 兼容旧数据
      if (!parsed.backlog) parsed.backlog = []
      return parsed
    }
    return { tracks: [], history: [], backlog: [], lastWeekStr: currentWeekStr }
  })

  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMinAction, setNewMinAction] = useState('')
  const [newGoal, setNewGoal] = useState(3)

  // 愿望池相关状态
  const [newBacklog, setNewBacklog] = useState('')

  // 打卡相关状态
  const [checkingTrackId, setCheckingTrackId] = useState<string | null>(null)
  const [checkNote, setCheckNote] = useState('')
  const [checkUnfinished, setCheckUnfinished] = useState('')

  const [viewingTrackId, setViewingTrackId] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem('my-monitor-data-v7', JSON.stringify(data))
  }, [data])

  // --- 愿望池逻辑 ---
  const handleAddBacklog = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBacklog.trim()) return
    const item: BacklogItem = {
      id: Date.now().toString(),
      title: newBacklog.trim(),
      createdAt: new Date().toISOString()
    }
    setData(prev => ({ ...prev, backlog: [...prev.backlog, item] }))
    setNewBacklog('')
  }

  const handleDeleteBacklog = (id: string) => {
    setData(prev => ({ ...prev, backlog: prev.backlog.filter(b => b.id !== id) }))
  }

  // 将愿望池的项转为正式目标
  const handleLaunchBacklog = (item: BacklogItem) => {
    if (data.tracks.length >= 3) {
      alert('当前已经有 3 个进行中的目标了。请先完成或删除一个，再从池子里捞取。')
      return
    }
    // 自动带入名称并打开表单
    setNewName(item.title)
    setIsAdding(true)
    // 从愿望池移除
    setData(prev => ({ ...prev, backlog: prev.backlog.filter(b => b.id !== item.id) }))
  }

  // --- 正常目标逻辑 ---
  const getLatestUnfinished = (trackId: string) => {
    const trackHistory = data.history.filter(h => h.trackId === trackId)
    if (trackHistory.length === 0) return null
    return trackHistory[trackHistory.length - 1].unfinished || null
  }

  const submitCheckIn = () => {
    if (!checkingTrackId) return
    const todayStr = formatDate(new Date())
    const recordId = Date.now().toString()

    setData(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => 
        t.id === checkingTrackId ? { ...t, currentWeek: t.currentWeek + 1, total: t.total + 1 } : t
      ),
      history: [...prev.history, { 
        id: recordId, 
        date: todayStr, 
        trackId: checkingTrackId, 
        note: checkNote,
        unfinished: checkUnfinished 
      }]
    }))
    setCheckingTrackId(null)
    setCheckNote('')
    setCheckUnfinished('')
  }

  const handleUndo = (id: string) => {
    const todayStr = formatDate(new Date())
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
        tracks: prev.tracks.filter(t => t.id !== id),
        history: prev.history.filter(h => h.trackId !== id)
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

  const handleExport = () => {
    const dataStr = JSON.stringify(data, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `my-monitor-backup-${formatDate(new Date())}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string)
        if (importedData.tracks && importedData.history) {
          if (!importedData.backlog) importedData.backlog = []
          setData(importedData)
          alert('数据导入成功！')
        } else {
          alert('文件格式不正确。')
        }
      } catch (err) {
        alert('读取文件出错。')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const { tracks, history, backlog } = data
  const totalGoal = tracks.reduce((sum, t) => sum + t.weeklyGoal, 0)
  const totalCurrent = tracks.reduce((sum, t) => sum + t.currentWeek, 0)
  const totalAccumulated = tracks.reduce((sum, t) => sum + t.total, 0)
  const progressPercent = totalGoal === 0 ? 0 : Math.min(Math.round((totalCurrent / totalGoal) * 100), 100)

  const getHeatmapDays = () => {
    const dailyCounts: Record<string, number> = {}
    history.forEach(h => {
      dailyCounts[h.date] = (dailyCounts[h.date] || 0) + 1
    })

    const days = []
    const today = new Date()
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
  const viewingTrack = tracks.find(t => t.id === viewingTrackId)
  const viewingHistory = history.filter(h => h.trackId === viewingTrackId).sort((a, b) => b.id.localeCompare(a.id))
  const currentCheckUnfinished = checkingTrackId ? getLatestUnfinished(checkingTrackId) : null

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
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </header>

        <section className="mb-10 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative">
          <div className="absolute top-4 right-4 flex gap-2">
            <button onClick={handleExport} className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">导出</button>
            <label className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors cursor-pointer">
              导入
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
          </div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 mt-2">真实的坚持轨迹 (过去 20 周)</h2>
          <div className="flex flex-wrap gap-1.5">
            {heatmapDays.map((day, i) => {
              let bgColor = 'bg-gray-100'
              if (day.level === 1) bgColor = 'bg-indigo-200'
              if (day.level === 2) bgColor = 'bg-indigo-400'
              if (day.level === 3) bgColor = 'bg-indigo-600'
              if (day.level === 4) bgColor = 'bg-indigo-800'
              return (
                <div key={i} className={`w-4 h-4 rounded-sm ${bgColor} hover:ring-2 ring-gray-400 transition-all cursor-pointer`} title={`${day.date}: 打卡 ${day.count} 次`} />
              )
            })}
          </div>
        </section>

        <main className="space-y-4 mb-12">
          {tracks.length === 0 && !isAdding && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
              <p className="text-gray-500 mb-4">你还没有添加任何进行中的目标</p>
              <button onClick={() => setIsAdding(true)} className="text-indigo-600 font-medium hover:underline">
                点击添加第一个目标
              </button>
            </div>
          )}

          {tracks.map(track => {
            const trackPercent = Math.min((track.currentWeek / track.weeklyGoal) * 100, 100)
            const isCompleted = track.currentWeek >= track.weeklyGoal
            const latestUnfinished = getLatestUnfinished(track.id)

            return (
              <div key={track.id} className="group bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center gap-4 transition-shadow hover:shadow-md relative">
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-3xl w-12 h-12 flex items-center justify-center bg-gray-50 rounded-xl shrink-0 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setViewingTrackId(track.id)} title="查看记录详情">
                    {track.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="font-semibold text-lg truncate pr-4">{track.name}</h3>
                    </div>
                    <p className="text-xs text-gray-400 mb-1 truncate" title={track.minAction}>💡 {track.minAction}</p>
                    {latestUnfinished && (
                      <p className="text-xs text-orange-500 mb-2 truncate font-medium flex items-center gap-1">
                        <span>📌 待办：</span>{latestUnfinished}
                      </p>
                    )}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                      <div className={`h-full rounded-full transition-all duration-300 ${track.color}`} style={{ width: `${trackPercent}%` }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 mt-2 md:mt-0">
                  <span className="text-sm font-medium text-gray-500">{track.currentWeek} / {track.weeklyGoal}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleUndo(track.id)} disabled={track.currentWeek === 0} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors">-</button>
                    <button onClick={() => setCheckingTrackId(track.id)} className={`px-6 py-2 h-10 rounded-xl font-medium transition-all ${isCompleted ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200'}`}>
                      {isCompleted ? '已达标 ✅' : '打卡'}
                    </button>
                  </div>
                </div>
                <button onClick={() => handleDelete(track.id)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-200 z-10">×</button>
              </div>
            )
          })}
          
          {isAdding ? (
            <form onSubmit={handleAddSubmit} className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 border-dashed space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <input type="text" placeholder="目标名称" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" required autoFocus />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 whitespace-nowrap">周目标:</span>
                  <input type="number" min="1" max="14" value={newGoal} onChange={(e) => setNewGoal(Number(e.target.value))} className="w-20 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-500">次</span>
                </div>
              </div>
              <div>
                <input type="text" placeholder="最小行动（如：打开书看 1 页）" value={newMinAction} onChange={(e) => setNewMinAction(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-50 rounded-xl">取消</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm">确定</button>
              </div>
            </form>
          ) : (
            tracks.length < 3 && (
              <button onClick={() => setIsAdding(true)} className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 font-medium">
                + 添加新目标（最多 3 个）
              </button>
            )
          )}
        </main>

        {/* --- 新增模块：愿望清单 (Backlog) --- */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              💡 愿望清单 <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{backlog.length} 个想法</span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">把想学但暂时没空学的都扔在这里。等上面腾出空位了，再捞出来。</p>
          </div>

          <form onSubmit={handleAddBacklog} className="flex gap-2 mb-4">
            <input 
              type="text" 
              placeholder="未来想做的事（如：学 Swift、读《人类简史》...）" 
              value={newBacklog}
              onChange={(e) => setNewBacklog(e.target.value)}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400 text-sm"
            />
            <button type="submit" className="px-4 py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-900 transition-colors text-sm font-medium">
              收集
            </button>
          </form>

          {backlog.length > 0 ? (
            <ul className="space-y-2">
              {backlog.map(item => (
                <li key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                  <span className="text-sm text-gray-700 truncate mr-4">{item.title}</span>
                  <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleLaunchBacklog(item)}
                      className="text-xs px-2.5 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium flex items-center gap-1"
                      title="将此项设为当前专注目标"
                    >
                      🚀 启动
                    </button>
                    <button 
                      onClick={() => handleDeleteBacklog(item.id)}
                      className="text-xs text-gray-400 hover:text-red-500 p-1"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">池子空空如也，在这里收集你的灵感吧。</p>
          )}
        </section>
      </div>

      {/* --- 弹窗 1：打卡备注与遗留任务 --- */}
      {checkingTrackId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">今天的学习记录</h3>
            
            {currentCheckUnfinished && (
              <div className="mb-4 bg-orange-50 border border-orange-100 p-3 rounded-xl">
                <p className="text-xs text-orange-600 font-semibold mb-1">📌 上次你留下了这个：</p>
                <p className="text-sm text-orange-800">{currentCheckUnfinished}</p>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <textarea 
                autoFocus placeholder="今天学了什么？（可留空）" value={checkNote} onChange={(e) => setCheckNote(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-h-[80px] resize-y"
              />
              <textarea 
                placeholder="⏭️ 没做完/下次继续做什么？" value={checkUnfinished} onChange={(e) => setCheckUnfinished(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-gray-50 min-h-[80px] resize-y"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitCheckIn() }}
              />
            </div>

            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-400">按 Ctrl + Enter 快速提交</span>
              <div className="flex gap-2">
                <button onClick={() => setCheckingTrackId(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">取消</button>
                <button onClick={submitCheckIn} className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm transition-colors">确认打卡</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- 弹窗 2：查看节点/时间线 --- */}
      {viewingTrackId && viewingTrack && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setViewingTrackId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{viewingTrack.emoji}</span>
                <div>
                  <h2 className="text-xl font-bold">{viewingTrack.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">累计完成 {viewingTrack.total} 次</p>
                </div>
              </div>
              <button onClick={() => setViewingTrackId(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-white">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">我的行动节点</h4>
              {viewingHistory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">还没有任何记录，去打个卡吧。</p>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                  {viewingHistory.map((record) => (
                    <div key={record.id} className="relative flex items-start gap-4 pl-6">
                      <div className="absolute left-0 top-1.5 w-4 h-4 bg-indigo-100 border-2 border-indigo-500 rounded-full -translate-x-1/2"></div>
                      <div className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-gray-500">{record.date}</span>
                        </div>
                        <p className="text-sm text-gray-700">{record.note || '完成了打卡（无备注）。'}</p>
                        {record.unfinished && (
                          <p className="text-xs text-orange-500 mt-2 bg-orange-50 p-1.5 rounded-md">⏭️ 遗留：{record.unfinished}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App