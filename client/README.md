# Client

## Development

Create your local API config in development:

```bash
cp .env.development .env.local
```

Run the frontend:

```bash
npm install
npm run dev
```

Development uses `VITE_API_BASE_URL=/api/v1`, which continues to work with the Vite proxy to `http://localhost:3000`.

## Android Packaging

This frontend is packaged for Android with Capacitor.

1. Create a production env file:

```bash
cp .env.production.example .env.production
```

2. Set `VITE_API_BASE_URL` in `.env.production` to your deployed backend, for example:

```bash
VITE_API_BASE_URL=https://api.example.com/api/v1
```

3. Install dependencies and generate the Android project:

```bash
npm install
npx cap add android
```

4. Build and sync web assets into the Android shell:

```bash
npm run cap:sync
```

5. Open Android Studio:

```bash
npm run cap:open
```

6. In Android Studio, build an APK or App Bundle.

## Notes

- The backend in `server/` is not bundled into the APK. It must be deployed separately.
- Android production should use `https`. If your API is only `http`, Android network security configuration is required.
- Routing uses `HashRouter` so packaged Android builds can open nested pages without server-side rewrite support.
