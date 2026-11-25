// Enabled by default. Set VITE_OPENING_TRAINER=false at build time to disable.
export const openingTrainerEnabled =
  import.meta.env.VITE_OPENING_TRAINER !== 'false'
