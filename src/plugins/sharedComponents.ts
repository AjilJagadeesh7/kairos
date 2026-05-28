/**
 * Public component API surface exposed to plugin authors via api.components.
 * Only add exports here intentionally — this is a stable public contract.
 * Plugins receive these so they don't need to bundle React or Kairos UI themselves.
 */

// Atoms
export { Button } from '../components/atoms/Button'
export { Pill } from '../components/atoms/Pill'
export { PriorityDot } from '../components/atoms/PriorityDot'
export { ProgressBar } from '../components/atoms/ProgressBar'
export { Select } from '../components/atoms/Select'
export { TagBadge } from '../components/atoms/TagBadge'
export { TagChip } from '../components/atoms/TagChip'

// Molecules
export { SectionCard } from '../components/molecules/SectionCard'
export { Field } from '../components/molecules/Field'
export { Dropdown } from '../components/molecules/Dropdown'
export { ColorPicker } from '../components/molecules/ColorPicker'
