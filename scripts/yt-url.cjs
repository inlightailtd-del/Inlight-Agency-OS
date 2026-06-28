const { randomUUID } = require('crypto')
const GID = '1096913917406-bt3msgkl9gbachf6bktdd7o8eck2qdiv.apps.googleusercontent.com'
const REDIRECT = 'http://localhost:3000/api/integrations/oauth/callback?provider=youtube'
const SCOPE = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.readonly'
const state = randomUUID()
const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: GID,
  redirect_uri: REDIRECT,
  response_type: 'code',
  scope: SCOPE,
  state,
  access_type: 'offline',
  prompt: 'consent',
})
console.log(url)
