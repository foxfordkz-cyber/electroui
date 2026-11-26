plugins { alias(libs.plugins.android.application) }

android {
    namespace = "com.example.electroui"
    compileSdk { version = release(36) { minorApiLevel = 1 } }
    defaultConfig {
        applicationId = "com.example.electroui.studio"
        minSdk = 26
        targetSdk = 36
        versionCode = 4
        versionName = "1.3"
    }
    buildTypes {
        release { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    androidResources { noCompress += listOf("webm", "js") }
}

dependencies {
    implementation(libs.appcompat)
    implementation(libs.material)
    implementation(libs.fragment)
}
