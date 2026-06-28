# API Implementation Guide

> Step-by-step instructions to connect every Priority 1 and Priority 2 API provider.

---

## Priority 1 Providers

---

### Gmail

**Status:** Configured

**Class:** `App\Services\Providers\GmailProvider` (`app/Services/Providers/GmailProvider.php`)

**Auth type:** OAuth

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret from Google Cloud |
| `GOOGLE_REDIRECT_URI` | Must match a registered redirect URI |

#### Step-by-Step Connection

1. **Create a Google Cloud project**
   - Go to https://console.cloud.google.com/
   - Create a new project or select an existing one.
   - Navigate to **APIs & Services > Library**.
   - Search for **Gmail API** and click **Enable**.

2. **Configure OAuth consent screen**
   - Go to **APIs & Services > OAuth consent screen**.
   - Choose **External** user type.
   - Fill in app name, user support email, and developer contact email.
   - Add scopes: `https://mail.google.com/`, `https://www.googleapis.com/auth/gmail.modify`, `https://www.googleapis.com/auth/gmail.send`.
   - Add test users if in testing mode.

3. **Create OAuth credentials**
   - Go to **APIs & Services > Credentials**.
   - Click **Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - Add **Authorized redirect URIs**: `http://localhost:8000/auth/google/callback` (dev) and `https://your-production-domain.com/auth/google/callback` (production).
   - Copy the **Client ID** and **Client Secret** into `.env`:
     ```
     GOOGLE_CLIENT_ID=your-client-id
     GOOGLE_CLIENT_SECRET=your-client-secret
     GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
     ```

4. **Run the OAuth flow**
   - Navigate to `/dashboard/integrations` in the UI.
   - Click **Connect** on the Gmail card.
   - You will be redirected to Google's consent screen.
   - Approve the requested permissions.
   - After redirect, the provider status should change to **Connected**.

#### Verification

- **Endpoint:** `GET /api/providers/gmail/status`
- **Expected response:** `{ "status": "connected", "email": "user@gmail.com" }`
- **UI test:** Visit `/dashboard/integrations`, confirm Gmail shows a green **Connected** badge.

#### Common Issues

- **Redirect URI mismatch** — Every trailing slash, protocol, and port must exactly match what is registered in Google Cloud.
- **OAuth consent screen not published** — In testing mode, only listed test users can authorize. Publish the app for production.
- **Gmail API not enabled** — Enabling the library alone is not enough; ensure **Gmail API** shows "API Enabled" on the Credentials page.
- **Token expiry** — The refresh token is only issued on the *first* authorization. If you re-authorize, revoke the app in the user's Google account first.

---

### LinkedIn

**Status:** Configured

**Class:** `App\Services\Providers\LinkedInProvider` (`app/Services/Providers/LinkedInProvider.php`)

**Auth type:** OAuth

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `LINKEDIN_CLIENT_ID` | OAuth client ID from LinkedIn Developer Portal |
| `LINKEDIN_CLIENT_SECRET` | OAuth client secret from LinkedIn Developer Portal |
| `LINKEDIN_REDIRECT_URI` | Must match a registered redirect URI |

#### Step-by-Step Connection

1. **Create a LinkedIn app**
   - Go to https://www.linkedin.com/developers/apps/
   - Click **Create app**.
   - Provide app name, LinkedIn page (or create a dummy one), and privacy policy URL.
   - Upload a logo (required).

2. **Request API access**
   - In the **Products** tab, add **Sign In with LinkedIn** (includes `r_emailaddress`, `r_liteprofile`).
   - If posting is needed, also add **Share on LinkedIn** (`w_member_social`).

3. **Configure OAuth settings**
   - Go to the **Auth** tab.
   - Set **Authorized redirect URLs for your app**: `http://localhost:8000/auth/linkedin/callback` and the production callback.
   - Copy the **Client ID** and **Client Secret** into `.env`:
     ```
     LINKEDIN_CLIENT_ID=your-client-id
     LINKEDIN_CLIENT_SECRET=your-client-secret
     LINKEDIN_REDIRECT_URI=http://localhost:8000/auth/linkedin/callback
     ```

4. **Run the OAuth flow**
   - Go to `/dashboard/integrations` and click **Connect** on LinkedIn.
   - Approve the LinkedIn permissions dialog.
   - On success, the provider status changes to **Connected**.

