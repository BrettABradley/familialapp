/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Familial'

interface Props {
  actorName?: string
  circleName?: string
  context?: string // "a post" / "a comment"
  snippet?: string
  url?: string
}

const MentionNotificationEmail = ({
  actorName = 'Someone',
  circleName = 'your circle',
  context = 'a post',
  snippet,
  url = 'https://www.familialmedia.com',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{actorName} mentioned you in {circleName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You were mentioned</Heading>
        <Text style={text}>
          <strong>{actorName}</strong> tagged you in {context} in <strong>{circleName}</strong>.
        </Text>
        {snippet && <Text style={quote}>"{snippet}"</Text>}
        <Button style={button} href={url}>View on {SITE_NAME}</Button>
        <Text style={footer}>You're getting this because you have mention email notifications turned on in your {SITE_NAME} settings.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MentionNotificationEmail,
  subject: (d: Record<string, any>) => `${d.actorName || 'Someone'} mentioned you on ${SITE_NAME}`,
  displayName: 'Mention notification',
  previewData: { actorName: 'Sarah', circleName: 'The Bradleys', context: 'a post', snippet: 'Hey @you, look at this!', url: 'https://www.familialmedia.com/feed' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 16px' }
const text = { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#333333', lineHeight: '1.55', margin: '0 0 18px' }
const quote = { fontFamily: 'Georgia, serif', fontStyle: 'italic' as const, fontSize: '15px', color: '#555555', borderLeft: '3px solid #000000', padding: '8px 14px', margin: '0 0 22px' }
const button = { backgroundColor: '#000000', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 22px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#999999', margin: '32px 0 0' }
