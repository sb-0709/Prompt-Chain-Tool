'use client'

import { useEffect, useState, useTransition } from 'react'
import { createStep, deleteStep, reorderSteps, updateStep } from '@/app/(tool)/actions'
import { checkStep, remapSteps } from '@/lib/templates'
import type { Model, Step } from '@/lib/types'
import PromptView from './PromptView'
import StepForm from './StepForm'

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d={d} />
  </svg>
)
const UP = 'M10 15V5M5 10l5-5 5 5'
const DOWN = 'M10 5v10M5 10l5 5 5-5'
const GRIP = 'M7 5h.01M13 5h.01M7 10h.01M13 10h.01M7 15h.01M13 15h.01'
const EDIT = 'M13.5 3.5l3 3L7 16H4v-3z'
const TRASH = 'M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10'

export default function StepList({
  chainId,
  initialSteps,
  models,
}: {
  chainId: number
  initialSteps: Step[]
  models: Model[]
}) {
  const [steps, setSteps] = useState(initialSteps)
  const [editingId, setEditingId] = useState<number | 'new' | null>(initialSteps.length === 0 ? 'new' : null)
  const [dragId, setDragId] = useState<number | null>(null)
  const [overId, setOverId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [pending, start] = useTransition()

  // Server data wins whenever it changes (after save / revalidate).
  useEffect(() => setSteps(initialSteps), [initialSteps])

  const modelName = (id: number | null) =>
    id == null ? 'Default model' : models.find((m) => m.id === id)?.name ?? 'Unknown model'

  /** Optimistically move, then save. References like {{step_2}} are renumbered on both sides. */
  const move = (from: number, to: number) => {
    if (to < 0 || to >= steps.length || from === to) return
    const before = steps
    const next = [...steps]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    const map = new Map<number, number | null>(before.map((s) => [s.step_order, next.indexOf(s) + 1]))
    const renumbered = next.map((s, i) => ({
      ...s,
      step_order: i + 1,
      system_prompt: remapSteps(s.system_prompt, map),
      user_prompt_template: remapSteps(s.user_prompt_template, map)!,
    }))
    setSteps(renumbered)
    setError('')
    setStatus(`Moved "${item.name}" to step ${to + 1}.`)
    start(async () => {
      const res = await reorderSteps(chainId, next.map((s) => s.id))
      if (res.error) {
        setSteps(before)
        setError(res.error)
        setStatus('')
      }
    })
  }

  const remove = (s: Step) => {
    if (!confirm(`Delete step ${s.step_order}, "${s.name}"? Later steps move up one place.`)) return
    setError('')
    start(async () => {
      const res = await deleteStep(s.id)
      if (res.error) setError(res.error)
      else setStatus(`Deleted "${s.name}".`)
    })
  }

  return (
    <>
      <p className="sr-only" aria-live="polite">{status}</p>
      {error && <p className="notice notice-error" style={{ marginBottom: 16 }}>{error}</p>}

      {steps.length > 0 && (
        <ol className="rail" aria-label="Steps, in the order they run">
          {steps.map((s, i) => {
            const problems = checkStep([s.system_prompt, s.user_prompt_template], i + 1, steps.length)
            const badVars = problems.map((p) => /\{\{(\w+)\}\}/.exec(p)?.[1]).filter(Boolean) as string[]
            const editing = editingId === s.id
            return (
              <li
                key={s.id}
                onDragOver={(e) => {
                  if (dragId == null) return
                  e.preventDefault()
                  setOverId(s.id)
                }}
                onDragLeave={() => setOverId((o) => (o === s.id ? null : o))}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = steps.findIndex((x) => x.id === dragId)
                  setDragId(null)
                  setOverId(null)
                  if (from >= 0) move(from, i)
                }}
              >
                <span className="node" aria-hidden="true">{i + 1}</span>
                <article
                  className={[
                    'step',
                    dragId === s.id ? 'is-dragging' : '',
                    overId === s.id && dragId !== s.id ? 'is-drop-target' : '',
                  ].join(' ')}
                >
                  <div className="step-head">
                    <div className="step-title">
                      <h3>
                        <span className="sr-only">Step {i + 1}: </span>
                        {s.name}
                      </h3>
                      <div className="step-facts">
                        <span>{modelName(s.model_id)}</span>
                        <span>Temperature {s.temperature ?? 'default'}</span>
                        {s.include_image && <span>Sees the image</span>}
                      </div>
                    </div>
                    {!editing && (
                      <div className="step-tools">
                        <button
                          className="icon-btn drag-handle"
                          draggable
                          onDragStart={(e) => {
                            setDragId(s.id)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnd={() => {
                            setDragId(null)
                            setOverId(null)
                          }}
                          title="Drag to reorder"
                          aria-label={`Drag step ${i + 1}`}
                          tabIndex={-1}
                        >
                          <Icon d={GRIP} />
                        </button>
                        <button className="icon-btn" onClick={() => move(i, i - 1)} disabled={i === 0 || pending} aria-label={`Move "${s.name}" up`} title="Move up">
                          <Icon d={UP} />
                        </button>
                        <button className="icon-btn" onClick={() => move(i, i + 1)} disabled={i === steps.length - 1 || pending} aria-label={`Move "${s.name}" down`} title="Move down">
                          <Icon d={DOWN} />
                        </button>
                        <button className="icon-btn" onClick={() => setEditingId(s.id)} aria-label={`Edit "${s.name}"`} title="Edit">
                          <Icon d={EDIT} />
                        </button>
                        <button className="icon-btn" onClick={() => remove(s)} disabled={pending} aria-label={`Delete "${s.name}"`} title="Delete">
                          <Icon d={TRASH} />
                        </button>
                      </div>
                    )}
                  </div>

                  {editing ? (
                    <StepForm
                      step={s}
                      order={i + 1}
                      stepCount={steps.length}
                      models={models}
                      onCancel={() => setEditingId(null)}
                      onSave={async (v) => {
                        const res = await updateStep(s.id, v)
                        if (!res.error) setEditingId(null)
                        return res
                      }}
                    />
                  ) : (
                    <div className="step-body">
                      {s.system_prompt && (
                        <div>
                          <div className="prompt-label">System prompt</div>
                          <PromptView text={s.system_prompt} bad={badVars} />
                        </div>
                      )}
                      <div>
                        <div className="prompt-label">Prompt</div>
                        <PromptView text={s.user_prompt_template} bad={badVars} />
                      </div>
                      {problems.length > 0 && (
                        <ul className="warn-list">
                          {problems.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              </li>
            )
          })}
        </ol>
      )}

      {editingId === 'new' ? (
        <div className={steps.length ? 'add-step rail-end' : ''}>
          <article className="step">
            <div className="step-head">
              <div className="step-title">
                <h3>New step {steps.length + 1}</h3>
                <div className="step-facts">
                  <span>
                    {steps.length === 0
                      ? 'The first step usually looks at the image.'
                      : 'Use {{previous_output}} or {{step_N}} to build on earlier steps.'}
                  </span>
                </div>
              </div>
            </div>
            <StepForm
              order={steps.length + 1}
              stepCount={steps.length + 1}
              models={models}
              onCancel={() => setEditingId(null)}
              onSave={async (v) => {
                const res = await createStep(chainId, v)
                if (!res.error) {
                  setEditingId(null)
                  setStatus(`Added "${v.name}".`)
                }
                return res
              }}
            />
          </article>
        </div>
      ) : (
        <div className="add-step rail-end" style={steps.length ? undefined : { paddingLeft: 0 }}>
          <button className="btn" onClick={() => setEditingId('new')}>
            Add step
          </button>
        </div>
      )}
    </>
  )
}