#### Verification

- **Endpoint:** `GET /api/providers/linkedin/status`
- **Expected response:** `{ "status": "connected", "profile": "https://linkedin.com/in/username" }`
- **UI test:** Check the LinkedIn card in `/dashboard/integrations`.

#### Common Issues

- **Redirect URI mismatch** — LinkedIn is strict about exact matches.
- **App not approved for production** — Some scopes (e.g., `w_member_social`) require LinkedIn review before going live.
- **Profile API versioning** — LinkedIn v2 API endpoints change frequently; keep the SDK up to date.

---

### Facebook

**Status:** Configured

**Class:** `App\Services\Providers\FacebookProvider` (`app/Services/Providers/FacebookProvider.php`)

**Auth type:** OAuth

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `FACEBOOK_CLIENT_ID` | App ID from Meta Developer Portal |
| `FACEBOOK_CLIENT_SECRET` | App Secret from Meta Developer Portal |
| `FACEBOOK_REDIRECT_URI` | OAuth redirect URI |

#### Step-by-Step Connection

1. **Create a Meta app**
   - Go to https://developers.facebook.com/apps/
   - Click **Create App**.
   - Choose **Consumer** (or **Business** if you need Pages/Ads access).
   - Fill in the app name and contact email.

2. **Add Facebook Login**
   - In the app dashboard, click **Add Product**.
   - Select **Facebook Login**.
   - Under **Settings**, add redirect URIs:
     - `http://localhost:8000/auth/facebook/callback`
     - `https://your-production-domain.com/auth/facebook/callback`

3. **Configure OAuth**
   - Go to **Facebook Login > Settings**.
   - Enable **Embedded Browser OAuth Login** and **Force OAuth Dialog for Web** (dev only).
   - Set **Valid OAuth Redirect URIs** (comma-separated list).
   - Copy the **App ID** as `FACEBOOK_CLIENT_ID` and **App Secret** as `FACEBOOK_CLIENT_SECRET` into `.env`:
     ```
     FACEBOOK_CLIENT_ID=your-app-id
     FACEBOOK_CLIENT_SECRET=your-app-secret
     FACEBOOK_REDIRECT_URI=http://localhost:8000/auth/facebook/callback
     ```

4. **Run the OAuth flow**
   - Visit `/dashboard/integrations`, click **Connect** on Facebook.
   - Approve the permissions dialog.
   - On success, the provider shows **Connected**.

#### Verification

- **Endpoint:** `GET /api/providers/facebook/status`
- **Expected response:** `{ "status": "connected", "page_id": "123456789" }`
- **UI test:** Confirm green badge on `/dashboard/integrations`.

#### Common Issues

- **App in Development mode** — Only admins/developers can authorize in development mode. Switch to **Live** (with required review) for production.
- **Missing permissions** — Ensure `email`, `public_profile`, and `pages_show_list` are requested.
- **Facebook Login not added** — The product must be explicitly added to the app.

---

### Instagram

**Status:** Configured

**Class:** `App\Services\Providers\InstagramProvider` (`app/Services/Providers/InstagramProvider.php`)

**Auth type:** OAuth (shares Facebook token)

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `FACEBOOK_CLIENT_ID` | Same Meta App ID as Facebook |
| `FACEBOOK_CLIENT_SECRET` | Same Meta App Secret as Facebook |
| `FACEBOOK_USER_ACCESS_TOKEN` | Long-lived user token from Facebook OAuth |

#### Step-by-Step Connection

1. **Complete Facebook OAuth first**
   - Follow the **Facebook** provider steps above.
   - Ensure the Facebook OAuth flow has been run and a token is stored.

2. **Ensure the Facebook user has a linked Instagram Business account**
   - The Facebook user must be an admin of a Facebook Page that has an **Instagram Business account** connected.
   - Verify in Meta Business Suite: https://business.facebook.com/

3. **Get the Instagram Business Account ID**
   - The provider class uses the Facebook token to call:
     ```
     GET /{facebook-page-id}?fields=instagram_business_account
     ```
   - This returns the `instagram_business_account.id`.

4. **Use the token for Instagram Graph API calls**
   - All Instagram API requests use the `FACEBOOK_USER_ACCESS_TOKEN` as the bearer token.
   - No additional OAuth flow is needed for Instagram specifically.

