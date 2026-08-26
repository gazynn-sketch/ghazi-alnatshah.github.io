plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.alnatshah.sadaqah"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.alnatshah.sadaqah"
        minSdk = 24
        targetSdk = 36
        versionCode = 7
        versionName = "1.2.4"
    }

    val keystorePath = System.getenv("KEYSTORE_FILE")
    val keystorePassword = System.getenv("KEYSTORE_PASSWORD")
    val keyAliasValue = System.getenv("KEY_ALIAS")
    val keyPasswordValue = System.getenv("KEY_PASSWORD")

    if (!keystorePath.isNullOrBlank() && !keystorePassword.isNullOrBlank() &&
        !keyAliasValue.isNullOrBlank() && !keyPasswordValue.isNullOrBlank()) {
        signingConfigs {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = keystorePassword
                keyAlias = keyAliasValue
                keyPassword = keyPasswordValue
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            if (signingConfigs.findByName("release") != null) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:34.17.0"))
    implementation("com.google.firebase:firebase-messaging")
    implementation("androidx.activity:activity:1.13.0")
}
