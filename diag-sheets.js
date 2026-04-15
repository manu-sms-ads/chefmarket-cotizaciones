'use strict';
// Diagnóstico rápido: muestra hojas existentes y primeras filas de data
const { google } = require('googleapis');
const fs   = require('fs');
const path = require('path');

const envRaw = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const env = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=');
      const k = l.slice(0, i).trim();
      let v   = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [k, v];
    })
);

const creds = {
  type: 'service_account',
  project_id:    env.GOOGLE_PROJECT_ID,
  private_key_id: env.GOOGLE_PRIVATE_KEY_ID,
  private_key:   (env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  client_email:  env.GOOGLE_CLIENT_EMAIL,
  client_id:     env.GOOGLE_CLIENT_ID,
  auth_uri:  'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
};

const auth   = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });
const sid    = env.GOOGLE_SHEET_ID;

async function run() {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sid });
  console.log('=== HOJAS EN EL SPREADSHEET ===');
  meta.data.sheets.forEach(s => {
    console.log(`  • "${s.properties.title}"  (sheetId: ${s.properties.sheetId})`);
  });

  for (const sh of meta.data.sheets) {
    const name = sh.properties.title;
    if (name === 'DASHBOARD') continue;
    try {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: sid,
        range: `'${name}'!A1:C5`,
      });
      const vals = r.data.values || [];
      console.log(`\n=== "${name}" — primeras filas ===`);
      if (!vals.length) { console.log('  (vacía)'); continue; }
      vals.forEach((row, i) => console.log(`  R${i+1}:`, JSON.stringify(row)));
    } catch(e) {
      console.log(`\n"${name}": ERROR — ${e.message}`);
    }
  }
}

run().catch(e => console.error('ERROR:', e.message));
