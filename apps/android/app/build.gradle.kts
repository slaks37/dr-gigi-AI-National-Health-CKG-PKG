plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}
android {
    namespace = "id.sonri.offline"
    compileSdk = 36
    defaultConfig {
        applicationId = "id.sonri.offline.research"
        minSdk = 29
        targetSdk = 36
        versionCode = 3
        versionName = "0.2.1-hybrid-research"
        buildConfigField("boolean", "NETWORK_ENABLED", "false")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        ndk { abiFilters += setOf("arm64-v8a", "x86_64") }
    }
    buildTypes {
        create("connected") {
            initWith(getByName("debug"))
            matchingFallbacks += "debug"
            buildConfigField("boolean", "NETWORK_ENABLED", "true")
            fun config(name: String, fallback: String = "") = providers.gradleProperty(name).getOrElse(fallback)
            for ((field,property) in mapOf("FIREBASE_PROJECT" to "sonriProject", "FIREBASE_APP_ID" to "sonriAppId", "FIREBASE_API_KEY" to "sonriApiKey", "GOOGLE_CLIENT_ID" to "sonriGoogleClientId", "RELEASE_ORIGIN" to "sonriReleaseOrigin", "RELEASE_PUBLIC_KEY" to "sonriReleasePublicKey")) {
                buildConfigField("String",field,"\"${config(property).replace("\\", "\\\\").replace("\"","\\\"")}\"")
            }
            buildConfigField("boolean","USE_EMULATORS",config("sonriEmulators","false"))
            buildConfigField("String","PROJECT_APPROVAL","\"${config("sonriProjectApproval")}\"")
            manifestPlaceholders["hybridCleartext"] = config("sonriEmulators","false")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Release signing is intentionally absent; owner signing stays outside Git.
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
    packaging { resources.excludes += setOf("META-INF/AL2.0", "META-INF/LGPL2.1") }
    testOptions { unitTests.isReturnDefaultValues = true; animationsDisabled = true }
    testBuildType = if(providers.gradleProperty("sonriConnectedTests").orNull=="true") "connected" else "debug"
    if(providers.gradleProperty("sonriConnectedTests").orNull=="true") {
        sourceSets.getByName("androidTest").java.srcDir("src/connectedAndroidTest/java")
        sourceSets.getByName("androidTest").assets.srcDir("src/connectedAndroidTest/assets")
    }
}
dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.10.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.fragment:fragment-ktx:1.8.8")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.1")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.1")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.24.3")
    implementation("androidx.camera:camera-camera2:1.4.2")
    implementation("androidx.camera:camera-lifecycle:1.4.2")
    implementation("androidx.camera:camera-view:1.4.2")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    "connectedImplementation"(platform("com.google.firebase:firebase-bom:34.4.0"))
    "connectedImplementation"("com.google.firebase:firebase-auth")
    "connectedImplementation"("com.google.firebase:firebase-firestore")
    "connectedImplementation"("androidx.credentials:credentials:1.3.0")
    "connectedImplementation"("androidx.credentials:credentials-play-services-auth:1.3.0")
    "connectedImplementation"("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    "connectedImplementation"("androidx.compose.ui:ui-test-manifest")
}
