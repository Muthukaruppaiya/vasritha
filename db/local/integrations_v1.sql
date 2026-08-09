-- Channel integrations (WhatsApp, SMS, Email) — admin toggles + config
create table if not exists public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  channel text not null unique check (channel in ('whatsapp', 'sms', 'email')),
  is_enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.integration_settings (channel, is_enabled, config)
values
  (
    'whatsapp',
    false,
    jsonb_build_object(
      'phoneNumber', '919000000000',
      'showFloat', true,
      'prefillMessage', 'Hi Vasritha, I need help with…'
    )
  ),
  (
    'sms',
    false,
    jsonb_build_object(
      'provider', 'twilio',
      'accountSid', '',
      'authToken', '',
      'fromNumber', '',
      'senderId', ''
    )
  ),
  (
    'email',
    false,
    jsonb_build_object(
      'provider', 'smtp',
      'host', '',
      'port', 587,
      'user', '',
      'pass', '',
      'from', ''
    )
  )
on conflict (channel) do nothing;

comment on table public.integration_settings is
  'Admin-managed WhatsApp / SMS / Email integrations. Disabled by default until enabled.';
