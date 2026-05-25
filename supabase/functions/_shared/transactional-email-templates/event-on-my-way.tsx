/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Familial'

interface Props {
  actorName?: string
  eventTitle?: string
  circleName?: string
  url?: string
}

const EventOnMyWayEmail = ({
  actorName = 'Someone',
  eventTitle = 'your event',
  circleName,
  url = 'https://www.familialmedia.com/events',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{actorName} is on the way to {eventTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Someone's on the way</Heading>
        <Text style={text}>
          <strong>{actorName}</strong> is on the way to <strong>"{eventTitle}"</strong>
          {circleName ? <> in <strong>{circleName}</strong></> : null}.
        </Text>
        <Text style={text}>
          No ETA, no location tracking — just a heads-up so you can be ready.
        </Text>
        <Button style={button} href={url}>View Event</Button>
        <Text style={footer}>You're getting this because you created this event on {SITE_NAME}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EventOnMyWayEmail,
  subject: (d: Record<string, any>) => `${d.actorName || 'Someone'} is on the way to "${d.eventTitle || 'your event'}"`,
  displayName: 'Event — on the way',
  previewData: { actorName: 'Mom', eventTitle: 'Sunday Dinner', circleName: 'The Bradleys', url: 'https://www.familialmedia.com/events' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 16px' }
const text = { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#333333', lineHeight: '1.55', margin: '0 0 16px' }
const button = { backgroundColor: '#000000', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 22px', textDecoration: 'none', display: 'inline-block', marginTop: '8px' }
const footer = { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#999999', margin: '32px 0 0' }
