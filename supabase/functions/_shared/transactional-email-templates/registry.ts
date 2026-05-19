/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as mentionNotification } from './mention-notification.tsx'
import { template as unseenMessage } from './unseen-message.tsx'
import { template as newAlbum } from './new-album.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'mention-notification': mentionNotification,
  'unseen-message': unseenMessage,
  'new-album': newAlbum,
}
