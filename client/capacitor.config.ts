import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.spark.app',
  appName: 'Spark',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
