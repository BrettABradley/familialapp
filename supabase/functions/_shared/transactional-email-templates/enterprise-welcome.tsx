/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Familial'

interface Props {
  name?: string
  contactEmail?: string
}

const EnterpriseWelcomeEmail = ({ name }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Thank you for choosing {SITE_NAME} Enterprise</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{name ? `Thank you, ${name}` : `Thank you`}</Heading>
        <Text style={text}>
          Thank you so much for choosing {SITE_NAME} Enterprise to help connect your community.
        </Text>
        <Text style={text}>
          We will not let you down and are always here to support you.
        </Text>
        <Text style={text}>
          Please feel free to contact me directly at <a href="mailto:brett@familialmedia.com" style={link}>brett@familialmedia.com</a> if you have any questions or issues — I read every message personally.
        </Text>
        <Text style={signoff}>
          Warm regards,<br />
          Brett Bradley<br />
          <span style={footerSmall}>Founder, {SITE_NAME}</span>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EnterpriseWelcomeEmail,
  subject: `Welcome to ${SITE_NAME} Enterprise`,
  displayName: 'Enterprise welcome',
  previewData: { name: 'Jordan', contactEmail: 'jordan@example.com' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 20px' }
const text = { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 18px' }
const link = { color: '#000000', textDecoration: 'underline' }
const signoff = { fontFamily: 'Georgia, serif', fontSize: '15px', color: '#000000', lineHeight: '1.6', margin: '28px 0 0' }
const footerSmall = { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#999999' }
