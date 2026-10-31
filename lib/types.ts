export type Model = {
  id: number
  name: string
  model_id: string
  supports_vision: boolean
  is_active: boolean
}

export type Step = {
  id: number
  chain_id: number
  step_order: number
  name: string
  model_id: number | null
  system_prompt: string | null
  user_prompt_template: string
  temperature: number | null
  include_image: boolean
}

export type Chain = {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}
