/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Familial'

interface Props {
  actorName?: string
  albumTitle?: string
  circleName?: string
  photoCount?: number
  url?: string
}

const NewAlbumEmail = ({
  actorName = 'Someone',
  albumTitle = 'a new album',
  circleName = 'your circle',
  photoCount,
  url = 'https://www.familialmedia.com/albums',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{actorName} shared "{albumTitle}" in {circleName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New album in {circleName}</Heading>
        <Text style={text}>
          <strong>{actorName}</strong> just shared a new album, <strong>"{albumTitle}"</strong>
          {photoCount ? `, with ${photoCount} photo${photoCount === 1 ? '' : 's'}` : ''}.
        </Text>
        <Button style={button} href={url}>View Album</Button>
        <Text style={footer}>You're getting this because you're a member of {circleName} on {SITE_NAME}. You can turn off new-album emails in your settings.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewAlbumEmail,
  subject: (d: Record<string, any>) => `${d.actorName || 'Someone'} shared "${d.albumTitle || 'a new album'}" on ${SITE_NAME}`,
  displayName: 'New album',
  previewData: { actorName: 'Dad', albumTitle: 'Summer 2026', circleName: 'The Bradleys', photoCount: 24, url: 'https://www.familialmedia.com/albums' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 16px' }
const text = { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#333333', lineHeight: '1.55', margin: '0 0 22px' }
const button = { backgroundColor: '#000000', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 22px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#999999', margin: '32px 0 0' }
