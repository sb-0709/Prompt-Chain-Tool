'use client'

import { useRef, useState, useTransition } from 'react'
import type { StepInput } from '@/app/(tool)/actions'
import { checkStep } from '@/lib/templates'
import type { Model, Step } from '@/lib/types'

export default function StepForm({
  step,
  order,
  stepCount,
  models,
  onSave,
  onCancel,
}: {
  step?: Step
  order: number
  stepCount: number
  models: Model[]
  onSave: (v: StepInput) => Promise<{ error?: string }>
  onCancel: () => void
}) {
  const [name, setName] = useState(step?.name ?? '')
  const [modelId, setModelId] = useState<string>(
    step ? String(step.model_id ?? '') : String(models.find((m) => m.is_active)?.id ?? '')
  )
  const [temperature, setTemperature] = useState(step?.temperature != null ? String(step.temperature) : '0.7')
  const [includeImage, setIncludeImage] = useState(step?.include_image ?? order === 1)
  const [system, setSystem] = useState(step?.system_prompt ?? '')
  const [template, setTemplate] = useState(step?.user_prompt_template ?? '')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  const systemRef = useRef<HTMLTextAreaElement>(null)
  const templateRef = useRef<HTMLTextAreaElement>(null)
  const lastFocused = useRef<'system' | 'template'>('template')

  const problems = checkStep([system, template], order, stepCount)
  const model = models.find((m) => String(m.id) === modelId)

  const vars = [
    'user_prompt',
    ...(order > 1 ? ['previous_output'] : []),
    ...Array.from({ length: order - 1 }, (_, i) => `step_${i + 1}`),
  ]

  const insert = (v: string) => {
    const which = lastFocused.current
    const el = which === 'system' ? systemRef.current : templateRef.current
    const value = which === 'system' ? system : template
    const set = which === 'system' ? setSystem : setTemplate
    const token = `{{${v}}}`
    const at = el ? el.selectionStart : value.length
    const end = el ? el.selectionEnd : value.length
    set(value.slice(0, at) + token + value.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + token.length, at + token.length)
    })
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    start(async () => {
      const res = await onSave({
        name,
        model_id: modelId ? Number(modelId) : null,
        system_prompt: system,
        user_prompt_template: template,
        temperature: temperature === '' ? null : Number(temperature),
        include_image: includeImage,
      })
      if (res.error) setError(res.error)
    })
  }

  return (
    <form className="step-body form-grid" onSubmit={submit} style={{ paddingTop: step ? 0 : 16 }}>
      <label className="field">
        Step name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus={!step}
          placeholder="e.g. Describe the image"
        />
      </label>

      <div className="form-row">
        <label className="field">
          Model
          <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
            <option value="">Default (gemini-3.8-flash)</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.is_active ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>
            Temperature <span className="field-hint">0 = focused, 2 = wild</span>
          </span>
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
        </label>
      </div>

      <label className="check">
        <input type="checkbox" checked={includeImage} onChange={(e) => setIncludeImage(e.target.checked)} />
        <span>
          Send the image to this step
          {includeImage && model && !model.supports_vision && (
            <span className="field-hint"> · {model.name} is marked as not supporting images</span>
          )}
        </span>
      </label>

      <label className="field">
        <span>
          System prompt <span className="field-hint">(optional) who the model should be</span>
        </span>
        <textarea
          ref={systemRef}
          className="prompt"
          rows={2}
          value={system}
          onFocus={() => (lastFocused.current = 'system')}
          onChange={(e) => setSystem(e.target.value)}
          placeholder="You are a stand-up comedian…"
        />
      </label>

      <label className="field">
        <span>
          Prompt <span className="field-hint">what this step should do</span>
        </span>
        <textarea
          ref={templateRef}
          className="prompt"
          rows={5}
          value={template}
          onFocus={() => (lastFocused.current = 'template')}
          onChange={(e) => setTemplate(e.target.value)}
          required
          placeholder={
            order === 1
              ? 'Describe this image in 3–4 sentences.'
              : 'Take this description:\n\n{{previous_output}}\n\nand write something funny about it.'
          }
        />
      </label>

      <div className="var-picker">
        <span className="muted">Insert:</span>
        {vars.map((v) => (
          <button type="button" key={v} onClick={() => insert(v)} title={describeVar(v)}>
            {`{{${v}}}`}
          </button>
        ))}
      </div>

      {problems.length > 0 && (
        <ul className="warn-list">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {error && <p className="notice notice-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : step ? 'Save step' : 'Add step'}
        </button>
      </div>
    </form>
  )
}

function describeVar(v: string) {
  if (v === 'user_prompt') return 'The text typed on the Run page'
  if (v === 'previous_output') return 'Output of the step right before this one'
  return `Output of step ${v.slice(5)}`
}