#### Verification

- **Endpoint:** `GET /api/providers/instagram/status`
- **Expected response:** `{ "status": "connected", "instagram_business_id": "178414..." }`
- **UI test:** Instagram card shows **Connected** only if Facebook OAuth is complete and an IG Business account is linked.

#### Common Issues

- **No Instagram Business account linked** — The Facebook user must connect an Instagram Business profile to their Facebook Page via Meta Business Suite.
- **Token expired** — Facebook user tokens expire every 60 days. Extend via the `/oauth/access_token?grant_type=fb_exchange_token` endpoint or use a 90-day token.
- **Insufficient permissions** — Requires `pages_show_list`, `pages_read_engagement`, and `instagram_basic`.

---

### YouTube

**Status:** Configured

**Class:** `App\Services\Providers\YouTubeProvider` (`app/Services/Providers/YouTubeProvider.php`)

**Auth type:** OAuth (shares Google token)

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Same OAuth client ID as Gmail |
| `GOOGLE_CLIENT_SECRET` | Same OAuth client secret as Gmail |
| `GOOGLE_REDIRECT_URI` | Same redirect URI as Gmail |

#### Step-by-Step Connection

1. **Enable YouTube Data API v3**
   - Go to https://console.cloud.google.com/
   - Select your project.
   - Navigate to **APIs & Services > Library**.
   - Search for **YouTube Data API v3** and click **Enable**.

2. **Add YouTube scopes to OAuth consent screen**
   - Go to **APIs & Services > OAuth consent screen**.
   - Add scopes:
     - `https://www.googleapis.com/auth/youtube`
     - `https://www.googleapis.com/auth/youtube.readonly`
     - `https://www.googleapis.com/auth/youtube.upload`
   - Save the consent screen.

3. **Re-authorize with the new scopes**
   - If Gmail OAuth was already completed, the stored token may lack YouTube scopes.
   - Visit `/dashboard/integrations`, click **Connect** on YouTube.
   - The OAuth dialog will now include YouTube permissions.
   - The existing Google token is extended with additional scopes.

4. **No separate credentials needed**
   - YouTube uses the same `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Gmail.
   - Ensure `.env` already has these values from the Gmail setup.

#### Verification

- **Endpoint:** `GET /api/providers/youtube/status`
- **Expected response:** `{ "status": "connected", "channel": "UC..." }`
- **UI test:** YouTube card shows green **Connected** badge on `/dashboard/integrations`.

#### Common Issues

- **API not enabled** — The YouTube Data API v3 must be explicitly enabled in the Google Cloud project.
- **Missing YouTube scope in token** — Re-authorize to add YouTube scopes to the existing Google OAuth token.
- **Quota limits** — YouTube API has a daily quota (default 10,000 units/day). Monitor usage in Google Cloud Console.

---

### Stripe

**Status:** Connected

**Class:** `App\Services\Providers\StripeProvider` (`app/Services/Providers/StripeProvider.php`)

**Auth type:** API Key

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `STRIPE_API_KEY` | Secret key (starts with `sk_live_` or `sk_test_`) |

#### Step-by-Step Connection

1. **Create a Stripe account**
   - Go to https://dashboard.stripe.com/register
   - Complete the onboarding process.

2. **Get your API keys**
   - From the Stripe Dashboard, go to **Developers > API Keys**.
   - Copy the **Secret key** (starting with `sk_test_` for test mode or `sk_live_` for live mode).

3. **Add the key to `.env`**
   ```
   STRIPE_API_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
   ```
   - For production, replace with the live secret key.
   - Never commit the live key to version control.

4. **Verify connectivity**
   - The provider's `handleAction` makes a `GET /v1/balance` call to Stripe.
   - If the key is valid, the balance object is returned.

#### Verification

- **Endpoint:** `GET /api/providers/stripe/status`
- **Expected response:** `{ "status": "connected", "balance": { "available": [...] } }`
- **UI test:** Stripe card shows **Connected** on `/dashboard/integrations`.

#### Common Issues

- **Wrong key prefix** — The key must start with `sk_`. Publishable keys (`pk_`) will not work.
- **Test vs. Live key confusion** — Use `sk_test_` for development and `sk_live_` for production. Switch based on `APP_ENV`.
- **Key rotation** — If the key is regenerated in Stripe, update `.env` immediately.

---

### Calendly

**Status:** Configured

**Class:** `App\Services\Providers\CalendlyProvider` (`app/Services/Providers/CalendlyProvider.php`)

**Auth type:** OAuth

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `CALENDLY_CLIENT_ID` | OAuth client ID from Calendly Developer Portal |
| `CALENDLY_CLIENT_SECRET` | OAuth client secret from Calendly Developer Portal |
| `CALENDLY_REDIRECT_URI` | OAuth redirect URI |

#### Step-by-Step Connection

1. **Register a Calendly OAuth app**
   - Go to https://developer.calendly.com/
   - Sign in with your Calendly account.
   - Navigate to **My Apps > New App**.
   - Fill in the app name and description.

2. **Configure redirect URIs**
   - Add `http://localhost:8000/auth/calendly/callback` and the production callback.
   - Copy the **Client ID** and **Client Secret**.

