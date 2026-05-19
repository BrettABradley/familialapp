/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Familial'

interface Props {
  senderName?: string
  conversationName?: string // for group chats
  messageCount?: number
  url?: string
}

const UnseenMessageEmail = ({
  senderName = 'Someone',
  conversationName,
  messageCount = 1,
  url = 'https://www.familialmedia.com/messages',
}: Props) => {
  const where = conversationName ? `in ${conversationName}` : 'for you'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{senderName} sent you {messageCount > 1 ? `${messageCount} messages` : 'a message'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>You have unread {messageCount > 1 ? 'messages' : 'a message'}</Heading>
          <Text style={text}>
            <strong>{senderName}</strong> sent {messageCount > 1 ? `${messageCount} messages` : 'a message'} {where} on {SITE_NAME} an hour ago and you haven't read them yet.
          </Text>
          <Button style={button} href={url}>Open Messages</Button>
          <Text style={footer}>You can turn off these unread-message reminders in your {SITE_NAME} settings.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: UnseenMessageEmail,
  subject: (d: Record<string, any>) => `${d.senderName || 'Someone'} sent you ${d.messageCount > 1 ? 'new messages' : 'a message'} on ${SITE_NAME}`,
  displayName: 'Unread message reminder',
  previewData: { senderName: 'Mom', messageCount: 3, url: 'https://www.familialmedia.com/messages' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 16px' }
const text = { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#333333', lineHeight: '1.55', margin: '0 0 22px' }
const button = { backgroundColor: '#000000', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 22px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#999999', margin: '32px 0 0' }
