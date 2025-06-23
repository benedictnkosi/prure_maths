export default {
  name: 'Dimpo Maths',
  slug: 'dimpo-maths',
  version: '1',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'dimpo-maths',
  userInterfaceStyle: 'automatic',
  newArchEnabled: false,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.dimpomaths',
    buildNumber: '1.0.2',
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      "ITSAppUsesNonExemptEncryption": false,
      "UIBackgroundModes": ["remote-notification"]
    },
    "associatedDomains": ["applinks:examquiz.co.za"]
  },
  android: {
    package: 'com.dimpomaths',
    "intentFilters": [
      {
        "action": "VIEW",
        "autoVerify": true,
        "data": [
          {
            "scheme": "https",
            "host": "examquiz.co.za",
            "pathPrefix": "/"
          }
        ],
        "category": ["BROWSABLE", "DEFAULT"]
      }
    ],
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    permissions: ["NOTIFICATIONS"]
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png'
  },
  plugins: [
    'expo-router',
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          buildToolsVersion: "34.0.0",
          enableWebP: true
        },
        ios: {
          deploymentTarget: "15.1"
        }
      }
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff'
      }
    ],
    [
      'expo-notifications',
      {
        color: '#ffffff'
      }
    ],
    "expo-asset"
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    router: {
      origin: false
    },
    eas: {
      projectId: 'b4f9ab87-947e-4014-8990-0c11fa29cb2c'
    },
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || "AIzaSyCaJHGdAh4f7BRJxNDRNkJ_vrrG74Ur_jA"
  },
  owner: 'nkosib',
  runtimeVersion: {
    policy: 'appVersion'
  },
  updates: {
    url: 'https://u.expo.dev/b4f9ab87-947e-4014-8990-0c11fa29cb2c'
  }
}; 
