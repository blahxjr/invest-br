/**
 * Tipo padrão de retorno para Server Actions que retornam dados.
 * Actions que apenas executam efeitos e redirecionam (redirect) não precisam desse tipo.
 */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: 'UNAUTHORIZED' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'UNKNOWN' }
