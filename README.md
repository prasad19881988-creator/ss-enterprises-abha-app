# SS ENTERPRISES — ABHA REAL-TIME WORK APP

## Login
- Owner/Admin: **SS / ADMIN@12345**
- Employee: **EMP101 / SS@12345**

## Added
- Real-time Socket.IO server
- Persistent server-side employee/work data (`data.json`)
- Owner dashboard receives live employee status/location updates
- Live map using Leaflet + OpenStreetMap
- Employee consent + browser location permission before sharing
- Start Work / Close Work
- Attendance and last-update time
- ABHA card count, area and authorised work-detail reporting
- CSV export
- Official ABHA/ABDM portal button
- No Aadhaar number, OTP or ABHA password collection in this company portal
- Installable PWA support

## Important production limitation
A browser/PWA cannot guarantee continuous Android background location after the app is fully closed or suspended by the OS. For continuous background tracking, a native Android app with a foreground location service is required, with clear employee consent.

For production:
- Deploy over HTTPS.
- Use PostgreSQL/MySQL instead of demo JSON storage.
- Hash passwords and use secure sessions/JWT.
- Add role-based permissions, audit logs, encryption, backups and retention controls.
- Restrict CORS/Socket.IO origins.
- Add rate limiting and server-side validation.
- For any API-based ABHA workflow, use an official/authorised ABDM integration. Do not scrape or automate government pages.
- Keep location collection limited to the stated work purpose and use a clear consent/privacy policy.

## Run
Node.js 18+:
1. `npm install`
2. `npm start`
3. Open `http://localhost:3000`

For phone location sharing, host behind HTTPS.
