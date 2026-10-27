import { z } from 'zod'

/**
 * zod 3 answered "Required" for a missing value; zod 4 says "Invalid input: expected string,
 * received undefined". Restore the old text for missing values (UI forms and 400 bodies show it)
 * and fall through to zod's default for everything else. Imported for its side effect by the
 * validator modules.
 */
z.config({
  customError: (iss) => (iss.code === 'invalid_type' && iss.input === undefined ? 'Required' : undefined),
})