3. **Add credentials to `.env`**
   ```
   CALENDLY_CLIENT_ID=your-client-id
   CALENDLY_CLIENT_SECRET=your-client-secret
   CALENDLY_REDIRECT_URI=http://localhost:8000/auth/calendly/callback
   ```

4. **Run the OAuth flow**
   - Go to `/dashboard/integrations` and click **Connect** on Calendly.
   - Authorize the Calendly account.
   - On success, the provider status changes to **Connected**.

#### Verification

- **Endpoint:** `GET /api/providers/calendly/status`
- **Expected response:** `{ "status": "connected", "uri": "https://calendly.com/username" }`
- **UI test:** Green badge on `/dashboard/integrations`.

#### Common Issues

- **Calendly account required** — The user must have a Calendly account (free or paid).
- **Redirect URI mismatch** — Calendly enforces exact match including protocol and trailing slash.
- **OAuth scope limitations** — Ensure the app requests `default` scope at minimum.

---

### Twilio

**Status:** Stub

**Class:** `App\Services\Providers\TwilioProvider` (`app/Services/Providers/TwilioProvider.php`)

**Auth type:** API Key

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Account SID from Twilio Console |
| `TWILIO_AUTH_TOKEN` | Auth Token from Twilio Console |
| `TWILIO_PHONE_NUMBER` | A purchased Twilio phone number (E.164 format) |

#### Step-by-Step Connection

1. **Create a Twilio account**
   - Go to https://www.twilio.com/try-twilio
   - Complete registration and verify your email/phone.

