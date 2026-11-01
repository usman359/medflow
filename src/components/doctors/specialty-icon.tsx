import { Baby, Bone, Brain, Eye, Flower2, HeartPulse, Sparkles, Stethoscope, type LucideProps } from "lucide-react"

const ICONS = {
  stethoscope: Stethoscope,
  "heart-pulse": HeartPulse,
  sparkles: Sparkles,
  baby: Baby,
  bone: Bone,
  "flower-2": Flower2,
  brain: Brain,
  eye: Eye,
} as const

/** Renders the lucide icon stored by name on a specialty; unknown names fall back to a stethoscope. */
export function SpecialtyIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? Stethoscope
  return <Icon aria-hidden="true" {...props} />
}
