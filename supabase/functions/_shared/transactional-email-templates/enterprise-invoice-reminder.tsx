/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Familial'

interface Props {
  customerName?: string
  contactEmail?: string
  amountUsd?: string
  cadence?: string
  dueDate?: string
  daysUntilDue?: number
}

const EnterpriseInvoiceReminderEmail = ({
  customerName, contactEmail, amountUsd, cadence, dueDate, daysUntilDue,
}: Props) => {
  const heading = daysUntilDue === 0
    ? 'Enterprise invoice is due today'
    : `Enterprise invoice due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Reminder: send invoice to {customerName ?? 'Enterprise customer'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{heading}</Heading>
          <Text style={text}>Internal reminder from {SITE_NAME}.</Text>
          <Text style={text}><strong>Customer:</strong> {customerName ?? 'Unknown'}</Text>
          <Text style={text}><strong>Contact:</strong> {contactEmail ?? 'Not set'}</Text>
          <Text style={text}><strong>Amount:</strong> {amountUsd ?? 'Not set'} USD</Text>
          <Text style={text}><strong>Cadence:</strong> {cadence ?? 'Not set'}</Text>
          <Text style={text}><strong>Due date:</strong> {dueDate ?? 'Not set'}</Text>
          <Text style={text}>
            After sending the invoice, open the admin dashboard and use Mark Invoice Sent to advance the next due date.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: EnterpriseInvoiceReminderEmail,
  subject: (d: Record<string, any>) =>
    d.daysUntilDue === 0
      ? `Invoice due today: ${d.customerName ?? 'Enterprise customer'}`
      : `Invoice due in ${d.daysUntilDue} day${d.daysUntilDue === 1 ? '' : 's'}: ${d.customerName ?? 'Enterprise customer'}`,
  to: 'brettbradley007@gmail.com',
  displayName: 'Enterprise invoice reminder',
  previewData: { customerName: 'Acme Co', contactEmail: 'ops@acme.com', amountUsd: '500.00', cadence: 'monthly', dueDate: '2026-06-01', daysUntilDue: 7 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 20px' }
const text = { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 12px' }