2. **Get Account SID and Auth Token**
   - From the Twilio Console (https://console.twilio.com), go to **Account > API Keys & Tokens**.
   - Copy the **Account SID** and **Auth Token**.

3. **Purchase a phone number**
   - In the Console, go to **Phone Numbers > Buy a Number**.
   - Search for an available number with SMS capability.
   - Complete the purchase.

4. **Add credentials to `.env`**
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

5. **Implement the stub**
   - The current class has placeholder logic in `handleAction`.
   - Replace with actual Twilio SDK calls using:
     ```php
     $client = new Client($accountSid, $authToken);
     $client->messages->create($to, ['from' => $twilioNumber, 'body' => $message]);
     ```

#### Verification

- **Endpoint:** `GET /api/providers/twilio/status`
- **Expected response:** `{ "status": "connected", "phone": "+1234567890" }`
- **UI test:** After implementation, Twilio card shows **Connected** on `/dashboard/integrations`.

#### Common Issues

- **Trial account limitations** — Trial accounts can only send messages to verified numbers. Upgrade to a paid account for production.
- **Invalid phone number format** — Numbers must be in E.164 format (e.g., `+14155552671`).
- **Stub not yet functional** — `handleAction` needs real Twilio SDK implementation before the provider is usable.

---

### WhatsApp

**Status:** Configured

**Class:** `App\Services\Providers\WhatsAppProvider` (`app/Services/Providers/WhatsAppProvider.php`)

**Auth type:** OAuth (via Facebook)

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `FACEBOOK_CLIENT_ID` | Same Meta App ID as Facebook |
| `FACEBOOK_CLIENT_SECRET` | Same Meta App Secret as Facebook |
| `WHATSAPP_PHONE_NUMBER_ID` | ID of the WhatsApp Business phone number |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business Account ID (WABA ID) |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Custom token for webhook verification |

#### Step-by-Step Connection

1. **Create a WhatsApp Business Account**
   - Go to https://business.facebook.com/
   - Navigate to **WhatsApp > Accounts**.
   - Click **Add** and follow the prompts to register a business.
   - Verify your business phone number via SMS or call.

2. **Configure Meta App for WhatsApp**
   - In your Meta app (created for Facebook), add the **WhatsApp** product.
   - Go to **WhatsApp > Getting Started**.
   - Copy the **Phone Number ID** and **WhatsApp Business Account ID**.

3. **Set up the webhook**
   - In the WhatsApp product settings, configure:
     - **Callback URL:** `https://your-domain.com/webhooks/whatsapp`
     - **Verify Token:** A string you choose (e.g., `my_verify_token_123`)
   - Add `WHATSAPP_WEBHOOK_VERIFY_TOKEN` to `.env`.

4. **Complete Facebook OAuth with WhatsApp scope**
   - Ensure the Facebook OAuth flow requests the `whatsapp_business_messaging` and `whatsapp_business_management` scopes.
   - If already authorized without these scopes, re-authorize via `/dashboard/integrations`.

5. **Add credentials to `.env`**
   ```
   WHATSAPP_PHONE_NUMBER_ID=123456789
   WHATSAPP_BUSINESS_ACCOUNT_ID=987654321
   WHATSAPP_WEBHOOK_VERIFY_TOKEN=my_verify_token_123
   ```

#### Verification

- **Endpoint:** `GET /api/providers/whatsapp/status`
- **Expected response:** `{ "status": "connected", "phone": "+1234567890" }`
- **UI test:** WhatsApp card shows **Connected** on `/dashboard/integrations`.

#### Common Issues

- **Phone number already registered with WhatsApp** — The number must not already be linked to the WhatsApp Messenger app (personal use). Use a dedicated business number.
- **Webhook not verified** — The verify token must match exactly between the Meta configuration and the application.
- **OAuth scopes missing** — Ensure `whatsapp_business_messaging` scope is requested during Facebook OAuth.
- **24-hour messaging window** — WhatsApp Business API only allows free-form messaging within 24 hours of a user's last message. Outside that window, use pre-approved message templates.

---

## Priority 2 Providers

---

### HubSpot

**Status:** Missing

**Class:** `App\Services\Providers\HubSpotProvider` (`app/Services/Providers/HubSpotProvider.php`)

**Auth type:** API Key (Private App Token)

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `HUBSPOT_API_KEY` | Private app access token |

#### Step-by-Step Connection

1. **Create a HubSpot account**
   - Go to https://app.hubspot.com/signup
   - Complete the signup process (free CRM account is sufficient).

2. **Create a private app**
   - Go to **Settings > Integrations > Private Apps**.
   - Click **Create private app**.
   - Name the app (e.g., "Agency OS Integration").
   - Add the required scopes (e.g., `crm.objects.contacts.read`, `crm.objects.contacts.write`).

3. **Generate the access token**
   - After creating the private app, copy the **Access Token** (starts with `pat-`).
   - Store it in `.env`:
     ```
     HUBSPOT_API_KEY=pat-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
     ```

4. **Verify connectivity**
   - The provider makes a `GET /crm/v3/objects/contacts` call.
   - If the token is valid, a paginated list of contacts is returned.

#### Verification

- **Endpoint:** `GET /api/providers/hubspot/status`
- **Expected response:** `{ "status": "connected", "portal_id": "1234567" }`
- **UI test:** HubSpot card shows **Connected** on `/dashboard/integrations`.

#### Common Issues

- **Token prefix** — HubSpot tokens start with `pat-`. Ensure the complete string including the prefix is in `.env`.
- **Scope mismatch** — If the provider tries to call an endpoint not covered by the app's scopes, the API returns a 403.
- **Token revocation** — Tokens can be revoked from the HubSpot Private Apps settings at any time.

---

### Salesforce

**Status:** Missing

**Class:** `App\Services\Providers\SalesforceProvider` (`app/Services/Providers/SalesforceProvider.php`)

**Auth type:** OAuth

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `SALESFORCE_CLIENT_ID` | Connected App Consumer Key |
| `SALESFORCE_CLIENT_SECRET` | Connected App Consumer Secret |
| `SALESFORCE_REDIRECT_URI` | OAuth redirect URI |
| `SALESFORCE_LOGIN_URL` | Salesforce instance URL (e.g., `https://login.salesforce.com`) |

#### Step-by-Step Connection

1. **Create a Salesforce Connected App**
   - Log in to https://login.salesforce.com/
   - Go to **Setup > App Manager > New Connected App**.
   - Fill in the app name and contact email.
   - Enable **OAuth Settings**.

2. **Configure OAuth settings**
   - Callback URL: `http://localhost:8000/auth/salesforce/callback` and the production URL.
   - Select OAuth scopes (minimum: `Access basic information (id, profile, email, address, phone)`, `Access and manage your data (api)`).
   - Require **Secret for Web Server Flow** (checked).
   - Save the app. Note the **Consumer Key (Client ID)** and **Consumer Secret (Client Secret)**.

3. **Add credentials to `.env`**
   ```
   SALESFORCE_CLIENT_ID=your-consumer-key
   SALESFORCE_CLIENT_SECRET=your-consumer-secret
   SALESFORCE_REDIRECT_URI=http://localhost:8000/auth/salesforce/callback
   SALESFORCE_LOGIN_URL=https://login.salesforce.com
   ```

4. **Run the OAuth flow**
   - Visit `/dashboard/integrations` and click **Connect** on Salesforce.
   - Log in to Salesforce and approve the app.
   - On success, the provider receives an access token and instance URL.

#### Verification

- **Endpoint:** `GET /api/providers/salesforce/status`
- **Expected response:** `{ "status": "connected", "instance_url": "https://instance.salesforce.com" }`
- **UI test:** Green badge on `/dashboard/integrations`.

#### Common Issues

- **Consumer Secret not shown after creation** — Salesforce only shows it once. Regenerate from the Connected App page if lost.
- **Sandbox vs. Production** — Use `https://test.salesforce.com` as `SALESFORCE_LOGIN_URL` for sandbox instances.
- **IP restrictions** — Salesforce orgs may have trusted IP range restrictions. Whitelist your server's IP.

---

### Slack

**Status:** Missing

**Class:** `App\Services\Providers\SlackProvider` (`app/Services/Providers/SlackProvider.php`)

**Auth type:** Bot Token

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `SLACK_BOT_TOKEN` | Bot token starting with `xoxb-` |

#### Step-by-Step Connection

1. **Create a Slack app**
   - Go to https://api.slack.com/apps
   - Click **Create New App > From Scratch**.
   - Provide an app name and select a workspace.

2. **Add bot token scopes**
   - In the app settings, go to **OAuth & Permissions > Scopes**.
   - Add **Bot Token Scopes** (e.g., `chat:write`, `channels:read`, `users:read`, `reactions:write`).

3. **Install the app to your workspace**
   - Go to **OAuth & Permissions > OAuth Tokens**.
   - Click **Install to Workspace** and approve the permissions.
   - Copy the **Bot User OAuth Token** (starts with `xoxb-`).

4. **Add credentials to `.env`**
   ```
   SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx
   ```

#### Verification

- **Endpoint:** `GET /api/providers/slack/status`
- **Expected response:** `{ "status": "connected", "workspace": "your-workspace", "bot_name": "Agency OS" }`
- **UI test:** Slack card shows **Connected** on `/dashboard/integrations`.

#### Common Issues

- **Wrong token type** — Use `xoxb-` (bot) tokens, not `xoxp-` (user) tokens.
- **Insufficient scopes** — The provider may need additional scopes like `files:upload` or `conversations:history`.
- **App not installed** — The token is only generated after the app is installed to a workspace.

---

### Discord

**Status:** Missing

**Class:** `App\Services\Providers\DiscordProvider` (`app/Services/Providers/DiscordProvider.php`)

**Auth type:** Bot Token

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `DISCORD_BOT_TOKEN` | Bot token from Discord Developer Portal |

#### Step-by-Step Connection

1. **Create a Discord application**
   - Go to https://discord.com/developers/applications
   - Click **New Application**.
   - Give it a name and confirm.

2. **Create a bot**
   - Go to the **Bot** tab on the left sidebar.
   - Click **Add Bot > Yes, do it!**.
   - Customize the bot username and icon if desired.

3. **Get the bot token**
   - Under the **Bot** tab, click **Reset Token** (or copy the existing one).
   - Store the token in `.env`:
     ```
     DISCORD_BOT_TOKEN=your-bot-token-here
     ```

4. **Invite the bot to your server**
   - Go to the **OAuth2 > URL Generator** tab.
   - Select scope: **bot**.
   - Select permissions (e.g., `Send Messages`, `Read Message History`, `Manage Webhooks`).
   - Open the generated URL in a browser to invite the bot.

#### Verification

- **Endpoint:** `GET /api/providers/discord/status`
- **Expected response:** `{ "status": "connected", "bot_id": "123456789", "guilds": ["server-name"] }`
- **UI test:** Green badge on `/dashboard/integrations`.

#### Common Issues

- **Bot not in any server** — The bot must be invited to at least one Discord server to operate.
- **Token leaked** — If the token is exposed, regenerate it immediately from the Developer Portal.
- **Privileged intents** — Some features (e.g., reading all messages) require enabling **Message Content Intent** under the Bot tab.

---

### Telegram

**Status:** Missing

**Class:** `App\Services\Providers\TelegramProvider` (`app/Services/Providers/TelegramProvider.php`)

**Auth type:** Bot Token

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |

#### Step-by-Step Connection

1. **Create a bot via BotFather**
   - Open Telegram and search for **@BotFather**.
   - Send `/newbot`.
   - Follow the prompts to choose a name and username for the bot.
   - On success, BotFather sends a **token** (format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`).

2. **Set up webhook (optional)**
   - Configure a webhook URL to receive updates:
     ```
     POST https://api.telegram.org/bot<token>/setWebhook?url=https://your-domain.com/webhooks/telegram
     ```
   - Or use polling (long polling with `getUpdates`) for development.

3. **Add credentials to `.env`**
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   ```

4. **Test the bot**
   - Send `/start` to your bot on Telegram.
   - The provider's `handleAction` should respond (e.g., echo the message or return a help text).

#### Verification

- **Endpoint:** `GET /api/providers/telegram/status`
- **Expected response:** `{ "status": "connected", "bot_username": "@your_bot" }`
- **UI test:** Telegram card shows **Connected** on `/dashboard/integrations`.

#### Common Issues

- **Token format** — The token contains a colon (`:`) and must be stored exactly as provided.
- **Webhook vs polling conflict** — If one is enabled, the other is disabled. Use only one method.
- **Bot privacy mode** — By default, bots only see messages that start with `/`. Disable privacy mode in BotFather with `/setprivacy`.

---

### Airtable

**Status:** Missing

**Class:** `App\Services\Providers\AirtableProvider` (`app/Services/Providers/AirtableProvider.php`)

**Auth type:** API Key (Personal Access Token)

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `AIRTABLE_API_KEY` | Personal Access Token from Airtable |

#### Step-by-Step Connection

1. **Create an Airtable account**
   - Go to https://airtable.com/signup
   - Complete the signup process (free tier includes generous API limits).

2. **Generate a Personal Access Token**
   - Go to https://airtable.com/create/tokens
   - Click **Create a token**.
   - Give it a name (e.g., "Agency OS Integration").
   - Add scopes: **data.records:read**, **data.records:write**, **schema.bases:read**.
   - Add access to specific bases (or all bases).
   - Click **Create token** and copy the token value.

3. **Add credentials to `.env`**
   ```
   AIRTABLE_API_KEY=patxxxxxxxxxxxxxx
   ```

4. **Verify connectivity**
   - The provider makes a `GET /v0/meta/bases` call.
   - If the token is valid, a list of accessible bases is returned.

#### Verification

- **Endpoint:** `GET /api/providers/airtable/status`
- **Expected response:** `{ "status": "connected", "bases": ["Base Name", "..."] }`
- **UI test:** Green badge on `/dashboard/integrations`.

#### Common Issues

- **Outdated API key format** — Airtable deprecated API keys in favor of Personal Access Tokens (prefixed with `pat`). Do not use legacy API keys.
- **Scope restrictions** — If a base is not included in the token's access scope, API calls to that base will fail.
- **Base ID required** — Most Airtable API calls require the Base ID (found in the URL when viewing the base), not just the base name.

---

### n8n

**Status:** Missing

**Class:** `App\Services\Providers\N8nProvider` (`app/Services/Providers/N8nProvider.php`)

**Auth type:** API Key + Base URL

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `N8N_API_KEY` | API key from n8n instance |
| `N8N_BASE_URL` | Base URL of the n8n instance |

#### Step-by-Step Connection

1. **Set up an n8n instance**
   - Self-host: https://docs.n8n.io/hosting/installation/
   - Or use n8n Cloud: https://app.n8n.cloud/register

2. **Generate an API key**
   - In n8n, go to **Settings > API**.
   - Click **Create API Key**.
   - Copy the generated key.

3. **Add credentials to `.env`**
   ```
   N8N_API_KEY=n8n_api_xxxxxxxxxxxx
   N8N_BASE_URL=https://your-n8n-instance.com
   ```

4. **Verify connectivity**
   - The provider makes a `GET /rest/workflows` call.
   - If credentials are valid, a paginated list of workflows is returned.

#### Verification

- **Endpoint:** `GET /api/providers/n8n/status`
- **Expected response:** `{ "status": "connected", "workflows": 5, "base_url": "https://your-n8n-instance.com" }`
- **UI test:** Green badge on `/dashboard/integrations`.

#### Common Issues

- **Self-hosted URL** — For local instances, ensure `N8N_BASE_URL` includes the protocol and port (e.g., `http://localhost:5678`).
- **API key format** — n8n API keys have a variable prefix. Store the full key as generated.
- **CORS issues** — If calling from the browser, ensure the n8n instance has proper CORS headers configured.

---

### Make (formerly Integromat)

**Status:** Missing

**Class:** `App\Services\Providers\MakeProvider` (`app/Services/Providers/MakeProvider.php`)

**Auth type:** API Key + Base URL

#### Required Credentials

| Variable | Description |
|----------|-------------|
| `MAKE_API_KEY` | API key from Make account |
| `MAKE_BASE_URL` | Make API base URL (default: `https://eu1.make.com`) |

#### Step-by-Step Connection

1. **Create a Make account**
   - Go to https://www.make.com/en/register
   - Complete the signup process (free tier available).

2. **Generate an API key**
   - In Make, go to your profile icon > **Settings > API**.
   - Click **Add new token**.
   - Enter a token name and click **Save**.
   - Copy the generated token.

3. **Add credentials to `.env`**
   ```
   MAKE_API_KEY=your-make-api-token
   MAKE_BASE_URL=https://eu1.make.com
   ```
   - The base URL depends on your Make region (eu1, eu2, us1, etc.). Check the URL when logged into Make.

4. **Verify connectivity**
   - The provider makes a `GET /api/v2/connections` call.
   - A successful response confirms the API key is valid.

#### Verification

- **Endpoint:** `GET /api/providers/make/status`
- **Expected response:** `{ "status": "connected", "organization": "Org Name" }`
- **UI test:** Green badge on `/dashboard/integrations`.

#### Common Issues

- **Wrong region** — Make runs on multiple regional instances (eu1, eu2, us1, etc.). Use the correct base URL for your account.
- **Token expiration** — Make API tokens do not expire by default, but can be revoked manually from the Settings page.
- **Rate limits** — Make enforces rate limits. Check the `X-RateLimit-*` response headers if calls start failing.

---

## Quick Reference: Status Summary

| # | Provider | Status | Auth Type |
|---|----------|--------|-----------|
| 1 | Gmail | Configured | OAuth |
| 2 | LinkedIn | Configured | OAuth |
| 3 | Facebook | Configured | OAuth |
| 4 | Instagram | Configured | OAuth (shared) |
| 5 | YouTube | Configured | OAuth (shared) |
| 6 | Stripe | Connected | API Key |
| 7 | Calendly | Configured | OAuth |
| 8 | Twilio | Stub | API Key |
| 9 | WhatsApp | Configured | OAuth (shared) |
| 10 | HubSpot | Missing | API Key |
| 11 | Salesforce | Missing | OAuth |
| 12 | Slack | Missing | Bot Token |
| 13 | Discord | Missing | Bot Token |
| 14 | Telegram | Missing | Bot Token |
| 15 | Airtable | Missing | API Key |
| 16 | n8n | Missing | API Key + URL |
| 17 | Make | Missing | API Key + URL |
