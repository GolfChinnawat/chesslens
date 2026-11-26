export const onlineEnabled =
  import.meta.env.VITE_ONLINE_ROOMS !== 'false' &&
  !!import.meta.env.VITE_SUPABASE_URL
