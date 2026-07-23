import { FunctionsHttpError } from '@supabase/supabase-js'

/** Parse JSON error bodies from non-2xx Supabase Edge Function responses. */
export async function readFunctionError(error: FunctionsHttpError): Promise<string> {
  try {
    const body = await error.context.json()
    const parsed = body as { errors?: string[]; error?: string; message?: string }
    if (Array.isArray(parsed.errors) && parsed.errors.length) return parsed.errors.join(' ')
    if (parsed.error) return parsed.error
    if (parsed.message) return parsed.message
  } catch {
    /* not JSON — fall through */
  }
  return error.message
}

export async function throwFunctionInvokeError(error: unknown): Promise<never> {
  if (error instanceof FunctionsHttpError) {
    throw new Error(await readFunctionError(error))
  }
  throw error instanceof Error ? error : new Error(String(error))
}
