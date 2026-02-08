'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useSWR, { mutate } from 'swr'
import { useSocket } from '@/hooks/use-socket'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { Task } from '@/lib/db'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const columns = [
  { id: 'backlog', label: 'Backlog', color: '#5c6280' },
  { id: 'running', label: 'Running', color: '#ff6b35' },
  { id: 'review', label: 'Needs Review', color: '#ffb545' },
  { id: 'done', label: 'Done', color: '#00ddb3' },
] as const

const priorityColors = {
  high: 'border-l-orange',
  med: 'border-l-pink',
  low: 'border-l-teal',
}

const priorityLabels = { high: 'High', med: 'Medium', low: 'Low' }

export default function TasksPage() {
  const { data: tasks = [] } = useSWR<Task[]>('/api/tasks', fetcher)
  const { on } = useSocket()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'med', skill: '' })
  const [draggedTask, setDraggedTask] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  useEffect(() => {
    const unsub = on('task:update', () => {
      mutate('/api/tasks')
    })
    return () => { unsub() }
  }, [on])

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask),
    })
    setNewTask({ title: '', description: '', priority: 'med', skill: '' })
    setDialogOpen(false)
    mutate('/api/tasks')
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    setDragOverColumn(columnId)
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    if (!draggedTask) return
    await fetch(`/api/tasks/${draggedTask}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setDraggedTask(null)
    setDragOverColumn(null)
    mutate('/api/tasks')
  }

  const totalTasks = tasks.length

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-text-1">Tasks</h1>
          <p className="text-text-3 text-sm mt-0.5">{totalTasks} total tasks</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 1V13M1 7H13" />
              </svg>
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm text-text-2 mb-1.5 block">Title</label>
                <input
                  value={newTask.title}
                  onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                  placeholder="What needs to be done?"
                  className="w-full bg-bg-4 border border-border rounded-xl px-3 py-2 text-sm text-text-1 placeholder:text-text-3 outline-none focus:border-border-hi"
                />
              </div>
              <div>
                <label className="text-sm text-text-2 mb-1.5 block">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                  placeholder="Add details..."
                  rows={3}
                  className="w-full bg-bg-4 border border-border rounded-xl px-3 py-2 text-sm text-text-1 placeholder:text-text-3 outline-none focus:border-border-hi resize-none"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm text-text-2 mb-1.5 block">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
                    className="w-full bg-bg-4 border border-border rounded-xl px-3 py-2 text-sm text-text-1 outline-none focus:border-border-hi cursor-pointer"
                  >
                    <option value="high">High</option>
                    <option value="med">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm text-text-2 mb-1.5 block">Skill</label>
                  <input
                    value={newTask.skill}
                    onChange={e => setNewTask(p => ({ ...p, skill: e.target.value }))}
                    placeholder="Optional"
                    className="w-full bg-bg-4 border border-border rounded-xl px-3 py-2 text-sm text-text-1 placeholder:text-text-3 outline-none focus:border-border-hi"
                  />
                </div>
              </div>
              <Button onClick={handleCreateTask} className="w-full">Create Task</Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 h-full min-w-[900px]">
          {columns.map((col, colIdx) => {
            const colTasks = tasks.filter(t => t.status === col.id)
            return (
              <motion.div
                key={col.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: colIdx * 0.05 }}
                className={`
                  flex-1 flex flex-col rounded-2xl bg-bg-1 border border-border p-3 min-w-[220px]
                  ${dragOverColumn === col.id ? 'border-orange/40 bg-orange/5' : ''}
                `}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="text-sm font-semibold text-text-1">{col.label}</span>
                  <span className="text-xs text-text-3 bg-bg-3 rounded-full px-2 py-0.5 ml-auto">
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto space-y-2">
                  <AnimatePresence>
                    {colTasks
                      .sort((a, b) => a.column_order - b.column_order)
                      .map((task) => (
                        <motion.div
                          key={task.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          draggable
                          onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, task.id)}
                          className={`
                            bg-bg-2 border border-border rounded-xl p-3 cursor-grab active:cursor-grabbing
                            card-hover border-l-[3px] ${priorityColors[task.priority]}
                            ${draggedTask === task.id ? 'opacity-40' : ''}
                          `}
                        >
                          <h3 className="text-sm font-medium text-text-1 mb-1.5">{task.title}</h3>

                          {/* Progress bar for running tasks */}
                          {task.status === 'running' && (
                            <div className="mb-2">
                              <div className="flex justify-between text-xs text-text-3 mb-1">
                                <span>Progress</span>
                                <span>{task.progress}%</span>
                              </div>
                              <div className="h-1.5 bg-bg-4 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full bg-gradient-to-r from-orange to-pink"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${task.progress}%` }}
                                  transition={{ duration: 0.5 }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Tags */}
                          {task.tags && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {JSON.parse(task.tags).map((tag: string) => (
                                <span
                                  key={tag}
                                  className="text-[10px] font-medium bg-bg-4 text-text-3 rounded-md px-1.5 py-0.5"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Priority indicator */}
                          <div className="flex items-center justify-between mt-2">
                            <span className={`text-[10px] font-medium ${
                              task.priority === 'high' ? 'text-orange' :
                              task.priority === 'med' ? 'text-pink' : 'text-teal'
                            }`}>
                              {priorityLabels[task.priority]}
                            </span>
                            {task.skill && (
                              <span className="text-[10px] text-text-3">{task.skill}</span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                  </AnimatePresence>
                </div>

                {/* Add task button */}
                <button
                  onClick={() => {
                    setNewTask(p => ({ ...p, title: '' }))
                    setDialogOpen(true)
                  }}
                  className="mt-2 w-full py-2 border border-dashed border-border rounded-xl text-text-3 text-xs hover:border-border-hi hover:text-text-2 transition-colors cursor-pointer"
                >
                  + Add task
                </button>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
