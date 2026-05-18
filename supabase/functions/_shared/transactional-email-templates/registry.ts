/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

// Templates are managed in the `email_templates` database table and rendered
// in the project's existing send-* edge functions. The send-transactional-email
// function isn't used by this project — kept here only so it deploys cleanly.
export const TEMPLATES: Record<string, TemplateEntry> = {}
