/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to Familial — confirm your email to get started</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://qxkwxolssapayqyfdwqc.supabase.co/storage/v1/object/public/email-assets/logo.png"
          alt="Familial"
          width="120"
          height="auto"
          style={logo}
        />
        <Heading style={h1}>Welcome to Familial</Heading>
        <Text style={text}>
          We're so glad you're here. Familial is your family's private space — no algorithms, no tracking, just the people who matter most.
        </Text>
        <Text style={text}>
          Please confirm your email address (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) to get started:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirm My Email
        </Button>
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }
const container = { padding: '40px 25px' }
const logo = { margin: '0 0 24px 0' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  fontFamily: "'Playfair Display', Georgia, serif",
  color: '#141414',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#737373',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const link = { color: 'inherit', textDecoration: 'underline' }
const button = {
  backgroundColor: '#141414',
  color: '#ffffff',
  fontSize: '15px',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  borderRadius: '12px',
  padding: '14px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '13px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
