'use client'

import { motion } from 'framer-motion'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import type { Skill } from '@/lib/db'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const categoryColors: Record<string, string> = {
  core: 'bg-orange/10 text-orange border-orange/20',
  comms: 'bg-pink/10 text-pink border-pink/20',
  storage: 'bg-teal/10 text-teal border-teal/20',
  dev: 'bg-[#6366f1]/10 text-[#6366f1] border-[#6366f1]/20',
  finance: 'bg-warn/10 text-warn border-warn/20',
}

export default function SkillsPage() {
  const { data: skills = [] } = useSWR<Skill[]>('/api/skills', fetcher)

  const activeCount = skills.filter(s => s.active).length

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-[1100px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="text-2xl font-bold text-text-1">Skills</h1>
            <p className="text-text-3 text-sm mt-0.5">
              {activeCount} active of {skills.length} installed
            </p>
          </div>
          <Button variant="secondary">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="6" />
              <path d="M4 7H10M7 4V10" />
            </svg>
            Browse ClawHub
          </Button>
        </motion.div>

        {/* Skills Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill, i) => (
            <motion.div
              key={skill.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`
                bg-bg-2 border border-border rounded-2xl p-5 card-hover relative
                ${!skill.active ? 'opacity-50' : ''}
              `}
            >
              {/* Status dot */}
              <div className="absolute top-4 right-4">
                <div className={`
                  w-2.5 h-2.5 rounded-full
                  ${skill.active ? 'bg-teal status-pulse text-teal' : 'bg-text-3'}
                `} />
              </div>

              {/* Icon + Name */}
              <div className="flex items-start gap-3 mb-3">
                <div className="text-3xl">{skill.icon}</div>
                <div>
                  <h3 className="text-sm font-semibold text-text-1">{skill.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-text-3 bg-bg-4 rounded px-1.5 py-0.5">
                      v{skill.version}
                    </span>
                    {skill.category && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                        categoryColors[skill.category] || 'bg-bg-4 text-text-3 border-border'
                      }`}>
                        {skill.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-text-3 leading-relaxed line-clamp-2">
                {skill.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
