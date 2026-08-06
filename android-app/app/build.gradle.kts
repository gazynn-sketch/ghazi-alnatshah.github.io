plugins {
    id("com.android.application")
}

android {
    namespace = "com.alnatshah.sadaqah"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.alnatshah.sadaqah"
        minSdk = 24
        targetSdk = 36
        versionCode = 2
        versionName = "1.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
