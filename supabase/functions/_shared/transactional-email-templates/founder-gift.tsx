/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Familial'

interface Props {
  name?: string
}

const FounderGiftEmail = ({ name }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A small thank-you from the founder of {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{name ? `Thank you, ${name}` : 'Thank you'}</Heading>
        <Text style={text}>
          I just wanted to reach out personally to say how much your early support means to me.
        </Text>
        <Text style={text}>
          As a small token of appreciation, I've added a <strong>Family plan</strong> to your account — on the house.
          There's nothing you need to do; it's already active. Enjoy the extra circle space and invite the people who matter most.
        </Text>
        <Text style={text}>
          Truly, thank you for being part of the early days of {SITE_NAME}. It wouldn't be possible without people like you.
        </Text>
        <Text style={signoff}>
          With gratitude,<br />
          Brett<br />
          <span style={footerSmall}>Founder, {SITE_NAME}</span>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: FounderGiftEmail,
  subject: `A small thank-you from ${SITE_NAME}`,
  displayName: 'Founder gift',
  previewData: { name: 'Haley' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 20px' }
const text = { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 18px' }
const signoff = { fontFamily: 'Georgia, serif', fontSize: '15px', color: '#000000', lineHeight: '1.6', margin: '28px 0 0' }
const footerSmall = { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#999999' }
