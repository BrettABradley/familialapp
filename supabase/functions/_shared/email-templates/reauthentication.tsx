/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code for Familial</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://qxkwxolssapayqyfdwqc.supabase.co/storage/v1/object/public/email-assets/logo.png"
          alt="Familial"
          width="120"
          height="auto"
          style={logo}
        />
        <Heading style={h1}>Verify your identity</Heading>
        <Text style={text}>Use the code below to confirm it's you:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
const codeStyle = {
  fontFamily: "'SF Mono', 'Fira Code', Courier, monospace",
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#141414',
  letterSpacing: '4px',
  margin: '0 0 32px',
}
const footer = { fontSize: '13px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
