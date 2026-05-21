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

const EnterpriseWelcomeEmail = ({ name, contactEmail }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Thank you for choosing {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{name ? `Welcome, ${name}` : 'Welcome'}</Heading>
        <Text style={text}>
          Thank you for choosing {SITE_NAME}. Your Enterprise account is now active, and we genuinely appreciate your business.
        </Text>
        <Text style={text}>
          Your account has been configured with the limits we agreed on. You can begin creating circles and inviting members right away. Billing will be handled directly between us, outside of the app.
        </Text>
        <Text style={text}>
          If anything comes up{contactEmail ? ` regarding ${contactEmail}` : ''}, or you need adjustments to your plan, simply reply to this email and we will take care of it.
        </Text>
        <Text style={text}>
          Thank you again for trusting {SITE_NAME} with your community.
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
const signoff = { fontFamily: 'Georgia, serif', fontSize: '15px', color: '#000000', lineHeight: '1.6', margin: '28px 0 0' }
const footerSmall = { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#999999' }
